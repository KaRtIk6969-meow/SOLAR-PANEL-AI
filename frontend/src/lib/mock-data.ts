import { 
  TelemetryReading, 
  DeviceInfo, 
  PanelHealth, 
  AlertItem, 
  ModelEvaluationData, 
  DailyReportData, 
  SimulationScenario 
} from '@/types/solar';

// Physical constants for our standardized 100W Monocrystalline PV Panel
export const PANEL_SPECS = {
  ratedPower: 100.0,       // Watts at STC (1000 W/m², 25°C)
  panelArea: 0.62,         // m²
  stcEfficiency: 0.178,    // 17.8% base cell efficiency
  tempCoefficient: -0.0038,// -0.38% power loss per °C above 25°C
  voc: 21.8,               // Open-circuit voltage (V)
  isc: 5.85,               // Short-circuit current (A)
  vmp: 18.4,               // Max-power voltage (V)
  imp: 5.43,               // Max-power current (A)
  noct: 46.0,              // Nominal Operating Cell Temp (°C)
};

/**
 * Computes theoretical physics-based solar power using standard PV equation:
 * P = Area * Irradiance * Efficiency_STC * [1 + TempCoeff * (T_cell - 25)]
 */
export function calculateTheoreticalPower(irradiance: number, cellTemp: number): number {
  if (irradiance <= 5) return 0;
  const tempCorrection = 1 + PANEL_SPECS.tempCoefficient * (cellTemp - 25);
  const rawPower = PANEL_SPECS.panelArea * irradiance * PANEL_SPECS.stcEfficiency * tempCorrection;
  return Math.max(0, Math.round(rawPower * 100) / 100);
}

/**
 * Simulates ambient temperature (°C) for a given 24-hour decimal time
 */
export function getAmbientTempForHour(hour: number): number {
  // Low around 05:00 (19°C), peak around 15:00 (31°C)
  const angle = ((hour - 5) / 24) * 2 * Math.PI;
  return 25 + 6 * Math.sin(angle);
}

/**
 * Simulates clear-sky solar irradiance (W/m²) for a given 24-hour decimal time
 */
export function getSolarIrradianceForHour(hour: number): number {
  // Sunrise at ~06:00, peak at 12:30 (~920 W/m²), sunset at ~18:45
  if (hour < 6.0 || hour > 18.75) return 0;
  const daylightSpan = 18.75 - 6.0; // 12.75 hours
  const normalized = (hour - 6.0) / daylightSpan; // 0 to 1
  const peakIrradiance = 940;
  const curve = Math.sin(normalized * Math.PI);
  return Math.max(0, Math.round(peakIrradiance * Math.pow(curve, 1.2)));
}

/**
 * Simulates cell temperature based on ambient temperature and irradiance
 */
export function getCellTemp(ambientTemp: number, irradiance: number): number {
  // NOCT formula: T_cell = T_amb + G * (NOCT - 20) / 800
  const rise = (irradiance * (PANEL_SPECS.noct - 20)) / 800;
  return Math.round((ambientTemp + rise) * 10) / 10;
}

/**
 * Generate a single realistic telemetry reading under a given scenario
 */
export function generateReading(
  scenario: SimulationScenario = 'normal',
  simulatedHour?: number,
  baseDate?: Date
): TelemetryReading {
  const currentHour = simulatedHour !== undefined 
    ? simulatedHour 
    : (baseDate ? baseDate.getHours() + baseDate.getMinutes() / 60 : 12.5);

  const timestamp = baseDate ? baseDate.toISOString() : '2026-10-20T12:30:00.000Z';

  let baseIrradiance = getSolarIrradianceForHour(currentHour);
  let ambientTemp = getAmbientTempForHour(currentHour);

  // Apply scenario modifications
  let faultMultiplier = 1.0;
  let voltageOffset = 0;
  let currentOffset = 0;
  let tempBoost = 0;

// Deterministic pseudo-noise function to ensure static prerendering compliance
function pseudoNoise(seed: number): number {
  const s = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return (s - Math.floor(s)) - 0.5;
}

  switch (scenario) {
    case 'soiling':
      // 18% loss due to dust accumulation
      faultMultiplier = 0.82;
      break;
    case 'shading':
      // Severe transient shading (e.g. tree/building obstruction)
      baseIrradiance = Math.max(80, baseIrradiance * 0.35);
      faultMultiplier = 0.40;
      break;
    case 'heatwave':
      ambientTemp += 12; // 43°C hot day
      tempBoost = 8;
      faultMultiplier = 0.90;
      break;
    case 'open_circuit':
      // Open circuit: High voltage, zero current
      voltageOffset = 3.2; // Rises towards Voc
      currentOffset = -999; // Will clamp current to ~0
      faultMultiplier = 0.02;
      break;
    case 'sensor_drift':
      // Sensor reading calibration jitter
      voltageOffset = pseudoNoise(currentHour * 3.1) * 2.5;
      faultMultiplier = 0.88;
      break;
    case 'normal':
    default:
      faultMultiplier = 0.98; // Minor optical dust / real-world factor
      break;
  }

  // Subtle natural solar jitter (± 1.5%)
  const jitter = 1 + pseudoNoise(currentHour * 5.7) * 0.03;
  const irradiance = Math.round(baseIrradiance * jitter);
  const cellTemp = Math.round((getCellTemp(ambientTemp, irradiance) + tempBoost) * 10) / 10;

  // Theoretical physics baseline
  const theoreticalPower = calculateTheoreticalPower(irradiance, cellTemp);

  // AI Predicted Power (Trained XGBoost equivalent: learned non-linear optical & temperature response)
  const aiExpected = theoreticalPower > 0 
    ? Math.max(0, Math.round(theoreticalPower * 0.97 * (1 + pseudoNoise(currentHour * 9.3) * 0.02) * 10) / 10)
    : 0;

  // Electrical derivation
  let current = 0;
  let voltage = 0;

  if (irradiance > 15) {
    // Current is primarily proportional to irradiance
    const rawCurrent = (irradiance / 1000) * PANEL_SPECS.imp * faultMultiplier;
    current = Math.max(0.02, Math.round((rawCurrent + currentOffset) * 100) / 100);

    // Voltage is relatively stable with minor negative temp derating
    const tempDerate = 1 - 0.003 * (cellTemp - 25);
    const rawVoltage = PANEL_SPECS.vmp * tempDerate + voltageOffset + pseudoNoise(currentHour * 13.1) * 0.15;
    voltage = Math.max(0.5, Math.round(rawVoltage * 100) / 100);

    if (scenario === 'open_circuit') {
      current = 0.03; // tiny leakage
      voltage = PANEL_SPECS.voc;
    }
  } else {
    // Night time / low light
    voltage = 0.45;
    current = 0.01;
  }

  const power = Math.round(voltage * current * 100) / 100;
  const residual = Math.round((power - aiExpected) * 100) / 100;
  
  // Instantaneous efficiency = (Power / (Area * Irradiance)) * 100
  const efficiency = irradiance > 50
    ? Math.min(24, Math.max(0, Math.round((power / (PANEL_SPECS.panelArea * irradiance)) * 1000) / 10))
    : 0;

  return {
    id: `rd-sample-${Math.floor(currentHour * 100)}`,
    timestamp,
    voltage,
    current,
    power,
    temperature: cellTemp,
    ambientTemp: Math.round(ambientTemp * 10) / 10,
    irradiance,
    efficiency,
    theoreticalPower,
    predictedPower: aiExpected,
    residual,
    isMock: true,
  };
}

/**
 * Generate 24-hour diurnal historical curve (48 half-hour steps)
 */
export function generate24HourHistory(scenario: SimulationScenario = 'normal'): TelemetryReading[] {
  const points: TelemetryReading[] = [];
  const baseDate = new Date('2026-10-20T00:00:00.000Z');

  for (let i = 0; i <= 48; i++) {
    const hour = i * 0.5;
    const ptDate = new Date(baseDate.getTime() + hour * 3600 * 1000);

    const reading = generateReading(scenario, hour, ptDate);
    reading.timestamp = ptDate.toISOString();
    points.push(reading);
  }

  return points;
}

/**
 * Default simulated ESP32 device node
 */
export const mockDeviceInfo: DeviceInfo = {
  id: 'ESP32-SOLAR-PRO-01',
  name: 'Rooftop Array 01 (ESP32-WROOM-32D)',
  status: 'ONLINE',
  lastSeen: '2026-10-20T11:30:00.000Z',
  ratedPower: PANEL_SPECS.ratedPower,
  panelArea: PANEL_SPECS.panelArea,
  tempCoeff: PANEL_SPECS.tempCoefficient,
  firmwareVersion: 'v2.4.1-iot-release',
  ipAddress: '192.168.1.142',
  rssi: -62,
  macAddress: 'C4:4F:33:8A:1B:9E',
  uptimeHours: 342.8,
};

/**
 * Calculate dynamic panel health score from recent readings
 */
export function calculatePanelHealth(readings: TelemetryReading[]): PanelHealth {
  if (readings.length === 0) {
    return {
      overallScore: 94,
      grade: 'A',
      thermalLossPct: 4.2,
      soilingLossPct: 3.5,
      shadingLossPct: 1.2,
      degradationRateAnnual: 0.55,
      healthStatusText: 'Optimal Operating Condition',
    };
  }

  // Filter daylight readings with irradiance > 250 W/m²
  const validSunReadings = readings.filter(r => r.irradiance > 250 && r.predictedPower > 5);
  
  if (validSunReadings.length === 0) {
    return {
      overallScore: 92,
      grade: 'A',
      thermalLossPct: 0,
      soilingLossPct: 4.0,
      shadingLossPct: 0,
      degradationRateAnnual: 0.55,
      healthStatusText: 'Night Standby Mode',
    };
  }

  const avgRatio = validSunReadings.reduce((sum, r) => sum + (r.power / r.predictedPower), 0) / validSunReadings.length;
  const overallScore = Math.min(100, Math.max(10, Math.round(avgRatio * 98)));

  let grade: PanelHealth['grade'] = 'A';
  let healthStatusText = 'Optimal Condition';

  if (overallScore >= 93) { grade = 'A+'; healthStatusText = 'Peak Clean Performance'; }
  else if (overallScore >= 87) { grade = 'A'; healthStatusText = 'Normal Efficient Operation'; }
  else if (overallScore >= 78) { grade = 'B'; healthStatusText = 'Mild Dust / Minor Derating'; }
  else if (overallScore >= 65) { grade = 'C'; healthStatusText = 'Noticeable Loss (Cleaning Recommended)'; }
  else if (overallScore >= 50) { grade = 'D'; healthStatusText = 'Substantial Defect or Obstruction'; }
  else { grade = 'F'; healthStatusText = 'Critical Hardware / Sensor Fault'; }

  const avgTemp = validSunReadings.reduce((s, r) => s + r.temperature, 0) / validSunReadings.length;
  const thermalLossPct = Math.max(0, Math.round(Math.max(0, avgTemp - 25) * 0.38 * 10) / 10);
  const opticalLoss = Math.max(0, Math.round((1 - avgRatio) * 100 * 10) / 10);
  const soilingLossPct = Math.min(25, Math.round(opticalLoss * 0.7 * 10) / 10);
  const shadingLossPct = Math.min(30, Math.round(opticalLoss * 0.3 * 10) / 10);

  return {
    overallScore,
    grade,
    thermalLossPct,
    soilingLossPct,
    shadingLossPct,
    degradationRateAnnual: 0.55,
    healthStatusText,
  };
}

/**
 * Pre-configured realistic alerts dataset
 */
export const mockAlerts: AlertItem[] = [
  {
    id: 'alt-001',
    timestamp: '2026-10-20T11:15:00.000Z',
    severity: 'warning',
    type: 'soiling_dust',
    title: 'Dust / Soiling Accumulation Detected',
    description: 'Actual generation is 16.4% below the AI expected clear-sky baseline for the past 45 minutes.',
    metricName: 'Output Delta',
    metricValue: -14.2,
    expectedValue: 86.5,
    unit: 'W',
    recommendedAction: 'Clean surface glass with demineralized water or micro-fiber cloth to restore 14W lost power.',
    isResolved: false,
  },
  {
    id: 'alt-002',
    timestamp: '2026-10-20T09:45:00.000Z',
    severity: 'info',
    type: 'partial_shading',
    title: 'Transient Diagonal Shading Event',
    description: 'Local optical dip detected between 10:15 and 11:00 AM matching fixed obstacle shadow profile.',
    metricName: 'Current Drop',
    metricValue: 2.15,
    expectedValue: 4.80,
    unit: 'A',
    recommendedAction: 'Inspect rooftop perimeter for newly grown tree branches or conduit shadows.',
    isResolved: true,
    resolvedAt: '2026-10-20T10:30:00.000Z',
  },
  {
    id: 'alt-003',
    timestamp: '2026-10-20T06:00:00.000Z',
    severity: 'critical',
    type: 'open_circuit',
    title: 'Zero Current Load Disconnect',
    description: 'Panel open-circuit voltage recorded at 21.4V while current abruptly collapsed to 0.02A.',
    metricName: 'Current',
    metricValue: 0.02,
    expectedValue: 5.10,
    unit: 'A',
    recommendedAction: 'Check terminal block screw tightness, load fuse, and shunt wiring.',
    isResolved: true,
    resolvedAt: '2026-10-20T06:45:00.000Z',
  },
];

/**
 * AI Model Evaluation Metrics (XGBoost Regressor benchmarked against NREL Solar Baseline)
 */
export const mockModelEvaluation: ModelEvaluationData = {
  modelName: 'SolarAI XGBoost Regressor',
  algorithm: 'Gradient Boosted Decision Trees (XGBoost v2.0)',
  version: 'v1.4.2-prod',
  lastTrained: '2026-10-14 16:30 UTC',
  datasetSamples: 48620,
  r2Score: 0.976,
  rmse: 2.68,
  mae: 1.84,
  evs: 0.978,
  features: [
    { feature: 'Solar Irradiance (G)', importance: 0.582, description: 'Primary driver of photo-generation' },
    { feature: 'Cell Temperature (T_cell)', importance: 0.174, description: 'Negative semiconductor bandgap derating' },
    { feature: 'Irradiance x Temp Interaction', importance: 0.096, description: 'Combined optical-thermal coupling' },
    { feature: 'Rolling 30m Irradiance Avg', importance: 0.082, description: 'Thermal inertia and cloud dynamics' },
    { feature: 'Solar Elevation Angle Proxy', importance: 0.045, description: 'Reflectance & angle of incidence' },
    { feature: 'Ambient Humidity Proxy', importance: 0.021, description: 'Atmospheric diffuse radiation ratio' },
  ],
  residualBins: [
    { range: '-8W to -6W', count: 124 },
    { range: '-6W to -4W', count: 480 },
    { range: '-4W to -2W', count: 2150 },
    { range: '-2W to 0W', count: 7890 },
    { range: '0W to +2W', count: 8210 },
    { range: '+2W to +4W', count: 1980 },
    { range: '+4W to +6W', count: 390 },
    { range: '+6W to +8W', count: 95 },
  ],
};

/**
 * 7-Day Historical Daily Reports
 */
export const mockDailyReports: DailyReportData[] = [
  {
    id: 'rep-2026-10-19',
    date: '2026-10-19',
    totalEnergyGeneratedWh: 612.4,
    theoreticalEnergyWh: 648.0,
    performanceRatioPct: 94.5,
    peakPowerWatts: 92.4,
    peakIrradianceWm2: 955,
    avgCellTempC: 38.6,
    maxCellTempC: 51.2,
    sunshineHours: 8.8,
    co2AvoidedKg: 0.43,
    healthGrade: 'A+',
    anomaliesDetected: 0,
    summaryNotes: 'Ideal clear-sky production. Panel operating at peak theoretical capacity.',
  },
  {
    id: 'rep-2026-10-18',
    date: '2026-10-18',
    totalEnergyGeneratedWh: 540.2,
    theoreticalEnergyWh: 635.0,
    performanceRatioPct: 85.1,
    peakPowerWatts: 82.1,
    peakIrradianceWm2: 930,
    avgCellTempC: 39.8,
    maxCellTempC: 52.4,
    sunshineHours: 8.5,
    co2AvoidedKg: 0.38,
    healthGrade: 'B',
    anomaliesDetected: 1,
    summaryNotes: 'Minor dust accumulation flagged after afternoon wind. Cleaned evening.',
  },
  {
    id: 'rep-2026-10-17',
    date: '2026-10-17',
    totalEnergyGeneratedWh: 420.8,
    theoreticalEnergyWh: 450.0,
    performanceRatioPct: 93.5,
    peakPowerWatts: 74.5,
    peakIrradianceWm2: 780,
    avgCellTempC: 32.1,
    maxCellTempC: 41.5,
    sunshineHours: 6.2,
    co2AvoidedKg: 0.29,
    healthGrade: 'A',
    anomaliesDetected: 0,
    summaryNotes: 'Overcast morning with passing cumulus clouds. AI tracking matched actual output.',
  },
  {
    id: 'rep-2026-10-16',
    date: '2026-10-16',
    totalEnergyGeneratedWh: 598.6,
    theoreticalEnergyWh: 630.0,
    performanceRatioPct: 95.0,
    peakPowerWatts: 90.8,
    peakIrradianceWm2: 945,
    avgCellTempC: 37.4,
    maxCellTempC: 49.8,
    sunshineHours: 8.7,
    co2AvoidedKg: 0.42,
    healthGrade: 'A+',
    anomaliesDetected: 0,
    summaryNotes: 'High yield sunny day. Stable MPPT tracking and optimal thermal convection.',
  },
  {
    id: 'rep-2026-10-15',
    date: '2026-10-15',
    totalEnergyGeneratedWh: 485.1,
    theoreticalEnergyWh: 620.0,
    performanceRatioPct: 78.2,
    peakPowerWatts: 79.2,
    peakIrradianceWm2: 920,
    avgCellTempC: 40.2,
    maxCellTempC: 54.0,
    sunshineHours: 8.4,
    co2AvoidedKg: 0.34,
    healthGrade: 'C',
    anomaliesDetected: 2,
    summaryNotes: 'Heavy afternoon dust storm triggered soiling alert. Surface washed following day.',
  },
  {
    id: 'rep-2026-10-14',
    date: '2026-10-14',
    totalEnergyGeneratedWh: 588.0,
    theoreticalEnergyWh: 615.0,
    performanceRatioPct: 95.6,
    peakPowerWatts: 89.6,
    peakIrradianceWm2: 935,
    avgCellTempC: 36.8,
    maxCellTempC: 48.9,
    sunshineHours: 8.6,
    co2AvoidedKg: 0.41,
    healthGrade: 'A+',
    anomaliesDetected: 0,
    summaryNotes: 'Smooth diurnal curve with zero electrical or sensor interruptions.',
  },
  {
    id: 'rep-2026-10-13',
    date: '2026-10-13',
    totalEnergyGeneratedWh: 574.5,
    theoreticalEnergyWh: 610.0,
    performanceRatioPct: 94.2,
    peakPowerWatts: 88.0,
    peakIrradianceWm2: 925,
    avgCellTempC: 37.1,
    maxCellTempC: 49.2,
    sunshineHours: 8.5,
    co2AvoidedKg: 0.40,
    healthGrade: 'A',
    anomaliesDetected: 0,
    summaryNotes: 'Normal operations recorded. System efficiency well within predicted margins.',
  },
];
