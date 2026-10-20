from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from app.api.deps import get_db
from app.models.prediction import Prediction
from app.schemas.prediction import PredictionCreate, PredictionResponse

router = APIRouter(prefix="/predictions", tags=["AI Predictions & Inference"])


@router.get(
    "/{device_id}",
    response_model=List[PredictionResponse],
    summary="Get Predictions for Device",
    description="Fetches recent AI predictions and residuals for the specified solar device.",
)
def get_predictions_for_device(
    device_id: str,
    limit: int = Query(default=100, ge=1, le=1000),
    target: Optional[str] = Query(default=None),
    db: Session = Depends(get_db)
):
    query = db.query(Prediction).filter(Prediction.device_id == device_id)
    if target:
        query = query.filter(Prediction.target == target)
    return query.order_by(Prediction.timestamp.desc()).limit(limit).all()


@router.post(
    "",
    response_model=PredictionResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Record AI Prediction",
    description="Persists an AI model inference prediction with residual and deviation analysis.",
)
def record_prediction(payload: PredictionCreate, db: Session = Depends(get_db)):
    residual = payload.residual
    deviation_pct = payload.deviation_pct

    # Auto-calculate residual and deviation if actual value is present
    if payload.actual_value is not None:
        if residual is None:
            residual = round(payload.actual_value - payload.predicted_value, 2)
        if deviation_pct is None and payload.predicted_value > 0:
            deviation_pct = round(((payload.actual_value - payload.predicted_value) / payload.predicted_value) * 100.0, 2)

    pred = Prediction(
        device_id=payload.device_id,
        timestamp=payload.timestamp,
        target=payload.target,
        predicted_value=payload.predicted_value,
        actual_value=payload.actual_value,
        residual=residual,
        deviation_pct=deviation_pct,
        alert_status=payload.alert_status,
        model_version=payload.model_version,
        created_at=datetime.now(timezone.utc),
    )
    db.add(pred)
    db.commit()
    db.refresh(pred)
    return pred
