from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from app.api.deps import get_db
from app.models.health_score import HealthScore
from app.schemas.health_score import HealthScoreCreate, HealthScoreResponse

router = APIRouter(prefix="/health-scores", tags=["Solar Hardware Health"])


@router.get(
    "/{device_id}",
    response_model=List[HealthScoreResponse],
    summary="Get Health Scores for Device",
    description="Retrieves historical health score evaluations for the given solar device.",
)
def get_health_scores(
    device_id: str,
    limit: int = Query(default=30, ge=1, le=365),
    db: Session = Depends(get_db)
):
    return (
        db.query(HealthScore)
        .filter(HealthScore.device_id == device_id)
        .order_by(HealthScore.timestamp.desc())
        .limit(limit)
        .all()
    )


@router.get(
    "/{device_id}/latest",
    response_model=HealthScoreResponse,
    summary="Get Latest Health Score for Device",
    description="Retrieves the single most recent health score evaluation.",
)
def get_latest_health_score(device_id: str, db: Session = Depends(get_db)):
    score = (
        db.query(HealthScore)
        .filter(HealthScore.device_id == device_id)
        .order_by(HealthScore.timestamp.desc())
        .first()
    )
    if not score:
        raise HTTPException(status_code=404, detail="No health evaluations recorded for this device.")
    return score


@router.post(
    "",
    response_model=HealthScoreResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Record Health Score Evaluation",
    description="Persists a multidimensional hardware health evaluation.",
)
def record_health_score(payload: HealthScoreCreate, db: Session = Depends(get_db)):
    score = HealthScore(
        device_id=payload.device_id,
        timestamp=payload.timestamp,
        overall_score=payload.overall_score,
        electrical_health=payload.electrical_health,
        thermal_health=payload.thermal_health,
        photovoltaic_health=payload.photovoltaic_health,
        degradation_factor=payload.degradation_factor or 0.0,
        recommendation=payload.recommendation,
        created_at=datetime.now(timezone.utc),
    )
    db.add(score)
    db.commit()
    db.refresh(score)
    return score
