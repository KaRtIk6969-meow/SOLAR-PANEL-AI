'use client';

import React from 'react';
import Link from 'next/link';
import { AlertItem } from '@/types/solar';
import { useSolar } from '@/context/SolarContext';
import { AlertTriangle, AlertCircle, Info, CheckCircle2, ArrowRight } from 'lucide-react';

interface RecentAlertsCardProps {
  alerts: AlertItem[];
  onResolve: (id: string) => void;
  className?: string;
}

export function RecentAlertsCard({ alerts, onResolve, className = '' }: RecentAlertsCardProps) {
  const { modelEval } = useSolar();
  const activeAlerts = alerts.filter(a => !a.isResolved).slice(0, 3);
  const criticalCount = alerts.filter(a => !a.isResolved && a.severity === 'critical').length;
  const warningCount = alerts.filter(a => !a.isResolved && a.severity === 'warning').length;
  const activeCount = alerts.filter(a => !a.isResolved).length;

  const getSeverityBadge = (severity: AlertItem['severity']) => {
    switch (severity) {
      case 'critical':
        return {
          icon: AlertCircle,
          badge: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
          dot: 'bg-rose-500',
        };
      case 'warning':
        return {
          icon: AlertTriangle,
          badge: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
          dot: 'bg-amber-500',
        };
      case 'info':
      default:
        return {
          icon: Info,
          badge: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
          dot: 'bg-blue-500',
        };
    }
  };

  return (
    <div className={`p-5 lg:p-6 rounded-2xl bg-slate-900/60 backdrop-blur-md border border-slate-800/80 flex flex-col justify-between ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            <h3 className="text-base font-bold text-white tracking-tight">
              Recent System Alerts
            </h3>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Automated anomaly detection from edge telemetry stream
          </p>
        </div>

        <div className="flex items-center gap-2">
          {criticalCount > 0 && (
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/15 border border-rose-500/30 text-rose-300">
              {criticalCount} Critical
            </span>
          )}
          {warningCount > 0 && (
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/15 border border-amber-500/30 text-amber-300">
              {warningCount} Warning
            </span>
          )}
          <Link
            href="/alerts"
            className="text-xs font-semibold text-amber-400 hover:text-amber-300 flex items-center gap-1 transition-colors ml-1"
          >
            <span>View All ({activeCount})</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      {/* Alerts List */}
      <div className="space-y-3 flex-1">
        {activeAlerts.length === 0 ? (
          <div className="py-8 flex flex-col items-center justify-center text-center text-slate-400 space-y-2">
            <CheckCircle2 className="w-8 h-8 text-emerald-400" />
            <p className="text-sm font-medium text-slate-300">System operating normally.</p>
            <p className="text-xs text-slate-500 max-w-xs">
              No active electrical, thermal, or AI performance anomalies detected on this panel array.
            </p>
          </div>
        ) : (
          activeAlerts.map((alert) => {
            const { icon: SeverityIcon, badge, dot } = getSeverityBadge(alert.severity);

            return (
              <div
                key={alert.id}
                className="p-3.5 rounded-xl bg-slate-800/40 border border-slate-800 hover:border-slate-700/80 transition-all space-y-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${dot} animate-pulse`} />
                    <span className="text-xs font-bold text-white">
                      {alert.title}
                    </span>
                  </div>

                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${badge}`}>
                    {alert.severity}
                  </span>
                </div>

                <p className="text-xs text-slate-400 leading-relaxed">
                  {alert.description}
                </p>

                <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-xs">
                  <span suppressHydrationWarning className="text-[11px] text-slate-500">
                    {new Date(alert.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>

                  <button
                    onClick={() => onResolve(alert.id)}
                    className="px-2.5 py-1 rounded-lg text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-colors"
                  >
                    Acknowledge
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer tip */}
      <div className="pt-4 mt-2 border-t border-slate-800/80 text-[11px] text-slate-400 flex items-center justify-between">
        <span>Hardware team diagnostic recommendations</span>
        <span className="text-slate-400 font-mono">XGBoost v1.4</span>
      </div>
    </div>
  );
}
