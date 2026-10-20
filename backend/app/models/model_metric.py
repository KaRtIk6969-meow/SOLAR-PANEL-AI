from datetime import datetime, timezone
from sqlalchemy import (
    Column,
    Integer,
    String,
    Float,
    Text,
    DateTime,
    Index,
)
from app.core.database import Base


class ModelMetric(Base):
    """
    Validation and performance metrics for AI models (e.g. Random Forest, XGBoost, Linear Regressor).
    Tracks historical evaluation metrics such as MAE, RMSE, and R2 across training runs.
    """
    __tablename__ = "model_metrics"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    model_name = Column(String(128), nullable=False)
    model_version = Column(String(64), nullable=False)
    evaluation_date = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False, index=True)

    # Standard regression performance metrics
    mae = Column(Float, nullable=False)  # Mean Absolute Error (Watts)
    rmse = Column(Float, nullable=False)  # Root Mean Squared Error (Watts)
    r2_score = Column(Float, nullable=False)  # Coefficient of Determination (0.0 to 1.0)
    dataset_size = Column(Integer, nullable=False)  # Number of evaluation test samples

    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    __table_args__ = (
        Index("idx_model_metrics_name_version", "model_name", "model_version"),
        Index("idx_model_metrics_eval_date_desc", evaluation_date.desc()),
    )
