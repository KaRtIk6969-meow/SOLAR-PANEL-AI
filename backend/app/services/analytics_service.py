"""
SolarAI Advanced Analytics Service (Step 10)
Calculates real-data metrics, timeseries aggregation, sensor correlations,
AI model benchmarks, and CSV exports derived directly from SQLite database records.
"""

from datetime import datetime, timezone, timedelta
from typing import Optional, List, Dict, Any, Tuple
import math
import io
import csv

from sqlalchemy.orm import Session
from sqlalchemy import func, desc, asc

from app.models.sensor_reading import SensorReading
from app.models.prediction import Prediction
from app.models.health_score import HealthScore
from app.models.alert import Alert
from ml.model_registry import default_registry
from app.schemas.analytics import (
    AnalyticsSummaryResponse,
    TimeseriesPoint,
    TimeseriesResponse,
    CorrelationPair,
    CorrelationResponse,
    ExtremePerformancePeriod,
    ResidualBin,
    PerformanceAnalyticsResponse,
)


def resolve_time_bounds(
    range_str: str = "24h",
    start_time: Optional[datetime] = None,
    end_time: Optional[datetime] = None,
) -> Tuple[Optional[datetime], Optional[datetime]]:
    """Resolves standard time filters into concrete start/end timestamps."""
    if start_time and end_time:
        return start_time, end_time

    now = datetime.now(timezone.utc)
    r = (range_str or "24h").lower()

    if r == "1h":
        return now - timedelta(hours=1), now
    elif r == "6h":
        return now - timedelta(hours=6), now
    elif r == "24h":
        return now - timedelta(hours=24), now
    elif r == "7d":
        return now - timedelta(days=7), now
    elif r == "30d":
        return now - timedelta(days=30), now
    elif r == "all":
        return None, None
    else:
        return now - timedelta(hours=24), now


def calculate_energy_wh_integration(readings: List[SensorReading], max_gap_sec: float = 120.0) -> float:
    """
    Numerically integrates electric energy (Wh) over actual sample timestamps
    using trapezoidal intervals. Disregards periods where gaps exceed max_gap_sec
    to avoid fabricating energy yield during offline periods.
    """
    if len(readings) < 2:
        return 0.0

    sorted_readings = sorted(readings, key=lambda r: r.timestamp)
    total_wh = 0.0

    for i in range(1, len(sorted_readings)):
        r_prev = sorted_readings[i - 1]
        r_curr = sorted_readings[i]

        t_prev = r_prev.timestamp
        t_curr = r_curr.timestamp

        if t_prev.tzinfo is None:
            t_prev = t_prev.replace(tzinfo=timezone.utc)
        if t_curr.tzinfo is None:
            t_curr = t_curr.replace(tzinfo=timezone.utc)

        delta_sec = (t_curr - t_prev).total_seconds()

        # Only integrate valid continuous telemetry steps
        if 0.0 < delta_sec <= max_gap_sec:
            avg_pwr = (r_prev.power_w + r_curr.power_w) / 2.0
            segment_wh = avg_pwr * (delta_sec / 3600.0)
            total_wh += segment_wh

    return round(total_wh, 2)


def calculate_pearson_correlation(pairs: List[Tuple[float, float]]) -> Optional[float]:
    """Computes sample Pearson correlation coefficient r between two metrics."""
    if len(pairs) < 3:
        return None

    xs = [p[0] for p in pairs]
    ys = [p[1] for p in pairs]

    n = len(pairs)
    mean_x = sum(xs) / n
    mean_y = sum(ys) / n

    numerator = sum((x - mean_x) * (y - mean_y) for x, y in pairs)
    denom_x = sum((x - mean_x) ** 2 for x in xs)
    denom_y = sum((y - mean_y) ** 2 for y in ys)

    denom = math.sqrt(denom_x * denom_y)
    if denom == 0.0:
        return None

    r = numerator / denom
    return round(max(-1.0, min(1.0, r)), 3)


def get_analytics_summary(
    db: Session,
    device_id: str,
    range_str: str = "24h",
    start_time: Optional[datetime] = None,
    end_time: Optional[datetime] = None,
) -> AnalyticsSummaryResponse:
    """Computes comprehensive hardware and AI analytics summary for a device."""
    st, et = resolve_time_bounds(range_str, start_time, end_time)

    query = db.query(SensorReading).filter(
        SensorReading.device_id == device_id,
        SensorReading.data_quality != "DEMO",
    )
    if st:
        query = query.filter(SensorReading.timestamp >= st)
    if et:
        query = query.filter(SensorReading.timestamp <= et)

    readings = query.order_by(SensorReading.timestamp.asc()).all()

    if not readings:
        return AnalyticsSummaryResponse(
            device_id=device_id,
            time_range=range_str,
            start_time=st,
            end_time=et,
            total_samples=0,
        )

    # 1. Physical Generation & Sensor Metrics
    powers = [r.power_w for r in readings if r.power_w is not None]
    voltages = [r.voltage_v for r in readings if r.voltage_v is not None]
    currents = [r.current_a for r in readings if r.current_a is not None]
    temps = [r.temperature_c for r in readings if r.temperature_c is not None]
    irrads = [r.irradiance_w_m2 for r in readings if r.irradiance_w_m2 is not None]
    effs = [r.efficiency_pct for r in readings if r.efficiency_pct is not None]

    avg_pwr = round(sum(powers) / len(powers), 2) if powers else None
    max_pwr = max(powers) if powers else None
    min_pwr = min(powers) if powers else None

    avg_v = round(sum(voltages) / len(voltages), 2) if voltages else None
    max_v = max(voltages) if voltages else None
    min_v = min(voltages) if voltages else None

    avg_i = round(sum(currents) / len(currents), 2) if currents else None
    max_i = max(currents) if currents else None
    min_i = min(currents) if currents else None

    avg_t = round(sum(temps) / len(temps), 1) if temps else None
    max_t = max(temps) if temps else None
    min_t = min(temps) if temps else None

    avg_g = round(sum(irrads) / len(irrads), 1) if irrads else None
    max_g = max(irrads) if irrads else None
    min_g = min(irrads) if irrads else None

    avg_eff = round(sum(effs) / len(effs), 2) if effs else None

    # 2. Numerical Integration of Generated Energy (Wh)
    total_energy_wh = calculate_energy_wh_integration(readings)

    # 3. Model Benchmark Metadata
    meta = default_registry.get_active_model_metadata()
    ai_r2 = meta.get("r2_score") if meta else None
    ai_mae = meta.get("mae") if meta else None
    ai_rmse = meta.get("rmse") if meta else None

    # 4. Latest Health Score
    latest_health = (
        db.query(HealthScore)
        .filter(HealthScore.device_id == device_id)
        .order_by(HealthScore.timestamp.desc())
        .first()
    )
    health_score_val = round(latest_health.overall_score, 1) if latest_health else None

    # 5. Active Alerts Count
    active_alerts = (
        db.query(Alert)
        .filter(Alert.device_id == device_id, Alert.is_resolved == False)
        .all()
    )
    active_alerts_count = len(active_alerts)
    critical_alerts_count = sum(1 for a in active_alerts if a.severity.upper() == "CRITICAL")

    return AnalyticsSummaryResponse(
        device_id=device_id,
        time_range=range_str,
        start_time=st,
        end_time=et,
        total_samples=len(readings),
        avg_power_w=avg_pwr,
        max_power_w=max_pwr,
        min_power_w=min_pwr,
        total_energy_wh=total_energy_wh,
        avg_voltage_v=avg_v,
        max_voltage_v=max_v,
        min_voltage_v=min_v,
        avg_current_a=avg_i,
        max_current_a=max_i,
        min_current_a=min_i,
        avg_temperature_c=avg_t,
        max_temperature_c=max_t,
        min_temperature_c=min_t,
        avg_irradiance_w_m2=avg_g,
        max_irradiance_w_m2=max_g,
        min_irradiance_w_m2=min_g,
        avg_efficiency_pct=avg_eff,
        ai_r2_score=ai_r2,
        ai_mae_w=ai_mae,
        ai_rmse_w=ai_rmse,
        health_score=health_score_val,
        active_alerts_count=active_alerts_count,
        critical_alerts_count=critical_alerts_count,
    )


def get_analytics_timeseries(
    db: Session,
    device_id: str,
    range_str: str = "24h",
    start_time: Optional[datetime] = None,
    end_time: Optional[datetime] = None,
    interval: str = "auto",
) -> TimeseriesResponse:
    """
    Returns downsampled or raw timeseries data points for charts.
    Hydrates predictions and residuals from the predictions table.
    """
    st, et = resolve_time_bounds(range_str, start_time, end_time)

    query = db.query(SensorReading).filter(
        SensorReading.device_id == device_id,
        SensorReading.data_quality != "DEMO",
    )
    if st:
        query = query.filter(SensorReading.timestamp >= st)
    if et:
        query = query.filter(SensorReading.timestamp <= et)

    readings = query.order_by(SensorReading.timestamp.asc()).all()

    if not readings:
        return TimeseriesResponse(
            device_id=device_id,
            time_range=range_str,
            interval=interval,
            total_points=0,
            points=[],
        )

    # Hydrate predictions map
    timestamps = [r.timestamp for r in readings]
    preds = (
        db.query(Prediction)
        .filter(Prediction.device_id == device_id, Prediction.timestamp.in_(timestamps))
        .all()
    )
    preds_map = {p.timestamp: p for p in preds}

    # Decide bucket size (auto downsampling if > 150 points)
    n = len(readings)
    bucket_size = 1
    if interval == "auto":
        if n > 600:
            bucket_size = 10
        elif n > 250:
            bucket_size = 4
        elif n > 120:
            bucket_size = 2
    elif interval == "5m":
        bucket_size = 5
    elif interval == "15m":
        bucket_size = 15
    elif interval == "1h":
        bucket_size = 60

    points: List[TimeseriesPoint] = []

    for i in range(0, n, bucket_size):
        chunk = readings[i : i + bucket_size]
        if not chunk:
            continue

        mid_idx = len(chunk) // 2
        ts = chunk[mid_idx].timestamp

        pwr_vals = [r.power_w for r in chunk if r.power_w is not None]
        v_vals = [r.voltage_v for r in chunk if r.voltage_v is not None]
        i_vals = [r.current_a for r in chunk if r.current_a is not None]
        t_vals = [r.temperature_c for r in chunk if r.temperature_c is not None]
        g_vals = [r.irradiance_w_m2 for r in chunk if r.irradiance_w_m2 is not None]
        eff_vals = [r.efficiency_pct for r in chunk if r.efficiency_pct is not None]

        chunk_preds = [preds_map.get(r.timestamp) for r in chunk if r.timestamp in preds_map]
        pred_vals = [p.predicted_value for p in chunk_preds if p is not None and p.predicted_value is not None]
        res_vals = [p.residual for p in chunk_preds if p is not None and p.residual is not None]

        pwr_avg = round(sum(pwr_vals) / len(pwr_vals), 2) if pwr_vals else None
        pred_avg = round(sum(pred_vals) / len(pred_vals), 2) if pred_vals else None
        res_avg = round(sum(res_vals) / len(res_vals), 2) if res_vals else (
            round(pwr_avg - pred_avg, 2) if pwr_avg is not None and pred_avg is not None else None
        )

        pt = TimeseriesPoint(
            timestamp=ts,
            actual_power_w=pwr_avg,
            predicted_power_w=pred_avg,
            residual_w=res_avg,
            voltage_v=round(sum(v_vals) / len(v_vals), 2) if v_vals else None,
            current_a=round(sum(i_vals) / len(i_vals), 2) if i_vals else None,
            temperature_c=round(sum(t_vals) / len(t_vals), 1) if t_vals else None,
            irradiance_w_m2=round(sum(g_vals) / len(g_vals), 1) if g_vals else None,
            efficiency_pct=round(sum(eff_vals) / len(eff_vals), 2) if eff_vals else None,
            sample_count=len(chunk),
        )
        points.append(pt)

    return TimeseriesResponse(
        device_id=device_id,
        time_range=range_str,
        interval=f"bucket_{bucket_size}" if bucket_size > 1 else "raw",
        total_points=len(points),
        points=points,
    )


def get_analytics_correlation(
    db: Session,
    device_id: str,
    range_str: str = "24h",
    start_time: Optional[datetime] = None,
    end_time: Optional[datetime] = None,
) -> CorrelationResponse:
    """Computes correlation pairs and Pearson coefficients for environmental analytics."""
    st, et = resolve_time_bounds(range_str, start_time, end_time)

    query = db.query(SensorReading).filter(
        SensorReading.device_id == device_id,
        SensorReading.data_quality != "DEMO",
    )
    if st:
        query = query.filter(SensorReading.timestamp >= st)
    if et:
        query = query.filter(SensorReading.timestamp <= et)

    readings = query.order_by(SensorReading.timestamp.asc()).all()

    irr_power_pairs: List[CorrelationPair] = []
    temp_power_pairs: List[CorrelationPair] = []
    temp_eff_pairs: List[CorrelationPair] = []

    irr_power_raw: List[Tuple[float, float]] = []
    temp_power_raw: List[Tuple[float, float]] = []
    temp_eff_raw: List[Tuple[float, float]] = []

    # Downsample correlation scatter points to max 150 items to keep SVG rendering fast
    step = max(1, len(readings) // 150) if len(readings) > 150 else 1

    for idx, r in enumerate(readings):
        # Accumulate raw pairs for statistical Pearson r across ALL valid data
        if r.irradiance_w_m2 is not None and r.power_w is not None:
            irr_power_raw.append((r.irradiance_w_m2, r.power_w))
        if r.temperature_c is not None and r.power_w is not None:
            temp_power_raw.append((r.temperature_c, r.power_w))
        if r.temperature_c is not None and r.efficiency_pct is not None:
            temp_eff_raw.append((r.temperature_c, r.efficiency_pct))

        # Sample scatter plot items
        if idx % step == 0:
            if r.irradiance_w_m2 is not None and r.power_w is not None:
                irr_power_pairs.append(CorrelationPair(x=r.irradiance_w_m2, y=r.power_w, timestamp=r.timestamp))
            if r.temperature_c is not None and r.power_w is not None:
                temp_power_pairs.append(CorrelationPair(x=r.temperature_c, y=r.power_w, timestamp=r.timestamp))
            if r.temperature_c is not None and r.efficiency_pct is not None:
                temp_eff_pairs.append(CorrelationPair(x=r.temperature_c, y=r.efficiency_pct, timestamp=r.timestamp))

    r_irr_pwr = calculate_pearson_correlation(irr_power_raw)
    r_temp_pwr = calculate_pearson_correlation(temp_power_raw)
    r_temp_eff = calculate_pearson_correlation(temp_eff_raw)

    return CorrelationResponse(
        device_id=device_id,
        time_range=range_str,
        irradiance_vs_power=irr_power_pairs,
        temperature_vs_power=temp_power_pairs,
        temperature_vs_efficiency=temp_eff_pairs,
        correlation_irradiance_power=r_irr_pwr,
        correlation_temp_power=r_temp_pwr,
        correlation_temp_efficiency=r_temp_eff,
    )


def get_analytics_performance(
    db: Session,
    device_id: str,
    range_str: str = "24h",
    start_time: Optional[datetime] = None,
    end_time: Optional[datetime] = None,
) -> PerformanceAnalyticsResponse:
    """
    Computes AI model performance, residual histogram distribution,
    and identifies real best & worst performance periods.
    """
    st, et = resolve_time_bounds(range_str, start_time, end_time)

    query = db.query(SensorReading).filter(
        SensorReading.device_id == device_id,
        SensorReading.data_quality != "DEMO",
    )
    if st:
        query = query.filter(SensorReading.timestamp >= st)
    if et:
        query = query.filter(SensorReading.timestamp <= et)

    readings = query.order_by(SensorReading.timestamp.asc()).all()

    # Model metadata
    meta = default_registry.get_active_model_metadata() or {}
    model_name = meta.get("model_name", "XGBoostRegressor")
    model_version = meta.get("model_version", "v1.0")
    r2_score = float(meta.get("r2_score", 0.95))
    mae_w = float(meta.get("mae", 0.15))
    rmse_w = float(meta.get("rmse", 0.30))
    train_samples = int(meta.get("train_size", 0))
    test_samples = int(meta.get("test_size", 0))
    dataset_samples = int(meta.get("dataset_size", len(readings)))

    if not readings:
        return PerformanceAnalyticsResponse(
            device_id=device_id,
            time_range=range_str,
            model_name=model_name,
            model_version=model_version,
            r2_score=r2_score,
            mae_w=mae_w,
            rmse_w=rmse_w,
            train_samples=train_samples,
            test_samples=test_samples,
            dataset_samples=dataset_samples,
            best_period=None,
            worst_period=None,
            residual_distribution=[],
        )

    timestamps = [r.timestamp for r in readings]
    preds = (
        db.query(Prediction)
        .filter(Prediction.device_id == device_id, Prediction.timestamp.in_(timestamps))
        .all()
    )
    preds_map = {p.timestamp: p for p in preds}

    health_records = (
        db.query(HealthScore)
        .filter(HealthScore.device_id == device_id, HealthScore.timestamp.in_(timestamps))
        .all()
    )
    health_map = {h.timestamp: h for h in health_records}

    alerts = (
        db.query(Alert)
        .filter(Alert.device_id == device_id)
        .order_by(Alert.timestamp.desc())
        .all()
    )
    alerts_map = {a.timestamp: a for a in alerts}

    # 1. Best Performance Period (Highest valid power)
    valid_readings = [r for r in readings if r.data_quality == "GOOD" and r.power_w is not None]
    best_period: Optional[ExtremePerformancePeriod] = None
    if valid_readings:
        best_r = max(valid_readings, key=lambda r: r.power_w)
        best_p = preds_map.get(best_r.timestamp)
        best_h = health_map.get(best_r.timestamp)
        best_period = ExtremePerformancePeriod(
            timestamp=best_r.timestamp,
            power_w=best_r.power_w,
            voltage_v=best_r.voltage_v,
            current_a=best_r.current_a,
            temperature_c=best_r.temperature_c,
            irradiance_w_m2=best_r.irradiance_w_m2,
            predicted_power_w=best_p.predicted_value if best_p else None,
            residual_w=best_p.residual if best_p else None,
            health_score=best_h.overall_score if best_h else None,
            alert_message=None,
        )

    # 2. Worst Performance Period (Significant deficit or lowest power under active sunlight G >= 100)
    sun_readings = [r for r in valid_readings if r.irradiance_w_m2 >= 100.0]
    worst_period: Optional[ExtremePerformancePeriod] = None
    if sun_readings:
        # Lowest power or largest negative residual
        def sort_worst_key(r: SensorReading):
            p = preds_map.get(r.timestamp)
            if p and p.residual is not None:
                return p.residual  # More negative is worse
            return r.power_w

        worst_r = min(sun_readings, key=sort_worst_key)
        worst_p = preds_map.get(worst_r.timestamp)
        worst_h = health_map.get(worst_r.timestamp)
        worst_alert = alerts_map.get(worst_r.timestamp)
        worst_period = ExtremePerformancePeriod(
            timestamp=worst_r.timestamp,
            power_w=worst_r.power_w,
            voltage_v=worst_r.voltage_v,
            current_a=worst_r.current_a,
            temperature_c=worst_r.temperature_c,
            irradiance_w_m2=worst_r.irradiance_w_m2,
            predicted_power_w=worst_p.predicted_value if worst_p else None,
            residual_w=worst_p.residual if worst_p else None,
            health_score=worst_h.overall_score if worst_h else None,
            alert_message=worst_alert.message if worst_alert else None,
        )

    # 3. Residual Histogram Distribution
    residuals = [p.residual for p in preds if p.residual is not None]
    residual_bins: List[ResidualBin] = []
    if residuals:
        bin_counts = {
            "<-2.0W": sum(1 for res in residuals if res < -2.0),
            "-2.0 to -0.5W": sum(1 for res in residuals if -2.0 <= res < -0.5),
            "-0.5 to +0.5W": sum(1 for res in residuals if -0.5 <= res <= 0.5),
            "+0.5 to +2.0W": sum(1 for res in residuals if 0.5 < res <= 2.0),
            "> +2.0W": sum(1 for res in residuals if res > 2.0),
        }
        residual_bins = [ResidualBin(range=k, count=v) for k, v in bin_counts.items()]

    return PerformanceAnalyticsResponse(
        device_id=device_id,
        time_range=range_str,
        model_name=model_name,
        model_version=model_version,
        r2_score=r2_score,
        mae_w=mae_w,
        rmse_w=rmse_w,
        train_samples=train_samples,
        test_samples=test_samples,
        dataset_samples=dataset_samples,
        best_period=best_period,
        worst_period=worst_period,
        residual_distribution=residual_bins,
    )


def export_analytics_csv(
    db: Session,
    device_id: str,
    range_str: str = "all",
    start_time: Optional[datetime] = None,
    end_time: Optional[datetime] = None,
    include_demo: bool = False,
) -> str:
    """Exports comprehensive telemetry, prediction, and health analytics as a CSV string."""
    st, et = resolve_time_bounds(range_str, start_time, end_time)

    query = db.query(SensorReading).filter(SensorReading.device_id == device_id)
    if not include_demo:
        query = query.filter(SensorReading.data_quality != "DEMO")
    if st:
        query = query.filter(SensorReading.timestamp >= st)
    if et:
        query = query.filter(SensorReading.timestamp <= et)

    readings = query.order_by(SensorReading.timestamp.asc()).all()

    timestamps = [r.timestamp for r in readings]
    preds = db.query(Prediction).filter(
        Prediction.device_id == device_id, Prediction.timestamp.in_(timestamps)
    ).all()
    preds_map = {p.timestamp: p for p in preds}

    health_records = db.query(HealthScore).filter(
        HealthScore.device_id == device_id, HealthScore.timestamp.in_(timestamps)
    ).all()
    health_map = {h.timestamp: h for h in health_records}

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "timestamp",
        "device_id",
        "voltage_v",
        "current_a",
        "temperature_c",
        "irradiance_w_m2",
        "power_w",
        "predicted_power_w",
        "residual_w",
        "efficiency_pct",
        "health_score",
        "data_quality",
    ])

    for r in readings:
        p = preds_map.get(r.timestamp)
        h = health_map.get(r.timestamp)
        ts_str = r.timestamp.isoformat() if r.timestamp else ""
        pred_w = round(p.predicted_value, 2) if p and p.predicted_value is not None else ""
        res_w = round(p.residual, 2) if p and p.residual is not None else ""
        h_score = round(h.overall_score, 1) if h and h.overall_score is not None else ""

        writer.writerow([
            ts_str,
            r.device_id,
            r.voltage_v,
            r.current_a,
            r.temperature_c,
            r.irradiance_w_m2,
            r.power_w,
            pred_w,
            res_w,
            r.efficiency_pct if r.efficiency_pct is not None else "",
            h_score,
            r.data_quality or "GOOD",
        ])

    return output.getvalue()
