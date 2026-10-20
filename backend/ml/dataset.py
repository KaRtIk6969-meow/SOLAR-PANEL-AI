"""
SolarAI ML Dataset Module
Queries telemetry records from the database, filters records, and splits into train/test sets.
"""

from typing import List, Dict, Optional, Tuple, Union
import numpy as np
from sklearn.model_selection import train_test_split
from sqlalchemy.orm import Session
from app.models.sensor_reading import SensorReading
from ml.preprocessing import filter_valid_records, prepare_features_and_target, FEATURE_NAMES

# Minimum number of valid real telemetry records required to train models meaningfully
MIN_SAMPLES_FOR_TRAINING: int = 10


class InsufficientDataError(ValueError):
    """Raised when the database contains fewer than the minimum required telemetry samples."""
    pass


def load_telemetry_dataset(
    db: Session,
    device_id: Optional[str] = None,
    min_samples: int = MIN_SAMPLES_FOR_TRAINING,
) -> Tuple[np.ndarray, np.ndarray, List[Dict[str, float]]]:
    """
    Retrieve real telemetry records from the database, filter invalid entries,
    and convert to feature matrix X and target array y.
    
    Raises InsufficientDataError if valid records < min_samples.
    """
    query = db.query(SensorReading)
    if device_id:
        query = query.filter(SensorReading.device_id == device_id)
    
    # Order chronologically for realistic telemetry ordering
    records = query.order_by(SensorReading.timestamp.asc()).all()

    # Clean and filter physical records
    clean_records = filter_valid_records(records)

    if len(clean_records) < min_samples:
        raise InsufficientDataError("Insufficient real telemetry data for model training.")

    X, y, _ = prepare_features_and_target(clean_records)
    return X, y, clean_records


def split_dataset(
    X: np.ndarray,
    y: np.ndarray,
    test_size: float = 0.2,
    random_state: int = 42,
) -> Tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray]:
    """
    Split feature matrix and target vector into training and testing sets.
    """
    if len(X) < 2:
        raise ValueError("Cannot split dataset with fewer than 2 samples.")

    # Guarantee at least 1 test sample
    computed_test_size = max(1, int(len(X) * test_size))
    
    X_train, X_test, y_train, y_test = train_test_split(
        X,
        y,
        test_size=computed_test_size,
        random_state=random_state,
        shuffle=True,
    )
    return X_train, X_test, y_train, y_test
