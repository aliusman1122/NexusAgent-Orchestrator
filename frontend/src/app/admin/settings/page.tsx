"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  Sliders,
  Cpu,
  Key,
  Database,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  Save,
  RefreshCw,
  Sparkles,
  Zap,
  Layers,
  ShieldCheck,
  ExternalLink,
  ChevronRight,
  Info,
  Search,
  Check,
  ChevronDown,
  X,
} from "lucide-react";
import {
  fetchAppSettings,
  updateAppSettings,
  fetchAvailableModels,
  fetchTokenAnalytics,
} from "@/services/api";
import { AppSettings, CuratedModel, TokenAnalyticsResponse } from "@/types/chat";
import { LiveProviderQuotaCard } from "@/components/admin/LiveProviderQuotaCard";

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
    id: "google/gemini-1.5-pro",
    name: "Google: Gemini 1.5 Pro",
    label: "Google Gemini (Gemini 1.5 Pro)",
    provider: "openrouter",
    description: "Massive context reasoning and multi-modal analytical power.",
    context_length: 2000000,
  },
  {
    id: "google/gemini-1.5-flash",
    name: "Google: Gemini 1.5 Flash",
    label: "Google Gemini Flash (Gemini 1.5 Flash)",
    provider: "openrouter",
    description: "High-throughput, fast and cost-effective enterprise inference.",
    context_length: 1000000,
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

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<AppSettings>({
    active_provider: "groq",
    active_model: "llama-3.3-70b-versatile",
    token_monthly_quota: "1000000",
    groq_api_key: "",
    openrouter_api_key: "",
  });

  const [availableModels, setAvailableModels] = useState<CuratedModel[]>([]);
  const [tokenAnalytics, setTokenAnalytics] = useState<TokenAnalyticsResponse | null>(null);
  const [useCustomModel, setUseCustomModel] = useState(false);

  // Model search and live refresh state
  const [modelSearchQuery, setModelSearchQuery] = useState("");
  const [isRefreshingModels, setIsRefreshingModels] = useState(false);
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [isLoading, setIsLoading] = useState(true);
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
    durationMs = 3500
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

  const [statusMessage, setStatusMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Show/Hide API key visibility state
  const [showGroqKey, setShowGroqKey] = useState(false);
  const [showOpenRouterKey, setShowOpenRouterKey] = useState(false);

  const loadData = async () => {
    setIsLoading(true);
    setStatusMessage(null);
    try {
      const [fetchedSettings, fetchedModels, fetchedAnalytics] = await Promise.all([
        fetchAppSettings().catch(() => ({
          active_provider: "groq",
          active_model: "llama-3.3-70b-versatile",
          token_monthly_quota: "1000000",
          groq_api_key: "",
          openrouter_api_key: "",
        })),
        fetchAvailableModels().catch(() => []),
        fetchTokenAnalytics().catch(() => null),
      ]);

      // Normalize provider in case of legacy 'openai'
      if (fetchedSettings.active_provider === "openai") {
        fetchedSettings.active_provider = "openrouter";
      }

      setSettings(fetchedSettings);
      if (fetchedModels.length > 0) {
        setAvailableModels(fetchedModels);
      }
      setTokenAnalytics(fetchedAnalytics);

      // Auto-detect custom model mode if loaded active_model is not in models catalog
      const modelsList = fetchedModels.length > 0 ? fetchedModels : defaultCuratedModels;
      const isCurated = modelsList.some(
        (m) => m.name === fetchedSettings.active_model || m.id === fetchedSettings.active_model
      );
      if (fetchedSettings.active_model && !isCurated) {
        setUseCustomModel(true);
      }
    } catch (err: any) {
      setStatusMessage({
        type: "error",
        text: err?.message || "Failed to load admin settings.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsModelDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const allModels = availableModels.length > 0 ? availableModels : defaultCuratedModels;

  // Filter models strictly to the active provider
  const filteredModels = allModels.filter(
    (m) => m.provider.toLowerCase() === settings.active_provider.toLowerCase()
  );

  // Search filtered models when OpenRouter is selected
  const searchResults = filteredModels.filter((m) => {
    if (!modelSearchQuery.trim()) return true;
    const q = modelSearchQuery.toLowerCase();
    return (
      m.id.toLowerCase().includes(q) ||
      (m.name && m.name.toLowerCase().includes(q)) ||
      (m.label && m.label.toLowerCase().includes(q)) ||
      (m.description && m.description.toLowerCase().includes(q))
    );
  });

  // Live Refresh handler
  const handleRefreshLiveModels = async () => {
    setIsRefreshingModels(true);
    try {
      const fresh = await fetchAvailableModels(true);
      if (fresh && fresh.length > 0) {
        setAvailableModels(fresh);
        const orCount = fresh.filter((m) => m.provider === "openrouter").length;
        setStatusMessage({
          type: "success",
          text: `Successfully synced ${orCount} live models directly from OpenRouter!`,
        });
      }
    } catch (err: any) {
      setStatusMessage({
        type: "error",
        text: err?.message || "Failed to refresh models from OpenRouter.",
      });
    } finally {
      setIsRefreshingModels(false);
    }
  };

  // Auto-select default model when switching provider (only if not in custom model mode)
  const handleProviderChange = (newProvider: string) => {
    if (!useCustomModel) {
      const modelsForProvider = allModels.filter(
        (m) => m.provider.toLowerCase() === newProvider.toLowerCase()
      );
      const defaultModel =
        modelsForProvider.length > 0
          ? (modelsForProvider[0].id || modelsForProvider[0].name)
          : newProvider === "groq"
          ? "llama-3.3-70b-versatile"
          : "openai/gpt-4o";

      setSettings((prev) => ({
        ...prev,
        active_provider: newProvider,
        active_model: defaultModel,
      }));
    } else {
      setSettings((prev) => ({
        ...prev,
        active_provider: newProvider,
      }));
    }
  };

  // Ensure active_model is valid for the current provider when not using custom model ID
  useEffect(() => {
    if (!useCustomModel && filteredModels.length > 0) {
      const isModelValid = filteredModels.some(
        (m) => m.name === settings.active_model || m.id === settings.active_model
      );
      if (!isModelValid) {
        setSettings((prev) => ({
          ...prev,
          active_model: filteredModels[0].id || filteredModels[0].name,
        }));
      }
    }
  }, [settings.active_provider, availableModels, useCustomModel]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setIsSaved(false);
    setStatusMessage(null);
    if (savedButtonTimeoutRef.current) {
      clearTimeout(savedButtonTimeoutRef.current);
    }

    try {
      const res = await updateAppSettings({
        active_provider: settings.active_provider,
        active_model: settings.active_model,
        token_monthly_quota: settings.token_monthly_quota,
        groq_api_key: settings.groq_api_key,
        openrouter_api_key: settings.openrouter_api_key,
      });

      setSettings(res.settings);

      // Refresh token analytics with updated quota
      const updatedAnalytics = await fetchTokenAnalytics().catch(() => null);
      if (updatedAnalytics) {
        setTokenAnalytics(updatedAnalytics);
      }

      // Temporary button state: ✓ Saved! with emerald background for 2.5 seconds
      setIsSaved(true);
      savedButtonTimeoutRef.current = setTimeout(() => {
        setIsSaved(false);
      }, 2500);

      // Prominent styled Toast notification auto-dismiss after 3.5 seconds
      showToast(
        "success",
        "Settings Saved",
        "Inference gateway, active model, and quota thresholds updated.",
        3500
      );
    } catch (err: any) {
      setIsSaved(false);
      showToast(
        "error",
        "Save Failed",
        err?.message || "Failed to save settings to database.",
        4000
      );
    } finally {
      setIsSaving(false);
    }
  };

  const getProviderBadge = (provider: string) => {
    const prov = provider.toLowerCase();
    if (prov.includes("groq")) {
      return (
        <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-orange-500/15 text-orange-400 border border-orange-500/30">
          Groq LPU
        </span>
      );
    }
    return (
      <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-purple-500/15 text-purple-400 border border-purple-500/30">
        OpenRouter Unified
      </span>
    );
  };

  const quotaNumber = parseInt(settings.token_monthly_quota || "1000000", 10) || 1000000;
  const consumedTokens = tokenAnalytics?.total_consumed || 0;
  const remainingTokens = Math.max(0, quotaNumber - consumedTokens);
  const usedPercent = Math.min(100, Math.round((consumedTokens / quotaNumber) * 1000) / 10);

  const providerUsage = tokenAnalytics?.by_provider || { groq: 0, openrouter: 0 };
  const groqTokens = providerUsage.groq || 0;
  const openrouterTokens = providerUsage.openrouter || 0;
  const totalProviderTokens = groqTokens + openrouterTokens || consumedTokens || 0;

  return (
    <div className="max-w-6xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 flex flex-col gap-8 relative">
      {/* Prominent Floating Toast Notification */}
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

      {/* Top Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#161B22] border border-[#30363D] text-xs font-medium text-[#FF6A00] mb-2">
            <Sliders className="w-3.5 h-3.5" />
            <span>Global LLM Orchestration & Quota Controls</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Admin System Settings
          </h1>
          <p className="text-sm text-[#8B949E] mt-1 max-w-2xl">
            Configure dynamic LLM providers, select active inference models, provide provider API keys, and manage monthly enterprise token quotas.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={loadData}
            disabled={isLoading || isSaving}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#161B22] hover:bg-[#1F242C] text-xs font-medium text-[#8B949E] hover:text-[#E6EDF3] border border-[#30363D] transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin text-[#FF6A00]" : ""}`} />
            <span>Refresh Settings</span>
          </button>
        </div>
      </div>

      {/* Status Toast Alert */}
      {statusMessage && (
        <div
          className={`p-4 rounded-xl border flex items-center justify-between gap-3 text-sm animate-in fade-in duration-200 ${
            statusMessage.type === "success"
              ? "bg-emerald-950/40 border-emerald-500/40 text-emerald-300"
              : "bg-red-950/40 border-red-500/40 text-red-300"
          }`}
        >
          <div className="flex items-center gap-3">
            {statusMessage.type === "success" ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
            )}
            <span>{statusMessage.text}</span>
          </div>
          <button
            onClick={() => setStatusMessage(null)}
            className="text-xs opacity-70 hover:opacity-100 underline ml-2"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Live Provider Quota Telemetry Widget */}
      <LiveProviderQuotaCard />

      {/* Main Settings Form */}
      <form onSubmit={handleSave} className="flex flex-col gap-6">
        {/* SECTION 1: Dynamic LLM Model & Provider Selection */}
        <div className="p-6 rounded-2xl bg-[#161B22] border border-[#30363D] flex flex-col gap-6 shadow-xl shadow-black/20">
          <div className="flex items-center justify-between border-b border-[#30363D] pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#0E1117] border border-[#30363D] flex items-center justify-center text-[#FF6A00]">
                <Cpu className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white">Active LLM Model & Provider</h2>
                <p className="text-xs text-[#8B949E]">
                  Select the primary inference engine used for answering enterprise customer inquiries.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-[#8B949E]">Provider:</span>
              {getProviderBadge(settings.active_provider)}
            </div>
          </div>

          {/* Provider Selection Tabs (2-Gateway Architecture) */}
          <div>
            <label className="block text-xs font-semibold text-[#8B949E] uppercase tracking-wider mb-2">
              Primary Inference Provider
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                {
                  id: "groq",
                  name: "Groq Cloud (Fast LPUs)",
                  desc: "Ultra-low latency inference on Groq LPUs",
                  badge: "Default / High Speed",
                },
                {
                  id: "openrouter",
                  name: "OpenRouter Unified",
                  desc: "GPT-4o, Claude 3.5, Gemini, DeepSeek R1 & 400+ Live Models",
                  badge: "Multi-Model Live Gateway",
                },
              ].map((p) => {
                const isSelected = settings.active_provider === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handleProviderChange(p.id)}
                    className={`p-4 rounded-xl border text-left flex flex-col justify-between transition-all cursor-pointer ${
                      isSelected
                        ? "bg-[#FF6A00]/10 border-[#FF6A00] shadow-md shadow-[#FF6A00]/10"
                        : "bg-[#0E1117] border-[#30363D] hover:border-[#8B949E]/50"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-bold text-sm text-white">{p.name}</span>
                      {isSelected && <CheckCircle2 className="w-4 h-4 text-[#FF6A00] shrink-0" />}
                    </div>
                    <p className="text-xs text-[#8B949E] mt-1">{p.desc}</p>
                    <span className="mt-3 text-[10px] font-mono text-[#FF6A00] bg-[#FF6A00]/10 px-2 py-0.5 rounded w-fit border border-[#FF6A00]/20">
                      {p.badge}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Model Selection (Searchable OpenRouter Catalog vs Groq vs Custom ID) */}
          <div className="flex flex-col gap-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <label className="block text-xs font-semibold text-[#8B949E] uppercase tracking-wider">
                  {useCustomModel
                    ? `Custom Model Identifier (${settings.active_provider.toUpperCase()})`
                    : `Active Model (${settings.active_provider.toUpperCase()})`}
                </label>
                {!useCustomModel && (
                  <span className="text-[11px] font-mono text-[#8B949E] bg-[#0E1117] px-2 py-0.5 rounded border border-[#30363D]">
                    {filteredModels.length} {filteredModels.length === 1 ? "model" : "models"}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                {/* Live Model Refresh Button (for OpenRouter) */}
                {settings.active_provider === "openrouter" && !useCustomModel && (
                  <button
                    type="button"
                    onClick={handleRefreshLiveModels}
                    disabled={isRefreshingModels}
                    title="Bypass cache and sync latest models live from OpenRouter"
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-[#0E1117] hover:bg-[#1F242C] text-[#8B949E] hover:text-white border border-[#30363D] transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3 h-3 ${isRefreshingModels ? "animate-spin text-[#FF6A00]" : ""}`} />
                    <span>{isRefreshingModels ? "Syncing..." : "Refresh Live Models"}</span>
                  </button>
                )}

                {/* Custom Model Toggle */}
                <button
                  type="button"
                  onClick={() => {
                    const nextCustom = !useCustomModel;
                    setUseCustomModel(nextCustom);
                    if (!nextCustom && filteredModels.length > 0) {
                      const isCatalog = filteredModels.some(
                        (m) => m.name === settings.active_model || m.id === settings.active_model
                      );
                      if (!isCatalog) {
                        setSettings((prev) => ({
                          ...prev,
                          active_model: filteredModels[0].id || filteredModels[0].name,
                        }));
                      }
                    }
                  }}
                  className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium border transition-all cursor-pointer ${
                    useCustomModel
                      ? "bg-[#FF6A00]/15 text-[#FF6A00] border-[#FF6A00]/40 shadow-sm shadow-[#FF6A00]/10"
                      : "bg-[#0E1117] text-[#8B949E] hover:text-white border-[#30363D]"
                  }`}
                >
                  <div
                    className={`w-3.5 h-3.5 rounded flex items-center justify-center border transition-all ${
                      useCustomModel
                        ? "bg-[#FF6A00] border-[#FF6A00] text-black"
                        : "border-[#8B949E]/60 bg-transparent"
                    }`}
                  >
                    {useCustomModel && <CheckCircle2 className="w-3.5 h-3.5 text-black" />}
                  </div>
                  <span>Use Custom Model ID</span>
                </button>
              </div>
            </div>

            {useCustomModel ? (
              /* Custom Model Manual Entry Mode */
              <div className="flex flex-col gap-2">
                <label className="text-xs text-zinc-300 font-medium">
                  Custom Model String (e.g., meta-llama/llama-3.1-8b-instruct:free or x-ai/grok-2)
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={settings.active_model}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        active_model: e.target.value,
                      })
                    }
                    placeholder="e.g., meta-llama/llama-3.1-8b-instruct:free or x-ai/grok-2"
                    className="w-full px-4 py-3 bg-[#0E1117] border border-[#FF6A00]/50 rounded-xl text-sm font-mono text-white placeholder-[#8B949E] focus:outline-none focus:border-[#FF6A00] focus:ring-1 focus:ring-[#FF6A00]/30 transition-colors"
                  />
                </div>
                <p className="text-xs text-[#8B949E] flex items-center gap-1.5">
                  <Info className="w-3.5 h-3.5 text-[#FF6A00] shrink-0" />
                  <span>
                    Directly routed through {settings.active_provider.toUpperCase()} gateway. Backend will accept and dispatch queries without catalog validation restrictions.
                  </span>
                </p>
              </div>
            ) : settings.active_provider === "openrouter" ? (
              /* Searchable Live Combobox for OpenRouter (400+ Live Models) */
              <div className="flex flex-col gap-2.5">
                {/* Search Bar */}
                <div className="relative">
                  <Search className="w-4 h-4 text-[#8B949E] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={modelSearchQuery}
                    onChange={(e) => setModelSearchQuery(e.target.value)}
                    placeholder="Search 400+ models (e.g. gpt-4o, claude-3.5, deepseek, gemini, llama)..."
                    className="w-full pl-10 pr-4 py-2.5 bg-[#0E1117] border border-[#30363D] rounded-xl text-xs sm:text-sm text-white placeholder-[#8B949E] focus:outline-none focus:border-[#FF6A00] transition-colors"
                  />
                  {modelSearchQuery && (
                    <button
                      type="button"
                      onClick={() => setModelSearchQuery("")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#8B949E] hover:text-white"
                    >
                      Clear
                    </button>
                  )}
                </div>

                {/* Filtered Models Scrollable List / Selector */}
                <div className="max-h-72 overflow-y-auto border border-[#30363D] rounded-xl bg-[#0E1117] divide-y divide-[#30363D]/60 custom-scrollbar">
                  {searchResults.length > 0 ? (
                    searchResults.map((m) => {
                      const isSelected =
                        settings.active_model === m.id || settings.active_model === m.name;

                      // Vendor badge color & limit classification
                      const mid = m.id.toLowerCase();
                      const isGroqModel = m.provider === "groq" || (!m.id.includes("/") && !m.provider);
                      const isOpenRouterFree =
                        m.id.endsWith(":free") ||
                        m.id.includes(":free") ||
                        m.pricing?.prompt === "0" ||
                        m.pricing?.prompt === 0;
                      const isFrontierModel =
                        mid.startsWith("anthropic/") ||
                        mid.startsWith("openai/") ||
                        mid.includes("claude") ||
                        mid.includes("gpt-4") ||
                        mid.includes("o1") ||
                        mid.includes("gemini-1.5-pro");

                      const ctxFormatted = m.context_length
                        ? m.context_length >= 1000000
                          ? `${Math.round(m.context_length / 1000000)}M ctx`
                          : `${Math.round(m.context_length / 1000)}k ctx`
                        : isGroqModel
                        ? "128k ctx"
                        : isFrontierModel
                        ? "200k ctx"
                        : isOpenRouterFree
                        ? "128k ctx"
                        : null;

                      const vendorColor = mid.startsWith("openai/")
                        ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
                        : mid.startsWith("anthropic/")
                        ? "text-purple-400 bg-purple-500/10 border-purple-500/20"
                        : mid.startsWith("google/")
                        ? "text-blue-400 bg-blue-500/10 border-blue-500/20"
                        : mid.startsWith("deepseek/")
                        ? "text-cyan-400 bg-cyan-500/10 border-cyan-500/20"
                        : mid.startsWith("meta-llama/")
                        ? "text-amber-400 bg-amber-500/10 border-amber-500/20"
                        : "text-zinc-400 bg-zinc-500/10 border-zinc-500/20";

                      return (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => {
                            setSettings({
                              ...settings,
                              active_model: m.id,
                            });
                          }}
                          className={`w-full p-3 text-left flex items-center justify-between gap-3 transition-colors cursor-pointer ${
                            isSelected
                              ? "bg-[#FF6A00]/10 hover:bg-[#FF6A00]/15"
                              : "hover:bg-[#161B22]"
                          }`}
                        >
                          <div className="flex flex-col gap-0.5 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span
                                className={`text-sm font-semibold truncate ${
                                  isSelected ? "text-[#FF6A00]" : "text-white"
                                }`}
                              >
                                {m.name || m.id}
                              </span>
                              <span
                                className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${vendorColor}`}
                              >
                                {m.id.split("/")[0] || "model"}
                              </span>
                              {ctxFormatted && (
                                <span className="text-[10px] font-mono text-[#8B949E] bg-[#161B22] px-1.5 py-0.5 rounded border border-[#30363D]">
                                  {ctxFormatted}
                                </span>
                              )}

                              {/* Static Limit Badges */}
                              {isGroqModel ? (
                                <>
                                  <span className="text-[10px] font-mono font-medium text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/25">
                                    6k TPM
                                  </span>
                                  <span className="text-[10px] font-mono font-medium text-zinc-300 bg-zinc-800/80 px-1.5 py-0.5 rounded border border-zinc-700/60">
                                    100k TPD
                                  </span>
                                </>
                              ) : isOpenRouterFree ? (
                                <span className="text-[10px] font-mono font-medium text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/25">
                                  20-50 Req/Day (Free)
                                </span>
                              ) : isFrontierModel ? (
                                <span className="text-[10px] font-mono font-medium text-purple-400 bg-purple-500/10 px-1.5 py-0.5 rounded border border-purple-500/25">
                                  Tier 1 Pay-as-you-go
                                </span>
                              ) : (
                                <span className="text-[10px] font-mono font-medium text-sky-400 bg-sky-500/10 px-1.5 py-0.5 rounded border border-sky-500/25">
                                  Pay-as-you-go
                                </span>
                              )}
                            </div>
                            <span className="text-xs font-mono text-[#8B949E] truncate">
                              {m.id}
                            </span>
                          </div>

                          <div className="shrink-0">
                            {isSelected ? (
                              <div className="w-5 h-5 rounded-full bg-[#FF6A00] flex items-center justify-center text-black">
                                <Check className="w-3.5 h-3.5 stroke-[3]" />
                              </div>
                            ) : (
                              <div className="w-5 h-5 rounded-full border border-[#30363D]" />
                            )}
                          </div>
                        </button>
                      );
                    })
                  ) : (
                    <div className="p-6 text-center text-xs text-[#8B949E]">
                      No models found matching &quot;{modelSearchQuery}&quot;. You can use Custom Model ID to enter any model ID.
                    </div>
                  )}
                </div>

                {/* Active Model Indicator */}
                <div className="flex items-center justify-between text-xs text-[#8B949E] px-1">
                  <span>
                    Selected: <strong className="text-white font-mono font-semibold">{settings.active_model}</strong>
                  </span>
                  <span>{searchResults.length} of {filteredModels.length} models visible</span>
                </div>
              </div>
            ) : (
              /* Groq Dropdown Selector */
              <div>
                <div className="relative">
                  <select
                    value={settings.active_model}
                    onChange={(e) => {
                      setSettings({
                        ...settings,
                        active_model: e.target.value,
                      });
                    }}
                    className="w-full pl-4 pr-10 py-3 bg-[#0E1117] border border-[#30363D] rounded-xl text-sm text-white focus:outline-none focus:border-[#FF6A00] transition-colors appearance-none cursor-pointer"
                  >
                    {filteredModels.map((m) => (
                      <option key={m.id} value={m.id || m.name}>
                        {m.label || m.name} ({m.id})
                      </option>
                    ))}
                    {!filteredModels.some(
                      (m) => m.name === settings.active_model || m.id === settings.active_model
                    ) && (
                      <option value={settings.active_model}>
                        {settings.active_model} (Custom)
                      </option>
                    )}
                  </select>
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-[#8B949E]">
                    <ChevronRight className="w-4 h-4 rotate-90" />
                  </div>
                </div>
                <div className="flex items-center justify-between text-xs text-[#8B949E] mt-2 flex-wrap gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span>
                      Currently routed through: <span className="text-[#FF6A00] font-mono font-medium">{settings.active_provider}</span> with active model:{" "}
                      <span className="text-white font-mono font-semibold">{settings.active_model}</span>
                    </span>
                    {settings.active_provider === "groq" ? (
                      <>
                        <span className="text-[10px] font-mono text-[#8B949E] bg-[#161B22] px-1.5 py-0.5 rounded border border-[#30363D]">
                          128k ctx
                        </span>
                        <span className="text-[10px] font-mono font-medium text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/25">
                          6k TPM
                        </span>
                        <span className="text-[10px] font-mono font-medium text-zinc-300 bg-zinc-800/80 px-1.5 py-0.5 rounded border border-zinc-700/60">
                          100k TPD
                        </span>
                      </>
                    ) : (
                      <span className="text-[10px] font-mono font-medium text-purple-400 bg-purple-500/10 px-1.5 py-0.5 rounded border border-purple-500/25">
                        Tier 1 Pay-as-you-go
                      </span>
                    )}
                  </div>
                  <span>{filteredModels.length} models available</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* SECTION 2: API Keys Management (Groq & OpenRouter) */}
        <div className="p-6 rounded-2xl bg-[#161B22] border border-[#30363D] flex flex-col gap-6 shadow-xl shadow-black/20">
          <div className="flex items-center justify-between border-b border-[#30363D] pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#0E1117] border border-[#30363D] flex items-center justify-center text-cyan-400">
                <Key className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white">Provider API Keys</h2>
                <p className="text-xs text-[#8B949E]">
                  Secure credentials stored in PostgreSQL app_settings (masked with show/hide toggle).
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-medium">
              <ShieldCheck className="w-4 h-4" />
              <span className="hidden sm:inline">Encrypted / Server Stored</span>
            </div>
          </div>

          <div className="flex flex-col gap-4">
            {/* Groq API Key */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-white flex items-center gap-2">
                  <span>Groq API Key</span>
                  <span className="text-[10px] text-orange-400 font-mono bg-orange-400/10 px-1.5 py-0.5 rounded border border-orange-400/20">
                    Required for Groq LPUs
                  </span>
                </label>
                {settings.groq_api_key ? (
                  <span className="text-[11px] text-emerald-400 font-mono">Configured ✓</span>
                ) : (
                  <span className="text-[11px] text-amber-400 font-mono">Unset</span>
                )}
              </div>
              <div className="relative">
                <input
                  type={showGroqKey ? "text" : "password"}
                  value={settings.groq_api_key || ""}
                  onChange={(e) =>
                    setSettings({ ...settings, groq_api_key: e.target.value })
                  }
                  placeholder="gsk_..."
                  className="w-full pl-4 pr-12 py-2.5 bg-[#0E1117] border border-[#30363D] rounded-xl text-sm font-mono text-white placeholder-[#8B949E] focus:outline-none focus:border-[#FF6A00] transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowGroqKey(!showGroqKey)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#8B949E] hover:text-white transition-colors"
                >
                  {showGroqKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* OpenRouter API Key */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-white flex items-center gap-2">
                  <span>OpenRouter API Key</span>
                  <span className="text-[10px] text-purple-400 font-mono bg-purple-400/10 px-1.5 py-0.5 rounded border border-purple-400/20">
                    Required for GPT-4o, Claude 3.5, Gemini & 400+ Models
                  </span>
                </label>
                {settings.openrouter_api_key ? (
                  <span className="text-[11px] text-emerald-400 font-mono">Configured ✓</span>
                ) : (
                  <span className="text-[11px] text-amber-400 font-mono">Unset</span>
                )}
              </div>
              <div className="relative">
                <input
                  type={showOpenRouterKey ? "text" : "password"}
                  value={settings.openrouter_api_key || ""}
                  onChange={(e) =>
                    setSettings({ ...settings, openrouter_api_key: e.target.value })
                  }
                  placeholder="sk-or-v1-..."
                  className="w-full pl-4 pr-12 py-2.5 bg-[#0E1117] border border-[#30363D] rounded-xl text-sm font-mono text-white placeholder-[#8B949E] focus:outline-none focus:border-[#FF6A00] transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowOpenRouterKey(!showOpenRouterKey)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#8B949E] hover:text-white transition-colors"
                >
                  {showOpenRouterKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* SECTION 3: Monthly Token Budget & Quota */}
        <div className="p-6 rounded-2xl bg-[#161B22] border border-[#30363D] flex flex-col gap-6 shadow-xl shadow-black/20">
          <div className="flex items-center justify-between border-b border-[#30363D] pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#0E1117] border border-[#30363D] flex items-center justify-center text-amber-400">
                <Zap className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white">Monthly Token Budget & Analytics</h2>
                <p className="text-xs text-[#8B949E]">
                  Cap maximum allowed LLM generation tokens across all corporate agents per calendar month.
                </p>
              </div>
            </div>

            <div className="text-xs font-mono text-[#FF6A00]">
              Budget: {quotaNumber.toLocaleString()} tokens
            </div>
          </div>

          {/* Token Budget Progress Preview */}
          <div className="p-4 rounded-xl bg-[#0E1117] border border-[#30363D] flex flex-col gap-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-[#8B949E]">
                Consumed: <strong className="text-white font-mono">{consumedTokens.toLocaleString()}</strong> tokens
              </span>
              <span className="text-[#8B949E]">
                Remaining: <strong className="text-emerald-400 font-mono">{remainingTokens.toLocaleString()}</strong> tokens ({100 - usedPercent}%)
              </span>
            </div>
            {/* Progress Bar */}
            <div className="w-full h-2.5 rounded-full bg-[#161B22] overflow-hidden border border-[#30363D]">
              <div
                className="h-full bg-gradient-to-r from-emerald-500 via-[#FF6A00] to-rose-500 transition-all duration-500 rounded-full"
                style={{ width: `${Math.max(2, usedPercent)}%` }}
              />
            </div>
          </div>

          {/* Budget Input & Quick Presets */}
          <div className="flex flex-col gap-3">
            <label className="text-xs font-semibold text-[#8B949E] uppercase tracking-wider">
              Monthly Token Allocation (Number of Tokens)
            </label>
            <div className="flex flex-col sm:flex-row items-center gap-3">
              <input
                type="number"
                min="0"
                step="any"
                value={settings.token_monthly_quota || "1000000"}
                onChange={(e) =>
                  setSettings({ ...settings, token_monthly_quota: e.target.value })
                }
                className="w-full sm:w-72 px-4 py-2.5 bg-[#0E1117] border border-[#30363D] rounded-xl text-sm font-mono text-white focus:outline-none focus:border-[#FF6A00] transition-colors"
              />

              {/* Quick Preset Buttons */}
              <div className="flex items-center gap-2 w-full sm:w-auto">
                {[
                  { label: "500K", value: "500000" },
                  { label: "1 Million", value: "1000000" },
                  { label: "5 Million", value: "5000000" },
                  { label: "10 Million", value: "10000000" },
                ].map((preset) => (
                  <button
                    key={preset.value}
                    type="button"
                    onClick={() =>
                      setSettings({ ...settings, token_monthly_quota: preset.value })
                    }
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                      settings.token_monthly_quota === preset.value
                        ? "bg-[#FF6A00]/15 text-[#FF6A00] border-[#FF6A00]"
                        : "bg-[#0E1117] text-[#8B949E] border-[#30363D] hover:text-white hover:border-[#8B949E]"
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Usage Breakdown by Provider & Model */}
          <div className="flex flex-col gap-4 pt-5 border-t border-[#30363D]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-[#FF6A00]" />
                <h3 className="text-xs font-semibold text-white uppercase tracking-wider">
                  Token Consumption Breakdown
                </h3>
              </div>
              <span className="text-[11px] font-mono text-[#8B949E]">
                Provider & Model Level Tracking
              </span>
            </div>

            {/* Provider Split Badges & Cards (2 Gateways: Groq & OpenRouter) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Groq Card */}
              <div className="p-3.5 rounded-xl bg-[#0E1117] border border-orange-500/20 flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-orange-400 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-orange-500" />
                    Groq LPUs
                  </span>
                  <span className="text-[11px] font-mono text-orange-400 bg-orange-500/10 px-1.5 py-0.5 rounded border border-orange-500/20">
                    {totalProviderTokens > 0 ? Math.round((groqTokens / totalProviderTokens) * 100) : 0}%
                  </span>
                </div>
                <div className="text-base font-bold text-white font-mono">
                  {groqTokens.toLocaleString()} <span className="text-xs font-normal text-[#8B949E]">tokens</span>
                </div>
              </div>

              {/* OpenRouter Card */}
              <div className="p-3.5 rounded-xl bg-[#0E1117] border border-purple-500/20 flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-purple-400 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-purple-500" />
                    OpenRouter Unified
                  </span>
                  <span className="text-[11px] font-mono text-purple-400 bg-purple-500/10 px-1.5 py-0.5 rounded border border-purple-500/20">
                    {totalProviderTokens > 0 ? Math.round((openrouterTokens / totalProviderTokens) * 100) : 0}%
                  </span>
                </div>
                <div className="text-base font-bold text-white font-mono">
                  {openrouterTokens.toLocaleString()} <span className="text-xs font-normal text-[#8B949E]">tokens</span>
                </div>
              </div>
            </div>

            {/* Stacked Provider Progress Bar */}
            {totalProviderTokens > 0 && (
              <div className="flex flex-col gap-1.5">
                <div className="w-full h-3 rounded-full bg-[#0E1117] overflow-hidden flex border border-[#30363D]">
                  {groqTokens > 0 && (
                    <div
                      title={`Groq: ${groqTokens.toLocaleString()} tokens`}
                      style={{ width: `${(groqTokens / totalProviderTokens) * 100}%` }}
                      className="bg-orange-500 hover:brightness-110 transition-all"
                    />
                  )}
                  {openrouterTokens > 0 && (
                    <div
                      title={`OpenRouter: ${openrouterTokens.toLocaleString()} tokens`}
                      style={{ width: `${(openrouterTokens / totalProviderTokens) * 100}%` }}
                      className="bg-purple-500 hover:brightness-110 transition-all"
                    />
                  )}
                </div>
                <div className="flex items-center justify-between text-[11px] text-[#8B949E] px-0.5">
                  <span className="flex items-center gap-3">
                    <span className="inline-flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-orange-500 inline-block" /> Groq LPUs
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-purple-500 inline-block" /> OpenRouter Unified
                    </span>
                  </span>
                  <span>{totalProviderTokens.toLocaleString()} tokens classified</span>
                </div>
              </div>
            )}

            {/* Model Breakdown Compact Pill / List */}
            <div className="mt-2 flex flex-col gap-2.5">
              <label className="text-xs font-semibold text-[#8B949E] uppercase tracking-wider">
                Tokens Consumed by Specific Model
              </label>

              {tokenAnalytics?.by_model && tokenAnalytics.by_model.length > 0 ? (
                <div className="divide-y divide-[#30363D] border border-[#30363D] rounded-xl overflow-hidden bg-[#0E1117]">
                  {tokenAnalytics.by_model.map((mItem, idx) => {
                    const isGroqModel =
                      mItem.model.startsWith("groq/") ||
                      (mItem.model.includes("llama") && !mItem.model.includes("/"));
                    return (
                      <div
                        key={mItem.model || idx}
                        className="p-3 sm:px-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-[#161B22]/50 transition-colors"
                      >
                        <div className="flex items-center gap-2.5">
                          <span className="font-mono text-xs sm:text-sm font-semibold text-white">
                            {mItem.model}
                          </span>
                          {isGroqModel ? (
                            <span className="text-[10px] px-2 py-0.5 rounded bg-orange-500/10 text-orange-400 border border-orange-500/20 font-mono">
                              Groq
                            </span>
                          ) : (
                            <span className="text-[10px] px-2 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20 font-mono">
                              OpenRouter
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-3 self-end sm:self-center">
                          <div className="w-24 sm:w-32 bg-[#161B22] rounded-full h-2 overflow-hidden border border-[#30363D]/60 hidden xs:block">
                            <div
                              className="bg-[#FF6A00] h-full rounded-full"
                              style={{ width: `${Math.min(100, Math.max(3, mItem.percentage))}%` }}
                            />
                          </div>
                          <span className="text-xs font-mono font-bold text-white">
                            {mItem.tokens.toLocaleString()}{" "}
                            <span className="text-[#8B949E] font-normal">tokens</span>
                          </span>
                          <span className="text-[11px] font-mono text-[#FF6A00] bg-[#FF6A00]/10 px-2 py-0.5 rounded border border-[#FF6A00]/20 min-w-[48px] text-center font-semibold">
                            {mItem.percentage}%
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-4 rounded-xl border border-dashed border-[#30363D] bg-[#0E1117] text-center text-xs text-[#8B949E]">
                  No token logs recorded yet for individual models. Invocations will reflect here in real-time.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Form Action Controls */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <Link
            href="/admin/agents"
            className="px-5 py-2.5 rounded-xl bg-[#161B22] hover:bg-[#1F242C] text-sm font-semibold text-[#8B949E] hover:text-white border border-[#30363D] transition-colors"
          >
            Cancel
          </Link>

          <button
            type="submit"
            disabled={isSaving}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-semibold text-sm transition-all active:scale-95 disabled:opacity-60 ${
              isSaved
                ? "bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/30 border border-emerald-500/40"
                : isSaving
                ? "bg-[#FF6A00]/80 text-white shadow-lg shadow-[#FF6A00]/20 cursor-wait"
                : "bg-gradient-to-r from-[#FF6A00] to-[#E55F00] hover:from-[#FF7B1A] hover:to-[#FF6A00] text-white shadow-lg shadow-[#FF6A00]/25 hover:shadow-[#FF6A00]/40"
            }`}
          >
            {isSaving ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Saving...</span>
              </>
            ) : isSaved ? (
              <>
                <Check className="w-4 h-4 stroke-[3]" />
                <span>✓ Saved!</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>Save Settings</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
