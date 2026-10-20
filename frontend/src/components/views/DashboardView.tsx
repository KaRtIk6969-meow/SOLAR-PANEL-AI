'use client';

import React from 'react';
import { useSolar } from '@/context/SolarContext';
import { MetricCard } from '@/components/dashboard/MetricCard';
import { LivePowerChart } from '@/components/dashboard/LivePowerChart';
import { GaugeCluster } from '@/components/dashboard/GaugeCluster';
import { EnvironmentalCard } from '@/components/dashboard/EnvironmentalCard';
import { RecentAlertsCard } from '@/components/dashboard/RecentAlertsCard';
import { DeviceStatusCard } from '@/components/dashboard/DeviceStatusCard';
import { Zap, Gauge, Flame, Sun, Sparkles, Activity, ShieldAlert, Cpu } from 'lucide-react';

export function DashboardView() {
  const { telemetry, history, health, alerts, device, lastUpdated, resolveAlert, scenario } = useSolar();

  return (
    <div className="space-y-6">
      {/* Simulation Scenario Notification Banner if not normal */}
      {scenario !== 'normal' && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between text-xs text-amber-300">
          <div className="flex items-center gap-2.5">
            <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
            <span>
              <strong>Active Simulation Mode:</strong> Running &quot;{scenario.toUpperCase()}&quot; fault scenario. Model and dashboard are processing injected electrical/optical variations.
            </span>
          </div>
          <span className="font-mono text-[11px] bg-amber-500/20 px-2 py-0.5 rounded text-amber-200">
            Mock Test Mode
          </span>
        </div>
      )}

      {/* Row 1: Core 6 Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        {/* Power */}
        <MetricCard
          title="Active Power"
          value={telemetry.power.toFixed(1)}
          unit="W"
          icon={Zap}
          subValue="STC: 100W Panel"
          accentColor="amber"
          progress={{ current: telemetry.power, max: 100 }}
        />

        {/* Voltage */}
        <MetricCard
          title="Array Voltage"
          value={telemetry.voltage.toFixed(2)}
          unit="V"
          icon={Activity}
          subValue="Vmp: ~18.4V"
          accentColor="cyan"
          progress={{ current: telemetry.voltage, max: 22 }}
        />

        {/* Current */}
        <MetricCard
          title="Array Current"
          value={telemetry.current.toFixed(2)}
          unit="A"
          icon={Gauge}
          subValue="Imp: ~5.43A"
          accentColor="emerald"
          progress={{ current: telemetry.current, max: 6 }}
        />

        {/* Temperature */}
        <MetricCard
          title="Cell Temp"
          value={telemetry.temperature.toFixed(1)}
          unit="°C"
          icon={Flame}
          subValue={`Amb: ${telemetry.ambientTemp.toFixed(1)}°C`}
          accentColor="rose"
          progress={{ current: telemetry.temperature, max: 75 }}
        />

        {/* Irradiance */}
        <MetricCard
          title="Irradiance"
          value={telemetry.irradiance}
          unit="W/m²"
          icon={Sun}
          subValue="Pyranometer"
          accentColor="amber"
          progress={{ current: telemetry.irradiance, max: 1000 }}
        />

        {/* Efficiency */}
        <MetricCard
          title="Efficiency"
          value={telemetry.efficiency.toFixed(1)}
          unit="%"
          icon={Sparkles}
          subValue="STC: 17.8%"
          accentColor="purple"
          progress={{ current: telemetry.efficiency, max: 22 }}
        />
      </div>

      {/* Row 2: Live Power Chart (8 cols) + Overall Panel Health Gauge (4 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <LivePowerChart 
          data={history} 
          className="lg:col-span-8 min-h-[380px]" 
        />
        <GaugeCluster 
          health={health} 
          className="lg:col-span-4 min-h-[380px]" 
        />
      </div>

      {/* Row 3: Environmental Conditions (4 cols) + Recent Alerts (4 cols) + Hardware Status (4 cols) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-6">
        <EnvironmentalCard 
          telemetry={telemetry} 
          className="lg:col-span-4" 
        />
        <RecentAlertsCard 
          alerts={alerts} 
          onResolve={resolveAlert} 
          className="lg:col-span-4" 
        />
        <DeviceStatusCard 
          device={device} 
          lastUpdated={lastUpdated} 
          className="lg:col-span-4 md:col-span-2" 
        />
      </div>
    </div>
  );
}
