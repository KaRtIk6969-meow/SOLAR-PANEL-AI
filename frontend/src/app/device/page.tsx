'use client';

import React, { useState } from 'react';
import { useSolar } from '@/context/SolarContext';
import { 
  Cpu, 
  Wifi, 
  Terminal, 
  Copy, 
  Check, 
  ShieldCheck, 
  Sliders, 
  Code2, 
  Send,
  Radio
} from 'lucide-react';

export default function DevicePage() {
  const { device, telemetry } = useSolar();
  const [copiedPayload, setCopiedPayload] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  const sampleJson = JSON.stringify(
    {
      device_id: device.id,
      timestamp: telemetry?.timestamp || '2026-10-20T12:00:00Z',
      voltage_v: telemetry?.voltage != null ? Number(telemetry.voltage.toFixed(2)) : 18.42,
      current_a: telemetry?.current != null ? Number(telemetry.current.toFixed(2)) : 2.31,
      temperature_c: telemetry?.temperature != null ? Number(telemetry.temperature.toFixed(1)) : 31.7,
      irradiance_w_m2: telemetry?.irradiance != null ? telemetry.irradiance : 812.0,
      firmware_version: device.firmwareVersion || "1.0.0",
    },
    null,
    2
  );

  const sampleArduinoCode = `// ESP32 SolarAI Telemetry Client
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

const char* ssid = "COLLEGE_WIFI_SSID";
const char* password = "WIFI_PASSWORD";
const char* serverUrl = "http://<BACKEND_HOST_IP>:8000/api/v1/telemetry";

void sendTelemetry(float voltage, float current, float temp, float lux) {
  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;
    http.begin(serverUrl);
    http.addHeader("Content-Type", "application/json");

    StaticJsonDocument<256> doc;
    doc["device_id"] = "${device.id}";
    doc["voltage_v"] = voltage;
    doc["current_a"] = current;
    doc["temperature_c"] = temp;
    doc["irradiance_w_m2"] = lux;
    doc["firmware_version"] = "1.0.0";

    String requestBody;
    serializeJson(doc, requestBody);
    int httpResponseCode = http.POST(requestBody);
    http.end();
  }
}`;;

  const copyToClipboard = (text: string, type: 'payload' | 'code') => {
    navigator.clipboard.writeText(text);
    if (type === 'payload') {
      setCopiedPayload(true);
      setTimeout(() => setCopiedPayload(false), 2000);
    } else {
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="p-4 rounded-2xl bg-slate-900/60 backdrop-blur-md border border-slate-800/80 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
            <Cpu className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white">ESP32 Hardware Node & Interface Specification</h2>
            <p className="text-xs text-slate-400">
              Microcontroller link configuration, sensor calibration offsets, and team communication contracts
            </p>
          </div>
        </div>

        <span className="px-3 py-1 rounded-xl text-xs font-mono font-bold bg-emerald-500/15 border border-emerald-500/30 text-emerald-300">
          Status: {device.status}
        </span>
      </div>

      {/* Node Identity & Specs Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 space-y-1">
          <span className="text-xs text-slate-400">Node Identifier</span>
          <span className="text-sm font-bold font-mono text-white block">{device.id}</span>
          <span className="text-[11px] text-slate-500">Dual Core Tensilica Xtensa</span>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 space-y-1">
          <span className="text-xs text-slate-400">Network IP & MAC</span>
          <span className="text-sm font-bold font-mono text-white block">{device.ipAddress}</span>
          <span className="text-[11px] text-slate-500 font-mono">{device.macAddress}</span>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 space-y-1">
          <span className="text-xs text-slate-400">Wi-Fi RSSI Strength</span>
          <div className="flex items-baseline gap-1">
            <span className="text-xl font-bold font-mono text-emerald-400">{device.rssi}</span>
            <span className="text-xs text-slate-400">dBm</span>
          </div>
          <span className="text-[11px] text-emerald-400">Stable connection</span>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 space-y-1">
          <span className="text-xs text-slate-400">Firmware Version</span>
          <span className="text-sm font-bold font-mono text-cyan-400 block">{device.firmwareVersion}</span>
          <span className="text-[11px] text-slate-500">Uptime: {device.uptimeHours} hrs</span>
        </div>
      </div>

      {/* Hardware Teammate Specs Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sample JSON Ingestion Payload */}
        <div className="p-5 lg:p-6 rounded-2xl bg-slate-900/60 backdrop-blur-md border border-slate-800/80 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Terminal className="w-4 h-4 text-amber-400" />
              <h3 className="text-sm font-bold text-white">Expected REST Ingestion Payload</h3>
            </div>
            <button
              onClick={() => copyToClipboard(sampleJson, 'payload')}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 transition-colors"
            >
              {copiedPayload ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedPayload ? 'Copied' : 'Copy JSON'}</span>
            </button>
          </div>

          <p className="text-xs text-slate-400">
            Endpoint: <code className="text-amber-400 font-mono">POST /api/v1/telemetry/ingest</code> with header <code className="text-amber-400 font-mono">X-Device-Token</code>.
          </p>

          <pre className="p-4 rounded-xl bg-slate-950/90 border border-slate-800 text-xs font-mono text-emerald-400 overflow-x-auto">
            {sampleJson}
          </pre>
        </div>

        {/* Arduino C++ Firmware Sample for Teammates */}
        <div className="p-5 lg:p-6 rounded-2xl bg-slate-900/60 backdrop-blur-md border border-slate-800/80 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Code2 className="w-4 h-4 text-cyan-400" />
              <h3 className="text-sm font-bold text-white">Sample ESP32 C++ Sketch</h3>
            </div>
            <button
              onClick={() => copyToClipboard(sampleArduinoCode, 'code')}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 transition-colors"
            >
              {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedCode ? 'Copied' : 'Copy Code'}</span>
            </button>
          </div>

          <p className="text-xs text-slate-400">
            Share this snippet with your hardware teammates to verify Wi-Fi HTTP POST handshakes.
          </p>

          <pre className="p-4 rounded-xl bg-slate-950/90 border border-slate-800 text-xs font-mono text-cyan-300 overflow-x-auto max-h-56">
            {sampleArduinoCode}
          </pre>
        </div>
      </div>
    </div>
  );
}
