from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, status, Query
from sqlalchemy.orm import Session
from app.api.deps import get_db
from app.models.model_metric import ModelMetric
from app.schemas.model_metric import ModelMetricCreate, ModelMetricResponse

router = APIRouter(prefix="/model-metrics", tags=["AI Model Evaluation Metrics"])


@router.get(
    "",
    response_model=List[ModelMetricResponse],
    summary="Get Model Evaluation Metrics",
    description="Retrieves evaluation history (MAE, RMSE, R2 score) for trained machine learning models.",
)
def get_model_metrics(
    model_name: Optional[str] = Query(default=None),
    limit: int = Query(default=50, ge=1, le=500),
    db: Session = Depends(get_db)
):
    query = db.query(ModelMetric)
    if model_name:
        query = query.filter(ModelMetric.model_name == model_name)
    return query.order_by(ModelMetric.evaluation_date.desc()).limit(limit).all()


@router.post(
    "",
    response_model=ModelMetricResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Record Model Evaluation",
    description="Persists model evaluation benchmarks after a training run.",
)
def record_model_metric(payload: ModelMetricCreate, db: Session = Depends(get_db)):
    metric = ModelMetric(
        model_name=payload.model_name,
        model_version=payload.model_version,
        evaluation_date=payload.evaluation_date,
        mae=payload.mae,
        rmse=payload.rmse,
        r2_score=payload.r2_score,
        dataset_size=payload.dataset_size,
        notes=payload.notes,
        created_at=datetime.now(timezone.utc),
    )
    db.add(metric)
    db.commit()
    db.refresh(metric)
    return metric
