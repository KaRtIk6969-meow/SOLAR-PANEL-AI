from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.api.deps import get_db
from app.schemas.device import (
    DeviceCreate,
    DeviceUpdate,
    DeviceResponse,
    DeviceStatusResponse,
)
from app.services.device_service import (
    create_device,
    get_device,
    list_devices,
    update_device,
    compute_device_status,
)

router = APIRouter(prefix="/devices", tags=["ESP32 Device Management"])


@router.get(
    "",
    response_model=List[DeviceResponse],
    summary="List Registered Devices",
    description="Returns all registered ESP32 edge units and testbed panels in the database."
)
def get_all_devices(db: Session = Depends(get_db)):
    devices = list_devices(db)
    return [DeviceResponse.model_validate(d) for d in devices]


@router.post(
    "",
    response_model=DeviceResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register New Solar Device",
    description="Registers an ESP32 hardware device with panel area, rated power, and temperature loss coefficient.",
)
def register_device(device_in: DeviceCreate, db: Session = Depends(get_db)):
    existing = get_device(db, device_in.id)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Device with ID '{device_in.id}' already exists."
        )
    device = create_device(db, device_in)
    return DeviceResponse.model_validate(device)


@router.get(
    "/{device_id}",
    response_model=DeviceResponse,
    summary="Get Device Information",
    description="Fetches technical specifications and last seen timestamp for a specific device."
)
def get_single_device(device_id: str, db: Session = Depends(get_db)):
    device = get_device(db, device_id)
    if not device:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Device '{device_id}' not found."
        )
    return DeviceResponse.model_validate(device)


@router.get(
    "/{device_id}/status",
    response_model=DeviceStatusResponse,
    summary="Get Device Heartbeat & Link Status",
    description="Calculates whether the ESP32 node is ONLINE, STALE, or OFFLINE based on elapsed seconds since last telemetry packet."
)
def get_status(device_id: str, db: Session = Depends(get_db)):
    device = get_device(db, device_id)
    if not device:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Device '{device_id}' not found."
        )
    return compute_device_status(device)
