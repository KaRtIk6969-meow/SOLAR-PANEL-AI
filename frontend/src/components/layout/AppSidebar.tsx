'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  LayoutDashboard, 
  Activity, 
  TrendingUp, 
  HeartPulse, 
  Sparkles, 
  Bell, 
  FlaskConical, 
  Cpu, 
  FileText, 
  Settings, 
  Sun,
  Radio,
  X
} from 'lucide-react';
import { useSolar } from '@/context/SolarContext';

interface AppSidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/monitor', label: 'Live Monitor', icon: Activity },
  { href: '/analytics', label: 'Analytics', icon: TrendingUp },
  { href: '/health', label: 'Panel Health', icon: HeartPulse },
  { href: '/prediction', label: 'AI Prediction', icon: Sparkles },
  { href: '/alerts', label: 'Alerts', icon: Bell, badge: true },
  { href: '/ai-lab', label: 'AI Lab & Sim', icon: FlaskConical },
  { href: '/device', label: 'ESP32 Device', icon: Cpu },
  { href: '/reports', label: 'Health Reports', icon: FileText },
  { href: '/settings', label: 'Settings', icon: Settings },
];

export function AppSidebar({ isOpen, onClose }: AppSidebarProps) {
  const pathname = usePathname();
  const { alerts, isSimulated, device, scenario } = useSolar();
  const activeAlertsCount = alerts.filter(a => !a.isResolved).length;

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar Container */}
      <aside 
        className={`fixed top-0 bottom-0 left-0 z-50 w-64 bg-[#0a0f1d]/95 backdrop-blur-xl border-r border-slate-800/80 flex flex-col transition-transform duration-300 ease-in-out lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Logo Section */}
        <div className="h-16 flex items-center justify-between px-5 border-b border-slate-800/70">
          <Link href="/dashboard" className="flex items-center gap-3 group">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 via-amber-400 to-yellow-300 flex items-center justify-center shadow-lg shadow-amber-500/20 group-hover:scale-105 transition-transform">
              <Sun className="w-5 h-5 text-slate-950 stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-lg text-white tracking-tight">Solar</span>
                <span className="font-extrabold text-lg bg-gradient-to-r from-amber-400 to-amber-200 bg-clip-text text-transparent">AI</span>
              </div>
              <span className="text-[10px] text-slate-400 tracking-wider uppercase font-medium">IoT Diagnostics</span>
            </div>
          </Link>

          <button 
            onClick={onClose}
            className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/60"
            aria-label="Close sidebar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Links */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          <div className="px-3 pb-2 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            Platform Navigation
          </div>
          {navItems.map((item) => {
            const Icon = item.icon;
            // Check active (treat '/' as active for '/dashboard' too)
            const isActive = pathname === item.href || (item.href === '/dashboard' && pathname === '/');

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => onClose()}
                className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all group ${
                  isActive
                    ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30 shadow-sm shadow-amber-500/10'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800/50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon 
                    className={`w-4 h-4 transition-colors ${
                      isActive ? 'text-amber-400' : 'text-slate-400 group-hover:text-slate-200'
                    }`} 
                  />
                  <span>{item.label}</span>
                </div>

                {item.badge && activeAlertsCount > 0 && (
                  <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/30">
                    {activeAlertsCount}
                  </span>
                )}
              </Link>
            );
          })}
        </div>

        {/* Device Status & Scenario Footer */}
        <div className="p-4 border-t border-slate-800/80 bg-slate-900/40">
          <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800/80 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400 font-medium">Node Link</span>
              <span className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                {device.status}
              </span>
            </div>

            <div className="flex items-center justify-between text-[11px] text-slate-400">
              <span>ESP32-PRO</span>
              <span className="text-slate-300 font-mono">{device.rssi} dBm</span>
            </div>

            <div className="pt-1.5 border-t border-slate-800 flex items-center justify-between text-[11px]">
              <span className="text-slate-400">Data Source</span>
              <span className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                isSimulated 
                  ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30' 
                  : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
              }`}>
                {isSimulated ? `Sim: ${scenario}` : 'Real ESP32'}
              </span>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
