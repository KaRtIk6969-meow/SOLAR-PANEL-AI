"""
SolarAI ML Evaluation Module
Computes regression performance metrics: MAE, RMSE, and R2 score.
"""

from dataclasses import dataclass
from typing import Dict, Any
import numpy as np
from sklearn.metrics import mean_absolute_error, root_mean_squared_error, r2_score


@dataclass
class ModelEvaluationResult:
    mae: float
    rmse: float
    r2_score: float
    dataset_size: int

    def to_dict(self) -> Dict[str, Any]:
        return {
            "mae": round(self.mae, 4),
            "rmse": round(self.rmse, 4),
            "r2_score": round(self.r2_score, 4),
            "dataset_size": self.dataset_size,
        }


def calculate_metrics(y_true: np.ndarray, y_pred: np.ndarray) -> ModelEvaluationResult:
    """
    Compute MAE, RMSE, and R2 score between ground truth and predicted test targets.
    Strictly executed on held-out test data.
    """
    y_true_arr = np.asarray(y_true, dtype=np.float64)
    y_pred_arr = np.asarray(y_pred, dtype=np.float64)

    if len(y_true_arr) == 0:
        raise ValueError("Cannot calculate metrics on empty arrays.")

    mae_val = float(mean_absolute_error(y_true_arr, y_pred_arr))
    rmse_val = float(root_mean_squared_error(y_true_arr, y_pred_arr))

    # Calculate R2 score with safety check for constant arrays
    if len(y_true_arr) < 2 or np.all(y_true_arr == y_true_arr[0]):
        # R2 is undefined when variance of y_true is 0; default to 0.0 or 1.0 if perfect prediction
        r2_val = 1.0 if np.allclose(y_true_arr, y_pred_arr) else 0.0
    else:
        r2_val = float(r2_score(y_true_arr, y_pred_arr))

    return ModelEvaluationResult(
        mae=mae_val,
        rmse=rmse_val,
        r2_score=r2_val,
        dataset_size=len(y_true_arr),
    )
