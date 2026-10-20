'use client';

import React, { useState } from 'react';
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

  // Compute total energy generated today in Wh
  const totalWh = history.reduce((sum, pt) => sum + pt.power * 0.5, 0); // 0.5 hr intervals
  const totalKWh = Math.round((totalWh / 1000) * 100) / 100;
  const co2SavedKg = Math.round(totalKWh * 0.709 * 100) / 100; // ~0.709 kg CO2 per kWh grid offset

  // 7-day bar chart data from reports
  const weeklyData = reports.map((rep) => ({
    date: rep.date.slice(5),
    energyWh: rep.totalEnergyGeneratedWh,
    expectedWh: rep.theoreticalEnergyWh,
    prPct: rep.performanceRatioPct,
    peakWatts: rep.peakPowerWatts,
  })).reverse();

  // Hourly curve data
  const hourlyData = history.map((r) => ({
    time: new Date(r.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    actualPower: r.power,
    irradiance: r.irradiance,
    efficiency: r.efficiency,
    cellTemp: r.temperature,
  }));

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

        {/* Time range buttons */}
        <div className="flex items-center bg-slate-800/80 p-1 rounded-xl border border-slate-700/60 text-xs font-semibold">
          <button
            onClick={() => setTimeRange('24h')}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              timeRange === '24h'
                ? 'bg-amber-500 text-slate-950 font-bold'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            Today (24h)
          </button>
          <button
            onClick={() => setTimeRange('7d')}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              timeRange === '7d'
                ? 'bg-amber-500 text-slate-950 font-bold'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            Past 7 Days
          </button>
          <button
            onClick={() => setTimeRange('30d')}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              timeRange === '30d'
                ? 'bg-amber-500 text-slate-950 font-bold'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            Past 30 Days
          </button>
        </div>
      </div>

      {/* Yield Summary Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Cumulative Energy Yield</span>
            <Zap className="w-4 h-4 text-amber-400" />
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-extrabold text-white font-mono">{totalKWh}</span>
            <span className="text-sm text-slate-400 font-semibold">kWh</span>
          </div>
          <span className="text-[11px] text-emerald-400">~{Math.round(totalWh)} Watt-hours</span>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Performance Ratio (PR)</span>
            <Award className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-extrabold text-white font-mono">92.8</span>
            <span className="text-sm text-slate-400 font-semibold">%</span>
          </div>
          <span className="text-[11px] text-emerald-400">High efficiency class</span>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>CO₂ Emission Offset</span>
            <Leaf className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-extrabold text-white font-mono">{co2SavedKg}</span>
            <span className="text-sm text-slate-400 font-semibold">kg CO₂</span>
          </div>
          <span className="text-[11px] text-slate-400">Clean solar offset</span>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Equivalent Energy Value</span>
            <DollarSign className="w-4 h-4 text-amber-400" />
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-extrabold text-white font-mono">₹{(totalKWh * 8.5).toFixed(2)}</span>
            <span className="text-sm text-slate-400 font-semibold">INR</span>
          </div>
          <span className="text-[11px] text-slate-400">College grid tariff</span>
        </div>
      </div>

      {/* Main Chart Section: Multi-axis Daily or 7-Day Performance */}
      <div className="p-5 lg:p-6 rounded-2xl bg-slate-900/60 backdrop-blur-md border border-slate-800/80 space-y-4">
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
        </div>
      </div>
    </div>
  );
}
