from datetime import datetime, timezone
from sqlalchemy import Column, String, Float, Boolean, DateTime
from sqlalchemy.orm import relationship
from app.core.database import Base


class Device(Base):
    __tablename__ = "devices"

    id = Column(String(64), primary_key=True, index=True)  # device_id (e.g. SOLAR-ESP32-01)
    name = Column(String(128), nullable=False)
    location = Column(String(256), nullable=True)
    rated_power_w = Column(Float, default=100.0, nullable=False)
    panel_area_m2 = Column(Float, default=0.65, nullable=False)
    temp_coeff = Column(Float, default=-0.0038, nullable=False)  # -0.38% / °C
    firmware_version = Column(String(32), default="1.0.0", nullable=False)
    status = Column(String(32), default="ONLINE", nullable=False)  # ONLINE, STALE, OFFLINE
    is_active = Column(Boolean, default=True, nullable=False)
    ip_address = Column(String(45), nullable=True)
    last_seen_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False
    )

    # Relationships
    sensor_readings = relationship(
        "SensorReading",
        back_populates="device",
        cascade="all, delete-orphan",
        order_by="desc(SensorReading.timestamp)"
    )
    predictions = relationship(
        "Prediction",
        back_populates="device",
        cascade="all, delete-orphan",
        order_by="desc(Prediction.timestamp)"
    )
    alerts = relationship(
        "Alert",
        back_populates="device",
        cascade="all, delete-orphan",
        order_by="desc(Alert.timestamp)"
    )
    health_scores = relationship(
        "HealthScore",
        back_populates="device",
        cascade="all, delete-orphan",
        order_by="desc(HealthScore.timestamp)"
    )

    # Backward compatibility alias
    @property
    def telemetry_readings(self):
        return self.sensor_readings
