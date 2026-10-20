from datetime import datetime, timezone
from typing import Optional, List
from sqlalchemy.orm import Session
from app.models.device import Device
from app.schemas.device import DeviceCreate, DeviceUpdate, DeviceStatusResponse
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
