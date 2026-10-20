from datetime import datetime, timezone
from typing import Optional
from pydantic import BaseModel, Field, ConfigDict


class HealthScoreCreate(BaseModel):
    device_id: str = Field(..., examples=["SOLAR-ESP32-01"])
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    overall_score: float = Field(..., ge=0.0, le=100.0)
    electrical_health: float = Field(..., ge=0.0, le=100.0)
    thermal_health: float = Field(..., ge=0.0, le=100.0)
    photovoltaic_health: float = Field(..., ge=0.0, le=100.0)
    degradation_factor: Optional[float] = Field(default=0.0)
    recommendation: Optional[str] = None


class HealthScoreResponse(BaseModel):
    id: int
    device_id: str
    timestamp: datetime
    overall_score: float
    electrical_health: float
    thermal_health: float
    photovoltaic_health: float
    degradation_factor: Optional[float] = None
    recommendation: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
