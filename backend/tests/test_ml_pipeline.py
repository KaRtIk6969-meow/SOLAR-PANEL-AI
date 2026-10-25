"""
Unit & Integration Tests for SolarAI Machine Learning Pipeline
Covers preprocessing, dataset validation, insufficient data errors, model training,
evaluation metrics, model loading, and FastAPI ML endpoints.
"""

from datetime import datetime, timezone, timedelta
import pytest
import numpy as np
from fastapi import status

from ml.preprocessing import (
    validate_telemetry_record,
    filter_valid_records,
    prepare_features_and_target,
    FEATURE_NAMES,
    TARGET_NAME,
)
from ml.dataset import (
    MIN_SAMPLES_FOR_TRAINING,
    InsufficientDataError,
    load_telemetry_dataset,
    split_dataset,
)
from ml.evaluate import calculate_metrics, ModelEvaluationResult
from ml.model_registry import ModelRegistry, ModelMetadata
from ml.train import train_and_evaluate_models, get_candidate_models
from ml.predict import (
    predict_power,
    NoModelAvailableError,
    InvalidFeatureError,
)
from app.models.sensor_reading import SensorReading
from app.models.device import Device


# -------------------------------------------------------------
# 1. Preprocessing Tests
# -------------------------------------------------------------

def test_preprocessing_valid_records():
    """Verify that physically valid telemetry records pass validation."""
    valid_record = {
        "voltage_v": 18.5,
        "current_a": 2.4,
        "temperature_c": 32.0,
        "irradiance_w_m2": 820.0,
        "power_w": 44.4,
        "data_quality": "GOOD",
    }
    assert validate_telemetry_record(valid_record) is True

    clean_records = filter_valid_records([valid_record])
    assert len(clean_records) == 1
    assert clean_records[0]["voltage_v"] == 18.5

    X, y, features = prepare_features_and_target(clean_records)
    assert X.shape == (1, 4)
    assert y.shape == (1,)
    assert y[0] == 44.4
    assert features == FEATURE_NAMES


def test_preprocessing_invalid_and_missing_records():
    """Verify that records with missing, NaN, or out-of-bounds fields are excluded."""
    # Missing voltage
    assert validate_telemetry_record({
        "current_a": 2.0, "temperature_c": 30.0, "irradiance_w_m2": 800.0, "power_w": 36.0
    }) is False

    # Out-of-bounds voltage (> 50V limit)
    assert validate_telemetry_record({
        "voltage_v": 75.0, "current_a": 2.0, "temperature_c": 30.0, "irradiance_w_m2": 800.0, "power_w": 150.0
    }) is False

    # Negative current
    assert validate_telemetry_record({
        "voltage_v": 18.0, "current_a": -1.5, "temperature_c": 30.0, "irradiance_w_m2": 800.0, "power_w": 0.0
    }) is False

    # Extreme temperature (> 100°C)
    assert validate_telemetry_record({
        "voltage_v": 18.0, "current_a": 2.0, "temperature_c": 135.0, "irradiance_w_m2": 800.0, "power_w": 36.0
    }) is False

    # Non-numeric string value
    assert validate_telemetry_record({
        "voltage_v": "invalid_volt", "current_a": 2.0, "temperature_c": 30.0, "irradiance_w_m2": 800.0, "power_w": 36.0
    }) is False

    # Severe short circuit quality flag
    assert validate_telemetry_record({
        "voltage_v": 0.0, "current_a": 0.0, "temperature_c": 30.0, "irradiance_w_m2": 800.0, "power_w": 0.0, "data_quality": "SUSPECT_SHORT_CIRCUIT"
    }) is False


# -------------------------------------------------------------
# 2. Evaluation Metrics Tests
# -------------------------------------------------------------

def test_evaluation_metrics():
    """Verify MAE, RMSE, and R2 calculation accuracy."""
    y_true = np.array([10.0, 20.0, 30.0, 40.0])
    y_pred = np.array([11.0, 19.0, 31.0, 39.0])  # Error is 1.0 on every prediction

    result = calculate_metrics(y_true, y_pred)
    assert isinstance(result, ModelEvaluationResult)
    assert result.mae == 1.0
    assert result.rmse == 1.0
    assert result.r2_score > 0.95
    assert result.dataset_size == 4


# -------------------------------------------------------------
# 3. Insufficient Data Tests
# -------------------------------------------------------------

def test_insufficient_data_error(db_session):
    """Verify that load_telemetry_dataset raises InsufficientDataError when data is scarce."""
    # DB is empty initially
    with pytest.raises(InsufficientDataError) as exc_info:
        load_telemetry_dataset(db_session, min_samples=10)
    assert "Insufficient real telemetry data" in str(exc_info.value)

    # Insert only 3 records (below MIN_SAMPLES_FOR_TRAINING = 10)
    dev = Device(id="TEST-NODE-01", name="Test Node", rated_power_w=50.0)
    db_session.add(dev)
    db_session.commit()

    now = datetime.now(timezone.utc)
    for i in range(3):
        rec = SensorReading(
            device_id="TEST-NODE-01",
            timestamp=now - timedelta(minutes=i),
            voltage_v=18.0,
            current_a=2.0,
            temperature_c=30.0,
            irradiance_w_m2=800.0,
            power_w=36.0,
            data_quality="GOOD",
        )
        db_session.add(rec)
    db_session.commit()

    with pytest.raises(InsufficientDataError) as exc_info:
        load_telemetry_dataset(db_session, min_samples=10)
    assert "Insufficient real telemetry data" in str(exc_info.value)


# -------------------------------------------------------------
# 4. Model Training & Registry Tests
# -------------------------------------------------------------

def test_model_training_and_registry(tmp_path, db_session):
    """
    Test model training on synthetic test DB, evaluating candidate algorithms,
    verifying held-out evaluation, and loading the saved artifact.
    """
    registry = ModelRegistry(base_dir=tmp_path)

    # Populate test database with 15 valid readings
    dev = Device(id="SOLAR-ESP32-01", name="Solar Node", rated_power_w=50.0)
    db_session.add(dev)
    db_session.commit()

    now = datetime.now(timezone.utc)
    np.random.seed(42)
    for i in range(16):
        v = float(17.5 + np.random.uniform(0.1, 1.5))
        curr = float(1.8 + np.random.uniform(0.1, 0.8))
        temp = float(28.0 + np.random.uniform(1.0, 5.0))
        irr = float(700.0 + np.random.uniform(20.0, 150.0))
        pwr = round(v * curr, 2)

        rec = SensorReading(
            device_id="SOLAR-ESP32-01",
            timestamp=now - timedelta(seconds=i * 10),
            voltage_v=v,
            current_a=curr,
            temperature_c=temp,
            irradiance_w_m2=irr,
            power_w=pwr,
            data_quality="GOOD",
        )
        db_session.add(rec)
    db_session.commit()

    # Train and evaluate models
    report = train_and_evaluate_models(
        db=db_session,
        device_id="SOLAR-ESP32-01",
        registry=registry,
        test_size=0.2,
        random_state=42,
    )

    assert report.best_model_name in ("LinearRegression", "RandomForestRegressor", "XGBRegressor")
    assert report.dataset_summary["total_samples"] == 16
    assert report.dataset_summary["test_samples"] >= 1
    assert "mae" in report.best_metrics
    assert "rmse" in report.best_metrics
    assert "r2_score" in report.best_metrics

    # Test loading best model
    model, metadata = registry.load_best_model()
    assert metadata.model_name == report.best_model_name
    assert metadata.is_best is True

    # Test status
    status_info = registry.get_status()
    assert status_info["model_available"] is True
    assert status_info["active_model"]["model_name"] == report.best_model_name

    # Test prediction with loaded model
    sample_features = {
        "voltage_v": 18.0,
        "current_a": 2.0,
        "temperature_c": 30.0,
        "irradiance_w_m2": 800.0,
    }
    pred_res = predict_power(sample_features, registry=registry, model=model, metadata=metadata)
    assert "predicted_power_w" in pred_res
    assert pred_res["predicted_power_w"] > 0.0
    assert pred_res["model_name"] == report.best_model_name


# -------------------------------------------------------------
# 5. Prediction Validation & Error Tests
# -------------------------------------------------------------

def test_predict_errors(tmp_path):
    """Test inference error handling: missing model, invalid features, out of bounds."""
    empty_registry = ModelRegistry(base_dir=tmp_path / "empty")

    # 1. No model available error
    with pytest.raises(NoModelAvailableError):
        predict_power({"voltage_v": 18.0, "current_a": 2.0, "temperature_c": 30.0, "irradiance_w_m2": 800.0}, registry=empty_registry)

    # 2. Missing feature
    with pytest.raises(InvalidFeatureError):
        predict_power({"voltage_v": 18.0, "current_a": 2.0, "temperature_c": 30.0}, registry=empty_registry, model="dummy", metadata=ModelMetadata(
            model_name="test", model_version="v1", training_timestamp="", feature_names=FEATURE_NAMES, target_name=TARGET_NAME,
            dataset_size=10, train_size=8, test_size=2, mae=0.1, rmse=0.1, r2_score=0.9, artifact_path=""
        ))

    # 3. Out-of-bounds feature (> 50V)
    with pytest.raises(InvalidFeatureError):
        predict_power({"voltage_v": 60.0, "current_a": 2.0, "temperature_c": 30.0, "irradiance_w_m2": 800.0}, registry=empty_registry, model="dummy", metadata=ModelMetadata(
            model_name="test", model_version="v1", training_timestamp="", feature_names=FEATURE_NAMES, target_name=TARGET_NAME,
            dataset_size=10, train_size=8, test_size=2, mae=0.1, rmse=0.1, r2_score=0.9, artifact_path=""
        ))


# -------------------------------------------------------------
# 6. FastAPI ML Endpoint Tests
# -------------------------------------------------------------

def test_ml_api_endpoints_insufficient_and_sufficient_flow(client, db_session, tmp_path):
    """
    Test full HTTP flow:
    - POST /api/v1/ml/train returns 400 when insufficient data
    - GET /api/v1/ml/status reports model_available: false initially
    - Insert 15 records
    - POST /api/v1/ml/train returns 200 with training report
    - GET /api/v1/ml/status reports model_available: true
    - GET /api/v1/ml/models returns list of registered models
    - POST /api/v1/ml/predict returns valid power prediction
    """
    from app.main import app as fastapi_app
    from app.api.v1.ml import get_registry
    test_reg = ModelRegistry(base_dir=tmp_path / "test_ml_reg")
    fastapi_app.dependency_overrides[get_registry] = lambda: test_reg

    try:
        # 1. Train on empty DB -> 400 Insufficient Data
        train_res = client.post("/api/v1/ml/train", json={})
        assert train_res.status_code == status.HTTP_400_BAD_REQUEST
        assert "Insufficient real telemetry data" in train_res.json()["detail"]

        # 2. Status initially with fresh test registry
        status_res = client.get("/api/v1/ml/status")
        assert status_res.status_code == status.HTTP_200_OK
        assert status_res.json()["model_available"] is False

        # 3. Predict before model trained -> 404 in isolated test registry
        pred_before = client.post("/api/v1/ml/predict", json={
            "voltage_v": 18.0, "current_a": 2.0, "temperature_c": 30.0, "irradiance_w_m2": 800.0
        })
        assert pred_before.status_code == status.HTTP_404_NOT_FOUND

        # 4. Insert 15 valid telemetry records
        dev = Device(id="SOLAR-ESP32-01", name="Solar Node", rated_power_w=50.0)
        db_session.add(dev)
        db_session.commit()

        now = datetime.now(timezone.utc)
        for i in range(15):
            v = 18.0 + (i * 0.1)
            curr = 2.0 + (i * 0.05)
            rec = SensorReading(
                device_id="SOLAR-ESP32-01",
                timestamp=now - timedelta(minutes=i),
                voltage_v=v,
                current_a=curr,
                temperature_c=30.0 + (i * 0.2),
                irradiance_w_m2=800.0 + (i * 5.0),
                power_w=round(v * curr, 2),
                data_quality="GOOD",
            )
            db_session.add(rec)
        db_session.commit()

        # 5. Train with sufficient records -> 200 OK
        train_res = client.post("/api/v1/ml/train", json={"device_id": "SOLAR-ESP32-01"})
        assert train_res.status_code == status.HTTP_200_OK
        data = train_res.json()
        assert data["status"] == "success"
        assert "best_model_name" in data["report"]
        assert data["report"]["dataset_summary"]["total_samples"] == 15

        # 6. Status check
        status_res = client.get("/api/v1/ml/status")
        assert status_res.status_code == status.HTTP_200_OK
        assert status_res.json()["model_available"] is True

        # 7. List models
        models_res = client.get("/api/v1/ml/models")
        assert models_res.status_code == status.HTTP_200_OK
        assert isinstance(models_res.json(), list)
        assert len(models_res.json()) >= 1

        # 8. Run prediction via API
        pred_res = client.post("/api/v1/ml/predict", json={
            "voltage_v": 18.4,
            "current_a": 2.2,
            "temperature_c": 31.5,
            "irradiance_w_m2": 820.0,
        })
        assert pred_res.status_code == status.HTTP_200_OK
        pred_data = pred_res.json()
        assert "predicted_power_w" in pred_data
        assert pred_data["predicted_power_w"] > 0.0
        assert "model_name" in pred_data
        assert "model_version" in pred_data
    finally:
        fastapi_app.dependency_overrides.pop(get_registry, None)
