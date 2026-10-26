"""
SolarAI Advanced Analytics API Endpoints (Step 10)
Exposes aggregated, real-telemetry-based historical analytics, sensor correlations,
AI expected vs actual benchmarks, and streaming CSV data export.
"""

from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, Query, Response, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.services import analytics_service
from app.schemas.analytics import (
    AnalyticsSummaryResponse,
    TimeseriesResponse,
    CorrelationResponse,
    PerformanceAnalyticsResponse,
)

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("/summary/{device_id}", response_model=AnalyticsSummaryResponse)
def get_analytics_summary(
    device_id: str,
    range: str = Query("24h", description="Time window: 1h, 6h, 24h, 7d, 30d, all"),
    start_time: Optional[datetime] = Query(None, description="ISO format start time"),
    end_time: Optional[datetime] = Query(None, description="ISO format end time"),
    db: Session = Depends(get_db),
):
    """
    Get consolidated generation metrics, numerical energy integration (Wh),
    averages/peaks, model benchmark scores, and active alerts for a device.
    """
    return analytics_service.get_analytics_summary(
        db=db,
        device_id=device_id,
        range_str=range,
        start_time=start_time,
        end_time=end_time,
    )


@router.get("/timeseries/{device_id}", response_model=TimeseriesResponse)
def get_analytics_timeseries(
    device_id: str,
    range: str = Query("24h", description="Time window: 1h, 6h, 24h, 7d, 30d, all"),
    start_time: Optional[datetime] = Query(None, description="ISO format start time"),
    end_time: Optional[datetime] = Query(None, description="ISO format end time"),
    interval: str = Query("auto", description="Bucket size: auto, 5m, 15m, 1h"),
    db: Session = Depends(get_db),
):
    """
    Get timeseries data points for actual power, AI predicted power, residuals,
    voltage, current, temperature, irradiance, and efficiency.
    """
    return analytics_service.get_analytics_timeseries(
        db=db,
        device_id=device_id,
        range_str=range,
        start_time=start_time,
        end_time=end_time,
        interval=interval,
    )


@router.get("/correlation/{device_id}", response_model=CorrelationResponse)
def get_analytics_correlation(
    device_id: str,
    range: str = Query("24h", description="Time window: 1h, 6h, 24h, 7d, 30d, all"),
    start_time: Optional[datetime] = Query(None, description="ISO format start time"),
    end_time: Optional[datetime] = Query(None, description="ISO format end time"),
    db: Session = Depends(get_db),
):
    """
    Get correlation scatter pairs and statistical Pearson r coefficients for:
    - Irradiance vs Power
    - Temperature vs Power
    - Temperature vs Efficiency
    """
    return analytics_service.get_analytics_correlation(
        db=db,
        device_id=device_id,
        range_str=range,
        start_time=start_time,
        end_time=end_time,
    )


@router.get("/performance/{device_id}", response_model=PerformanceAnalyticsResponse)
def get_analytics_performance(
    device_id: str,
    range: str = Query("24h", description="Time window: 1h, 6h, 24h, 7d, 30d, all"),
    start_time: Optional[datetime] = Query(None, description="ISO format start time"),
    end_time: Optional[datetime] = Query(None, description="ISO format end time"),
    db: Session = Depends(get_db),
):
    """
    Get active AI model benchmark metrics, residual distribution histogram,
    and identified real best and worst performance operational periods.
    """
    return analytics_service.get_analytics_performance(
        db=db,
        device_id=device_id,
        range_str=range,
        start_time=start_time,
        end_time=end_time,
    )


@router.get("/export/{device_id}")
def export_analytics_csv(
    device_id: str,
    range: str = Query("all", description="Time window: 1h, 6h, 24h, 7d, 30d, all"),
    start_time: Optional[datetime] = Query(None, description="ISO format start time"),
    end_time: Optional[datetime] = Query(None, description="ISO format end time"),
    include_demo: bool = Query(False, description="Whether to include DEMO data"),
    db: Session = Depends(get_db),
):
    """
    Exports comprehensive raw & predicted telemetry records for a device as a CSV download.
    """
    csv_data = analytics_service.export_analytics_csv(
        db=db,
        device_id=device_id,
        range_str=range,
        start_time=start_time,
        end_time=end_time,
        include_demo=include_demo,
    )

    filename = f"solarai_analytics_{device_id}_{range}.csv"
    return Response(
        content=csv_data,
        media_type="text/csv",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Cache-Control": "no-cache",
        },
    )
