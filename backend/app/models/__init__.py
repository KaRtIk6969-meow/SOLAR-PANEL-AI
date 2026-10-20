"""
SQLAlchemy models initialization.
Registers all Phase 3 entities on Base.metadata.
"""
from app.models.device import Device
from app.models.sensor_reading import SensorReading, TelemetryReading
from app.models.prediction import Prediction
from app.models.alert import Alert
from app.models.health_score import HealthScore
from app.models.model_metric import ModelMetric

__all__ = [
    "Device",
    "SensorReading",
    "TelemetryReading",
    "Prediction",
    "Alert",
    "HealthScore",
    "ModelMetric",
]
