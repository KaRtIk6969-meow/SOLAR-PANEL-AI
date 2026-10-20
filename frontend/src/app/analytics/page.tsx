'use client';

import React, { useState, useEffect } from 'react';
import { useSolar } from '@/context/SolarContext';
import { 
  ResponsiveContainer, 
  ComposedChart, 
  Line, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  CartesianGrid, 
  Legend 
} from 'recharts';
import { TrendingUp, Calendar, Zap, DollarSign, Leaf, Award } from 'lucide-react';

export default function AnalyticsPage() {
  const { history, reports } = useSolar();
  const [timeRange, setTimeRange] = useState<'24h' | '7d' | '30d'>('24h');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Compute total energy generated today in Wh
  const totalWh = (history || []).reduce((sum, pt) => sum + (pt.power || 0) * 0.5, 0); // 0.5 hr intervals
  const totalKWh = Math.round((totalWh / 1000) * 100) / 100;
  const co2SavedKg = Math.round(totalKWh * 0.709 * 100) / 100; // ~0.709 kg CO2 per kWh grid offset

  // 7-day bar chart data from reports
  const weeklyData = (reports || []).map((rep) => ({
    date: rep.date.slice(5),
    energyWh: rep.totalEnergyGeneratedWh,
    expectedWh: rep.theoreticalEnergyWh,
    prPct: rep.performanceRatioPct,
    peakWatts: rep.peakPowerWatts,
  })).reverse();

  // Hourly curve data
  const hourlyData = (history || []).map((r) => {
    const d = new Date(r.timestamp);
    const timeLabel = isNaN(d.getTime()) 
      ? '--:--' 
      : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    return {
      time: timeLabel,
      actualPower: r.power != null ? r.power : 0,
      irradiance: r.irradiance != null ? r.irradiance : 0,
      efficiency: r.efficiency != null ? r.efficiency : 0,
      cellTemp: r.temperature != null ? r.temperature : 0,
    };
  });

  return (
    <div className="space-y-6">
      {/* Top Range Selector & Stat Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-slate-900/60 backdrop-blur-md border border-slate-800/80">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white">Yield & Efficiency Analytics</h2>
            <p className="text-xs text-slate-400">
              Aggregated energy harvesting performance and degradation trends
            </p>
          </div>
        </div>

        {/* Range Buttons */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-800/80 border border-slate-700/60 self-start sm:self-auto">
          {(['24h', '7d', '30d'] as const).map((r) => (
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
      </div>

      {/* Aggregate KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Harvested Today</span>
            <Zap className="w-4 h-4 text-amber-400" />
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-extrabold text-white font-mono">{totalWh.toFixed(0)}</span>
            <span className="text-xs text-slate-400 font-sans">Wh ({totalKWh} kWh)</span>
          </div>
          <span className="text-[11px] text-emerald-400">Nominal generation</span>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Avg Performance Ratio</span>
            <Award className="w-4 h-4 text-purple-400" />
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-extrabold text-white font-mono">
              {reports && reports.length > 0 ? reports[0].performanceRatioPct : 88.4}%
            </span>
            <span className="text-xs text-purple-400 font-sans">PR</span>
          </div>
          <span className="text-[11px] text-purple-400">IEC 61724 Standard</span>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Carbon Offset</span>
            <Leaf className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-extrabold text-white font-mono">{co2SavedKg}</span>
            <span className="text-xs text-slate-400 font-sans">kg CO₂</span>
          </div>
          <span className="text-[11px] text-emerald-400">Clean energy offset</span>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Financial Offset</span>
            <DollarSign className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-extrabold text-white font-mono">
              ₹{(totalKWh * 8.2).toFixed(2)}
            </span>
            <span className="text-xs text-slate-400 font-sans">INR</span>
          </div>
          <span className="text-[11px] text-cyan-400">@ ₹8.20 / commercial kWh</span>
        </div>
      </div>

      {/* Main Multi-Metric Dynamic Chart */}
      <div className="p-6 rounded-2xl bg-slate-900/60 backdrop-blur-md border border-slate-800/80 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-white tracking-tight">
              {timeRange === '24h' ? '24-Hour Power vs Irradiance Synchronization' : '7-Day Energy Production vs Expected Target'}
            </h3>
            <p className="text-xs text-slate-400">
              {timeRange === '24h' 
                ? 'Coordinated plot of solar flux driving instantaneous photovoltaic conversion'
                : 'Daily energy harvesting (Wh) vs theoretical maximum clear-sky target'}
            </p>
          </div>
        </div>

        <div className="h-80 w-full">
          {!mounted ? (
            <div className="h-full w-full rounded-xl bg-slate-800/20 border border-slate-800/40 animate-pulse flex items-center justify-center text-xs text-slate-500 font-mono">
              Loading Yield Curves...
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              {timeRange === '24h' ? (
                <ComposedChart data={hourlyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="time" stroke="#64748b" fontSize={11} tickLine={false} />
                  <YAxis yAxisId="pwr" stroke="#f59e0b" fontSize={11} domain={[0, 110]} unit="W" />
                  <YAxis yAxisId="irr" orientation="right" stroke="#eab308" fontSize={11} domain={[0, 1100]} unit="W/m²" />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '0.75rem', fontSize: '12px' }}
                  />
                  <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                  <Bar yAxisId="pwr" dataKey="actualPower" name="Generated Power (W)" fill="#f59e0b" radius={[4, 4, 0, 0]} opacity={0.85} />
                  <Line yAxisId="irr" type="monotone" dataKey="irradiance" name="Solar Irradiance (W/m²)" stroke="#eab308" strokeWidth={2.5} dot={false} />
                </ComposedChart>
              ) : (
                <ComposedChart data={weeklyData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="date" stroke="#64748b" fontSize={11} tickLine={false} />
                  <YAxis stroke="#f59e0b" fontSize={11} unit="Wh" />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '0.75rem', fontSize: '12px' }}
                  />
                  <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                  <Bar dataKey="energyWh" name="Actual Energy (Wh)" fill="#10b981" radius={[6, 6, 0, 0]} />
                  <Line type="monotone" dataKey="expectedWh" name="Expected Target (Wh)" stroke="#a855f7" strokeWidth={2.5} strokeDasharray="4 4" />
                </ComposedChart>
              )}
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}
