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
        from app.models.sensor_reading import SensorReading
        from app.services.health_service import compute_and_record_health_score
        from ml.predict import predict_power
        latest_reading = (
            db.query(SensorReading)
            .filter(SensorReading.device_id == device_id, SensorReading.data_quality != "DEMO")
            .order_by(SensorReading.timestamp.desc())
            .first()
        )
        if latest_reading:
            try:
                pred_out = predict_power({
                    "voltage_v": latest_reading.voltage_v,
                    "current_a": latest_reading.current_a,
                    "temperature_c": latest_reading.temperature_c,
                    "irradiance_w_m2": latest_reading.irradiance_w_m2,
                })
                pred_w = pred_out["predicted_power_w"]
                res = round(latest_reading.power_w - pred_w, 2)
                score = compute_and_record_health_score(db, device_id, latest_reading, res, pred_w)
                db.commit()
                db.refresh(score)
            except Exception:
                pass

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
