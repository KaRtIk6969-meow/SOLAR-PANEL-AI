"""
SolarAI Hardware Health Evaluation Service
Computes multi-dimensional hardware health metrics (electrical, thermal, photovoltaic)
derived from real sensor readings, active physical conditions, and AI model prediction residuals.
"""

from datetime import datetime, timezone
from typing import Optional, Tuple, Dict, Any
from sqlalchemy.orm import Session
from app.models.health_score import HealthScore
from app.models.sensor_reading import SensorReading
from app.models.prediction import Prediction
from ml.predict import predict_power, NoModelAvailableError


def calculate_health_factors(
    reading: SensorReading,
    residual: float,
    predicted_w: float,
) -> Tuple[float, float, float, float, float, str]:
    """
    Computes dimensional hardware health scores (0-100% scale):
    - photovoltaic_health: optical conversion performance compared to AI model baseline
    - thermal_health: semiconductor cell temperature derating and thermal stress
    - electrical_health: current-voltage operational integrity and circuit status
    - overall_score: composite health evaluation
    - degradation_factor: estimated annual cell degradation rate (%/yr)
    - recommendation: actionable diagnostic guidance
    """
    voltage = reading.voltage_v
    current = reading.current_a
    temp_c = reading.temperature_c
    irradiance = reading.irradiance_w_m2
    power = reading.power_w
    quality = reading.data_quality or "GOOD"

    # 1. Photovoltaic Conversion Health (0 - 100)
    # Compares measured generation against model prediction under active solar flux
    if irradiance > 40.0 and predicted_w > 1.0:
        ratio = power / predicted_w
        # Bound between 10% and 100%
        pv_health = max(10.0, min(100.0, round(ratio * 98.0, 1)))
    else:
        # Night or low-light standby
        pv_health = 95.0

    # 2. Thermal Health (0 - 100)
    # Silicon cells operate optimally at <= 25°C STC. Degrade ~0.38% / °C above 25°C.
    # Critical thermal threshold: 75°C.
    if temp_c <= 25.0:
        thermal_health = 100.0
    else:
        thermal_drop = (temp_c - 25.0) * 1.2
        thermal_health = max(20.0, min(100.0, round(100.0 - thermal_drop, 1)))

    if temp_c > 75.0 or quality == "OVERHEATING":
        thermal_health = max(10.0, thermal_health - 35.0)

    # 3. Electrical Health (0 - 100)
    # Validates circuit integrity (open-circuit, short-circuit, or low efficiency)
    if quality == "SUSPECT_OPEN_CIRCUIT" or (irradiance > 150.0 and voltage > 15.0 and current < 0.05):
        electrical_health = 20.0
    elif quality == "SUSPECT_SHORT_CIRCUIT" or (irradiance > 300.0 and voltage < 1.0 and current > 1.0):
        electrical_health = 15.0
    elif quality == "LOW_EFFICIENCY":
        electrical_health = 60.0
    elif reading.efficiency_pct is not None and reading.efficiency_pct < 4.0 and irradiance > 100.0:
        electrical_health = 70.0
    else:
        electrical_health = 98.0

    # 4. Composite Overall Score (Weighted: 40% Optical/PV, 35% Electrical, 25% Thermal)
    composite = (0.40 * pv_health) + (0.35 * electrical_health) + (0.25 * thermal_health)
    overall_score = round(max(10.0, min(100.0, composite)), 1)

    # If active critical anomaly exists, cap overall score at 50%
    if quality in ("OVERHEATING", "SUSPECT_OPEN_CIRCUIT", "SUSPECT_SHORT_CIRCUIT"):
        overall_score = min(50.0, overall_score)

    # 5. Annual Degradation Factor (%/year)
    # Baseline ~0.55%/year for crystalline silicon; scaled if chronic deficits exist
    degradation_factor = round(max(0.40, min(5.0, 0.55 + max(0.0, 95.0 - overall_score) * 0.03)), 2)

    # 6. Actionable Recommendation
    if quality == "OVERHEATING" or thermal_health < 65.0:
        recommendation = f"Thermal Warning: Cell surface reached {temp_c:.1f}°C. Improve backside airflow and heat dissipation."
    elif quality == "SUSPECT_OPEN_CIRCUIT":
        recommendation = "Open Circuit Detected: Array terminal voltage near Voc with near-zero load current. Check switchgear and load connections."
    elif quality == "SUSPECT_SHORT_CIRCUIT":
        recommendation = "Short Circuit Warning: Zero array terminal voltage under bright sunlight. Inspect wiring for bypass diode or cable short."
    elif pv_health < 75.0:
        recommendation = f"Soiling / Shading Loss: Power is {abs(residual):.1f}W below expected AI baseline. Cleaning glass surface recommended."
    elif electrical_health < 80.0:
        recommendation = "Electrical Derating: Module efficiency is below nominal curve. Verify string voltage and inverter MPPT tracker."
    else:
        recommendation = "Optimal Operation: Multi-spectral electrical, thermal, and optical parameters within nominal parameters."

    return overall_score, electrical_health, thermal_health, pv_health, degradation_factor, recommendation


def compute_and_record_health_score(
    db: Session,
    device_id: str,
    reading: SensorReading,
    residual: float,
    predicted_w: float,
) -> HealthScore:
    """
    Computes real hardware health score and persists to the health_scores table.
    """
    overall, elec, therm, pv, deg, rec = calculate_health_factors(reading, residual, predicted_w)

    health_record = HealthScore(
        device_id=device_id,
        timestamp=reading.timestamp,
        overall_score=overall,
        electrical_health=round(elec, 1),
        thermal_health=round(therm, 1),
        photovoltaic_health=round(pv, 1),
        degradation_factor=deg,
        recommendation=rec,
        created_at=datetime.now(timezone.utc),
    )
    db.add(health_record)
    return health_record


def backfill_device_predictions_and_health(
    db: Session,
    device_id: str = "SOLAR-ESP32-01",
) -> Dict[str, int]:
    """
    Backfills ML predictions and health scores for all historical real sensor readings
    that do not yet have corresponding predictions in the database.
    """
    # 1. Fetch all real readings (excluding demo records)
    readings = (
        db.query(SensorReading)
        .filter(SensorReading.device_id == device_id, SensorReading.data_quality != "DEMO")
        .order_by(SensorReading.timestamp.asc())
        .all()
    )

    # 2. Get existing prediction timestamps to avoid duplicates
    existing_preds = {
        p.timestamp: p for p in db.query(Prediction).filter(Prediction.device_id == device_id).all()
    }

    preds_added = 0
    scores_added = 0

    for r in readings:
        if r.timestamp in existing_preds:
            continue

        try:
            pred_out = predict_power({
                "voltage_v": r.voltage_v,
                "current_a": r.current_a,
                "temperature_c": r.temperature_c,
                "irradiance_w_m2": r.irradiance_w_m2,
            })
            pred_w = pred_out["predicted_power_w"]
            model_ver = pred_out["model_version"]
            residual = round(r.power_w - pred_w, 2)
            dev_pct = round((residual / pred_w) * 100.0, 2) if pred_w > 0 else 0.0

            prediction_entry = Prediction(
                device_id=device_id,
                timestamp=r.timestamp,
                target="power_w",
                predicted_value=pred_w,
                actual_value=r.power_w,
                residual=residual,
                deviation_pct=dev_pct,
                alert_status="CRITICAL" if r.data_quality == "OVERHEATING" else ("WARNING" if r.is_anomaly else "NORMAL"),
                model_version=model_ver,
                created_at=datetime.now(timezone.utc),
            )
            db.add(prediction_entry)
            preds_added += 1

            # Generate and record health score
            compute_and_record_health_score(db, device_id, r, residual, pred_w)
            scores_added += 1
        except NoModelAvailableError:
            break
        except Exception:
            continue

    if preds_added > 0 or scores_added > 0:
        db.commit()

    return {"predictions_added": preds_added, "health_scores_added": scores_added}
