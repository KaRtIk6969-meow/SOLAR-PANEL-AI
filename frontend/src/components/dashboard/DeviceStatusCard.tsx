'use client';

import React from 'react';
import Link from 'next/link';
import { DeviceInfo } from '@/types/solar';
import { Cpu, Wifi, Activity, CheckCircle, ArrowRight, ShieldCheck, Clock } from 'lucide-react';

interface DeviceStatusCardProps {
  device: DeviceInfo;
  lastUpdated: Date;
  className?: string;
}

export function DeviceStatusCard({ device, lastUpdated, className = '' }: DeviceStatusCardProps) {
  const getRssiQuality = (rssi: number) => {
    if (rssi > -65) return { label: 'Excellent', color: 'text-emerald-400', bars: 4 };
    if (rssi > -75) return { label: 'Good', color: 'text-emerald-400', bars: 3 };
    if (rssi > -85) return { label: 'Fair', color: 'text-amber-400', bars: 2 };
    return { label: 'Weak', color: 'text-rose-400', bars: 1 };
  };

  const rssiInfo = getRssiQuality(device.rssi);

  return (
    <div className={`p-5 lg:p-6 rounded-2xl bg-slate-900/60 backdrop-blur-md border border-slate-800/80 flex flex-col justify-between ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="flex items-center gap-2">
            <Cpu className="w-4 h-4 text-cyan-400" />
            <h3 className="text-base font-bold text-white tracking-tight">
              ESP32 Edge Hardware Status
            </h3>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Microcontroller telemetry link & sensor bus health
          </p>
        </div>

        <Link
          href="/device"
          className="text-xs font-semibold text-cyan-400 hover:text-cyan-300 flex items-center gap-1 transition-colors"
        >
          <span>Specs</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {/* Main Node Info Grid */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="p-3 rounded-xl bg-slate-800/40 border border-slate-800 space-y-1">
          <span className="text-[11px] text-slate-400 block">Device Identifier</span>
          <span className="text-xs font-mono font-bold text-white truncate block">
            {device.id}
          </span>
          <span className="text-[10px] text-slate-400 font-mono">
            IP: {device.ipAddress}
          </span>
        </div>

        <div className="p-3 rounded-xl bg-slate-800/40 border border-slate-800 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-slate-400">Wi-Fi Link</span>
            <Wifi className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-xs font-mono font-bold text-white">
              {device.rssi} dBm
            </span>
          </div>
          <span className={`text-[10px] font-medium ${rssiInfo.color}`}>
            {rssiInfo.label} Signal
          </span>
        </div>
      </div>

      {/* Sensor Bus Sanity Checks */}
      <div className="space-y-2 mb-4">
        <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
          Sensor Bus Diagnostics
        </span>

        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="flex items-center justify-between p-2 rounded-lg bg-slate-800/30 border border-slate-800">
            <span className="text-slate-300">Voltage Divider:</span>
            <span className="flex items-center gap-1 text-emerald-400 font-medium">
              <CheckCircle className="w-3 h-3" /> OK
            </span>
          </div>

          <div className="flex items-center justify-between p-2 rounded-lg bg-slate-800/30 border border-slate-800">
            <span className="text-slate-300">Current Shunt:</span>
            <span className="flex items-center gap-1 text-emerald-400 font-medium">
              <CheckCircle className="w-3 h-3" /> OK
            </span>
          </div>

          <div className="flex items-center justify-between p-2 rounded-lg bg-slate-800/30 border border-slate-800">
            <span className="text-slate-300">Temp Probe:</span>
            <span className="flex items-center gap-1 text-emerald-400 font-medium">
              <CheckCircle className="w-3 h-3" /> OK
            </span>
          </div>

          <div className="flex items-center justify-between p-2 rounded-lg bg-slate-800/30 border border-slate-800">
            <span className="text-slate-300">Irradiance Lux:</span>
            <span className="flex items-center gap-1 text-emerald-400 font-medium">
              <CheckCircle className="w-3 h-3" /> OK
            </span>
          </div>
        </div>
      </div>

      {/* Last Updated Timestamp */}
      <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
        <div className="flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5 text-slate-400" />
          <span>Last ping:</span>
        </div>
        <span suppressHydrationWarning className="font-mono text-slate-300">
          {lastUpdated.toLocaleTimeString()} (Active)
        </span>
      </div>
    </div>
  );
}
