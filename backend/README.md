# SolarAI - FastAPI Backend & PostgreSQL Persistence (Phase 2 & Phase 3)

Clean, production-grade telemetry ingestion, PostgreSQL persistence, and analytics backend for the **SolarAI** solar panel monitoring and AI efficiency prediction platform. Built with **FastAPI**, **Pydantic v2**, **SQLAlchemy 2.0**, and **Alembic**.

---

## 🏗️ Relational Database Schema (PostgreSQL)

Phase 3 introduces a robust relational schema tailored for high-frequency IoT time-series telemetry, hardware failure alerts, health scoring, and AI model benchmarking:

### 1. `devices`
Tracks solar photovoltaic nodes and microcontrollers (ESP32).
- `id` (VARCHAR(64), Primary Key): e.g. `SOLAR-ESP32-01`
- `name` (VARCHAR(128))
- `location` (VARCHAR(256), Nullable)
- `rated_power_w` (FLOAT, default: 100.0)
- `panel_area_m2` (FLOAT, default: 0.65)
- `temp_coeff` (FLOAT, default: -0.0038)
- `firmware_version` (VARCHAR(32), default: '1.0.0')
- `status` (VARCHAR(32), default: 'ONLINE') — `ONLINE`, `STALE`, `OFFLINE`
- `is_active` (BOOLEAN, default: True)
- `ip_address` (VARCHAR(45), Nullable)
- `last_seen_at` (TIMESTAMP WITH TIME ZONE, Nullable)
- `created_at` & `updated_at` (TIMESTAMP WITH TIME ZONE)

### 2. `sensor_readings` (Real Hardware Telemetry)
Persists physical sensor packets received directly from the ESP32.
- `id` (INTEGER, Autoincrement, Primary Key)
- `device_id` (VARCHAR(64), Foreign Key $\to$ `devices.id`, Indexed)
- `timestamp` (TIMESTAMP WITH TIME ZONE, Indexed)
- `voltage_v` (FLOAT): Array terminal voltage ($0.0 \le V \le 60.0$)
- `current_a` (FLOAT): Load current ($0.0 \le I \le 30.0$)
- `temperature_c` (FLOAT): Panel cell temperature ($-40.0 \le T \le 125.0$)
- `irradiance_w_m2` (FLOAT): Solar flux ($0.0 \le G \le 2000.0$)
- `power_w` (FLOAT): Instantaneous electrical power ($V \times I$)
- `efficiency_pct` (FLOAT, Nullable): Solar conversion efficiency
- `data_quality` (VARCHAR(32)): `GOOD`, `SUSPECT_OPEN_CIRCUIT`, `SUSPECT_SHORT_CIRCUIT`, `OVERHEATING`, `LOW_EFFICIENCY`
- `firmware_version` (VARCHAR(32), default: '1.0.0')
- `created_at` (TIMESTAMP WITH TIME ZONE)
- **Constraints & Indexes**:
  - `UNIQUE(device_id, timestamp)`: Deduplication guard
  - `INDEX(device_id, timestamp)`: Composite time-series query acceleration

### 3. `predictions` (AI Inference & Anomaly Triage)
Stores forecasted power/efficiency against actual telemetry to evaluate model accuracy and detect performance drift.
- `id` (INTEGER, Autoincrement, Primary Key)
- `device_id` (VARCHAR(64), Foreign Key $\to$ `devices.id`, Indexed)
- `timestamp` (TIMESTAMP WITH TIME ZONE, Indexed)
- `target` (VARCHAR(64), default: 'power_w')
- `predicted_value` (FLOAT): AI model predicted power (Watts)
- `actual_value` (FLOAT, Nullable): Real power recorded by sensor
- `residual` (FLOAT, Nullable): $P_{\text{actual}} - P_{\text{predicted}}$
- `deviation_pct` (FLOAT, Nullable): $\frac{P_{\text{actual}} - P_{\text{pred}}}{P_{\text{pred}}} \times 100\%$
- `alert_status` (VARCHAR(32), default: 'NORMAL'): `NORMAL`, `WARNING`, `CRITICAL`
- `model_version` (VARCHAR(64), default: 'rf_v1.0.0')
- `created_at` (TIMESTAMP WITH TIME ZONE)
- **Indexes**: `INDEX(device_id, timestamp)`

### 4. `alerts` (Diagnostic & Alarm Events)
Persistent record of hardware failure modes, thermal overshoots, and anomalous generation drops.
- `id` (INTEGER, Autoincrement, Primary Key)
- `device_id` (VARCHAR(64), Foreign Key $\to$ `devices.id`, Indexed)
- `timestamp` (TIMESTAMP WITH TIME ZONE, Indexed)
- `severity` (VARCHAR(32)): `INFO`, `WARNING`, `CRITICAL`
- `category` (VARCHAR(64)): `ELECTRICAL`, `THERMAL`, `EFFICIENCY`, `ANOMALY`, `CONNECTIVITY`
- `message` (TEXT)
- `is_resolved` (BOOLEAN, default: False)
- `resolved_at` (TIMESTAMP WITH TIME ZONE, Nullable)
- `created_at` (TIMESTAMP WITH TIME ZONE)
- **Indexes**: `INDEX(device_id, timestamp)`, `INDEX(is_resolved, severity)`

### 5. `health_scores` (Automated Panel Degradation & Health)
Multidimensional condition evaluations computed from long-term sensor trends.
- `id` (INTEGER, Autoincrement, Primary Key)
- `device_id` (VARCHAR(64), Foreign Key $\to$ `devices.id`, Indexed)
- `timestamp` (TIMESTAMP WITH TIME ZONE, Indexed)
- `overall_score` (FLOAT, 0-100)
- `electrical_health` (FLOAT, 0-100)
- `thermal_health` (FLOAT, 0-100)
- `photovoltaic_health` (FLOAT, 0-100)
- `degradation_factor` (FLOAT, default: 0.0)
- `recommendation` (TEXT, Nullable)
- `created_at` (TIMESTAMP WITH TIME ZONE)
- **Indexes**: `INDEX(device_id, timestamp)`

### 6. `model_metrics` (ML Training Benchmarks)
Historical tracking of machine learning model evaluations across datasets.
- `id` (INTEGER, Autoincrement, Primary Key)
- `model_name` (VARCHAR(128)): e.g. `SolarEfficiencyRandomForest`
- `model_version` (VARCHAR(64)): e.g. `rf_v1.0.0`
- `evaluation_date` (TIMESTAMP WITH TIME ZONE, Indexed)
- `mae` (FLOAT): Mean Absolute Error (Watts)
- `rmse` (FLOAT): Root Mean Squared Error (Watts)
- `r2_score` (FLOAT): Coefficient of Determination ($R^2$)
- `dataset_size` (INTEGER): Number of test samples
- `notes` (TEXT, Nullable)
- `created_at` (TIMESTAMP WITH TIME ZONE)

---

## 🔒 Separation of Real Hardware Data & Mock Data

- **Real Telemetry**: Only verified sensor packets received at `POST /api/v1/telemetry` are persisted into `sensor_readings`.
- **Quality Tracking**: Sensor readings are tagged with `data_quality` (`GOOD`, `SUSPECT_OPEN_CIRCUIT`, etc.) to track physical signal fidelity.
- **Mock Isolation**: The frontend dashboard mock-data system remains strictly isolated in `frontend/src/mock/`. Mock samples are **never** injected into the PostgreSQL telemetry tables.

---

## 🗄️ Database Migrations with Alembic

Alembic manages all schema revisions. The initial migration is located at `backend/alembic/versions/001_initial_phase3_schema.py`.

```powershell
cd backend

# Run all migrations up to latest
alembic upgrade head

# Rollback one migration
alembic downgrade -1
```

---

## 🐳 Spin up PostgreSQL with Docker

Run PostgreSQL 16 and pgAdmin with Docker Compose:

```powershell
# Start PostgreSQL & pgAdmin in the background
docker compose up -d

# Stop database services
docker compose down
```

- **PostgreSQL**: `localhost:5432` (`solarai_db` / `solarai_user` / `solarai_secure_password_2026`)
- **pgAdmin Web GUI**: [http://localhost:5050](http://localhost:5050) (`admin@solarai.local` / `admin_secure_password`)

---

## 📡 API Endpoints Reference

| Method | Route | Description |
|---|---|---|
| `POST` | `/api/v1/telemetry` | Ingests ESP32 sensor packet $\to$ `sensor_readings` |
| `GET` | `/api/v1/telemetry/latest/{device_id}` | Latest sensor reading |
| `GET` | `/api/v1/telemetry/history/{device_id}` | Time-series query with pagination |
| `GET` | `/api/v1/telemetry/dashboard/{device_id}`| Daily accumulated yield (Wh), peak power, avg efficiency |
| `GET` | `/api/v1/devices/{device_id}/status` | Heartbeat & connectivity triage (`ONLINE`, `STALE`, `OFFLINE`) |
| `GET` | `/api/v1/alerts/{device_id}` | System, electrical, and thermal alarms |
| `POST` | `/api/v1/alerts` | Log new alert |
| `PATCH`| `/api/v1/alerts/{alert_id}/resolve` | Resolve an active alarm |
| `GET` | `/api/v1/predictions/{device_id}` | Query AI predictions, residuals, and deviations |
| `POST` | `/api/v1/predictions` | Record AI inference output |
| `GET` | `/api/v1/health-scores/{device_id}` | Historical health evaluations |
| `GET` | `/api/v1/health-scores/{device_id}/latest`| Most recent panel health assessment |
| `POST` | `/api/v1/health-scores` | Record health score |
| `GET` | `/api/v1/model-metrics` | Historical AI model evaluation benchmarks ($R^2$, MAE, RMSE) |
| `POST` | `/api/v1/model-metrics` | Record new AI model evaluation run |
| `GET` | `/health` | Healthcheck and database connection status |
| `GET` | `/docs` | Interactive Swagger UI API documentation |

---

## 🧪 Automated Testing

Run the full pytest suite (16 tests covering all models, constraints, and endpoints):

```powershell
pytest backend/tests -v
```

Output:
```text
backend/tests/test_phase3_persistence.py::test_sensor_reading_fields_and_persistence PASSED [  6%]
backend/tests/test_phase3_persistence.py::test_automatic_alert_generation_on_anomaly PASSED [ 12%]
backend/tests/test_phase3_persistence.py::test_predictions_table_crud PASSED [ 18%]
backend/tests/test_phase3_persistence.py::test_health_scores_table_crud PASSED [ 25%]
backend/tests/test_phase3_persistence.py::test_model_metrics_table_crud PASSED [ 31%]
backend/tests/test_phase3_persistence.py::test_mock_data_isolation PASSED    [ 37%]
backend/tests/test_telemetry_api.py::test_root_and_healthcheck PASSED       [ 43%]
backend/tests/test_telemetry_api.py::test_ingest_valid_telemetry_and_calculations PASSED [ 50%]
backend/tests/test_telemetry_api.py::test_duplicate_telemetry_handling PASSED [ 56%]
backend/tests/test_telemetry_api.py::test_invalid_sensor_ranges PASSED      [ 62%]
backend/tests/test_telemetry_api.py::test_future_timestamp_validation PASSED [ 68%]
backend/tests/test_telemetry_api.py::test_missing_timestamp_auto_assignment PASSED [ 75%]
backend/tests/test_telemetry_api.py::test_get_latest_and_history PASSED     [ 81%]
backend/tests/test_telemetry_api.py::test_dashboard_summary_endpoint PASSED [ 87%]
backend/tests/test_telemetry_api.py::test_device_status_and_registration PASSED [ 93%]
backend/tests/test_telemetry_api.py::test_anomaly_detection_open_circuit PASSED [100%]
======================= 16 passed in 0.79s =======================
```
