'use client';

import React from 'react';
import { TelemetryReading } from '@/types/solar';
import { Sun, Thermometer, Wind, Compass, CloudSun } from 'lucide-react';

interface EnvironmentalCardProps {
  telemetry: TelemetryReading;
  className?: string;
}

export function EnvironmentalCard({ telemetry, className = '' }: EnvironmentalCardProps) {
  // Approximate UV Index from irradiance
  const uvIndex = Math.min(11, Math.max(0, Math.round((telemetry.irradiance / 100) * 10) / 10));
  
  // Cell vs Ambient thermal delta
  const tempDelta = Math.round((telemetry.temperature - telemetry.ambientTemp) * 10) / 10;

  return (
    <div className={`p-5 lg:p-6 rounded-2xl bg-slate-900/60 backdrop-blur-md border border-slate-800/80 flex flex-col justify-between ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="flex items-center gap-2">
            <CloudSun className="w-4 h-4 text-amber-400" />
            <h3 className="text-base font-bold text-white tracking-tight">
              Environmental Conditions
            </h3>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Micro-climate telemetry influencing semiconductor efficiency
          </p>
        </div>

        <span className="px-2.5 py-1 rounded-xl text-xs font-semibold bg-amber-500/10 text-amber-300 border border-amber-500/20">
          UV Index: {uvIndex}
        </span>
      </div>

      {/* Grid of conditions */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        {/* Cell vs Ambient Temp */}
        <div className="p-3 rounded-xl bg-slate-800/40 border border-slate-800">
          <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-1">
            <Thermometer className="w-3.5 h-3.5 text-rose-400" />
            <span>Cell Surface</span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-xl font-bold font-mono text-white">
              {telemetry.temperature.toFixed(1)}
            </span>
            <span className="text-xs text-slate-400">°C</span>
          </div>
          <span className="text-[10px] text-rose-400 font-medium">
            +{tempDelta}°C above ambient
          </span>
        </div>

        {/* Ambient Air Temp */}
        <div className="p-3 rounded-xl bg-slate-800/40 border border-slate-800">
          <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-1">
            <Wind className="w-3.5 h-3.5 text-cyan-400" />
            <span>Ambient Weather</span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-xl font-bold font-mono text-white">
              {telemetry.ambientTemp.toFixed(1)}
            </span>
            <span className="text-xs text-slate-400">°C</span>
          </div>
          <span className="text-[10px] text-slate-400">
            Convection cooling
          </span>
        </div>

        {/* Irradiance */}
        <div className="p-3 rounded-xl bg-slate-800/40 border border-slate-800">
          <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-1">
            <Sun className="w-3.5 h-3.5 text-yellow-400" />
            <span>Solar Flux</span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-xl font-bold font-mono text-white">
              {telemetry.irradiance}
            </span>
            <span className="text-xs text-slate-400">W/m²</span>
          </div>
          <span className="text-[10px] text-amber-400">
            {telemetry.irradiance > 800 ? 'High Clear Sun' : telemetry.irradiance > 300 ? 'Moderate Flux' : 'Diffuse/Dusk'}
          </span>
        </div>

        {/* Solar Sun Arc Proxy */}
        <div className="p-3 rounded-xl bg-slate-800/40 border border-slate-800">
          <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-1">
            <Compass className="w-3.5 h-3.5 text-emerald-400" />
            <span>Zenith Orientation</span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-xl font-bold font-mono text-white">
              54.2°
            </span>
            <span className="text-xs text-slate-400">tilt</span>
          </div>
          <span className="text-[10px] text-emerald-400">
            Optimum True South
          </span>
        </div>
      </div>

      {/* Atmospheric summary bar */}
      <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 flex items-center justify-between text-xs">
        <span className="text-slate-400">Atmospheric Clearness Index ($K_t$)</span>
        <span className="font-mono font-bold text-amber-400">
          0.74 (Clear Sky)
        </span>
      </div>
    </div>
  );
}
