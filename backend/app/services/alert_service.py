"""
SolarAI Intelligent Alert & Diagnostics Engine (Step 9)
Evaluates real sensor telemetry, active ML model predictions, residuals, and hardware state
to generate contextual alarms with deduplication, debouncing, and auto-resolution.
"""

from datetime import datetime, timezone, timedelta
from typing import Optional, List, Tuple, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import func, desc

from app.core.config import settings
from app.models.alert import Alert
from app.models.device import Device
from app.models.sensor_reading import SensorReading
from app.models.prediction import Prediction
from app.schemas.alert import AlertSummaryResponse


def record_or_update_alert(
    db: Session,
    device_id: str,
    timestamp: datetime,
    alert_type: str,
    category: str,
    severity: str,
    message: str,
    metric_name: Optional[str] = None,
    metric_value: Optional[float] = None,
    expected_value: Optional[float] = None,
    unit: Optional[str] = None,
    recommended_action: Optional[str] = None,
) -> Tuple[Alert, bool]:
    """
    Persists or updates an alert with strict deduplication / cooldown:
    If an unresolved alert with the same (device_id, alert_type) is already open,
    its timestamp and latest measured metrics are updated instead of creating a duplicate row.
    Returns: (alert_instance, created_boolean)
    """
    # 1. Look for existing active (unresolved) alert of this type
    existing = (
        db.query(Alert)
        .filter(
            Alert.device_id == device_id,
            Alert.alert_type == alert_type,
            Alert.is_resolved == False,
        )
        .first()
    )

    if existing:
        # Update existing alert with latest timestamp and values
        existing.timestamp = timestamp
        existing.severity = severity
        existing.message = message
        existing.metric_name = metric_name
        existing.metric_value = metric_value
        existing.expected_value = expected_value
        existing.unit = unit
        existing.recommended_action = recommended_action
        return existing, False

    # 2. Create new alert
    new_alert = Alert(
        device_id=device_id,
        timestamp=timestamp,
        severity=severity,
        category=category,
        message=message,
        alert_type=alert_type,
        metric_name=metric_name,
        metric_value=metric_value,
        expected_value=expected_value,
        unit=unit,
        recommended_action=recommended_action,
        is_resolved=False,
        created_at=datetime.now(timezone.utc),
    )
    db.add(new_alert)
    return new_alert, True


def auto_resolve_alert_type(
    db: Session,
    device_id: str,
    alert_type: str,
    resolved_time: Optional[datetime] = None,
) -> int:
    """
    Marks any active alerts of the specified type as resolved when the condition clears.
    Returns the count of resolved alerts.
    """
    res_time = resolved_time or datetime.now(timezone.utc)
    active_alerts = (
        db.query(Alert)
        .filter(
            Alert.device_id == device_id,
            Alert.alert_type == alert_type,
            Alert.is_resolved == False,
        )
        .all()
    )

    count = 0
    for a in active_alerts:
        a.is_resolved = True
        a.resolved_at = res_time
        count += 1
    return count


def resolve_single_alert(
    db: Session,
    alert_id: int,
) -> Optional[Alert]:
    """Manually marks a specific alert as resolved."""
    alert = db.query(Alert).filter(Alert.id == alert_id).first()
    if not alert:
        return None
    alert.is_resolved = True
    alert.resolved_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(alert)
    return alert


def check_recent_soiling_persistence(
    db: Session,
    device_id: str,
    min_samples: int = 3,
    min_deficit_pct: float = 12.0,
) -> bool:
    """
    Multi-sample check for possible shading or soiling:
    Verifies if the last min_samples non-demo readings under active sunlight
    consistently yielded power below AI expected output.
    """
    recent_readings = (
        db.query(SensorReading)
        .filter(
            SensorReading.device_id == device_id,
            SensorReading.data_quality != "DEMO",
            SensorReading.irradiance_w_m2 >= settings.ALERT_SOILING_MIN_IRRADIANCE_W_M2,
        )
        .order_by(SensorReading.timestamp.desc())
        .limit(min_samples)
        .all()
    )

    if len(recent_readings) < min_samples:
        return False

    timestamps = [r.timestamp for r in recent_readings]
    preds = (
        db.query(Prediction)
        .filter(Prediction.device_id == device_id, Prediction.timestamp.in_(timestamps))
        .all()
    )
    preds_map = {p.timestamp: p for p in preds}

    for r in recent_readings:
        p = preds_map.get(r.timestamp)
        if not p or p.predicted_value <= 1.0:
            return False
        deficit_pct = ((p.predicted_value - r.power_w) / p.predicted_value) * 100.0
        if deficit_pct < min_deficit_pct:
            return False

    return True


def evaluate_and_record_alerts(
    db: Session,
    reading: SensorReading,
    residual: Optional[float] = None,
    predicted_w: Optional[float] = None,
    model_version: Optional[str] = None,
) -> List[Alert]:
    """
    Core intelligent diagnostic evaluation pipeline.
    Triggered on every valid real telemetry reading:
    1. Performance & ML residual alarms (Phase 2)
    2. Thermal diagnostics (Phase 3)
    3. Electrical integrity checks (Phase 4)
    4. Sensor bounds & anomalies (Phase 5)
    5. Multi-signal persistent shading / soiling (Phase 6)
    6. Offline device recovery (Phase 9)
    """
    if reading.data_quality == "DEMO":
        return []

    alerts_touched = []
    device_id = reading.device_id
    now = reading.timestamp
    power = reading.power_w
    voltage = reading.voltage_v
    current = reading.current_a
    temp = reading.temperature_c
    irradiance = reading.irradiance_w_m2

    # -------------------------------------------------------------
    # 0. Offline Recovery (If device was offline, resolve offline alert)
    # -------------------------------------------------------------
    resolved_offline = auto_resolve_alert_type(db, device_id, "DEVICE_OFFLINE", resolved_time=now)
    if resolved_offline > 0:
        recovery_alert, _ = record_or_update_alert(
            db=db,
            device_id=device_id,
            timestamp=now,
            alert_type="DEVICE_RECOVERED",
            category="CONNECTIVITY",
            severity="INFO",
            message=f"ESP32 edge device '{device_id}' reconnected. Real-time telemetry resumed.",
            metric_name="Heartbeat",
            metric_value=0.0,
            expected_value=0.0,
            unit="sec",
            recommended_action="No action required. Hardware telemetry stream is operational.",
        )
        alerts_touched.append(recovery_alert)

    # -------------------------------------------------------------
    # 1. Intelligent Performance Alarms via ML Residual (Phase 2)
    # -------------------------------------------------------------
    if irradiance >= settings.ALERT_MIN_EVAL_IRRADIANCE_W_M2 and predicted_w is not None and predicted_w >= settings.ALERT_MIN_EVAL_PREDICTED_W:
        deficit_w = predicted_w - power
        deficit_pct = round((deficit_w / predicted_w) * 100.0, 1) if predicted_w > 0 else 0.0

        if deficit_pct >= settings.ALERT_PERF_CRIT_DEVIATION_PCT:
            # Critical performance deficit (>= 20%)
            auto_resolve_alert_type(db, device_id, "PERF_DEFICIT_WARN", resolved_time=now)
            alert, _ = record_or_update_alert(
                db=db,
                device_id=device_id,
                timestamp=now,
                alert_type="PERF_DEFICIT_CRIT",
                category="PERFORMANCE",
                severity="CRITICAL",
                message=(
                    f"Generation is significantly below AI expected output. "
                    f"Measured {power:.2f}W vs AI expected {predicted_w:.2f}W "
                    f"(deficit: {deficit_pct:.1f}%, residual: {residual:+.2f}W, model: {model_version or 'active'})."
                ),
                metric_name="Power Output",
                metric_value=power,
                expected_value=predicted_w,
                unit="W",
                recommended_action="Inspect panel surface, array connections, and inverter/charge controller tracking.",
            )
            alerts_touched.append(alert)
        elif deficit_pct >= settings.ALERT_PERF_WARN_DEVIATION_PCT:
            # Moderate performance deficit (10% to < 20%)
            auto_resolve_alert_type(db, device_id, "PERF_DEFICIT_CRIT", resolved_time=now)
            alert, _ = record_or_update_alert(
                db=db,
                device_id=device_id,
                timestamp=now,
                alert_type="PERF_DEFICIT_WARN",
                category="PERFORMANCE",
                severity="WARNING",
                message=(
                    f"Generation is below AI expected output. "
                    f"Measured {power:.2f}W vs AI expected {predicted_w:.2f}W "
                    f"(deficit: {deficit_pct:.1f}%, residual: {residual:+.2f}W)."
                ),
                metric_name="Power Output",
                metric_value=power,
                expected_value=predicted_w,
                unit="W",
                recommended_action="Inspect panel surface and surrounding area for dust or shading.",
            )
            alerts_touched.append(alert)
        elif deficit_pct < 8.0:
            # Power within nominal baseline (< 8% deficit with 2% hysteresis) -> resolve performance alerts
            auto_resolve_alert_type(db, device_id, "PERF_DEFICIT_CRIT", resolved_time=now)
            auto_resolve_alert_type(db, device_id, "PERF_DEFICIT_WARN", resolved_time=now)

    # -------------------------------------------------------------
    # 2. Thermal Diagnostics (Phase 3)
    # -------------------------------------------------------------
    if temp > settings.ALERT_TEMP_CRIT_C:
        # Critical overheating (> 75°C)
        auto_resolve_alert_type(db, device_id, "TEMP_WARN", resolved_time=now)
        alert, _ = record_or_update_alert(
            db=db,
            device_id=device_id,
            timestamp=now,
            alert_type="TEMP_CRIT",
            category="THERMAL",
            severity="CRITICAL",
            message=f"Panel temperature is critically high ({temp:.1f}°C > {settings.ALERT_TEMP_CRIT_C}°C). Risk of accelerated cell degradation.",
            metric_name="Cell Temperature",
            metric_value=temp,
            expected_value=25.0,
            unit="°C",
            recommended_action="Check panel ventilation, mounting conditions, and reduce extreme thermal load immediately.",
        )
        alerts_touched.append(alert)
    elif temp >= settings.ALERT_TEMP_WARN_C:
        # Elevated temperature (60°C - 75°C)
        auto_resolve_alert_type(db, device_id, "TEMP_CRIT", resolved_time=now)
        alert, _ = record_or_update_alert(
            db=db,
            device_id=device_id,
            timestamp=now,
            alert_type="TEMP_WARN",
            category="THERMAL",
            severity="WARNING",
            message=f"Panel temperature is elevated ({temp:.1f}°C) and may reduce generation efficiency.",
            metric_name="Cell Temperature",
            metric_value=temp,
            expected_value=25.0,
            unit="°C",
            recommended_action="Check panel ventilation, mounting conditions, and excessive heat exposure.",
        )
        alerts_touched.append(alert)
    elif temp < settings.ALERT_TEMP_WARN_C - 2.0:
        # Temperature normal (< 58°C with hysteresis)
        auto_resolve_alert_type(db, device_id, "TEMP_CRIT", resolved_time=now)
        auto_resolve_alert_type(db, device_id, "TEMP_WARN", resolved_time=now)

    # -------------------------------------------------------------
    # 3. Electrical Diagnostics (Phase 4)
    # -------------------------------------------------------------
    # 3a. Open Circuit: voltage present but negligible current under bright sun
    if irradiance > 100.0 and voltage > 12.0 and current < 0.05:
        alert, _ = record_or_update_alert(
            db=db,
            device_id=device_id,
            timestamp=now,
            alert_type="OPEN_CIRCUIT",
            category="ELECTRICAL",
            severity="WARNING",
            message=f"Voltage present ({voltage:.2f}V) but load current unexpectedly near zero ({current:.2f}A) under active sunlight ({irradiance:.0f} W/m²).",
            metric_name="Array Current",
            metric_value=current,
            expected_value=1.5,
            unit="A",
            recommended_action="Inspect wiring, connectors, and load/inverter connections for open circuit.",
        )
        alerts_touched.append(alert)
    else:
        auto_resolve_alert_type(db, device_id, "OPEN_CIRCUIT", resolved_time=now)

    # 3b. Short Circuit: current flowing with near-zero voltage under bright sun
    if irradiance > 200.0 and voltage < 1.0 and current > 1.0:
        alert, _ = record_or_update_alert(
            db=db,
            device_id=device_id,
            timestamp=now,
            alert_type="SHORT_CIRCUIT",
            category="ELECTRICAL",
            severity="CRITICAL",
            message=f"Current flowing ({current:.2f}A) with abnormally low array voltage ({voltage:.2f}V) under sunlight ({irradiance:.0f} W/m²).",
            metric_name="Array Voltage",
            metric_value=voltage,
            expected_value=18.4,
            unit="V",
            recommended_action="Inspect wiring, junction box, and bypass diodes for electrical short.",
        )
        alerts_touched.append(alert)
    else:
        auto_resolve_alert_type(db, device_id, "SHORT_CIRCUIT", resolved_time=now)

    # 3c. Power Inconsistency: power deviates from V * I
    expected_power = round(voltage * current, 2)
    if abs(power - expected_power) > 1.0:
        alert, _ = record_or_update_alert(
            db=db,
            device_id=device_id,
            timestamp=now,
            alert_type="ELECTRICAL_MISMATCH",
            category="ELECTRICAL",
            severity="WARNING",
            message=f"Measured power ({power:.2f}W) is inconsistent with calculated V × I ({expected_power:.2f}W).",
            metric_name="Electric Power",
            metric_value=power,
            expected_value=expected_power,
            unit="W",
            recommended_action="Inspect sensor calibration and analog-to-digital converter accuracy.",
        )
        alerts_touched.append(alert)
    else:
        auto_resolve_alert_type(db, device_id, "ELECTRICAL_MISMATCH", resolved_time=now)

    # -------------------------------------------------------------
    # 4. Sensor Diagnostics & Physical Bound Validation (Phase 5)
    # -------------------------------------------------------------
    is_sensor_out_of_bounds = (
        voltage < settings.MIN_VOLTAGE_V or voltage > settings.MAX_VOLTAGE_V or
        current < settings.MIN_CURRENT_A or current > settings.MAX_CURRENT_A or
        temp < settings.MIN_TEMPERATURE_C or temp > settings.MAX_TEMPERATURE_C or
        irradiance < settings.MIN_IRRADIANCE_W_M2 or irradiance > settings.MAX_IRRADIANCE_W_M2
    )

    if is_sensor_out_of_bounds:
        alert, _ = record_or_update_alert(
            db=db,
            device_id=device_id,
            timestamp=now,
            alert_type="SENSOR_FAULT",
            category="ANOMALY",
            severity="WARNING",
            message=f"Sensor values out of physical boundaries (V={voltage:.1f}V, I={current:.2f}A, T={temp:.1f}°C, G={irradiance:.0f}W/m²).",
            metric_name="Sensor Bus",
            metric_value=voltage,
            expected_value=18.4,
            unit="V",
            recommended_action="Check sensor wiring, ADC calibration, and edge microcontroller supply voltage.",
        )
        alerts_touched.append(alert)
    else:
        auto_resolve_alert_type(db, device_id, "SENSOR_FAULT", resolved_time=now)

    # -------------------------------------------------------------
    # 5. Multi-Signal Possible Soiling / Shading Diagnostics (Phase 6)
    # -------------------------------------------------------------
    # Requires: high sunlight, normal temperature, no open/short circuit, persistent deficit >= 3 readings
    is_electrical_normal = not (irradiance > 100.0 and voltage > 12.0 and current < 0.05) and not (irradiance > 200.0 and voltage < 1.0 and current > 1.0)
    is_temp_normal = temp < settings.ALERT_TEMP_WARN_C

    if irradiance >= settings.ALERT_SOILING_MIN_IRRADIANCE_W_M2 and is_electrical_normal and is_temp_normal:
        is_persistent_deficit = check_recent_soiling_persistence(
            db=db,
            device_id=device_id,
            min_samples=settings.ALERT_SOILING_MIN_SAMPLES,
            min_deficit_pct=settings.ALERT_SOILING_DEFICIT_PCT,
        )

        if is_persistent_deficit:
            alert, _ = record_or_update_alert(
                db=db,
                device_id=device_id,
                timestamp=now,
                alert_type="SOILING_SHADING",
                category="EFFICIENCY",
                severity="WARNING",
                message=(
                    f"Possible shading or panel soiling detected across multiple readings. "
                    f"Actual yield ({power:.1f}W) is persistently below AI expected baseline "
                    f"under high solar irradiance ({irradiance:.0f} W/m²)."
                ),
                metric_name="PV Soiling / Shading",
                metric_value=power,
                expected_value=predicted_w or round(power * 1.15, 1),
                unit="W",
                recommended_action="Inspect the panel surface and check for nearby shading or accumulated dust.",
            )
            alerts_touched.append(alert)
        else:
            # If under active high sun and no deficit persists, resolve soiling alert
            if predicted_w and power >= predicted_w * 0.90:
                auto_resolve_alert_type(db, device_id, "SOILING_SHADING", resolved_time=now)

    return alerts_touched


def evaluate_device_offline_alerts(db: Session, device_id: Optional[str] = None) -> List[Alert]:
    """
    Checks all registered devices or a specific device for heartbeat staleness (Phase 9):
    If last_seen_at is older than DEVICE_STALE_THRESHOLD_SEC (180s), an active DEVICE_OFFLINE alert is logged.
    """
    query = db.query(Device)
    if device_id:
        query = query.filter(Device.id == device_id)
    devices = query.all()

    alerts = []
    now = datetime.now(timezone.utc)

    for dev in devices:
        if not dev.last_seen_at:
            continue
        last_seen = dev.last_seen_at
        if last_seen.tzinfo is None:
            last_seen = last_seen.replace(tzinfo=timezone.utc)

        elapsed_sec = (now - last_seen).total_seconds()

        if elapsed_sec > settings.DEVICE_STALE_THRESHOLD_SEC:
            alert, _ = record_or_update_alert(
                db=db,
                device_id=dev.id,
                timestamp=now,
                alert_type="DEVICE_OFFLINE",
                category="CONNECTIVITY",
                severity="CRITICAL",
                message=f"ESP32 edge device '{dev.id}' is offline ({int(elapsed_sec)}s without telemetry link beacon).",
                metric_name="Heartbeat Link",
                metric_value=round(elapsed_sec, 0),
                expected_value=float(settings.DEVICE_ONLINE_THRESHOLD_SEC),
                unit="sec",
                recommended_action="Check ESP32 power supply, Wi-Fi connection, and backend network accessibility.",
            )
            alerts.append(alert)
        elif elapsed_sec <= settings.DEVICE_ONLINE_THRESHOLD_SEC:
            auto_resolve_alert_type(db, dev.id, "DEVICE_OFFLINE", resolved_time=now)

    if alerts:
        db.commit()

    return alerts


def get_alerts_summary(db: Session, device_id: Optional[str] = None) -> AlertSummaryResponse:
    """
    Computes active and resolved alert counts for the Dashboard and Alerts Center.
    """
    query = db.query(Alert)
    if device_id:
        query = query.filter(Alert.device_id == device_id)

    all_alerts = query.all()
    active_alerts = [a for a in all_alerts if not a.is_resolved]

    critical_count = sum(1 for a in active_alerts if a.severity.upper() == "CRITICAL")
    warning_count = sum(1 for a in active_alerts if a.severity.upper() == "WARNING")
    info_count = sum(1 for a in active_alerts if a.severity.upper() == "INFO")
    resolved_count = sum(1 for a in all_alerts if a.is_resolved)
    total_active = len(active_alerts)

    if total_active == 0:
        status_text = "System operating normally."
    elif critical_count > 0:
        status_text = f"{critical_count} critical alert{'s' if critical_count > 1 else ''} require immediate attention."
    else:
        status_text = f"{warning_count} active warning{'s' if warning_count > 1 else ''} detected."

    return AlertSummaryResponse(
        device_id=device_id,
        total_active=total_active,
        critical_count=critical_count,
        warning_count=warning_count,
        info_count=info_count,
        resolved_count=resolved_count,
        status_text=status_text,
    )
