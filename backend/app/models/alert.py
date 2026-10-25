from datetime import datetime, timezone
from sqlalchemy import (
    Column,
    Integer,
    String,
    Float,
    Boolean,
    Text,
    DateTime,
    ForeignKey,
    Index,
)
from sqlalchemy.orm import relationship
from app.core.database import Base


class Alert(Base):
    """
    Diagnostic, environmental, and operational alarms triggered by
    real sensor thresholds or AI prediction anomaly detection.
    """
    __tablename__ = "alerts"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    device_id = Column(String(64), ForeignKey("devices.id", ondelete="CASCADE"), nullable=False, index=True)
    timestamp = Column(DateTime(timezone=True), nullable=False, index=True)

    severity = Column(String(32), default="WARNING", nullable=False)  # INFO, WARNING, CRITICAL
    category = Column(String(64), nullable=False)  # ELECTRICAL, THERMAL, EFFICIENCY, ANOMALY, CONNECTIVITY
    message = Column(Text, nullable=False)

    is_resolved = Column(Boolean, default=False, nullable=False)
    resolved_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    # Intelligent Diagnostics & Metric Deviation (Step 9)
    alert_type = Column(String(64), nullable=True, index=True)
    metric_name = Column(String(64), nullable=True)
    metric_value = Column(Float, nullable=True)
    expected_value = Column(Float, nullable=True)
    unit = Column(String(32), nullable=True)
    recommended_action = Column(Text, nullable=True)

    # Relationships
    device = relationship("Device", back_populates="alerts")

    __table_args__ = (
        Index("idx_alerts_device_timestamp", "device_id", "timestamp"),
        Index("idx_alerts_device_ts_desc", "device_id", timestamp.desc()),
        Index("idx_alerts_status", "is_resolved", "severity"),
    )
