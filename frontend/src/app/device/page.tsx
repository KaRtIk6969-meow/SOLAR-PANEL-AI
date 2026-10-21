'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useSolar } from '@/context/SolarContext';
import { 
  Cpu, 
  Wifi, 
  Terminal, 
  Copy, 
  Check, 
  ShieldCheck, 
  Radio,
  Download,
  Trash2,
  Play,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Database,
  Layers,
  Activity,
  Zap,
  Gauge,
  HelpCircle,
  FileSpreadsheet,
  Brain,
  Sparkles,
  Network,
  FileCode,
  ArrowUpRight,
  Sliders,
  Info,
  CheckCircle
} from 'lucide-react';
import { 
  getDeviceTelemetryStats, 
  getHistoricalTelemetry, 
  injectDemoTestTelemetry, 
  clearDemoTelemetry, 
  getExportCsvUrl,
  getNetworkInfo,
  trainModels,
  BackendDeviceTelemetryStatsResponse,
  BackendTelemetryResponse,
  BackendNetworkInfoResponse,
  BackendTrainResponse
} from '@/lib/api';

export default function DevicePage() {
  const { device, telemetry, isDeviceOffline, lastSuccessfulUpdate, dataSource } = useSolar();
  const [mounted, setMounted] = useState(false);
  const [stats, setStats] = useState<BackendDeviceTelemetryStatsResponse | null>(null);
  const [recentReadings, setRecentReadings] = useState<BackendTelemetryResponse[]>([]);
  const [networkInfo, setNetworkInfo] = useState<BackendNetworkInfoResponse | null>(null);
  const [copiedPayload, setCopiedPayload] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedIp, setCopiedIp] = useState(false);
  const [isInjecting, setIsInjecting] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [isTraining, setIsTraining] = useState(false);
  const [trainResult, setTrainResult] = useState<BackendTrainResponse | null>(null);
  const [trainError, setTrainError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const deviceId = 'SOLAR-ESP32-01';

  const [sampleTimestamp, setSampleTimestamp] = useState('2026-10-20T12:00:00.000Z');

  // Fetch device stats, network info, and recent raw packets from backend
  const fetchDeviceData = useCallback(async () => {
    try {
      const [statsData, historyData, netData] = await Promise.all([
        getDeviceTelemetryStats(deviceId),
        getHistoricalTelemetry(deviceId, 10),
        getNetworkInfo(),
      ]);
      if (statsData) setStats(statsData);
      if (historyData) setRecentReadings(historyData);
      if (netData) setNetworkInfo(netData);
    } catch (err) {
      console.warn('[DevicePage] Error polling device telemetry stats:', err);
    }
  }, [deviceId]);

  useEffect(() => {
    setMounted(true);
    setSampleTimestamp(new Date().toISOString());
    fetchDeviceData();
    // Poll every 3 seconds for live hardware telemetry handshakes
    const interval = setInterval(fetchDeviceData, 3000);
    return () => clearInterval(interval);
  }, [fetchDeviceData]);

  // Handle Inject Demo Packet
  const handleInjectDemo = async () => {
    setIsInjecting(true);
    setActionMessage(null);
    try {
      const res = await injectDemoTestTelemetry(deviceId);
      if (res) {
        setActionMessage('Simulated demo packet injected (tagged with data_quality="DEMO"). Real hardware data untouched.');
        await fetchDeviceData();
      }
    } catch (err) {
      setActionMessage('Failed to inject demo packet.');
    } finally {
      setIsInjecting(false);
      setTimeout(() => setActionMessage(null), 5000);
    }
  };

  // Handle Clear Demo Data
  const handleClearDemo = async () => {
    setIsClearing(true);
    setActionMessage(null);
    try {
      const res = await clearDemoTelemetry(deviceId);
      setActionMessage(`Cleared ${res.deleted_count} demo packets. Real hardware data preserved 100%.`);
      await fetchDeviceData();
    } catch (err) {
      setActionMessage('Failed to clear demo data.');
    } finally {
      setIsClearing(false);
      setTimeout(() => setActionMessage(null), 5000);
    }
  };

  // Handle Manual AI Model Training (Triggered manually only, never automatic)
  const handleManualTrain = async () => {
    setIsTraining(true);
    setTrainResult(null);
    setTrainError(null);
    try {
      const res = await trainModels(deviceId);
      if (res.success && res.data) {
        setTrainResult(res.data);
        setActionMessage(`AI Model trained successfully! Best algorithm: ${res.data.report.best_model_name} (${res.data.report.best_model_version}).`);
        await fetchDeviceData();
      } else {
        setTrainError(res.error || 'Failed to train AI model.');
      }
    } catch (err: any) {
      setTrainError(err.message || 'Error executing AI model training pipeline.');
    } finally {
      setIsTraining(false);
    }
  };

  const sampleJson = JSON.stringify(
    {
      device_id: deviceId,
      timestamp: telemetry?.timestamp || sampleTimestamp,
      voltage_v: telemetry?.voltage != null ? Number(telemetry.voltage.toFixed(2)) : 18.42,
      current_a: telemetry?.current != null ? Number(telemetry.current.toFixed(2)) : 2.31,
      temperature_c: telemetry?.temperature != null ? Number(telemetry.temperature.toFixed(1)) : 31.7,
      irradiance_w_m2: telemetry?.irradiance != null ? telemetry.irradiance : 812.0,
      firmware_version: '1.0.0',
    },
    null,
    2
  );


  const sampleArduinoCode = `// ESP32 SolarAI Telemetry Client
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

const char* ssid = "COLLEGE_WIFI_SSID";
const char* password = "WIFI_PASSWORD";
const char* serverUrl = "http://<BACKEND_HOST_IP>:8000/api/v1/telemetry";

void sendTelemetry(float voltage, float current, float temp, float lux) {
  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;
    http.begin(serverUrl);
    http.addHeader("Content-Type", "application/json");

    StaticJsonDocument<256> doc;
    doc["device_id"] = "${deviceId}";
    doc["voltage_v"] = voltage;
    doc["current_a"] = current;
    doc["temperature_c"] = temp;
    doc["irradiance_w_m2"] = lux;
    doc["firmware_version"] = "1.0.0";

    String requestBody;
    serializeJson(doc, requestBody);
    int httpResponseCode = http.POST(requestBody);
    http.end();
  }
}`;

  const copyToClipboard = (text: string, type: 'payload' | 'code') => {
    navigator.clipboard.writeText(text);
    if (type === 'payload') {
      setCopiedPayload(true);
      setTimeout(() => setCopiedPayload(false), 2000);
    } else {
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    }
  };

  const connectionStatus = stats?.connection_status || (isDeviceOffline ? 'OFFLINE' : 'ONLINE');
  const totalValid = stats?.real_valid_records ?? 0;
  const minThreshold = stats?.min_training_threshold ?? 10;
  const progressPct = Math.min(100, Math.round((totalValid / minThreshold) * 100));
  const isTrainingReady = totalValid >= minThreshold;

  const formatLastSeen = () => {
    if (!mounted) return '--';
    if (!stats?.last_seen_at && !lastSuccessfulUpdate) return 'No packets received yet';
    const d = stats?.last_seen_at ? new Date(stats.last_seen_at) : lastSuccessfulUpdate;
    if (!d || isNaN(d.getTime())) return '--';
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + 
           ' (' + d.toLocaleDateString() + ')';
  };

  const formatTimeSince = () => {
    if (!mounted) return '--';
    if (stats?.seconds_since_last_seen != null) {
      const s = stats.seconds_since_last_seen;
      if (s < 60) return `${Math.round(s)}s ago`;
      if (s < 3600) return `${Math.round(s / 60)}m ago`;
      return `${(s / 3600).toFixed(1)}h ago`;
    }
    return connectionStatus === 'OFFLINE' ? 'Offline (no recent packet)' : '--';
  };

  return (
    <div className="space-y-6">
      {/* 1. Device Identity & Connection Status Header */}
      <div className="p-5 rounded-2xl bg-slate-900/60 backdrop-blur-md border border-slate-800/80 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
            <Cpu className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-white tracking-tight">ESP32 Hardware Monitor</h2>
              <span className="px-2.5 py-0.5 rounded-md text-[11px] font-mono font-bold bg-slate-800 border border-slate-700 text-cyan-300">
                {deviceId}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Live hardware-to-software telemetry diagnostics, sensor health bus, and real-time ingestion register
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Status Badge */}
          <div className="flex items-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full ${
              connectionStatus === 'ONLINE' ? 'bg-emerald-400 animate-pulse' :
              connectionStatus === 'STALE' ? 'bg-amber-400' : 'bg-rose-500'
            }`} />
            <span className={`px-3 py-1 rounded-xl text-xs font-mono font-bold uppercase border ${
              connectionStatus === 'ONLINE' ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300' :
              connectionStatus === 'STALE' ? 'bg-amber-500/15 border-amber-500/30 text-amber-300' :
              'bg-rose-500/15 border-rose-500/30 text-rose-300'
            }`}>
              {connectionStatus === 'ONLINE' ? '● ONLINE' :
               connectionStatus === 'STALE' ? '▲ STALE (> 60s)' :
               '✕ DEVICE OFFLINE'}
            </span>
          </div>

          {/* CSV Export Button */}
          <a
            href={getExportCsvUrl(deviceId)}
            download
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-cyan-400" />
            <span>Download CSV</span>
          </a>
        </div>
      </div>

      {/* Offline Alert Banner */}
      {connectionStatus === 'OFFLINE' && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-between text-xs text-rose-300">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>
              <strong>Device Offline:</strong> The ESP32 node is currently disconnected or has stopped streaming telemetry. Sensor readings below show <strong>&quot;--&quot;</strong> to prevent displaying fabricated hardware data.
            </span>
          </div>
          <span className="font-mono text-[11px] text-rose-400 shrink-0">
            Check Wi-Fi & Power
          </span>
        </div>
      )}

      {/* Action Notification */}
      {actionMessage && (
        <div className="p-3.5 rounded-xl bg-amber-500/15 border border-amber-500/40 text-xs text-amber-200 flex items-center justify-between">
          <span>{actionMessage}</span>
          <button onClick={() => setActionMessage(null)} className="text-amber-400 hover:text-white font-bold ml-2">×</button>
        </div>
      )}

      {/* 2. Communication Information & Link Diagnostics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Last Successful Packet</span>
            <Clock className="w-4 h-4 text-cyan-400" />
          </div>
          <span className="text-sm font-bold font-mono text-white block truncate">
            {formatLastSeen()}
          </span>
          <span className="text-[11px] text-slate-500">UTC hardware timestamp</span>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Time Since Last Packet</span>
            <Activity className="w-4 h-4 text-amber-400" />
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-xl font-extrabold font-mono text-amber-300">
              {formatTimeSince()}
            </span>
          </div>
          <span className="text-[11px] text-slate-500">Heartbeat elapsed counter</span>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Total Ingested Packets</span>
            <Database className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-extrabold font-mono text-white">
              {stats?.total_packets ?? 0}
            </span>
            <span className="text-xs text-slate-400">packets</span>
          </div>
          <span className="text-[11px] text-emerald-400">
            {stats?.demo_records_count ? `${stats.demo_records_count} demo excluded` : '100% verified hardware'}
          </span>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Reporting Interval</span>
            <Radio className="w-4 h-4 text-purple-400" />
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-extrabold font-mono text-white">
              {stats?.packet_interval_sec != null ? `${stats.packet_interval_sec}s` : '~3.0s'}
            </span>
          </div>
          <span className="text-[11px] text-purple-400 font-mono">
            {stats?.api_response_status || '200 OK'}
          </span>
        </div>
      </div>

      {/* 3. Live Sensor Values Grid (Never displays 0 for missing data) */}
      <div className="p-6 rounded-2xl bg-slate-900/60 backdrop-blur-md border border-slate-800/80 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-white tracking-tight">Live Sensor Telemetry Bus</h3>
            <p className="text-xs text-slate-400">
              Instantaneous physical sensor measurements streamed over Wi-Fi from the ESP32 ADC bus
            </p>
          </div>
          <span className="text-xs font-mono text-slate-400">
            Node Bus: <span className="text-cyan-400 font-bold">{deviceId}</span>
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
          {/* Voltage */}
          <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-800 space-y-1">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Array Voltage</span>
              <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                connectionStatus === 'OFFLINE' ? 'bg-slate-800 text-slate-500' :
                (stats?.sensor_status?.voltage === 'Active' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400')
              }`}>
                {connectionStatus === 'OFFLINE' ? 'OFFLINE' : (stats?.sensor_status?.voltage || 'Active')}
              </span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-extrabold font-mono text-cyan-400">
                {connectionStatus === 'OFFLINE' || telemetry?.voltage == null ? '--' : telemetry.voltage.toFixed(2)}
              </span>
              <span className="text-xs text-slate-400 font-sans">V</span>
            </div>
            <span className="text-[10px] text-slate-500">Voltage Divider Sensor</span>
          </div>

          {/* Current */}
          <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-800 space-y-1">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Array Current</span>
              <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                connectionStatus === 'OFFLINE' ? 'bg-slate-800 text-slate-500' :
                (stats?.sensor_status?.current === 'Active' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400')
              }`}>
                {connectionStatus === 'OFFLINE' ? 'OFFLINE' : (stats?.sensor_status?.current || 'Active')}
              </span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-extrabold font-mono text-emerald-400">
                {connectionStatus === 'OFFLINE' || telemetry?.current == null ? '--' : telemetry.current.toFixed(2)}
              </span>
              <span className="text-xs text-slate-400 font-sans">A</span>
            </div>
            <span className="text-[10px] text-slate-500">ACS712 Hall Sensor</span>
          </div>

          {/* Temperature */}
          <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-800 space-y-1">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Panel Temp</span>
              <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                connectionStatus === 'OFFLINE' ? 'bg-slate-800 text-slate-500' :
                (stats?.sensor_status?.temperature === 'Active' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400')
              }`}>
                {connectionStatus === 'OFFLINE' ? 'OFFLINE' : (stats?.sensor_status?.temperature || 'Active')}
              </span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-extrabold font-mono text-rose-400">
                {connectionStatus === 'OFFLINE' || telemetry?.temperature == null ? '--' : telemetry.temperature.toFixed(1)}
              </span>
              <span className="text-xs text-slate-400 font-sans">°C</span>
            </div>
            <span className="text-[10px] text-slate-500">DS18B20 One-Wire Bus</span>
          </div>

          {/* Irradiance */}
          <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-800 space-y-1">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Solar Irradiance</span>
              <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                connectionStatus === 'OFFLINE' ? 'bg-slate-800 text-slate-500' :
                (stats?.sensor_status?.irradiance === 'Active' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400')
              }`}>
                {connectionStatus === 'OFFLINE' ? 'OFFLINE' : (stats?.sensor_status?.irradiance || 'Active')}
              </span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-extrabold font-mono text-yellow-400">
                {connectionStatus === 'OFFLINE' || telemetry?.irradiance == null ? '--' : telemetry.irradiance}
              </span>
              <span className="text-xs text-slate-400 font-sans">W/m²</span>
            </div>
            <span className="text-[10px] text-slate-500">Pyranometer / Lux Probe</span>
          </div>

          {/* Power */}
          <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-800 space-y-1 col-span-2 sm:col-span-1">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Output Power</span>
              <Zap className="w-3.5 h-3.5 text-amber-400" />
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-extrabold font-mono text-amber-400">
                {connectionStatus === 'OFFLINE' || telemetry?.power == null ? '--' : telemetry.power.toFixed(1)}
              </span>
              <span className="text-xs text-slate-400 font-sans">Watts</span>
            </div>
            <span className="text-[10px] text-amber-400/80">V × I instantaneous</span>
          </div>
        </div>
      </div>

      {/* 4. Data Collection Progress & ML Readiness */}
      <div className="p-6 rounded-2xl bg-slate-900/60 backdrop-blur-md border border-slate-800/80 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4 text-emerald-400" />
              <h3 className="text-base font-bold text-white tracking-tight">AI Data Collection & Dataset Readiness</h3>
            </div>
            <p className="text-xs text-slate-400">
              Physical telemetry packets accumulated in the PostgreSQL database for machine learning model training
            </p>
          </div>
          <span className={`px-3 py-1 rounded-xl text-xs font-mono font-bold self-start sm:self-auto border ${
            isTrainingReady ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300' : 'bg-amber-500/15 border-amber-500/30 text-amber-300'
          }`}>
            {isTrainingReady ? '✓ TRAINING READY' : '⏳ COLLECTING SAMPLES'}
          </span>
        </div>

        {/* Progress Bar */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs font-mono">
            <span className="text-slate-400">
              Valid Telemetry Records: <strong className="text-white">{totalValid}</strong>
            </span>
            <span className="text-slate-400">
              Minimum Pipeline Threshold: <strong className="text-cyan-400">{minThreshold}</strong>
            </span>
          </div>
          <div className="h-3 w-full bg-slate-800/80 rounded-full overflow-hidden border border-slate-700/60">
            <div 
              className={`h-full transition-all duration-500 ${
                isTrainingReady ? 'bg-gradient-to-r from-cyan-500 to-emerald-400' : 'bg-gradient-to-r from-amber-500 to-amber-400'
              }`}
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>

        {/* Recommendation & Training Policy Notice */}
        <div className="p-3.5 rounded-xl bg-slate-800/40 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
          <span className="text-slate-300">
            <strong>Recommendation:</strong> {stats?.recommendation || (totalValid === 0 ? 'No telemetry received yet. Stream sensor packets from ESP32.' : 'More data recommended for reliable model evaluation.')}
          </span>
          <span className="text-[11px] font-mono text-cyan-400 shrink-0">
            {totalValid} / {minThreshold} ({progressPct}%)
          </span>
        </div>

        {/* Manual Model Training Action (Strictly Manual - Never Automatic) */}
        <div className="pt-2 border-t border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="text-xs text-slate-400">
            <span className="font-semibold text-slate-300">Manual Training Gate:</span>{' '}
            {isTrainingReady 
              ? 'Minimum sample threshold met. You may now manually trigger the AI training pipeline.'
              : `Collect ${minThreshold - totalValid} more real hardware packet(s) to unlock model training.`}
          </div>

          <button
            onClick={handleManualTrain}
            disabled={!isTrainingReady || isTraining}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all shadow-lg ${
              isTrainingReady && !isTraining
                ? 'bg-gradient-to-r from-cyan-500 to-emerald-500 hover:from-cyan-400 hover:to-emerald-400 text-slate-950 cursor-pointer shadow-cyan-500/20'
                : 'bg-slate-800 text-slate-500 border border-slate-700/60 cursor-not-allowed opacity-70'
            }`}
          >
            {isTraining ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                <span>Training AI Models...</span>
              </>
            ) : (
              <>
                <Brain className="w-4 h-4 text-slate-950" />
                <span>{isTrainingReady ? 'Train AI Model (Manual Action)' : `Training Locked (${totalValid}/${minThreshold})`}</span>
              </>
            )}
          </button>
        </div>

        {/* Training Result Report Banner */}
        {trainResult && (
          <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-emerald-300 flex items-center gap-1.5">
                <CheckCircle className="w-4 h-4 text-emerald-400" />
                Model Pipeline Trained & Deployed Successfully
              </span>
              <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono text-[11px] font-bold">
                {trainResult.report.best_model_name} ({trainResult.report.best_model_version})
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 font-mono text-[11px]">
              <div className="bg-slate-900/60 p-2 rounded-lg border border-slate-800">
                <span className="text-slate-400 block text-[10px]">Dataset Samples</span>
                <span className="text-white font-bold">{trainResult.report.dataset_size} total ({trainResult.report.train_samples} train / {trainResult.report.test_samples} test)</span>
              </div>
              {trainResult.report.models[trainResult.report.best_model_name] && (
                <>
                  <div className="bg-slate-900/60 p-2 rounded-lg border border-slate-800">
                    <span className="text-slate-400 block text-[10px]">Test MAE</span>
                    <span className="text-cyan-300 font-bold">{trainResult.report.models[trainResult.report.best_model_name].mae.toFixed(3)} W</span>
                  </div>
                  <div className="bg-slate-900/60 p-2 rounded-lg border border-slate-800">
                    <span className="text-slate-400 block text-[10px]">Test RMSE</span>
                    <span className="text-cyan-300 font-bold">{trainResult.report.models[trainResult.report.best_model_name].rmse.toFixed(3)} W</span>
                  </div>
                  <div className="bg-slate-900/60 p-2 rounded-lg border border-slate-800">
                    <span className="text-slate-400 block text-[10px]">Test R² Score</span>
                    <span className="text-emerald-300 font-bold">{trainResult.report.models[trainResult.report.best_model_name].r2_score.toFixed(4)}</span>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Training Error Notification */}
        {trainError && (
          <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300 flex items-center justify-between">
            <span className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{trainError}</span>
            </span>
            <button onClick={() => setTrainError(null)} className="text-rose-400 hover:text-white font-bold ml-2">×</button>
          </div>
        )}
      </div>

      {/* 5. Data Quality Audit Section */}
      <div className="p-6 rounded-2xl bg-slate-900/60 backdrop-blur-md border border-slate-800/80 space-y-4">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-cyan-400" />
          <h3 className="text-base font-bold text-white tracking-tight">Data Quality & Anomaly Audit</h3>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="p-4 rounded-xl bg-slate-800/30 border border-slate-800/80">
            <span className="text-xs text-slate-400 block mb-1">Valid Readings</span>
            <span className="text-xl font-bold font-mono text-emerald-400">
              {stats?.valid_readings ?? 0}
            </span>
            <span className="text-[10px] text-slate-500 block mt-1">Within physical limits</span>
          </div>

          <div className="p-4 rounded-xl bg-slate-800/30 border border-slate-800/80">
            <span className="text-xs text-slate-400 block mb-1">Invalid Readings</span>
            <span className={`text-xl font-bold font-mono ${(stats?.invalid_readings ?? 0) > 0 ? 'text-amber-400' : 'text-slate-400'}`}>
              {stats?.invalid_readings ?? 0}
            </span>
            <span className="text-[10px] text-slate-500 block mt-1">Hardware fault flags</span>
          </div>

          <div className="p-4 rounded-xl bg-slate-800/30 border border-slate-800/80">
            <span className="text-xs text-slate-400 block mb-1">Missing Values</span>
            <span className="text-xl font-bold font-mono text-slate-400">
              {stats?.missing_values ?? 0}
            </span>
            <span className="text-[10px] text-slate-500 block mt-1">Null / NaN metrics</span>
          </div>

          <div className="p-4 rounded-xl bg-slate-800/30 border border-slate-800/80">
            <span className="text-xs text-slate-400 block mb-1">Rejected Packets</span>
            <span className={`text-xl font-bold font-mono ${(stats?.rejected_readings ?? 0) > 0 ? 'text-rose-400' : 'text-slate-400'}`}>
              {stats?.rejected_readings ?? 0}
            </span>
            <span className="text-[10px] text-slate-500 block mt-1">Duplicates / corrupt</span>
          </div>
        </div>
      </div>

      {/* 6. Recent Telemetry Table */}
      <div className="p-6 rounded-2xl bg-slate-900/60 backdrop-blur-md border border-slate-800/80 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-white tracking-tight">Recent Telemetry Register</h3>
            <p className="text-xs text-slate-400">
              Live chronological log of sensor packets stored in the database
            </p>
          </div>
          <span className="text-xs font-mono text-slate-400">
            Showing last {recentReadings.length} packets
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 font-medium font-sans">
                <th className="py-2.5 px-3">Timestamp</th>
                <th className="py-2.5 px-3">Voltage (V)</th>
                <th className="py-2.5 px-3">Current (A)</th>
                <th className="py-2.5 px-3">Cell Temp (°C)</th>
                <th className="py-2.5 px-3">Irradiance (W/m²)</th>
                <th className="py-2.5 px-3">Power (W)</th>
                <th className="py-2.5 px-3 text-right">Quality</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {recentReadings.length > 0 ? (
                recentReadings.map((r) => {
                  const d = new Date(r.timestamp);
                  const timeStr = isNaN(d.getTime()) ? '--:--:--' : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                  const isDemo = r.data_quality === 'DEMO';
                  return (
                    <tr key={r.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-2.5 px-3 text-slate-400">{timeStr}</td>
                      <td className="py-2.5 px-3 text-cyan-300 font-bold">{r.voltage_v != null ? r.voltage_v.toFixed(2) : '--'}</td>
                      <td className="py-2.5 px-3 text-emerald-300 font-bold">{r.current_a != null ? r.current_a.toFixed(2) : '--'}</td>
                      <td className="py-2.5 px-3 text-rose-300">{r.temperature_c != null ? r.temperature_c.toFixed(1) : '--'}</td>
                      <td className="py-2.5 px-3 text-yellow-300">{r.irradiance_w_m2 != null ? r.irradiance_w_m2 : '--'}</td>
                      <td className="py-2.5 px-3 text-amber-300 font-bold">{r.power_w != null ? r.power_w.toFixed(1) : '--'}</td>
                      <td className="py-2.5 px-3 text-right">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-sans font-bold border ${
                          isDemo ? 'bg-amber-500/10 text-amber-400 border-amber-500/30' :
                          r.data_quality === 'GOOD' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' :
                          'bg-rose-500/10 text-rose-400 border-rose-500/30'
                        }`}>
                          {r.data_quality}
                        </span>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500 font-sans text-xs">
                    No telemetry packets recorded yet. Stream sensor packets from ESP32 or test injection below.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 7. Development & Testing Controls (DEMO / DEVELOPMENT ONLY) */}
      <div className="p-6 rounded-2xl bg-amber-500/5 border border-amber-500/30 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <span className="px-2.5 py-1 rounded-md text-[11px] font-bold uppercase bg-amber-500 text-slate-950 font-sans tracking-wide">
              DEMO / DEVELOPMENT ONLY
            </span>
            <h3 className="text-sm font-bold text-white">Hardware Simulation Controls</h3>
          </div>
          <span className="text-xs text-amber-300/80">
            Never mixes demo data with real hardware telemetry; tagged with <code className="font-mono text-amber-200">data_quality=&quot;DEMO&quot;</code>
          </span>
        </div>

        <p className="text-xs text-slate-400">
          Use these controls to verify the frontend pipeline, live gauge updates, and chart rendering before connecting the physical ESP32. 
          Demo packets are strictly excluded from AI/ML training datasets.
        </p>

        <div className="flex flex-wrap items-center gap-3 pt-1">
          <button
            onClick={handleInjectDemo}
            disabled={isInjecting}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-amber-500 hover:bg-amber-400 text-slate-950 transition-all font-sans font-bold shadow-md disabled:opacity-50"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>{isInjecting ? 'Injecting...' : 'Inject Test Packet (Demo Mode)'}</span>
          </button>

          {(stats?.demo_records_count ?? 0) > 0 && (
            <button
              onClick={handleClearDemo}
              disabled={isClearing}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 transition-all disabled:opacity-50"
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-400" />
              <span>{isClearing ? 'Clearing...' : `Clear Demo Data (${stats?.demo_records_count} packets)`}</span>
            </button>
          )}

          <a
            href={getExportCsvUrl(deviceId)}
            download
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
            <span>Download Real Dataset CSV</span>
          </a>
        </div>
      </div>

      {/* 8. Hardware Network Configuration & Local Wi-Fi Guide */}
      <div className="p-6 rounded-2xl bg-slate-900/60 backdrop-blur-md border border-slate-800/80 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <Network className="w-5 h-5 text-cyan-400" />
            <h3 className="text-base font-bold text-white tracking-tight">ESP32 Local Network Connection Guide</h3>
          </div>
          <span className="px-2.5 py-1 rounded-md text-[11px] font-mono font-bold bg-cyan-500/10 border border-cyan-500/30 text-cyan-300">
            Port 8000 (0.0.0.0 Listener)
          </span>
        </div>

        <p className="text-xs text-slate-400">
          To stream real hardware telemetry from a physical ESP32, both the ESP32 and this laptop must be on the same local Wi-Fi network (or mobile hotspot). 
          Flash the firmware below with your laptop&apos;s detected IP address as the destination server.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
          <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span className="font-semibold text-slate-300">Target ESP32 Ingestion URL</span>
              <button
                onClick={() => {
                  const url = networkInfo?.telemetry_url || `http://127.0.0.1:8000/api/v1/telemetry`;
                  navigator.clipboard.writeText(url);
                  setCopiedIp(true);
                  setTimeout(() => setCopiedIp(false), 2000);
                }}
                className="flex items-center gap-1 text-[11px] text-cyan-400 hover:text-cyan-300 font-medium"
              >
                {copiedIp ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedIp ? 'Copied' : 'Copy URL'}</span>
              </button>
            </div>
            <div className="p-2.5 rounded-lg bg-slate-950/80 border border-slate-800/80 font-mono text-xs text-cyan-300 break-all">
              {networkInfo?.telemetry_url || 'http://<LAPTOP_LAN_IP>:8000/api/v1/telemetry'}
            </div>
            <span className="text-[11px] text-slate-500 block">
              Detected Primary IPv4: <strong className="text-slate-300 font-mono">{networkInfo?.primary_ip || '127.0.0.1'}</strong>
            </span>
          </div>

          <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-800 space-y-2">
            <span className="font-semibold text-slate-300 text-xs block">Production Firmware Sketch</span>
            <p className="text-[11px] text-slate-400">
              Complete, compilable Arduino IDE / PlatformIO sketch with modular sensor drivers and non-blocking JSON transmission.
            </p>
            <div className="flex items-center gap-2 pt-1">
              <a
                href="/firmware/esp32_solar_telemetry.ino"
                download="esp32_solar_telemetry.ino"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-cyan-500 hover:bg-cyan-400 text-slate-950 transition-colors shadow-sm"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download .ino Sketch</span>
              </a>
              <button
                onClick={() => copyToClipboard(sampleArduinoCode, 'code')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
              >
                {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>Copy Sketch Code</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 9. Configurable Hardware Pinout Placeholders (Subject to Hardware Team Confirmation) */}
      <div className="p-6 rounded-2xl bg-slate-900/60 backdrop-blur-md border border-slate-800/80 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <Sliders className="w-5 h-5 text-amber-400" />
            <h3 className="text-base font-bold text-white tracking-tight">ESP32 Sensor Pin Configuration (Placeholders)</h3>
          </div>
          <span className="px-2.5 py-1 rounded-md text-[11px] font-sans font-bold bg-amber-500/10 border border-amber-500/30 text-amber-300">
            Hardware Team Configurable
          </span>
        </div>

        <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300/90 flex items-start gap-2.5">
          <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <span>
            <strong>Note for Hardware Team:</strong> Pin numbers and calibration constants below are default configuration placeholders in <code className="font-mono text-amber-200">esp32_solar_telemetry.ino</code>. Confirm exact physical sensors, ADC attenuation, and wiring before flashing.
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 font-medium font-sans">
                <th className="py-2.5 px-3">Physical Measurement</th>
                <th className="py-2.5 px-3">Sensor Model (Spec)</th>
                <th className="py-2.5 px-3">Placeholder Constant</th>
                <th className="py-2.5 px-3">Default Pin</th>
                <th className="py-2.5 px-3">Bus / Channel</th>
                <th className="py-2.5 px-3">Calibration Formula</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono text-slate-300">
              <tr className="hover:bg-slate-800/30 transition-colors">
                <td className="py-2.5 px-3 font-sans font-semibold text-cyan-300">Array Voltage</td>
                <td className="py-2.5 px-3 font-sans text-slate-400">Resistor Divider</td>
                <td className="py-2.5 px-3 text-cyan-400">PIN_VOLTAGE_ADC</td>
                <td className="py-2.5 px-3 font-bold text-white">GPIO 34</td>
                <td className="py-2.5 px-3 text-slate-400">ADC1_CH6</td>
                <td className="py-2.5 px-3 text-xs text-slate-400 font-sans">V_adc × DividerRatio (5.0)</td>
              </tr>
              <tr className="hover:bg-slate-800/30 transition-colors">
                <td className="py-2.5 px-3 font-sans font-semibold text-emerald-300">Array Current</td>
                <td className="py-2.5 px-3 font-sans text-slate-400">ACS712 Hall Sensor</td>
                <td className="py-2.5 px-3 text-emerald-400">PIN_CURRENT_ADC</td>
                <td className="py-2.5 px-3 font-bold text-white">GPIO 35</td>
                <td className="py-2.5 px-3 text-slate-400">ADC1_CH7</td>
                <td className="py-2.5 px-3 text-xs text-slate-400 font-sans">(V_adc - 2.5V) / 0.185 V/A</td>
              </tr>
              <tr className="hover:bg-slate-800/30 transition-colors">
                <td className="py-2.5 px-3 font-sans font-semibold text-rose-300">Cell Temperature</td>
                <td className="py-2.5 px-3 font-sans text-slate-400">DS18B20 / NTC Probe</td>
                <td className="py-2.5 px-3 text-rose-400">PIN_TEMPERATURE</td>
                <td className="py-2.5 px-3 font-bold text-white">GPIO 4</td>
                <td className="py-2.5 px-3 text-slate-400">OneWire / Digital</td>
                <td className="py-2.5 px-3 text-xs text-slate-400 font-sans">OneWire Scratchpad / LM35 10mV/°C</td>
              </tr>
              <tr className="hover:bg-slate-800/30 transition-colors">
                <td className="py-2.5 px-3 font-sans font-semibold text-yellow-300">Solar Irradiance</td>
                <td className="py-2.5 px-3 font-sans text-slate-400">Pyranometer / LDR</td>
                <td className="py-2.5 px-3 text-yellow-400">PIN_IRRADIANCE_ADC</td>
                <td className="py-2.5 px-3 font-bold text-white">GPIO 36</td>
                <td className="py-2.5 px-3 text-slate-400">ADC1_CH0 (VP)</td>
                <td className="py-2.5 px-3 text-xs text-slate-400 font-sans">(ADC / 4095) × 1200 W/m²</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* 10. Hardware Teammate Specs Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sample JSON Ingestion Payload */}
        <div className="p-5 lg:p-6 rounded-2xl bg-slate-900/60 backdrop-blur-md border border-slate-800/80 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Terminal className="w-4 h-4 text-cyan-400" />
              <h3 className="text-sm font-bold text-white">Expected Hardware Ingestion Payload</h3>
            </div>
            <button
              onClick={() => copyToClipboard(sampleJson, 'payload')}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 transition-colors"
            >
              {copiedPayload ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedPayload ? 'Copied' : 'Copy JSON'}</span>
            </button>
          </div>

          <p className="text-xs text-slate-400">
            Endpoint: <code className="text-amber-400 font-mono">POST /api/v1/telemetry</code> with header <code className="text-amber-400 font-mono">Content-Type: application/json</code>.
          </p>

          <pre className="p-4 rounded-xl bg-slate-950/90 border border-slate-800 text-xs font-mono text-emerald-400 overflow-x-auto">
            {sampleJson}
          </pre>
        </div>

        {/* Arduino C++ Firmware Sample for Teammates */}
        <div className="p-5 lg:p-6 rounded-2xl bg-slate-900/60 backdrop-blur-md border border-slate-800/80 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Code2 className="w-4 h-4 text-cyan-400" />
              <h3 className="text-sm font-bold text-white">Sample ESP32 C++ Sketch for Teammates</h3>
            </div>
            <button
              onClick={() => copyToClipboard(sampleArduinoCode, 'code')}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 transition-colors"
            >
              {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedCode ? 'Copied' : 'Copy Code'}</span>
            </button>
          </div>

          <p className="text-xs text-slate-400">
            Share this snippet with hardware teammates to verify Wi-Fi HTTP POST handshakes directly to your machine.
          </p>

          <pre className="p-4 rounded-xl bg-slate-950/90 border border-slate-800 text-xs font-mono text-cyan-300 overflow-x-auto max-h-56">
            {sampleArduinoCode}
          </pre>
        </div>
      </div>
    </div>
  );
}

function Code2(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="16 18 22 12 16 6" />
      <polyline points="8 6 2 12 8 18" />
    </svg>
  );
}
