from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
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
