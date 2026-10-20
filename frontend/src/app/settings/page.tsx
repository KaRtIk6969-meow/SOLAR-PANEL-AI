'use client';

import React, { useState } from 'react';
import { useSolar } from '@/context/SolarContext';
import { Settings, Key, Sliders, ShieldCheck, RefreshCw, Save, Check } from 'lucide-react';

export default function SettingsPage() {
  const { device, isSimulated, setIsSimulated, scenario, setScenario } = useSolar();
  const [apiKey, setApiKey] = useState('solarai_live_token_7f9b2c8a14d0');
  const [soilingThreshold, setSoilingThreshold] = useState(15);
  const [tempAlertThreshold, setTempAlertThreshold] = useState(65);
  const [offlineTimeout, setOfflineTimeout] = useState(90);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleRegenerateKey = () => {
    const newKey = `solarai_live_token_${Math.random().toString(36).substring(2, 10)}${Math.random().toString(36).substring(2, 6)}`;
    setApiKey(newKey);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="p-4 rounded-2xl bg-slate-900/60 backdrop-blur-md border border-slate-800/80 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <Settings className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white">Platform Configuration & API Security</h2>
            <p className="text-xs text-slate-400">
              Set anomaly detection thresholds, generate hardware tokens, and toggle offline simulation
            </p>
          </div>
        </div>

        {savedSuccess && (
          <span className="flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-semibold bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 animate-pulse">
            <Check className="w-3.5 h-3.5" />
            Saved Preferences
          </span>
        )}
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Device Ingestion Token */}
        <div className="p-6 rounded-2xl bg-slate-900/60 backdrop-blur-md border border-slate-800/80 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Key className="w-4 h-4 text-amber-400" />
              <h3 className="text-base font-bold text-white tracking-tight">
                ESP32 Hardware Authorization Token
              </h3>
            </div>
            <button
              type="button"
              onClick={handleRegenerateKey}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Regenerate Token
            </button>
          </div>

          <p className="text-xs text-slate-400">
            Your ESP32 teammate sketch must send this token in the <code className="text-amber-400 font-mono">X-Device-Token</code> header.
          </p>

          <div className="flex items-center gap-3">
            <input
              type="text"
              readOnly
              value={apiKey}
              className="flex-1 px-4 py-2.5 rounded-xl bg-slate-950/80 border border-slate-800 text-xs font-mono text-emerald-400 focus:outline-none"
            />
          </div>
        </div>

        {/* Anomaly Detection Sensitivity Thresholds */}
        <div className="p-6 rounded-2xl bg-slate-900/60 backdrop-blur-md border border-slate-800/80 space-y-5">
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-cyan-400" />
            <h3 className="text-base font-bold text-white tracking-tight">
              AI Diagnostic Thresholds
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-300 block">
                Soiling / Dust Loss Threshold ({soilingThreshold}%)
              </label>
              <input
                type="range"
                min="5"
                max="35"
                value={soilingThreshold}
                onChange={(e) => setSoilingThreshold(Number(e.target.value))}
                className="w-full accent-amber-400 cursor-pointer"
              />
              <span className="text-[11px] text-slate-400 block">
                Triggers warning if actual power is {soilingThreshold}% below AI model for &gt;30 mins.
              </span>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-300 block">
                Thermal Overheat Alarm ({tempAlertThreshold}°C)
              </label>
              <input
                type="range"
                min="50"
                max="85"
                value={tempAlertThreshold}
                onChange={(e) => setTempAlertThreshold(Number(e.target.value))}
                className="w-full accent-rose-400 cursor-pointer"
              />
              <span className="text-[11px] text-slate-400 block">
                Flags critical alert when cell thermistor exceeds {tempAlertThreshold}°C.
              </span>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-300 block">
                Offline Heartbeat Timeout ({offlineTimeout}s)
              </label>
              <input
                type="range"
                min="30"
                max="300"
                step="15"
                value={offlineTimeout}
                onChange={(e) => setOfflineTimeout(Number(e.target.value))}
                className="w-full accent-cyan-400 cursor-pointer"
              />
              <span className="text-[11px] text-slate-400 block">
                Flags ESP32 node as OFFLINE after {offlineTimeout} seconds without a packet.
              </span>
            </div>
          </div>
        </div>

        {/* Save Preferences Button */}
        <div className="flex justify-end">
          <button
            type="submit"
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs bg-amber-400 hover:bg-amber-300 text-slate-950 transition-colors shadow-lg shadow-amber-400/10"
          >
            <Save className="w-4 h-4" />
            <span>Save Settings</span>
          </button>
        </div>
      </form>
    </div>
  );
}
