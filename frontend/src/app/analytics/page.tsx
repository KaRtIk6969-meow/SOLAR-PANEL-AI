'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useSolar } from '@/context/SolarContext';
import { 
  ResponsiveContainer, 
  ComposedChart, 
  LineChart,
  ScatterChart,
  Scatter,
  Line, 
  Bar, 
  Area,
  XAxis, 
  YAxis, 
  Tooltip, 
  CartesianGrid, 
  Legend,
  Cell
} from 'recharts';
import { 
  TrendingUp, 
  Zap, 
  Download, 
  RefreshCw, 
  AlertTriangle, 
  CheckCircle2, 
  Activity, 
  Flame, 
  SunMedium, 
  Cpu, 
  Layers, 
  Gauge,
  Sparkles,
  ShieldCheck,
  ChevronRight,
  Database
} from 'lucide-react';
import {
  fetchAnalyticsSummary,
  fetchAnalyticsTimeseries,
  fetchAnalyticsCorrelation,
  fetchAnalyticsPerformance,
  getAnalyticsExportUrl,
  BackendAnalyticsSummary,
  BackendTimeseriesResponse,
  BackendCorrelationResponse,
  BackendPerformanceAnalyticsResponse,
} from '@/lib/api';

type TimeRangeFilter = '1h' | '6h' | '24h' | '7d' | '30d' | 'all';
type AnalyticsTab = 'power' | 'correlation' | 'thermal' | 'electrical' | 'ai';

export default function AnalyticsPage() {
  const { device, isSimulated } = useSolar();
  const deviceId = device?.id || 'SOLAR-ESP32-01';

  const [timeRange, setTimeRange] = useState<TimeRangeFilter>('24h');
  const [activeTab, setActiveTab] = useState<AnalyticsTab>('power');
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [summary, setSummary] = useState<BackendAnalyticsSummary | null>(null);
  const [timeseries, setTimeseries] = useState<BackendTimeseriesResponse | null>(null);
  const [correlation, setCorrelation] = useState<BackendCorrelationResponse | null>(null);
  const [performance, setPerformance] = useState<BackendPerformanceAnalyticsResponse | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const loadAnalytics = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [sumRes, tsRes, corrRes, perfRes] = await Promise.all([
        fetchAnalyticsSummary(deviceId, timeRange),
        fetchAnalyticsTimeseries(deviceId, timeRange, 'auto'),
        fetchAnalyticsCorrelation(deviceId, timeRange),
        fetchAnalyticsPerformance(deviceId, timeRange),
      ]);

      setSummary(sumRes);
      setTimeseries(tsRes);
      setCorrelation(corrRes);
      setPerformance(perfRes);
      setLastUpdated(new Date());
    } catch (err: any) {
      console.error('[Analytics] Failed to fetch real analytics data:', err);
      setError(err?.message || 'Failed to fetch analytics from backend.');
    } finally {
      setLoading(false);
    }
  }, [deviceId, timeRange]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted) {
      loadAnalytics();
    }
  }, [mounted, loadAnalytics]);

  // Format timeseries points for recharts
  const chartPoints = (timeseries?.points || []).map((pt) => {
    const d = new Date(pt.timestamp);
    const timeLabel = isNaN(d.getTime()) 
      ? '--:--' 
      : timeRange === '7d' || timeRange === '30d' || timeRange === 'all'
        ? d.toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit' })
        : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    return {
      time: timeLabel,
      actualPower: pt.actual_power_w != null ? Number(pt.actual_power_w.toFixed(2)) : null,
      predictedPower: pt.predicted_power_w != null ? Number(pt.predicted_power_w.toFixed(2)) : null,
      residual: pt.residual_w != null ? Number(pt.residual_w.toFixed(2)) : null,
      voltage: pt.voltage_v != null ? Number(pt.voltage_v.toFixed(2)) : null,
      current: pt.current_a != null ? Number(pt.current_a.toFixed(2)) : null,
      temperature: pt.temperature_c != null ? Number(pt.temperature_c.toFixed(1)) : null,
      irradiance: pt.irradiance_w_m2 != null ? Number(pt.irradiance_w_m2.toFixed(1)) : null,
      efficiency: pt.efficiency_pct != null ? Number(pt.efficiency_pct.toFixed(2)) : null,
    };
  });

  const exportUrl = getAnalyticsExportUrl(deviceId, timeRange, false);
  const totalSamples = summary?.total_samples ?? 0;
  const hasData = totalSamples > 0 && chartPoints.length > 0;

  return (
    <div className="space-y-6">
      {/* Top Header & Interactive Filter Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-5 rounded-2xl bg-slate-900/70 backdrop-blur-md border border-slate-800 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-white tracking-tight">Advanced Analytics & Visualization</h2>
              <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                isSimulated 
                  ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30' 
                  : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
              }`}>
                <Database className="w-3 h-3" />
                {isSimulated ? 'DEMO MODE' : 'REAL SQLITE HARDWARE'}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Target Device: <span className="font-mono text-slate-200 font-semibold">{deviceId}</span> • Auto-synchronized with XGBoost ML & Hardware Health
            </p>
          </div>
        </div>

        {/* Controls: Time Range Selector, Export, Refresh */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-800/80 border border-slate-700/60">
            {(['1h', '6h', '24h', '7d', '30d', 'all'] as const).map((r) => (
              <button
                key={r}
                onClick={() => setTimeRange(r)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  timeRange === r
                    ? 'bg-amber-500 text-slate-950 shadow-md font-bold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {r.toUpperCase()}
              </button>
            ))}
          </div>

          <a
            href={exportUrl}
            download
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-800/90 hover:bg-slate-700 text-slate-200 border border-slate-700 hover:border-slate-600 transition-all shadow-sm"
            title="Download real telemetry and prediction dataset as CSV"
          >
            <Download className="w-3.5 h-3.5 text-amber-400" />
            <span>Export CSV</span>
          </a>

          <button
            onClick={loadAnalytics}
            disabled={loading}
            className="p-2 rounded-xl bg-slate-800/90 hover:bg-slate-700 text-slate-400 hover:text-white border border-slate-700 transition-all disabled:opacity-50"
            title="Refresh Real Backend Telemetry"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-amber-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* 8 Real Analytics KPI Summary Cards (Phase 12) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
        {/* 1: Average Power */}
        <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800/80 flex flex-col justify-between">
          <div className="text-[11px] font-medium text-slate-400 flex items-center justify-between">
            <span>Avg Power</span>
            <Zap className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <div className="my-1.5">
            <span className="text-xl font-bold font-mono text-white">
              {summary?.avg_power_w != null ? summary.avg_power_w.toFixed(1) : '--'}
            </span>
            <span className="text-[10px] text-slate-400 ml-1">W</span>
          </div>
          <span className="text-[10px] text-slate-500 truncate">Mean Active</span>
        </div>

        {/* 2: Peak Power */}
        <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800/80 flex flex-col justify-between">
          <div className="text-[11px] font-medium text-slate-400 flex items-center justify-between">
            <span>Peak Power</span>
            <Flame className="w-3.5 h-3.5 text-orange-400" />
          </div>
          <div className="my-1.5">
            <span className="text-xl font-bold font-mono text-amber-400">
              {summary?.max_power_w != null ? summary.max_power_w.toFixed(1) : '--'}
            </span>
            <span className="text-[10px] text-slate-400 ml-1">W</span>
          </div>
          <span className="text-[10px] text-slate-500 truncate">Maximum Pmax</span>
        </div>

        {/* 3: Harvested Energy (Wh) */}
        <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800/80 flex flex-col justify-between">
          <div className="text-[11px] font-medium text-slate-400 flex items-center justify-between">
            <span>Harvested</span>
            <Activity className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="my-1.5">
            <span className="text-xl font-bold font-mono text-emerald-400">
              {summary?.total_energy_wh != null ? summary.total_energy_wh.toFixed(1) : '--'}
            </span>
            <span className="text-[10px] text-slate-400 ml-1">Wh</span>
          </div>
          <span className="text-[10px] text-slate-500 truncate" title="Trapezoidal integration over actual continuous timestamps">
            Integrated Energy
          </span>
        </div>

        {/* 4: Average Irradiance */}
        <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800/80 flex flex-col justify-between">
          <div className="text-[11px] font-medium text-slate-400 flex items-center justify-between">
            <span>Avg Irradiance</span>
            <SunMedium className="w-3.5 h-3.5 text-yellow-400" />
          </div>
          <div className="my-1.5">
            <span className="text-xl font-bold font-mono text-white">
              {summary?.avg_irradiance_w_m2 != null ? summary.avg_irradiance_w_m2.toFixed(0) : '--'}
            </span>
            <span className="text-[10px] text-slate-400 ml-1">W/m²</span>
          </div>
          <span className="text-[10px] text-slate-500 truncate">Solar Flux</span>
        </div>

        {/* 5: Average Temperature */}
        <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800/80 flex flex-col justify-between">
          <div className="text-[11px] font-medium text-slate-400 flex items-center justify-between">
            <span>Avg Temp</span>
            <Flame className="w-3.5 h-3.5 text-red-400" />
          </div>
          <div className="my-1.5">
            <span className="text-xl font-bold font-mono text-white">
              {summary?.avg_temperature_c != null ? summary.avg_temperature_c.toFixed(1) : '--'}
            </span>
            <span className="text-[10px] text-slate-400 ml-1">°C</span>
          </div>
          <span className="text-[10px] text-slate-500 truncate">Cell Junction</span>
        </div>

        {/* 6: Average Efficiency */}
        <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800/80 flex flex-col justify-between">
          <div className="text-[11px] font-medium text-slate-400 flex items-center justify-between">
            <span>Efficiency</span>
            <Gauge className="w-3.5 h-3.5 text-cyan-400" />
          </div>
          <div className="my-1.5">
            <span className="text-xl font-bold font-mono text-cyan-400">
              {summary?.avg_efficiency_pct != null ? `${summary.avg_efficiency_pct.toFixed(1)}%` : '--'}
            </span>
          </div>
          <span className="text-[10px] text-slate-500 truncate">PV Conversion</span>
        </div>

        {/* 7: AI Accuracy (R²) */}
        <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800/80 flex flex-col justify-between">
          <div className="text-[11px] font-medium text-slate-400 flex items-center justify-between">
            <span>AI R² Score</span>
            <Sparkles className="w-3.5 h-3.5 text-purple-400" />
          </div>
          <div className="my-1.5">
            <span className="text-xl font-bold font-mono text-purple-400">
              {summary?.ai_r2_score != null ? `${(summary.ai_r2_score * 100).toFixed(1)}%` : '--'}
            </span>
          </div>
          <span className="text-[10px] text-slate-500 truncate">Model Fit</span>
        </div>

        {/* 8: Health Score & Alerts */}
        <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800/80 flex flex-col justify-between">
          <div className="text-[11px] font-medium text-slate-400 flex items-center justify-between">
            <span>Health Score</span>
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="my-1.5">
            <span className="text-xl font-bold font-mono text-emerald-400">
              {summary?.health_score != null ? `${summary.health_score.toFixed(0)}%` : '--'}
            </span>
          </div>
          <span className="text-[10px] text-slate-500 truncate">
            {summary?.active_alerts_count ? (
              <span className="text-amber-400 font-semibold">{summary.active_alerts_count} Active Alerts</span>
            ) : (
              <span className="text-emerald-500">Nominal</span>
            )}
          </span>
        </div>
      </div>

      {/* Main Multi-Tab Navigation */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab('power')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
            activeTab === 'power'
              ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
          }`}
        >
          <Zap className="w-3.5 h-3.5" />
          <span>Actual Power vs AI Expected</span>
        </button>

        <button
          onClick={() => setActiveTab('correlation')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
            activeTab === 'correlation'
              ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
          }`}
        >
          <SunMedium className="w-3.5 h-3.5" />
          <span>Irradiance Correlation</span>
        </button>

        <button
          onClick={() => setActiveTab('thermal')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
            activeTab === 'thermal'
              ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
          }`}
        >
          <Flame className="w-3.5 h-3.5" />
          <span>Thermal Derating</span>
        </button>

        <button
          onClick={() => setActiveTab('electrical')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
            activeTab === 'electrical'
              ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Electrical Operation</span>
        </button>

        <button
          onClick={() => setActiveTab('ai')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
            activeTab === 'ai'
              ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
          }`}
        >
          <Cpu className="w-3.5 h-3.5" />
          <span>AI Performance & Diagnostics</span>
        </button>
      </div>

      {/* Main Chart Card / Content */}
      <div className="p-6 rounded-2xl bg-slate-900/60 backdrop-blur-md border border-slate-800 space-y-5 shadow-xl">
        {loading && !hasData ? (
          <div className="h-96 w-full rounded-xl bg-slate-800/20 border border-slate-800/40 animate-pulse flex flex-col items-center justify-center text-xs text-slate-400 gap-2">
            <RefreshCw className="w-6 h-6 animate-spin text-amber-400" />
            <span>Loading Real SQLite Telemetry & ML Predictions...</span>
          </div>
        ) : !hasData ? (
          <div className="h-96 w-full rounded-xl bg-slate-800/10 border border-dashed border-slate-800 flex flex-col items-center justify-center text-slate-400 gap-3 p-6 text-center">
            <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center text-slate-500">
              <Database className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-300">No telemetry available for this time range.</p>
              <p className="text-xs text-slate-500 mt-1 max-w-sm">
                The hardware node '{deviceId}' has no recorded readings within the selected window. Try selecting 24H or ALL.
              </p>
            </div>
            <button
              onClick={() => setTimeRange('all')}
              className="px-4 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 text-xs font-semibold transition-all"
            >
              Switch to ALL Records
            </button>
          </div>
        ) : (
          <>
            {/* TAB 1: Actual Power vs AI Expected */}
            {activeTab === 'power' && (
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h3 className="text-base font-bold text-white tracking-tight">
                      Historical Power & AI Expected Forecast
                    </h3>
                    <p className="text-xs text-slate-400">
                      Direct comparison of real hardware generation against active XGBRegressor expected yield curve
                    </p>
                  </div>
                  <div className="flex items-center gap-4 text-xs">
                    <span className="flex items-center gap-1.5 text-amber-400">
                      <span className="w-3 h-3 rounded-full bg-amber-400 inline-block" /> Actual Power (W)
                    </span>
                    <span className="flex items-center gap-1.5 text-purple-400">
                      <span className="w-3 h-3 rounded-full bg-purple-400 inline-block" /> AI Expected (W)
                    </span>
                    <span className="flex items-center gap-1.5 text-cyan-400">
                      <span className="w-3 h-3 rounded-full bg-cyan-400 inline-block" /> Residual (W)
                    </span>
                  </div>
                </div>

                <div className="h-96 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={chartPoints} margin={{ top: 10, right: 15, left: -15, bottom: 0 }}>
                      <defs>
                        <linearGradient id="pwrGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.4}/>
                          <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                      <XAxis dataKey="time" stroke="#64748b" fontSize={11} tickLine={false} />
                      <YAxis yAxisId="pwr" stroke="#f59e0b" fontSize={11} unit="W" />
                      <YAxis yAxisId="res" orientation="right" stroke="#06b6d4" fontSize={11} unit="W" />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '0.75rem', fontSize: '12px' }}
                      />
                      <Area yAxisId="pwr" type="monotone" dataKey="actualPower" name="Actual Power (W)" stroke="#f59e0b" strokeWidth={2.5} fillOpacity={1} fill="url(#pwrGrad)" />
                      <Line yAxisId="pwr" type="monotone" dataKey="predictedPower" name="AI Expected Power (W)" stroke="#c084fc" strokeWidth={2} strokeDasharray="4 4" dot={false} connectNulls />
                      <Line yAxisId="res" type="monotone" dataKey="residual" name="Residual (W)" stroke="#06b6d4" strokeWidth={1.5} dot={false} connectNulls />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* TAB 2: Irradiance Correlation */}
            {activeTab === 'correlation' && (
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h3 className="text-base font-bold text-white tracking-tight">
                      Solar Irradiance vs Generated Power Correlation
                    </h3>
                    <p className="text-xs text-slate-400">
                      Evaluates photovoltaic conversion linearity across ambient solar flux
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400">Pearson Correlation r:</span>
                    <span className="px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-mono text-xs font-bold">
                      {correlation?.correlation_irradiance_power != null ? correlation.correlation_irradiance_power : '--'}
                    </span>
                  </div>
                </div>

                <div className="h-96 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <ScatterChart margin={{ top: 10, right: 15, left: -15, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                      <XAxis type="number" dataKey="x" name="Irradiance" unit=" W/m²" stroke="#64748b" fontSize={11} domain={['auto', 'auto']} />
                      <YAxis type="number" dataKey="y" name="Power" unit=" W" stroke="#f59e0b" fontSize={11} domain={['auto', 'auto']} />
                      <Tooltip 
                        cursor={{ strokeDasharray: '3 3' }} 
                        contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '0.75rem', fontSize: '12px' }}
                      />
                      <Scatter name="Irradiance vs Power" data={correlation?.irradiance_vs_power || []} fill="#eab308" shape="circle" />
                    </ScatterChart>
                  </ResponsiveContainer>
                </div>

                <div className="p-3 rounded-xl bg-slate-800/40 border border-slate-700/60 text-xs text-slate-400 flex items-center justify-between">
                  <span>Note: Statistical correlation demonstrates empirical sensitivity. Higher solar flux increases photon absorption and electrical current generation.</span>
                  <span className="text-slate-500 font-mono text-[11px] shrink-0">Sample count: {correlation?.irradiance_vs_power?.length || 0}</span>
                </div>
              </div>
            )}

            {/* TAB 3: Thermal Derating & Efficiency */}
            {activeTab === 'thermal' && (
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h3 className="text-base font-bold text-white tracking-tight">
                      Cell Temperature vs Generation & Efficiency
                    </h3>
                    <p className="text-xs text-slate-400">
                      Tracks thermal loss coefficients and high-temperature derating behavior
                    </p>
                  </div>
                  <div className="flex items-center gap-3 text-xs">
                    <span className="flex items-center gap-1.5 text-red-400">
                      <span className="w-3 h-3 rounded-full bg-red-400 inline-block" /> Cell Temp (°C)
                    </span>
                    <span className="flex items-center gap-1.5 text-cyan-400">
                      <span className="w-3 h-3 rounded-full bg-cyan-400 inline-block" /> Efficiency (%)
                    </span>
                  </div>
                </div>

                <div className="h-96 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartPoints} margin={{ top: 10, right: 15, left: -15, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                      <XAxis dataKey="time" stroke="#64748b" fontSize={11} tickLine={false} />
                      <YAxis yAxisId="temp" stroke="#ef4444" fontSize={11} unit="°C" />
                      <YAxis yAxisId="eff" orientation="right" stroke="#06b6d4" fontSize={11} unit="%" />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '0.75rem', fontSize: '12px' }}
                      />
                      <Line yAxisId="temp" type="monotone" dataKey="temperature" name="Cell Temperature (°C)" stroke="#ef4444" strokeWidth={2} dot={false} />
                      <Line yAxisId="eff" type="monotone" dataKey="efficiency" name="Efficiency (%)" stroke="#06b6d4" strokeWidth={2} dot={false} connectNulls />
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="p-3 rounded-xl bg-slate-800/40 border border-slate-700/60 flex items-center justify-between">
                    <span className="text-xs text-slate-400">Temperature Warning Threshold</span>
                    <span className="font-mono text-xs font-bold text-amber-400">&gt; 55.0 °C</span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-800/40 border border-slate-700/60 flex items-center justify-between">
                    <span className="text-xs text-slate-400">Critical Thermal Alarm</span>
                    <span className="font-mono text-xs font-bold text-red-400">&gt; 65.0 °C</span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-800/40 border border-slate-700/60 flex items-center justify-between">
                    <span className="text-xs text-slate-400">Temp / Efficiency Corr (r)</span>
                    <span className="font-mono text-xs font-bold text-purple-400">
                      {correlation?.correlation_temp_efficiency != null ? correlation.correlation_temp_efficiency : '--'}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 4: Electrical Operation */}
            {activeTab === 'electrical' && (
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h3 className="text-base font-bold text-white tracking-tight">
                      Array Electrical Parameters (Synchronized)
                    </h3>
                    <p className="text-xs text-slate-400">
                      Coordinated time-series of panel voltage, load current, and instantaneous output
                    </p>
                  </div>
                </div>

                <div className="h-96 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartPoints} margin={{ top: 10, right: 15, left: -15, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                      <XAxis dataKey="time" stroke="#64748b" fontSize={11} tickLine={false} />
                      <YAxis yAxisId="v" stroke="#38bdf8" fontSize={11} unit="V" />
                      <YAxis yAxisId="i" orientation="right" stroke="#34d399" fontSize={11} unit="A" />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '0.75rem', fontSize: '12px' }}
                      />
                      <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                      <Line yAxisId="v" type="monotone" dataKey="voltage" name="Voltage (V)" stroke="#38bdf8" strokeWidth={2} dot={false} />
                      <Line yAxisId="i" type="monotone" dataKey="current" name="Current (A)" stroke="#34d399" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                {/* Min / Max / Avg Summary Table */}
                <div className="overflow-x-auto rounded-xl border border-slate-800">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-800/60 text-slate-400 font-semibold uppercase tracking-wider">
                      <tr>
                        <th className="py-2.5 px-4">Parameter</th>
                        <th className="py-2.5 px-4">Minimum</th>
                        <th className="py-2.5 px-4">Average</th>
                        <th className="py-2.5 px-4">Maximum</th>
                        <th className="py-2.5 px-4">Latest Point</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800 font-mono text-slate-200">
                      <tr>
                        <td className="py-2.5 px-4 font-sans text-sky-400 font-medium">Voltage (V)</td>
                        <td className="py-2.5 px-4">{summary?.min_voltage_v != null ? `${summary.min_voltage_v.toFixed(2)} V` : '--'}</td>
                        <td className="py-2.5 px-4">{summary?.avg_voltage_v != null ? `${summary.avg_voltage_v.toFixed(2)} V` : '--'}</td>
                        <td className="py-2.5 px-4">{summary?.max_voltage_v != null ? `${summary.max_voltage_v.toFixed(2)} V` : '--'}</td>
                        <td className="py-2.5 px-4">{chartPoints[chartPoints.length - 1]?.voltage != null ? `${chartPoints[chartPoints.length - 1].voltage} V` : '--'}</td>
                      </tr>
                      <tr>
                        <td className="py-2.5 px-4 font-sans text-emerald-400 font-medium">Current (A)</td>
                        <td className="py-2.5 px-4">{summary?.min_current_a != null ? `${summary.min_current_a.toFixed(2)} A` : '--'}</td>
                        <td className="py-2.5 px-4">{summary?.avg_current_a != null ? `${summary.avg_current_a.toFixed(2)} A` : '--'}</td>
                        <td className="py-2.5 px-4">{summary?.max_current_a != null ? `${summary.max_current_a.toFixed(2)} A` : '--'}</td>
                        <td className="py-2.5 px-4">{chartPoints[chartPoints.length - 1]?.current != null ? `${chartPoints[chartPoints.length - 1].current} A` : '--'}</td>
                      </tr>
                      <tr>
                        <td className="py-2.5 px-4 font-sans text-amber-400 font-medium">Power (W)</td>
                        <td className="py-2.5 px-4">{summary?.min_power_w != null ? `${summary.min_power_w.toFixed(2)} W` : '--'}</td>
                        <td className="py-2.5 px-4">{summary?.avg_power_w != null ? `${summary.avg_power_w.toFixed(2)} W` : '--'}</td>
                        <td className="py-2.5 px-4">{summary?.max_power_w != null ? `${summary.max_power_w.toFixed(2)} W` : '--'}</td>
                        <td className="py-2.5 px-4">{chartPoints[chartPoints.length - 1]?.actualPower != null ? `${chartPoints[chartPoints.length - 1].actualPower} W` : '--'}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TAB 5: AI Performance & Diagnostics */}
            {activeTab === 'ai' && (
              <div className="space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h3 className="text-base font-bold text-white tracking-tight">
                      AI Model Metadata & Residual Error Distribution
                    </h3>
                    <p className="text-xs text-slate-400">
                      Actual training performance metrics retrieved directly from the backend model registry
                    </p>
                  </div>
                </div>

                {/* Model Metadata Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                  <div className="p-3 rounded-xl bg-slate-800/40 border border-slate-700/60">
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Model Name</span>
                    <span className="text-sm font-bold font-mono text-purple-400">{performance?.model_name || 'XGBoostRegressor'}</span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-800/40 border border-slate-700/60">
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Model Version</span>
                    <span className="text-sm font-bold font-mono text-slate-200">{performance?.model_version || 'v1.0'}</span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-800/40 border border-slate-700/60">
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Test R² Score</span>
                    <span className="text-sm font-bold font-mono text-emerald-400">
                      {performance?.r2_score != null ? performance.r2_score.toFixed(4) : '--'}
                    </span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-800/40 border border-slate-700/60">
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Test MAE</span>
                    <span className="text-sm font-bold font-mono text-amber-400">
                      {performance?.mae_w != null ? `${performance.mae_w.toFixed(4)} W` : '--'}
                    </span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-800/40 border border-slate-700/60">
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Test RMSE</span>
                    <span className="text-sm font-bold font-mono text-cyan-400">
                      {performance?.rmse_w != null ? `${performance.rmse_w.toFixed(4)} W` : '--'}
                    </span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-800/40 border border-slate-700/60">
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Training Samples</span>
                    <span className="text-sm font-bold font-mono text-white">
                      {performance?.train_samples != null ? performance.train_samples : '--'}
                    </span>
                  </div>
                </div>

                {/* Residual Error Distribution Histogram */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                    Prediction Residual Distribution (Actual Power - Predicted Power)
                  </h4>
                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={performance?.residual_distribution || []} margin={{ top: 10, right: 15, left: -15, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                        <XAxis dataKey="range" stroke="#64748b" fontSize={11} tickLine={false} />
                        <YAxis stroke="#c084fc" fontSize={11} />
                        <Tooltip 
                          contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '0.75rem', fontSize: '12px' }}
                        />
                        <Bar dataKey="count" name="Frequency Count" fill="#a855f7" radius={[6, 6, 0, 0]}>
                          {(performance?.residual_distribution || []).map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.range.includes('-') && !entry.range.includes('+') ? '#ef4444' : entry.range.includes('0.5') ? '#10b981' : '#a855f7'} />
                          ))}
                        </Bar>
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Best & Worst Performance Periods (Phase 9) */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                  {/* Best Performance Card */}
                  <div className="p-4 rounded-xl bg-emerald-950/20 border border-emerald-500/30 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs uppercase tracking-wider">
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Best Operational Period</span>
                      </div>
                      <span className="font-mono text-xs text-emerald-300 font-bold">
                        {performance?.best_period?.power_w != null ? `${performance.best_period.power_w.toFixed(1)} W` : '--'}
                      </span>
                    </div>

                    {performance?.best_period ? (
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <span className="text-[11px] text-slate-400 block">Timestamp:</span>
                          <span className="font-mono text-slate-200">
                            {new Date(performance.best_period.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                          </span>
                        </div>
                        <div>
                          <span className="text-[11px] text-slate-400 block">Solar Flux:</span>
                          <span className="font-mono text-slate-200">{performance.best_period.irradiance_w_m2.toFixed(0)} W/m²</span>
                        </div>
                        <div>
                          <span className="text-[11px] text-slate-400 block">Cell Temp:</span>
                          <span className="font-mono text-slate-200">{performance.best_period.temperature_c.toFixed(1)} °C</span>
                        </div>
                        <div>
                          <span className="text-[11px] text-slate-400 block">Health Score:</span>
                          <span className="font-mono text-emerald-400 font-bold">
                            {performance.best_period.health_score != null ? `${performance.best_period.health_score.toFixed(0)}%` : '--'}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-slate-500 italic">No valid operational records detected.</p>
                    )}
                  </div>

                  {/* Worst Performance Card */}
                  <div className="p-4 rounded-xl bg-amber-950/20 border border-amber-500/30 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-amber-400 font-bold text-xs uppercase tracking-wider">
                        <AlertTriangle className="w-4 h-4" />
                        <span>Lowest Performance Period</span>
                      </div>
                      <span className="font-mono text-xs text-amber-400 font-bold">
                        {performance?.worst_period?.power_w != null ? `${performance.worst_period.power_w.toFixed(1)} W` : '--'}
                      </span>
                    </div>

                    {performance?.worst_period ? (
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <span className="text-[11px] text-slate-400 block">Timestamp:</span>
                          <span className="font-mono text-slate-200">
                            {new Date(performance.worst_period.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                          </span>
                        </div>
                        <div>
                          <span className="text-[11px] text-slate-400 block">AI Deficit (Residual):</span>
                          <span className="font-mono text-red-400 font-bold">
                            {performance.worst_period.residual_w != null ? `${performance.worst_period.residual_w.toFixed(2)} W` : '--'}
                          </span>
                        </div>
                        <div>
                          <span className="text-[11px] text-slate-400 block">Cell Temp:</span>
                          <span className="font-mono text-slate-200">{performance.worst_period.temperature_c.toFixed(1)} °C</span>
                        </div>
                        <div>
                          <span className="text-[11px] text-slate-400 block">Diagnostic Alert:</span>
                          <span className="text-slate-300 truncate" title={performance.worst_period.alert_message || 'None'}>
                            {performance.worst_period.alert_message || 'None Active'}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-slate-500 italic">No anomaly or solar deficit records detected.</p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
