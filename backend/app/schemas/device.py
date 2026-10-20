from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field, ConfigDict


class DeviceBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=128, description="Human readable device label")
    rated_power_w: float = Field(default=100.0, gt=0, le=2000.0, description="Rated peak power in Watts at STC")
    panel_area_m2: float = Field(default=0.65, gt=0, le=20.0, description="Panel surface area in m² for efficiency calculation")
    temp_coeff: float = Field(default=-0.0038, lt=0, gt=-0.02, description="Temperature derating coefficient (%/°C)")


class DeviceCreate(DeviceBase):
    id: str = Field(..., min_length=3, max_length=64, description="Unique alphanumeric hardware ID")


class DeviceUpdate(BaseModel):
    name: Optional[str] = None
    rated_power_w: Optional[float] = None
    panel_area_m2: Optional[float] = None
    temp_coeff: Optional[float] = None


class DeviceResponse(DeviceBase):
    id: str
    last_seen_at: Optional[datetime] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class DeviceStatusResponse(BaseModel):
    device_id: str
    device_name: str
    status: str  # ONLINE, STALE, OFFLINE
    last_seen_at: Optional[datetime] = None
    seconds_since_last_seen: Optional[float] = None
    is_reporting: bool


class DeviceTelemetryStatsResponse(BaseModel):
    device_id: str
    device_name: str
    connection_status: str  # ONLINE, STALE, OFFLINE
    last_seen_at: Optional[datetime] = None
    seconds_since_last_seen: Optional[float] = None
    total_packets: int
    valid_readings: int
    invalid_readings: int
    missing_values: int
    rejected_readings: int
    demo_records_count: int
    real_valid_records: int
    min_training_threshold: int = 10
    training_readiness: str  # READY, INSUFFICIENT_DATA
    recommendation: str
    sensor_status: dict[str, str]
    packet_interval_sec: Optional[float] = None
    api_response_status: str = "200 OK - Operational"

