from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from app.api.deps import get_db
from app.models.alert import Alert
from app.schemas.alert import AlertCreate, AlertResponse

router = APIRouter(prefix="/alerts", tags=["System & Sensor Alerts"])


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
def resolve_alert(alert_id: int, db: Session = Depends(get_db)):
    alert = db.query(Alert).filter(Alert.id == alert_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    alert.is_resolved = True
    alert.resolved_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(alert)
    return alert
