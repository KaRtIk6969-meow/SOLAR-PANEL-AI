"""
Test suite for Step 11: AI Solar Performance Assistant.
Verifies context generation, telemetry inclusion, active prediction/residual inclusion,
health evaluation inclusion, alert context, analytics aggregation,
DEMO data exclusion, invalid/empty device handling, API validation, and grounded responses.
"""

import pytest
from datetime import datetime, timezone, timedelta
from fastapi import status
from app.models.sensor_reading import SensorReading
from app.models.prediction import Prediction
from app.models.health_score import HealthScore
from app.models.alert import Alert
from app.models.device import Device
from app.services.ai_context_service import build_solar_ai_context
from app.services.ai_provider import GroundedSolarAIProvider


def get_or_create_device(db_session, device_id: str):
    dev = db_session.query(Device).filter(Device.id == device_id).first()
    if not dev:
        dev = Device(
            id=device_id,
            name=f"Device {device_id}",
            location="Lab Bench 11",
            rated_power_w=100.0,
            status="ONLINE",
            created_at=datetime.now(timezone.utc),
        )
        db_session.add(dev)
        db_session.commit()
    return dev


@pytest.fixture
def populated_ai_device(db_session):
    """Seed test device with real telemetry, predictions, health, and an alert."""
    dev_id = "AI-TEST-NODE-01"
    get_or_create_device(db_session, dev_id)

    now = datetime.now(timezone.utc)
    ts = now - timedelta(minutes=2)

    # 1. Real Telemetry
    sr = SensorReading(
        device_id=dev_id,
        timestamp=ts,
        voltage_v=18.5,
        current_a=2.3,
        temperature_c=32.4,
        irradiance_w_m2=820.0,
        power_w=42.55,
        efficiency_pct=15.2,
        data_quality="GOOD",
    )

    # 2. Prediction
    pred = Prediction(
        device_id=dev_id,
        timestamp=ts,
        target="power_w",
        predicted_value=42.54,
        actual_value=42.55,
        residual=0.01,
        deviation_pct=0.02,
        model_version="xgb_v20261025_180246",
    )

    # 3. Health Score
    hs = HealthScore(
        device_id=dev_id,
        timestamp=ts,
        overall_score=97.9,
        electrical_health=98.5,
        thermal_health=96.2,
        photovoltaic_health=99.0,
        recommendation="Panel array is operating at peak photovoltaic conversion.",
    )

    # 4. Active Alert
    alert = Alert(
        device_id=dev_id,
        timestamp=ts,
        severity="INFO",
        category="PERFORMANCE",
        alert_type="PERF_OPTIMAL",
        message="System operating nominally under direct sunlight.",
        metric_name="power_w",
        metric_value=42.55,
        expected_value=42.54,
        unit="W",
        recommended_action="No maintenance required.",
        is_resolved=False,
    )

    # 5. DEMO reading to test exclusion
    demo_sr = SensorReading(
        device_id=dev_id,
        timestamp=now - timedelta(minutes=1),
        voltage_v=99.0,
        current_a=99.0,
        temperature_c=99.0,
        irradiance_w_m2=999.0,
        power_w=9801.0,
        efficiency_pct=99.0,
        data_quality="DEMO",
    )

    db_session.add_all([sr, pred, hs, alert, demo_sr])
    db_session.commit()

    return dev_id


def test_context_generation_and_demo_exclusion(db_session, populated_ai_device):
    """Verify context builder extracts real metrics and excludes DEMO telemetry."""
    dev_id = populated_ai_device
    ctx = build_solar_ai_context(db_session, dev_id)

    assert ctx.device_id == dev_id
    assert ctx.has_data is True
    assert ctx.data_source == "REAL_HARDWARE"

    # Current telemetry verification
    assert ctx.current is not None
    assert ctx.current.power_w == 42.55  # NOT 9801.0 from DEMO
    assert ctx.current.voltage_v == 18.5
    assert ctx.current.current_a == 2.3
    assert ctx.current.temperature_c == 32.4
    assert ctx.current.irradiance_w_m2 == 820.0

    # AI context verification
    assert ctx.ai is not None
    assert ctx.ai.latest_predicted_power_w == 42.54
    assert ctx.ai.latest_actual_power_w == 42.55
    assert ctx.ai.latest_residual_w == 0.01

    # Health context verification
    assert ctx.health is not None
    assert ctx.health.overall_score == 97.9
    assert ctx.health.electrical_health == 98.5

    # Alerts verification
    assert len(ctx.alerts) == 1
    assert ctx.alerts[0].message == "System operating nominally under direct sunlight."


def test_missing_data_and_invalid_device(db_session):
    """Verify an unknown or empty device produces clean non-fabricated context."""
    unknown_id = "UNKNOWN-NODE-99"
    ctx = build_solar_ai_context(db_session, unknown_id)

    assert ctx.device_id == unknown_id
    assert ctx.has_data is False
    assert ctx.current.power_w is None
    assert ctx.current.voltage_v is None
    assert ctx.health is None
    assert len(ctx.alerts) == 0


def test_get_context_api_endpoint(client, populated_ai_device):
    """Verify GET /api/v1/ai/context/{device_id} returns 200 and valid JSON."""
    dev_id = populated_ai_device
    res = client.get(f"/api/v1/ai/context/{dev_id}")
    assert res.status_code == status.HTTP_200_OK
    data = res.json()

    assert data["device_id"] == dev_id
    assert data["has_data"] is True
    assert data["current"]["power_w"] == 42.55
    assert data["ai"]["latest_predicted_power_w"] == 42.54
    assert data["health"]["overall_score"] == 97.9


def test_chat_api_endpoint_current_performance(client, populated_ai_device):
    """Verify POST /api/v1/ai/chat answers performance question with grounded values."""
    dev_id = populated_ai_device
    payload = {
        "device_id": dev_id,
        "question": "How is my solar panel performing right now?",
    }
    res = client.post("/api/v1/ai/chat", json=payload)
    assert res.status_code == status.HTTP_200_OK
    data = res.json()

    assert data["grounded"] is True
    assert "42.55" in data["answer"]
    assert "42.54" in data["answer"] or "AI EXPECTED" in data["answer"]
    assert data["evidence"] is not None
    assert data["evidence"]["power_w"] == 42.55
    assert data["evidence"]["health_score"] == 97.9


def test_chat_api_endpoint_power_and_prediction(client, populated_ai_device):
    """Verify POST /api/v1/ai/chat answers power and prediction queries."""
    dev_id = populated_ai_device
    res_pwr = client.post("/api/v1/ai/chat", json={
        "device_id": dev_id,
        "question": "What is the current power output?",
    })
    assert res_pwr.status_code == status.HTTP_200_OK
    assert "42.55" in res_pwr.json()["answer"]

    res_pred = client.post("/api/v1/ai/chat", json={
        "device_id": dev_id,
        "question": "What does the AI predict?",
    })
    assert res_pred.status_code == status.HTTP_200_OK
    assert "42.54" in res_pred.json()["answer"] or "EXPECTED" in res_pred.json()["answer"]


def test_chat_api_endpoint_health_and_alerts(client, populated_ai_device):
    """Verify POST /api/v1/ai/chat answers health and alert questions."""
    dev_id = populated_ai_device
    res_health = client.post("/api/v1/ai/chat", json={
        "device_id": dev_id,
        "question": "What is the health score of my panel?",
    })
    assert res_health.status_code == status.HTTP_200_OK
    assert "97.9" in res_health.json()["answer"]

    res_alert = client.post("/api/v1/ai/chat", json={
        "device_id": dev_id,
        "question": "Do I have any active alerts or warnings?",
    })
    assert res_alert.status_code == status.HTTP_200_OK
    assert "System operating nominally" in res_alert.json()["answer"] or "ACTIVE ALERTS: 1" in res_alert.json()["answer"]


def test_chat_api_validation_empty_question(client, populated_ai_device):
    """Verify POST /api/v1/ai/chat rejects empty questions with 400."""
    dev_id = populated_ai_device
    res = client.post("/api/v1/ai/chat", json={
        "device_id": dev_id,
        "question": "   ",
    })
    assert res.status_code == status.HTTP_400_BAD_REQUEST


def test_chat_api_offline_device_no_fabrication(client):
    """Verify assistant does not invent values for an empty device."""
    empty_dev = "EMPTY-DEVICE-00"
    res = client.post("/api/v1/ai/chat", json={
        "device_id": empty_dev,
        "question": "How is my solar panel performing right now?",
    })
    assert res.status_code == status.HTTP_200_OK
    data = res.json()
    assert "No recorded telemetry available" in data["answer"] or "Offline" in data["answer"]
    assert data["evidence"]["power_w"] is None


def test_ai_status_endpoint(client):
    """Verify GET /api/v1/ai/status reports active provider and grounding rules."""
    res = client.get("/api/v1/ai/status")
    assert res.status_code == status.HTTP_200_OK
    data = res.json()
    assert data["status"] == "ready"
    assert "active_provider" in data
    assert len(data["grounding_rules"]) > 0
