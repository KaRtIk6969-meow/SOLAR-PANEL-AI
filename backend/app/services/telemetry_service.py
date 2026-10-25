from datetime import datetime, timezone, timedelta
from typing import Optional, List, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.models.sensor_reading import SensorReading, TelemetryReading
from app.models.device import Device
from app.models.alert import Alert
from app.models.prediction import Prediction
from app.schemas.telemetry import TelemetryCreate, DashboardDataResponse, TelemetryResponse
from app.services.device_service import get_or_create_device, compute_device_status
from app.services.health_service import compute_and_record_health_score
from app.services.alert_service import evaluate_and_record_alerts
from ml.predict import predict_power, NoModelAvailableError


class DuplicateRecordException(Exception):
    def __init__(self, device_id: str, timestamp: datetime):
        self.device_id = device_id
        self.timestamp = timestamp
        super().__init__(f"Duplicate telemetry record detected for device '{device_id}' at timestamp '{timestamp.isoformat()}'.")


def calculate_power(voltage_v: float, current_a: float) -> float:
    """Calculates instantaneous electric power in Watts (W = V * A)."""
    return round(voltage_v * current_a, 2)


def calculate_efficiency(power_w: float, panel_area_m2: float, irradiance_w_m2: float) -> Optional[float]:
    """
    Calculates instantaneous conversion efficiency (%):
    Efficiency = (Power / (Area * Irradiance)) * 100
    Valid when irradiance is greater than minimum measurable threshold (e.g. 20 W/m²).
    """
    if irradiance_w_m2 < 20.0 or panel_area_m2 <= 0:
        return None
    raw_eff = (power_w / (panel_area_m2 * irradiance_w_m2)) * 100.0
    # Bound within plausible physical silicon limits (0% to 35%)
    bounded = max(0.0, min(35.0, raw_eff))
    return round(bounded, 2)


def evaluate_anomalies(voltage_v: float, current_a: float, temp_c: float, irradiance_w_m2: float) -> Tuple[bool, Optional[str], str]:
    """
    Instantaneous edge rule diagnostics for hardware failure detection.
    Returns: (is_anomaly, anomaly_notes, data_quality_tag)
    """
    notes = []
    data_quality = "GOOD"

    # 1. Thermal overheating
    if temp_c > 75.0:
        notes.append(f"Thermal Critical: Cell temperature ({temp_c}°C) exceeds safe 75°C threshold.")
        data_quality = "OVERHEATING"

    # 2. Open circuit condition under bright sunlight
    if irradiance_w_m2 > 150.0 and voltage_v > 15.0 and current_a < 0.05:
        notes.append("Open Circuit: Array voltage near Voc with negligible load current.")
        if data_quality == "GOOD":
            data_quality = "SUSPECT_OPEN_CIRCUIT"

    # 3. Short circuit or zero voltage under high sunlight
    if irradiance_w_m2 > 300.0 and voltage_v < 1.0 and current_a > 1.0:
        notes.append("Short Circuit: Zero array voltage under active sunlight generation.")
        if data_quality == "GOOD":
            data_quality = "SUSPECT_SHORT_CIRCUIT"

    if notes:
        return True, " | ".join(notes), data_quality
    return False, None, "GOOD"


def record_telemetry(db: Session, telemetry_in: TelemetryCreate) -> SensorReading:
    """
    Validates, calculates derived metrics, checks for duplicates, and persists
    real hardware sensor readings into PostgreSQL sensor_readings.
    """
    # 1. Ensure device exists (or auto-provision for college hardware testbed)
    device = get_or_create_device(db, telemetry_in.device_id)

    # 2. Check for duplicate record (device_id + timestamp)
    existing = db.query(SensorReading).filter(
        SensorReading.device_id == telemetry_in.device_id,
        SensorReading.timestamp == telemetry_in.timestamp
    ).first()

    if existing:
        raise DuplicateRecordException(telemetry_in.device_id, telemetry_in.timestamp)

    # 3. Derive Power and Efficiency
    power_w = calculate_power(telemetry_in.voltage_v, telemetry_in.current_a)
    efficiency_pct = calculate_efficiency(power_w, device.panel_area_m2, telemetry_in.irradiance_w_m2)

    # 4. Check instantaneous anomalies and tag data quality
    is_anomaly, anomaly_notes, quality_tag = evaluate_anomalies(
        telemetry_in.voltage_v,
        telemetry_in.current_a,
        telemetry_in.temperature_c,
        telemetry_in.irradiance_w_m2
    )

    if quality_tag == "GOOD" and efficiency_pct is not None and efficiency_pct < 3.0:
        quality_tag = "LOW_EFFICIENCY"

    fw_ver = getattr(telemetry_in, "firmware_version", "1.0.0") or "1.0.0"

    # 5. Persist record into sensor_readings
    reading = SensorReading(
        device_id=telemetry_in.device_id,
        timestamp=telemetry_in.timestamp,
        voltage_v=telemetry_in.voltage_v,
        current_a=telemetry_in.current_a,
        temperature_c=telemetry_in.temperature_c,
        irradiance_w_m2=telemetry_in.irradiance_w_m2,
        power_w=power_w,
        efficiency_pct=efficiency_pct,
        data_quality=quality_tag,
        firmware_version=fw_ver,
        created_at=datetime.now(timezone.utc),
    )
    db.add(reading)

    # 6. Update device heartbeat and state
    device.last_seen_at = telemetry_in.timestamp
    device.firmware_version = fw_ver
    device.status = "ONLINE"
    db.commit()
    db.refresh(reading)

    # 7. Live AI Inference, Prediction Persistence & Physical Health Scoring
    pred_w = None
    residual = None
    model_ver = None

    if quality_tag != "DEMO":
        try:
            pred_out = predict_power({
                "voltage_v": reading.voltage_v,
                "current_a": reading.current_a,
                "temperature_c": reading.temperature_c,
                "irradiance_w_m2": reading.irradiance_w_m2,
            })
            pred_w = pred_out["predicted_power_w"]
            model_ver = pred_out["model_version"]
            residual = round(reading.power_w - pred_w, 2)
            dev_pct = round((residual / pred_w) * 100.0, 2) if pred_w > 0 else 0.0

            alert_st = "CRITICAL" if quality_tag == "OVERHEATING" else ("WARNING" if is_anomaly else "NORMAL")
            prediction_entry = Prediction(
                device_id=reading.device_id,
                timestamp=reading.timestamp,
                target="power_w",
                predicted_value=pred_w,
                actual_value=reading.power_w,
                residual=residual,
                deviation_pct=dev_pct,
                alert_status=alert_st,
                model_version=model_ver,
                created_at=datetime.now(timezone.utc),
            )
            db.add(prediction_entry)

            # Persist real hardware health score
            compute_and_record_health_score(db, reading.device_id, reading, residual, pred_w)
            db.commit()

            # Attach prediction values to reading instance for API response
            reading.predicted_power_w = pred_w
            reading.residual = residual
            reading.model_version = model_ver
        except NoModelAvailableError:
            pass
        except Exception:
            # Telemetry ingestion must not fail if ML inference encounters an issue
            pass

    # 8. Intelligent Diagnostic Alerts & Anomaly Evaluation with Deduplication (Step 9)
    try:
        evaluate_and_record_alerts(db, reading, residual=residual, predicted_w=pred_w, model_version=model_ver)
        db.commit()
    except Exception:
        pass

    return reading


def get_latest_reading(db: Session, device_id: str) -> Optional[SensorReading]:
    reading = (
        db.query(SensorReading)
        .filter(SensorReading.device_id == device_id)
        .order_by(SensorReading.timestamp.desc())
        .first()
    )
    if reading:
        pred = (
            db.query(Prediction)
            .filter(Prediction.device_id == device_id, Prediction.timestamp == reading.timestamp)
            .first()
        )
        if pred:
            reading.predicted_power_w = pred.predicted_value
            reading.residual = pred.residual
            reading.model_version = pred.model_version
        elif reading.data_quality != "DEMO":
            # If historical record didn't have prediction, compute on-the-fly
            try:
                pred_out = predict_power({
                    "voltage_v": reading.voltage_v,
                    "current_a": reading.current_a,
                    "temperature_c": reading.temperature_c,
                    "irradiance_w_m2": reading.irradiance_w_m2,
                })
                reading.predicted_power_w = pred_out["predicted_power_w"]
                reading.residual = round(reading.power_w - pred_out["predicted_power_w"], 2)
                reading.model_version = pred_out["model_version"]
            except Exception:
                pass
    return reading


def get_historical_telemetry(
    db: Session,
    device_id: str,
    limit: int = 100,
    start_time: Optional[datetime] = None,
    end_time: Optional[datetime] = None
) -> List[SensorReading]:
    query = db.query(SensorReading).filter(SensorReading.device_id == device_id)
    
    if start_time:
        query = query.filter(SensorReading.timestamp >= start_time)
    if end_time:
        query = query.filter(SensorReading.timestamp <= end_time)

    readings = query.order_by(SensorReading.timestamp.desc()).limit(limit).all()
    if readings:
        timestamps = [r.timestamp for r in readings]
        preds = (
            db.query(Prediction)
            .filter(Prediction.device_id == device_id, Prediction.timestamp.in_(timestamps))
            .all()
        )
        preds_map = {p.timestamp: p for p in preds}
        for r in readings:
            p = preds_map.get(r.timestamp)
            if p:
                r.predicted_power_w = p.predicted_value
                r.residual = p.residual
                r.model_version = p.model_version
            elif r.data_quality != "DEMO":
                try:
                    pred_out = predict_power({
                        "voltage_v": r.voltage_v,
                        "current_a": r.current_a,
                        "temperature_c": r.temperature_c,
                        "irradiance_w_m2": r.irradiance_w_m2,
                    })
                    r.predicted_power_w = pred_out["predicted_power_w"]
                    r.residual = round(r.power_w - pred_out["predicted_power_w"], 2)
                    r.model_version = pred_out["model_version"]
                except Exception:
                    pass

    return readings


def get_dashboard_summary(db: Session, device_id: str) -> DashboardDataResponse:
    device = get_or_create_device(db, device_id)
    status_info = compute_device_status(device)
    latest = get_latest_reading(db, device_id)

    # Aggregations for today (UTC)
    now = datetime.now(timezone.utc)
    start_of_day = datetime(now.year, now.month, now.day, 0, 0, 0, tzinfo=timezone.utc)

    today_readings = (
        db.query(SensorReading)
        .filter(
            SensorReading.device_id == device_id,
            SensorReading.timestamp >= start_of_day
        )
        .all()
    )

    today_peak_power_w = 0.0
    today_energy_wh = 0.0
    efficiencies = []

    if today_readings:
        today_peak_power_w = max(r.power_w for r in today_readings)
        # Approximate trapezoidal / interval integration: assume typical reporting cadence (10s intervals)
        today_energy_wh = sum(r.power_w * (10.0 / 3600.0) for r in today_readings)
        efficiencies = [r.efficiency_pct for r in today_readings if r.efficiency_pct is not None]

    avg_efficiency = round(sum(efficiencies) / len(efficiencies), 2) if efficiencies else None

    return DashboardDataResponse(
        device_id=device.id,
        device_name=device.name,
        status=status_info.status,
        last_seen_at=device.last_seen_at,
        rated_power_w=device.rated_power_w,
        panel_area_m2=device.panel_area_m2,
        current_reading=TelemetryResponse.model_validate(latest) if latest else None,
        today_energy_wh=round(today_energy_wh, 2),
        today_peak_power_w=round(today_peak_power_w, 2),
        avg_efficiency_pct=avg_efficiency,
        total_samples_today=len(today_readings),
    )
