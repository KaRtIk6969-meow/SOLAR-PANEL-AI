// Core Telemetry & Domain Types for SolarAI

export type DeviceStatus = 'ONLINE' | 'STALE' | 'OFFLINE' | 'SIMULATED';

export type AlertSeverity = 'info' | 'warning' | 'critical';

export type AnomalyType = 
  | 'soiling_dust' 
  | 'partial_shading' 
  | 'thermal_overheating' 
  | 'open_circuit' 
  | 'short_circuit' 
  | 'sensor_fault' 
  | 'hardware_offline';

export type SimulationScenario = 
  | 'normal' 
  | 'soiling' 
  | 'shading' 
  | 'heatwave' 
  | 'open_circuit' 
  | 'sensor_drift';

export interface TelemetryReading {
  id: string;
  timestamp: string;
  voltage: number;         // Volts (V)
  current: number;         // Amperes (A)
  power: number;           // Calculated: V * I (Watts)
  temperature: number;     // Panel surface temp (°C)
  ambientTemp: number;     // Ambient weather temp (°C)
  irradiance: number;      // Solar irradiance (W/m²)
  efficiency: number;      // Instantaneous efficiency (%)
  theoreticalPower: number;// Physics baseline power (Watts)
  predictedPower: number;  // AI expected power (Watts)
  residual: number;        // actual power - predicted power (Watts)
  isMock: boolean;
}

export interface DeviceInfo {
  id: string;
  name: string;
  status: DeviceStatus;
  lastSeen: string;
  ratedPower: number;       // e.g. 100 W
  panelArea: number;        // e.g. 0.65 m²
  tempCoeff: number;        // e.g. -0.4% / °C
  firmwareVersion: string;
  ipAddress: string;
  rssi: number;             // dBm signal strength
  macAddress: string;
  uptimeHours: number;
}

export interface PanelHealth {
  overallScore: number;     // 0 - 100
  grade: 'A+' | 'A' | 'B' | 'C' | 'D' | 'F';
  thermalLossPct: number;   // Loss due to temp > 25°C
  soilingLossPct: number;   // Loss due to dirt/dust
  shadingLossPct: number;   // Optical obstruction loss
  degradationRateAnnual: number; // e.g. 0.6% / year
  healthStatusText: string;
}

export interface AlertItem {
  id: string;
  timestamp: string;
  severity: AlertSeverity;
  type: AnomalyType;
  title: string;
  description: string;
  metricName: string;
  metricValue: number;
  expectedValue: number;
  unit: string;
  recommendedAction: string;
  isResolved: boolean;
  resolvedAt?: string;
}

export interface ModelMetric {
  name: string;
  value: number;
  target: number;
  unit?: string;
  status: 'good' | 'optimal' | 'warning';
}

export interface FeatureImportance {
  feature: string;
  importance: number; // 0 to 1
  description: string;
}

export interface ModelEvaluationData {
  modelName: string;
  algorithm: string;
  version: string;
  lastTrained: string;
  datasetSamples: number;
  r2Score: number;
  rmse: number;
  mae: number;
  evs: number; // Explained Variance Score
  features: FeatureImportance[];
  residualBins: { range: string; count: number }[];
}

export interface DailyReportData {
  id: string;
  date: string;
  totalEnergyGeneratedWh: number;
  theoreticalEnergyWh: number;
  performanceRatioPct: number;
  peakPowerWatts: number;
  peakIrradianceWm2: number;
  avgCellTempC: number;
  maxCellTempC: number;
  sunshineHours: number;
  co2AvoidedKg: number;
  healthGrade: 'A+' | 'A' | 'B' | 'C' | 'D' | 'F';
  anomaliesDetected: number;
  summaryNotes: string;
}
