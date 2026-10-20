from datetime import datetime, timezone, timedelta
from fastapi import status


def test_root_and_healthcheck(client):
    """Test service info and healthcheck endpoints."""
    res = client.get("/")
    assert res.status_code == status.HTTP_200_OK
    assert res.json()["status"] == "ONLINE"

    res_health = client.get("/health")
    assert res_health.status_code == status.HTTP_200_OK
    assert res_health.json()["status"] == "healthy"


def test_ingest_valid_telemetry_and_calculations(client):
    """Test valid ESP32 sensor telemetry ingestion, power and efficiency derivations."""
    t = (datetime.now(timezone.utc) - timedelta(minutes=5)).isoformat()
    payload = {
        "device_id": "SOLAR-ESP32-01",
        "timestamp": t,
        "voltage_v": 18.42,
        "current_a": 2.31,
        "temperature_c": 31.7,
        "irradiance_w_m2": 812.0
    }

    res = client.post("/api/v1/telemetry", json=payload)
    assert res.status_code == status.HTTP_201_CREATED
    data = res.json()["data"]

    # Verify echo and stored fields
    assert data["device_id"] == "SOLAR-ESP32-01"
    assert data["voltage_v"] == 18.42
    assert data["current_a"] == 2.31
    assert data["temperature_c"] == 31.7
    assert data["irradiance_w_m2"] == 812.0

    # Verify calculated power: 18.42 * 2.31 = 42.55 W
    expected_power = round(18.42 * 2.31, 2)
    assert data["power_w"] == expected_power

    # Verify calculated efficiency: (42.55 / (0.65 * 812.0)) * 100 = ~8.06%
    expected_eff = round((expected_power / (0.65 * 812.0)) * 100, 2)
    assert data["efficiency_pct"] == expected_eff
    assert data["is_anomaly"] is False


def test_duplicate_telemetry_handling(client):
    """Test duplicate record detection and 409 Conflict rejection."""
    t = (datetime.now(timezone.utc) - timedelta(minutes=10)).isoformat()
    payload = {
        "device_id": "SOLAR-ESP32-01",
        "timestamp": t,
        "voltage_v": 18.5,
        "current_a": 2.2,
        "temperature_c": 32.0,
        "irradiance_w_m2": 800.0
    }

    # First ingestion succeeds
    res1 = client.post("/api/v1/telemetry", json=payload)
    assert res1.status_code == status.HTTP_201_CREATED

    # Duplicate ingestion for same device_id and timestamp returns 409 Conflict
    res2 = client.post("/api/v1/telemetry", json=payload)
    assert res2.status_code == status.HTTP_409_CONFLICT
    assert "Duplicate telemetry record detected" in res2.json()["detail"]


def test_invalid_sensor_ranges(client):
    """Test validation errors for out-of-range sensor readings."""
    base_payload = {
        "device_id": "SOLAR-ESP32-01",
        "timestamp": "2026-10-20T12:20:00Z",
        "voltage_v": 18.0,
        "current_a": 2.0,
        "temperature_c": 30.0,
        "irradiance_w_m2": 800.0
    }

    # 1. Voltage too high (> 60V)
    p1 = {**base_payload, "voltage_v": 65.0}
    assert client.post("/api/v1/telemetry", json=p1).status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

    # 2. Negative voltage (< 0V)
    p2 = {**base_payload, "voltage_v": -1.5}
    assert client.post("/api/v1/telemetry", json=p2).status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

    # 3. Current exceeds max physical limit (> 30A)
    p3 = {**base_payload, "current_a": 35.0}
    assert client.post("/api/v1/telemetry", json=p3).status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

    # 4. Temperature too extreme (> 125°C)
    p4 = {**base_payload, "temperature_c": 130.0}
    assert client.post("/api/v1/telemetry", json=p4).status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

    # 5. Irradiance exceeds solar flux limit (> 2000 W/m²)
    p5 = {**base_payload, "irradiance_w_m2": 2500.0}
    assert client.post("/api/v1/telemetry", json=p5).status_code == status.HTTP_422_UNPROCESSABLE_ENTITY


def test_future_timestamp_validation(client):
    """Test rejection of future timestamps beyond clock drift margin."""
    distant_future = datetime.now(timezone.utc) + timedelta(hours=2)
    payload = {
        "device_id": "SOLAR-ESP32-01",
        "timestamp": distant_future.isoformat(),
        "voltage_v": 18.0,
        "current_a": 2.0,
        "temperature_c": 30.0,
        "irradiance_w_m2": 800.0
    }
    res = client.post("/api/v1/telemetry", json=payload)
    assert res.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
    assert "Timestamp cannot be in the future" in str(res.json())


def test_missing_timestamp_auto_assignment(client):
    """Test that missing timestamp defaults to current server UTC time."""
    payload = {
        "device_id": "SOLAR-ESP32-01",
        "voltage_v": 18.4,
        "current_a": 2.5,
        "temperature_c": 31.0,
        "irradiance_w_m2": 850.0
    }
    res = client.post("/api/v1/telemetry", json=payload)
    assert res.status_code == status.HTTP_201_CREATED
    data = res.json()["data"]
    assert data["timestamp"] is not None


def test_get_latest_and_history(client):
    """Test retrieving latest reading and historical queries."""
    now = datetime.now(timezone.utc) - timedelta(minutes=10)
    device_id = "SOLAR-ESP32-HISTORY"

    # Insert 3 chronological readings
    for i in range(3):
        t = now + timedelta(minutes=i)
        payload = {
            "device_id": device_id,
            "timestamp": t.isoformat(),
            "voltage_v": 18.0 + i,
            "current_a": 2.0,
            "temperature_c": 30.0,
            "irradiance_w_m2": 700.0
        }
        client.post("/api/v1/telemetry", json=payload)

    # 1. Latest reading
    res_latest = client.get(f"/api/v1/telemetry/latest/{device_id}")
    assert res_latest.status_code == status.HTTP_200_OK
    assert res_latest.json()["voltage_v"] == 20.0  # Last inserted

    # 2. History with limit
    res_hist = client.get(f"/api/v1/telemetry/history/{device_id}?limit=2")
    assert res_hist.status_code == status.HTTP_200_OK
    assert len(res_hist.json()) == 2


def test_dashboard_summary_endpoint(client):
    """Test dashboard aggregation endpoint."""
    device_id = "SOLAR-ESP32-DASH"
    payload = {
        "device_id": device_id,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "voltage_v": 18.5,
        "current_a": 4.0,
        "temperature_c": 35.0,
        "irradiance_w_m2": 900.0
    }
    client.post("/api/v1/telemetry", json=payload)

    res = client.get(f"/api/v1/telemetry/dashboard/{device_id}")
    assert res.status_code == status.HTTP_200_OK
    dash = res.json()
    assert dash["device_id"] == device_id
    assert dash["today_peak_power_w"] == round(18.5 * 4.0, 2)
    assert dash["status"] == "ONLINE"
    assert dash["current_reading"]["power_w"] == 74.0


def test_device_status_and_registration(client):
    """Test device registration and online heartbeat calculation."""
    device_payload = {
        "id": "SOLAR-ESP32-CUSTOM",
        "name": "Laboratory Panel B",
        "rated_power_w": 150.0,
        "panel_area_m2": 0.95,
        "temp_coeff": -0.0040
    }
    res_reg = client.post("/api/v1/devices", json=device_payload)
    assert res_reg.status_code == status.HTTP_201_CREATED
    assert res_reg.json()["name"] == "Laboratory Panel B"

    # Status before telemetry -> OFFLINE
    res_status = client.get("/api/v1/devices/SOLAR-ESP32-CUSTOM/status")
    assert res_status.status_code == status.HTTP_200_OK
    assert res_status.json()["status"] == "OFFLINE"

    # Ingest telemetry -> status changes to ONLINE
    client.post("/api/v1/telemetry", json={
        "device_id": "SOLAR-ESP32-CUSTOM",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "voltage_v": 19.0,
        "current_a": 5.0,
        "temperature_c": 30.0,
        "irradiance_w_m2": 950.0
    })

    res_status2 = client.get("/api/v1/devices/SOLAR-ESP32-CUSTOM/status")
    assert res_status2.json()["status"] == "ONLINE"
    assert res_status2.json()["is_reporting"] is True


def test_anomaly_detection_open_circuit(client):
    """Test automated flag for open circuit condition under bright sunlight."""
    payload = {
        "device_id": "SOLAR-ESP32-FAULT",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "voltage_v": 21.6,
        "current_a": 0.01,  # near zero current
        "temperature_c": 30.0,
        "irradiance_w_m2": 800.0  # high sun
    }
    res = client.post("/api/v1/telemetry", json=payload)
    assert res.status_code == status.HTTP_201_CREATED
    data = res.json()["data"]
    assert data["is_anomaly"] is True
    assert "Open Circuit" in data["anomaly_notes"]


def test_device_telemetry_stats_and_quality_audit(client):
    """Test device telemetry statistics, sensor diagnostics, and data quality metrics."""
    dev_id = "SOLAR-ESP32-STATS"
    
    # 1. Ingest 3 real readings
    for i in range(3):
        client.post("/api/v1/telemetry", json={
            "device_id": dev_id,
            "timestamp": (datetime.now(timezone.utc) - timedelta(seconds=i * 5)).isoformat(),
            "voltage_v": 18.5,
            "current_a": 2.4,
            "temperature_c": 32.0,
            "irradiance_w_m2": 820.0
        })

    # 2. Query stats
    res = client.get(f"/api/v1/devices/{dev_id}/telemetry-stats")
    assert res.status_code == status.HTTP_200_OK
    data = res.json()
    assert data["device_id"] == dev_id
    assert data["total_packets"] == 3
    assert data["valid_readings"] == 3
    assert data["real_valid_records"] == 3
    assert data["min_training_threshold"] == 10
    assert data["training_readiness"] == "INSUFFICIENT_DATA"
    assert "more valid packets required" in data["recommendation"]
    assert data["sensor_status"]["voltage"] == "Active"


def test_csv_export_telemetry(client):
    """Test exporting recorded telemetry as CSV."""
    dev_id = "SOLAR-ESP32-CSV"
    client.post("/api/v1/telemetry", json={
        "device_id": dev_id,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "voltage_v": 19.1,
        "current_a": 2.5,
        "temperature_c": 33.0,
        "irradiance_w_m2": 850.0
    })

    res = client.get(f"/api/v1/telemetry/export/csv?device_id={dev_id}")
    assert res.status_code == status.HTTP_200_OK
    assert "text/csv" in res.headers["content-type"]
    assert "voltage_v" in res.text
    assert "19.1" in res.text


def test_demo_test_packet_and_clear_isolation(client):
    """Test demo telemetry packet ingestion and safe clear without touching real data."""
    dev_id = "SOLAR-ESP32-DEMOTEST"

    # 1. Ingest real packet
    client.post("/api/v1/telemetry", json={
        "device_id": dev_id,
        "timestamp": (datetime.now(timezone.utc) - timedelta(minutes=10)).isoformat(),
        "voltage_v": 18.0,
        "current_a": 2.0,
        "temperature_c": 30.0,
        "irradiance_w_m2": 800.0
    })

    # 2. Ingest 2 demo test packets
    d1 = client.post("/api/v1/telemetry/demo-test", json={
        "device_id": dev_id,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "voltage_v": 18.5,
        "current_a": 2.3,
        "temperature_c": 31.0,
        "irradiance_w_m2": 810.0
    })
    assert d1.status_code == status.HTTP_201_CREATED
    assert d1.json()["data"]["data_quality"] == "DEMO"

    client.post("/api/v1/telemetry/demo-test")  # Auto-generated demo packet

    # 3. Check stats shows both real and demo
    stats_res = client.get(f"/api/v1/devices/{dev_id}/telemetry-stats")
    assert stats_res.json()["demo_records_count"] >= 1
    assert stats_res.json()["real_valid_records"] == 1  # Real data count strictly preserved!

    # 4. Clear demo data
    clear_res = client.delete(f"/api/v1/telemetry/demo?device_id={dev_id}")
    assert clear_res.status_code == status.HTTP_200_OK
    assert clear_res.json()["deleted_count"] >= 1

    # 5. Verify real data still exists
    stats_res2 = client.get(f"/api/v1/devices/{dev_id}/telemetry-stats")
    assert stats_res2.json()["demo_records_count"] == 0
    assert stats_res2.json()["real_valid_records"] == 1  # Real hardware packet was untouched!

