"""
SolarAI ML API Endpoints
Provides endpoints for training AI models on telemetry records, inspecting model registry status,
and running power predictions.
"""

from typing import Optional, Dict, Any, List
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.database import get_db
from ml.dataset import InsufficientDataError, MIN_SAMPLES_FOR_TRAINING
from ml.train import train_and_evaluate_models
from ml.predict import predict_power, NoModelAvailableError, InvalidFeatureError
from ml.model_registry import default_registry, ModelRegistry

router = APIRouter(prefix="/ml", tags=["Machine Learning & AI Inference"])


def get_registry() -> ModelRegistry:
    return default_registry


# --- Request & Response Schemas ---

class TrainRequest(BaseModel):
    device_id: Optional[str] = Field(
        None,
        description="Optional device ID filter. If omitted, trains across all valid node telemetry.",
        examples=["SOLAR-ESP32-01"]
    )


class TrainResponse(BaseModel):
    status: str = "success"
    message: str
    report: Dict[str, Any]


class PredictRequest(BaseModel):
    voltage_v: float = Field(..., ge=0.0, le=50.0, description="Measured array voltage in Volts", examples=[18.42])
    current_a: float = Field(..., ge=0.0, le=20.0, description="Measured array current in Amperes", examples=[2.31])
    temperature_c: float = Field(..., ge=-20.0, le=100.0, description="Panel surface temperature in Celsius", examples=[31.7])
    irradiance_w_m2: float = Field(..., ge=0.0, le=2000.0, description="Solar irradiance in W/m²", examples=[812.0])


class PredictResponse(BaseModel):
    predicted_power_w: float = Field(..., description="Forecasted solar power generation in Watts")
    model_name: str = Field(..., description="Name of the regression algorithm used")
    model_version: str = Field(..., description="Version slug of the registered model artifact")


class ModelStatusResponse(BaseModel):
    model_available: bool
    active_model: Optional[Dict[str, Any]] = None
    message: str


# --- Endpoints ---

@router.post(
    "/train",
    response_model=TrainResponse,
    status_code=status.HTTP_200_OK,
    summary="Train AI Power Prediction Models",
    description="Retrieves valid real telemetry from the database, trains candidate models (Linear Regression, Random Forest, XGBoost), evaluates strictly on held-out test data, and persists the best performing artifact."
)
def train_models_endpoint(
    payload: Optional[TrainRequest] = None,
    db: Session = Depends(get_db),
    registry: ModelRegistry = Depends(get_registry),
):
    device_id = payload.device_id if payload else None
    try:
        report = train_and_evaluate_models(db=db, device_id=device_id, registry=registry)
        return TrainResponse(
            status="success",
            message=f"Model training complete. Selected '{report.best_model_name}' ({report.best_model_version}) as best performer.",
            report=report.to_dict(),
        )
    except InsufficientDataError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Model training failed: {str(e)}",
        )


@router.get(
    "/models",
    response_model=List[Dict[str, Any]],
    summary="List Registered Model Versions",
    description="Returns metadata and validation benchmarks for all trained model versions in the registry."
)
def list_models_endpoint(registry: ModelRegistry = Depends(get_registry)):
    return registry.list_models()


@router.get(
    "/status",
    response_model=ModelStatusResponse,
    summary="AI Model Deployment Status",
    description="Reports whether an active, trained model artifact is available for real-time inference."
)
def model_status_endpoint(registry: ModelRegistry = Depends(get_registry)):
    status_dict = registry.get_status()
    return ModelStatusResponse(
        model_available=status_dict["model_available"],
        active_model=status_dict.get("active_model"),
        message=status_dict["message"],
    )


@router.post(
    "/predict",
    response_model=PredictResponse,
    status_code=status.HTTP_200_OK,
    summary="Predict Expected Solar Power",
    description="Accepts physical sensor features (voltage, current, temperature, irradiance) and computes expected power output using the best trained model."
)
def predict_endpoint(
    payload: PredictRequest,
    registry: ModelRegistry = Depends(get_registry),
):
    try:
        result = predict_power(payload.model_dump(), registry=registry)
        return PredictResponse(
            predicted_power_w=result["predicted_power_w"],
            model_name=result["model_name"],
            model_version=result["model_version"],
        )
    except NoModelAvailableError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        )
    except InvalidFeatureError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(e),
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Inference error: {str(e)}",
        )
