'use client';

import React, { useState } from 'react';
import { useSolar } from '@/context/SolarContext';
import { AlertItem } from '@/types/solar';
import { 
  Bell, 
  AlertCircle, 
  AlertTriangle, 
  Info, 
  CheckCircle2, 
  Filter, 
  Check, 
  Wrench, 
  Calendar 
} from 'lucide-react';

export default function AlertsPage() {
  const { alerts, resolveAlert } = useSolar();
  const [severityFilter, setSeverityFilter] = useState<'all' | 'critical' | 'warning' | 'info'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'resolved'>('all');

  const filteredAlerts = alerts.filter((alert) => {
    if (severityFilter !== 'all' && alert.severity !== severityFilter) return false;
    if (statusFilter === 'active' && alert.isResolved) return false;
    if (statusFilter === 'resolved' && !alert.isResolved) return false;
    return true;
  });

  const activeCount = alerts.filter((a) => !a.isResolved).length;
  const criticalCount = alerts.filter((a) => a.severity === 'critical' && !a.isResolved).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="p-4 rounded-2xl bg-slate-900/60 backdrop-blur-md border border-slate-800/80 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400">
            <Bell className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white">System Diagnostics & Anomaly Center</h2>
            <p className="text-xs text-slate-400">
              Automated anomaly triage with actionable hardware resolution instructions
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="px-3 py-1 rounded-xl text-xs font-bold bg-rose-500/15 border border-rose-500/30 text-rose-300">
            {criticalCount} Critical
          </span>
          <span className="px-3 py-1 rounded-xl text-xs font-bold bg-amber-500/15 border border-amber-500/30 text-amber-300">
            {activeCount} Active Total
          </span>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-3 rounded-2xl bg-slate-900/60 border border-slate-800/80">
        <div className="flex items-center gap-2 text-xs font-medium">
          <span className="text-slate-400 flex items-center gap-1.5 px-2">
            <Filter className="w-3.5 h-3.5" /> Severity:
          </span>
          {(['all', 'critical', 'warning', 'info'] as const).map((sev) => (
            <button
              key={sev}
              onClick={() => setSeverityFilter(sev)}
              className={`px-3 py-1.5 rounded-xl capitalize transition-all ${
                severityFilter === sev
                  ? 'bg-amber-500 text-slate-950 font-bold'
                  : 'bg-slate-800/60 text-slate-300 hover:text-white'
              }`}
            >
              {sev}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 text-xs font-medium">
          <span className="text-slate-400 px-2">Status:</span>
          {(['all', 'active', 'resolved'] as const).map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-xl capitalize transition-all ${
                statusFilter === st
                  ? 'bg-amber-500 text-slate-950 font-bold'
                  : 'bg-slate-800/60 text-slate-300 hover:text-white'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Alerts Feed */}
      <div className="space-y-4">
        {filteredAlerts.length === 0 ? (
          <div className="p-12 rounded-2xl bg-slate-900/60 border border-slate-800/80 flex flex-col items-center justify-center text-center text-slate-400 space-y-3">
            <CheckCircle2 className="w-12 h-12 text-emerald-400" />
            <h3 className="text-base font-bold text-white">No Matching Alerts</h3>
            <p className="text-xs text-slate-400 max-w-sm">
              Either all anomalies have been resolved or the selected filter criteria yielded no active alerts.
            </p>
          </div>
        ) : (
          filteredAlerts.map((alert) => {
            const isCrit = alert.severity === 'critical';
            const isWarn = alert.severity === 'warning';

            return (
              <div
                key={alert.id}
                className={`p-5 rounded-2xl bg-slate-900/60 backdrop-blur-md border transition-all space-y-3 ${
                  alert.isResolved 
                    ? 'border-slate-800/60 opacity-60' 
                    : isCrit 
                    ? 'border-rose-500/40 shadow-lg shadow-rose-500/5' 
                    : isWarn 
                    ? 'border-amber-500/40 shadow-lg shadow-amber-500/5' 
                    : 'border-slate-800'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    {isCrit ? (
                      <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
                    ) : isWarn ? (
                      <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
                    ) : (
                      <Info className="w-5 h-5 text-blue-400 shrink-0" />
                    )}
                    <h3 className="text-sm font-bold text-white">{alert.title}</h3>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                      isCrit 
                        ? 'bg-rose-500/15 border-rose-500/30 text-rose-300' 
                        : isWarn 
                        ? 'bg-amber-500/15 border-amber-500/30 text-amber-300' 
                        : 'bg-blue-500/15 border-blue-500/30 text-blue-300'
                    }`}>
                      {alert.severity}
                    </span>

                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase border ${
                      alert.isResolved 
                        ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300' 
                        : 'bg-amber-500/15 border-amber-500/30 text-amber-300'
                    }`}>
                      {alert.isResolved ? 'Resolved' : 'Active'}
                    </span>
                  </div>
                </div>

                <p className="text-xs text-slate-300 leading-relaxed">
                  {alert.description}
                </p>

                {/* Metric Deviation Bar */}
                <div className="p-3 rounded-xl bg-slate-800/40 border border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-4">
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase block">Metric</span>
                      <span className="font-semibold text-slate-200">{alert.metricName}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase block">Recorded</span>
                      <span className="font-mono font-bold text-rose-400">{alert.metricValue} {alert.unit}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase block">AI Baseline</span>
                      <span className="font-mono font-bold text-emerald-400">{alert.expectedValue} {alert.unit}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 text-slate-400 text-[11px]">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>{new Date(alert.timestamp).toLocaleString()}</span>
                  </div>
                </div>

                {/* Hardware Troubleshooting Action */}
                <div className="p-3.5 rounded-xl bg-amber-500/5 border border-amber-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                  <div className="flex items-start gap-2 text-amber-200/90">
                    <Wrench className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold text-amber-300">Teammate Action Required: </span>
                      <span>{alert.recommendedAction}</span>
                    </div>
                  </div>

                  {!alert.isResolved && (
                    <button
                      onClick={() => resolveAlert(alert.id)}
                      className="px-3 py-1.5 rounded-xl text-xs font-bold text-slate-950 bg-amber-400 hover:bg-amber-300 transition-colors flex items-center justify-center gap-1.5 shrink-0"
                    >
                      <Check className="w-3.5 h-3.5" />
                      Mark Resolved
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
