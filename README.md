# SolarAI - Solar Panel Monitoring & AI Efficiency System

SolarAI is a college IoT & AI platform designed to monitor solar panel electrical parameters in real time, evaluate solar conversion efficiency, detect operational anomalies, and predict performance using artificial intelligence.

---

## 🏗️ System Architecture

```text
[ Physical Layer ]
  Solar PV Panel + Sensors (ACS712, Voltage Divider, DS18B20, Pyranometer/LDR)
        │
        ▼
  ESP32 Microcontroller Node (Wi-Fi)
        │  HTTP POST (JSON)
        ▼
[ Backend Layer ]
  FastAPI Server (Port 8000)
    ├── /api/v1/telemetry        (Ingestion, Quality Tagging, Anomaly Alerting)
    ├── /api/v1/devices          (Hardware Nodes & Heartbeat Status)
    ├── /api/v1/predictions      (AI Forecasts, Residuals & Drift)
    ├── /api/v1/alerts           (Hardware & Threshold Alarms)
    ├── /api/v1/health-scores    (Composite & Degradation Scoring)
    └── /api/v1/model-metrics    (MAE, RMSE, R2 Benchmark Tracking)
        │
        ├── PostgreSQL Relational Persistence (Alembic Migrations)
        │     ├── devices
        │     ├── sensor_readings (V, I, T, G, Power, Eff, Quality, Firmware)
        │     ├── predictions (Target, Predicted, Actual, Residual, Dev%)
        │     ├── alerts (Severity, Category, Message, Resolution)
        │     ├── health_scores (Overall, Electrical, Thermal, PV)
        │     └── model_metrics (MAE, RMSE, R2, Dataset Size)
        │
[ Frontend Layer ]
  Next.js 16 + React 19 + Tailwind v4 + Recharts (Port 3000)
    ├── /dashboard, /monitor, /analytics, /health
    └── /prediction, /alerts, /ai-lab, /device, /reports, /settings
```

---

## 🚀 Quick Start Guide

### Prerequisites
- **Node.js**: v18+
- **Python**: v3.10+ (tested on Python 3.12.10)

---

### Option A: Running with Monorepo NPM Scripts (Recommended)

From the project root:

```powershell
# 1. Install frontend dependencies
npm --prefix frontend install

# 2. Start Next.js Frontend (http://localhost:3000)
npm run dev

# 3. Start FastAPI Backend (http://127.0.0.1:8000)
npm run backend:dev

# 4. Run Backend Pytest Suite
npm run backend:test
```

---

### Option B: Running Services Individually

#### 1. Next.js Frontend
```powershell
cd frontend
npm install
npm run dev
```
Open **[http://localhost:3000](http://localhost:3000)** in your browser.

#### 2. FastAPI Backend
```powershell
cd backend

# Create & activate venv (if needed)
python -m venv .venv
.\.venv\Scripts\Activate.ps1

# Install dependencies
pip install -r requirements.txt

# Start backend server
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```
Interactive API docs are available at:
- **Swagger UI**: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)
- **ReDoc**: [http://127.0.0.1:8000/redoc](http://127.0.0.1:8000/redoc)
- **OpenAPI JSON**: [http://127.0.0.1:8000/openapi.json](http://127.0.0.1:8000/openapi.json)

---

## 📡 ESP32 Telemetry Specification

The ESP32 transmits sensor packets to `POST /api/v1/telemetry`:

```json
{
  "device_id": "SOLAR-ESP32-01",
  "timestamp": "2026-10-20T07:44:22Z",
  "voltage_v": 18.42,
  "current_a": 2.31,
  "temperature_c": 31.7,
  "irradiance_w_m2": 812.0
}
```

### Backend Derived Calculations:
- **Power ($W$)**: $V \times I = 18.42 \times 2.31 = 42.55\text{ W}$
- **Efficiency ($\%$)**: $\frac{P}{G \times \text{Area}} \times 100\%$ ($8.06\%$ for a standard $0.65\text{ m}^2$ panel)
- **Anomaly Detection**: Instant rule-based flagging for open circuits, short circuits, and overheating.
- **Deduplication**: Rejects duplicate device timestamps with `HTTP 409 Conflict`.

---

## 🧪 Testing

### Backend Unit & Integration Tests (Pytest)
```powershell
pytest backend/tests -v
```

### Live Endpoint Integration Test
With the backend server running:
```powershell
powershell -ExecutionPolicy Bypass -File backend/tests/live_endpoint_test.ps1
```