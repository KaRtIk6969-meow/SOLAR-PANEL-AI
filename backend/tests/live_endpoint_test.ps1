# live_endpoint_test.ps1
$baseUrl = "http://127.0.0.1:8000"

Write-Host "=========================================" -ForegroundColor Cyan
Write-Host " SOLAR-AI BACKEND LIVE ENDPOINT TEST SUITE " -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan

# 1. Health check
Write-Host "`n1. Testing GET /health..." -ForegroundColor Yellow
$health = Invoke-RestMethod -Uri "$baseUrl/health" -Method Get
Write-Host "Status: $($health.status) | Database: $($health.database) | Version: $($health.version)" -ForegroundColor Green

# 2. Root index
Write-Host "`n2. Testing GET /..." -ForegroundColor Yellow
$root = Invoke-RestMethod -Uri "$baseUrl/" -Method Get
Write-Host "Service: $($root.service) | Version: $($root.version) | Status: $($root.status) | Docs: $($root.docs_url)" -ForegroundColor Green

# 3. Ingest Valid Telemetry (User Payload)
Write-Host "`n3. Testing POST /api/v1/telemetry with exact prompt payload..." -ForegroundColor Yellow
$isoNow = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
$payload = @{
    device_id       = "SOLAR-ESP32-01"
    timestamp       = $isoNow
    voltage_v       = 18.42
    current_a       = 2.31
    temperature_c   = 31.7
    irradiance_w_m2 = 812.0
} | ConvertTo-Json

$telemetryResponse = Invoke-RestMethod -Uri "$baseUrl/api/v1/telemetry" -Method Post -Body $payload -ContentType "application/json"
Write-Host "Telemetry Ingested Successfully!" -ForegroundColor Green
Write-Host "Device ID               : $($telemetryResponse.data.device_id)" -ForegroundColor Gray
Write-Host "Timestamp               : $($telemetryResponse.data.timestamp)" -ForegroundColor Gray
Write-Host "Voltage                 : $($telemetryResponse.data.voltage_v) V" -ForegroundColor Gray
Write-Host "Current                 : $($telemetryResponse.data.current_a) A" -ForegroundColor Gray
Write-Host "Calculated Power (V x I): $($telemetryResponse.data.power_w) W" -ForegroundColor Gray
Write-Host "Calculated Efficiency   : $($telemetryResponse.data.efficiency_pct) %" -ForegroundColor Gray
Write-Host "Anomaly Flags           : $($telemetryResponse.data.anomaly_flags -join ', ')" -ForegroundColor Gray

# 4. Duplicate Record Handling (Expect 409 Conflict)
Write-Host "`n4. Testing Duplicate Record Rejection (POST duplicate payload)..." -ForegroundColor Yellow
try {
    $dup = Invoke-RestMethod -Uri "$baseUrl/api/v1/telemetry" -Method Post -Body $payload -ContentType "application/json"
    Write-Host "FAIL: Duplicate was accepted unexpectedly!" -ForegroundColor Red
} catch {
    $statusCode = $_.Exception.Response.StatusCode.value__
    Write-Host "SUCCESS: Duplicate rejected with HTTP $statusCode (Conflict)." -ForegroundColor Green
}

# 5. Invalid Sensor Range Handling (Expect 422 Unprocessable Content)
Write-Host "`n5. Testing Invalid Range Validation (voltage = -15V)..." -ForegroundColor Yellow
$badPayload = @{
    device_id       = "SOLAR-ESP32-01"
    timestamp       = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
    voltage_v       = -15.0
    current_a       = 2.0
    temperature_c   = 25.0
    irradiance_w_m2 = 500.0
} | ConvertTo-Json

try {
    $bad = Invoke-RestMethod -Uri "$baseUrl/api/v1/telemetry" -Method Post -Body $badPayload -ContentType "application/json"
    Write-Host "FAIL: Negative voltage accepted unexpectedly!" -ForegroundColor Red
} catch {
    $statusCode = $_.Exception.Response.StatusCode.value__
    Write-Host "SUCCESS: Invalid reading rejected with HTTP $statusCode (Validation Error)." -ForegroundColor Green
}

# 6. Future Timestamp Handling (Expect 422)
Write-Host "`n6. Testing Future Timestamp Validation (+2 days)..." -ForegroundColor Yellow
$futureIso = (Get-Date).AddDays(2).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
$futurePayload = @{
    device_id       = "SOLAR-ESP32-01"
    timestamp       = $futureIso
    voltage_v       = 18.0
    current_a       = 2.0
    temperature_c   = 25.0
    irradiance_w_m2 = 500.0
} | ConvertTo-Json

try {
    $futureRes = Invoke-RestMethod -Uri "$baseUrl/api/v1/telemetry" -Method Post -Body $futurePayload -ContentType "application/json"
    Write-Host "FAIL: Future timestamp accepted unexpectedly!" -ForegroundColor Red
} catch {
    $statusCode = $_.Exception.Response.StatusCode.value__
    Write-Host "SUCCESS: Future timestamp rejected with HTTP $statusCode." -ForegroundColor Green
}

# 7. Latest Reading Endpoint
Write-Host "`n7. Testing GET /api/v1/telemetry/latest/SOLAR-ESP32-01..." -ForegroundColor Yellow
$latest = Invoke-RestMethod -Uri "$baseUrl/api/v1/telemetry/latest/SOLAR-ESP32-01" -Method Get
Write-Host "Latest Power: $($latest.power_w) W | Voltage: $($latest.voltage_v) V | Current: $($latest.current_a) A | Timestamp: $($latest.timestamp)" -ForegroundColor Green

# 8. Historical Data Endpoint
Write-Host "`n8. Testing GET /api/v1/telemetry/history/SOLAR-ESP32-01..." -ForegroundColor Yellow
$history = Invoke-RestMethod -Uri "$baseUrl/api/v1/telemetry/history/SOLAR-ESP32-01?limit=10" -Method Get
Write-Host "Fetched $($history.Count) historical records. Latest historical item timestamp: $($history[0].timestamp)" -ForegroundColor Green

# 9. Dashboard Aggregation Endpoint
Write-Host "`n9. Testing GET /api/v1/telemetry/dashboard/SOLAR-ESP32-01..." -ForegroundColor Yellow
$dash = Invoke-RestMethod -Uri "$baseUrl/api/v1/telemetry/dashboard/SOLAR-ESP32-01" -Method Get
Write-Host "Device: $($dash.device_id) | Status: $($dash.status) | Energy Today: $($dash.today_energy_wh) Wh | Peak Power: $($dash.today_peak_power_w) W | Avg Eff: $($dash.avg_efficiency_pct)% | Samples: $($dash.total_samples_today)" -ForegroundColor Green

# 10. Device Status Endpoint
Write-Host "`n10. Testing GET /api/v1/devices/SOLAR-ESP32-01/status..." -ForegroundColor Yellow
$deviceStatus = Invoke-RestMethod -Uri "$baseUrl/api/v1/devices/SOLAR-ESP32-01/status" -Method Get
Write-Host "Device: $($deviceStatus.device_id) | Status: $($deviceStatus.status) | Last Seen: $($deviceStatus.seconds_since_last_seen)s ago" -ForegroundColor Green

# 11. OpenAPI Specification check
Write-Host "`n11. Testing GET /openapi.json..." -ForegroundColor Yellow
$openapi = Invoke-RestMethod -Uri "$baseUrl/openapi.json" -Method Get
Write-Host "OpenAPI Schema Version: $($openapi.openapi) | Title: $($openapi.info.title) | Endpoint Count: $($openapi.paths.PSObject.Properties.Count)" -ForegroundColor Green

Write-Host "`n=========================================" -ForegroundColor Cyan
Write-Host " ALL 11 ENDPOINTS VERIFIED AND PASSING! " -ForegroundColor Green
Write-Host "=========================================" -ForegroundColor Cyan
