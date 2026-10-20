from datetime import datetime, timezone
from sqlalchemy import (
    Column,
    Integer,
    String,
    Float,
    DateTime,
    ForeignKey,
    Index,
)
from sqlalchemy.orm import relationship
from app.core.database import Base


class Prediction(Base):
    """
    AI Model Inference Predictions.
    Stores forecasted power output/efficiency against actual telemetry,
    computing residuals and deviation percentages for anomaly monitoring.
    """
    __tablename__ = "predictions"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    device_id = Column(String(64), ForeignKey("devices.id", ondelete="CASCADE"), nullable=False, index=True)
    timestamp = Column(DateTime(timezone=True), nullable=False, index=True)

    # Prediction targets & quantitative comparisons
    target = Column(String(64), default="power_w", nullable=False)  # e.g., "power_w", "efficiency_pct"
    predicted_value = Column(Float, nullable=False)
    actual_value = Column(Float, nullable=True)
    residual = Column(Float, nullable=True)  # actual - predicted
    deviation_pct = Column(Float, nullable=True)  # ((actual - predicted) / predicted) * 100

    # Model metadata & status
    alert_status = Column(String(32), default="NORMAL", nullable=False)  # NORMAL, WARNING, CRITICAL
    model_version = Column(String(64), default="rf_v1.0.0", nullable=False)

    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    # Relationships
    device = relationship("Device", back_populates="predictions")

    __table_args__ = (
        Index("idx_predictions_device_timestamp", "device_id", "timestamp"),
        Index("idx_predictions_device_ts_desc", "device_id", timestamp.desc()),
    )
