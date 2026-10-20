'use client';

import React from 'react';
import { useSolar } from '@/context/SolarContext';
import { GaugeCluster } from '@/components/dashboard/GaugeCluster';
import { 
  HeartPulse, 
  ShieldCheck, 
  AlertCircle, 
  Thermometer, 
  Sparkles, 
  CloudFog, 
  Wrench,
  CheckCircle2,
  TrendingDown
} from 'lucide-react';

export default function HealthPage() {
  const { health, telemetry } = useSolar();

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="p-4 rounded-2xl bg-slate-900/60 backdrop-blur-md border border-slate-800/80 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <HeartPulse className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white">Panel Health & Degradation Scoring</h2>
            <p className="text-xs text-slate-400">
              Multi-spectral diagnostic evaluation combining thermal, optical, and electrical parameters
            </p>
          </div>
        </div>

        <span className="px-3 py-1 rounded-xl text-xs font-bold uppercase bg-emerald-500/15 border border-emerald-500/30 text-emerald-300">
          Grade {health?.grade || '--'}
        </span>
      </div>

      {/* Main Grid: Gauge Cluster + Health Score Factor Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <GaugeCluster 
          health={health} 
          className="lg:col-span-5 min-h-[380px]" 
        />

        <div className="lg:col-span-7 p-6 rounded-2xl bg-slate-900/60 backdrop-blur-md border border-slate-800/80 flex flex-col justify-between space-y-4">
          <div>
            <h3 className="text-base font-bold text-white tracking-tight mb-1">
              Diagnostic Health Factor Attribution
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              Real-time calculation of internal and external derating factors
            </p>

            <div className="space-y-3.5">
              {/* Factor 1: Thermal Loss */}
              <div className="p-3.5 rounded-xl bg-slate-800/40 border border-slate-800 space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-2 font-semibold text-slate-200">
                    <Thermometer className="w-4 h-4 text-rose-400" />
                    Thermal Derating Penalty
                  </span>
                  <span className="font-mono font-bold text-rose-400">
                    {health?.thermalLossPct != null ? `-${health.thermalLossPct}%` : '--'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Panel cell temperature currently at {telemetry?.temperature != null ? `${telemetry.temperature.toFixed(1)}°C` : '--'}. Every degree above 25°C STC baseline causes ~0.38% power drop.
                </p>
              </div>

              {/* Factor 2: Soiling & Dust */}
              <div className="p-3.5 rounded-xl bg-slate-800/40 border border-slate-800 space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-2 font-semibold text-slate-200">
                    <CloudFog className="w-4 h-4 text-amber-400" />
                    Optical Soiling & Dust Factor
                  </span>
                  <span className="font-mono font-bold text-amber-400">
                    {health?.soilingLossPct != null ? `-${health.soilingLossPct}%` : '--'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Calculated by comparing peak clear-sky irradiance against the current short-circuit current ratio.
                </p>
              </div>

              {/* Factor 3: Annual Degradation */}
              <div className="p-3.5 rounded-xl bg-slate-800/40 border border-slate-800 space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-2 font-semibold text-slate-200">
                    <TrendingDown className="w-4 h-4 text-cyan-400" />
                    Estimated Annual Cell Aging
                  </span>
                  <span className="font-mono font-bold text-cyan-400">0.55% / yr</span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Monocrystalline silicon standard aging projection. Panel maintains &gt;90% rated output for 10+ years.
                </p>
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
            <span>Model: IEC 61724-1 Standard Compliance</span>
            <span className="text-emerald-400 font-medium">Valid Calibration</span>
          </div>
        </div>
      </div>

      {/* Recommended Maintenance Actions */}
      <div className="p-6 rounded-2xl bg-slate-900/60 backdrop-blur-md border border-slate-800/80 space-y-4">
        <div className="flex items-center gap-2">
          <Wrench className="w-5 h-5 text-amber-400" />
          <h3 className="text-base font-bold text-white tracking-tight">
            Automated Preventive Maintenance Guidance
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 rounded-xl bg-slate-800/30 border border-slate-800 space-y-2">
            <span className="text-xs font-bold text-amber-400 uppercase tracking-wide">Surface Hygiene</span>
            <p className="text-xs text-slate-300">
              Clean panel glass if soiling loss exceeds 5%. Use soft microfiber or de-ionized water during low sun (morning/evening) to avoid thermal shock.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-slate-800/30 border border-slate-800 space-y-2">
            <span className="text-xs font-bold text-cyan-400 uppercase tracking-wide">Ventilation & Mounting</span>
            <p className="text-xs text-slate-300">
              Ensure minimum 10cm gap behind the panel array to facilitate passive airflow and minimize thermal derating during peak summer hours.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-slate-800/30 border border-slate-800 space-y-2">
            <span className="text-xs font-bold text-emerald-400 uppercase tracking-wide">Electrical Terminations</span>
            <p className="text-xs text-slate-300">
              Inspect MC4 connectors, shunt resistor solder joints, and ESP32 screw terminal blocks for contact resistance or corrosion every 30 days.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
