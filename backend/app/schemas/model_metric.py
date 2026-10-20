from datetime import datetime, timezone
from typing import Optional
from pydantic import BaseModel, Field, ConfigDict


class ModelMetricCreate(BaseModel):
    model_name: str = Field(..., examples=["SolarEfficiencyRandomForest"])
    model_version: str = Field(..., examples=["rf_v1.0.0"])
    evaluation_date: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    mae: float = Field(..., description="Mean Absolute Error in Watts")
    rmse: float = Field(..., description="Root Mean Squared Error in Watts")
    r2_score: float = Field(..., description="Coefficient of Determination R^2")
    dataset_size: int = Field(..., description="Number of evaluation samples")
    notes: Optional[str] = None


class ModelMetricResponse(BaseModel):
    id: int
    model_name: str
    model_version: str
    evaluation_date: datetime
    mae: float
    rmse: float
    r2_score: float
    dataset_size: int
    notes: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
