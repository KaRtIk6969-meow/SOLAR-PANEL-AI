"""
SolarAI Context Engine (Step 11)
Extracts, structures, and synthesizes live physical sensor telemetry,
active ML model predictions/residuals, hardware health evaluations,
diagnostic alerts, and aggregate performance analytics for AI grounding.
"""

from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
from sqlalchemy.orm import Session

from app.models.sensor_reading import SensorReading
from app.models.prediction import Prediction
from app.models.health_score import HealthScore
from app.models.alert import Alert
from app.models.device import Device
from ml.model_registry import default_registry
from app.services import analytics_service
from app.schemas.ai_assistant import (
    SolarAIContextResponse,
    CurrentStateContext,
    AIModelContext,
    HealthContext,
    AlertContextItem,
    AnalyticsContext,
    ExtremePeriodContext,
)


def build_solar_ai_context(db: Session, device_id: str) -> SolarAIContextResponse:
    """
    Constructs a comprehensive, grounded snapshot of real hardware operations.
    Strictly excludes DEMO records and never fabricates missing values.
    """
    now = datetime.now(timezone.utc)

    # 1. Device Info & Operational Heartbeat
    device = db.query(Device).filter(Device.id == device_id).first()
    device_status = device.status if device else "UNKNOWN"

    # 2. Latest Telemetry Reading (Strictly Real Hardware)
    latest_reading = (
        db.query(SensorReading)
        .filter(
            SensorReading.device_id == device_id,
            SensorReading.data_quality != "DEMO",
        )
        .order_by(SensorReading.timestamp.desc())
        .first()
    )

    if not latest_reading:
        # Empty device state - return clean un-fabricated context
        meta = default_registry.get_active_model_metadata() or {}
        ai_ctx = AIModelContext(
            model_name=meta.get("model_name", "XGBoostRegressor"),
            model_version=meta.get("model_version", "unknown"),
            r2_score=meta.get("r2_score"),
            mae_w=meta.get("mae"),
            rmse_w=meta.get("rmse"),
            dataset_samples=meta.get("dataset_size"),
            latest_predicted_power_w=None,
            latest_actual_power_w=None,
            latest_residual_w=None,
            latest_deviation_pct=None,
        )

        return SolarAIContextResponse(
            device_id=device_id,
            data_source="REAL_HARDWARE",
            timestamp=now,
            has_data=False,
            current=CurrentStateContext(
                timestamp=None,
                device_id=device_id,
                status=device_status,
                voltage_v=None,
                current_a=None,
                temperature_c=None,
                irradiance_w_m2=None,
                power_w=None,
                efficiency_pct=None,
            ),
            ai=ai_ctx,
            health=None,
            alerts=[],
            analytics=AnalyticsContext(total_samples=0),
        )

    # 3. Aligned AI Prediction & Residual
    pred = (
        db.query(Prediction)
        .filter(Prediction.device_id == device_id, Prediction.timestamp == latest_reading.timestamp)
        .first()
    )
    if not pred:
        pred = (
            db.query(Prediction)
            .filter(Prediction.device_id == device_id)
            .order_by(Prediction.timestamp.desc())
            .first()
        )

    # 4. Model Metadata from Registry
    meta = default_registry.get_active_model_metadata() or {}
    model_name = meta.get("model_name", "XGBoostRegressor")
    model_version = meta.get("model_version", pred.model_version if pred else "unknown")
    r2_score = meta.get("r2_score")
    mae_w = meta.get("mae")
    rmse_w = meta.get("rmse")
    dataset_samples = meta.get("dataset_size")

    # Residual math: actual - predicted
    actual_pwr = latest_reading.power_w
    pred_val = pred.predicted_value if pred else None
    residual_val = pred.residual if pred else None
    if residual_val is None and actual_pwr is not None and pred_val is not None:
        residual_val = round(actual_pwr - pred_val, 2)

    deviation_pct = pred.deviation_pct if pred else None
    if deviation_pct is None and pred_val and pred_val > 0 and actual_pwr is not None:
        deviation_pct = round(((actual_pwr - pred_val) / pred_val) * 100.0, 2)

    ai_ctx = AIModelContext(
        model_name=model_name,
        model_version=model_version,
        r2_score=r2_score,
        mae_w=mae_w,
        rmse_w=rmse_w,
        dataset_samples=dataset_samples,
        latest_predicted_power_w=pred_val,
        latest_actual_power_w=actual_pwr,
        latest_residual_w=residual_val,
        latest_deviation_pct=deviation_pct,
    )

    # 5. Latest Hardware Health Evaluation
    latest_health = (
        db.query(HealthScore)
        .filter(HealthScore.device_id == device_id)
        .order_by(HealthScore.timestamp.desc())
        .first()
    )

    health_ctx: Optional[HealthContext] = None
    if latest_health:
        overall = round(latest_health.overall_score, 1)
        h_status = "OPTIMAL" if overall >= 90 else "DEGRADED" if overall >= 75 else "CRITICAL"
        health_ctx = HealthContext(
            overall_score=overall,
            electrical_health=round(latest_health.electrical_health, 1),
            thermal_health=round(latest_health.thermal_health, 1),
            photovoltaic_health=round(latest_health.photovoltaic_health, 1),
            recommendation=latest_health.recommendation,
            status=h_status,
        )

    # 6. Active Unresolved Diagnostic Alerts
    active_alerts_db = (
        db.query(Alert)
        .filter(Alert.device_id == device_id, Alert.is_resolved == False)
        .order_by(Alert.timestamp.desc())
        .all()
    )
    alerts_ctx: List[AlertContextItem] = [
        AlertContextItem(
            id=a.id,
            timestamp=a.timestamp,
            severity=a.severity,
            category=a.category,
            alert_type=a.alert_type,
            message=a.message,
            metric_value=a.metric_value,
            expected_value=a.expected_value,
            unit=a.unit,
            recommendation=a.recommended_action,
        )
        for a in active_alerts_db
    ]

    # 7. Aggregate Historical Analytics (24-Hour Scope)
    summary_24h = analytics_service.get_analytics_summary(db=db, device_id=device_id, range_str="24h")
    perf_24h = analytics_service.get_analytics_performance(db=db, device_id=device_id, range_str="24h")

    best_p_ctx: Optional[ExtremePeriodContext] = None
    if perf_24h.best_period:
        bp = perf_24h.best_period
        best_p_ctx = ExtremePeriodContext(
            timestamp=bp.timestamp,
            power_w=bp.power_w,
            voltage_v=bp.voltage_v,
            current_a=bp.current_a,
            temperature_c=bp.temperature_c,
            irradiance_w_m2=bp.irradiance_w_m2,
            predicted_power_w=bp.predicted_power_w,
            residual_w=bp.residual_w,
            health_score=bp.health_score,
            alert_message=bp.alert_message,
        )

    worst_p_ctx: Optional[ExtremePeriodContext] = None
    if perf_24h.worst_period:
        wp = perf_24h.worst_period
        worst_p_ctx = ExtremePeriodContext(
            timestamp=wp.timestamp,
            power_w=wp.power_w,
            voltage_v=wp.voltage_v,
            current_a=wp.current_a,
            temperature_c=wp.temperature_c,
            irradiance_w_m2=wp.irradiance_w_m2,
            predicted_power_w=wp.predicted_power_w,
            residual_w=wp.residual_w,
            health_score=wp.health_score,
            alert_message=wp.alert_message,
        )

    analytics_ctx = AnalyticsContext(
        total_samples=summary_24h.total_samples,
        avg_power_w=summary_24h.avg_power_w,
        max_power_w=summary_24h.max_power_w,
        min_power_w=summary_24h.min_power_w,
        total_energy_wh=summary_24h.total_energy_wh,
        avg_voltage_v=summary_24h.avg_voltage_v,
        avg_current_a=summary_24h.avg_current_a,
        avg_temperature_c=summary_24h.avg_temperature_c,
        avg_irradiance_w_m2=summary_24h.avg_irradiance_w_m2,
        avg_efficiency_pct=summary_24h.avg_efficiency_pct,
        best_period=best_p_ctx,
        worst_period=worst_p_ctx,
    )

    current_ctx = CurrentStateContext(
        timestamp=latest_reading.timestamp,
        device_id=device_id,
        status=device_status,
        voltage_v=latest_reading.voltage_v,
        current_a=latest_reading.current_a,
        temperature_c=latest_reading.temperature_c,
        irradiance_w_m2=latest_reading.irradiance_w_m2,
        power_w=latest_reading.power_w,
        efficiency_pct=latest_reading.efficiency_pct,
    )

    return SolarAIContextResponse(
        device_id=device_id,
        data_source="REAL_HARDWARE",
        timestamp=now,
        has_data=True,
        current=current_ctx,
        ai=ai_ctx,
        health=health_ctx,
        alerts=alerts_ctx,
        analytics=analytics_ctx,
    )
