'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSolar } from '@/context/SolarContext';
import { SimulationScenario } from '@/types/solar';
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  CartesianGrid 
} from 'recharts';
import { 
  Bot, 
  Sparkles, 
  Send, 
  RefreshCw, 
  Trash2, 
  Sliders, 
  ShieldCheck, 
  Play, 
  Cpu, 
  Database, 
  AlertTriangle, 
  Zap, 
  Flame, 
  SunMedium, 
  Activity, 
  CheckCircle2, 
  ChevronDown, 
  ChevronUp,
  HelpCircle,
  Clock
} from 'lucide-react';
import {
  fetchSolarAIContext,
  sendAIChatMessage,
  fetchAIAssistantStatus,
  BackendSolarAIContextResponse,
  BackendAIChatResponse,
  BackendAIChatEvidence,
} from '@/lib/api';

interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
  evidence?: BackendAIChatEvidence | null;
  provider?: string;
  isError?: boolean;
}

export default function AiLabPage() {
  const { modelEval, scenario, setScenario, device, isSimulated } = useSolar();
  const deviceId = device?.id || 'SOLAR-ESP32-01';

  const [activeTab, setActiveTab] = useState<'assistant' | 'workbench'>('assistant');
  const [mounted, setMounted] = useState(false);
  const [context, setContext] = useState<BackendSolarAIContextResponse | null>(null);
  const [aiStatus, setAiStatus] = useState<any>(null);
  const [loadingContext, setLoadingContext] = useState(false);

  // Chat State
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputQuestion, setInputQuestion] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [expandedEvidence, setExpandedEvidence] = useState<Record<string, boolean>>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load Context & AI Status
  const refreshContext = useCallback(async () => {
    setLoadingContext(true);
    try {
      const [ctxRes, statusRes] = await Promise.all([
        fetchSolarAIContext(deviceId),
        fetchAIAssistantStatus(),
      ]);
      setContext(ctxRes);
      setAiStatus(statusRes);
    } catch (err) {
      console.error('[AI Assistant] Failed to refresh context:', err);
    } finally {
      setLoadingContext(false);
    }
  }, [deviceId]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted) {
      refreshContext();

      // Initial welcome message
      const welcomeMsg: ChatMessage = {
        id: 'welcome-msg',
        sender: 'assistant',
        text: `STATUS: Ready & Grounded
DEVICE: ${deviceId}
MODE: ${isSimulated ? 'DEMO MODE' : 'REAL HARDWARE TELEMETRY'}

ASSESSMENT:
Hello! I am your AI Solar Performance Assistant. I analyze real-time electrical telemetry, compare actual generation against our trained XGBRegressor baseline, evaluate system health scores, and explain active diagnostic alerts.

Ask me anything about your current solar generation, model accuracy, health evaluations, or diagnostic anomalies.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        provider: 'solarai-grounded-engine',
      };
      setMessages([welcomeMsg]);
    }
  }, [mounted, deviceId, isSimulated, refreshContext]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isSending]);

  const handleSendMessage = async (questionToSend?: string) => {
    const q = (questionToSend || inputQuestion).trim();
    if (!q || isSending) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: q,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!questionToSend) setInputQuestion('');
    setIsSending(true);

    try {
      const response = await sendAIChatMessage(deviceId, q);
      if (response) {
        const assistantMsg: ChatMessage = {
          id: `ai-${Date.now()}`,
          sender: 'assistant',
          text: response.answer,
          timestamp: new Date(response.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          evidence: response.evidence,
          provider: response.provider,
        };
        setMessages((prev) => [...prev, assistantMsg]);
      } else {
        throw new Error('No response returned by AI Assistant.');
      }
    } catch (err: any) {
      const errorMsg: ChatMessage = {
        id: `err-${Date.now()}`,
        sender: 'assistant',
        text: `STATUS: Error\nASSESSMENT:\nUnable to generate response. ${err?.message || 'Network error communicating with AI service.'}`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isError: true,
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsSending(false);
    }
  };

  const handleClearChat = () => {
    setMessages([
      {
        id: `welcome-${Date.now()}`,
        sender: 'assistant',
        text: `STATUS: Conversation Cleared\nASSESSMENT:\nReady for your questions regarding real-time solar performance on ${deviceId}.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        provider: 'solarai-grounded-engine',
      },
    ]);
  };

  const toggleEvidence = (msgId: string) => {
    setExpandedEvidence((prev) => ({ ...prev, [msgId]: !prev[msgId] }));
  };

  const suggestedQuestions = [
    'How is my solar panel performing right now?',
    'What is the current power output?',
    'What does the AI predict?',
    'Check system health score',
    'Do I have any active alerts?',
    'Why is predicted power different from actual?',
    'What happened today in generation?',
    'What was the best performance period?',
    'Could shading or soiling be affecting performance?',
    'How accurate is the ML model?',
  ];

  const scenarios: { id: SimulationScenario; title: string; desc: string; color: string }[] = [
    {
      id: 'normal',
      title: 'Clear Sky Clean Panel',
      desc: 'Standard clean monocrystalline operating under optimal solar irradiance conditions.',
      color: 'border-emerald-500/40 text-emerald-400 bg-emerald-500/10',
    },
    {
      id: 'soiling',
      title: 'Dust / Soiling Accumulation',
      desc: 'Simulates ~18% optical attenuation across high irradiance hours from surface grime.',
      color: 'border-amber-500/40 text-amber-400 bg-amber-500/10',
    },
    {
      id: 'shading',
      title: 'Passing Cloud Shading',
      desc: 'Simulates sharp optical dips and mismatched I-V curve points from passing shadows.',
      color: 'border-cyan-500/40 text-cyan-400 bg-cyan-500/10',
    },
    {
      id: 'heatwave',
      title: 'Extreme Heatwave Stress',
      desc: 'Ambient temperature raised to 42°C, causing heavy semiconductor thermal derating.',
      color: 'border-rose-500/40 text-rose-400 bg-rose-500/10',
    },
    {
      id: 'open_circuit',
      title: 'Open Circuit Disconnect',
      desc: 'Voltage floats to Voc (21.8V) while current collapses to zero (simulates disconnected load).',
      color: 'border-red-500/40 text-red-400 bg-red-500/10',
    },
    {
      id: 'sensor_drift',
      title: 'ADC / Sensor Noise Drift',
      desc: 'Injects abnormal jitter and calibration variance into current and voltage sensors.',
      color: 'border-purple-500/40 text-purple-400 bg-purple-500/10',
    },
  ];

  const curr = context?.current;
  const aiCtx = context?.ai;
  const healthCtx = context?.health;
  const lastTs = curr?.timestamp ? new Date(curr.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '--';

  return (
    <div className="space-y-6">
      {/* Top Header & Mode Indicator (Phase 8) */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-5 rounded-2xl bg-slate-900/70 backdrop-blur-md border border-slate-800 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-amber-500/20 to-purple-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0 shadow-inner">
            <Bot className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-white tracking-tight">AI Solar Performance Assistant</h2>
              <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                isSimulated 
                  ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30' 
                  : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
              }`}>
                <Database className="w-3 h-3" />
                {isSimulated ? 'DEMO MODE' : 'REAL HARDWARE DATA'}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Device: <span className="font-mono text-slate-200 font-semibold">{deviceId}</span> • Last Telemetry: <span className="font-mono text-amber-400">{lastTs}</span>
            </p>
          </div>
        </div>

        {/* Tab Switcher & Context Refresh */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-800/80 border border-slate-700/60">
            <button
              onClick={() => setActiveTab('assistant')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'assistant'
                  ? 'bg-amber-500 text-slate-950 font-bold shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>AI Assistant</span>
            </button>
            <button
              onClick={() => setActiveTab('workbench')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'workbench'
                  ? 'bg-amber-500 text-slate-950 font-bold shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>Stress Injector</span>
            </button>
          </div>

          <button
            onClick={refreshContext}
            disabled={loadingContext}
            className="p-2 rounded-xl bg-slate-800/90 hover:bg-slate-700 text-slate-400 hover:text-white border border-slate-700 transition-all disabled:opacity-50"
            title="Refresh Real Hardware Context"
          >
            <RefreshCw className={`w-4 h-4 ${loadingContext ? 'animate-spin text-amber-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Real IoT Grounding Context Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
        <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/80">
          <span className="text-[10px] text-slate-400 flex items-center justify-between">
            <span>Actual Power</span>
            <Zap className="w-3 h-3 text-amber-400" />
          </span>
          <span className="text-base font-bold font-mono text-white mt-1 block">
            {curr?.power_w != null ? `${curr.power_w.toFixed(1)} W` : '--'}
          </span>
        </div>

        <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/80">
          <span className="text-[10px] text-slate-400 flex items-center justify-between">
            <span>AI Expected</span>
            <Sparkles className="w-3 h-3 text-purple-400" />
          </span>
          <span className="text-base font-bold font-mono text-purple-300 mt-1 block">
            {aiCtx?.latest_predicted_power_w != null ? `${aiCtx.latest_predicted_power_w.toFixed(1)} W` : '--'}
          </span>
        </div>

        <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/80">
          <span className="text-[10px] text-slate-400 flex items-center justify-between">
            <span>Cell Temp</span>
            <Flame className="w-3 h-3 text-red-400" />
          </span>
          <span className="text-base font-bold font-mono text-white mt-1 block">
            {curr?.temperature_c != null ? `${curr.temperature_c.toFixed(1)} °C` : '--'}
          </span>
        </div>

        <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/80">
          <span className="text-[10px] text-slate-400 flex items-center justify-between">
            <span>Solar Flux</span>
            <SunMedium className="w-3 h-3 text-yellow-400" />
          </span>
          <span className="text-base font-bold font-mono text-white mt-1 block">
            {curr?.irradiance_w_m2 != null ? `${curr.irradiance_w_m2.toFixed(0)} W/m²` : '--'}
          </span>
        </div>

        <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/80">
          <span className="text-[10px] text-slate-400 flex items-center justify-between">
            <span>Health Score</span>
            <ShieldCheck className="w-3 h-3 text-emerald-400" />
          </span>
          <span className="text-base font-bold font-mono text-emerald-400 mt-1 block">
            {healthCtx?.overall_score != null ? `${healthCtx.overall_score.toFixed(0)}%` : '--'}
          </span>
        </div>

        <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/80">
          <span className="text-[10px] text-slate-400 flex items-center justify-between">
            <span>Active Alerts</span>
            <AlertTriangle className="w-3 h-3 text-amber-400" />
          </span>
          <span className={`text-base font-bold font-mono mt-1 block ${context?.alerts?.length ? 'text-amber-400' : 'text-slate-400'}`}>
            {context?.alerts?.length ?? 0}
          </span>
        </div>
      </div>

      {activeTab === 'assistant' ? (
        /* ========================================================================= */
        /* AI ASSISTANT CONVERSATIONAL INTERFACE (Phases 7, 9, 10)                     */
        /* ========================================================================= */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Main Chat Stream (8 Cols) */}
          <div className="lg:col-span-8 flex flex-col h-[650px] rounded-2xl bg-slate-900/70 backdrop-blur-md border border-slate-800 shadow-xl overflow-hidden">
            {/* Chat Header */}
            <div className="px-5 py-3.5 border-b border-slate-800 flex items-center justify-between bg-slate-900/80">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-xs font-bold text-slate-200">Grounded Diagnostic Session</span>
                <span className="text-[11px] text-slate-500 font-mono">({aiStatus?.active_provider || 'solarai-engine'})</span>
              </div>
              <button
                onClick={handleClearChat}
                className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-200 transition-colors"
                title="Clear Conversation"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear</span>
              </button>
            </div>

            {/* Messages Scroll Area */}
            <div className="flex-1 p-5 overflow-y-auto space-y-4">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl p-4 shadow-sm text-xs leading-relaxed ${
                      msg.sender === 'user'
                        ? 'bg-amber-500 text-slate-950 font-medium rounded-tr-none'
                        : msg.isError
                        ? 'bg-rose-950/40 border border-rose-500/40 text-rose-200 rounded-tl-none'
                        : 'bg-slate-800/80 border border-slate-700/70 text-slate-200 rounded-tl-none'
                    }`}
                  >
                    {/* Render message lines with structured cards */}
                    <div className="whitespace-pre-wrap font-sans space-y-1">
                      {msg.text.split('\n').map((line, idx) => {
                        if (line.startsWith('STATUS:')) {
                          return (
                            <div key={idx} className="font-bold text-amber-400 tracking-wide pb-1 border-b border-slate-700/50 mb-1">
                              {line}
                            </div>
                          );
                        }
                        if (line.startsWith('ASSESSMENT:') || line.startsWith('EVIDENCE & DIAGNOSTIC FACTORS:') || line.startsWith('RECOMMENDATION:')) {
                          return (
                            <div key={idx} className="font-bold text-slate-100 pt-2 text-[11px] uppercase tracking-wider text-amber-400/90">
                              {line}
                            </div>
                          );
                        }
                        return <div key={idx}>{line}</div>;
                      })}
                    </div>

                    {/* Evidence Grounding Toggle & Panel (Phase 9) */}
                    {msg.evidence && (
                      <div className="mt-3 pt-2.5 border-t border-slate-700/60">
                        <button
                          onClick={() => toggleEvidence(msg.id)}
                          className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-cyan-400 hover:text-cyan-300 transition-colors"
                        >
                          <Database className="w-3 h-3" />
                          <span>Grounded on IoT Evidence</span>
                          {expandedEvidence[msg.id] ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                        </button>

                        {expandedEvidence[msg.id] && (
                          <div className="mt-2 p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80 grid grid-cols-2 gap-2 text-[11px] font-mono text-slate-300">
                            <div>Power: <span className="text-amber-400">{msg.evidence.power_w != null ? `${msg.evidence.power_w} W` : '--'}</span></div>
                            <div>Expected: <span className="text-purple-400">{msg.evidence.predicted_power_w != null ? `${msg.evidence.predicted_power_w} W` : '--'}</span></div>
                            <div>Temp: <span className="text-red-400">{msg.evidence.temperature_c != null ? `${msg.evidence.temperature_c} °C` : '--'}</span></div>
                            <div>Irradiance: <span className="text-yellow-400">{msg.evidence.irradiance_w_m2 != null ? `${msg.evidence.irradiance_w_m2} W/m²` : '--'}</span></div>
                            <div>Health: <span className="text-emerald-400">{msg.evidence.health_score != null ? `${msg.evidence.health_score}%` : '--'}</span></div>
                            <div>Alerts: <span className="text-slate-400">{msg.evidence.active_alerts_count} active</span></div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <span className="text-[10px] text-slate-500 mt-1 px-1">
                    {msg.sender === 'assistant' ? 'SolarAI Assistant' : 'You'} • {msg.timestamp}
                  </span>
                </div>
              ))}

              {isSending && (
                <div className="flex flex-col items-start">
                  <div className="rounded-2xl rounded-tl-none p-3.5 bg-slate-800/60 border border-slate-700/60 text-xs text-slate-400 flex items-center gap-2">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-400" />
                    <span>Synthesizing real IoT telemetry & ML residual models...</span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Chat Input Bar */}
            <div className="p-3 border-t border-slate-800 bg-slate-900/90 flex items-center gap-2">
              <input
                type="text"
                value={inputQuestion}
                onChange={(e) => setInputQuestion(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                placeholder="Ask about power output, AI expected baseline, health, or active alerts..."
                className="flex-1 bg-slate-800/80 border border-slate-700 rounded-xl px-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500/80 transition-all"
                disabled={isSending}
              />
              <button
                onClick={() => handleSendMessage()}
                disabled={isSending || !inputQuestion.trim()}
                className="p-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-md"
                title="Send Message"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Quick-Action Suggested Questions & Grounding Rules (4 Cols) */}
          <div className="lg:col-span-4 space-y-4">
            {/* Suggested Questions Card */}
            <div className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800 shadow-md space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-200">
                <HelpCircle className="w-4 h-4 text-amber-400" />
                <span>Suggested Grounded Inquiries</span>
              </div>
              <p className="text-[11px] text-slate-400">
                Click any prompt to query real backend data directly:
              </p>
              <div className="flex flex-col gap-1.5">
                {suggestedQuestions.map((q, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSendMessage(q)}
                    disabled={isSending}
                    className="text-left p-2.5 rounded-xl text-xs bg-slate-800/50 hover:bg-slate-800 border border-slate-700/60 hover:border-amber-500/40 text-slate-300 hover:text-white transition-all disabled:opacity-50"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>

            {/* AI Assistant Grounding Rules */}
            <div className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800 shadow-md space-y-2.5">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-200">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>Grounding & Safety Rules</span>
              </div>
              <ul className="text-[11px] text-slate-400 space-y-1.5 leading-relaxed">
                <li className="flex items-start gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                  <span>Responses derived directly from SQLite database telemetry.</span>
                </li>
                <li className="flex items-start gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                  <span>XGBRegressor predictions & residuals computed per record.</span>
                </li>
                <li className="flex items-start gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                  <span>Zero hallucinated metrics or fabricated alert states.</span>
                </li>
                <li className="flex items-start gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                  <span>External LLM keys remain strictly server-side.</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      ) : (
        /* ========================================================================= */
        /* ENVIRONMENTAL STRESS INJECTOR WORKBENCH (Preserved from Step 10)         */
        /* ========================================================================= */
        <div className="space-y-6">
          <div className="p-6 rounded-2xl bg-slate-900/60 backdrop-blur-md border border-slate-800/80 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sliders className="w-4 h-4 text-cyan-400" />
                <h3 className="text-base font-bold text-white tracking-tight">Environmental Stress Injector</h3>
              </div>
              <span className="text-xs text-slate-400 font-mono">
                Active Scenario: <span className="text-amber-400 font-bold uppercase">{scenario}</span>
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {scenarios.map((s) => {
                const isSelected = scenario === s.id;
                return (
                  <button
                    key={s.id}
                    onClick={() => setScenario(s.id)}
                    className={`p-4 rounded-xl text-left border transition-all ${
                      isSelected 
                        ? `${s.color} ring-2 ring-amber-400/30 shadow-lg scale-[1.01]` 
                        : 'bg-slate-800/40 border-slate-700/60 text-slate-300 hover:border-slate-600 hover:bg-slate-800/70'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-bold">{s.title}</span>
                      {isSelected && <Play className="w-3.5 h-3.5 fill-current" />}
                    </div>
                    <p className="text-[11px] text-slate-400 leading-relaxed">{s.desc}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Feature Importance & Residual Distribution */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-7 p-6 rounded-2xl bg-slate-900/60 backdrop-blur-md border border-slate-800/80 space-y-4">
              <div>
                <h3 className="text-base font-bold text-white tracking-tight">
                  Feature Importance Ranking (Gini / Gain)
                </h3>
                <p className="text-xs text-slate-400">
                  Contribution weight of each physical telemetry metric to XGBoost decision trees
                </p>
              </div>

              <div className="h-64 w-full">
                {!mounted ? (
                  <div className="h-full w-full rounded-xl bg-slate-800/20 border border-slate-800/40 animate-pulse flex items-center justify-center text-xs text-slate-500 font-mono">
                    Loading Feature Weights...
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart 
                      layout="vertical" 
                      data={modelEval?.features || []} 
                      margin={{ top: 5, right: 30, left: 40, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
                      <XAxis type="number" stroke="#64748b" fontSize={10} domain={[0, 0.7]} />
                      <YAxis dataKey="feature" type="category" stroke="#94a3b8" fontSize={11} width={130} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '0.75rem', fontSize: '11px' }}
                        formatter={(val) => [`${(Number(val) * 100).toFixed(1)}% weight`, 'Importance']}
                      />
                      <Bar dataKey="importance" fill="#f59e0b" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            <div className="lg:col-span-5 p-6 rounded-2xl bg-slate-900/60 backdrop-blur-md border border-slate-800/80 space-y-4">
              <div>
                <h3 className="text-base font-bold text-white tracking-tight">
                  Residual Error Distribution
                </h3>
                <p className="text-xs text-slate-400">
                  Bell-curve validation verifying zero-bias and normality of errors
                </p>
              </div>

              <div className="h-64 w-full">
                {!mounted ? (
                  <div className="h-full w-full rounded-xl bg-slate-800/20 border border-slate-800/40 animate-pulse flex items-center justify-center text-xs text-slate-500 font-mono">
                    Loading Error Histogram...
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={modelEval?.residualBins || []} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                      <XAxis dataKey="range" stroke="#64748b" fontSize={9} tickLine={false} />
                      <YAxis stroke="#64748b" fontSize={10} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '0.75rem', fontSize: '11px' }}
                      />
                      <Bar dataKey="count" fill="#a855f7" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
