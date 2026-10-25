import pytest
from datetime import datetime, timezone
from fastapi import status
from app.models.sensor_reading import SensorReading
from app.models.prediction import Prediction
from app.models.health_score import HealthScore
from ml.preprocessing import validate_telemetry_record
from ml.model_registry import default_registry


def test_step8_ml_status(client):
    """Verify active model status endpoint reports trained model."""
    res = client.get("/api/v1/ml/status")
    assert res.status_code == status.HTTP_200_OK
    data = res.json()
    assert data["model_available"] is True
    assert data["active_model"] is not None
    assert data["active_model"]["r2_score"] > 0.8
    assert "power_w" == data["active_model"]["target_name"]


def test_step8_predict_endpoint(client):
    """Verify real-time prediction endpoint generates non-negative power forecast."""
    payload = {
        "voltage_v": 18.42,
        "current_a": 2.31,
        "temperature_c": 31.7,
        "irradiance_w_m2": 812.0,
    }
    res = client.post("/api/v1/ml/predict", json=payload)
    assert res.status_code == status.HTTP_200_OK
    data = res.json()
    assert "predicted_power_w" in data
    assert data["predicted_power_w"] > 0.0
    assert "model_name" in data
    assert "model_version" in data


def test_step8_real_telemetry_generates_prediction_and_health(client, db_session):
    """
    Acceptance Test:
    When real telemetry is ingested via POST /api/v1/telemetry:
    1. Actual power P = V * I is computed.
    2. ML model predicts expected power.
    3. Prediction is recorded with residual = actual - predicted.
    4. Hardware health score is calculated and recorded.
    """
    now = datetime.now(timezone.utc)
    test_device = "TEST-HW-NODE-01"
    payload = {
        "device_id": test_device,
        "timestamp": now.isoformat(),
        "voltage_v": 18.0,
        "current_a": 2.5,
        "temperature_c": 28.0,
        "irradiance_w_m2": 800.0,
        "firmware_version": "1.0.0-hw",
    }
    res = client.post("/api/v1/telemetry", json=payload)
    assert res.status_code == status.HTTP_201_CREATED
    data = res.json()["data"]

    # Verify actual power
    assert data["power_w"] == 45.0  # 18.0 * 2.5

    # Verify predictions attached in response
    assert data["predicted_power_w"] is not None
    assert data["residual"] is not None
    assert round(data["power_w"] - data["predicted_power_w"], 2) == data["residual"]

    # Verify database persistence in predictions table
    pred = (
        db_session.query(Prediction)
        .filter(Prediction.device_id == test_device)
        .order_by(Prediction.timestamp.desc())
        .first()
    )
    assert pred is not None
    assert pred.actual_value == 45.0
    assert pred.predicted_value == data["predicted_power_w"]
    assert pred.residual == data["residual"]

    # Verify database persistence in health_scores table
    health = (
        db_session.query(HealthScore)
        .filter(HealthScore.device_id == test_device)
        .order_by(HealthScore.timestamp.desc())
        .first()
    )
    assert health is not None
    assert 0.0 <= health.overall_score <= 100.0
    assert health.electrical_health > 0.0
    assert health.thermal_health > 0.0
    assert health.photovoltaic_health > 0.0


def test_step8_demo_telemetry_isolation(client, db_session):
    """
    Verify DEMO telemetry packets are strictly isolated from real hardware:
    1. Flagged with data_quality='DEMO'
    2. Discarded by validate_telemetry_record (excluded from ML dataset)
    """
    res = client.post("/api/v1/telemetry/demo-test?device_id=DEMO-TEST-UNIT")
    assert res.status_code == status.HTTP_201_CREATED
    data = res.json()["data"]
    assert data["data_quality"] == "DEMO"

    # Preprocessing rejection
    dummy_demo = {
        "voltage_v": 18.0,
        "current_a": 2.0,
        "temperature_c": 25.0,
        "irradiance_w_m2": 800.0,
        "power_w": 36.0,
        "data_quality": "DEMO",
    }
    assert validate_telemetry_record(dummy_demo) is False


def test_step8_get_latest_health_score(client):
    """Verify GET /api/v1/health-scores/{device_id}/latest returns valid evaluated score."""
    # First ingest a reading so the device exists in this isolated test database
    now = datetime.now(timezone.utc)
    test_device = "HEALTH-TEST-01"
    payload = {
        "device_id": test_device,
        "timestamp": now.isoformat(),
        "voltage_v": 18.5,
        "current_a": 2.2,
        "temperature_c": 30.0,
        "irradiance_w_m2": 750.0,
        "firmware_version": "1.0.0",
    }
    ingest_res = client.post("/api/v1/telemetry", json=payload)
    assert ingest_res.status_code == status.HTTP_201_CREATED

    res = client.get(f"/api/v1/health-scores/{test_device}/latest")
    assert res.status_code == status.HTTP_200_OK
    data = res.json()
    assert "overall_score" in data
    assert 10.0 <= data["overall_score"] <= 100.0
    assert "electrical_health" in data
    assert "thermal_health" in data
    assert "photovoltaic_health" in data
    assert "recommendation" in data
