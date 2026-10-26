from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, ConfigDict


class AnalyticsSummaryResponse(BaseModel):
    """Consolidated hardware and AI analytics summary for a time window."""
    device_id: str
    time_range: str
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    total_samples: int = 0
    avg_power_w: Optional[float] = None
    max_power_w: Optional[float] = None
    min_power_w: Optional[float] = None
    total_energy_wh: Optional[float] = None
    avg_voltage_v: Optional[float] = None
    max_voltage_v: Optional[float] = None
    min_voltage_v: Optional[float] = None
    avg_current_a: Optional[float] = None
    max_current_a: Optional[float] = None
    min_current_a: Optional[float] = None
    avg_temperature_c: Optional[float] = None
    max_temperature_c: Optional[float] = None
    min_temperature_c: Optional[float] = None
    avg_irradiance_w_m2: Optional[float] = None
    max_irradiance_w_m2: Optional[float] = None
    min_irradiance_w_m2: Optional[float] = None
    avg_efficiency_pct: Optional[float] = None
    ai_r2_score: Optional[float] = None
    ai_mae_w: Optional[float] = None
    ai_rmse_w: Optional[float] = None
    health_score: Optional[float] = None
    active_alerts_count: int = 0
    critical_alerts_count: int = 0

    model_config = ConfigDict(from_attributes=True)


class TimeseriesPoint(BaseModel):
    timestamp: datetime
    actual_power_w: Optional[float] = None
    predicted_power_w: Optional[float] = None
    residual_w: Optional[float] = None
    voltage_v: Optional[float] = None
    current_a: Optional[float] = None
    temperature_c: Optional[float] = None
    irradiance_w_m2: Optional[float] = None
    efficiency_pct: Optional[float] = None
    sample_count: int = 1

    model_config = ConfigDict(from_attributes=True)


class TimeseriesResponse(BaseModel):
    device_id: str
    time_range: str
    interval: str
    total_points: int
    points: List[TimeseriesPoint]

    model_config = ConfigDict(from_attributes=True)


class CorrelationPair(BaseModel):
    x: float
    y: float
    timestamp: datetime


class CorrelationResponse(BaseModel):
    device_id: str
    time_range: str
    irradiance_vs_power: List[CorrelationPair]
    temperature_vs_power: List[CorrelationPair]
    temperature_vs_efficiency: List[CorrelationPair]
    correlation_irradiance_power: Optional[float] = None
    correlation_temp_power: Optional[float] = None
    correlation_temp_efficiency: Optional[float] = None

    model_config = ConfigDict(from_attributes=True)


class ExtremePerformancePeriod(BaseModel):
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


class ResidualBin(BaseModel):
    range: str
    count: int


class PerformanceAnalyticsResponse(BaseModel):
    device_id: str
    time_range: str
    model_name: str
    model_version: str
    r2_score: float
    mae_w: float
    rmse_w: float
    train_samples: int
    test_samples: int
    dataset_samples: int
    best_period: Optional[ExtremePerformancePeriod] = None
    worst_period: Optional[ExtremePerformancePeriod] = None
    residual_distribution: List[ResidualBin] = []

    model_config = ConfigDict(from_attributes=True)
