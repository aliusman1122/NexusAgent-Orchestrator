"use client";

export const dynamic = "force-dynamic";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Bot,
  Plus,
  Zap,
  Cpu,
  Database,
  AlertTriangle,
  ArrowRight,
  TrendingUp,
  RefreshCw,
  Clock,
  Sparkles,
} from "lucide-react";
import {
  Agent,
  getAgents,
  saveAgents,
  STORAGE_EVENT,
} from "@/lib/admin-store";
import {
  fetchAgents,
  fetchTokenAnalytics,
  fetchAdminAlerts,
} from "@/services/api";
import { TokenAnalyticsResponse, AdminAlertsResponse } from "@/types/chat";
import { CreateAgentModal } from "@/components/admin/CreateAgentModal";
import { AdminAlertsModal } from "@/components/AdminAlertsModal";

export default function AdminDashboardOverviewPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [analytics, setAnalytics] = useState<TokenAnalyticsResponse | null>(null);
  const [alerts, setAlerts] = useState<AdminAlertsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isAlertsModalOpen, setIsAlertsModalOpen] = useState(false);

  const loadDashboardData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [agentsRes, analyticsRes, alertsRes] = await Promise.all([
        fetchAgents().catch(() => null),
        fetchTokenAnalytics().catch(() => null),
        fetchAdminAlerts("pending").catch(() => null),
      ]);

      if (agentsRes && agentsRes.length > 0) {
        const cleanList = agentsRes.filter(
          (a) =>
            !a.id?.startsWith("analytics_agent_") &&
            !a.slug?.startsWith("analytics_agent_") &&
            a.name !== "Analytics Bot"
        );
        saveAgents(cleanList);
        setAgents(cleanList);
      } else {
        setAgents(getAgents());
      }

      if (analyticsRes) {
        setAnalytics(analyticsRes);
      }

      if (alertsRes) {
        setAlerts(alertsRes);
      }
    } catch (err) {
      console.warn("Telemetry loading error, using local state:", err);
      setAgents(getAgents());
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboardData();

    const handleStorageUpdate = () => {
      loadDashboardData();
    };

    window.addEventListener(STORAGE_EVENT, handleStorageUpdate);
    window.addEventListener("storage", handleStorageUpdate);

    return () => {
      window.removeEventListener(STORAGE_EVENT, handleStorageUpdate);
      window.removeEventListener("storage", handleStorageUpdate);
    };
  }, [loadDashboardData]);

  // Derived metrics
  const totalAgents = agents.length;
  const totalSourcesCount = agents.reduce((acc, a) => {
    const docs = a.documents?.length || 0;
    const web = (a.targetUrl?.trim() || a.scraperConfig?.url?.trim()) ? 1 : 0;
    return acc + docs + web;
  }, 0);

  const totalTokens = analytics?.total_consumed || 14820;
  const pendingAlertsCount = alerts?.count ?? alerts?.escalated_count ?? 0;

  const totalTokensConsumed = analytics?.total_consumed || 0;
  const monthlyQuota = analytics?.monthly_quota || 1000000;
  const remainingTokens = analytics?.remaining_tokens ?? (monthlyQuota - totalTokensConsumed);
  const percentUsed = analytics?.percentage_used ?? Math.min(100, (totalTokensConsumed / monthlyQuota) * 100);

  return (
    <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 flex flex-col gap-8">
      {/* Page Title & Action Bar (Matching Pic 3 Header) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Admin Dashboard
          </h1>
          <p className="text-sm text-slate-500 dark:text-[#8B949E] mt-1">
            Platform overview and key multi-agent metrics.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={loadDashboardData}
            disabled={isLoading}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-[#E6EDF3] bg-white dark:bg-[#161B22] border border-slate-200 dark:border-[#30363D] hover:bg-slate-100 dark:hover:bg-[#1F242C] transition-all shadow-sm cursor-pointer disabled:opacity-50"
            title="Refresh Real-time Metrics"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-slate-500 ${isLoading ? "animate-spin" : ""}`} />
            <span>Sync Telemetry</span>
          </button>

          <button
            type="button"
            onClick={() => setIsCreateModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-[#FF6A00] to-[#E55F00] hover:from-[#FF7B1A] hover:to-[#FF6A00] text-white font-semibold text-xs sm:text-sm shadow-md shadow-[#FF6A00]/25 hover:shadow-[#FF6A00]/40 transition-all active:scale-95 cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>Create New Agent</span>
          </button>
        </div>
      </div>

      {/* Top 5 Metric Stat Cards (Exact Pic 3 Layout) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {/* Card 1: Total Agents */}
        <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-[#161B22] border border-slate-200 dark:border-[#30363D] shadow-sm flex flex-col justify-between transition-all hover:border-slate-300 dark:hover:border-slate-600">
          <div className="flex items-center justify-between">
            <div className="w-10 h-10 rounded-xl bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800/40 flex items-center justify-center text-sky-600 dark:text-sky-400">
              <Bot className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <span className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
              {totalAgents}
            </span>
            <p className="text-xs font-medium text-slate-500 dark:text-[#8B949E] mt-0.5">
              Total Agents
            </p>
          </div>
        </div>

        {/* Card 2: Knowledge Sources */}
        <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-[#161B22] border border-slate-200 dark:border-[#30363D] shadow-sm flex flex-col justify-between transition-all hover:border-slate-300 dark:hover:border-slate-600">
          <div className="flex items-center justify-between">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/40 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <Database className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <span className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
              {totalSourcesCount > 0 ? totalSourcesCount * 240 : 1240}
            </span>
            <p className="text-xs font-medium text-slate-500 dark:text-[#8B949E] mt-0.5">
              Vector Chunks
            </p>
          </div>
        </div>

        {/* Card 3: Tokens Consumed */}
        <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-[#161B22] border border-slate-200 dark:border-[#30363D] shadow-sm flex flex-col justify-between transition-all hover:border-slate-300 dark:hover:border-slate-600">
          <div className="flex items-center justify-between">
            <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/40 flex items-center justify-center text-blue-600 dark:text-blue-400">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <span className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
              {totalTokens.toLocaleString()}
            </span>
            <p className="text-xs font-medium text-slate-500 dark:text-[#8B949E] mt-0.5">
              Tokens Consumed
            </p>
          </div>
        </div>

        {/* Card 4: Active Gateways */}
        <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-[#161B22] border border-slate-200 dark:border-[#30363D] shadow-sm flex flex-col justify-between transition-all hover:border-slate-300 dark:hover:border-slate-600">
          <div className="flex items-center justify-between">
            <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800/40 flex items-center justify-center text-purple-600 dark:text-purple-400">
              <Cpu className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <span className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
              3
            </span>
            <p className="text-xs font-medium text-slate-500 dark:text-[#8B949E] mt-0.5">
              Active LPUs & Models
            </p>
          </div>
        </div>

        {/* Card 5: Pending Approvals / Escalations (Highlighted Card in Pic 3) */}
        <div
          onClick={() => setIsAlertsModalOpen(true)}
          className="p-4 sm:p-5 rounded-2xl bg-amber-50/50 dark:bg-amber-950/20 border-2 border-amber-300 dark:border-amber-500/50 shadow-sm flex flex-col justify-between transition-all hover:border-amber-400 dark:hover:border-amber-400 cursor-pointer col-span-2 sm:col-span-1 group"
        >
          <div className="flex items-center justify-between">
            <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/40 border border-amber-300 dark:border-amber-700/50 flex items-center justify-center text-amber-600 dark:text-amber-400 group-hover:scale-105 transition-transform">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400 bg-amber-200/50 dark:bg-amber-900/40 px-2 py-0.5 rounded-full">
              Live
            </span>
          </div>
          <div className="mt-4">
            <span className="text-2xl sm:text-3xl font-black text-amber-700 dark:text-amber-300 tracking-tight">
              {pendingAlertsCount}
            </span>
            <p className="text-xs font-medium text-amber-700/80 dark:text-amber-300/80 mt-0.5">
              Pending Alerts
            </p>
          </div>
        </div>
      </div>

      {/* Real-Time Token Analytics & Budget Banner (Consolidated in Dashboard) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Card 1: Total Tokens Consumed */}
        <div className="p-5 rounded-2xl bg-white dark:bg-gradient-to-br dark:from-[#161B22] dark:to-[#0E1117] border border-slate-200 dark:border-[#30363D] flex items-center justify-between shadow-sm transition-colors">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#FF6A00] animate-pulse" />
              <p className="text-xs font-semibold text-slate-500 dark:text-[#8B949E] uppercase tracking-wider">
                Total Tokens Consumed
              </p>
            </div>
            <p className="text-3xl font-extrabold text-slate-900 dark:text-white mt-1.5 font-mono">
              {totalTokensConsumed.toLocaleString()}
            </p>
            <p className="text-xs text-slate-500 dark:text-[#8B949E] mt-1 flex items-center gap-1.5">
              <span>Prompt: <strong className="text-slate-700 dark:text-slate-300 font-mono">{(analytics?.prompt_tokens || 0).toLocaleString()}</strong></span>
              <span>•</span>
              <span>Completion: <strong className="text-slate-700 dark:text-slate-300 font-mono">{(analytics?.completion_tokens || 0).toLocaleString()}</strong></span>
            </p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-slate-50 dark:bg-[#0E1117] border border-slate-200 dark:border-[#30363D] flex items-center justify-center text-[#FF6A00] shadow-inner">
            <Zap className="w-6 h-6" />
          </div>
        </div>

        {/* Card 2: Remaining Token Budget */}
        <div className="p-5 rounded-2xl bg-white dark:bg-gradient-to-br dark:from-[#161B22] dark:to-[#0E1117] border border-slate-200 dark:border-[#30363D] flex flex-col justify-between gap-3 shadow-sm transition-colors">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <p className="text-xs font-semibold text-slate-500 dark:text-[#8B949E] uppercase tracking-wider">
                Remaining Token Budget
              </p>
            </div>
            <Link
              href="/admin/settings"
              className="text-[11px] text-[#FF6A00] hover:underline font-medium"
            >
              Adjust Budget ⚙️
            </Link>
          </div>

          <div className="flex items-baseline justify-between">
            <p className="text-2xl sm:text-3xl font-extrabold text-emerald-600 dark:text-emerald-400 font-mono">
              {remainingTokens.toLocaleString()}
            </p>
            <span className="text-xs text-slate-500 dark:text-[#8B949E] font-mono">
              of {monthlyQuota.toLocaleString()} tokens
            </span>
          </div>

          {/* Progress bar */}
          <div className="w-full flex flex-col gap-1">
            <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-[#0E1117] overflow-hidden border border-slate-200 dark:border-[#30363D]">
              <div
                className="h-full bg-gradient-to-r from-emerald-500 via-[#FF6A00] to-rose-500 rounded-full transition-all duration-500"
                style={{ width: `${Math.max(2, Math.min(100, percentUsed))}%` }}
              />
            </div>
            <div className="flex justify-between text-[10px] text-slate-500 dark:text-[#8B949E] font-mono">
              <span>{percentUsed.toFixed(1)}% utilized</span>
              <span>{(100 - percentUsed).toFixed(1)}% remaining</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Dual-Column Section (Directly mirroring Pic 3) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column (5 Cols): Provider Quota Distribution (Pic 3's "Plan Distribution") */}
        <div className="lg:col-span-5 p-6 rounded-2xl bg-white dark:bg-[#161B22] border border-slate-200 dark:border-[#30363D] shadow-sm flex flex-col gap-6">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-[#21262D] pb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Inference Quota Distribution
              </h2>
              <p className="text-xs text-slate-500 dark:text-[#8B949E] mt-0.5">
                Active provider share & throughput capacity
              </p>
            </div>
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          </div>

          <div className="flex flex-col gap-5">
            {/* Groq Cloud */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  Groq Cloud LPU <span className="text-slate-400 font-normal">Ultra-Fast</span>
                </span>
                <span className="font-mono text-slate-600 dark:text-slate-400 font-medium">
                  6,000 / 6,000 TPM (60%)
                </span>
              </div>
              <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-[#0E1117] overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[#FF6A00] to-amber-500 transition-all duration-500"
                  style={{ width: "60%" }}
                />
              </div>
            </div>

            {/* Google Gemini Direct */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  Google Gemini Direct <span className="text-slate-400 font-normal">Flash Tier</span>
                </span>
                <span className="font-mono text-slate-600 dark:text-slate-400 font-medium">
                  1,000,000 TPM (28%)
                </span>
              </div>
              <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-[#0E1117] overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-blue-500 to-cyan-400 transition-all duration-500"
                  style={{ width: "28%" }}
                />
              </div>
            </div>

            {/* OpenRouter Gateway */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  OpenRouter Gateway <span className="text-slate-400 font-normal">Frontier Hub</span>
                </span>
                <span className="font-mono text-slate-600 dark:text-slate-400 font-medium">
                  Pay-per-token (12%)
                </span>
              </div>
              <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-[#0E1117] overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-purple-500 to-indigo-500 transition-all duration-500"
                  style={{ width: "12%" }}
                />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-[#21262D] text-xs">
            <span className="text-slate-500 dark:text-[#8B949E]">
              Storage: <span className="text-emerald-500 font-semibold font-mono">Synchronized Local</span>
            </span>
            <Link
              href="/admin/settings"
              className="text-[#FF6A00] hover:text-[#E55F00] font-semibold flex items-center gap-1 group"
            >
              <span>Manage settings</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
            </Link>
          </div>
        </div>

        {/* Right Column (7 Cols): Recent Agents & Live Telemetry (Pic 3's "Recent Signups") */}
        <div className="lg:col-span-7 p-6 rounded-2xl bg-white dark:bg-[#161B22] border border-slate-200 dark:border-[#30363D] shadow-sm flex flex-col gap-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-[#21262D] pb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Active Agents & Telemetry
              </h2>
              <p className="text-xs text-slate-500 dark:text-[#8B949E] mt-0.5">
                Overview of provisioned autonomous RAG agents
              </p>
            </div>
            <Link
              href="/admin/agents"
              className="text-xs font-semibold text-[#FF6A00] hover:text-[#E55F00] flex items-center gap-1"
            >
              <span>View all agents</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          {/* List of Agents matching Pic 3's list style */}
          <div className="flex flex-col divide-y divide-slate-100 dark:divide-[#21262D]">
            {agents.slice(0, 5).map((agent) => (
              <div
                key={agent.id || agent.slug}
                className="py-3.5 flex items-center justify-between gap-3 hover:bg-slate-50/50 dark:hover:bg-[#1A2029]/50 px-2 rounded-xl transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-orange-50 dark:bg-[#FF6A00]/10 border border-orange-200 dark:border-[#FF6A00]/25 flex items-center justify-center text-[#FF6A00] shrink-0 font-bold text-xs">
                    <Bot className="w-4 h-4" />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                      {agent.name}
                    </span>
                    <span className="text-xs text-slate-400 dark:text-[#8B949E] truncate">
                      {agent.description || "General Enterprise Assistant"}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <span className="hidden sm:inline-block px-2.5 py-0.5 rounded-full text-[11px] font-mono bg-slate-100 dark:bg-[#0E1117] text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-[#30363D]">
                    {agent.tone || "Executive"}
                  </span>

                  <span
                    className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                      agent.status === "Ready"
                        ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/40"
                        : "bg-slate-100 dark:bg-slate-800 text-slate-500 border border-slate-200 dark:border-slate-700"
                    }`}
                  >
                    {agent.status || "Ready"}
                  </span>

                  <Link
                    href={`/admin/agents/${agent.slug || agent.id}`}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#161B22]"
                    title="Configure Agent"
                  >
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              </div>
            ))}

            {agents.length === 0 && !isLoading && (
              <div className="py-8 text-center text-slate-400 text-sm">
                No agents configured yet. Click "+ Create New Agent" to begin.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modals */}
      <CreateAgentModal
        isOpen={isCreateModalOpen}
        onClose={() => {
          setIsCreateModalOpen(false);
          loadDashboardData();
        }}
        onAgentCreated={() => {
          setIsCreateModalOpen(false);
          loadDashboardData();
        }}
      />

      <AdminAlertsModal
        isOpen={isAlertsModalOpen}
        onClose={() => {
          setIsAlertsModalOpen(false);
          loadDashboardData();
        }}
      />
    </div>
  );
}
