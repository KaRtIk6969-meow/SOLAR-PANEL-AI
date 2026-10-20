from datetime import datetime, timezone
from sqlalchemy import Column, String, Float, DateTime
from sqlalchemy.orm import relationship
from app.core.database import Base


class Device(Base):
    __tablename__ = "devices"

    id = Column(String(64), primary_key=True, index=True)
    name = Column(String(128), nullable=False)
    rated_power_w = Column(Float, default=100.0, nullable=False)
    panel_area_m2 = Column(Float, default=0.65, nullable=False)
    temp_coeff = Column(Float, default=-0.0038, nullable=False)  # -0.38% / °C
    last_seen_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    # Relationships
    telemetry_readings = relationship(
        "TelemetryReading", 
        back_populates="device", 
        cascade="all, delete-orphan",
        order_by="desc(TelemetryReading.timestamp)"
    )
