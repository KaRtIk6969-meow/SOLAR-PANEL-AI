from datetime import datetime, timezone
from typing import Optional, List
from sqlalchemy.orm import Session
from app.models.device import Device
from app.schemas.device import DeviceCreate, DeviceUpdate, DeviceStatusResponse, DeviceTelemetryStatsResponse
from app.core.config import settings


def get_or_create_device(db: Session, device_id: str) -> Device:
    """Retrieve existing device or auto-provision standard node on first telemetry packet."""
    device = db.query(Device).filter(Device.id == device_id).first()
    if not device:
        device = Device(
            id=device_id,
            name=f"Solar Node ({device_id})",
            rated_power_w=settings.DEFAULT_RATED_POWER_W,
            panel_area_m2=settings.DEFAULT_PANEL_AREA_M2,
            temp_coeff=-0.0038,
            created_at=datetime.now(timezone.utc),
        )
        db.add(device)
        db.commit()
        db.refresh(device)
    return device


def get_device(db: Session, device_id: str) -> Optional[Device]:
    return db.query(Device).filter(Device.id == device_id).first()


def list_devices(db: Session) -> List[Device]:
    return db.query(Device).order_by(Device.created_at.desc()).all()


def create_device(db: Session, device_in: DeviceCreate) -> Device:
    device = Device(
        id=device_in.id,
        name=device_in.name,
        rated_power_w=device_in.rated_power_w,
        panel_area_m2=device_in.panel_area_m2,
        temp_coeff=device_in.temp_coeff,
        created_at=datetime.now(timezone.utc),
    )
    db.add(device)
    db.commit()
    db.refresh(device)
    return device


def update_device(db: Session, device: Device, device_in: DeviceUpdate) -> Device:
    update_data = device_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(device, field, value)
    db.commit()
    db.refresh(device)
    return device


def compute_device_status(device: Device) -> DeviceStatusResponse:
    if not device.last_seen_at:
        return DeviceStatusResponse(
            device_id=device.id,
            device_name=device.name,
            status="OFFLINE",
            last_seen_at=None,
            seconds_since_last_seen=None,
            is_reporting=False,
        )

    now = datetime.now(timezone.utc)
    # Ensure timezone awareness for comparison
    last_seen = device.last_seen_at
    if last_seen.tzinfo is None:
        last_seen = last_seen.replace(tzinfo=timezone.utc)

    delta_sec = max(0.0, (now - last_seen).total_seconds())

    if delta_sec <= settings.DEVICE_ONLINE_THRESHOLD_SEC:
        status = "ONLINE"
    elif delta_sec <= settings.DEVICE_STALE_THRESHOLD_SEC:
        status = "STALE"
    else:
        status = "OFFLINE"

    return DeviceStatusResponse(
        device_id=device.id,
        device_name=device.name,
        status=status,
        last_seen_at=last_seen,
        seconds_since_last_seen=round(delta_sec, 1),
        is_reporting=(status == "ONLINE"),
    )


def compute_device_telemetry_stats(db: Session, device: Device) -> DeviceTelemetryStatsResponse:
    """
    Computes real-time data collection statistics, data quality metrics,
    and ML training readiness for an ESP32 hardware device.
    """
    from app.models.sensor_reading import SensorReading

    status_info = compute_device_status(device)
    all_readings = (
        db.query(SensorReading)
        .filter(SensorReading.device_id == device.id)
        .order_by(SensorReading.timestamp.desc())
        .all()
    )

    total_packets = len(all_readings)
    demo_records_count = sum(1 for r in all_readings if r.data_quality == "DEMO")
    real_records = [r for r in all_readings if r.data_quality != "DEMO"]
    valid_readings = sum(1 for r in real_records if r.data_quality == "GOOD")
    invalid_readings = sum(1 for r in real_records if r.data_quality != "GOOD")
    missing_values = sum(1 for r in real_records if r.voltage_v is None or r.current_a is None or r.power_w is None)
    rejected_readings = sum(1 for r in real_records if r.data_quality in ("SUSPECT_SHORT_CIRCUIT", "CORRUPT"))

    real_valid_records = valid_readings
    min_threshold = 10
    training_readiness = "READY" if real_valid_records >= min_threshold else "INSUFFICIENT_DATA"

    if real_valid_records == 0:
        recommendation = "No real hardware telemetry received yet. Connect ESP32 to begin data collection."
    elif real_valid_records < min_threshold:
        recommendation = f"{min_threshold - real_valid_records} more valid packets required for minimum ML model training."
    elif real_valid_records < 50:
        recommendation = "More data recommended for reliable model evaluation."
    else:
        recommendation = "Dataset optimal for high-accuracy XGBoost & Random Forest regression."

    # Sensor status diagnostics
    latest = all_readings[0] if all_readings else None
    if status_info.status == "OFFLINE" or latest is None:
        sensor_status = {
            "voltage": "Offline",
            "current": "Offline",
            "temperature": "Offline",
            "irradiance": "Offline",
        }
    else:
        sensor_status = {
            "voltage": "Active" if latest.voltage_v > 0.0 else "Warning",
            "current": "Active" if latest.current_a >= 0.0 else "Warning",
            "temperature": "Critical" if latest.temperature_c > 75.0 else ("Active" if latest.temperature_c > -20.0 else "Warning"),
            "irradiance": "Active" if latest.irradiance_w_m2 >= 0.0 else "Warning",
        }

    # Packet interval
    packet_interval = None
    if len(all_readings) >= 2:
        deltas = []
        for i in range(min(5, len(all_readings) - 1)):
            d = (all_readings[i].timestamp - all_readings[i+1].timestamp).total_seconds()
            if d > 0:
                deltas.append(d)
        if deltas:
            packet_interval = round(sum(deltas) / len(deltas), 1)

    return DeviceTelemetryStatsResponse(
        device_id=device.id,
        device_name=device.name,
        connection_status=status_info.status,
        last_seen_at=status_info.last_seen_at,
        seconds_since_last_seen=status_info.seconds_since_last_seen,
        total_packets=total_packets,
        valid_readings=valid_readings,
        invalid_readings=invalid_readings,
        missing_values=missing_values,
        rejected_readings=rejected_readings,
        demo_records_count=demo_records_count,
        real_valid_records=real_valid_records,
        min_training_threshold=min_threshold,
        training_readiness=training_readiness,
        recommendation=recommendation,
        sensor_status=sensor_status,
        packet_interval_sec=packet_interval,
        api_response_status="200 OK - Operational",
    )

