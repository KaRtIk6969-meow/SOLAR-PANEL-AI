'use client';

import React from 'react';
import { PanelHealth } from '@/types/solar';
import { HeartPulse, Thermometer, CloudFog, Sparkles, CheckCircle2, HelpCircle } from 'lucide-react';

interface GaugeClusterProps {
  health: PanelHealth | null;
  className?: string;
}

export function GaugeCluster({ health, className = '' }: GaugeClusterProps) {
  const hasHealth = health !== null && health.overallScore !== undefined && !isNaN(health.overallScore);
  const score = hasHealth ? Math.round(health.overallScore) : null;

  // SVG circular geometry
  const radius = 64;
  const strokeWidth = 10;
  const normalizedRadius = radius - strokeWidth / 2;
  const circumference = normalizedRadius * 2 * Math.PI;
  // Use a 270 degree arc for gauge look
  const strokeDashoffset = score !== null 
    ? circumference - (score / 100) * (circumference * 0.75)
    : circumference * 0.75;

  const getScoreColor = (val: number | null) => {
    if (val === null) return { stroke: '#475569', text: 'text-slate-500', bg: 'bg-slate-500/20' };
    if (val >= 90) return { stroke: '#10b981', text: 'text-emerald-400', bg: 'bg-emerald-500/20' };
    if (val >= 75) return { stroke: '#f59e0b', text: 'text-amber-400', bg: 'bg-amber-500/20' };
    return { stroke: '#f43f5e', text: 'text-rose-400', bg: 'bg-rose-500/20' };
  };

  const colors = getScoreColor(score);

  return (
    <div className={`p-5 lg:p-6 rounded-2xl bg-slate-900/60 backdrop-blur-md border border-slate-800/80 flex flex-col justify-between ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="flex items-center gap-2">
            <HeartPulse className={`w-4 h-4 ${hasHealth ? 'text-emerald-400' : 'text-slate-500'}`} />
            <h3 className="text-base font-bold text-white tracking-tight">
              Overall Panel Health
            </h3>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Holistic diagnostic score synthesized by AI
          </p>
        </div>

        <span className={`px-2.5 py-1 rounded-xl text-xs font-extrabold uppercase border ${
          !hasHealth
            ? 'bg-slate-800 border-slate-700 text-slate-400'
            : health.grade.startsWith('A') 
            ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300' 
            : health.grade === 'B'
            ? 'bg-amber-500/15 border-amber-500/30 text-amber-300'
            : 'bg-rose-500/15 border-rose-500/30 text-rose-300'
        }`}>
          {hasHealth ? `Grade ${health.grade}` : 'Grade --'}
        </span>
      </div>

      {/* Circular Gauge Center */}
      <div className="flex flex-col items-center justify-center my-2 relative">
        <svg height={radius * 2} width={radius * 2} className="rotate-[-135deg] transform">
          {/* Background Track */}
          <circle
            stroke="#1e293b"
            fill="transparent"
            strokeWidth={strokeWidth}
            strokeDasharray={`${circumference * 0.75} ${circumference}`}
            r={normalizedRadius}
            cx={radius}
            cy={radius}
            strokeLinecap="round"
          />
          {/* Animated Value Arc */}
          <circle
            stroke={colors.stroke}
            fill="transparent"
            strokeWidth={strokeWidth}
            strokeDasharray={`${circumference * 0.75} ${circumference}`}
            style={{ 
              strokeDashoffset,
              transition: 'stroke-dashoffset 1s ease-in-out, stroke 0.5s ease',
            }}
            r={normalizedRadius}
            cx={radius}
            cy={radius}
            strokeLinecap="round"
          />
        </svg>

        {/* Center Text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className={`text-3xl font-extrabold font-mono tracking-tight ${colors.text}`}>
            {score !== null ? score : '--'}
          </span>
          <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
            / 100 Score
          </span>
        </div>
      </div>

      <div className="text-center mb-4">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-800/80 border border-slate-700/60 text-xs font-medium text-slate-200">
          {hasHealth ? (
            <>
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>{health.healthStatusText}</span>
            </>
          ) : (
            <>
              <HelpCircle className="w-3.5 h-3.5 text-slate-500" />
              <span className="text-slate-400">Awaiting Hardware Telemetry</span>
            </>
          )}
        </div>
      </div>

      {/* Loss Factors Breakdown */}
      <div className="grid grid-cols-3 gap-2 pt-4 border-t border-slate-800/80 text-xs">
        <div className="p-2.5 rounded-xl bg-slate-800/40 border border-slate-800 text-center">
          <div className="flex items-center justify-center gap-1 text-slate-400 mb-1">
            <Thermometer className="w-3 h-3 text-rose-400" />
            <span className="text-[11px]">Thermal</span>
          </div>
          <span className="font-mono font-bold text-slate-200">
            {hasHealth ? `-${health.thermalLossPct}%` : '--'}
          </span>
        </div>

        <div className="p-2.5 rounded-xl bg-slate-800/40 border border-slate-800 text-center">
          <div className="flex items-center justify-center gap-1 text-slate-400 mb-1">
            <CloudFog className="w-3 h-3 text-amber-400" />
            <span className="text-[11px]">Soiling</span>
          </div>
          <span className="font-mono font-bold text-slate-200">
            {hasHealth ? `-${health.soilingLossPct}%` : '--'}
          </span>
        </div>

        <div className="p-2.5 rounded-xl bg-slate-800/40 border border-slate-800 text-center">
          <div className="flex items-center justify-center gap-1 text-slate-400 mb-1">
            <Sparkles className="w-3 h-3 text-cyan-400" />
            <span className="text-[11px]">Shading</span>
          </div>
          <span className="font-mono font-bold text-slate-200">
            {hasHealth ? `-${health.shadingLossPct}%` : '--'}
          </span>
        </div>
      </div>
    </div>
  );
}
