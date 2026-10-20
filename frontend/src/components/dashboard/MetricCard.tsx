'use client';

import React from 'react';
import { LucideIcon } from 'lucide-react';

interface MetricCardProps {
  title: string;
  value: number | string | null | undefined;
  unit: string;
  icon: LucideIcon;
  subValue?: string;
  change?: {
    value: string;
    isPositive: boolean;
  };
  accentColor: 'amber' | 'emerald' | 'cyan' | 'purple' | 'rose' | 'blue';
  progress?: {
    current: number | null | undefined;
    max: number;
  };
  isLoading?: boolean;
}

const colorStyles = {
  amber: {
    bgGlow: 'hover:border-amber-500/40 group-hover:shadow-amber-500/10',
    iconBg: 'bg-amber-500/15 text-amber-400 border border-amber-500/30',
    barFill: 'bg-amber-500',
    pillText: 'text-amber-400',
  },
  emerald: {
    bgGlow: 'hover:border-emerald-500/40 group-hover:shadow-emerald-500/10',
    iconBg: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30',
    barFill: 'bg-emerald-500',
    pillText: 'text-emerald-400',
  },
  cyan: {
    bgGlow: 'hover:border-cyan-500/40 group-hover:shadow-cyan-500/10',
    iconBg: 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/30',
    barFill: 'bg-cyan-500',
    pillText: 'text-cyan-400',
  },
  purple: {
    bgGlow: 'hover:border-purple-500/40 group-hover:shadow-purple-500/10',
    iconBg: 'bg-purple-500/15 text-purple-400 border border-purple-500/30',
    barFill: 'bg-purple-500',
    pillText: 'text-purple-400',
  },
  rose: {
    bgGlow: 'hover:border-rose-500/40 group-hover:shadow-rose-500/10',
    iconBg: 'bg-rose-500/15 text-rose-400 border border-rose-500/30',
    barFill: 'bg-rose-500',
    pillText: 'text-rose-400',
  },
  blue: {
    bgGlow: 'hover:border-blue-500/40 group-hover:shadow-blue-500/10',
    iconBg: 'bg-blue-500/15 text-blue-400 border border-blue-500/30',
    barFill: 'bg-blue-500',
    pillText: 'text-blue-400',
  },
};

export function MetricCard({
  title,
  value,
  unit,
  icon: Icon,
  subValue,
  change,
  accentColor,
  progress,
  isLoading = false,
}: MetricCardProps) {
  const styles = colorStyles[accentColor];
  const isAvailable = value !== null && value !== undefined && value !== '' && !(typeof value === 'number' && isNaN(value));
  const displayValue = isAvailable ? value : '--';
  const hasValidProgress = progress && progress.current !== null && progress.current !== undefined && !isNaN(progress.current) && progress.max > 0;
  const progressPercent = hasValidProgress ? Math.min(100, Math.max(0, (progress!.current! / progress!.max) * 100)) : 0;

  return (
    <div className={`group relative p-5 rounded-2xl bg-slate-900/60 backdrop-blur-md border border-slate-800/80 transition-all duration-300 hover:shadow-xl ${styles.bgGlow}`}>
      {/* Top Header */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold text-slate-400 tracking-wide uppercase">
          {title}
        </span>
        <div className={`w-8 h-8 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110 ${styles.iconBg}`}>
          <Icon className="w-4 h-4" />
        </div>
      </div>

      {/* Main Value Display */}
      <div className="flex items-baseline gap-1.5 mb-2">
        {isLoading ? (
          <div className="h-8 w-20 bg-slate-800 animate-pulse rounded-lg" />
        ) : (
          <>
            <span className={`text-2xl sm:text-3xl font-extrabold tracking-tight font-mono ${isAvailable ? 'text-white' : 'text-slate-500'}`}>
              {displayValue}
            </span>
            <span className="text-sm font-semibold text-slate-400">
              {unit}
            </span>
          </>
        )}
      </div>

      {/* Sub-value or Change Pill */}
      <div className="flex items-center justify-between text-xs text-slate-400 pt-1">
        {subValue && <span>{subValue}</span>}
        {change && (
          <span className={`font-medium ${change.isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
            {change.isPositive ? '↑' : '↓'} {change.value}
          </span>
        )}
      </div>

      {/* Optional Progress Mini-Bar */}
      {progress && (
        <div className="mt-3 w-full bg-slate-800/80 rounded-full h-1.5 overflow-hidden">
          <div 
            className={`h-full rounded-full transition-all duration-500 ${styles.barFill}`}
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      )}
    </div>
  );
}
