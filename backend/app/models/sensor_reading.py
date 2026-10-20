from datetime import datetime, timezone
from sqlalchemy import (
    Column,
    Integer,
    String,
    Float,
    DateTime,
    ForeignKey,
    UniqueConstraint,
    Index,
)
from sqlalchemy.orm import relationship
from app.core.database import Base


class SensorReading(Base):
    """
    Physical sensor readings received from ESP32 edge microcontrollers.
    Persists electrical, thermal, and irradiance telemetry alongside derived power and efficiency.
    """
    __tablename__ = "sensor_readings"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    device_id = Column(String(64), ForeignKey("devices.id", ondelete="CASCADE"), nullable=False, index=True)
    timestamp = Column(DateTime(timezone=True), nullable=False, index=True)

    # Electrical and environmental measurements
    voltage_v = Column(Float, nullable=False)
    current_a = Column(Float, nullable=False)
    temperature_c = Column(Float, nullable=False)
    irradiance_w_m2 = Column(Float, nullable=False)

    # Derived physical metrics
    power_w = Column(Float, nullable=False)
    efficiency_pct = Column(Float, nullable=True)

    # Data integrity & metadata
    data_quality = Column(String(32), default="GOOD", nullable=False)  # GOOD, SUSPECT, OPEN_CIRCUIT, SHORT_CIRCUIT, OVERHEATING, LOW_EFFICIENCY
    firmware_version = Column(String(32), default="1.0.0", nullable=True)

    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    # Diagnostic compatibility helpers
    @property
    def is_anomaly(self) -> bool:
        return self.data_quality != "GOOD"

    @property
    def anomaly_notes(self) -> str | None:
        if self.data_quality == "SUSPECT_OPEN_CIRCUIT":
            return "Open Circuit: Array voltage near Voc with negligible load current."
        elif self.data_quality == "SUSPECT_SHORT_CIRCUIT":
            return "Short Circuit: Zero array voltage under active sunlight generation."
        elif self.data_quality == "OVERHEATING":
            return "Thermal Critical: Cell temperature exceeds safe threshold."
        elif self.data_quality == "LOW_EFFICIENCY":
            return "Low Efficiency: Energy conversion below 3% under active irradiance."
        elif self.data_quality != "GOOD":
            return f"Suspect Reading: {self.data_quality}"
        return None

    # Relationships
    device = relationship("Device", back_populates="sensor_readings")

    __table_args__ = (
        UniqueConstraint("device_id", "timestamp", name="uq_sensor_reading_device_timestamp"),
        Index("idx_sensor_reading_device_timestamp", "device_id", "timestamp"),
        Index("idx_sensor_reading_device_ts_desc", "device_id", timestamp.desc()),
    )


# Backward compatibility alias
TelemetryReading = SensorReading
