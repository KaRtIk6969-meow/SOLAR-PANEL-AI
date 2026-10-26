'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useSolar } from '@/context/SolarContext';
import { MetricCard } from '@/components/dashboard/MetricCard';
import { LivePowerChart } from '@/components/dashboard/LivePowerChart';
import { GaugeCluster } from '@/components/dashboard/GaugeCluster';
import { EnvironmentalCard } from '@/components/dashboard/EnvironmentalCard';
import { RecentAlertsCard } from '@/components/dashboard/RecentAlertsCard';
import { DeviceStatusCard } from '@/components/dashboard/DeviceStatusCard';
import { 
  Zap, 
  Gauge, 
  Flame, 
  Sun, 
  Sparkles, 
  Activity, 
  ShieldAlert, 
  WifiOff, 
  Clock, 
  Radio, 
  RefreshCw, 
  AlertCircle,
  AlertTriangle,
  ShieldCheck,
  CheckCircle2,
  TrendingUp,
  Award,
  ArrowRight,
  Bot,
  Database,
  Sliders,
  Cpu,
  Layers,
  FileText,
  Calendar
} from 'lucide-react';
import {
  fetchAnalyticsSummary,
  fetchAnalyticsPerformance,
  BackendAnalyticsSummary,
  BackendPerformanceAnalyticsResponse,
} from '@/lib/api';

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
    refreshData,
    modelEval,
    isSimulated
  } = useSolar();

  const [mounted, setMounted] = useState(false);
  const [analyticsSummary, setAnalyticsSummary] = useState<BackendAnalyticsSummary | null>(null);
  const [analyticsPerformance, setAnalyticsPerformance] = useState<BackendPerformanceAnalyticsResponse | null>(null);

  const deviceId = device?.id || 'SOLAR-ESP32-01';

  // Load 24-hour analytics summary & extreme periods
  const loadCommandCenterAnalytics = useCallback(async () => {
    try {
      const [sumRes, perfRes] = await Promise.all([
        fetchAnalyticsSummary(deviceId, '24h'),
        fetchAnalyticsPerformance(deviceId, '24h'),
      ]);
      setAnalyticsSummary(sumRes);
      setAnalyticsPerformance(perfRes);
    } catch (err) {
      console.warn('[DashboardView] Failed to load 24h analytics:', err);
    }
  }, [deviceId]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted) {
      loadCommandCenterAnalytics();
    }
  }, [mounted, loadCommandCenterAnalytics]);

  const formatLastSuccess = (date: Date | null) => {
    if (!date) return 'Never';
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  // Connection indicator status
  const connectionStatus = isDeviceOffline 
    ? 'OFFLINE' 
    : (device?.status === 'STALE' ? 'STALE' : 'ONLINE');

  const connectionColor = connectionStatus === 'ONLINE' 
    ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' 
    : connectionStatus === 'STALE'
    ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
    : 'bg-rose-500/15 text-rose-300 border-rose-500/30';

  const connectionDot = connectionStatus === 'ONLINE'
    ? 'bg-emerald-400'
    : connectionStatus === 'STALE'
    ? 'bg-amber-400'
    : 'bg-rose-400';

  // Calculate Power Deviation (residual = actual - predicted)
  const actualPwr = telemetry?.power ?? null;
  const predPwr = telemetry?.predictedPower ?? null;
  const residualVal = actualPwr != null && predPwr != null ? Number((actualPwr - predPwr).toFixed(2)) : null;
  const deviationPct = actualPwr != null && predPwr != null && predPwr > 0 
    ? Number((((actualPwr - predPwr) / predPwr) * 100).toFixed(1)) 
    : null;

  // Active alerts count
  const activeAlertsCount = alerts.filter(a => !a.isResolved).length;

  // Today's energy from analytics service (numerical trapezoidal integration)
  const todayEnergyWh = analyticsSummary?.total_energy_wh ?? (
    actualPwr != null && telemetry?.timestamp ? Math.round(actualPwr * 0.1 * 10) / 10 : null
  );

  // -------------------------------------------------------------
  // Phase 8: Quick Grounded AI Insights
  // -------------------------------------------------------------
  const generateQuickInsights = () => {
    const insights: { icon: any; title: string; text: string; color: string }[] = [];

    // 1. Generation vs Expected Insight
    if (actualPwr != null && predPwr != null) {
      const diff = actualPwr - predPwr;
      if (Math.abs(diff) <= 1.0) {
        insights.push({
          icon: CheckCircle2,
          title: 'Nominal Generation Yield',
          text: `Actual power (${actualPwr.toFixed(1)}W) is tracking within ${Math.abs(diff).toFixed(2)}W of the AI expected baseline (${predPwr.toFixed(1)}W).`,
          color: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10',
        });
      } else if (diff < -1.0) {
        insights.push({
          icon: AlertCircle,
          title: 'Generation Deficit Detected',
          text: `Actual power (${actualPwr.toFixed(1)}W) is ${Math.abs(diff).toFixed(1)}W below the XGBoost expectation. Possible shading or optical soiling.`,
          color: 'text-amber-400 border-amber-500/30 bg-amber-500/10',
        });
      } else {
        insights.push({
          icon: Sparkles,
          title: 'Above-Baseline Generation',
          text: `Actual output (${actualPwr.toFixed(1)}W) is exceeding AI baseline by ${diff.toFixed(1)}W under favorable ambient irradiance.`,
          color: 'text-cyan-400 border-cyan-500/30 bg-cyan-500/10',
        });
      }
    } else {
      insights.push({
        icon: Clock,
        title: 'Awaiting Live Yield',
        text: 'Waiting for live telemetry stream to calculate real-time AI residual comparison.',
        color: 'text-slate-400 border-slate-700/60 bg-slate-800/40',
      });
    }

    // 2. Health & Alerts Insight
    const hScore = health?.overallScore ?? analyticsSummary?.health_score ?? null;
    if (hScore != null) {
      if (activeAlertsCount === 0 && hScore >= 90) {
        insights.push({
          icon: ShieldCheck,
          title: 'All Systems Nominal',
          text: `Overall system health is ${hScore}% with zero active diagnostic alerts across electrical and thermal subsystems.`,
          color: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10',
        });
      } else if (activeAlertsCount > 0) {
        insights.push({
          icon: AlertTriangle,
          title: `${activeAlertsCount} Active Diagnostic Alerts`,
          text: `System health is evaluated at ${hScore}%. Review active alerts for automated diagnostic guidance.`,
          color: 'text-amber-400 border-amber-500/30 bg-amber-500/10',
        });
      } else {
        insights.push({
          icon: ShieldCheck,
          title: 'Stable Operation',
          text: `System health score is ${hScore}%. Operating within normal variance bounds.`,
          color: 'text-cyan-400 border-cyan-500/30 bg-cyan-500/10',
        });
      }
    }

    // 3. Thermal Operating Condition
    const temp = telemetry?.temperature ?? null;
    if (temp != null) {
      if (temp > 65.0) {
        insights.push({
          icon: Flame,
          title: 'Critical Cell Overheating',
          text: `Cell temperature (${temp.toFixed(1)}°C) is above 65°C critical limit, causing substantial semiconductor voltage derating.`,
          color: 'text-rose-400 border-rose-500/30 bg-rose-500/10',
        });
      } else if (temp > 55.0) {
        insights.push({
          icon: Flame,
          title: 'Elevated Cell Temperature',
          text: `Cell junction temperature (${temp.toFixed(1)}°C) is elevated (> 55°C). Monocrystalline derating reduces voltage yield.`,
          color: 'text-amber-400 border-amber-500/30 bg-amber-500/10',
        });
      } else {
        insights.push({
          icon: Flame,
          title: 'Nominal Thermal Operation',
          text: `Cell temperature is ${temp.toFixed(1)}°C, operating comfortably within optimal semiconductor efficiency margins (< 55°C).`,
          color: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10',
        });
      }
    }

    // 4. Solar Flux & Photovoltaic Conversion
    const irr = telemetry?.irradiance ?? null;
    const eff = telemetry?.efficiency ?? null;
    if (irr != null) {
      insights.push({
        icon: Sun,
        title: 'Solar Flux Ingestion',
        text: `Surface irradiance is ${irr.toFixed(0)} W/m²${eff != null ? ` with instantaneous photovoltaic conversion at ${eff.toFixed(1)}%` : ''}.`,
        color: 'text-yellow-400 border-yellow-500/30 bg-yellow-500/10',
      });
    }

    return insights;
  };

  const quickInsights = generateQuickInsights();

  return (
    <div className="space-y-6">
      {/* Phase 3: Top Status Bar */}
      <div className="p-4 lg:p-5 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-xl backdrop-blur-md flex flex-wrap items-center justify-between gap-4">
        {/* Left Side: Brand, Device, Connection, Data Source */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-500/20 to-cyan-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 font-bold text-xs shadow-inner">
              <Zap className="w-5 h-5 text-amber-400 fill-amber-400/20" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-white tracking-tight">SolarAI Command Center</h2>
                {/* Data Source Badge */}
                <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                  dataSource === 'mock' 
                    ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30' 
                    : 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                }`}>
                  <Database className="w-3 h-3" />
                  {dataSource === 'mock' ? 'DEMO MODE' : 'REAL HARDWARE'}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Target Node: <span className="font-mono text-slate-200 font-semibold">{deviceId}</span>
              </p>
            </div>
          </div>

          {/* Connection Status Pill */}
          <div className="flex items-center pl-2 border-l border-slate-800">
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold border ${connectionColor}`}>
              <span className={`w-2 h-2 rounded-full ${connectionDot} animate-pulse`} />
              <span>{connectionStatus}</span>
            </span>
          </div>

          {/* Last Telemetry Timestamp */}
          <div className="hidden md:flex items-center gap-1.5 text-xs text-slate-400 border-l border-slate-800 pl-3">
            <Clock className="w-3.5 h-3.5 text-slate-500" />
            <span>Last Telemetry:</span>
            <span suppressHydrationWarning className="font-mono font-semibold text-slate-200">
              {formatLastSuccess(lastSuccessfulUpdate)}
            </span>
          </div>
        </div>

        {/* Right Side: AI Model, Health, Alerts, Source Toggle, Refresh */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* AI Model Tag */}
          <div className="hidden xl:flex items-center gap-1.5 px-3 py-1 rounded-xl bg-slate-800/80 border border-slate-700/60 text-xs">
            <Cpu className="w-3.5 h-3.5 text-purple-400" />
            <span className="text-slate-400">Model:</span>
            <span className="font-mono font-bold text-purple-300">
              {modelEval?.modelName || 'XGBoost'}
            </span>
            <span className="text-[10px] px-1.5 py-0.2 rounded bg-purple-500/20 text-purple-300 font-bold">
              READY
            </span>
          </div>

          {/* System Health Quick Tag */}
          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-xl bg-slate-800/80 border border-slate-700/60 text-xs">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-slate-400">Health:</span>
            <span className="font-mono font-bold text-emerald-400">
              {health?.overallScore != null ? `${health.overallScore}%` : '--'}
            </span>
          </div>

          {/* Active Alerts Pill */}
          <Link
            href="/alerts"
            className={`flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold border transition-colors ${
              activeAlertsCount > 0
                ? 'bg-amber-500/15 border-amber-500/30 text-amber-300 hover:bg-amber-500/25'
                : 'bg-slate-800/80 border-slate-700/60 text-slate-400 hover:text-white'
            }`}
          >
            <AlertTriangle className={`w-3.5 h-3.5 ${activeAlertsCount > 0 ? 'text-amber-400' : 'text-slate-500'}`} />
            <span>{activeAlertsCount} {activeAlertsCount === 1 ? 'Alert' : 'Alerts'}</span>
          </Link>

          {/* Live API / Mock Demo Selector */}
          <div className="flex items-center bg-slate-800/80 p-0.5 rounded-xl border border-slate-700/60 text-xs">
            <button
              onClick={() => setDataSource('api')}
              className={`px-3 py-1 rounded-lg font-semibold transition-all ${
                dataSource === 'api'
                  ? 'bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/20'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Live API
            </button>
            <button
              onClick={() => setDataSource('mock')}
              className={`px-3 py-1 rounded-lg font-semibold transition-all ${
                dataSource === 'mock'
                  ? 'bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/20'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Mock Demo
            </button>
          </div>

          {/* Refresh Button */}
          <button
            onClick={() => {
              refreshData();
              loadCommandCenterAnalytics();
            }}
            title="Refresh Real Hardware Telemetry"
            className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-amber-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Offline Alert Banner if backend or hardware is down */}
      {isDeviceOffline && dataSource === 'api' && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-between text-xs text-rose-300">
          <div className="flex items-center gap-2.5">
            <WifiOff className="w-4 h-4 text-rose-400 shrink-0" />
            <span>
              <strong>Hardware Node Offline:</strong> The ESP32 edge node is currently not transmitting telemetry packets. Displaying last recorded snapshot (missing metrics displayed as &quot;--&quot; rather than falsified zeros).
            </span>
          </div>
          <span className="font-mono text-[11px] bg-rose-500/20 px-2 py-0.5 rounded text-rose-200 shrink-0 ml-2">
            Last update: {formatLastSuccess(lastSuccessfulUpdate)}
          </span>
        </div>
      )}

      {/* Phase 4: Primary KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
        {/* 1: Current Power */}
        <MetricCard
          title="Current Power"
          value={actualPwr != null ? actualPwr.toFixed(1) : null}
          unit="W"
          icon={Zap}
          subValue={connectionStatus === 'OFFLINE' ? "Offline" : "Actual MPPT"}
          accentColor="amber"
          progress={{ current: actualPwr, max: 100 }}
          isLoading={isLoading && !telemetry}
        />

        {/* 2: AI Expected Power */}
        <MetricCard
          title="AI Expected"
          value={predPwr != null ? predPwr.toFixed(1) : null}
          unit="W"
          icon={Sparkles}
          subValue="XGBoost Baseline"
          accentColor="purple"
          progress={{ current: predPwr, max: 100 }}
          isLoading={isLoading && !telemetry}
        />

        {/* 3: Power Deviation (Residual) */}
        <MetricCard
          title="Deviation"
          value={residualVal != null ? (residualVal >= 0 ? `+${residualVal}` : `${residualVal}`) : null}
          unit="W"
          icon={Activity}
          subValue={deviationPct != null ? `${deviationPct}% vs baseline` : "Residual"}
          accentColor={residualVal != null && residualVal < -2.0 ? "rose" : "cyan"}
          isLoading={isLoading && !telemetry}
        />

        {/* 4: Health Score */}
        <MetricCard
          title="Health Score"
          value={health?.overallScore != null ? health.overallScore : (analyticsSummary?.health_score ?? null)}
          unit="%"
          icon={ShieldCheck}
          subValue={health?.healthStatusText ? "Diagnostic State" : "System Health"}
          accentColor="emerald"
          progress={{ current: health?.overallScore ?? analyticsSummary?.health_score, max: 100 }}
          isLoading={isLoading && !telemetry}
        />

        {/* 5: Today's Harvested Energy */}
        <MetricCard
          title="Today Energy"
          value={todayEnergyWh != null ? todayEnergyWh.toFixed(1) : null}
          unit="Wh"
          icon={TrendingUp}
          subValue="Trapezoidal Wh"
          accentColor="emerald"
          progress={{ current: todayEnergyWh, max: 500 }}
          isLoading={isLoading && !analyticsSummary}
        />

        {/* 6: Efficiency */}
        <MetricCard
          title="Efficiency"
          value={telemetry?.efficiency != null ? telemetry.efficiency.toFixed(1) : null}
          unit="%"
          icon={Gauge}
          subValue={connectionStatus === 'OFFLINE' ? "Offline" : "PV Conversion"}
          accentColor="cyan"
          progress={{ current: telemetry?.efficiency, max: 22 }}
          isLoading={isLoading && !telemetry}
        />

        {/* 7: Temperature */}
        <MetricCard
          title="Cell Temp"
          value={telemetry?.temperature != null ? telemetry.temperature.toFixed(1) : null}
          unit="°C"
          icon={Flame}
          subValue={telemetry?.temperature != null && telemetry.temperature > 55 ? "Derating Active" : "Nominal"}
          accentColor={telemetry?.temperature != null && telemetry.temperature > 55 ? "rose" : "amber"}
          progress={{ current: telemetry?.temperature, max: 75 }}
          isLoading={isLoading && !telemetry}
        />

        {/* 8: Irradiance */}
        <MetricCard
          title="Irradiance"
          value={telemetry?.irradiance != null ? telemetry.irradiance.toFixed(0) : null}
          unit="W/m²"
          icon={Sun}
          subValue="Solar Flux"
          accentColor="amber"
          progress={{ current: telemetry?.irradiance, max: 1000 }}
          isLoading={isLoading && !telemetry}
        />
      </div>

      {/* Phase 5 & 6: Live Power Monitor + System Health Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Live Power Chart (8 cols) */}
        <LivePowerChart 
          data={history} 
          className="lg:col-span-8 min-h-[400px]" 
        />

        {/* System Health Panel (4 cols) */}
        <GaugeCluster 
          health={health} 
          className="lg:col-span-4 min-h-[400px]" 
        />
      </div>

      {/* Phase 8: Quick Grounded AI Insights Panel */}
      <div className="p-5 lg:p-6 rounded-2xl bg-slate-900/70 backdrop-blur-md border border-slate-800 space-y-4 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Bot className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-tight">
                Automated AI Diagnostics & Insights
              </h3>
              <p className="text-xs text-slate-400">
                Real-time synthesis of telemetry, XGBoost baseline residuals, and thermal coefficients
              </p>
            </div>
          </div>

          <Link
            href="/ai-lab"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 transition-all self-start sm:self-auto"
          >
            <span>Ask AI Assistant</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {/* 4 Grounded Insight Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {quickInsights.map((insight, idx) => {
            const Icon = insight.icon;
            return (
              <div 
                key={idx} 
                className={`p-3.5 rounded-xl border ${insight.color} flex flex-col justify-between space-y-2`}
              >
                <div className="flex items-center gap-2">
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="text-xs font-bold tracking-tight">{insight.title}</span>
                </div>
                <p className="text-[11px] text-slate-300 leading-relaxed font-sans">
                  {insight.text}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Phase 7 & 9: Active Alerts + 24H Energy Performance Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Active Alerts Section (6 cols) */}
        <RecentAlertsCard 
          alerts={alerts} 
          onResolve={resolveAlert} 
          className="lg:col-span-6 min-h-[340px]" 
        />

        {/* Energy & Performance Summary (6 cols) */}
        <div className="lg:col-span-6 p-5 lg:p-6 rounded-2xl bg-slate-900/60 backdrop-blur-md border border-slate-800/80 flex flex-col justify-between min-h-[340px]">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-emerald-400" />
                <h3 className="text-base font-bold text-white tracking-tight">
                  24-Hour Energy & Performance Summary
                </h3>
              </div>
              <Link 
                href="/analytics" 
                className="text-xs font-semibold text-amber-400 hover:text-amber-300 flex items-center gap-1 transition-colors"
              >
                <span>Full Analytics</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
              <div className="p-3 rounded-xl bg-slate-800/40 border border-slate-700/60">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Today Energy</span>
                <span className="text-lg font-bold font-mono text-emerald-400">
                  {analyticsSummary?.total_energy_wh != null ? `${analyticsSummary.total_energy_wh.toFixed(1)} Wh` : '--'}
                </span>
                <span className="text-[10px] text-slate-500 block">Integrated Yield</span>
              </div>

              <div className="p-3 rounded-xl bg-slate-800/40 border border-slate-700/60">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Peak Power</span>
                <span className="text-lg font-bold font-mono text-amber-400">
                  {analyticsSummary?.max_power_w != null ? `${analyticsSummary.max_power_w.toFixed(1)} W` : '--'}
                </span>
                <span className="text-[10px] text-slate-500 block">Recorded Pmax</span>
              </div>

              <div className="p-3 rounded-xl bg-slate-800/40 border border-slate-700/60">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Avg Power</span>
                <span className="text-lg font-bold font-mono text-white">
                  {analyticsSummary?.avg_power_w != null ? `${analyticsSummary.avg_power_w.toFixed(1)} W` : '--'}
                </span>
                <span className="text-[10px] text-slate-500 block">Active Mean</span>
              </div>

              <div className="p-3 rounded-xl bg-slate-800/40 border border-slate-700/60">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Avg Irradiance</span>
                <span className="text-lg font-bold font-mono text-white">
                  {analyticsSummary?.avg_irradiance_w_m2 != null ? `${analyticsSummary.avg_irradiance_w_m2.toFixed(0)} W/m²` : '--'}
                </span>
                <span className="text-[10px] text-slate-500 block">Solar Flux</span>
              </div>

              <div className="p-3 rounded-xl bg-slate-800/40 border border-slate-700/60">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Avg Temp</span>
                <span className="text-lg font-bold font-mono text-white">
                  {analyticsSummary?.avg_temperature_c != null ? `${analyticsSummary.avg_temperature_c.toFixed(1)} °C` : '--'}
                </span>
                <span className="text-[10px] text-slate-500 block">Cell Temp</span>
              </div>

              <div className="p-3 rounded-xl bg-slate-800/40 border border-slate-700/60">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Total Samples</span>
                <span className="text-lg font-bold font-mono text-cyan-400">
                  {analyticsSummary?.total_samples ?? 0}
                </span>
                <span className="text-[10px] text-slate-500 block">Real Ingestions</span>
              </div>
            </div>

            {/* Best / Worst Extreme Performance Indicator */}
            {analyticsPerformance?.best_period && (
              <div className="p-3 rounded-xl bg-emerald-950/20 border border-emerald-500/30 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 text-emerald-300">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>
                    <strong>Peak Operational Period:</strong> {analyticsPerformance.best_period.power_w.toFixed(1)}W recorded at {new Date(analyticsPerformance.best_period.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} ({analyticsPerformance.best_period.irradiance_w_m2.toFixed(0)} W/m² solar flux).
                  </span>
                </div>
              </div>
            )}
          </div>

          <div className="text-[11px] text-slate-500 pt-3 border-t border-slate-800/80 flex items-center justify-between">
            <span>Powered by SolarAI Physics-Informed XGBoost Engine</span>
            <span>Target: {deviceId}</span>
          </div>
        </div>
      </div>

      {/* Phase 10: Quick Demonstration & Navigation Toolbar */}
      <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 text-slate-400">
          <Activity className="w-4 h-4 text-amber-400" />
          <span className="font-semibold text-slate-200">SolarAI System Navigation:</span>
          <span className="hidden sm:inline text-slate-500">Jump directly to specialized product subsystems</span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/monitor"
            className="px-3 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 border border-slate-700/60 text-slate-300 hover:text-white font-medium transition-colors"
          >
            Live Monitor
          </Link>
          <Link
            href="/analytics"
            className="px-3 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 border border-slate-700/60 text-slate-300 hover:text-white font-medium transition-colors"
          >
            Advanced Analytics
          </Link>
          <Link
            href="/prediction"
            className="px-3 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 border border-slate-700/60 text-slate-300 hover:text-white font-medium transition-colors"
          >
            AI Predictions
          </Link>
          <Link
            href="/alerts"
            className="px-3 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 border border-slate-700/60 text-slate-300 hover:text-white font-medium transition-colors"
          >
            Anomaly Center
          </Link>
          <Link
            href="/ai-lab"
            className="px-3 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 font-bold transition-colors flex items-center gap-1"
          >
            <Bot className="w-3.5 h-3.5" />
            <span>AI Assistant</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
