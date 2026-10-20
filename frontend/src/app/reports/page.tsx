'use client';

import React, { useState } from 'react';
import { useSolar } from '@/context/SolarContext';
import { DailyReportData } from '@/types/solar';
import { FileText, Printer, Download, Award, Calendar, Leaf, Zap, CheckCircle2 } from 'lucide-react';

export default function ReportsPage() {
  const { reports, device } = useSolar();
  const [selectedReport, setSelectedReport] = useState<DailyReportData>(reports[0]);

  const handlePrint = () => {
    window.print();
  };

  const handleExportCsv = () => {
    const headers = 'Date,Generated_Wh,Theoretical_Wh,PR_Percent,Peak_Watts,Max_Temp_C,Grade,CO2_Avoided_kg\n';
    const rows = reports.map(r => 
      `${r.date},${r.totalEnergyGeneratedWh},${r.theoreticalEnergyWh},${r.performanceRatioPct},${r.peakPowerWatts},${r.maxCellTempC},${r.healthGrade},${r.co2AvoidedKg}`
    ).join('\n');

    const blob = new Blob([headers + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `SolarAI_Report_${selectedReport.date}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Header & Export Actions */}
      <div className="p-4 rounded-2xl bg-slate-900/60 backdrop-blur-md border border-slate-800/80 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white">Daily Performance & Health Audit Reports</h2>
            <p className="text-xs text-slate-400">
              Automated synthesis of energy harvesting efficiency, optical losses, and hardware integrity
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCsv}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-400 hover:bg-amber-300 text-slate-950 transition-colors"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print Audit Sheet</span>
          </button>
        </div>
      </div>

      {/* Main Grid: Date Selector + Detailed Report Certificate */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Date Selector Sidebar */}
        <div className="lg:col-span-4 p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80 space-y-3">
          <h3 className="text-xs font-bold uppercase text-slate-400 tracking-wider">
            Available Daily Audits
          </h3>

          <div className="space-y-2">
            {reports.map((rep) => {
              const isSelected = selectedReport.id === rep.id;

              return (
                <button
                  key={rep.id}
                  onClick={() => setSelectedReport(rep)}
                  className={`w-full p-3.5 rounded-xl text-left border transition-all flex items-center justify-between ${
                    isSelected
                      ? 'bg-amber-500/15 border-amber-500/40 text-white shadow-md'
                      : 'bg-slate-800/40 border-slate-800 text-slate-300 hover:bg-slate-800/70'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      <span className="text-xs font-bold font-mono">{rep.date}</span>
                    </div>
                    <span className="text-[11px] text-slate-400 block">
                      Yield: {rep.totalEnergyGeneratedWh.toFixed(1)} Wh • PR: {rep.performanceRatioPct}%
                    </span>
                  </div>

                  <span className={`px-2 py-0.5 rounded text-xs font-extrabold uppercase border ${
                    rep.healthGrade.startsWith('A') 
                      ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300' 
                      : rep.healthGrade === 'B'
                      ? 'bg-amber-500/15 border-amber-500/30 text-amber-300'
                      : 'bg-rose-500/15 border-rose-500/30 text-rose-300'
                  }`}>
                    {rep.healthGrade}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Detailed Certificate Sheet */}
        <div className="lg:col-span-8 p-6 lg:p-8 rounded-2xl bg-slate-900/80 backdrop-blur-md border border-slate-800 space-y-6">
          {/* Certificate Header */}
          <div className="border-b border-slate-800 pb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="px-2.5 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  SolarAI Diagnostic Certificate
                </span>
                <span className="text-xs text-slate-400">ID: {selectedReport.id}</span>
              </div>
              <h2 className="text-xl font-extrabold text-white">Daily Performance Audit Summary</h2>
              <span className="text-xs text-slate-400">Audit Date: {selectedReport.date}</span>
            </div>

            <div className="text-right">
              <span className="text-xs text-slate-400 block">Overall Performance Grade</span>
              <span className="text-4xl font-extrabold text-emerald-400 font-mono">
                {selectedReport.healthGrade}
              </span>
            </div>
          </div>

          {/* Metric Quad */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-xl bg-slate-800/40 border border-slate-800">
              <span className="text-[11px] text-slate-400 block mb-1">Total Generation</span>
              <span className="text-lg font-bold font-mono text-white">
                {selectedReport.totalEnergyGeneratedWh.toFixed(1)}
              </span>
              <span className="text-xs text-slate-400 ml-1">Wh</span>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-800/40 border border-slate-800">
              <span className="text-[11px] text-slate-400 block mb-1">Performance Ratio</span>
              <span className="text-lg font-bold font-mono text-emerald-400">
                {selectedReport.performanceRatioPct}
              </span>
              <span className="text-xs text-slate-400 ml-1">%</span>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-800/40 border border-slate-800">
              <span className="text-[11px] text-slate-400 block mb-1">Peak Power</span>
              <span className="text-lg font-bold font-mono text-amber-400">
                {selectedReport.peakPowerWatts}
              </span>
              <span className="text-xs text-slate-400 ml-1">W</span>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-800/40 border border-slate-800">
              <span className="text-[11px] text-slate-400 block mb-1">CO₂ Avoided</span>
              <span className="text-lg font-bold font-mono text-cyan-400">
                {selectedReport.co2AvoidedKg}
              </span>
              <span className="text-xs text-slate-400 ml-1">kg</span>
            </div>
          </div>

          {/* Diagnostic Observations */}
          <div className="p-4 rounded-xl bg-slate-800/30 border border-slate-800 space-y-2">
            <h4 className="text-xs font-bold uppercase tracking-wide text-slate-300">
              AI Diagnostic Log & Operational Remarks
            </h4>
            <p className="text-xs text-slate-300 leading-relaxed">
              {selectedReport.summaryNotes}
            </p>
          </div>

          {/* Hardware & Array Spec Stamp */}
          <div className="pt-4 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
            <span>Hardware: {device.name} ({device.id})</span>
            <span>Firmware: {device.firmwareVersion}</span>
            <span>Compliant with IEEE 1547 / IEC 61724</span>
          </div>
        </div>
      </div>
    </div>
  );
}
