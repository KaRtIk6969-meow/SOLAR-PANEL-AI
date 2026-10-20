/**
 * SolarAI API Client
 * Connects the Next.js frontend to the FastAPI backend.
 */

import { 
  TelemetryReading, 
  DeviceInfo, 
  PanelHealth, 
  AlertItem 
} from '@/types/solar';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001';

export interface BackendTelemetryResponse {
  id: number;
  device_id: string;
  timestamp: string;
  voltage_v: number;
  current_a: number;
  temperature_c: number;
  irradiance_w_m2: number;
  power_w: number;
  efficiency_pct: number | null;
  data_quality: string;
  firmware_version?: string;
  is_anomaly: boolean;
  anomaly_notes: string | null;
  created_at: string;
}

export interface BackendDeviceStatusResponse {
  device_id: string;
  device_name: string;
  status: 'ONLINE' | 'STALE' | 'OFFLINE';
  last_seen_at: string | null;
  seconds_since_last_seen: number | null;
  is_reporting: boolean;
}

export interface BackendDeviceTelemetryStatsResponse {
  device_id: string;
  device_name: string;
  connection_status: 'ONLINE' | 'STALE' | 'OFFLINE';
  last_seen_at: string | null;
  seconds_since_last_seen: number | null;
  total_packets: number;
  valid_readings: number;
  invalid_readings: number;
  missing_values: number;
  rejected_readings: number;
  demo_records_count: number;
  real_valid_records: number;
  min_training_threshold: number;
  training_readiness: 'READY' | 'INSUFFICIENT_DATA';
  recommendation: string;
  sensor_status: {
    voltage: string;
    current: string;
    temperature: string;
    irradiance: string;
  };
  packet_interval_sec: number | null;
  api_response_status: string;
}


export interface BackendAlertResponse {
  id: number;
  device_id: string;
  timestamp: string;
  severity: string;
  category: string;
  message: string;
  is_resolved: boolean;
  resolved_at: string | null;
  created_at: string;
}

export interface BackendPredictionResponse {
  id: number;
  device_id: string;
  timestamp: string;
  target: string;
  predicted_value: number;
  actual_value: number | null;
  residual: number | null;
  deviation_pct: number | null;
  alert_status: string;
  model_version: string;
  created_at: string;
}

export interface BackendHealthScoreResponse {
  id: number;
  device_id: string;
  timestamp: string;
  overall_score: number;
  electrical_health: number;
  thermal_health: number;
  photovoltaic_health: number;
  degradation_factor?: number | null;
  recommendation?: string | null;
  created_at: string;
}

export interface BackendDashboardDataResponse {
  device_id: string;
  device_name: string;
  status: string;
  last_seen_at: string | null;
  rated_power_w: number;
  panel_area_m2: number;
  current_reading: BackendTelemetryResponse | null;
  today_energy_wh: number;
  today_peak_power_w: number;
  avg_efficiency_pct: number | null;
  total_samples_today: number;
}

/**
 * Standard fetch helper with 5-second timeout
 */
async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs = 5000): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
        ...(options.headers || {}),
      },
      cache: 'no-store', // Always retrieve fresh live telemetry
    });
    return response;
  } finally {
    clearTimeout(id);
  }
}

/**
 * Health check
 */
export async function checkBackendHealth(): Promise<{ healthy: boolean; database: string }> {
  try {
    const res = await fetchWithTimeout(`${API_BASE_URL}/health`, {}, 3000);
    if (!res.ok) return { healthy: false, database: 'unreachable' };
    const data = await res.json();
    return { healthy: data.status === 'healthy', database: data.database || 'unknown' };
  } catch {
    return { healthy: false, database: 'unreachable' };
  }
}

/**
 * Fetch latest telemetry reading for a device
 */
export async function getLatestTelemetry(deviceId: string): Promise<BackendTelemetryResponse | null> {
  try {
    const res = await fetchWithTimeout(`${API_BASE_URL}/api/v1/telemetry/latest/${encodeURIComponent(deviceId)}`);
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to fetch latest telemetry`);
    return await res.json();
  } catch (err) {
    console.warn(`[SolarAI API] getLatestTelemetry error for ${deviceId}:`, err);
    return null;
  }
}

/**
 * Fetch historical telemetry readings
 */
export async function getHistoricalTelemetry(deviceId: string, limit = 50): Promise<BackendTelemetryResponse[]> {
  try {
    const res = await fetchWithTimeout(`${API_BASE_URL}/api/v1/telemetry/history/${encodeURIComponent(deviceId)}?limit=${limit}`);
    if (!res.ok) return [];
    return await res.json();
  } catch (err) {
    console.warn(`[SolarAI API] getHistoricalTelemetry error for ${deviceId}:`, err);
    return [];
  }
}

/**
 * Fetch consolidated dashboard metrics from backend
 */
export async function getDashboardData(deviceId: string): Promise<BackendDashboardDataResponse | null> {
  try {
    const res = await fetchWithTimeout(`${API_BASE_URL}/api/v1/telemetry/dashboard/${encodeURIComponent(deviceId)}`);
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to fetch dashboard data`);
    return await res.json();
  } catch (err) {
    console.warn(`[SolarAI API] getDashboardData error for ${deviceId}:`, err);
    return null;
  }
}

/**
 * Fetch device heartbeat and connection status
 */
export async function getDeviceStatus(deviceId: string): Promise<BackendDeviceStatusResponse | null> {
  try {
    const res = await fetchWithTimeout(`${API_BASE_URL}/api/v1/devices/${encodeURIComponent(deviceId)}/status`);
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to fetch device status`);
    return await res.json();
  } catch (err) {
    console.warn(`[SolarAI API] getDeviceStatus error for ${deviceId}:`, err);
    return null;
  }
}

/**
 * Fetch detailed device telemetry statistics, data quality metrics, and ML dataset readiness
 */
export async function getDeviceTelemetryStats(deviceId: string): Promise<BackendDeviceTelemetryStatsResponse | null> {
  try {
    const res = await fetchWithTimeout(`${API_BASE_URL}/api/v1/devices/${encodeURIComponent(deviceId)}/telemetry-stats`);
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.warn(`[SolarAI API] getDeviceTelemetryStats error for ${deviceId}:`, err);
    return null;
  }
}

/**
 * Generate CSV export download link
 */
export function getExportCsvUrl(deviceId: string, includeDemo = false): string {
  return `${API_BASE_URL}/api/v1/telemetry/export/csv?device_id=${encodeURIComponent(deviceId)}&include_demo=${includeDemo}`;
}

/**
 * Inject simulated telemetry packet tagged with data_quality='DEMO' (Development Only)
 */
export async function injectDemoTestTelemetry(deviceId: string): Promise<BackendTelemetryResponse | null> {
  try {
    const res = await fetchWithTimeout(`${API_BASE_URL}/api/v1/telemetry/demo-test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ device_id: deviceId }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return data.data;
  } catch (err) {
    console.warn(`[SolarAI API] injectDemoTestTelemetry error:`, err);
    return null;
  }
}

/**
 * Clear only demo simulated telemetry packets (Real hardware data is 100% untouched)
 */
export async function clearDemoTelemetry(deviceId?: string): Promise<{ deleted_count: number }> {
  try {
    const query = deviceId ? `?device_id=${encodeURIComponent(deviceId)}` : '';
    const res = await fetchWithTimeout(`${API_BASE_URL}/api/v1/telemetry/demo${query}`, {
      method: 'DELETE',
    });
    if (!res.ok) return { deleted_count: 0 };
    return await res.json();
  } catch (err) {
    console.warn(`[SolarAI API] clearDemoTelemetry error:`, err);
    return { deleted_count: 0 };
  }
}


/**
 * Fetch alerts from backend
 */
export async function getAlerts(deviceId: string, limit = 20): Promise<BackendAlertResponse[]> {
  try {
    const res = await fetchWithTimeout(`${API_BASE_URL}/api/v1/alerts/${encodeURIComponent(deviceId)}?limit=${limit}`);
    if (!res.ok) return [];
    return await res.json();
  } catch (err) {
    console.warn(`[SolarAI API] getAlerts error for ${deviceId}:`, err);
    return [];
  }
}

/**
 * Fetch AI predictions
 */
export async function getPredictions(deviceId: string, limit = 20): Promise<BackendPredictionResponse[]> {
  try {
    const res = await fetchWithTimeout(`${API_BASE_URL}/api/v1/predictions/${encodeURIComponent(deviceId)}?limit=${limit}`);
    if (!res.ok) return [];
    return await res.json();
  } catch (err) {
    console.warn(`[SolarAI API] getPredictions error for ${deviceId}:`, err);
    return [];
  }
}

/**
 * Fetch latest panel health score
 */
export async function getLatestHealthScore(deviceId: string): Promise<BackendHealthScoreResponse | null> {
  try {
    const res = await fetchWithTimeout(`${API_BASE_URL}/api/v1/health-scores/${encodeURIComponent(deviceId)}/latest`);
    if (res.status === 404) return null;
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.warn(`[SolarAI API] getLatestHealthScore error for ${deviceId}:`, err);
    return null;
  }
}

/**
 * Resolve an alert in backend
 */
export async function resolveAlertInBackend(alertId: number | string): Promise<boolean> {
  try {
    const res = await fetchWithTimeout(`${API_BASE_URL}/api/v1/alerts/${alertId}/resolve`, {
      method: 'PATCH',
    });
    return res.ok;
  } catch {
    return false;
  }
}

// -------------------------------------------------------------
// Data Adapters: Backend Format -> Frontend Domain Types
// -------------------------------------------------------------

export function mapBackendTelemetryToDomain(
  item: BackendTelemetryResponse, 
  predictedPower?: number
): TelemetryReading {
  const power = item.power_w;
  const pred = predictedPower ?? Math.round(power * 1.05 * 10) / 10;
  const residual = Math.round((power - pred) * 100) / 100;

  return {
    id: String(item.id),
    timestamp: item.timestamp,
    voltage: item.voltage_v,
    current: item.current_a,
    power: item.power_w,
    temperature: item.temperature_c,
    ambientTemp: Math.max(15, Math.round(item.temperature_c - 6)),
    irradiance: item.irradiance_w_m2,
    efficiency: item.efficiency_pct ?? 0,
    theoreticalPower: Math.round(item.irradiance_w_m2 * 0.65 * 0.178 * 10) / 10,
    predictedPower: pred,
    residual: residual,
    isMock: false,
  };
}

export function mapBackendAlertToDomain(item: BackendAlertResponse): AlertItem {
  let severity: 'info' | 'warning' | 'critical' = 'warning';
  const sevLower = item.severity.toLowerCase();
  if (sevLower.includes('crit')) severity = 'critical';
  else if (sevLower.includes('info')) severity = 'info';

  let type: AlertItem['type'] = 'sensor_fault';
  const catLower = item.category.toLowerCase();
  if (catLower.includes('therm')) type = 'thermal_overheating';
  else if (catLower.includes('elect')) type = 'open_circuit';

  return {
    id: String(item.id),
    timestamp: item.timestamp,
    severity: severity,
    type: type,
    title: `${item.category}: ${item.severity}`,
    description: item.message,
    metricName: item.category,
    metricValue: 0,
    expectedValue: 0,
    unit: '',
    recommendedAction: 'Inspect physical panel and wiring connections.',
    isResolved: item.is_resolved,
    resolvedAt: item.resolved_at || undefined,
  };
}

export function mapBackendHealthToDomain(score: BackendHealthScoreResponse): PanelHealth {
  const overall = Math.round(score.overall_score);
  let grade: PanelHealth['grade'] = 'B';
  if (overall >= 95) grade = 'A+';
  else if (overall >= 90) grade = 'A';
  else if (overall >= 80) grade = 'B';
  else if (overall >= 70) grade = 'C';
  else if (overall >= 60) grade = 'D';
  else grade = 'F';

  return {
    overallScore: overall,
    grade: grade,
    thermalLossPct: Math.max(0, Math.round((100 - score.thermal_health) * 0.1 * 10) / 10),
    soilingLossPct: Math.max(0, Math.round((100 - score.photovoltaic_health) * 0.08 * 10) / 10),
    shadingLossPct: Math.max(0, Math.round((100 - score.electrical_health) * 0.05 * 10) / 10),
    degradationRateAnnual: score.degradation_factor ? Math.round(score.degradation_factor * 100) / 100 : 0.6,
    healthStatusText: score.recommendation || (overall >= 85 ? 'System Operating Nominally' : 'Performance Degraded'),
  };
}
