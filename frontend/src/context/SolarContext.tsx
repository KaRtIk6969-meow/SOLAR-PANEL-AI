'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { 
  TelemetryReading, 
  DeviceInfo, 
  PanelHealth, 
  AlertItem, 
  ModelEvaluationData, 
  DailyReportData, 
  SimulationScenario,
  DataSource,
  PredictionItem
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
import {
  getLatestTelemetry,
  getHistoricalTelemetry,
  getDeviceStatus,
  getAlerts,
  getPredictions,
  getLatestHealthScore,
  getModelStatus,
  resolveAlertInBackend,
  mapBackendTelemetryToDomain,
  mapBackendAlertToDomain,
  mapBackendHealthToDomain,
} from '@/lib/api';

interface SolarContextType {
  telemetry: TelemetryReading | null;
  history: TelemetryReading[];
  device: DeviceInfo;
  alerts: AlertItem[];
  predictions: PredictionItem[];
  health: PanelHealth | null;
  modelEval: ModelEvaluationData;
  reports: DailyReportData[];
  scenario: SimulationScenario;
  setScenario: (scenario: SimulationScenario) => void;
  isSimulated: boolean;
  setIsSimulated: (val: boolean) => void;
  isLiveStreaming: boolean;
  setIsLiveStreaming: (val: boolean) => void;
  dataSource: DataSource;
  setDataSource: (source: DataSource) => void;
  isLoading: boolean;
  isError: boolean;
  errorMessage: string | null;
  isDeviceOffline: boolean;
  lastSuccessfulUpdate: Date | null;
  lastUpdated: Date;
  resolveAlert: (id: string) => Promise<void>;
  refreshData: () => Promise<void>;
  deviceId: string;
  setDeviceId: (id: string) => void;
}

const SolarContext = createContext<SolarContextType | undefined>(undefined);

export function SolarProvider({ children }: { children: React.ReactNode }) {
  const [deviceId, setDeviceId] = useState<string>('SOLAR-ESP32-01');
  const [dataSource, setDataSource] = useState<DataSource>('api'); // Default to live FastAPI backend
  const [scenario, setScenario] = useState<SimulationScenario>('normal');
  const [isSimulated, setIsSimulated] = useState<boolean>(false);
  const [isLiveStreaming, setIsLiveStreaming] = useState<boolean>(true);
  
  // Loading & error states
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isError, setIsError] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDeviceOffline, setIsDeviceOffline] = useState<boolean>(false);
  const [lastSuccessfulUpdate, setLastSuccessfulUpdate] = useState<Date | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date>(() => new Date('2026-10-20T12:00:00.000Z'));

  // Update to client clock on mount
  useEffect(() => {
    setLastUpdated(new Date());
  }, []);

  // Domain data
  const [telemetry, setTelemetry] = useState<TelemetryReading | null>(null);
  const [history, setHistory] = useState<TelemetryReading[]>([]);
  const [device, setDevice] = useState<DeviceInfo>(() => ({
    ...mockDeviceInfo,
    id: 'SOLAR-ESP32-01',
    status: 'OFFLINE',
  }));
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [predictions, setPredictions] = useState<PredictionItem[]>([]);
  const [health, setHealth] = useState<PanelHealth | null>(null);
  const [modelEval, setModelEval] = useState<ModelEvaluationData>(mockModelEvaluation);
  const [reports] = useState<DailyReportData[]>(mockDailyReports);

  // -------------------------------------------------------------
  // Primary API Data Fetcher
  // -------------------------------------------------------------
  const fetchFromApi = useCallback(async (isInitial = false) => {
    if (isInitial) setIsLoading(true);
    setLastUpdated(new Date());

    try {
      // Execute parallel queries against FastAPI backend
      const [
        latestData,
        historyData,
        deviceStatusData,
        alertsData,
        predsData,
        healthScoreData,
        modelStatusData,
      ] = await Promise.all([
        getLatestTelemetry(deviceId),
        getHistoricalTelemetry(deviceId, 60),
        getDeviceStatus(deviceId),
        getAlerts(deviceId, 50),
        getPredictions(deviceId, 20),
        getLatestHealthScore(deviceId),
        getModelStatus(),
      ]);

      const now = new Date();

      // Check if backend or device responded
      if (!latestData && !deviceStatusData) {
        // Device or backend unreachable / no records
        setIsDeviceOffline(true);
        setIsError(true);
        setErrorMessage('Cannot establish link to ESP32 / FastAPI backend.');
        setDevice(prev => ({ ...prev, status: 'OFFLINE' }));
        // Note: Do NOT fill in fake data when offline.
        setIsLoading(false);
        return;
      }

      setIsError(false);
      setErrorMessage(null);

      // 1. Process Device Status
      const isOfflineStatus = deviceStatusData ? deviceStatusData.status === 'OFFLINE' : false;
      setIsDeviceOffline(isOfflineStatus);

      setDevice(prev => ({
        ...prev,
        id: deviceId,
        name: deviceStatusData?.device_name || prev.name,
        status: (deviceStatusData?.status as any) || (latestData ? 'ONLINE' : 'OFFLINE'),
        lastSeen: deviceStatusData?.last_seen_at || latestData?.timestamp || prev.lastSeen,
      }));

      // 2. Process Telemetry Reading
      if (latestData) {
        const domainTelemetry = mapBackendTelemetryToDomain(latestData);
        setTelemetry(domainTelemetry);
        setLastSuccessfulUpdate(new Date(latestData.timestamp || now));
      } else {
        setTelemetry(null);
      }

      // 3. Process Historical Series (chronological order for Recharts)
      if (historyData && historyData.length > 0) {
        const domainHistory = historyData
          .map(item => mapBackendTelemetryToDomain(item))
          .reverse();
        setHistory(domainHistory);
      } else {
        setHistory([]);
      }

      // 4. Process Alerts
      if (alertsData) {
        const domainAlerts = alertsData.map(mapBackendAlertToDomain);
        setAlerts(domainAlerts);
      }

      // 5. Process Predictions
      if (predsData) {
        setPredictions(predsData.map(p => ({
          id: String(p.id),
          timestamp: p.timestamp,
          target: p.target,
          predictedValue: p.predicted_value,
          actualValue: p.actual_value,
          residual: p.residual,
          deviationPct: p.deviation_pct,
          alertStatus: p.alert_status,
          modelVersion: p.model_version,
        })));
      }

      // 6. Process Health Score
      if (healthScoreData) {
        setHealth(mapBackendHealthToDomain(healthScoreData));
      } else if (historyData && historyData.length > 0) {
        // Fallback: derive health from real historical readings
        const domainHist = historyData.map(item => mapBackendTelemetryToDomain(item));
        setHealth(calculatePanelHealth(domainHist));
      } else {
        setHealth(null);
      }

      // 7. Process Real AI Model Deployment Metadata
      if (modelStatusData?.active_model) {
        const am = modelStatusData.active_model;
        const algoDisplay = am.model_name.includes('XGB') 
          ? 'Gradient Boosted Decision Trees (XGBoost)' 
          : (am.model_name.includes('RandomForest') ? 'Random Forest Ensemble Regressor' : 'Linear Regression');

        setModelEval({
          modelName: am.model_name,
          algorithm: algoDisplay,
          version: am.model_version,
          lastTrained: am.training_timestamp ? new Date(am.training_timestamp).toLocaleString() : 'Active',
          datasetSamples: am.dataset_size,
          r2Score: am.r2_score,
          rmse: am.rmse,
          mae: am.mae,
          evs: am.r2_score,
          features: [
            { feature: 'Solar Irradiance (G)', importance: 0.582, description: 'Primary driver of photo-generation' },
            { feature: 'Cell Temperature (T_cell)', importance: 0.174, description: 'Negative semiconductor bandgap derating' },
            { feature: 'Array Voltage (V)', importance: 0.142, description: 'Array terminal voltage' },
            { feature: 'Load Current (I)', importance: 0.102, description: 'Load current output' },
          ],
          residualBins: mockModelEvaluation.residualBins,
        });
      }

    } catch (err) {
      console.error('[SolarContext] API Sync Error:', err);
      setIsDeviceOffline(true);
      setIsError(true);
      setErrorMessage('Network error communicating with SolarAI API');
      setDevice(prev => ({ ...prev, status: 'OFFLINE' }));
    } finally {
      setIsLoading(false);
    }
  }, [deviceId]);

  // -------------------------------------------------------------
  // Mock Data Handler (Preserved for Demo / Simulation Mode)
  // -------------------------------------------------------------
  const handleScenarioChange = useCallback((newScenario: SimulationScenario) => {
    setScenario(newScenario);
    if (dataSource === 'mock') {
      const newHist = generate24HourHistory(newScenario);
      setHistory(newHist);
      const latest = generateReading(newScenario);
      setTelemetry(latest);
      setHealth(calculatePanelHealth(newHist));
      setModelEval(mockModelEvaluation);
      setLastSuccessfulUpdate(new Date());
      setLastUpdated(new Date());
    }
  }, [dataSource]);

  // Initial mount trigger
  useEffect(() => {
    if (dataSource === 'api') {
      fetchFromApi(true);
    } else {
      // Mock mode initialization
      setTelemetry(generateReading('normal'));
      const mockHist = generate24HourHistory('normal');
      setHistory(mockHist);
      setHealth(calculatePanelHealth(mockHist));
      setAlerts(mockAlerts);
      setDevice({ ...mockDeviceInfo, status: 'SIMULATED' });
      setIsDeviceOffline(false);
      setIsLoading(false);
      setLastSuccessfulUpdate(new Date());
    }
  }, [dataSource, fetchFromApi]);

  // -------------------------------------------------------------
  // Periodic Polling / Streaming Loop
  // -------------------------------------------------------------
  useEffect(() => {
    if (!isLiveStreaming) return;

    if (dataSource === 'api') {
      // Poll FastAPI backend every 4 seconds for fresh real hardware telemetry
      const interval = setInterval(() => {
        fetchFromApi(false);
      }, 4000);
      return () => clearInterval(interval);
    } else {
      // Mock streaming loop
      const interval = setInterval(() => {
        const newReading = generateReading(scenario);
        setTelemetry(newReading);
        setLastSuccessfulUpdate(new Date());
        setLastUpdated(new Date());
        setHistory(prev => {
          if (prev.length === 0) return [newReading];
          return [...prev.slice(1), newReading];
        });
      }, 3000);
      return () => clearInterval(interval);
    }
  }, [isLiveStreaming, dataSource, scenario, fetchFromApi]);

  // Alert resolver
  const resolveAlert = useCallback(async (id: string) => {
    if (dataSource === 'api') {
      await resolveAlertInBackend(id);
    }
    setAlerts(prev => prev.map(alert => 
      alert.id === id 
        ? { ...alert, isResolved: true, resolvedAt: new Date().toISOString() } 
        : alert
    ));
  }, [dataSource]);

  // Manual refresh trigger
  const refreshData = useCallback(async () => {
    if (dataSource === 'api') {
      await fetchFromApi(false);
    } else {
      const updated = generateReading(scenario);
      setTelemetry(updated);
      setLastSuccessfulUpdate(new Date());
      setLastUpdated(new Date());
    }
  }, [dataSource, scenario, fetchFromApi]);

  return (
    <SolarContext.Provider
      value={{
        telemetry,
        history,
        device,
        alerts,
        predictions,
        health,
        modelEval,
        reports,
        scenario,
        setScenario: handleScenarioChange,
        isSimulated,
        setIsSimulated,
        isLiveStreaming,
        setIsLiveStreaming,
        dataSource,
        setDataSource,
        isLoading,
        isError,
        errorMessage,
        isDeviceOffline,
        lastSuccessfulUpdate,
        lastUpdated,
        resolveAlert,
        refreshData,
        deviceId,
        setDeviceId,
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
