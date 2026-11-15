"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  Bot,
  Activity,
  Database,
  ShieldCheck,
  Cpu,
  Key,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  Save,
  RefreshCw,
  Sparkles,
  Zap,
  Layers,
  ChevronDown,
  Check,
  Search,
  Sliders,
  X,
  Server,
  ArrowRight,
} from "lucide-react";
import {
  fetchAppSettings,
  updateAppSettings,
  fetchAvailableModels,
  fetchTokenAnalytics,
} from "@/services/api";
import { AppSettings, CuratedModel, TokenAnalyticsResponse } from "@/types/chat";
import { LiveProviderQuotaCard } from "@/components/admin/LiveProviderQuotaCard";

const SETTINGS_STORAGE_KEY = "a7_admin_settings";

const defaultCuratedModels: CuratedModel[] = [
  {
    id: "groq/llama-3.3-70b-versatile",
    name: "llama-3.3-70b-versatile",
    label: "Groq Ultra-Fast (Llama 3.3 70B)",
    provider: "groq",
    description: "Ultra low-latency inference on Groq LPUs.",
    context_length: 128000,
  },
  {
    id: "groq/llama-3.1-8b-instant",
    name: "llama-3.1-8b-instant",
    label: "Groq Instant (Llama 3.1 8B)",
    provider: "groq",
    description: "Sub-second instant generation on Groq LPUs.",
    context_length: 128000,
  },
  {
    id: "gemini/gemini-2.0-flash",
    name: "gemini-2.0-flash",
    label: "Google Gemini (Gemini 2.0 Flash)",
    provider: "gemini",
    description: "Next-gen ultra fast multimodal model with real-time reasoning.",
    context_length: 1048576,
  },
  {
    id: "gemini/gemini-1.5-flash",
    name: "gemini-1.5-flash",
    label: "Google Gemini Flash (Gemini 1.5 Flash)",
    provider: "gemini",
    description: "High-speed, high-throughput, cost-effective multimodal inference.",
    context_length: 1048576,
  },
  {
    id: "gemini/gemini-1.5-pro",
    name: "gemini-1.5-pro",
    label: "Google Gemini Pro (Gemini 1.5 Pro)",
    provider: "gemini",
    description: "Mid-tier multimodal model with massive 2M context window.",
    context_length: 2097152,
  },
  {
    id: "openai/gpt-4o",
    name: "OpenAI: GPT-4o",
    label: "OpenAI Flagship (GPT-4o)",
    provider: "openrouter",
    description: "State-of-the-art multimodal intelligence and complex tool use.",
    context_length: 128000,
  },
  {
    id: "openai/gpt-4o-mini",
    name: "OpenAI: GPT-4o Mini",
    label: "OpenAI (GPT-4o Mini)",
    provider: "openrouter",
    description: "Fast and lightweight enterprise reasoning.",
    context_length: 128000,
  },
  {
    id: "anthropic/claude-3.5-sonnet",
    name: "Anthropic: Claude 3.5 Sonnet",
    label: "Anthropic Claude (Claude 3.5 Sonnet)",
    provider: "openrouter",
    description: "Top-tier enterprise reasoning, nuanced writing, and architecture.",
    context_length: 200000,
  },
  {
    id: "deepseek/deepseek-r1",
    name: "DeepSeek: R1",
    label: "DeepSeek Reasoning (DeepSeek R1)",
    provider: "openrouter",
    description: "Advanced open-weights reasoning and math model.",
    context_length: 64000,
  },
  {
    id: "meta-llama/llama-3.3-70b-instruct",
    name: "Meta: Llama 3.3 70B Instruct",
    label: "Meta Llama (Llama 3.3 70B Instruct)",
    provider: "openrouter",
    description: "Open-weights frontier open-source model.",
    context_length: 131072,
  },
];

type SettingsTab = "provider" | "telemetry" | "budget" | "system";

export default function AdminSettingsPage() {
  const [activeTab, setActiveTab] = useState<SettingsTab>("provider");

  const [settings, setSettings] = useState<AppSettings>({
    active_provider: "gemini",
    active_model: "gemini-1.5-flash",
    token_monthly_quota: "1000000",
    groq_api_key: "",
    gemini_api_key: "",
    openrouter_api_key: "",
  });

  const [availableModels, setAvailableModels] = useState<CuratedModel[]>([]);
  const [tokenAnalytics, setTokenAnalytics] = useState<TokenAnalyticsResponse | null>(null);

  // Backend connection status (online / offline)
  const [isBackendOnline, setIsBackendOnline] = useState<boolean | null>(null);

  // Password visibility
  const [showActiveKey, setShowActiveKey] = useState(false);

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [toast, setToast] = useState<{
    type: "success" | "error";
    title: string;
    message: string;
  } | null>(null);
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const savedButtonTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const showToast = (
    type: "success" | "error",
    title: string,
    message: string,
    durationMs = 4000
  ) => {
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }
    setToast({ type, title, message });
    toastTimeoutRef.current = setTimeout(() => {
      setToast(null);
    }, durationMs);
  };

  useEffect(() => {
    return () => {
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
      if (savedButtonTimeoutRef.current) clearTimeout(savedButtonTimeoutRef.current);
    };
  }, []);

  const loadData = async (isManualRefresh = false) => {
    if (isManualRefresh) setIsRefreshing(true);
    else setIsLoading(true);

    // 1. Instantly load from localStorage if present
    if (typeof window !== "undefined") {
      try {
        const localCached = localStorage.getItem(SETTINGS_STORAGE_KEY);
        if (localCached) {
          const parsed = JSON.parse(localCached);
          if (parsed && typeof parsed === "object") {
            setSettings((prev) => ({ ...prev, ...parsed }));
          }
        }
      } catch (e) {
        console.warn("Could not read local settings cache:", e);
      }
    }

    // 2. Fetch from Backend API
    try {
      const [fetchedSettings, fetchedModels, analytics] = await Promise.all([
        fetchAppSettings().catch(() => null),
        fetchAvailableModels().catch(() => null),
        fetchTokenAnalytics().catch(() => null),
      ]);

      if (fetchedSettings) {
        const merged: AppSettings = {
          active_provider: fetchedSettings.active_provider || "gemini",
          active_model: fetchedSettings.active_model || "gemini-1.5-flash",
          token_monthly_quota: fetchedSettings.token_monthly_quota || "1000000",
          groq_api_key: fetchedSettings.groq_api_key || "",
          gemini_api_key: fetchedSettings.gemini_api_key || "",
          openrouter_api_key: fetchedSettings.openrouter_api_key || "",
        };
        setSettings(merged);
        localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(merged));
        setIsBackendOnline(true);

        if (isManualRefresh) {
          showToast(
            "success",
            "Settings Refreshed ✓",
            "Configuration synchronized from backend database.",
            3500
          );
        }
      } else {
        setIsBackendOnline(false);
        if (isManualRefresh) {
          showToast(
            "error",
            "Backend Offline (Port 8000)",
            "FastAPI server on port 8000 is not running. Displaying local synchronized settings.",
            5000
          );
        }
      }

      if (fetchedModels && fetchedModels.length > 0) {
        setAvailableModels(fetchedModels);
      } else {
        setAvailableModels(defaultCuratedModels);
      }

      if (analytics) {
        setTokenAnalytics(analytics);
      }
    } catch (err: unknown) {
      console.warn("Backend unavailable, using local store:", err);
      setIsBackendOnline(false);
      setAvailableModels(defaultCuratedModels);

      if (isManualRefresh) {
        showToast(
          "error",
          "Backend Offline (Port 8000)",
          "FastAPI server on port 8000 is not running. Using local synchronized configuration.",
          5000
        );
      }
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadData(false);
  }, []);

  // Provider change handler
  const handleProviderChange = (providerId: string) => {
    const defaultModelForProvider: Record<string, string> = {
      gemini: "gemini-1.5-flash",
      groq: "llama-3.3-70b-versatile",
      openrouter: "anthropic/claude-3.5-sonnet",
    };

    const updated = {
      ...settings,
      active_provider: providerId,
      active_model: defaultModelForProvider[providerId] || settings.active_model,
    };
    setSettings(updated);
    try {
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {}
  };

  // Save handler with Graceful Local Fallback
  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsSaving(true);

    // 1. Immediately persist to localStorage
    try {
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
    } catch (err) {
      console.warn("Could not save to localStorage:", err);
    }

    // 2. Attempt to synchronize with Backend API
    try {
      await updateAppSettings(settings);
      setIsBackendOnline(true);
      setIsSaved(true);
      savedButtonTimeoutRef.current = setTimeout(() => {
        setIsSaved(false);
      }, 2500);

      showToast(
        "success",
        "AI Configuration Saved (Backend Synced ✓)",
        `Active provider (${settings.active_provider.toUpperCase()}) & model updated globally for all agents.`,
        4000
      );
    } catch (err: unknown) {
      // Backend is offline, but local save SUCCEEDED
      setIsBackendOnline(false);
      setIsSaved(true);
      savedButtonTimeoutRef.current = setTimeout(() => {
        setIsSaved(false);
      }, 2500);

      showToast(
        "success",
        "Configuration Saved (Local Sync ✓)",
        "Settings saved locally. Backend server on port 8000 is currently offline. Run: python -m uvicorn backend.main:app --port 8000",
        5500
      );
    } finally {
      setIsSaving(false);
    }
  };

  // Filter curated models for current active provider
  const modelsForCurrentProvider = availableModels.filter((m) => {
    if (settings.active_provider === "gemini") {
      return m.provider === "gemini" || m.id.includes("gemini");
    }
    if (settings.active_provider === "groq") {
      return m.provider === "groq" || m.id.includes("llama");
    }
    return m.provider === "openrouter";
  });

  // Active key helpers
  const getActiveKey = () => {
    if (settings.active_provider === "gemini") return settings.gemini_api_key || "";
    if (settings.active_provider === "groq") return settings.groq_api_key || "";
    return settings.openrouter_api_key || "";
  };

  const handleActiveKeyChange = (val: string) => {
    if (settings.active_provider === "gemini") {
      setSettings((prev) => ({ ...prev, gemini_api_key: val }));
    } else if (settings.active_provider === "groq") {
      setSettings((prev) => ({ ...prev, groq_api_key: val }));
    } else {
      setSettings((prev) => ({ ...prev, openrouter_api_key: val }));
    }
  };

  const quotaNumber = parseInt(settings.token_monthly_quota || "1000000", 10) || 1000000;
  const consumedTokens = tokenAnalytics?.total_consumed || 0;
  const remainingTokens = Math.max(0, quotaNumber - consumedTokens);
  const usedPercent = Math.min(100, Math.round((consumedTokens / quotaNumber) * 1000) / 10);

  return (
    <div className="max-w-6xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 flex flex-col gap-6 relative">
      {/* Floating Toast Notification */}
      {toast && (
        <div
          role="alert"
          className={`fixed top-6 right-6 z-50 max-w-sm sm:max-w-md p-4 rounded-2xl border shadow-2xl backdrop-blur-xl flex items-start gap-3.5 animate-in fade-in slide-in-from-top-4 duration-300 ${
            toast.type === "success"
              ? "bg-[#0E1611]/95 border-emerald-500/40 text-emerald-200 shadow-emerald-950/50"
              : "bg-[#1C0E10]/95 border-rose-500/40 text-rose-200 shadow-rose-950/50"
          }`}
        >
          <div
            className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
              toast.type === "success"
                ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                : "bg-rose-500/20 text-rose-400 border border-rose-500/30"
            }`}
          >
            {toast.type === "success" ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            ) : (
              <AlertCircle className="w-5 h-5 text-rose-400" />
            )}
          </div>

          <div className="flex-1 min-w-0 pr-1">
            <h4 className="text-sm font-bold text-white tracking-tight leading-snug">
              {toast.title}
            </h4>
            <p className="text-xs text-[#8B949E] mt-0.5 leading-relaxed">
              {toast.message}
            </p>
          </div>

          <button
            type="button"
            onClick={() => setToast(null)}
            className="text-[#8B949E] hover:text-white transition-colors p-1 rounded-lg hover:bg-white/10 shrink-0"
            aria-label="Dismiss toast"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Top Header Banner with Live Status & Refresh Button */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-100 dark:bg-[#161B22] border border-slate-200 dark:border-[#30363D] text-xs font-medium text-[#FF6A00] mb-2">
            <Sliders className="w-3.5 h-3.5" />
            <span>Global LLM Orchestration & Quota Controls</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Admin System Settings
          </h1>
          <p className="text-sm text-slate-600 dark:text-[#8B949E] mt-1 max-w-2xl">
            Configure dynamic LLM providers, select active inference models, provide provider API keys, and manage monthly enterprise token quotas.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Live Backend Connection Indicator Pill */}
          <div
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-mono border ${
              isBackendOnline
                ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-800/40"
                : "bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-400 border-amber-300 dark:border-amber-800/40"
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                isBackendOnline ? "bg-emerald-500 animate-pulse" : "bg-amber-500"
              }`}
            />
            <span>{isBackendOnline ? "Backend: Online (8000)" : "Backend: Offline (Local Mode)"}</span>
          </div>

          {/* Refresh Settings Button with live feedback */}
          <button
            type="button"
            onClick={() => loadData(true)}
            disabled={isLoading || isSaving || isRefreshing}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white hover:bg-slate-100 text-slate-700 hover:text-slate-900 border border-slate-200 dark:bg-[#161B22] dark:hover:bg-[#1F242C] text-xs font-semibold dark:text-[#8B949E] dark:hover:text-[#E6EDF3] dark:border-[#30363D] transition-colors disabled:opacity-50 shadow-sm cursor-pointer"
            title="Reload settings from backend database"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 text-[#FF6A00] ${
                isRefreshing || isLoading ? "animate-spin" : ""
              }`}
            />
            <span>{isRefreshing ? "Syncing..." : "Refresh Settings"}</span>
          </button>
        </div>
      </div>

      {/* Horizontal Tabs Navigation Bar (Pic 1 Style) */}
      <div className="flex items-center gap-2 overflow-x-auto border-b border-slate-200 dark:border-[#30363D] pb-3">
        <button
          type="button"
          onClick={() => setActiveTab("provider")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
            activeTab === "provider"
              ? "bg-[#FF6A00]/10 text-[#FF6A00] border border-[#FF6A00]/40 shadow-sm"
              : "text-slate-600 dark:text-[#8B949E] hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#161B22]"
          }`}
        >
          <Bot className="w-4 h-4" />
          <span>AI Provider</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("telemetry")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
            activeTab === "telemetry"
              ? "bg-[#FF6A00]/10 text-[#FF6A00] border border-[#FF6A00]/40 shadow-sm"
              : "text-slate-600 dark:text-[#8B949E] hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#161B22]"
          }`}
        >
          <Activity className="w-4 h-4" />
          <span>Live Telemetry</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("budget")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
            activeTab === "budget"
              ? "bg-[#FF6A00]/10 text-[#FF6A00] border border-[#FF6A00]/40 shadow-sm"
              : "text-slate-600 dark:text-[#8B949E] hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#161B22]"
          }`}
        >
          <Database className="w-4 h-4" />
          <span>Token Budget & Limits</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("system")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
            activeTab === "system"
              ? "bg-[#FF6A00]/10 text-[#FF6A00] border border-[#FF6A00]/40 shadow-sm"
              : "text-slate-600 dark:text-[#8B949E] hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#161B22]"
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          <span>System & Storage</span>
        </button>
      </div>

      {/* TAB 1: AI Provider (Exact Pic 3 Architecture) */}
      {activeTab === "provider" && (
        <div className="flex flex-col gap-6 animate-in fade-in duration-200">
          <div className="p-6 rounded-2xl bg-white dark:bg-[#161B22] border border-slate-200 dark:border-[#30363D] shadow-sm flex flex-col gap-6">
            {/* Header info */}
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                AI Provider Configuration (Orchestrator Inference Engine)
              </h2>
              <p className="text-xs text-slate-500 dark:text-[#8B949E] mt-1">
                Choose which AI provider powers the multi-agent system. Switching providers keeps each provider&apos;s saved key and model — only the active one is shown and used.
              </p>
            </div>

            {/* Provider Dropdown Selector (Matching Pic 3) */}
            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                Select Active Provider
              </label>
              <div className="relative">
                <select
                  value={settings.active_provider}
                  onChange={(e) => handleProviderChange(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-[#0E1117] border border-slate-300 dark:border-[#30363D] rounded-xl text-sm font-semibold text-slate-900 dark:text-white focus:outline-none focus:border-[#FF6A00] transition-colors appearance-none cursor-pointer"
                >
                  <option value="gemini">Google Gemini (Direct)</option>
                  <option value="groq">xAI Groq (Fast LPUs)</option>
                  <option value="openrouter">OpenRouter Unified Gateway</option>
                </select>
                <ChevronDown className="w-4 h-4 text-slate-400 absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            {/* Dynamic Active Provider Box */}
            <div className="p-5 rounded-xl border border-slate-200 dark:border-[#30363D] bg-slate-50/50 dark:bg-[#0E1117] flex flex-col gap-5">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-[#21262D] pb-3">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm text-slate-900 dark:text-white">
                    {settings.active_provider === "gemini"
                      ? "Google Gemini"
                      : settings.active_provider === "groq"
                      ? "Groq Cloud"
                      : "OpenRouter Unified"}
                  </span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                    ACTIVE
                  </span>
                </div>

                <span className="text-xs text-slate-400 dark:text-[#8B949E]">
                  Applies to all agents globally
                </span>
              </div>

              {/* API Key Field */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                  <span>API Key</span>
                  {getActiveKey() ? (
                    <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-mono">Configured ✓</span>
                  ) : (
                    <span className="text-[11px] text-amber-600 dark:text-amber-400 font-mono">Unset</span>
                  )}
                </label>
                <div className="relative">
                  <input
                    type={showActiveKey ? "text" : "password"}
                    value={getActiveKey()}
                    onChange={(e) => handleActiveKeyChange(e.target.value)}
                    placeholder={
                      settings.active_provider === "gemini"
                        ? "AQ... or AIza..."
                        : settings.active_provider === "groq"
                        ? "gsk_..."
                        : "sk-or-v1-..."
                    }
                    className="w-full pl-4 pr-12 py-2.5 bg-white dark:bg-[#161B22] border border-slate-300 dark:border-[#30363D] rounded-xl text-sm font-mono text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-[#8B949E] focus:outline-none focus:border-[#FF6A00] transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowActiveKey(!showActiveKey)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-[#8B949E] hover:text-slate-700 dark:hover:text-white transition-colors"
                    aria-label="Toggle API Key visibility"
                  >
                    {showActiveKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Model Dropdown Selector */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Model
                </label>
                <div className="relative">
                  <select
                    value={settings.active_model}
                    onChange={(e) =>
                      setSettings((prev) => ({ ...prev, active_model: e.target.value }))
                    }
                    className="w-full px-4 py-2.5 bg-white dark:bg-[#161B22] border border-slate-300 dark:border-[#30363D] rounded-xl text-sm font-semibold text-slate-900 dark:text-white focus:outline-none focus:border-[#FF6A00] transition-colors appearance-none cursor-pointer"
                  >
                    {modelsForCurrentProvider.map((m) => (
                      <option key={m.id} value={m.name || m.id}>
                        {m.label || m.name} ({m.context_length ? `${Math.round(m.context_length / 1000)}k ctx` : "Fast"})
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="w-4 h-4 text-slate-400 absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>

              {/* Save Button */}
              <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <p className="text-xs text-slate-500 dark:text-[#8B949E]">
                  Changes will automatically propagate to all autonomous agents.
                </p>
                <button
                  type="button"
                  onClick={() => handleSave()}
                  disabled={isSaving}
                  className={`flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm transition-all shadow-md active:scale-95 cursor-pointer ${
                    isSaved
                      ? "bg-emerald-600 text-white"
                      : "bg-gradient-to-r from-[#FF6A00] to-[#E55F00] hover:from-[#FF7B1A] hover:to-[#FF6A00] text-white shadow-[#FF6A00]/25"
                  } disabled:opacity-50`}
                >
                  {isSaved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
                  <span>{isSaved ? "Saved ✓" : isSaving ? "Saving..." : "Save AI Configuration"}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: Live Telemetry */}
      {activeTab === "telemetry" && (
        <div className="flex flex-col gap-6 animate-in fade-in duration-200">
          <LiveProviderQuotaCard />
        </div>
      )}

      {/* TAB 3: Token Budget & Limits */}
      {activeTab === "budget" && (
        <div className="flex flex-col gap-6 animate-in fade-in duration-200">
          <div className="p-6 rounded-2xl bg-white dark:bg-[#161B22] border border-slate-200 dark:border-[#30363D] shadow-sm flex flex-col gap-6">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-[#30363D] pb-4">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  Monthly Token Budget & Analytics
                </h2>
                <p className="text-xs text-slate-500 dark:text-[#8B949E]">
                  Configure organization token usage caps and review consumption across LPUs.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Monthly Quota Limit (Tokens)
                </label>
                <input
                  type="text"
                  value={settings.token_monthly_quota}
                  onChange={(e) =>
                    setSettings({ ...settings, token_monthly_quota: e.target.value })
                  }
                  placeholder="1000000"
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-[#0E1117] border border-slate-300 dark:border-[#30363D] rounded-xl text-sm font-mono text-slate-900 dark:text-white focus:outline-none focus:border-[#FF6A00]"
                />
              </div>

              <div className="flex flex-col gap-1.5 justify-end">
                <button
                  type="button"
                  onClick={() => handleSave()}
                  disabled={isSaving}
                  className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#FF6A00] to-[#E55F00] text-white font-semibold text-sm shadow-md shadow-[#FF6A00]/25 active:scale-95 cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  <span>Update Monthly Quota</span>
                </button>
              </div>
            </div>

            {/* Progress breakdown */}
            <div className="p-4 rounded-xl border border-slate-200 dark:border-[#30363D] bg-slate-50/50 dark:bg-[#0E1117] flex flex-col gap-3">
              <div className="flex justify-between text-xs">
                <span className="text-slate-500 dark:text-[#8B949E]">
                  Consumed: <strong className="text-slate-900 dark:text-white font-mono">{consumedTokens.toLocaleString()}</strong> tokens
                </span>
                <span className="text-slate-500 dark:text-[#8B949E]">
                  Remaining: <strong className="text-emerald-600 dark:text-emerald-400 font-mono">{remainingTokens.toLocaleString()}</strong> tokens
                </span>
              </div>
              <div className="w-full h-2.5 rounded-full bg-slate-200 dark:bg-[#161B22] overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-emerald-500 via-[#FF6A00] to-rose-500 rounded-full transition-all duration-500"
                  style={{ width: `${Math.max(2, Math.min(100, usedPercent))}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: System & Storage */}
      {activeTab === "system" && (
        <div className="flex flex-col gap-6 animate-in fade-in duration-200">
          <div className="p-6 rounded-2xl bg-white dark:bg-[#161B22] border border-slate-200 dark:border-[#30363D] shadow-sm flex flex-col gap-6">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-[#30363D] pb-4">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  Local Storage & Vector Database Health
                </h2>
                <p className="text-xs text-slate-500 dark:text-[#8B949E]">
                  ChromaDB collections, agent partitions, and synchronized local storage health.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl border border-slate-200 dark:border-[#30363D] bg-slate-50 dark:bg-[#0E1117] flex items-center justify-between">
                <div>
                  <span className="text-xs text-slate-500 dark:text-[#8B949E]">Storage Mode</span>
                  <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                    Synchronized Local
                  </p>
                </div>
                <div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse" />
              </div>

              <div className="p-4 rounded-xl border border-slate-200 dark:border-[#30363D] bg-slate-50 dark:bg-[#0E1117] flex items-center justify-between">
                <div>
                  <span className="text-xs text-slate-500 dark:text-[#8B949E]">Vector Database</span>
                  <p className="text-sm font-bold text-slate-900 dark:text-white mt-0.5">
                    ChromaDB Embedded
                  </p>
                </div>
                <Database className="w-4 h-4 text-[#FF6A00]" />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
