'use client';

import React, { useState } from 'react';
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  Line, 
  XAxis, 
  YAxis, 
  Tooltip, 
  CartesianGrid, 
  Legend 
} from 'recharts';
import { TelemetryReading } from '@/types/solar';
import { Zap, Sparkles, SunMedium, Eye } from 'lucide-react';

interface LivePowerChartProps {
  data: TelemetryReading[];
  className?: string;
}

export function LivePowerChart({ data, className = '' }: LivePowerChartProps) {
  const [showTheoretical, setShowTheoretical] = useState(false);
  const [showIrradiance, setShowIrradiance] = useState(false);

  // Format data for Recharts
  const formattedData = data.map((reading) => {
    const time = new Date(reading.timestamp);
    const timeLabel = time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    return {
      time: timeLabel,
      actualPower: reading.power,
      predictedPower: reading.predictedPower,
      theoreticalPower: reading.theoreticalPower,
      irradiance: reading.irradiance,
      residual: reading.residual,
      efficiency: reading.efficiency,
    };
  });

  return (
    <div className={`p-5 lg:p-6 rounded-2xl bg-slate-900/60 backdrop-blur-md border border-slate-800/80 flex flex-col ${className}`}>
      {/* Chart Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse" />
            <h3 className="text-base font-bold text-white tracking-tight">
              Live Power Generation: Actual vs AI Expected
            </h3>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Real-time MPPT power output compared against the trained physics-ML model forecast
          </p>
        </div>

        {/* View toggles */}
        <div className="flex items-center gap-2 text-xs">
          <button
            onClick={() => setShowTheoretical(!showTheoretical)}
            className={`px-3 py-1.5 rounded-xl border transition-all ${
              showTheoretical
                ? 'bg-cyan-500/15 border-cyan-500/40 text-cyan-300 font-semibold'
                : 'bg-slate-800/60 border-slate-700/60 text-slate-400 hover:text-slate-200'
            }`}
          >
            Theoretical STC
          </button>

          <button
            onClick={() => setShowIrradiance(!showIrradiance)}
            className={`px-3 py-1.5 rounded-xl border transition-all ${
              showIrradiance
                ? 'bg-amber-500/15 border-amber-500/40 text-amber-300 font-semibold'
                : 'bg-slate-800/60 border-slate-700/60 text-slate-400 hover:text-slate-200'
            }`}
          >
            Irradiance Curve
          </button>
        </div>
      </div>

      {/* Main Recharts Area */}
      <div className="h-72 sm:h-80 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={formattedData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <defs>
              {/* Amber gradient for actual power */}
              <linearGradient id="actualPowerGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.0} />
              </linearGradient>

              {/* Purple gradient for AI Predicted */}
              <linearGradient id="predictedGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#a855f7" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#a855f7" stopOpacity={0.0} />
              </linearGradient>
            </defs>

            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />

            <XAxis 
              dataKey="time" 
              stroke="#64748b" 
              fontSize={11} 
              tickLine={false}
              axisLine={{ stroke: '#334155' }}
            />

            <YAxis 
              yAxisId="power"
              stroke="#64748b" 
              fontSize={11} 
              tickLine={false}
              axisLine={{ stroke: '#334155' }}
              domain={[0, 110]}
              unit="W"
            />

            {showIrradiance && (
              <YAxis 
                yAxisId="irradiance" 
                orientation="right" 
                stroke="#d97706" 
                fontSize={10} 
                tickLine={false} 
                domain={[0, 1100]}
                unit="W/m²"
              />
            )}

            <Tooltip 
              content={({ active, payload, label }) => {
                if (active && payload && payload.length) {
                  const pt = payload[0].payload;
                  const delta = pt.actualPower - pt.predictedPower;
                  const isLoss = delta < -2.0;

                  return (
                    <div className="p-3.5 rounded-xl bg-slate-900/95 border border-slate-700/80 shadow-2xl backdrop-blur-xl text-xs space-y-2 min-w-[210px]">
                      <div className="flex items-center justify-between border-b border-slate-800 pb-1.5 font-semibold text-slate-300">
                        <span>Time: {label}</span>
                        <span className="text-amber-400 font-mono">{pt.irradiance} W/m²</span>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1.5 text-amber-400 font-medium">
                          <Zap className="w-3.5 h-3.5" /> Actual Power:
                        </span>
                        <span className="font-bold text-white font-mono">{pt.actualPower.toFixed(1)} W</span>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1.5 text-purple-400 font-medium">
                          <Sparkles className="w-3.5 h-3.5" /> AI Expected:
                        </span>
                        <span className="font-bold text-slate-200 font-mono">{pt.predictedPower.toFixed(1)} W</span>
                      </div>

                      {showTheoretical && (
                        <div className="flex items-center justify-between text-cyan-400">
                          <span>Theoretical STC:</span>
                          <span className="font-mono">{pt.theoreticalPower.toFixed(1)} W</span>
                        </div>
                      )}

                      <div className="pt-1.5 border-t border-slate-800 flex items-center justify-between text-[11px]">
                        <span className="text-slate-400">Model Residual:</span>
                        <span className={`font-mono font-bold ${isLoss ? 'text-rose-400' : 'text-emerald-400'}`}>
                          {delta > 0 ? `+${delta.toFixed(1)}` : delta.toFixed(1)} W
                        </span>
                      </div>
                    </div>
                  );
                }
                return null;
              }}
            />

            {/* AI Predicted Line */}
            <Area
              yAxisId="power"
              type="monotone"
              dataKey="predictedPower"
              name="AI Expected Power"
              stroke="#a855f7"
              strokeWidth={2.2}
              strokeDasharray="4 4"
              fillOpacity={1}
              fill="url(#predictedGrad)"
            />

            {/* Actual Power Area */}
            <Area
              yAxisId="power"
              type="monotone"
              dataKey="actualPower"
              name="Actual Power"
              stroke="#f59e0b"
              strokeWidth={2.8}
              fillOpacity={1}
              fill="url(#actualPowerGrad)"
            />

            {/* Optional Theoretical Curve */}
            {showTheoretical && (
              <Line
                yAxisId="power"
                type="monotone"
                dataKey="theoreticalPower"
                name="Theoretical (STC)"
                stroke="#06b6d4"
                strokeWidth={1.5}
                strokeDasharray="2 2"
                dot={false}
              />
            )}

            {/* Optional Irradiance Curve */}
            {showIrradiance && (
              <Line
                yAxisId="irradiance"
                type="monotone"
                dataKey="irradiance"
                name="Solar Irradiance"
                stroke="#eab308"
                strokeWidth={1.2}
                dot={false}
              />
            )}
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Legend & Summary Footer */}
      <div className="flex flex-wrap items-center justify-between pt-4 mt-2 border-t border-slate-800/80 text-xs text-slate-400 gap-3">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-1 rounded-full bg-amber-400" />
            <span className="text-slate-300 font-medium">Actual Power (W)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-1 rounded-full bg-purple-400 border-dashed" />
            <span className="text-slate-300 font-medium">AI Expected (W)</span>
          </div>
          {showTheoretical && (
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-1 rounded-full bg-cyan-400" />
              <span className="text-cyan-300">Theoretical STC</span>
            </div>
          )}
        </div>

        <div className="text-[11px] text-slate-400">
          Target: 100W STC Monocrystalline Array
        </div>
      </div>
    </div>
  );
}
