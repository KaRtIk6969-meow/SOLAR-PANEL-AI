"""
Pydantic schemas for the SolarAI Performance Assistant (Step 11).
Defines structured schemas for hardware context, AI model metrics,
health evaluations, active diagnostic alerts, and grounded chat responses.
"""

from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, ConfigDict


class CurrentStateContext(BaseModel):
    timestamp: Optional[datetime] = None
    device_id: str
    status: str = "ONLINE"
    voltage_v: Optional[float] = None
    current_a: Optional[float] = None
    temperature_c: Optional[float] = None
    irradiance_w_m2: Optional[float] = None
    power_w: Optional[float] = None
    efficiency_pct: Optional[float] = None

    model_config = ConfigDict(from_attributes=True)


class AIModelContext(BaseModel):
    model_name: str
    model_version: str
    r2_score: Optional[float] = None
    mae_w: Optional[float] = None
    rmse_w: Optional[float] = None
    dataset_samples: Optional[int] = None
    latest_predicted_power_w: Optional[float] = None
    latest_actual_power_w: Optional[float] = None
    latest_residual_w: Optional[float] = None
    latest_deviation_pct: Optional[float] = None

    model_config = ConfigDict(from_attributes=True)


class HealthContext(BaseModel):
    overall_score: Optional[float] = None
    electrical_health: Optional[float] = None
    thermal_health: Optional[float] = None
    photovoltaic_health: Optional[float] = None
    recommendation: Optional[str] = None
    status: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class AlertContextItem(BaseModel):
    id: int
    timestamp: datetime
    severity: str
    category: str
    alert_type: str
    message: str
    metric_value: Optional[float] = None
    expected_value: Optional[float] = None
    unit: Optional[str] = None
    recommendation: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class ExtremePeriodContext(BaseModel):
    timestamp: datetime
    power_w: float
    voltage_v: float
    current_a: float
    temperature_c: float
    irradiance_w_m2: float
    predicted_power_w: Optional[float] = None
    residual_w: Optional[float] = None
    health_score: Optional[float] = None
    alert_message: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class AnalyticsContext(BaseModel):
    total_samples: int = 0
    avg_power_w: Optional[float] = None
    max_power_w: Optional[float] = None
    min_power_w: Optional[float] = None
    total_energy_wh: Optional[float] = None
    avg_voltage_v: Optional[float] = None
    avg_current_a: Optional[float] = None
    avg_temperature_c: Optional[float] = None
    avg_irradiance_w_m2: Optional[float] = None
    avg_efficiency_pct: Optional[float] = None
    best_period: Optional[ExtremePeriodContext] = None
    worst_period: Optional[ExtremePeriodContext] = None

    model_config = ConfigDict(from_attributes=True)


class SolarAIContextResponse(BaseModel):
    """Consolidated real-hardware telemetry, AI, health, alert, and analytics context."""
    device_id: str
    data_source: str = "REAL_HARDWARE"
    timestamp: datetime
    has_data: bool = True
    current: Optional[CurrentStateContext] = None
    ai: Optional[AIModelContext] = None
    health: Optional[HealthContext] = None
    alerts: List[AlertContextItem] = []
    analytics: Optional[AnalyticsContext] = None

    model_config = ConfigDict(from_attributes=True)


class AIChatRequest(BaseModel):
    """Request payload sent by user in conversational interface."""
    device_id: str = "SOLAR-ESP32-01"
    question: str
    conversation_id: Optional[str] = None


class AIChatEvidence(BaseModel):
    """Factual telemetry grounding evidence attached to assistant response."""
    power_w: Optional[float] = None
    predicted_power_w: Optional[float] = None
    residual_w: Optional[float] = None
    voltage_v: Optional[float] = None
    current_a: Optional[float] = None
    temperature_c: Optional[float] = None
    irradiance_w_m2: Optional[float] = None
    health_score: Optional[float] = None
    active_alerts_count: int = 0
    timestamp: Optional[str] = None


class AIChatResponse(BaseModel):
    """Structured, grounded response from the AI solar performance assistant."""
    device_id: str
    question: str
    answer: str
    provider: str
    grounded: bool = True
    evidence: Optional[AIChatEvidence] = None
    structured_data: Optional[Dict[str, Any]] = None
    timestamp: datetime
