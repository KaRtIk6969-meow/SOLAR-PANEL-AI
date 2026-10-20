from datetime import datetime, timezone, timedelta
from typing import Optional, List
from pydantic import BaseModel, Field, field_validator, ConfigDict
import math


class TelemetryCreate(BaseModel):
    """
    Incoming telemetry payload from ESP32 edge sensor node.
    """
    device_id: str = Field(
        ...,
        min_length=3,
        max_length=64,
        description="Unique hardware identifier of the ESP32 node (e.g. SOLAR-ESP32-01)",
        examples=["SOLAR-ESP32-01"]
    )
    timestamp: Optional[datetime] = Field(
        default=None,
        description="ISO 8601 reading timestamp. Defaults to server UTC now if omitted or null.",
        examples=["2026-10-20T12:00:00Z"]
    )
    voltage_v: float = Field(
        ...,
        ge=0.0,
        le=60.0,
        description="Array terminal voltage in Volts (V) [Range: 0.0 to 60.0V]",
        examples=[18.42]
    )
    current_a: float = Field(
        ...,
        ge=0.0,
        le=30.0,
        description="Array load current in Amperes (A) [Range: 0.0 to 30.0A]",
        examples=[2.31]
    )
    temperature_c: float = Field(
        ...,
        ge=-40.0,
        le=125.0,
        description="Panel cell surface temperature in Celsius (°C) [Range: -40.0 to 125.0°C]",
        examples=[31.7]
    )
    irradiance_w_m2: float = Field(
        ...,
        ge=0.0,
        le=2000.0,
        description="Solar flux / irradiance in Watts per square meter (W/m²) [Range: 0.0 to 2000.0]",
        examples=[812.0]
    )

    @field_validator("voltage_v", "current_a", "temperature_c", "irradiance_w_m2")
    @classmethod
    def validate_finite_floats(cls, v: float, info) -> float:
        if math.isnan(v) or math.isinf(v):
            raise ValueError(f"{info.field_name} must be a valid finite number, received NaN or Infinity")
        return round(float(v), 3)

    @field_validator("timestamp")
    @classmethod
    def validate_timestamp(cls, v: Optional[datetime]) -> datetime:
        now = datetime.now(timezone.utc)
        if v is None:
            return now
        
        # Ensure timezone awareness
        if v.tzinfo is None:
            v = v.replace(tzinfo=timezone.utc)
            
        # Reject future timestamps beyond 5 minutes (clock drift margin)
        if v > now + timedelta(minutes=5):
            raise ValueError(f"Timestamp cannot be in the future (exceeds clock drift threshold of 5 minutes)")
            
        # Reject dates older than 1 year
        if v < now - timedelta(days=365):
            raise ValueError("Timestamp is too old (exceeds 365-day historical retention)")
            
        return v

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "device_id": "SOLAR-ESP32-01",
                "timestamp": "2026-10-20T12:00:00Z",
                "voltage_v": 18.42,
                "current_a": 2.31,
                "temperature_c": 31.7,
                "irradiance_w_m2": 812.0
            }
        }
    )


class TelemetryResponse(BaseModel):
    id: int
    device_id: str
    timestamp: datetime
    voltage_v: float
    current_a: float
    temperature_c: float
    irradiance_w_m2: float
    power_w: float
    efficiency_pct: Optional[float] = None
    is_anomaly: bool
    anomaly_notes: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class TelemetryIngestResponse(BaseModel):
    status: str = "success"
    message: str = "Telemetry recorded successfully"
    data: TelemetryResponse


class DashboardDataResponse(BaseModel):
    device_id: str
    device_name: str
    status: str
    last_seen_at: Optional[datetime] = None
    rated_power_w: float
    panel_area_m2: float
    current_reading: Optional[TelemetryResponse] = None
    today_energy_wh: float
    today_peak_power_w: float
    avg_efficiency_pct: Optional[float] = None
    total_samples_today: int
