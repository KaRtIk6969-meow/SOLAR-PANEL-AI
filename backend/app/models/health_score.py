from datetime import datetime, timezone
from sqlalchemy import (
    Column,
    Integer,
    String,
    Float,
    Text,
    DateTime,
    ForeignKey,
    Index,
)
from sqlalchemy.orm import relationship
from app.core.database import Base


class HealthScore(Base):
    """
    Automated health evaluations of solar panel hardware.
    Aggregates electrical, thermal, and photovoltaic conversion health
    into a standardized composite score (0-100%).
    """
    __tablename__ = "health_scores"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    device_id = Column(String(64), ForeignKey("devices.id", ondelete="CASCADE"), nullable=False, index=True)
    timestamp = Column(DateTime(timezone=True), nullable=False, index=True)

    # Dimensional scores (0.0 to 100.0)
    overall_score = Column(Float, nullable=False)
    electrical_health = Column(Float, nullable=False)
    thermal_health = Column(Float, nullable=False)
    photovoltaic_health = Column(Float, nullable=False)

    degradation_factor = Column(Float, default=0.0, nullable=True)
    recommendation = Column(Text, nullable=True)

    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    # Relationships
    device = relationship("Device", back_populates="health_scores")

    __table_args__ = (
        Index("idx_health_scores_device_timestamp", "device_id", "timestamp"),
        Index("idx_health_scores_device_ts_desc", "device_id", timestamp.desc()),
    )
