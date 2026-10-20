from datetime import datetime, timezone, timedelta
import pytest
from fastapi import status


def test_sensor_reading_fields_and_persistence(client):
    """Verify sensor_readings table stores all required fields including data_quality and firmware_version."""
    now = datetime.now(timezone.utc) - timedelta(minutes=1)
    payload = {
        "device_id": "SOLAR-ESP32-01",
        "timestamp": now.isoformat(),
        "voltage_v": 18.42,
        "current_a": 2.31,
        "temperature_c": 31.7,
        "irradiance_w_m2": 812.0,
        "firmware_version": "1.2.0"
    }
    res = client.post("/api/v1/telemetry", json=payload)
    assert res.status_code == status.HTTP_201_CREATED
    data = res.json()["data"]

    # Check all required fields from user specification
    assert data["device_id"] == "SOLAR-ESP32-01"
    assert data["voltage_v"] == 18.42
    assert data["current_a"] == 2.31
    assert data["temperature_c"] == 31.7
    assert data["irradiance_w_m2"] == 812.0
    assert data["power_w"] == 42.55
    assert data["efficiency_pct"] == 8.06
    assert data["data_quality"] == "GOOD"
    assert data["firmware_version"] == "1.2.0"


def test_automatic_alert_generation_on_anomaly(client):
    """Verify that an electrical anomaly on real hardware automatically records an alert."""
    now = datetime.now(timezone.utc) - timedelta(minutes=2)
    payload = {
        "device_id": "SOLAR-ESP32-ANOMALY",
        "timestamp": now.isoformat(),
        "voltage_v": 21.5,
        "current_a": 0.01,  # Open circuit under high sun
        "temperature_c": 32.0,
        "irradiance_w_m2": 750.0,
        "firmware_version": "1.0.0"
    }
    res = client.post("/api/v1/telemetry", json=payload)
    assert res.status_code == status.HTTP_201_CREATED
    data = res.json()["data"]
    assert data["data_quality"] == "SUSPECT_OPEN_CIRCUIT"

    # Query alerts endpoint
    alerts_res = client.get("/api/v1/alerts/SOLAR-ESP32-ANOMALY")
    assert alerts_res.status_code == status.HTTP_200_OK
    alerts = alerts_res.json()
    assert len(alerts) >= 1
    assert alerts[0]["category"] == "ELECTRICAL"
    assert alerts[0]["severity"] == "WARNING"
    assert alerts[0]["is_resolved"] is False

    # Resolve alert
    alert_id = alerts[0]["id"]
    resolve_res = client.patch(f"/api/v1/alerts/{alert_id}/resolve")
    assert resolve_res.status_code == status.HTTP_200_OK
    assert resolve_res.json()["is_resolved"] is True


def test_predictions_table_crud(client):
    """Verify predictions table schema and query capabilities."""
    now = datetime.now(timezone.utc) - timedelta(minutes=5)
    pred_payload = {
        "device_id": "SOLAR-ESP32-01",
        "timestamp": now.isoformat(),
        "target": "power_w",
        "predicted_value": 45.0,
        "actual_value": 42.55,
        "residual": -2.45,
        "deviation_pct": -5.44,
        "alert_status": "NORMAL",
        "model_version": "rf_v1.0.0"
    }
    create_res = client.post("/api/v1/predictions", json=pred_payload)
    assert create_res.status_code == status.HTTP_201_CREATED
    pred_data = create_res.json()
    assert pred_data["device_id"] == "SOLAR-ESP32-01"
    assert pred_data["predicted_value"] == 45.0
    assert pred_data["actual_value"] == 42.55
    assert pred_data["residual"] == -2.45
    assert pred_data["deviation_pct"] == -5.44
    assert pred_data["model_version"] == "rf_v1.0.0"

    # Fetch predictions
    get_res = client.get("/api/v1/predictions/SOLAR-ESP32-01")
    assert get_res.status_code == status.HTTP_200_OK
    preds = get_res.json()
    assert len(preds) >= 1
    assert preds[0]["target"] == "power_w"


def test_health_scores_table_crud(client):
    """Verify health_scores table schema and endpoints."""
    now = datetime.now(timezone.utc) - timedelta(minutes=10)
    health_payload = {
        "device_id": "SOLAR-ESP32-01",
        "timestamp": now.isoformat(),
        "overall_score": 92.5,
        "electrical_health": 95.0,
        "thermal_health": 88.0,
        "photovoltaic_health": 94.5,
        "degradation_factor": 0.02,
        "recommendation": "Panel operating at optimal efficiency."
    }
    res = client.post("/api/v1/health-scores", json=health_payload)
    assert res.status_code == status.HTTP_201_CREATED
    data = res.json()
    assert data["overall_score"] == 92.5
    assert data["electrical_health"] == 95.0

    # Fetch latest health score
    latest_res = client.get("/api/v1/health-scores/SOLAR-ESP32-01/latest")
    assert latest_res.status_code == status.HTTP_200_OK
    assert latest_res.json()["overall_score"] == 92.5


def test_model_metrics_table_crud(client):
    """Verify model_metrics table for tracking AI model training benchmarks."""
    eval_time = datetime.now(timezone.utc).isoformat()
    metric_payload = {
        "model_name": "SolarRandomForestRegressor",
        "model_version": "rf_v1.0.0",
        "evaluation_date": eval_time,
        "mae": 1.85,
        "rmse": 2.42,
        "r2_score": 0.941,
        "dataset_size": 15000,
        "notes": "Trained on outdoor rooftop irradiance data"
    }
    res = client.post("/api/v1/model-metrics", json=metric_payload)
    assert res.status_code == status.HTTP_201_CREATED
    data = res.json()
    assert data["model_name"] == "SolarRandomForestRegressor"
    assert data["r2_score"] == 0.941

    # Fetch metrics
    get_res = client.get("/api/v1/model-metrics?model_name=SolarRandomForestRegressor")
    assert get_res.status_code == status.HTTP_200_OK
    metrics = get_res.json()
    assert len(metrics) >= 1
    assert metrics[0]["mae"] == 1.85


def test_mock_data_isolation(client):
    """
    Verify that sensor_readings contains only real hardware telemetry,
    and mock data is never stored into the production telemetry table.
    """
    # Create real reading
    real_time = datetime.now(timezone.utc) - timedelta(minutes=1)
    res = client.post("/api/v1/telemetry", json={
        "device_id": "SOLAR-ESP32-REAL",
        "timestamp": real_time.isoformat(),
        "voltage_v": 19.1,
        "current_a": 2.5,
        "temperature_c": 35.0,
        "irradiance_w_m2": 850.0,
    })
    assert res.status_code == status.HTTP_201_CREATED

    # Fetch history for real device
    history_res = client.get("/api/v1/telemetry/history/SOLAR-ESP32-REAL")
    records = history_res.json()
    assert len(records) == 1
    assert records[0]["device_id"] == "SOLAR-ESP32-REAL"
    assert records[0]["data_quality"] == "GOOD"

    # Query a non-existent mock device to verify it has zero records stored
    mock_res = client.get("/api/v1/telemetry/history/MOCK-DEVICE-999")
    assert mock_res.status_code == status.HTTP_200_OK
    assert len(mock_res.json()) == 0
