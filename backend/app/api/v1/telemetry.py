from datetime import datetime
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status, Query, Body
from sqlalchemy.orm import Session
from app.api.deps import get_db, verify_device_token
from app.schemas.telemetry import (
    TelemetryCreate,
    TelemetryResponse,
    TelemetryIngestResponse,
    DashboardDataResponse,
)
from app.services.telemetry_service import (
    record_telemetry,
    get_latest_reading,
    get_historical_telemetry,
    get_dashboard_summary,
    DuplicateRecordException,
)

router = APIRouter(prefix="/telemetry", tags=["Telemetry Ingestion & Analytics"])


@router.post(
    "",
    response_model=TelemetryIngestResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Ingest Solar Telemetry Packet",
    description=(
        "Primary edge ingestion endpoint for ESP32 microcontrollers. "
        "Validates electrical/environmental sensor ranges, calculates instantaneous power (W) "
        "and efficiency (%), checks for duplicate records, and persists the reading."
    ),
    dependencies=[Depends(verify_device_token)],
    responses={
        201: {"description": "Telemetry recorded and derived metrics calculated."},
        400: {"description": "Invalid sensor values, out-of-range metrics, or malformed payload."},
        409: {"description": "Duplicate telemetry record detected for this device and timestamp."},
    }
)
def ingest_telemetry(
    payload: TelemetryCreate,
    db: Session = Depends(get_db)
):
    try:
        reading = record_telemetry(db, payload)
        return TelemetryIngestResponse(
            status="success",
            message="Telemetry packet processed and persisted successfully.",
            data=TelemetryResponse.model_validate(reading)
        )
    except DuplicateRecordException as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(exc)
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An internal error occurred during telemetry processing: {str(exc)}"
        )


@router.get(
    "/latest/{device_id}",
    response_model=TelemetryResponse,
    summary="Get Latest Telemetry Reading",
    description="Fetches the single most recent sensor packet recorded for a given ESP32 node.",
    responses={
        200: {"description": "Latest telemetry reading retrieved."},
        404: {"description": "No telemetry readings found for this device."},
    }
)
def get_latest(device_id: str, db: Session = Depends(get_db)):
    reading = get_latest_reading(db, device_id)
    if not reading:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No telemetry readings found for device '{device_id}'."
        )
    return TelemetryResponse.model_validate(reading)


@router.get(
    "/history/{device_id}",
    response_model=List[TelemetryResponse],
    summary="Get Historical Telemetry Series",
    description="Retrieves a chronologically ordered array of historical telemetry readings with optional date/time range filtering.",
)
def get_history(
    device_id: str,
    limit: int = Query(default=100, ge=1, le=1000, description="Max number of readings to return"),
    start_time: Optional[datetime] = Query(default=None, description="Start date/time in ISO 8601 format"),
    end_time: Optional[datetime] = Query(default=None, description="End date/time in ISO 8601 format"),
    db: Session = Depends(get_db)
):
    readings = get_historical_telemetry(
        db,
        device_id=device_id,
        limit=limit,
        start_time=start_time,
        end_time=end_time
    )
    return [TelemetryResponse.model_validate(r) for r in readings]


@router.get(
    "/dashboard/{device_id}",
    response_model=DashboardDataResponse,
    summary="Get Consolidated Dashboard Telemetry & Yield",
    description=(
        "Returns a high-level summary tailored for the Next.js frontend: "
        "current reading, device connectivity status, today's accumulated Watt-hours, "
        "peak generation, and rolling efficiency."
    ),
)
def get_dashboard_data(device_id: str, db: Session = Depends(get_db)):
    return get_dashboard_summary(db, device_id)


@router.get(
    "/export/csv",
    summary="Download Telemetry Dataset as CSV",
    description="Exports recorded telemetry readings as a CSV spreadsheet. By default exports valid real data; demo data can be included if requested."
)
def export_telemetry_csv(
    device_id: str = Query(default="SOLAR-ESP32-01", description="Device ID to export"),
    include_demo: bool = Query(default=False, description="Whether to include demo/simulated records"),
    db: Session = Depends(get_db)
):
    import io
    import csv
    from fastapi.responses import Response
    from app.models.sensor_reading import SensorReading

    query = db.query(SensorReading).filter(SensorReading.device_id == device_id)
    if not include_demo:
        query = query.filter(SensorReading.data_quality != "DEMO")
    readings = query.order_by(SensorReading.timestamp.asc()).all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "id", "device_id", "timestamp", "voltage_v", "current_a", 
        "temperature_c", "irradiance_w_m2", "power_w", "efficiency_pct", 
        "data_quality", "firmware_version"
    ])
    for r in readings:
        writer.writerow([
            r.id, r.device_id, r.timestamp.isoformat() if r.timestamp else "",
            r.voltage_v, r.current_a, r.temperature_c, r.irradiance_w_m2,
            r.power_w, r.efficiency_pct if r.efficiency_pct is not None else "",
            r.data_quality, r.firmware_version or ""
        ])

    csv_data = output.getvalue()
    return Response(
        content=csv_data,
        media_type="text/csv",
        headers={
            "Content-Disposition": f"attachment; filename=solar_telemetry_{device_id}.csv"
        }
    )


@router.post(
    "/demo-test",
    response_model=TelemetryIngestResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Inject Test Telemetry Packet (Development Only)",
    description="Injects a simulated sensor telemetry packet tagged explicitly with data_quality='DEMO'. Isolated from real hardware data and strictly excluded from ML model training."
)
def ingest_demo_telemetry(
    device_id: Optional[str] = Query(default=None, description="Target device ID"),
    payload: Optional[Dict[str, Any]] = Body(default=None),
    db: Session = Depends(get_db)
):
    from datetime import datetime, timezone
    from app.services.device_service import get_or_create_device
    from app.models.sensor_reading import SensorReading
    import random

    now = datetime.now(timezone.utc)
    dev_id = (payload and payload.get("device_id")) or device_id or "SOLAR-ESP32-01"
    v = float(payload.get("voltage_v")) if (payload and payload.get("voltage_v") is not None) else round(18.2 + random.uniform(0.1, 1.2), 2)
    curr = float(payload.get("current_a")) if (payload and payload.get("current_a") is not None) else round(2.2 + random.uniform(0.1, 0.5), 2)
    temp = float(payload.get("temperature_c")) if (payload and payload.get("temperature_c") is not None) else round(31.0 + random.uniform(0.5, 3.0), 1)
    irr = float(payload.get("irradiance_w_m2")) if (payload and payload.get("irradiance_w_m2") is not None) else round(800.0 + random.uniform(10.0, 80.0), 1)

    pwr = round(v * curr, 2)
    eff = round((pwr / (0.65 * irr)) * 100.0, 2) if irr > 20 else None

    device = get_or_create_device(db, dev_id)
    reading = SensorReading(
        device_id=dev_id,
        timestamp=now,
        voltage_v=v,
        current_a=curr,
        temperature_c=temp,
        irradiance_w_m2=irr,
        power_w=pwr,
        efficiency_pct=eff,
        data_quality="DEMO",
        firmware_version="DEMO-SIM-1.0",
        created_at=now,
    )
    db.add(reading)
    device.last_seen_at = now
    db.commit()
    db.refresh(reading)

    return TelemetryIngestResponse(
        status="success",
        message="Demo test packet recorded with data_quality='DEMO'. Isolated from ML training.",
        data=TelemetryResponse.model_validate(reading)
    )


@router.delete(
    "/demo",
    summary="Clear Demo Data",
    description="Deletes all simulated records tagged with data_quality='DEMO'. Real hardware telemetry is 100% protected and cannot be deleted."
)
def clear_demo_data(
    device_id: Optional[str] = Query(default=None, description="Optional device ID filter"),
    db: Session = Depends(get_db)
):
    from app.models.sensor_reading import SensorReading

    query = db.query(SensorReading).filter(SensorReading.data_quality == "DEMO")
    if device_id:
        query = query.filter(SensorReading.device_id == device_id)
    
    deleted_count = query.delete(synchronize_session=False)
    db.commit()

    return {
        "status": "success",
        "deleted_count": deleted_count,
        "message": f"Successfully deleted {deleted_count} demo test records. Real hardware data untouched."
    }

