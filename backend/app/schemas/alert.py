from datetime import datetime, timezone
from typing import Optional
from pydantic import BaseModel, Field, ConfigDict


class AlertCreate(BaseModel):
    device_id: str = Field(..., examples=["SOLAR-ESP32-01"])
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    severity: str = Field(default="WARNING", description="INFO, WARNING, or CRITICAL")
    category: str = Field(..., description="ELECTRICAL, THERMAL, EFFICIENCY, ANOMALY, CONNECTIVITY, PERFORMANCE")
    message: str = Field(..., description="Human readable description of the alarm condition")
    alert_type: Optional[str] = Field(default=None, description="Diagnostic classification identifier")
    metric_name: Optional[str] = Field(default=None, description="Name of monitored metric")
    metric_value: Optional[float] = Field(default=None, description="Measured numeric value")
    expected_value: Optional[float] = Field(default=None, description="AI predicted or physics baseline value")
    unit: Optional[str] = Field(default=None, description="Unit of measurement")
    recommended_action: Optional[str] = Field(default=None, description="Actionable troubleshooting recommendation")


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
    alert_type: Optional[str] = None
    metric_name: Optional[str] = None
    metric_value: Optional[float] = None
    expected_value: Optional[float] = None
    unit: Optional[str] = None
    recommended_action: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class AlertSummaryResponse(BaseModel):
    device_id: Optional[str] = None
    total_active: int
    critical_count: int
    warning_count: int
    info_count: int
    resolved_count: int
    status_text: str
