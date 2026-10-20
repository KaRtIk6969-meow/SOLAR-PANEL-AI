"""
SolarAI Machine Learning Package
Physics-informed solar panel power forecasting and efficiency anomaly detection.
"""

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
from ml.model_registry import ModelRegistry, ModelMetadata
from ml.train import train_and_evaluate_models, TrainingReport
from ml.predict import predict_power, NoModelAvailableError

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
    "train_and_evaluate_models",
    "TrainingReport",
    "predict_power",
    "NoModelAvailableError",
]
