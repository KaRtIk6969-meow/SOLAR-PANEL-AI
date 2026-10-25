from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from app.api.deps import get_db
from app.models.alert import Alert
from app.schemas.alert import AlertCreate, AlertResponse, AlertSummaryResponse
from app.services.alert_service import (
    resolve_single_alert,
    get_alerts_summary,
    evaluate_device_offline_alerts,
)

router = APIRouter(prefix="/alerts", tags=["System & Sensor Alerts"])


@router.get(
    "",
    response_model=List[AlertResponse],
    summary="List Alerts",
    description="Fetches alerts with optional filtering by device, severity, category, or resolution status.",
)
def list_alerts(
    device_id: Optional[str] = Query(default=None, description="Optional filter by device ID"),
    severity: Optional[str] = Query(default=None, description="INFO, WARNING, or CRITICAL"),
    category: Optional[str] = Query(default=None, description="ELECTRICAL, THERMAL, EFFICIENCY, etc."),
    is_resolved: Optional[bool] = Query(default=None, description="True for resolved, False for active"),
    limit: int = Query(default=50, ge=1, le=500),
    db: Session = Depends(get_db)
):
    query = db.query(Alert)
    if device_id:
        query = query.filter(Alert.device_id == device_id)
    if severity:
        query = query.filter(Alert.severity == severity.upper())
    if category:
        query = query.filter(Alert.category == category.upper())
    if is_resolved is not None:
        query = query.filter(Alert.is_resolved == is_resolved)
    return query.order_by(Alert.timestamp.desc()).limit(limit).all()


@router.get(
    "/summary",
    response_model=AlertSummaryResponse,
    summary="Get Alerts Summary",
    description="Fetches aggregated alert statistics (critical, warning, active, resolved counts) for dashboard cards.",
)
def get_alerts_summary_endpoint(
    device_id: Optional[str] = Query(default=None),
    db: Session = Depends(get_db)
):
    # Ensure offline device checks are fresh before summarizing
    evaluate_device_offline_alerts(db, device_id=device_id)
    return get_alerts_summary(db, device_id=device_id)


@router.get(
    "/{alert_id:int}",
    response_model=AlertResponse,
    summary="Get Alert by ID",
    description="Fetches a single alert record by numeric ID.",
)
def get_alert_by_id(
    alert_id: int,
    db: Session = Depends(get_db)
):
    alert = db.query(Alert).filter(Alert.id == alert_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail=f"Alert {alert_id} not found")
    return alert


@router.get(
    "/{device_id}",
    response_model=List[AlertResponse],
    summary="Get Alerts for Device",
    description="Fetches recent system, electrical, or thermal alerts for the specified solar device.",
)
def get_alerts_for_device(
    device_id: str,
    limit: int = Query(default=50, ge=1, le=500),
    is_resolved: Optional[bool] = Query(default=None),
    db: Session = Depends(get_db)
):
    # Refresh offline check if device has gone quiet
    evaluate_device_offline_alerts(db, device_id=device_id)
    query = db.query(Alert).filter(Alert.device_id == device_id)
    if is_resolved is not None:
        query = query.filter(Alert.is_resolved == is_resolved)
    return query.order_by(Alert.timestamp.desc()).limit(limit).all()


@router.post(
    "",
    response_model=AlertResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create Alert",
    description="Manually or automatically records an operational alarm.",
)
def create_alert(payload: AlertCreate, db: Session = Depends(get_db)):
    alert = Alert(
        device_id=payload.device_id,
        timestamp=payload.timestamp,
        severity=payload.severity,
        category=payload.category,
        message=payload.message,
        alert_type=payload.alert_type,
        metric_name=payload.metric_name,
        metric_value=payload.metric_value,
        expected_value=payload.expected_value,
        unit=payload.unit,
        recommended_action=payload.recommended_action,
        is_resolved=False,
        created_at=datetime.now(timezone.utc),
    )
    db.add(alert)
    db.commit()
    db.refresh(alert)
    return alert


@router.patch(
    "/{alert_id}/resolve",
    response_model=AlertResponse,
    summary="Resolve Alert",
    description="Marks an alert as resolved.",
)
@router.put(
    "/{alert_id}/resolve",
    response_model=AlertResponse,
    summary="Resolve Alert (PUT)",
    description="Marks an alert as resolved via PUT.",
)
def resolve_alert(alert_id: int, db: Session = Depends(get_db)):
    alert = resolve_single_alert(db, alert_id)
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    return alert
