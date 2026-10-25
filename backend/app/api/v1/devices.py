from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.api.deps import get_db
from app.schemas.device import (
    DeviceCreate,
    DeviceUpdate,
    DeviceResponse,
    DeviceStatusResponse,
    DeviceTelemetryStatsResponse,
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
    "/network-info",
    summary="Get Server Local Network Configuration",
    description="Returns the server's local network IP addresses and recommended ingestion URL for ESP32 firmware configuration."
)
def get_network_info():
    import socket
    local_ips = []
    primary_ip = "127.0.0.1"
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.settimeout(0.5)
        s.connect(("8.8.8.8", 80))
        primary_ip = s.getsockname()[0]
        s.close()
    except Exception:
        pass

    try:
        hostname = socket.gethostname()
        for ip in socket.gethostbyname_ex(hostname)[2]:
            if not ip.startswith("127.") and ip not in local_ips:
                local_ips.append(ip)
    except Exception:
        pass

    if primary_ip not in local_ips and not primary_ip.startswith("127."):
        local_ips.insert(0, primary_ip)

    port = 8000
    telemetry_url = f"http://{primary_ip}:{port}/api/v1/telemetry"
    return {
        "primary_ip": primary_ip,
        "port": port,
        "available_ips": local_ips,
        "telemetry_url": telemetry_url,
        "status": "operational"
    }


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


@router.get(
    "/{device_id}/telemetry-stats",
    response_model=DeviceTelemetryStatsResponse,
    summary="Get Hardware Telemetry & Data Quality Audit",
    description="Computes real-time telemetry statistics, valid/invalid sample counts, sensor diagnostics, and ML dataset readiness."
)
def get_telemetry_stats(device_id: str, db: Session = Depends(get_db)):
    from app.services.device_service import compute_device_telemetry_stats, get_or_create_device
    device = get_or_create_device(db, device_id)
    return compute_device_telemetry_stats(db, device)

