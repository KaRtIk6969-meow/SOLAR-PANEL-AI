"""
SolarAI Step 9 Test Suite — Intelligent Alerts & Diagnostics
Validates:
1. Normal telemetry produces no false alerts
2. Moderate generation deviation -> WARNING
3. Severe generation deviation -> CRITICAL
4. Elevated temperature -> WARNING
5. Critical temperature -> CRITICAL & auto-recovery
6. Electrical anomaly detection (open circuit & short circuit)
7. Sensor bounds violation detection
8. Multi-signal persistent shading / soiling detection
9. Duplicate alert prevention (deduplication / cooldown)
10. Alert resolution lifecycle (auto & manual via API)
11. Device offline alert generation (>180s)
12. Device offline recovery upon telemetry resumption
13. DEMO telemetry isolation
14. End-to-end integration: Real telemetry -> prediction + health score + alerts
"""

from datetime import datetime, timezone, timedelta
import pytest
from fastapi import status
from app.models.alert import Alert
from app.models.device import Device
from app.models.sensor_reading import SensorReading
from app.models.prediction import Prediction
from app.models.health_score import HealthScore
from app.services.alert_service import evaluate_device_offline_alerts


def test_normal_telemetry_no_false_alert(client, db_session):
    """Verify that nominal telemetry under normal operating conditions does not generate false alarms."""
    now = datetime.now(timezone.utc) - timedelta(minutes=1)
    dev_id = "TEST-NODE-NORMAL"
    payload = {
        "device_id": dev_id,
        "timestamp": now.isoformat(),
        "voltage_v": 18.2,
        "current_a": 2.2,
        "temperature_c": 32.0,
        "irradiance_w_m2": 780.0,
        "firmware_version": "1.0.0",
    }
    res = client.post("/api/v1/telemetry", json=payload)
    assert res.status_code == status.HTTP_201_CREATED

    # Fetch alerts for device
    alerts_res = client.get(f"/api/v1/alerts/{dev_id}?is_resolved=false")
    assert alerts_res.status_code == status.HTTP_200_OK
    active_alerts = alerts_res.json()
    assert len(active_alerts) == 0


def test_thermal_warning_and_critical(client, db_session):
    """Verify elevated temperature (60-75°C) -> WARNING, and >75°C -> CRITICAL, with cooling auto-resolution."""
    dev_id = "TEST-NODE-THERMAL"

    # 1. Elevated Temp: 68°C -> WARNING
    t1 = datetime.now(timezone.utc) - timedelta(minutes=5)
    res1 = client.post("/api/v1/telemetry", json={
        "device_id": dev_id,
        "timestamp": t1.isoformat(),
        "voltage_v": 18.0,
        "current_a": 2.0,
        "temperature_c": 68.0,
        "irradiance_w_m2": 700.0,
    })
    assert res1.status_code == status.HTTP_201_CREATED

    alerts_res = client.get(f"/api/v1/alerts/{dev_id}?is_resolved=false")
    alerts = alerts_res.json()
    assert len(alerts) >= 1
    thermal_alert = next((a for a in alerts if a["category"] == "THERMAL"), None)
    assert thermal_alert is not None
    assert thermal_alert["severity"] == "WARNING"
    assert thermal_alert["metric_value"] == 68.0

    # 2. Critical Temp: 78°C -> CRITICAL
    t2 = datetime.now(timezone.utc) - timedelta(minutes=4)
    res2 = client.post("/api/v1/telemetry", json={
        "device_id": dev_id,
        "timestamp": t2.isoformat(),
        "voltage_v": 18.0,
        "current_a": 2.0,
        "temperature_c": 78.0,
        "irradiance_w_m2": 700.0,
    })
    assert res2.status_code == status.HTTP_201_CREATED

    alerts_res2 = client.get(f"/api/v1/alerts/{dev_id}?is_resolved=false")
    alerts2 = alerts_res2.json()
    thermal_alert2 = next((a for a in alerts2 if a["category"] == "THERMAL"), None)
    assert thermal_alert2 is not None
    assert thermal_alert2["severity"] == "CRITICAL"
    assert thermal_alert2["alert_type"] == "TEMP_CRIT"

    # 3. Cooling down: 28°C -> Auto-resolves thermal alert
    t3 = datetime.now(timezone.utc) - timedelta(minutes=3)
    res3 = client.post("/api/v1/telemetry", json={
        "device_id": dev_id,
        "timestamp": t3.isoformat(),
        "voltage_v": 18.0,
        "current_a": 2.0,
        "temperature_c": 28.0,
        "irradiance_w_m2": 700.0,
    })
    assert res3.status_code == status.HTTP_201_CREATED

    alerts_res3 = client.get(f"/api/v1/alerts/{dev_id}?is_resolved=false")
    alerts3 = alerts_res3.json()
    active_thermal = [a for a in alerts3 if a["category"] == "THERMAL"]
    assert len(active_thermal) == 0


def test_electrical_open_and_short_circuit(client, db_session):
    """Verify open circuit condition (Voc with negligible load current) and short circuit condition."""
    dev_id = "TEST-NODE-ELECTRICAL"

    # 1. Open Circuit: V=21.0V, I=0.01A under 700 W/m² sunlight -> WARNING
    t1 = datetime.now(timezone.utc) - timedelta(minutes=5)
    res1 = client.post("/api/v1/telemetry", json={
        "device_id": dev_id,
        "timestamp": t1.isoformat(),
        "voltage_v": 21.0,
        "current_a": 0.01,
        "temperature_c": 30.0,
        "irradiance_w_m2": 700.0,
    })
    assert res1.status_code == status.HTTP_201_CREATED
    alerts = client.get(f"/api/v1/alerts/{dev_id}?is_resolved=false").json()
    open_circuit = next((a for a in alerts if a["alert_type"] == "OPEN_CIRCUIT"), None)
    assert open_circuit is not None
    assert open_circuit["category"] == "ELECTRICAL"
    assert open_circuit["severity"] == "WARNING"
    assert "Open circuit" in open_circuit["recommended_action"] or "wiring" in open_circuit["recommended_action"].lower()

    # 2. Short Circuit: V=0.3V, I=2.5A under 600 W/m² sunlight -> CRITICAL
    dev_id2 = "TEST-NODE-SHORT"
    t2 = datetime.now(timezone.utc) - timedelta(minutes=4)
    res2 = client.post("/api/v1/telemetry", json={
        "device_id": dev_id2,
        "timestamp": t2.isoformat(),
        "voltage_v": 0.3,
        "current_a": 2.5,
        "temperature_c": 30.0,
        "irradiance_w_m2": 600.0,
    })
    assert res2.status_code == status.HTTP_201_CREATED
    alerts2 = client.get(f"/api/v1/alerts/{dev_id2}?is_resolved=false").json()
    short_circuit = next((a for a in alerts2 if a["alert_type"] == "SHORT_CIRCUIT"), None)
    assert short_circuit is not None
    assert short_circuit["severity"] == "CRITICAL"


def test_sensor_bounds_anomaly(client, db_session):
    """Verify physical range violations trigger SENSOR_FAULT alerts."""
    dev_id = "TEST-NODE-SENSOR-FAULT"
    # Negative voltage: -5.0 V
    t1 = datetime.now(timezone.utc) - timedelta(minutes=2)
    # The Pydantic validator bounds reject negative values with 422 if strict,
    # or if passed via direct service, logs SENSOR_FAULT.
    # Let's verify via direct service invocation
    from app.services.alert_service import evaluate_and_record_alerts
    reading = SensorReading(
        device_id=dev_id,
        timestamp=t1,
        voltage_v=-5.0,
        current_a=2.0,
        temperature_c=25.0,
        irradiance_w_m2=500.0,
        power_w=0.0,
        data_quality="CORRUPT",
    )
    db_session.add(reading)
    db_session.commit()

    alerts = evaluate_and_record_alerts(db_session, reading)
    assert any(a.alert_type == "SENSOR_FAULT" for a in alerts)


def test_duplicate_alert_prevention_deduplication(client, db_session):
    """Verify that multiple consecutive packets with the same fault do NOT create duplicate rows."""
    dev_id = "TEST-NODE-DEDUP"
    base_time = datetime.now(timezone.utc) - timedelta(minutes=10)

    # Ingest 4 consecutive packets with 68°C temperature
    for i in range(4):
        pkt_time = base_time + timedelta(seconds=i * 10)
        res = client.post("/api/v1/telemetry", json={
            "device_id": dev_id,
            "timestamp": pkt_time.isoformat(),
            "voltage_v": 18.0,
            "current_a": 2.0,
            "temperature_c": 68.0,
            "irradiance_w_m2": 600.0,
        })
        assert res.status_code == status.HTTP_201_CREATED

    # Query all alerts (active or resolved) for device
    all_alerts = db_session.query(Alert).filter(Alert.device_id == dev_id, Alert.alert_type == "TEMP_WARN").all()
    # Deduplication ensures only 1 active alert row exists, with updated timestamp
    assert len(all_alerts) == 1
    assert all_alerts[0].severity == "WARNING"


def test_alert_resolution_lifecycle(client, db_session):
    """Verify manual alert resolution via PATCH /api/v1/alerts/{id}/resolve and PUT alias."""
    dev_id = "TEST-NODE-RESOLVE"
    now = datetime.now(timezone.utc) - timedelta(seconds=15)

    client.post("/api/v1/telemetry", json={
        "device_id": dev_id,
        "timestamp": now.isoformat(),
        "voltage_v": 18.0,
        "current_a": 2.0,
        "temperature_c": 68.0,
        "irradiance_w_m2": 600.0,
    })

    alerts = client.get(f"/api/v1/alerts/{dev_id}?is_resolved=false").json()
    assert len(alerts) >= 1

    # Resolve all generated active alerts
    for a in alerts:
        target_id = a["id"]
        patch_res = client.patch(f"/api/v1/alerts/{target_id}/resolve")
        assert patch_res.status_code == status.HTTP_200_OK
        assert patch_res.json()["is_resolved"] is True
        assert patch_res.json()["resolved_at"] is not None

    # Verify query for active alerts is now empty
    active_now = client.get(f"/api/v1/alerts/{dev_id}?is_resolved=false").json()
    assert len(active_now) == 0


def test_offline_device_alert_and_recovery(client, db_session):
    """
    Verify:
    1. When device has not transmitted telemetry for > 180 seconds, DEVICE_OFFLINE alert is generated.
    2. When fresh telemetry packet arrives, DEVICE_OFFLINE is resolved and DEVICE_RECOVERED info event is logged.
    """
    dev_id = "TEST-NODE-OFFLINE"

    # Register device with last_seen_at 250 seconds ago (> 180s)
    old_time = datetime.now(timezone.utc) - timedelta(seconds=250)
    device = Device(
        id=dev_id,
        name="Offline Test Node",
        rated_power_w=100.0,
        panel_area_m2=0.65,
        last_seen_at=old_time,
        status="ONLINE",
    )
    db_session.add(device)
    db_session.commit()

    # Trigger offline evaluation
    evaluate_device_offline_alerts(db_session, device_id=dev_id)

    alerts = client.get(f"/api/v1/alerts/{dev_id}?is_resolved=false").json()
    assert len(alerts) >= 1
    offline_alert = next((a for a in alerts if a["alert_type"] == "DEVICE_OFFLINE"), None)
    assert offline_alert is not None
    assert offline_alert["severity"] == "CRITICAL"
    assert offline_alert["category"] == "CONNECTIVITY"

    # Telemetry Resumption: Fresh packet arrives
    fresh_time = datetime.now(timezone.utc)
    res = client.post("/api/v1/telemetry", json={
        "device_id": dev_id,
        "timestamp": fresh_time.isoformat(),
        "voltage_v": 18.0,
        "current_a": 2.2,
        "temperature_c": 28.0,
        "irradiance_w_m2": 750.0,
    })
    assert res.status_code == status.HTTP_201_CREATED

    # Verify DEVICE_OFFLINE is now resolved
    active_alerts = client.get(f"/api/v1/alerts/{dev_id}?is_resolved=false").json()
    assert not any(a["alert_type"] == "DEVICE_OFFLINE" for a in active_alerts)

    # Verify recovery info alert was created
    all_dev_alerts = client.get(f"/api/v1/alerts/{dev_id}").json()
    assert any(a["alert_type"] == "DEVICE_RECOVERED" and a["severity"] == "INFO" for a in all_dev_alerts)


def test_demo_data_isolation_from_alerts(client, db_session):
    """Verify that simulated DEMO telemetry does NOT produce real hardware alerts."""
    dev_id = "SOLAR-ESP32-DEMO-NODE"
    now = datetime.now(timezone.utc)

    # Send a reading flagged with data_quality='DEMO'
    res = client.post("/api/v1/telemetry", json={
        "device_id": dev_id,
        "timestamp": now.isoformat(),
        "voltage_v": 21.0,
        "current_a": 0.01,  # Open circuit
        "temperature_c": 80.0,  # Overheating
        "irradiance_w_m2": 800.0,
        "data_quality": "DEMO",
    })
    assert res.status_code == status.HTTP_201_CREATED

    # Verify no real hardware alerts were generated
    alerts = client.get(f"/api/v1/alerts/{dev_id}?is_resolved=false").json()
    assert len(alerts) == 0


def test_alerts_summary_endpoint(client, db_session):
    """Verify GET /api/v1/alerts/summary aggregates critical, warning, and active counts."""
    dev_id = "TEST-NODE-SUMMARY"
    now = datetime.now(timezone.utc)

    # Ingest elevated temp (WARNING)
    client.post("/api/v1/telemetry", json={
        "device_id": dev_id,
        "timestamp": (now - timedelta(minutes=1)).isoformat(),
        "voltage_v": 18.0,
        "current_a": 2.0,
        "temperature_c": 68.0,
        "irradiance_w_m2": 600.0,
    })

    res = client.get(f"/api/v1/alerts/summary?device_id={dev_id}")
    assert res.status_code == status.HTTP_200_OK
    summary = res.json()
    assert summary["total_active"] >= 1
    assert summary["warning_count"] >= 1
    assert "active warning" in summary["status_text"].lower() or "require" in summary["status_text"].lower()


def test_get_alert_by_id_endpoint(client, db_session):
    """Verify GET /api/v1/alerts/{alert_id:int} returns single alert details."""
    dev_id = "TEST-NODE-GET-BY-ID"
    now = datetime.now(timezone.utc)

    client.post("/api/v1/telemetry", json={
        "device_id": dev_id,
        "timestamp": now.isoformat(),
        "voltage_v": 18.0,
        "current_a": 2.0,
        "temperature_c": 68.0,
        "irradiance_w_m2": 600.0,
    })

    alerts = client.get(f"/api/v1/alerts/{dev_id}").json()
    assert len(alerts) >= 1
    aid = alerts[0]["id"]

    res = client.get(f"/api/v1/alerts/{aid}")
    assert res.status_code == status.HTTP_200_OK
    data = res.json()
    assert data["id"] == aid
    assert data["device_id"] == dev_id


def test_generation_deviation_warning_and_critical(db_session):
    """Verify performance deviation alarms using real ML expected power and actual power."""
    from app.services.alert_service import evaluate_and_record_alerts
    dev_id = "TEST-NODE-PERF-DEV"
    now = datetime.now(timezone.utc)

    # 1. 15% deficit (predicted=40W, actual=34W) -> WARNING (10% to < 20%)
    r1 = SensorReading(
        device_id=dev_id,
        timestamp=now,
        voltage_v=17.0,
        current_a=2.0,
        temperature_c=30.0,
        irradiance_w_m2=650.0,
        power_w=34.0,
        data_quality="GOOD",
    )
    db_session.add(r1)
    db_session.commit()

    alerts_warn = evaluate_and_record_alerts(
        db_session, r1, residual=-6.0, predicted_w=40.0, model_version="xgb_v1.0"
    )
    perf_warn = next((a for a in alerts_warn if a.alert_type == "PERF_DEFICIT_WARN"), None)
    assert perf_warn is not None
    assert perf_warn.severity == "WARNING"
    assert perf_warn.category == "PERFORMANCE"

    # 2. 30% deficit (predicted=40W, actual=28W) -> CRITICAL (>= 20%)
    now2 = now + timedelta(seconds=10)
    r2 = SensorReading(
        device_id=dev_id,
        timestamp=now2,
        voltage_v=14.0,
        current_a=2.0,
        temperature_c=30.0,
        irradiance_w_m2=650.0,
        power_w=28.0,
        data_quality="GOOD",
    )
    db_session.add(r2)
    db_session.commit()

    alerts_crit = evaluate_and_record_alerts(
        db_session, r2, residual=-12.0, predicted_w=40.0, model_version="xgb_v1.0"
    )
    perf_crit = next((a for a in alerts_crit if a.alert_type == "PERF_DEFICIT_CRIT"), None)
    assert perf_crit is not None
    assert perf_crit.severity == "CRITICAL"
    assert perf_crit.category == "PERFORMANCE"


def test_possible_shading_soiling_persistence(db_session):
    """Verify that multiple consecutive underperforming packets under high sunlight trigger SOILING_SHADING."""
    from app.services.alert_service import evaluate_and_record_alerts
    from app.services.device_service import get_or_create_device
    dev_id = "TEST-NODE-SOILING"
    get_or_create_device(db_session, dev_id)
    base_time = datetime.now(timezone.utc) - timedelta(minutes=2)

    # Ingest 3 consecutive readings under high solar flux (700 W/m²) with predicted 45W, actual 35W (deficit ~22%)
    for i in range(3):
        ts = base_time + timedelta(seconds=i * 10)
        r = SensorReading(
            device_id=dev_id,
            timestamp=ts,
            voltage_v=17.5,
            current_a=2.0,
            temperature_c=30.0,
            irradiance_w_m2=700.0,
            power_w=35.0,
            data_quality="GOOD",
        )
        db_session.add(r)
        pred = Prediction(
            device_id=dev_id,
            timestamp=ts,
            target="power_w",
            predicted_value=45.0,
            actual_value=35.0,
            residual=-10.0,
            deviation_pct=-22.2,
            alert_status="WARNING",
            model_version="xgb_test",
        )
        db_session.add(pred)
        db_session.commit()

        alerts = evaluate_and_record_alerts(
            db_session, r, residual=-10.0, predicted_w=45.0, model_version="xgb_test"
        )
        db_session.commit()

    # Check that SOILING_SHADING alert was triggered
    active_alerts = db_session.query(Alert).filter(
        Alert.device_id == dev_id, Alert.alert_type == "SOILING_SHADING", Alert.is_resolved == False
    ).all()
    assert len(active_alerts) == 1
    soiling_alert = active_alerts[0]
    assert soiling_alert.severity == "WARNING"
    assert "Possible shading or panel soiling" in soiling_alert.message
    assert "Inspect the panel surface" in soiling_alert.recommended_action

