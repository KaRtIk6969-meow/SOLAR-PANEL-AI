"""
Test suite for Step 10: Advanced Analytics & Visualization.
Verifies all analytics endpoints, calculations, aggregation, filtering,
prediction-actual alignment, numerical energy integration, and DEMO isolation.
"""

import pytest
from datetime import datetime, timezone, timedelta
from fastapi import status
from app.models.sensor_reading import SensorReading
from app.models.prediction import Prediction
from app.models.health_score import HealthScore
from app.models.device import Device
from app.services.analytics_service import calculate_energy_wh_integration, calculate_pearson_correlation


def get_or_create_device(db_session, device_id: str):
    dev = db_session.query(Device).filter(Device.id == device_id).first()
    if not dev:
        dev = Device(
            id=device_id,
            name=f"Device {device_id}",
            location="Lab Bench",
            rated_power_w=100.0,
            status="ONLINE",
            created_at=datetime.now(timezone.utc),
        )
        db_session.add(dev)
        db_session.commit()
    return dev


@pytest.fixture
def populated_analytics_device(db_session):
    """Seed test device with 10 real telemetry points and matching predictions/health scores."""
    dev_id = "ANALYTICS-DEV-01"
    get_or_create_device(db_session, dev_id)

    base_time = datetime.now(timezone.utc) - timedelta(hours=2)
    readings = []
    predictions = []
    health_scores = []

    for i in range(10):
        ts = base_time + timedelta(minutes=i * 5)
        # 18V, 2.0A -> 36.0W
        v = 18.0 + (i * 0.1)
        curr = 2.0 + (i * 0.05)
        pwr = round(v * curr, 2)
        temp = 25.0 + (i * 0.5)
        irr = 500.0 + (i * 30.0)
        eff = round((pwr / (irr * 0.25)) * 100.0, 2)

        sr = SensorReading(
            device_id=dev_id,
            timestamp=ts,
            voltage_v=v,
            current_a=curr,
            temperature_c=temp,
            irradiance_w_m2=irr,
            power_w=pwr,
            efficiency_pct=eff,
            data_quality="GOOD",
        )
        readings.append(sr)

        # AI Prediction: slight offset
        pred_pwr = round(pwr - 0.5, 2)
        pred = Prediction(
            device_id=dev_id,
            timestamp=ts,
            target="power_w",
            predicted_value=pred_pwr,
            actual_value=pwr,
            residual=round(pwr - pred_pwr, 2),
            deviation_pct=round(((pwr - pred_pwr) / pred_pwr) * 100, 2),
            model_version="xgb_test",
        )
        predictions.append(pred)

        hs = HealthScore(
            device_id=dev_id,
            timestamp=ts,
            overall_score=round(95.0 - i, 1),
            electrical_health=95.0,
            thermal_health=95.0,
            photovoltaic_health=95.0,
        )
        health_scores.append(hs)

    # Also add 1 DEMO reading to test exclusion
    demo_ts = base_time + timedelta(minutes=55)
    demo_sr = SensorReading(
        device_id=dev_id,
        timestamp=demo_ts,
        voltage_v=99.0,
        current_a=99.0,
        temperature_c=99.0,
        irradiance_w_m2=999.0,
        power_w=9801.0,
        efficiency_pct=99.0,
        data_quality="DEMO",
    )
    readings.append(demo_sr)

    db_session.add_all(readings)
    db_session.add_all(predictions)
    db_session.add_all(health_scores)
    db_session.commit()

    return dev_id


def test_numerical_energy_integration_units():
    """Verify trapezoidal integration calculates correct Wh over valid time intervals."""
    t0 = datetime(2026, 10, 25, 12, 0, 0, tzinfo=timezone.utc)
    t1 = datetime(2026, 10, 25, 12, 1, 0, tzinfo=timezone.utc)  # 60s
    t2 = datetime(2026, 10, 25, 12, 2, 0, tzinfo=timezone.utc)  # 60s
    t3 = datetime(2026, 10, 25, 13, 0, 0, tzinfo=timezone.utc)  # 3480s gap (exceeds 120s limit)

    r0 = SensorReading(timestamp=t0, power_w=60.0)
    r1 = SensorReading(timestamp=t1, power_w=60.0)
    r2 = SensorReading(timestamp=t2, power_w=60.0)
    r3 = SensorReading(timestamp=t3, power_w=60.0)

    # Interval 1: 60W * (60/3600) = 1 Wh
    # Interval 2: 60W * (60/3600) = 1 Wh
    # Interval 3: gap > 120s -> ignored
    # Total should be 2.0 Wh
    total_wh = calculate_energy_wh_integration([r0, r1, r2, r3], max_gap_sec=120.0)
    assert total_wh == 2.0


def test_pearson_correlation_calculation():
    """Verify Pearson r returns +1.0 for perfect positive correlation."""
    perfect_pairs = [(100.0, 10.0), (200.0, 20.0), (300.0, 30.0), (400.0, 40.0)]
    r = calculate_pearson_correlation(perfect_pairs)
    assert r == 1.0


def test_analytics_summary_endpoint(client, populated_analytics_device):
    """Verify GET /api/v1/analytics/summary/{device_id} returns accurate stats."""
    dev_id = populated_analytics_device
    res = client.get(f"/api/v1/analytics/summary/{dev_id}?range=24h")
    assert res.status_code == status.HTTP_200_OK
    data = res.json()

    assert data["device_id"] == dev_id
    assert data["total_samples"] == 10  # DEMO record excluded
    assert data["avg_power_w"] is not None
    assert data["max_power_w"] is not None
    assert data["min_power_w"] is not None
    assert data["total_energy_wh"] is not None
    assert data["avg_voltage_v"] is not None
    assert data["avg_current_a"] is not None
    assert data["avg_temperature_c"] is not None
    assert data["avg_irradiance_w_m2"] is not None
    assert data["health_score"] is not None
    # Verify DEMO 9801W power was NOT included in max_power_w
    assert data["max_power_w"] < 100.0


def test_analytics_timeseries_endpoint(client, populated_analytics_device):
    """Verify GET /api/v1/analytics/timeseries/{device_id} aligns predictions and residuals."""
    dev_id = populated_analytics_device
    res = client.get(f"/api/v1/analytics/timeseries/{dev_id}?range=24h&interval=auto")
    assert res.status_code == status.HTTP_200_OK
    data = res.json()

    assert data["device_id"] == dev_id
    assert data["total_points"] == 10
    points = data["points"]
    assert len(points) == 10

    first_pt = points[0]
    assert "timestamp" in first_pt
    assert first_pt["actual_power_w"] is not None
    assert first_pt["predicted_power_w"] is not None
    assert first_pt["residual_w"] is not None
    # residual = actual - predicted = 0.5
    assert abs(first_pt["residual_w"] - 0.5) < 0.05
    assert first_pt["voltage_v"] is not None
    assert first_pt["current_a"] is not None


def test_analytics_correlation_endpoint(client, populated_analytics_device):
    """Verify GET /api/v1/analytics/correlation/{device_id} returns pairs and Pearson r."""
    dev_id = populated_analytics_device
    res = client.get(f"/api/v1/analytics/correlation/{dev_id}?range=24h")
    assert res.status_code == status.HTTP_200_OK
    data = res.json()

    assert data["device_id"] == dev_id
    assert len(data["irradiance_vs_power"]) == 10
    assert len(data["temperature_vs_power"]) == 10
    assert data["correlation_irradiance_power"] is not None
    assert data["correlation_irradiance_power"] > 0.8  # Positive correlation


def test_analytics_performance_endpoint(client, populated_analytics_device):
    """Verify GET /api/v1/analytics/performance/{device_id} identifies best/worst periods."""
    dev_id = populated_analytics_device
    res = client.get(f"/api/v1/analytics/performance/{dev_id}?range=24h")
    assert res.status_code == status.HTTP_200_OK
    data = res.json()

    assert data["device_id"] == dev_id
    assert "model_name" in data
    assert "r2_score" in data
    assert data["best_period"] is not None
    assert data["best_period"]["power_w"] > 0.0
    assert data["best_period"]["predicted_power_w"] is not None
    assert data["worst_period"] is not None
    assert "residual_distribution" in data
    assert len(data["residual_distribution"]) > 0


def test_analytics_export_csv_endpoint(client, populated_analytics_device):
    """Verify GET /api/v1/analytics/export/{device_id} generates valid CSV."""
    dev_id = populated_analytics_device
    res = client.get(f"/api/v1/analytics/export/{dev_id}?range=24h&include_demo=false")
    assert res.status_code == status.HTTP_200_OK
    assert res.headers["content-type"].startswith("text/csv")
    csv_text = res.text

    lines = csv_text.strip().split("\r\n") if "\r\n" in csv_text else csv_text.strip().split("\n")
    assert len(lines) == 11  # 1 header + 10 data rows
    header = lines[0]
    assert "timestamp" in header
    assert "power_w" in header
    assert "predicted_power_w" in header
    assert "residual_w" in header
    assert "health_score" in header
    assert "data_quality" in header

    # Ensure DEMO is not in the exported rows
    assert "DEMO" not in csv_text


def test_analytics_invalid_device(client):
    """Verify analytics on an unknown device returns empty/clean responses, not 500 error."""
    unknown_id = "UNKNOWN-NONEXISTENT-999"
    res = client.get(f"/api/v1/analytics/summary/{unknown_id}?range=24h")
    assert res.status_code == status.HTTP_200_OK
    data = res.json()
    assert data["total_samples"] == 0
    assert data["avg_power_w"] is None
    assert data["health_score"] is None

    res_ts = client.get(f"/api/v1/analytics/timeseries/{unknown_id}?range=24h")
    assert res_ts.status_code == status.HTTP_200_OK
    assert res_ts.json()["total_points"] == 0

    res_perf = client.get(f"/api/v1/analytics/performance/{unknown_id}?range=24h")
    assert res_perf.status_code == status.HTTP_200_OK
    assert res_perf.json()["best_period"] is None


def test_analytics_time_filters(client, populated_analytics_device):
    """Verify 1h filter excludes older records while 24h/all includes them."""
    dev_id = populated_analytics_device
    # Readings were created 2 hours ago
    res_1h = client.get(f"/api/v1/analytics/summary/{dev_id}?range=1h")
    assert res_1h.status_code == status.HTTP_200_OK
    assert res_1h.json()["total_samples"] == 0

    res_24h = client.get(f"/api/v1/analytics/summary/{dev_id}?range=24h")
    assert res_24h.status_code == status.HTTP_200_OK
    assert res_24h.json()["total_samples"] == 10
