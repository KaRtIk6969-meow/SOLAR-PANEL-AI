# SolarAI - FastAPI Backend (Phase 2)

Clean, production-grade telemetry ingestion and analytics backend for the **SolarAI** solar panel monitoring and AI efficiency prediction platform. Built with **FastAPI**, **Pydantic v2**, and **SQLAlchemy 2.0**.

---

## 🚀 Key Features

- **High-Throughput Telemetry Ingestion**: Securely receives sensor packets from ESP32 edge microcontrollers (`POST /api/v1/telemetry`).
- **Comprehensive Validation**:
  - Electrical bounds verification ($0 \le V \le 100\text{V}$, $0 \le I \le 50\text{A}$).
  - Environmental bounds verification ($-40^\circ\text{C} \le T \le 125^\circ\text{C}$, $0 \le G \le 2000\text{ W/m}^2$).
  - ISO 8601 UTC timestamp sanity checking (auto-assignment when missing, rejection of future timestamps).
- **Derived Metrics Calculation**:
  - Instantaneous electrical power: $P = V \times I$ (Watts).
  - Photovoltaic system efficiency: $\eta = \frac{P}{G \times A} \times 100\%$ where $G$ is irradiance and $A$ is active panel area ($0.65\text{ m}^2$ default).
- **Duplicate Record Prevention**: Database-level unique constraint (`uq_device_timestamp`) returning standard `409 Conflict`.
- **Instant Anomaly Flagging**: Heuristic rule-based detection for Open-Circuit ($V > 12\text{V}, I \approx 0\text{A}$), Short-Circuit ($I > 0\text{A}, V \approx 0\text{V}$), Overheating ($T > 65^\circ\text{C}$), and Low Efficiency ($\eta < 3\%$).
- **Aggregated Analytics & Status**:
  - Latest reading retrieval (`GET /api/v1/telemetry/latest/{device_id}`).
  - Historical time-series query with pagination (`GET /api/v1/telemetry/history/{device_id}`).
  - Live dashboard telemetry and accumulated energy yield in Watt-hours (`GET /api/v1/telemetry/dashboard/{device_id}`).
  - Hardware device heartbeat and connection triage (`ONLINE`, `STALE`, `OFFLINE`).
- **Interactive Documentation**: Auto-generated Swagger UI (`/docs`) and ReDoc (`/redoc`).
- **CORS Configured**: Ready out-of-the-box for Next.js frontend running on `http://localhost:3000` or `3001`.

---

## 🛠️ Tech Stack & Requirements

- **Python**: 3.10+ (tested on Python 3.12.10)
- **Framework**: FastAPI 0.115+
- **ASGI Server**: Uvicorn
- **Validation**: Pydantic v2
- **ORM**: SQLAlchemy 2.0 (SQLite default, PostgreSQL ready)
- **Testing**: Pytest & HTTPX

---

## ⚙️ Environment Configuration

Configuration is managed via environment variables (or a `.env` file in the `backend/` directory) using `pydantic-settings`. No database credentials or secrets are hardcoded.

```ini
# Database Connection (SQLite default, or PostgreSQL)
DATABASE_URL=sqlite:///./solarai.db
# DATABASE_URL=postgresql://postgres:password@localhost:5432/solarai_db

# Security
API_SECRET_KEY=solarai_super_secret_dev_key_change_in_production
REQUIRE_DEVICE_TOKEN=false

# CORS (Next.js frontend allowed origins)
CORS_ORIGINS=["http://localhost:3000","http://localhost:3001","http://127.0.0.1:3000","http://127.0.0.1:3001"]

# Solar Panel Physical Constants
DEFAULT_PANEL_AREA_M2=0.65
DEFAULT_RATED_POWER_W=100.0

# Device Heartbeat Triage
DEVICE_ONLINE_THRESHOLD_SEC=60
DEVICE_STALE_THRESHOLD_SEC=180
```

---

## 🏃 Quick Start

### 1. Setup Virtual Environment & Dependencies
```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

### 2. Run Database Migrations / Initialize Tables
Database tables are automatically created on application startup via SQLAlchemy metadata.

### 3. Start the FastAPI Server
```powershell
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```
The server will be accessible at:
- **API Base URL**: `http://127.0.0.1:8000`
- **Swagger Interactive Docs**: `http://127.0.0.1:8000/docs`
- **ReDoc Documentation**: `http://127.0.0.1:8000/redoc`
- **OpenAPI JSON Spec**: `http://127.0.0.1:8000/openapi.json`

---

## 📡 Complete API Reference

### 1. Ingest Telemetry
- **Method**: `POST`
- **Endpoint**: `/api/v1/telemetry`
- **Summary**: Receives and processes sensor telemetry from ESP32.
- **Request Body**:
```json
{
  "device_id": "SOLAR-ESP32-01",
  "timestamp": "2026-10-20T07:44:00Z",
  "voltage_v": 18.42,
  "current_a": 2.31,
  "temperature_c": 31.7,
  "irradiance_w_m2": 812.0
}
```
- **Response (201 Created)**:
```json
{
  "status": "success",
  "message": "Telemetry packet processed and persisted successfully.",
  "data": {
    "id": 1,
    "device_id": "SOLAR-ESP32-01",
    "timestamp": "2026-10-20T07:44:00",
    "voltage_v": 18.42,
    "current_a": 2.31,
    "temperature_c": 31.7,
    "irradiance_w_m2": 812.0,
    "power_w": 42.55,
    "efficiency_pct": 8.06,
    "is_anomaly": false,
    "anomaly_notes": null,
    "created_at": "2026-10-20T07:44:00.123456"
  }
}
```
- **Error Responses**:
  - `409 Conflict`: Duplicate timestamp for device.
  - `422 Unprocessable Content`: Value out of physical range or invalid future timestamp.

---

### 2. Get Latest Reading
- **Method**: `GET`
- **Endpoint**: `/api/v1/telemetry/latest/{device_id}`
- **Response (200 OK)**:
```json
{
  "id": 1,
  "device_id": "SOLAR-ESP32-01",
  "timestamp": "2026-10-20T07:44:00",
  "voltage_v": 18.42,
  "current_a": 2.31,
  "temperature_c": 31.7,
  "irradiance_w_m2": 812.0,
  "power_w": 42.55,
  "efficiency_pct": 8.06,
  "is_anomaly": false,
  "anomaly_notes": null,
  "created_at": "2026-10-20T07:44:00"
}
```

---

### 3. Get Historical Telemetry
- **Method**: `GET`
- **Endpoint**: `/api/v1/telemetry/history/{device_id}?limit=100&start_time=...&end_time=...`
- **Response (200 OK)**: Array of `TelemetryResponse` sorted chronologically descending.

---

### 4. Consolidated Dashboard Telemetry & Energy Yield
- **Method**: `GET`
- **Endpoint**: `/api/v1/telemetry/dashboard/{device_id}`
- **Response (200 OK)**:
```json
{
  "device_id": "SOLAR-ESP32-01",
  "device_name": "ESP32 Solar Node SOLAR-ESP32-01",
  "status": "ONLINE",
  "last_seen_at": "2026-10-20T07:44:00",
  "rated_power_w": 100.0,
  "panel_area_m2": 0.65,
  "current_reading": { ... },
  "today_energy_wh": 0.35,
  "today_peak_power_w": 42.55,
  "avg_efficiency_pct": 8.06,
  "total_samples_today": 3
}
```

---

### 5. Device Connection Status
- **Method**: `GET`
- **Endpoint**: `/api/v1/devices/{device_id}/status`
- **Response (200 OK)**:
```json
{
  "device_id": "SOLAR-ESP32-01",
  "status": "ONLINE",
  "is_active": true,
  "last_seen_at": "2026-10-20T07:44:00",
  "seconds_since_last_seen": 0.9,
  "firmware_version": "1.0.0",
  "ip_address": null
}
```

---

### 6. System Healthcheck
- **Method**: `GET`
- **Endpoint**: `/health`
- **Response (200 OK)**:
```json
{
  "status": "healthy",
  "database": "connected",
  "version": "1.0.0"
}
```

---

## 🧪 Automated Testing

### Running the Pytest Suite
```powershell
pytest backend/tests -v
```
Output:
```text
backend/tests/test_telemetry_api.py::test_root_and_healthcheck PASSED           [ 10%]
backend/tests/test_telemetry_api.py::test_ingest_valid_telemetry_and_calculations PASSED [ 20%]
backend/tests/test_telemetry_api.py::test_duplicate_telemetry_handling PASSED   [ 30%]
backend/tests/test_telemetry_api.py::test_invalid_sensor_ranges PASSED          [ 40%]
backend/tests/test_telemetry_api.py::test_future_timestamp_validation PASSED   [ 50%]
backend/tests/test_telemetry_api.py::test_missing_timestamp_auto_assignment PASSED [ 60%]
backend/tests/test_telemetry_api.py::test_get_latest_and_history PASSED         [ 70%]
backend/tests/test_telemetry_api.py::test_dashboard_summary_endpoint PASSED    [ 80%]
backend/tests/test_telemetry_api.py::test_device_status_and_registration PASSED [ 90%]
backend/tests/test_telemetry_api.py::test_anomaly_detection_open_circuit PASSED [100%]
======================= 10 passed in 0.36s =======================
```

### Running the Live Endpoint PowerShell Test Suite
```powershell
powershell -ExecutionPolicy Bypass -File backend/tests/live_endpoint_test.ps1
```

---

## 📟 Hardware ESP32 Firmware Snippet (Arduino / C++)

For the hardware teammates building the ESP32 node, transmit readings over Wi-Fi using the standard HTTPClient library:

```cpp
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

const char* ssid = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASSWORD";
const char* serverUrl = "http://<BACKEND_HOST_IP>:8000/api/v1/telemetry";

void sendTelemetry(float voltage, float current, float temp, float irradiance) {
  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;
    http.begin(serverUrl);
    http.addHeader("Content-Type", "application/json");

    StaticJsonDocument<256> doc;
    doc["device_id"] = "SOLAR-ESP32-01";
    // timestamp is optional; backend will auto-assign high-precision UTC if omitted
    doc["voltage_v"] = voltage;
    doc["current_a"] = current;
    doc["temperature_c"] = temp;
    doc["irradiance_w_m2"] = irradiance;

    String requestBody;
    serializeJson(doc, requestBody);

    int httpResponseCode = http.POST(requestBody);
    if (httpResponseCode > 0) {
      String response = http.getString();
      Serial.printf("HTTP %d: %s\n", httpResponseCode, response.c_str());
    } else {
      Serial.printf("Error on sending POST: %s\n", http.errorToString(httpResponseCode).c_str());
    }
    http.end();
  }
}
```
