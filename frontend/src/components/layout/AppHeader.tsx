'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  Menu, 
  Bell, 
  Play, 
  Pause, 
  RefreshCw, 
  Radio, 
  SlidersHorizontal,
  Clock,
  ShieldCheck,
  AlertTriangle
} from 'lucide-react';
import { useSolar } from '@/context/SolarContext';
import { SimulationScenario } from '@/types/solar';

interface AppHeaderProps {
  onOpenSidebar: () => void;
}

const routeTitles: Record<string, { title: string; subtitle: string }> = {
  '/': { title: 'SolarAI Command Center', subtitle: 'Live generation, efficiency tracking & AI diagnostics' },
  '/dashboard': { title: 'SolarAI Command Center', subtitle: 'Live generation, efficiency tracking & AI diagnostics' },
  '/monitor': { title: 'Real-Time Telemetry Monitor', subtitle: 'High-frequency voltage, current, irradiance & temperature telemetry' },
  '/analytics': { title: 'Historical Performance Analytics', subtitle: 'Energy yield accumulation, irradiance curves & temperature derating' },
  '/health': { title: 'Panel Health & Diagnostic Scoring', subtitle: 'Physical degradation, soiling ratio, cell mismatch & health grades' },
  '/prediction': { title: 'AI Expected Power vs Actual Yield', subtitle: 'Physics-informed machine learning baseline & residual analysis' },
  '/alerts': { title: 'System Diagnostics & Anomaly Center', subtitle: 'Automated fault detection, soiling alerts & maintenance recommendations' },
  '/ai-lab': { title: 'AI Simulation & Stress-Test Lab', subtitle: 'Simulate environmental faults, test model response & inspect XGBoost weights' },
  '/device': { title: 'ESP32 Hardware Node Management', subtitle: 'Sensor calibration parameters, Wi-Fi link status & ingestion API payload' },
  '/reports': { title: 'Automated Performance Reports', subtitle: 'Daily/weekly audit summaries, performance ratios & printable certificates' },
  '/settings': { title: 'Platform & Alert Settings', subtitle: 'Threshold configurations, unit conversions & API security keys' },
};

export function AppHeader({ onOpenSidebar }: AppHeaderProps) {
  const pathname = usePathname();
  const { 
    device, 
    alerts, 
    scenario, 
    setScenario, 
    isLiveStreaming, 
    setIsLiveStreaming, 
    refreshData,
    lastUpdated,
    isDeviceOffline
  } = useSolar();

  const [timeString, setTimeString] = useState<string>('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTimeString(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const routeInfo = routeTitles[pathname] || { 
    title: 'SolarAI Dashboard', 
    subtitle: 'Intelligent Solar Monitoring Platform' 
  };

  const activeAlerts = alerts.filter(a => !a.isResolved);

  return (
    <header className="h-16 lg:h-20 bg-[#0a0f1d]/80 backdrop-blur-xl border-b border-slate-800/80 sticky top-0 z-30 px-4 lg:px-8 flex items-center justify-between">
      {/* Left: Mobile hamburger & Page Title */}
      <div className="flex items-center gap-3 lg:gap-5">
        <button
          onClick={onOpenSidebar}
          className="lg:hidden p-2 rounded-xl text-slate-300 hover:text-white bg-slate-800/60 border border-slate-700/60"
          aria-label="Open sidebar"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div>
          <h1 className="text-base lg:text-xl font-bold text-white tracking-tight flex items-center gap-2">
            {routeInfo.title}
          </h1>
          <p className="text-xs text-slate-400 hidden sm:block truncate max-w-md lg:max-w-xl">
            {routeInfo.subtitle}
          </p>
        </div>
      </div>

      {/* Right: Controls & Status Pills */}
      <div className="flex items-center gap-2.5 lg:gap-4">
        {/* Scenario Switcher Quick Dropdown */}
        <div className="hidden md:flex items-center gap-2 bg-slate-900/90 border border-slate-800 rounded-xl px-2.5 py-1.5">
          <SlidersHorizontal className="w-3.5 h-3.5 text-amber-400" />
          <span className="text-xs text-slate-400 font-medium">Scenario:</span>
          <select
            value={scenario}
            onChange={(e) => setScenario(e.target.value as SimulationScenario)}
            className="bg-transparent text-xs text-amber-300 font-semibold focus:outline-none cursor-pointer"
          >
            <option value="normal" className="bg-slate-900 text-slate-200">Sunny (Normal)</option>
            <option value="soiling" className="bg-slate-900 text-amber-300">Dust & Soiling (-18%)</option>
            <option value="shading" className="bg-slate-900 text-cyan-300">Passing Cloud Shading</option>
            <option value="heatwave" className="bg-slate-900 text-rose-300">Heatwave (Derating)</option>
            <option value="open_circuit" className="bg-slate-900 text-red-400">Open Circuit Disconnect</option>
            <option value="sensor_drift" className="bg-slate-900 text-yellow-300">Sensor Noise Drift</option>
          </select>
        </div>

        {/* Live Stream Toggle & Refresh */}
        <div className="flex items-center bg-slate-900/90 border border-slate-800 rounded-xl p-1">
          <button
            onClick={() => setIsLiveStreaming(!isLiveStreaming)}
            title={isLiveStreaming ? 'Pause live telemetry stream' : 'Resume live stream'}
            className={`p-1.5 rounded-lg text-xs font-medium transition-colors ${
              isLiveStreaming 
                ? 'text-emerald-400 bg-emerald-500/10' 
                : 'text-slate-400 hover:text-white'
            }`}
          >
            {isLiveStreaming ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
          </button>
          <button
            onClick={refreshData}
            title="Manual sample refresh"
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Hardware Status Pill */}
        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900/90 border border-slate-800 text-xs">
          {isDeviceOffline ? (
            <>
              <span className="relative flex h-2 w-2">
                <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500" />
              </span>
              <span className="text-slate-300 font-medium">ESP32</span>
              <span className="text-rose-400 font-semibold font-mono text-[11px]">Device Offline</span>
            </>
          ) : (
            <>
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              <span className="text-slate-300 font-medium">ESP32</span>
              <span className="text-emerald-400 font-semibold font-mono text-[11px]">Online</span>
            </>
          )}
        </div>

        {/* Clock */}
        <div className="hidden xl:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900/90 border border-slate-800 text-xs text-slate-300 font-mono">
          <Clock className="w-3.5 h-3.5 text-slate-400" />
          <span>{timeString}</span>
        </div>

        {/* Alerts Bell Button */}
        <Link
          href="/alerts"
          className="relative p-2 lg:p-2.5 rounded-xl bg-slate-900/90 border border-slate-800 text-slate-300 hover:text-white hover:border-slate-700 transition-colors"
          title="View Alerts"
        >
          <Bell className="w-4 h-4" />
          {activeAlerts.length > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-rose-500 text-[10px] font-bold text-white flex items-center justify-center animate-pulse">
              {activeAlerts.length}
            </span>
          )}
        </Link>
      </div>
    </header>
  );
}
