"""
SolarAI ML Preprocessing Module
Validates, cleans, and extracts physical telemetry features and prediction targets.
"""

from typing import List, Dict, Any, Tuple, Union, Optional
import math
import numpy as np

# Canonical feature and target definitions
FEATURE_NAMES: List[str] = [
    "voltage_v",
    "current_a",
    "temperature_c",
    "irradiance_w_m2",
]
TARGET_NAME: str = "power_w"

# Physical validity constraints for a standard photovoltaic array setup
PHYSICAL_BOUNDS: Dict[str, Tuple[float, float]] = {
    "voltage_v": (0.0, 50.0),       # Open circuit voltage limit for typical small panels
    "current_a": (0.0, 20.0),       # Short circuit current ceiling
    "temperature_c": (-20.0, 100.0),# Cell operating range
    "irradiance_w_m2": (0.0, 2000.0), # Maximum terrestrial solar flux
    "power_w": (0.0, 1000.0),       # Power output upper bound
}


def is_valid_number(val: Any) -> bool:
    """Check if value is a non-null, finite number."""
    if val is None:
        return False
    if not isinstance(val, (int, float)):
        try:
            val = float(val)
        except (ValueError, TypeError):
            return False
    if math.isnan(val) or math.isinf(val):
        return False
    return True


def validate_telemetry_record(record: Union[Dict[str, Any], Any]) -> bool:
    """
    Validate a single telemetry record against missing fields and physical boundaries.
    Accepts either a dictionary or an ORM SensorReading instance.
    """
    # Extract values whether dict or object
    def get_field(name: str):
        if isinstance(record, dict):
            return record.get(name)
        return getattr(record, name, None)

    # 1. Verify required features and target are present and valid numbers
    for field_name in FEATURE_NAMES + [TARGET_NAME]:
        val = get_field(field_name)
        if not is_valid_number(val):
            return False
        val_float = float(val)
        min_val, max_val = PHYSICAL_BOUNDS[field_name]
        if val_float < min_val or val_float > max_val:
            return False

    # 2. Exclude known hardware malfunction states and demo test data
    data_quality = get_field("data_quality")
    if data_quality in ("SUSPECT_SHORT_CIRCUIT", "CORRUPT", "DEMO", "DEMO_TEST"):
        return False

    return True


def filter_valid_records(records: List[Union[Dict[str, Any], Any]]) -> List[Dict[str, float]]:
    """
    Filter a list of telemetry records, discarding missing, non-numeric, or out-of-bounds records.
    Returns sanitized dictionaries with clean float values.
    """
    valid: List[Dict[str, float]] = []
    for r in records:
        if not validate_telemetry_record(r):
            continue

        def get_field(name: str) -> float:
            if isinstance(r, dict):
                return float(r[name])
            return float(getattr(r, name))

        item = {name: get_field(name) for name in FEATURE_NAMES + [TARGET_NAME]}
        valid.append(item)

    return valid


def prepare_features_and_target(
    clean_records: List[Dict[str, float]]
) -> Tuple[np.ndarray, np.ndarray, List[str]]:
    """
    Convert sanitized records into feature matrix X (N x 4) and target vector y (N).
    """
    if not clean_records:
        return np.empty((0, len(FEATURE_NAMES))), np.empty((0,)), FEATURE_NAMES

    X_list = []
    y_list = []
    for rec in clean_records:
        features = [rec[f] for f in FEATURE_NAMES]
        target = rec[TARGET_NAME]
        X_list.append(features)
        y_list.append(target)

    X = np.array(X_list, dtype=np.float64)
    y = np.array(y_list, dtype=np.float64)
    return X, y, FEATURE_NAMES
