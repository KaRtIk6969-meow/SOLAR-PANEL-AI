from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, ForeignKey, UniqueConstraint, Index
from sqlalchemy.orm import relationship
from app.core.database import Base


class TelemetryReading(Base):
    __tablename__ = "telemetry_readings"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    device_id = Column(String(64), ForeignKey("devices.id", ondelete="CASCADE"), nullable=False, index=True)
    timestamp = Column(DateTime, nullable=False, index=True)
    
    # Raw sensor inputs
    voltage_v = Column(Float, nullable=False)
    current_a = Column(Float, nullable=False)
    temperature_c = Column(Float, nullable=False)
    irradiance_w_m2 = Column(Float, nullable=False)
    
    # Calculated metrics
    power_w = Column(Float, nullable=False)
    efficiency_pct = Column(Float, nullable=True)
    
    # Anomaly & Diagnostic Flags
    is_anomaly = Column(Boolean, default=False, nullable=False)
    anomaly_notes = Column(String(255), nullable=True)

    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    # Relationships
    device = relationship("Device", back_populates="telemetry_readings")

    __table_args__ = (
        UniqueConstraint("device_id", "timestamp", name="uq_device_timestamp"),
        Index("idx_device_timestamp_desc", "device_id", timestamp.desc()),
    )
