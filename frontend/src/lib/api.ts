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

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

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
  predicted_power_w?: number | null;
  residual?: number | null;
  model_version?: string | null;
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

export interface BackendNetworkInfoResponse {
  primary_ip: string;
  port: number;
  available_ips: string[];
  telemetry_url: string;
  status: string;
}

export interface BackendTrainResponse {
  status: string;
  message: string;
  report: {
    dataset_size: number;
    train_samples: number;
    test_samples: number;
    best_model_name: string;
    best_model_version: string;
    models: Record<string, {
      mae: number;
      rmse: number;
      r2_score: number;
    }>;
  };
}

export interface BackendModelMetadata {
  model_name: string;
  model_version: string;
  training_timestamp: string;
  feature_names: string[];
  target_name: string;
  dataset_size: number;
  train_size: number;
  test_size: number;
  mae: number;
  rmse: number;
  r2_score: number;
  artifact_path?: string;
  is_best?: boolean;
}

export interface BackendModelStatusResponse {
  model_available: boolean;
  active_model: BackendModelMetadata | null;
  message: string;
}

export interface BackendPredictResponse {
  predicted_power_w: number;
  model_name: string;
  model_version: string;
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
  alert_type?: string | null;
  metric_name?: string | null;
  metric_value?: number | null;
  expected_value?: number | null;
  unit?: string | null;
  recommended_action?: string | null;
}

export interface BackendAlertSummaryResponse {
  device_id?: string | null;
  total_active: number;
  critical_count: number;
  warning_count: number;
  info_count: number;
  resolved_count: number;
  status_text: string;
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

export interface BackendAnalyticsSummary {
  device_id: string;
  time_range: string;
  start_time: string | null;
  end_time: string | null;
  total_samples: number;
  avg_power_w: number | null;
  max_power_w: number | null;
  min_power_w: number | null;
  total_energy_wh: number | null;
  avg_voltage_v: number | null;
  max_voltage_v: number | null;
  min_voltage_v: number | null;
  avg_current_a: number | null;
  max_current_a: number | null;
  min_current_a: number | null;
  avg_temperature_c: number | null;
  max_temperature_c: number | null;
  min_temperature_c: number | null;
  avg_irradiance_w_m2: number | null;
  max_irradiance_w_m2: number | null;
  min_irradiance_w_m2: number | null;
  avg_efficiency_pct: number | null;
  ai_r2_score: number | null;
  ai_mae_w: number | null;
  ai_rmse_w: number | null;
  health_score: number | null;
  active_alerts_count: number;
  critical_alerts_count: number;
}

export interface BackendTimeseriesPoint {
  timestamp: string;
  actual_power_w: number | null;
  predicted_power_w: number | null;
  residual_w: number | null;
  voltage_v: number | null;
  current_a: number | null;
  temperature_c: number | null;
  irradiance_w_m2: number | null;
  efficiency_pct: number | null;
  sample_count: number;
}

export interface BackendTimeseriesResponse {
  device_id: string;
  time_range: string;
  interval: string;
  total_points: number;
  points: BackendTimeseriesPoint[];
}

export interface BackendCorrelationPair {
  x: number;
  y: number;
  timestamp: string;
}

export interface BackendCorrelationResponse {
  device_id: string;
  time_range: string;
  irradiance_vs_power: BackendCorrelationPair[];
  temperature_vs_power: BackendCorrelationPair[];
  temperature_vs_efficiency: BackendCorrelationPair[];
  correlation_irradiance_power: number | null;
  correlation_temp_power: number | null;
  correlation_temp_efficiency: number | null;
}

export interface BackendExtremePeriod {
  timestamp: string;
  power_w: number;
  voltage_v: number;
  current_a: number;
  temperature_c: number;
  irradiance_w_m2: number;
  predicted_power_w: number | null;
  residual_w: number | null;
  health_score: number | null;
  alert_message: string | null;
}

export interface BackendResidualBin {
  range: string;
  count: number;
}

export interface BackendPerformanceAnalyticsResponse {
  device_id: string;
  time_range: string;
  model_name: string;
  model_version: string;
  r2_score: number;
  mae_w: number;
  rmse_w: number;
  train_samples: number;
  test_samples: number;
  dataset_samples: number;
  best_period: BackendExtremePeriod | null;
  worst_period: BackendExtremePeriod | null;
  residual_distribution: BackendResidualBin[];
}

export interface BackendCurrentStateContext {
  timestamp: string | null;
  device_id: string;
  status: string;
  voltage_v: number | null;
  current_a: number | null;
  temperature_c: number | null;
  irradiance_w_m2: number | null;
  power_w: number | null;
  efficiency_pct: number | null;
}

export interface BackendAIModelContext {
  model_name: string;
  model_version: string;
  r2_score: number | null;
  mae_w: number | null;
  rmse_w: number | null;
  dataset_samples: number | null;
  latest_predicted_power_w: number | null;
  latest_actual_power_w: number | null;
  latest_residual_w: number | null;
  latest_deviation_pct: number | null;
}

export interface BackendHealthContext {
  overall_score: number | null;
  electrical_health: number | null;
  thermal_health: number | null;
  photovoltaic_health: number | null;
  recommendation: string | null;
  status: string | null;
}

export interface BackendAlertContextItem {
  id: number;
  timestamp: string;
  severity: string;
  category: string;
  alert_type: string;
  message: string;
  metric_value: number | null;
  expected_value: number | null;
  unit: string | null;
  recommendation: string | null;
}

export interface BackendAnalyticsContext {
  total_samples: number;
  avg_power_w: number | null;
  max_power_w: number | null;
  min_power_w: number | null;
  total_energy_wh: number | null;
  avg_voltage_v: number | null;
  avg_current_a: number | null;
  avg_temperature_c: number | null;
  avg_irradiance_w_m2: number | null;
  avg_efficiency_pct: number | null;
  best_period: BackendExtremePeriod | null;
  worst_period: BackendExtremePeriod | null;
}

export interface BackendSolarAIContextResponse {
  device_id: string;
  data_source: string;
  timestamp: string;
  has_data: boolean;
  current: BackendCurrentStateContext | null;
  ai: BackendAIModelContext | null;
  health: BackendHealthContext | null;
  alerts: BackendAlertContextItem[];
  analytics: BackendAnalyticsContext | null;
}

export interface BackendAIChatEvidence {
  power_w: number | null;
  predicted_power_w: number | null;
  residual_w: number | null;
  voltage_v: number | null;
  current_a: number | null;
  temperature_c: number | null;
  irradiance_w_m2: number | null;
  health_score: number | null;
  active_alerts_count: number;
  timestamp: string | null;
}

export interface BackendAIChatResponse {
  device_id: string;
  question: string;
  answer: string;
  provider: string;
  grounded: boolean;
  evidence: BackendAIChatEvidence | null;
  structured_data: Record<string, any> | null;
  timestamp: string;
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
 * Fetch aggregated alert counts (critical, warning, active, resolved)
 */
export async function getAlertsSummary(deviceId?: string): Promise<BackendAlertSummaryResponse | null> {
  try {
    const query = deviceId ? `?device_id=${encodeURIComponent(deviceId)}` : '';
    const res = await fetchWithTimeout(`${API_BASE_URL}/api/v1/alerts/summary${query}`);
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.warn(`[SolarAI API] getAlertsSummary error:`, err);
    return null;
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

/**
 * Fetch server local network IP addresses and telemetry target URL for ESP32
 */
export async function getNetworkInfo(): Promise<BackendNetworkInfoResponse | null> {
  try {
    const res = await fetchWithTimeout(`${API_BASE_URL}/api/v1/devices/network-info`, {}, 4000);
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.warn('[SolarAI API] getNetworkInfo error:', err);
    return null;
  }
}

/**
 * Manually trigger AI model training across valid real hardware telemetry records
 */
export async function trainModels(deviceId?: string): Promise<{ success: boolean; data?: BackendTrainResponse; error?: string }> {
  try {
    const res = await fetchWithTimeout(`${API_BASE_URL}/api/v1/ml/train`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ device_id: deviceId || null }),
    }, 15000);
    const data = await res.json();
    if (!res.ok) {
      return { success: false, error: data.detail || 'Training failed' };
    }
    return { success: true, data };
  } catch (err: any) {
    return { success: false, error: err.message || 'Network error triggering model training' };
  }
}

/**
 * Fetch active AI model deployment status and benchmark metrics
 */
export async function getModelStatus(): Promise<BackendModelStatusResponse | null> {
  try {
    const res = await fetchWithTimeout(`${API_BASE_URL}/api/v1/ml/status`, {}, 3000);
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.warn('[SolarAI API] getModelStatus error:', err);
    return null;
  }
}

/**
 * Execute real-time power prediction via backend ML model
 */
export async function predictPower(features: {
  voltage_v: number;
  current_a: number;
  temperature_c: number;
  irradiance_w_m2: number;
}): Promise<BackendPredictResponse | null> {
  try {
    const res = await fetchWithTimeout(`${API_BASE_URL}/api/v1/ml/predict`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(features),
    }, 4000);
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.warn('[SolarAI API] predictPower error:', err);
    return null;
  }
}

/**
 * Fetch consolidated analytics summary from real backend telemetry
 */
export async function fetchAnalyticsSummary(
  deviceId: string,
  range: string = '24h',
  startTime?: string,
  endTime?: string
): Promise<BackendAnalyticsSummary | null> {
  try {
    let url = `${API_BASE_URL}/api/v1/analytics/summary/${encodeURIComponent(deviceId)}?range=${range}`;
    if (startTime) url += `&start_time=${encodeURIComponent(startTime)}`;
    if (endTime) url += `&end_time=${encodeURIComponent(endTime)}`;
    const res = await fetchWithTimeout(url, {}, 6000);
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.warn(`[SolarAI API] fetchAnalyticsSummary error for ${deviceId}:`, err);
    return null;
  }
}

/**
 * Fetch aggregated or raw timeseries points with actual vs AI predictions
 */
export async function fetchAnalyticsTimeseries(
  deviceId: string,
  range: string = '24h',
  interval: string = 'auto',
  startTime?: string,
  endTime?: string
): Promise<BackendTimeseriesResponse | null> {
  try {
    let url = `${API_BASE_URL}/api/v1/analytics/timeseries/${encodeURIComponent(deviceId)}?range=${range}&interval=${interval}`;
    if (startTime) url += `&start_time=${encodeURIComponent(startTime)}`;
    if (endTime) url += `&end_time=${encodeURIComponent(endTime)}`;
    const res = await fetchWithTimeout(url, {}, 8000);
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.warn(`[SolarAI API] fetchAnalyticsTimeseries error for ${deviceId}:`, err);
    return null;
  }
}

/**
 * Fetch environmental correlation scatter pairs and Pearson r coefficients
 */
export async function fetchAnalyticsCorrelation(
  deviceId: string,
  range: string = '24h',
  startTime?: string,
  endTime?: string
): Promise<BackendCorrelationResponse | null> {
  try {
    let url = `${API_BASE_URL}/api/v1/analytics/correlation/${encodeURIComponent(deviceId)}?range=${range}`;
    if (startTime) url += `&start_time=${encodeURIComponent(startTime)}`;
    if (endTime) url += `&end_time=${encodeURIComponent(endTime)}`;
    const res = await fetchWithTimeout(url, {}, 6000);
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.warn(`[SolarAI API] fetchAnalyticsCorrelation error for ${deviceId}:`, err);
    return null;
  }
}

/**
 * Fetch AI benchmark metrics, extreme performance periods, and residual distribution
 */
export async function fetchAnalyticsPerformance(
  deviceId: string,
  range: string = '24h',
  startTime?: string,
  endTime?: string
): Promise<BackendPerformanceAnalyticsResponse | null> {
  try {
    let url = `${API_BASE_URL}/api/v1/analytics/performance/${encodeURIComponent(deviceId)}?range=${range}`;
    if (startTime) url += `&start_time=${encodeURIComponent(startTime)}`;
    if (endTime) url += `&end_time=${encodeURIComponent(endTime)}`;
    const res = await fetchWithTimeout(url, {}, 6000);
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.warn(`[SolarAI API] fetchAnalyticsPerformance error for ${deviceId}:`, err);
    return null;
  }
}

/**
 * Construct CSV download URL for analytics data export
 */
export function getAnalyticsExportUrl(deviceId: string, range: string = 'all', includeDemo: boolean = false): string {
  return `${API_BASE_URL}/api/v1/analytics/export/${encodeURIComponent(deviceId)}?range=${range}&include_demo=${includeDemo}`;
}

/**
 * Fetch consolidated real IoT grounding context for a device
 */
export async function fetchSolarAIContext(deviceId: string): Promise<BackendSolarAIContextResponse | null> {
  try {
    const res = await fetchWithTimeout(`${API_BASE_URL}/api/v1/ai/context/${encodeURIComponent(deviceId)}`, {}, 6000);
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.warn(`[SolarAI API] fetchSolarAIContext error for ${deviceId}:`, err);
    return null;
  }
}

/**
 * Send user query to grounded AI Solar Performance Assistant
 */
export async function sendAIChatMessage(
  deviceId: string,
  question: string,
  conversationId?: string
): Promise<BackendAIChatResponse | null> {
  try {
    const res = await fetchWithTimeout(`${API_BASE_URL}/api/v1/ai/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        device_id: deviceId,
        question: question,
        conversation_id: conversationId || null,
      }),
    }, 12000);
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.detail || `Server returned error ${res.status}`);
    }
    return await res.json();
  } catch (err: any) {
    console.warn(`[SolarAI API] sendAIChatMessage error:`, err);
    throw err;
  }
}

/**
 * Fetch AI Assistant configuration and status
 */
export async function fetchAIAssistantStatus(): Promise<{
  status: string;
  active_provider: string;
  external_llm_configured: boolean;
  fallback_provider: string;
  grounding_rules: string[];
} | null> {
  try {
    const res = await fetchWithTimeout(`${API_BASE_URL}/api/v1/ai/status`, {}, 4000);
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.warn(`[SolarAI API] fetchAIAssistantStatus error:`, err);
    return null;
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
  // Prioritize real ML prediction from backend, then explicit parameter, then power fallback
  const pred = item.predicted_power_w ?? predictedPower ?? power;
  const residual = item.residual ?? Math.round((power - pred) * 100) / 100;

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

  const alertType = (item.alert_type || '').toUpperCase();
  const catLower = item.category.toLowerCase();

  let type: AlertItem['type'] = 'sensor_fault';
  if (catLower.includes('therm') || alertType.includes('TEMP')) {
    type = 'thermal_overheating';
  } else if (alertType === 'OPEN_CIRCUIT' || catLower.includes('elect')) {
    type = 'open_circuit';
  } else if (alertType === 'SHORT_CIRCUIT') {
    type = 'short_circuit';
  } else if (alertType.includes('SOIL') || catLower.includes('effic')) {
    type = 'soiling_dust';
  } else if (alertType.includes('SHAD')) {
    type = 'partial_shading';
  } else if (alertType.includes('OFFLINE')) {
    type = 'hardware_offline';
  }

  // Dynamic human-readable diagnostic title
  let title = `${item.category}: ${item.severity}`;
  if (alertType === 'PERF_DEFICIT_CRIT') title = 'Severe Generation Deficit';
  else if (alertType === 'PERF_DEFICIT_WARN') title = 'Generation Below AI Baseline';
  else if (alertType === 'TEMP_CRIT') title = 'Critical Thermal Overheating';
  else if (alertType === 'TEMP_WARN') title = 'Elevated Cell Temperature';
  else if (alertType === 'OPEN_CIRCUIT') title = 'Open Circuit Disconnect';
  else if (alertType === 'SHORT_CIRCUIT') title = 'Suspect Array Short Circuit';
  else if (alertType === 'SOILING_SHADING') title = 'Possible Shading or Soiling';
  else if (alertType === 'SENSOR_FAULT') title = 'Sensor Out of Range';
  else if (alertType === 'DEVICE_OFFLINE') title = 'ESP32 Hardware Offline';
  else if (alertType === 'DEVICE_RECOVERED') title = 'ESP32 Hardware Reconnected';

  return {
    id: String(item.id),
    timestamp: item.timestamp,
    severity: severity,
    type: type,
    title: title,
    description: item.message,
    metricName: item.metric_name || item.category,
    metricValue: item.metric_value != null ? Number(item.metric_value.toFixed(1)) : 0,
    expectedValue: item.expected_value != null ? Number(item.expected_value.toFixed(1)) : 0,
    unit: item.unit || '',
    recommendedAction: item.recommended_action || 'Inspect physical panel and wiring connections.',
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
