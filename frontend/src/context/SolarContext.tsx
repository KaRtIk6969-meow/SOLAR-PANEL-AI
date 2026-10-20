'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { 
  TelemetryReading, 
  DeviceInfo, 
  PanelHealth, 
  AlertItem, 
  ModelEvaluationData, 
  DailyReportData, 
  SimulationScenario 
} from '@/types/solar';
import { 
  generateReading, 
  generate24HourHistory, 
  calculatePanelHealth, 
  mockDeviceInfo, 
  mockAlerts, 
  mockModelEvaluation, 
  mockDailyReports 
} from '@/lib/mock-data';

interface SolarContextType {
  telemetry: TelemetryReading;
  history: TelemetryReading[];
  device: DeviceInfo;
  alerts: AlertItem[];
  health: PanelHealth;
  modelEval: ModelEvaluationData;
  reports: DailyReportData[];
  scenario: SimulationScenario;
  setScenario: (scenario: SimulationScenario) => void;
  isSimulated: boolean;
  setIsSimulated: (val: boolean) => void;
  isLiveStreaming: boolean;
  setIsLiveStreaming: (val: boolean) => void;
  resolveAlert: (id: string) => void;
  refreshData: () => void;
  lastUpdated: Date;
}

const SolarContext = createContext<SolarContextType | undefined>(undefined);

export function SolarProvider({ children }: { children: React.ReactNode }) {
  const [scenario, setScenario] = useState<SimulationScenario>('normal');
  const [isSimulated, setIsSimulated] = useState<boolean>(true);
  const [isLiveStreaming, setIsLiveStreaming] = useState<boolean>(true);
  const [device, setDevice] = useState<DeviceInfo>(mockDeviceInfo);
  const [alerts, setAlerts] = useState<AlertItem[]>(mockAlerts);
  const [modelEval] = useState<ModelEvaluationData>(mockModelEvaluation);
  const [reports] = useState<DailyReportData[]>(mockDailyReports);
  const [lastUpdated, setLastUpdated] = useState<Date>(() => new Date('2026-10-20T11:30:00.000Z'));

  // Initialize on client mount
  useEffect(() => {
    setLastUpdated(new Date());
  }, []);

  // Initialize history based on active scenario
  const [history, setHistory] = useState<TelemetryReading[]>(() => generate24HourHistory('normal'));

  // Initialize current telemetry
  const [telemetry, setTelemetry] = useState<TelemetryReading>(() => generateReading('normal'));

  // Calculate panel health dynamically from history
  const health = useMemo(() => calculatePanelHealth(history), [history]);

  // When scenario changes, immediately re-generate history & current telemetry
  const handleScenarioChange = useCallback((newScenario: SimulationScenario) => {
    setScenario(newScenario);
    const newHist = generate24HourHistory(newScenario);
    setHistory(newHist);
    const latest = generateReading(newScenario);
    setTelemetry(latest);
    setLastUpdated(new Date());

    // Auto-generate realistic alerts if a fault scenario is triggered
    if (newScenario === 'soiling') {
      const soilingAlert: AlertItem = {
        id: `soiling-${Date.now()}`,
        timestamp: new Date().toISOString(),
        severity: 'warning',
        type: 'soiling_dust',
        title: 'Dust / Soiling Accumulation Injected',
        description: 'Output dropped by ~18% relative to AI expected baseline across high-sun hours.',
        metricName: 'Power Delta',
        metricValue: -16.8,
        expectedValue: 88.0,
        unit: 'W',
        recommendedAction: 'Clean surface glass with demineralized water or soft wipe.',
        isResolved: false,
      };
      setAlerts(prev => [soilingAlert, ...prev.filter(a => a.id !== soilingAlert.id)]);
    } else if (newScenario === 'open_circuit') {
      const openAlert: AlertItem = {
        id: `open-${Date.now()}`,
        timestamp: new Date().toISOString(),
        severity: 'critical',
        type: 'open_circuit',
        title: 'Open Circuit / Load Disconnected',
        description: 'Voltage clamped at open circuit (Voc: 21.8V) with near-zero current (0.02A).',
        metricName: 'Current',
        metricValue: 0.02,
        expectedValue: 5.20,
        unit: 'A',
        recommendedAction: 'Check terminal screws, load fuses, and shunt resistor continuity.',
        isResolved: false,
      };
      setAlerts(prev => [openAlert, ...prev.filter(a => a.id !== openAlert.id)]);
    } else if (newScenario === 'shading') {
      const shadeAlert: AlertItem = {
        id: `shade-${Date.now()}`,
        timestamp: new Date().toISOString(),
        severity: 'info',
        type: 'partial_shading',
        title: 'Partial Shading Injected',
        description: 'Sudden optical obstruction registered. Significant current dip across parallel cells.',
        metricName: 'Irradiance',
        metricValue: 320,
        expectedValue: 920,
        unit: 'W/m²',
        recommendedAction: 'Inspect array perimeter for shadows from trees or neighboring structures.',
        isResolved: false,
      };
      setAlerts(prev => [shadeAlert, ...prev.filter(a => a.id !== shadeAlert.id)]);
    }
  }, []);

  // Periodic live telemetry simulation tick (every 3 seconds)
  useEffect(() => {
    if (!isLiveStreaming) return;

    const interval = setInterval(() => {
      const newReading = generateReading(scenario);
      setTelemetry(newReading);
      setLastUpdated(new Date());

      // Update history buffer: update the last point or append
      setHistory(prev => {
        if (prev.length === 0) return [newReading];
        const next = [...prev.slice(1), newReading];
        return next;
      });

      // Update device heartbeat
      setDevice(prev => ({
        ...prev,
        lastSeen: new Date().toISOString(),
        status: 'ONLINE',
      }));
    }, 3000);

    return () => clearInterval(interval);
  }, [isLiveStreaming, scenario]);

  const resolveAlert = useCallback((id: string) => {
    setAlerts(prev => prev.map(alert => 
      alert.id === id 
        ? { ...alert, isResolved: true, resolvedAt: new Date().toISOString() } 
        : alert
    ));
  }, []);

  const refreshData = useCallback(() => {
    const updated = generateReading(scenario);
    setTelemetry(updated);
    setLastUpdated(new Date());
  }, [scenario]);

  return (
    <SolarContext.Provider
      value={{
        telemetry,
        history,
        device,
        alerts,
        health,
        modelEval,
        reports,
        scenario,
        setScenario: handleScenarioChange,
        isSimulated,
        setIsSimulated,
        isLiveStreaming,
        setIsLiveStreaming,
        resolveAlert,
        refreshData,
        lastUpdated,
      }}
    >
      {children}
    </SolarContext.Provider>
  );
}

export function useSolar() {
  const context = useContext(SolarContext);
  if (!context) {
    throw new Error('useSolar must be used within a SolarProvider');
  }
  return context;
}
