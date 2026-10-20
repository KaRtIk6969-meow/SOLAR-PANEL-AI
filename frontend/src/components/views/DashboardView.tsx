'use client';

import React from 'react';
import { useSolar } from '@/context/SolarContext';
import { MetricCard } from '@/components/dashboard/MetricCard';
import { LivePowerChart } from '@/components/dashboard/LivePowerChart';
import { GaugeCluster } from '@/components/dashboard/GaugeCluster';
import { EnvironmentalCard } from '@/components/dashboard/EnvironmentalCard';
import { RecentAlertsCard } from '@/components/dashboard/RecentAlertsCard';
import { DeviceStatusCard } from '@/components/dashboard/DeviceStatusCard';
import { Zap, Gauge, Flame, Sun, Sparkles, Activity, ShieldAlert, WifiOff, Clock, Radio, RefreshCw, AlertCircle } from 'lucide-react';

export function DashboardView() {
  const { 
    telemetry, 
    history, 
    health, 
    alerts, 
    device, 
    lastUpdated, 
    lastSuccessfulUpdate,
    isDeviceOffline,
    isLoading,
    isError,
    errorMessage,
    resolveAlert, 
    scenario,
    dataSource,
    setDataSource,
    refreshData
  } = useSolar();

  const formatLastSuccess = (date: Date | null) => {
    if (!date) return 'Never';
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  return (
    <div className="space-y-6">
      {/* Top Source & Connection Bar */}
      <div className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800/80 backdrop-blur-md flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Radio className={`w-4 h-4 ${isDeviceOffline ? 'text-rose-400' : 'text-emerald-400 animate-pulse'}`} />
            <span className="text-xs font-bold text-white tracking-tight">
              Hardware Link:
            </span>
            {isDeviceOffline ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-500/15 text-rose-300 border border-rose-500/30">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                Device Offline
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                Online ({device.id})
              </span>
            )}
          </div>

          <div className="hidden sm:flex items-center gap-1.5 text-xs text-slate-400 border-l border-slate-800 pl-3">
            <Clock className="w-3.5 h-3.5 text-slate-500" />
            <span>Last successful update:</span>
            <span suppressHydrationWarning className="font-mono font-semibold text-slate-200">
              {formatLastSuccess(lastSuccessfulUpdate)}
            </span>
          </div>
        </div>

        {/* Data Source Selector & Refresh */}
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-slate-800/80 p-0.5 rounded-xl border border-slate-700/60 text-xs">
            <button
              onClick={() => setDataSource('api')}
              className={`px-3 py-1 rounded-lg font-semibold transition-all ${
                dataSource === 'api'
                  ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Live API
            </button>
            <button
              onClick={() => setDataSource('mock')}
              className={`px-3 py-1 rounded-lg font-semibold transition-all ${
                dataSource === 'mock'
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Mock Demo
            </button>
          </div>

          <button
            onClick={() => refreshData()}
            title="Refresh live data"
            className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-cyan-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Offline Alert Banner if backend or hardware is down */}
      {isDeviceOffline && dataSource === 'api' && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-between text-xs text-rose-300">
          <div className="flex items-center gap-2.5">
            <WifiOff className="w-4 h-4 text-rose-400 shrink-0" />
            <span>
              <strong>Device Offline:</strong> The ESP32 edge node is not transmitting telemetry. Showing last known snapshot (missing data displayed as &quot;--&quot; rather than falsified zeros).
            </span>
          </div>
          <span className="font-mono text-[11px] bg-rose-500/20 px-2 py-0.5 rounded text-rose-200 shrink-0 ml-2">
            Last update: {formatLastSuccess(lastSuccessfulUpdate)}
          </span>
        </div>
      )}

      {/* Simulation Scenario Notification Banner if running mock mode */}
      {dataSource === 'mock' && scenario !== 'normal' && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between text-xs text-amber-300">
          <div className="flex items-center gap-2.5">
            <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
            <span>
              <strong>Active Simulation Mode:</strong> Running &quot;{scenario.toUpperCase()}&quot; fault scenario. Model and dashboard are processing injected electrical/optical variations.
            </span>
          </div>
          <span className="font-mono text-[11px] bg-amber-500/20 px-2 py-0.5 rounded text-amber-200">
            Mock Test Mode
          </span>
        </div>
      )}

      {/* Row 1: Core 6 Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        {/* Power */}
        <MetricCard
          title="Active Power"
          value={telemetry?.power != null ? telemetry.power.toFixed(1) : null}
          unit="W"
          icon={Zap}
          subValue={isDeviceOffline ? "Device Offline" : "STC: 100W Panel"}
          accentColor="amber"
          progress={{ current: telemetry?.power, max: 100 }}
          isLoading={isLoading && !telemetry}
        />

        {/* Voltage */}
        <MetricCard
          title="Array Voltage"
          value={telemetry?.voltage != null ? telemetry.voltage.toFixed(2) : null}
          unit="V"
          icon={Activity}
          subValue={isDeviceOffline ? "Offline" : "Vmp: ~18.4V"}
          accentColor="cyan"
          progress={{ current: telemetry?.voltage, max: 22 }}
          isLoading={isLoading && !telemetry}
        />

        {/* Current */}
        <MetricCard
          title="Array Current"
          value={telemetry?.current != null ? telemetry.current.toFixed(2) : null}
          unit="A"
          icon={Gauge}
          subValue={isDeviceOffline ? "Offline" : "Imp: ~5.43A"}
          accentColor="emerald"
          progress={{ current: telemetry?.current, max: 6 }}
          isLoading={isLoading && !telemetry}
        />

        {/* Temperature */}
        <MetricCard
          title="Cell Temp"
          value={telemetry?.temperature != null ? telemetry.temperature.toFixed(1) : null}
          unit="°C"
          icon={Flame}
          subValue={telemetry?.ambientTemp != null ? `Amb: ${telemetry.ambientTemp.toFixed(1)}°C` : "Sensor Offline"}
          accentColor="rose"
          progress={{ current: telemetry?.temperature, max: 75 }}
          isLoading={isLoading && !telemetry}
        />

        {/* Irradiance */}
        <MetricCard
          title="Irradiance"
          value={telemetry?.irradiance != null ? telemetry.irradiance : null}
          unit="W/m²"
          icon={Sun}
          subValue={isDeviceOffline ? "No Sensor Ping" : "Pyranometer"}
          accentColor="amber"
          progress={{ current: telemetry?.irradiance, max: 1000 }}
          isLoading={isLoading && !telemetry}
        />

        {/* Efficiency */}
        <MetricCard
          title="Efficiency"
          value={telemetry?.efficiency != null ? telemetry.efficiency.toFixed(1) : null}
          unit="%"
          icon={Sparkles}
          subValue={isDeviceOffline ? "No Generation" : "STC: 17.8%"}
          accentColor="purple"
          progress={{ current: telemetry?.efficiency, max: 22 }}
          isLoading={isLoading && !telemetry}
        />
      </div>

      {/* Row 2: Live Power Chart (8 cols) + Overall Panel Health Gauge (4 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <LivePowerChart 
          data={history} 
          className="lg:col-span-8 min-h-[380px]" 
        />
        <GaugeCluster 
          health={health} 
          className="lg:col-span-4 min-h-[380px]" 
        />
      </div>

      {/* Row 3: Environmental Conditions (4 cols) + Recent Alerts (4 cols) + Hardware Status (4 cols) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-6">
        <EnvironmentalCard 
          telemetry={telemetry} 
          className="lg:col-span-4" 
        />
        <RecentAlertsCard 
          alerts={alerts} 
          onResolve={resolveAlert} 
          className="lg:col-span-4" 
        />
        <DeviceStatusCard 
          device={device} 
          lastUpdated={lastUpdated} 
          lastSuccessfulUpdate={lastSuccessfulUpdate}
          isDeviceOffline={isDeviceOffline}
          className="lg:col-span-4 md:col-span-2" 
        />
      </div>
    </div>
  );
}
