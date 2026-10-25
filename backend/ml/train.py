"""
SolarAI ML Training Module
Trains baseline Linear Regression, Random Forest, and XGBoost models.
Evaluates strictly on held-out test data, selects the best performer, and saves the artifact.
"""

from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional, Tuple
import numpy as np
from sklearn.linear_model import LinearRegression
from sklearn.ensemble import RandomForestRegressor
from sqlalchemy.orm import Session

from ml.preprocessing import FEATURE_NAMES, TARGET_NAME
from ml.dataset import (
    load_telemetry_dataset,
    split_dataset,
    MIN_SAMPLES_FOR_TRAINING,
    InsufficientDataError,
)
from ml.evaluate import calculate_metrics, ModelEvaluationResult
from ml.model_registry import ModelRegistry, ModelMetadata, default_registry

# Check XGBoost availability
try:
    import xgboost as xgb
    HAS_XGBOOST = True
except ImportError:
    HAS_XGBOOST = False


@dataclass
class TrainingReport:
    best_model_name: str
    best_model_version: str
    best_metrics: Dict[str, float]
    dataset_summary: Dict[str, int]
    all_models: List[Dict[str, Any]]
    training_timestamp: str

    def to_dict(self) -> Dict[str, Any]:
        models_dict = {
            m["model_name"]: {
                "mae": m["mae"],
                "rmse": m["rmse"],
                "r2_score": m["r2_score"],
            }
            for m in self.all_models
        }
        return {
            "best_model_name": self.best_model_name,
            "best_model_version": self.best_model_version,
            "best_metrics": self.best_metrics,
            "dataset_summary": self.dataset_summary,
            "all_models": self.all_models,
            "dataset_size": self.dataset_summary.get("total_samples", 0),
            "train_samples": self.dataset_summary.get("train_samples", 0),
            "test_samples": self.dataset_summary.get("test_samples", 0),
            "models": models_dict,
            "training_timestamp": self.training_timestamp,
        }


def get_candidate_models() -> Dict[str, Any]:
    """Instantiate candidate regression algorithms."""
    models = {
        "LinearRegression": LinearRegression(),
        "RandomForestRegressor": RandomForestRegressor(
            n_estimators=100,
            max_depth=6,
            min_samples_split=2,
            random_state=42,
        ),
    }

    if HAS_XGBOOST:
        models["XGBRegressor"] = xgb.XGBRegressor(
            n_estimators=100,
            max_depth=4,
            learning_rate=0.08,
            random_state=42,
            verbosity=0,
        )

    return models


def train_and_evaluate_models(
    db: Session,
    device_id: Optional[str] = None,
    registry: Optional[ModelRegistry] = None,
    test_size: float = 0.2,
    random_state: int = 42,
) -> TrainingReport:
    """
    Train candidate models on real telemetry from the database.
    
    1. Loads and filters real telemetry records.
    2. Splits into train and test sets.
    3. Fits candidate models ONLY on train set.
    4. Evaluates strictly on test set (computing MAE, RMSE, R2).
    5. Selects best model (highest R2 / lowest RMSE).
    6. Saves best model artifact in registry and records metrics.
    
    Raises InsufficientDataError if valid records < MIN_SAMPLES_FOR_TRAINING.
    """
    if registry is None:
        registry = default_registry

    # 1. Retrieve and validate real telemetry records from DB
    X, y, clean_records = load_telemetry_dataset(db, device_id=device_id)

    total_samples = len(X)
    X_train, X_test, y_train, y_test = split_dataset(
        X, y, test_size=test_size, random_state=random_state
    )

    candidate_models = get_candidate_models()
    trained_results: List[Tuple[str, Any, ModelEvaluationResult, str]] = []
    timestamp_str = datetime.now(timezone.utc).isoformat()
    timestamp_slug = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")

    # 2. Train each candidate and evaluate on TEST set
    for name, model in candidate_models.items():
        # Fit strictly on train data
        model.fit(X_train, y_train)

        # Predict on held-out test data (DO NOT evaluate on training data)
        y_pred = model.predict(X_test)

        # Enforce non-negative physical power predictions
        y_pred = np.clip(y_pred, 0.0, None)

        # Calculate metrics
        eval_result = calculate_metrics(y_test, y_pred)
        version_str = f"{name.lower()[:3]}_v{timestamp_slug}"

        trained_results.append((name, model, eval_result, version_str))

    # 3. Select best model: highest R2 score; break ties with lower RMSE
    trained_results.sort(
        key=lambda item: (item[2].r2_score, -item[2].rmse),
        reverse=True,
    )

    best_name, best_model, best_eval, best_version = trained_results[0]

    # 4. Save best model artifact and register metadata
    best_metadata = ModelMetadata(
        model_name=best_name,
        model_version=best_version,
        training_timestamp=timestamp_str,
        feature_names=FEATURE_NAMES,
        target_name=TARGET_NAME,
        dataset_size=total_samples,
        train_size=len(X_train),
        test_size=len(X_test),
        mae=round(best_eval.mae, 4),
        rmse=round(best_eval.rmse, 4),
        r2_score=round(best_eval.r2_score, 4),
        artifact_path="",
        is_best=True,
    )

    registry.save_model(best_model, best_metadata, is_best=True, db=db)

    # 5. Format all model evaluations for comparison report
    all_evaluations: List[Dict[str, Any]] = []
    for name, _, ev, ver in trained_results:
        all_evaluations.append({
            "model_name": name,
            "model_version": ver,
            "mae": round(ev.mae, 4),
            "rmse": round(ev.rmse, 4),
            "r2_score": round(ev.r2_score, 4),
            "is_best": (name == best_name),
        })

    return TrainingReport(
        best_model_name=best_name,
        best_model_version=best_version,
        best_metrics=best_eval.to_dict(),
        dataset_summary={
            "total_samples": total_samples,
            "train_samples": len(X_train),
            "test_samples": len(X_test),
        },
        all_models=all_evaluations,
        training_timestamp=timestamp_str,
    )
