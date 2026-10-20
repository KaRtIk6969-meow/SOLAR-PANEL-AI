from datetime import datetime, timezone
from typing import Optional
from pydantic import BaseModel, Field, ConfigDict


class AlertCreate(BaseModel):
    device_id: str = Field(..., examples=["SOLAR-ESP32-01"])
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    severity: str = Field(default="WARNING", description="INFO, WARNING, or CRITICAL")
    category: str = Field(..., description="ELECTRICAL, THERMAL, EFFICIENCY, ANOMALY, CONNECTIVITY")
    message: str = Field(..., description="Human readable description of the alarm condition")


class AlertResponse(BaseModel):
    id: int
    device_id: str
    timestamp: datetime
    severity: str
    category: str
    message: str
    is_resolved: bool
    resolved_at: Optional[datetime] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
