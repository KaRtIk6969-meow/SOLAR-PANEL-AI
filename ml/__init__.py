import sys
from pathlib import Path

# Add backend directory to sys.path
backend_path = Path(__file__).resolve().parent.parent / "backend"
if str(backend_path) not in sys.path:
    sys.path.insert(0, str(backend_path))

from ml.preprocessing import (
    FEATURE_NAMES,
    TARGET_NAME,
    validate_telemetry_record,
    filter_valid_records,
    prepare_features_and_target,
)
from ml.dataset import (
    MIN_SAMPLES_FOR_TRAINING,
    InsufficientDataError,
    load_telemetry_dataset,
    split_dataset,
)
from ml.evaluate import calculate_metrics, ModelEvaluationResult
from ml.model_registry import ModelRegistry, ModelMetadata, default_registry
from ml.train import train_and_evaluate_models, TrainingReport
from ml.predict import predict_power, NoModelAvailableError, InvalidFeatureError

__all__ = [
    "FEATURE_NAMES",
    "TARGET_NAME",
    "validate_telemetry_record",
    "filter_valid_records",
    "prepare_features_and_target",
    "MIN_SAMPLES_FOR_TRAINING",
    "InsufficientDataError",
    "load_telemetry_dataset",
    "split_dataset",
    "calculate_metrics",
    "ModelEvaluationResult",
    "ModelRegistry",
    "ModelMetadata",
    "default_registry",
    "train_and_evaluate_models",
    "TrainingReport",
    "predict_power",
    "NoModelAvailableError",
    "InvalidFeatureError",
]
