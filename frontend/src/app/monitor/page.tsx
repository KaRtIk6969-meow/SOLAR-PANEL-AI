'use client';

import React, { useState, useEffect } from 'react';
import { useSolar } from '@/context/SolarContext';
import { 
  ResponsiveContainer, 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  Tooltip, 
  CartesianGrid 
} from 'recharts';
import { Activity, Zap, Flame, Sun, Radio, Download, Filter } from 'lucide-react';

export default function MonitorPage() {
  const { history, telemetry, isLiveStreaming, setIsLiveStreaming, lastUpdated } = useSolar();
  const [selectedSensor, setSelectedSensor] = useState<'all' | 'power' | 'electrical' | 'thermal'>('all');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const chartData = (history || []).slice(-20).map((r) => {
    const d = new Date(r.timestamp);
    const timeLabel = isNaN(d.getTime()) 
      ? '--:--:--' 
      : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    return {
      time: timeLabel,
      voltage: r.voltage != null ? r.voltage : 0,
      current: r.current != null ? r.current : 0,
      power: r.power != null ? r.power : 0,
      temp: r.temperature != null ? r.temperature : 0,
      ambient: r.ambientTemp != null ? r.ambientTemp : 0,
      irradiance: r.irradiance != null ? r.irradiance : 0,
    };
  });

  return (
    <div className="space-y-6">
      {/* Top Controls Bar */}
      <div className="p-4 rounded-2xl bg-slate-900/60 backdrop-blur-md border border-slate-800/80 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
            <Activity className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white">Live Multi-Sensor Bus Stream</h2>
            <p className="text-xs text-slate-400">
              Sampling frequency: ~0.33 Hz (every 3 seconds) • Buffer: 20 rolling samples
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsLiveStreaming(!isLiveStreaming)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
              isLiveStreaming 
                ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300' 
                : 'bg-amber-500/15 border-amber-500/30 text-amber-300'
            }`}
          >
            {isLiveStreaming ? '● Stream Active' : '❚❚ Stream Paused'}
          </button>
        </div>
      </div>

      {/* Grid of Dedicated Live Waveform Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart 1: Voltage & Current */}
        <div className="p-5 rounded-2xl bg-slate-900/60 backdrop-blur-md border border-slate-800/80 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-cyan-400" />
              <h3 className="text-sm font-bold text-white">Electrical I-V Curves</h3>
            </div>
            <div className="flex items-center gap-3 text-xs font-mono">
              <span className="text-cyan-400">V: {telemetry?.voltage != null ? `${telemetry.voltage.toFixed(2)}V` : '--'}</span>
              <span className="text-emerald-400">I: {telemetry?.current != null ? `${telemetry.current.toFixed(2)}A` : '--'}</span>
            </div>
          </div>

          <div className="h-56 w-full">
            {!mounted ? (
              <div className="h-full w-full rounded-xl bg-slate-800/20 border border-slate-800/40 animate-pulse flex items-center justify-center text-xs text-slate-500 font-mono">
                Initializing I-V Waveform...
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="time" stroke="#64748b" fontSize={10} tickLine={false} />
                  <YAxis yAxisId="volt" stroke="#06b6d4" fontSize={10} domain={[0, 25]} unit="V" />
                  <YAxis yAxisId="curr" orientation="right" stroke="#10b981" fontSize={10} domain={[0, 7]} unit="A" />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '0.75rem', fontSize: '11px' }} 
                  />
                  <Line yAxisId="volt" type="monotone" dataKey="voltage" stroke="#06b6d4" strokeWidth={2} dot={false} />
                  <Line yAxisId="curr" type="monotone" dataKey="current" stroke="#10b981" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Chart 2: Power Generation */}
        <div className="p-5 rounded-2xl bg-slate-900/60 backdrop-blur-md border border-slate-800/80 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
              <h3 className="text-sm font-bold text-white">Power Output (V × I)</h3>
            </div>
            <span className="text-xs font-mono font-bold text-amber-400">
              {telemetry?.power != null ? `${telemetry.power.toFixed(1)} Watts` : '--'}
            </span>
          </div>

          <div className="h-56 w-full">
            {!mounted ? (
              <div className="h-full w-full rounded-xl bg-slate-800/20 border border-slate-800/40 animate-pulse flex items-center justify-center text-xs text-slate-500 font-mono">
                Initializing Power Curve...
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="time" stroke="#64748b" fontSize={10} tickLine={false} />
                  <YAxis stroke="#f59e0b" fontSize={10} domain={[0, 110]} unit="W" />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '0.75rem', fontSize: '11px' }} 
                  />
                  <Line type="monotone" dataKey="power" stroke="#f59e0b" strokeWidth={2.5} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Chart 3: Temperature Probes */}
        <div className="p-5 rounded-2xl bg-slate-900/60 backdrop-blur-md border border-slate-800/80 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-400" />
              <h3 className="text-sm font-bold text-white">Thermal Dynamics</h3>
            </div>
            <div className="flex items-center gap-3 text-xs font-mono">
              <span className="text-rose-400">Cell: {telemetry?.temperature != null ? `${telemetry.temperature.toFixed(1)}°C` : '--'}</span>
              <span className="text-cyan-400">Amb: {telemetry?.ambientTemp != null ? `${telemetry.ambientTemp.toFixed(1)}°C` : '--'}</span>
            </div>
          </div>

          <div className="h-56 w-full">
            {!mounted ? (
              <div className="h-full w-full rounded-xl bg-slate-800/20 border border-slate-800/40 animate-pulse flex items-center justify-center text-xs text-slate-500 font-mono">
                Initializing Thermal Sensors...
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="time" stroke="#64748b" fontSize={10} tickLine={false} />
                  <YAxis stroke="#f43f5e" fontSize={10} domain={[15, 75]} unit="°C" />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '0.75rem', fontSize: '11px' }} 
                  />
                  <Line type="monotone" dataKey="temp" stroke="#f43f5e" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="ambient" stroke="#38bdf8" strokeWidth={1.5} strokeDasharray="3 3" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Chart 4: Solar Irradiance */}
        <div className="p-5 rounded-2xl bg-slate-900/60 backdrop-blur-md border border-slate-800/80 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
              <h3 className="text-sm font-bold text-white">Solar Flux (W/m²)</h3>
            </div>
            <span className="text-xs font-mono font-bold text-yellow-400">
              {telemetry?.irradiance != null ? `${telemetry.irradiance} W/m²` : '--'}
            </span>
          </div>

          <div className="h-56 w-full">
            {!mounted ? (
              <div className="h-full w-full rounded-xl bg-slate-800/20 border border-slate-800/40 animate-pulse flex items-center justify-center text-xs text-slate-500 font-mono">
                Initializing Pyranometer Flux...
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="time" stroke="#64748b" fontSize={10} tickLine={false} />
                  <YAxis stroke="#eab308" fontSize={10} domain={[0, 1100]} unit="W/m²" />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '0.75rem', fontSize: '11px' }} 
                  />
                  <Line type="monotone" dataKey="irradiance" stroke="#eab308" strokeWidth={2.2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* Raw Incoming Telemetry Table */}
      <div className="p-5 rounded-2xl bg-slate-900/60 backdrop-blur-md border border-slate-800/80 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-white">Live Ingestion Event Log</h3>
            <p className="text-xs text-slate-400">
              Chronological register of incoming sensor packets received from the ESP32
            </p>
          </div>
          <span className="text-xs font-mono text-emerald-400">
            Node: SOLAR-ESP32-01
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 font-medium">
                <th className="py-2.5 px-3">Timestamp</th>
                <th className="py-2.5 px-3">Voltage (V)</th>
                <th className="py-2.5 px-3">Current (A)</th>
                <th className="py-2.5 px-3">Power (W)</th>
                <th className="py-2.5 px-3">Cell Temp (°C)</th>
                <th className="py-2.5 px-3">Irradiance (W/m²)</th>
                <th className="py-2.5 px-3">Efficiency</th>
                <th className="py-2.5 px-3 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {history && history.length > 0 ? (
                history.slice(-6).reverse().map((r) => {
                  const d = new Date(r.timestamp);
                  const timeStr = isNaN(d.getTime()) 
                    ? '--:--:--' 
                    : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

                  return (
                    <tr key={r.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-2.5 px-3 text-slate-400">
                        {timeStr}
                      </td>
                      <td className="py-2.5 px-3 text-cyan-300 font-bold">{r.voltage != null ? r.voltage.toFixed(2) : '--'}</td>
                      <td className="py-2.5 px-3 text-emerald-300 font-bold">{r.current != null ? r.current.toFixed(2) : '--'}</td>
                      <td className="py-2.5 px-3 text-amber-300 font-bold">{r.power != null ? r.power.toFixed(1) : '--'}</td>
                      <td className="py-2.5 px-3 text-rose-300">{r.temperature != null ? r.temperature.toFixed(1) : '--'}</td>
                      <td className="py-2.5 px-3 text-yellow-300">{r.irradiance != null ? r.irradiance : '--'}</td>
                      <td className="py-2.5 px-3 text-purple-300">{r.efficiency != null ? `${r.efficiency.toFixed(1)}%` : '--'}</td>
                      <td className="py-2.5 px-3 text-right">
                        <span className="px-2 py-0.5 rounded text-[10px] font-sans font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                          VALID
                        </span>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-500 font-sans text-xs">
                    Waiting for incoming sensor packets from ESP32 node or database...
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
