"""
Telemetry model compatibility module.
Re-exports SensorReading to maintain backward compatibility with Phase 2 imports.
"""
from app.models.sensor_reading import SensorReading, TelemetryReading

__all__ = ["SensorReading", "TelemetryReading"]
