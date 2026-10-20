from datetime import datetime, timezone
from typing import Optional
from pydantic import BaseModel, Field, ConfigDict


class PredictionCreate(BaseModel):
    device_id: str = Field(..., examples=["SOLAR-ESP32-01"])
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    target: str = Field(default="power_w", description="Prediction target metric")
    predicted_value: float = Field(..., description="Value predicted by ML model")
    actual_value: Optional[float] = Field(None, description="Actual physical sensor value observed")
    residual: Optional[float] = Field(None, description="actual - predicted")
    deviation_pct: Optional[float] = Field(None, description="Percentage deviation from expected")
    alert_status: str = Field(default="NORMAL", description="NORMAL, WARNING, or CRITICAL")
    model_version: str = Field(default="rf_v1.0.0", description="Model version tag")


class PredictionResponse(BaseModel):
    id: int
    device_id: str
    timestamp: datetime
    target: str
    predicted_value: float
    actual_value: Optional[float] = None
    residual: Optional[float] = None
    deviation_pct: Optional[float] = None
    alert_status: str
    model_version: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
