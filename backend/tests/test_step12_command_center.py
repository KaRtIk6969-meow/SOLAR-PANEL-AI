"""
Test suite for Step 12: SolarAI Command Center & Final Integration.
Verifies synchronized operations across telemetry, predictions, health, alerts,
analytics integration, and dashboard summary endpoints.
"""

import pytest
from datetime import datetime, timezone, timedelta
from fastapi import status
from app.models.sensor_reading import SensorReading
from app.models.prediction import Prediction
from app.models.health_score import HealthScore
from app.models.alert import Alert
from app.models.device import Device


def get_or_create_device(db_session, device_id: str):
    dev = db_session.query(Device).filter(Device.id == device_id).first()
    if not dev:
        dev = Device(
            id=device_id,
            name=f"Device {device_id}",
            location="Command Center Bench",
            rated_power_w=100.0,
            status="ONLINE",
            created_at=datetime.now(timezone.utc),
        )
        db_session.add(dev)
        db_session.commit()
    return dev


@pytest.fixture
def command_center_device(db_session):
    dev_id = "CMD-CENTER-NODE-01"
    get_or_create_device(db_session, dev_id)

    now = datetime.now(timezone.utc)
    # Seed 3 consecutive readings
    r1 = SensorReading(
        device_id=dev_id,
        timestamp=now - timedelta(minutes=2),
        voltage_v=18.4,
        current_a=2.3,
        temperature_c=29.5,
        irradiance_w_m2=810.0,
        power_w=42.32,
        efficiency_pct=15.1,
        data_quality="GOOD",
    )
    r2 = SensorReading(
        device_id=dev_id,
        timestamp=now - timedelta(minutes=1),
        voltage_v=18.5,
        current_a=2.35,
        temperature_c=30.0,
        irradiance_w_m2=820.0,
        power_w=43.48,
        efficiency_pct=15.3,
        data_quality="GOOD",
    )

    p1 = Prediction(
        device_id=dev_id,
        timestamp=now - timedelta(minutes=1),
        target="power_w",
        predicted_value=43.20,
        actual_value=43.48,
        residual=0.28,
        deviation_pct=0.65,
        model_version="xgb_v20261025_180246",
    )

    h1 = HealthScore(
        device_id=dev_id,
        timestamp=now - timedelta(minutes=1),
        overall_score=97.5,
        electrical_health=98.0,
        thermal_health=97.0,
        photovoltaic_health=97.5,
        recommendation="Nominal operations.",
    )

    db_session.add_all([r1, r2, p1, h1])
    db_session.commit()
    return dev_id


def test_command_center_dashboard_summary(client, command_center_device):
    """Verify GET /api/v1/telemetry/dashboard/{device_id} returns accurate integration."""
    dev_id = command_center_device
    res = client.get(f"/api/v1/telemetry/dashboard/{dev_id}")
    assert res.status_code == status.HTTP_200_OK
    data = res.json()

    assert data["device_id"] == dev_id
    assert data["status"] in ["ONLINE", "STALE", "OFFLINE"]
    assert data["current_reading"] is not None
    assert data["current_reading"]["power_w"] == 43.48
    assert data["today_energy_wh"] is not None
    assert data["today_peak_power_w"] == 43.48


def test_command_center_full_subsystem_synchronization(client, command_center_device):
    """Verify all command center endpoints return synchronized values for the device."""
    dev_id = command_center_device

    # 1. Device status
    res_status = client.get(f"/api/v1/devices/{dev_id}/status")
    assert res_status.status_code == status.HTTP_200_OK
    assert res_status.json()["device_id"] == dev_id

    # 2. Latest Telemetry
    res_tel = client.get(f"/api/v1/telemetry/latest/{dev_id}")
    assert res_tel.status_code == status.HTTP_200_OK
    assert res_tel.json()["power_w"] == 43.48

    # 3. Health
    res_health = client.get(f"/api/v1/health-scores/{dev_id}/latest")
    assert res_health.status_code == status.HTTP_200_OK
    assert res_health.json()["overall_score"] == 97.5

    # 4. Analytics Summary
    res_analytics = client.get(f"/api/v1/analytics/summary/{dev_id}?range=24h")
    assert res_analytics.status_code == status.HTTP_200_OK
    assert res_analytics.json()["total_samples"] == 2
    assert res_analytics.json()["max_power_w"] == 43.48

    # 5. AI Assistant Context
    res_ai = client.get(f"/api/v1/ai/context/{dev_id}")
    assert res_ai.status_code == status.HTTP_200_OK
    assert res_ai.json()["has_data"] is True
    assert res_ai.json()["current"]["power_w"] == 43.48
    assert res_ai.json()["ai"]["latest_predicted_power_w"] == 43.20


def test_command_center_offline_device(client):
    """Verify offline device returns null/clean state without fabrication."""
    dev_id = "OFFLINE-NODE-999"
    res = client.get(f"/api/v1/telemetry/dashboard/{dev_id}")
    assert res.status_code == status.HTTP_200_OK
    data = res.json()
    assert data["device_id"] == dev_id
    assert data["current_reading"] is None
    assert data["today_energy_wh"] == 0.0
