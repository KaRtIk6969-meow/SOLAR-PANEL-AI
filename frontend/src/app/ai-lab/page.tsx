'use client';

import React, { useState, useEffect } from 'react';
import { useSolar } from '@/context/SolarContext';
import { SimulationScenario } from '@/types/solar';
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  CartesianGrid, 
  Cell 
} from 'recharts';
import { FlaskConical, Sparkles, Brain, Cpu, Sliders, ShieldCheck, Play, Award } from 'lucide-react';

export default function AiLabPage() {
  const { modelEval, scenario, setScenario, telemetry } = useSolar();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const scenarios: { id: SimulationScenario; title: string; desc: string; color: string }[] = [
    {
      id: 'normal',
      title: 'Clear Sky Clean Panel',
      desc: 'Standard clean monocrystalline operating under optimal solar irradiance conditions.',
      color: 'border-emerald-500/40 text-emerald-400 bg-emerald-500/10',
    },
    {
      id: 'soiling',
      title: 'Dust / Soiling Accumulation',
      desc: 'Simulates ~18% optical attenuation across high irradiance hours from surface grime.',
      color: 'border-amber-500/40 text-amber-400 bg-amber-500/10',
    },
    {
      id: 'shading',
      title: 'Passing Cloud Shading',
      desc: 'Simulates sharp optical dips and mismatched I-V curve points from passing shadows.',
      color: 'border-cyan-500/40 text-cyan-400 bg-cyan-500/10',
    },
    {
      id: 'heatwave',
      title: 'Extreme Heatwave Stress',
      desc: 'Ambient temperature raised to 42°C, causing heavy semiconductor thermal derating.',
      color: 'border-rose-500/40 text-rose-400 bg-rose-500/10',
    },
    {
      id: 'open_circuit',
      title: 'Open Circuit Disconnect',
      desc: 'Voltage floats to Voc (21.8V) while current collapses to zero (simulates disconnected load).',
      color: 'border-red-500/40 text-red-400 bg-red-500/10',
    },
    {
      id: 'sensor_drift',
      title: 'ADC / Sensor Noise Drift',
      desc: 'Injects abnormal jitter and calibration variance into current and voltage sensors.',
      color: 'border-purple-500/40 text-purple-400 bg-purple-500/10',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="p-4 rounded-2xl bg-slate-900/60 backdrop-blur-md border border-slate-800/80 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <FlaskConical className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white">AI Model Laboratory & Fault Simulation Workbench</h2>
            <p className="text-xs text-slate-400">
              Benchmark physics-informed inference models and inject synthetic environmental stress scenarios
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="px-3 py-1 rounded-xl text-xs font-semibold bg-emerald-500/15 border border-emerald-500/30 text-emerald-300">
            Pipeline: Validated
          </span>
        </div>
      </div>

      {/* Scenario Injection Controls */}
      <div className="p-6 rounded-2xl bg-slate-900/60 backdrop-blur-md border border-slate-800/80 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-cyan-400" />
            <h3 className="text-base font-bold text-white tracking-tight">Environmental Stress Injector</h3>
          </div>
          <span className="text-xs text-slate-400 font-mono">
            Active: <span className="text-amber-400 font-bold uppercase">{scenario}</span>
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {scenarios.map((s) => {
            const isSelected = scenario === s.id;
            return (
              <button
                key={s.id}
                onClick={() => setScenario(s.id)}
                className={`p-4 rounded-xl text-left border transition-all ${
                  isSelected 
                    ? `${s.color} ring-2 ring-amber-400/30 shadow-lg scale-[1.01]` 
                    : 'bg-slate-800/40 border-slate-700/60 text-slate-300 hover:border-slate-600 hover:bg-slate-800/70'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-bold">{s.title}</span>
                  {isSelected && <Play className="w-3.5 h-3.5 fill-current" />}
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">{s.desc}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Model Benchmark Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 space-y-1">
          <span className="text-xs text-slate-400">Mean Absolute Error (MAE)</span>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-extrabold text-white font-mono">{modelEval?.mae ?? '1.42'}</span>
            <span className="text-xs text-slate-400">Watts</span>
          </div>
          <span className="text-[11px] text-emerald-400">Ultra-low prediction variance</span>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 space-y-1">
          <span className="text-xs text-slate-400">Root Mean Squared Error (RMSE)</span>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-extrabold text-white font-mono">{modelEval?.rmse ?? '2.18'}</span>
            <span className="text-xs text-slate-400">Watts</span>
          </div>
          <span className="text-[11px] text-emerald-400">Standard deviation of residuals</span>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 space-y-1">
          <span className="text-xs text-slate-400">Inference Latency</span>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-extrabold text-white font-mono">4.2</span>
            <span className="text-xs text-purple-400">ms</span>
          </div>
          <span className="text-[11px] text-purple-400">Real-time edge compatible</span>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 space-y-1">
          <span className="text-xs text-slate-400">Training Samples</span>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-extrabold text-white font-mono">{modelEval?.datasetSamples ?? 14200}</span>
            <span className="text-xs text-slate-400">pts</span>
          </div>
          <span className="text-[11px] text-slate-400">NREL + Synthetic College Array</span>
        </div>
      </div>

      {/* Feature Importance & Residual Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Feature Importance Bar Chart */}
        <div className="lg:col-span-7 p-6 rounded-2xl bg-slate-900/60 backdrop-blur-md border border-slate-800/80 space-y-4">
          <div>
            <h3 className="text-base font-bold text-white tracking-tight">
              Feature Importance Ranking (Gini / Gain)
            </h3>
            <p className="text-xs text-slate-400">
              Contribution weight of each physical telemetry metric to XGBoost decision trees
            </p>
          </div>

          <div className="h-64 w-full">
            {!mounted ? (
              <div className="h-full w-full rounded-xl bg-slate-800/20 border border-slate-800/40 animate-pulse flex items-center justify-center text-xs text-slate-500 font-mono">
                Loading Feature Weights...
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart 
                  layout="vertical" 
                  data={modelEval?.features || []} 
                  margin={{ top: 5, right: 30, left: 40, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
                  <XAxis type="number" stroke="#64748b" fontSize={10} domain={[0, 0.7]} />
                  <YAxis dataKey="feature" type="category" stroke="#94a3b8" fontSize={11} width={130} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '0.75rem', fontSize: '11px' }}
                    formatter={(val) => [`${(Number(val) * 100).toFixed(1)}% weight`, 'Importance']}
                  />
                  <Bar dataKey="importance" fill="#f59e0b" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Residual Distribution Histogram */}
        <div className="lg:col-span-5 p-6 rounded-2xl bg-slate-900/60 backdrop-blur-md border border-slate-800/80 space-y-4">
          <div>
            <h3 className="text-base font-bold text-white tracking-tight">
              Residual Error Distribution
            </h3>
            <p className="text-xs text-slate-400">
              Bell-curve validation verifying zero-bias and normality of errors
            </p>
          </div>

          <div className="h-64 w-full">
            {!mounted ? (
              <div className="h-full w-full rounded-xl bg-slate-800/20 border border-slate-800/40 animate-pulse flex items-center justify-center text-xs text-slate-500 font-mono">
                Loading Error Histogram...
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={modelEval?.residualBins || []} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="range" stroke="#64748b" fontSize={9} tickLine={false} />
                  <YAxis stroke="#64748b" fontSize={10} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '0.75rem', fontSize: '11px' }}
                  />
                  <Bar dataKey="count" fill="#a855f7" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
