"""
SolarAI ML Prediction & Inference Module
Accepts physical sensor telemetry features and generates AI expected power output.
"""

from typing import Dict, Any, Optional
import numpy as np
from ml.preprocessing import FEATURE_NAMES, validate_telemetry_record, PHYSICAL_BOUNDS
from ml.model_registry import ModelRegistry, ModelMetadata, default_registry


class NoModelAvailableError(RuntimeError):
    """Raised when an inference is requested but no trained model artifact exists."""
    pass


class InvalidFeatureError(ValueError):
    """Raised when incoming features are missing or outside physical limits."""
    pass


def predict_power(
    features: Dict[str, Any],
    registry: Optional[ModelRegistry] = None,
    model: Optional[Any] = None,
    metadata: Optional[ModelMetadata] = None,
) -> Dict[str, Any]:
    """
    Generate power output prediction for given sensor telemetry features.
    
    Accepts:
      features: dict with keys:
        - voltage_v (float)
        - current_a (float)
        - temperature_c (float)
        - irradiance_w_m2 (float)
        
    Returns:
      {
        "predicted_power_w": float,
        "model_name": str,
        "model_version": str,
        "features_used": dict
      }
    """
    if registry is None:
        registry = default_registry

    # 1. Load active model if not explicitly provided
    if model is None or metadata is None:
        try:
            model, metadata = registry.load_best_model()
        except (FileNotFoundError, Exception) as e:
            raise NoModelAvailableError(
                "No trained model is currently available. Train a model first via POST /api/v1/ml/train."
            ) from e

    # 2. Validate input features
    cleaned_features: Dict[str, float] = {}
    for f_name in FEATURE_NAMES:
        if f_name not in features or features[f_name] is None:
            raise InvalidFeatureError(f"Missing required telemetry feature: '{f_name}'.")

        try:
            val = float(features[f_name])
        except (ValueError, TypeError) as e:
            raise InvalidFeatureError(f"Feature '{f_name}' must be a valid float.") from e

        min_val, max_val = PHYSICAL_BOUNDS[f_name]
        if val < min_val or val > max_val:
            raise InvalidFeatureError(
                f"Feature '{f_name}' value {val} is outside physical bounds [{min_val}, {max_val}]."
            )
        cleaned_features[f_name] = val

    # 3. Form 2D array matching model training feature order
    X = np.array([[cleaned_features[f] for f in FEATURE_NAMES]], dtype=np.float64)

    # 4. Perform model inference
    raw_pred = float(model.predict(X)[0])

    # Enforce physical non-negativity constraint
    predicted_power_w = max(0.0, round(raw_pred, 2))

    return {
        "predicted_power_w": predicted_power_w,
        "model_name": metadata.model_name,
        "model_version": metadata.model_version,
        "features_used": cleaned_features,
    }
