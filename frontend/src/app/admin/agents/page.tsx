"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import {
  Bot,
  Plus,
  Search,
  Sparkles,
  FileText,
  Layers,
  Settings,
  MessageSquare,
  Trash2,
  ExternalLink,
  Shield,
  Briefcase,
  Smile,
  Terminal,
  RefreshCw,
  Cpu,
  ShoppingBag,
  SlidersHorizontal,
  CheckCircle2,
  Clock,
  AlertCircle,
  Zap,
  X,
} from "lucide-react";
import {
  Agent,
  AgentStatus,
  getAgents,
  saveAgents,
  deleteAgent,
  purgeAgentFromLocalStorage,
  STORAGE_EVENT,
} from "@/lib/admin-store";
import { fetchAgents, deleteAgent as deleteAgentApi, fetchTokenAnalytics } from "@/services/api";
import { TokenAnalyticsResponse } from "@/types/chat";
import { CreateAgentModal } from "@/components/admin/CreateAgentModal";
import { LiveProviderQuotaCard } from "@/components/admin/LiveProviderQuotaCard";

export default function AgentsDashboardPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [agentToDelete, setAgentToDelete] = useState<Agent | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [tokenAnalytics, setTokenAnalytics] = useState<TokenAnalyticsResponse | null>(null);

  // Toast notification state
  const [toast, setToast] = useState<{
    type: "success" | "error";
    title: string;
    message: string;
  } | null>(null);
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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

  const loadAgents = useCallback(async () => {
    setIsLoading(true);
    try {
      const [list, analytics] = await Promise.all([
        fetchAgents().catch(() => null),
        fetchTokenAnalytics().catch(() => null),
      ]);

      if (list && list.length > 0) {
        const cleanList = list.filter(
          (a) =>
            !a.id?.startsWith("analytics_agent_") &&
            !a.slug?.startsWith("analytics_agent_") &&
            a.name !== "Analytics Bot"
        );
        saveAgents(cleanList);
        setAgents(cleanList);
      } else {
        const localList = getAgents();
        setAgents(localList);
      }

      if (analytics) {
        const sanitizedAnalytics: TokenAnalyticsResponse = {
          ...analytics,
          agents_breakdown: (analytics.agents_breakdown || []).filter(
            (b) =>
              !b.agent_id?.startsWith("analytics_agent_") &&
              b.agent_name !== "Analytics Bot"
          ),
        };
        setTokenAnalytics(sanitizedAnalytics);
      }
    } catch (err) {
      console.warn("Could not fetch agents/analytics from backend API, using local store:", err);
      const localList = getAgents();
      setAgents(localList);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAgents();

    const handleStorageUpdate = () => {
      loadAgents();
    };

    window.addEventListener(STORAGE_EVENT, handleStorageUpdate);
    window.addEventListener("storage", handleStorageUpdate);

    return () => {
      window.removeEventListener(STORAGE_EVENT, handleStorageUpdate);
      window.removeEventListener("storage", handleStorageUpdate);
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    };
  }, [loadAgents]);

  const handleDelete = async (agent: Agent) => {
    const isCoreAgent =
      agent.slug === "a7_logics" ||
      agent.id === "a7_logics" ||
      agent.is_default ||
      (agent as any).isDefault;

    if (isCoreAgent) {
      setAgentToDelete(null);
      showToast("error", "Action Not Allowed", "Core system agent cannot be deleted.");
      return;
    }

    try {
      // 1. Delete from Backend Database & Vector Store
      const targetId = agent.id || agent.slug;
      await deleteAgentApi(targetId);
      if (agent.slug && agent.slug !== targetId) {
        await deleteAgentApi(agent.slug).catch(() => null);
      }

      // 2. Remove from local memory state
      setAgents((prev) =>
        prev.filter((a) => a.id !== agent.id && a.slug !== agent.slug)
      );

      // 3. Purge from localStorage / cache so refresh won't restore it
      purgeAgentFromLocalStorage(agent.id);
      if (agent.slug) purgeAgentFromLocalStorage(agent.slug);

      showToast("success", "Agent Permanently Deleted", `Agent "${agent.name}" was permanently removed.`);
    } catch (err: any) {
      const errMsg = err?.message || "Failed to delete agent from database.";
      console.warn("Agent deletion failed:", errMsg);
      showToast("error", "Deletion Failed", errMsg);
    } finally {
      setAgentToDelete(null);
    }
  };

  // Filtered agents
  const filteredAgents = agents.filter((agent) => {
    const matchesSearch =
      agent.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      agent.slug.toLowerCase().includes(searchQuery.toLowerCase()) ||
      agent.description.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus =
      statusFilter === "ALL" || agent.status.toUpperCase() === statusFilter;

    return matchesSearch && matchesStatus;
  });

  // Stats calculation
  const totalAgents = agents.length;
  const activeAgents = agents.filter((a) => a.status === "Ready").length;
  const draftAgents = agents.filter((a) => a.status === "Draft").length;

  const getAgentSourcesCount = (agent: Agent): number => {
    if (typeof agent.sources_count === "number") return agent.sources_count;
    if (typeof agent.sourcesCount === "number") return agent.sourcesCount;
    const docsCount = agent.documents?.length || 0;
    const hasWebSource = (agent.targetUrl?.trim() || agent.scraperConfig?.url?.trim()) ? 1 : 0;
    const alreadyIncludesWeb = agent.documents?.some(
      (d: any) => d.type === "web" || d.source_type === "web"
    );
    return docsCount + (hasWebSource && !alreadyIncludesWeb ? 1 : 0);
  };

  const totalSources = agents.reduce((acc, a) => acc + getAgentSourcesCount(a), 0);

  const totalTokensConsumed = tokenAnalytics?.total_consumed || 0;
  const monthlyQuota = tokenAnalytics?.monthly_quota || 1000000;
  const remainingTokens = tokenAnalytics?.remaining_tokens ?? (monthlyQuota - totalTokensConsumed);
  const percentUsed = tokenAnalytics?.percentage_used ?? Math.min(100, (totalTokensConsumed / monthlyQuota) * 100);

  const getAgentTokens = (agent: Agent): number => {
    if (!tokenAnalytics?.agents_breakdown) return 0;
    const match = tokenAnalytics.agents_breakdown.find(
      (b) => b.agent_id === agent.id || b.agent_id === agent.slug
    );
    return match?.total_tokens || 0;
  };

  const getToneIcon = (tone: string) => {
    switch (tone) {
      case "Executive":
        return <Briefcase className="w-3 h-3 text-[#FF6A00]" />;
      case "Casual":
        return <Smile className="w-3 h-3 text-emerald-400" />;
      case "Technical":
        return <Terminal className="w-3 h-3 text-cyan-400" />;
      default:
        return <Bot className="w-3 h-3 text-[#FF6A00]" />;
    }
  };

  const getAgentAvatar = (agent: Agent) => {
    if (agent.slug.includes("fintech") || agent.avatarIcon === "shield") {
      return (
        <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-600/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
          <Shield className="w-6 h-6" />
        </div>
      );
    }
    if (agent.slug.includes("ecommerce") || agent.avatarIcon === "shopping-bag") {
      return (
        <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-600/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
          <ShoppingBag className="w-6 h-6" />
        </div>
      );
    }
    return (
      <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#FF6A00]/25 to-[#E55F00]/20 border border-[#FF6A00]/40 flex items-center justify-center text-[#FF6A00] shadow-sm shadow-[#FF6A00]/15">
        <Cpu className="w-6 h-6" />
      </div>
    );
  };

  const renderStatusBadge = (status: AgentStatus) => {
    switch (status) {
      case "Ready":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            Ready
          </span>
        );
      case "Indexing":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/30 animate-pulse">
            <RefreshCw className="w-3 h-3 animate-spin text-amber-400" />
            Indexing
          </span>
        );
      case "Draft":
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-800 text-slate-400 border border-slate-700">
            <Clock className="w-3 h-3 text-slate-400" />
            Draft
          </span>
        );
    }
  };

  return (
    <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 flex flex-col gap-8">
      {/* Floating Toast Notification */}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed top-5 right-5 z-50 flex items-start gap-3 p-4 rounded-xl border shadow-2xl backdrop-blur-md animate-in slide-in-from-top-2 duration-200 max-w-sm"
          style={{
            backgroundColor: toast.type === "success" ? "rgba(6, 78, 59, 0.95)" : "rgba(127, 29, 29, 0.95)",
            borderColor: toast.type === "success" ? "rgba(16, 185, 129, 0.4)" : "rgba(239, 68, 68, 0.4)",
            color: toast.type === "success" ? "#a7f3d0" : "#fca5a5",
          }}
        >
          {toast.type === "success" ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
          )}
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-semibold text-white">{toast.title}</h4>
            <p className="text-xs text-gray-200 mt-0.5 break-words">{toast.message}</p>
          </div>
          <button
            type="button"
            onClick={() => setToast(null)}
            className="text-gray-400 hover:text-white transition-colors p-0.5 rounded cursor-pointer"
            aria-label="Dismiss toast"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Executive Header & Stats Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#161B22] border border-[#30363D] text-xs font-medium text-[#FF6A00] mb-2">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Autonomous Enterprise RAG Agents</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Agents Management Hub
          </h1>
          <p className="text-sm text-[#8B949E] mt-1 max-w-2xl">
            Configure agent knowledge bases, connect web crawlers and document stores, and test in isolated interactive playgrounds.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3 self-start md:self-auto">
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#FF6A00] to-[#E55F00] hover:from-[#FF7B1A] hover:to-[#FF6A00] text-white font-semibold text-sm shadow-lg shadow-[#FF6A00]/25 hover:shadow-[#FF6A00]/40 transition-all active:scale-95 cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>Create New Agent</span>
          </button>
        </div>
      </div>

      {/* Live Provider Quota Telemetry Widget */}
      <LiveProviderQuotaCard />

      {/* Real-Time Token Analytics & Budget Banner */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Card 1: Total Tokens Consumed */}
        <div className="p-5 rounded-2xl bg-gradient-to-br from-[#161B22] to-[#0E1117] border border-[#30363D] flex items-center justify-between shadow-lg shadow-black/20">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#FF6A00] animate-pulse" />
              <p className="text-xs font-semibold text-[#8B949E] uppercase tracking-wider">
                Total Tokens Consumed
              </p>
            </div>
            <p className="text-3xl font-extrabold text-white mt-1.5 font-mono">
              {totalTokensConsumed.toLocaleString()}
            </p>
            <p className="text-xs text-[#8B949E] mt-1 flex items-center gap-1.5">
              <span>Prompt: <strong className="text-slate-300 font-mono">{(tokenAnalytics?.prompt_tokens || 0).toLocaleString()}</strong></span>
              <span>•</span>
              <span>Completion: <strong className="text-slate-300 font-mono">{(tokenAnalytics?.completion_tokens || 0).toLocaleString()}</strong></span>
            </p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-[#0E1117] border border-[#30363D] flex items-center justify-center text-[#FF6A00] shadow-inner shadow-black">
            <Zap className="w-6 h-6" />
          </div>
        </div>

        {/* Card 2: Remaining Token Budget */}
        <div className="p-5 rounded-2xl bg-gradient-to-br from-[#161B22] to-[#0E1117] border border-[#30363D] flex flex-col justify-between gap-3 shadow-lg shadow-black/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <p className="text-xs font-semibold text-[#8B949E] uppercase tracking-wider">
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
            <p className="text-2xl sm:text-3xl font-extrabold text-emerald-400 font-mono">
              {remainingTokens.toLocaleString()}
            </p>
            <span className="text-xs text-[#8B949E] font-mono">
              of {monthlyQuota.toLocaleString()} tokens
            </span>
          </div>

          {/* Progress bar */}
          <div className="w-full flex flex-col gap-1">
            <div className="w-full h-2 rounded-full bg-[#0E1117] overflow-hidden border border-[#30363D]">
              <div
                className="h-full bg-gradient-to-r from-emerald-500 via-[#FF6A00] to-rose-500 rounded-full transition-all duration-500"
                style={{ width: `${Math.max(2, Math.min(100, percentUsed))}%` }}
              />
            </div>
            <div className="flex justify-between text-[10px] text-[#8B949E] font-mono">
              <span>{percentUsed.toFixed(1)}% utilized</span>
              <span>{(100 - percentUsed).toFixed(1)}% remaining</span>
            </div>
          </div>
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-[#161B22] border border-[#30363D] flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-[#8B949E] uppercase tracking-wider">
              Total Agents
            </p>
            <p className="text-2xl font-bold text-white mt-1">{totalAgents}</p>
            <span className="text-[11px] text-[#8B949E]">Configured bots</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-[#0E1117] border border-[#30363D] flex items-center justify-center text-[#FF6A00]">
            <Bot className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-[#161B22] border border-[#30363D] flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-[#8B949E] uppercase tracking-wider">
              Active / Ready
            </p>
            <p className="text-2xl font-bold text-emerald-400 mt-1">{activeAgents}</p>
            <span className="text-[11px] text-[#8B949E]">Ready to query</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-[#0E1117] border border-[#30363D] flex items-center justify-center text-emerald-400">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-[#161B22] border border-[#30363D] flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-[#8B949E] uppercase tracking-wider">
              Total Sources
            </p>
            <p className="text-2xl font-bold text-white mt-1">{totalSources}</p>
            <span className="text-[11px] text-[#8B949E]">Connected files & links</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-[#0E1117] border border-[#30363D] flex items-center justify-center text-cyan-400">
            <FileText className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-[#161B22] border border-[#30363D] flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-[#8B949E] uppercase tracking-wider">
              Draft / Pending
            </p>
            <p className="text-2xl font-bold text-amber-400 mt-1">{draftAgents}</p>
            <span className="text-[11px] text-[#8B949E]">Awaiting ingestion</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-[#0E1117] border border-[#30363D] flex items-center justify-center text-amber-400">
            <Clock className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Search and Filters Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-2 bg-[#161B22] border border-[#30363D] rounded-2xl">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8B949E]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search agents by name, slug, or description..."
            className="w-full pl-10 pr-4 py-2 bg-transparent text-sm text-white placeholder-[#8B949E] focus:outline-none"
          />
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 px-2 sm:px-0">
          {["ALL", "READY", "INDEXING", "DRAFT"].map((filter) => {
            const isSelected = statusFilter === filter;
            return (
              <button
                key={filter}
                onClick={() => setStatusFilter(filter)}
                className={`px-3 py-1 rounded-xl text-xs font-medium transition-all ${
                  isSelected
                    ? "bg-[#FF6A00] text-white shadow-sm"
                    : "text-[#8B949E] hover:text-[#E6EDF3] hover:bg-[#0E1117]"
                }`}
              >
                {filter === "ALL" ? "All Status" : filter}
              </button>
            );
          })}
        </div>
      </div>

      {/* Agents Cards Grid */}
      {filteredAgents.length === 0 ? (
        <div className="p-12 text-center rounded-2xl bg-[#161B22] border border-[#30363D] flex flex-col items-center justify-center">
          <div className="w-12 h-12 rounded-2xl bg-[#0E1117] border border-[#30363D] flex items-center justify-center text-[#8B949E] mb-3">
            <Bot className="w-6 h-6" />
          </div>
          <h3 className="text-base font-semibold text-white">No agents found</h3>
          <p className="text-xs text-[#8B949E] mt-1 max-w-sm">
            {searchQuery
              ? `No agents match query "${searchQuery}". Try clearing search.`
              : "No agents configured yet in this status category."}
          </p>
          <button
            onClick={() => {
              setSearchQuery("");
              setStatusFilter("ALL");
            }}
            className="mt-4 px-3.5 py-1.5 rounded-xl bg-[#0E1117] text-xs text-[#FF6A00] border border-[#FF6A00]/30 hover:bg-[#FF6A00]/10 transition-colors"
          >
            Clear Filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredAgents.map((agent) => {
            const isCoreAgent =
              agent.slug === "a7_logics" ||
              agent.id === "a7_logics" ||
              agent.is_default ||
              (agent as any).isDefault;

            return (
              <div
                key={agent.id}
                className="group rounded-2xl bg-[#161B22] border border-[#30363D] hover:border-[#FF6A00]/50 transition-all duration-200 p-5 flex flex-col justify-between shadow-lg shadow-black/20 hover:shadow-[#FF6A00]/5"
              >
                {/* Card Top: Avatar, Status, Tone */}
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      {getAgentAvatar(agent)}
                      <div>
                        <h3 className="text-base font-bold text-white group-hover:text-[#FF6A00] transition-colors leading-snug">
                          {agent.name}
                        </h3>
                        <span className="text-[11px] font-mono text-[#8B949E]">
                          id: {agent.slug}
                        </span>
                      </div>
                    </div>
                    {renderStatusBadge(agent.status)}
                  </div>

                  {/* Description */}
                  <p className="text-xs text-[#8B949E] line-clamp-2 mt-3 min-h-[32px] leading-relaxed">
                    {agent.description}
                  </p>

                  {/* Meta Pills */}
                  <div className="flex flex-wrap items-center gap-2 mt-4 pt-4 border-t border-[#30363D]/60 text-xs">
                    {/* Persona Tone Pill */}
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#0E1117] border border-[#30363D] text-[11px] text-[#E6EDF3]">
                      {getToneIcon(agent.tone)}
                      <span>{agent.tone} Tone</span>
                    </div>

                    {/* Sources count badge */}
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#0E1117] border border-[#30363D] text-[11px] text-[#8B949E]">
                      <Layers className="w-3 h-3 text-[#8B949E]" />
                      <span>{getAgentSourcesCount(agent)} Docs</span>
                    </div>

                    {/* Tokens consumed badge */}
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#FF6A00]/10 border border-[#FF6A00]/25 text-[11px] text-[#FF6A00]">
                      <Zap className="w-3 h-3 text-[#FF6A00]" />
                      <span className="font-semibold text-white">⚡ {getAgentTokens(agent).toLocaleString()}</span>
                      <span className="text-[#8B949E]">tokens consumed</span>
                    </div>
                  </div>
                </div>

                {/* Card Bottom: Actions */}
                <div className="mt-5 pt-4 border-t border-[#30363D] flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-1">
                    {/* Configure Knowledge Base button */}
                    <Link
                      href={`/admin/agents/${agent.id}`}
                      className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-[#0E1117] hover:bg-[#1F242C] text-xs font-semibold text-[#E6EDF3] hover:text-[#FF6A00] border border-[#30363D] hover:border-[#FF6A00]/40 transition-all text-center"
                    >
                      <Settings className="w-3.5 h-3.5 text-[#FF6A00]" />
                      <span>Configure KB</span>
                    </Link>

                    {/* Test Playground button -> routes to live site widget */}
                    <Link
                      href={`/?agent=${agent.slug}&open=true`}
                      className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-[#FF6A00]/15 hover:bg-[#FF6A00]/25 text-xs font-semibold text-[#FF6A00] border border-[#FF6A00]/40 hover:border-[#FF6A00] transition-all text-center"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      <span>Test Playground</span>
                    </Link>
                  </div>

                  {/* Delete button: disabled for core system agents */}
                  {isCoreAgent ? (
                    <button
                      type="button"
                      disabled
                      title="Core system agent cannot be deleted"
                      aria-label="Core system agent cannot be deleted"
                      className="p-2 rounded-xl text-[#8B949E] opacity-30 cursor-not-allowed border border-transparent"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setAgentToDelete(agent)}
                      title="Delete Agent"
                      aria-label={`Delete ${agent.name}`}
                      className="p-2 rounded-xl text-[#8B949E] hover:text-red-400 hover:bg-red-500/10 border border-transparent hover:border-red-500/30 transition-all cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {agentToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-[#161B22] border border-[#30363D] rounded-2xl p-6 shadow-2xl">
            <div className="flex items-center gap-3 text-red-400 mb-3">
              <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center justify-center">
                <AlertCircle className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Delete Agent?</h3>
                <p className="text-xs text-[#8B949E]">
                  This will remove the bot and local knowledge index.
                </p>
              </div>
            </div>

            <p className="text-xs text-[#8B949E] my-4 bg-[#0E1117] p-3 rounded-xl border border-[#30363D]">
              Are you sure you want to delete <strong className="text-white">{agentToDelete.name}</strong> ({agentToDelete.slug})?
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setAgentToDelete(null)}
                className="px-4 py-2 text-xs font-medium text-[#8B949E] hover:text-white rounded-xl hover:bg-[#30363D]/40 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(agentToDelete)}
                className="px-4 py-2 text-xs font-semibold bg-red-600 hover:bg-red-500 text-white rounded-xl shadow-lg shadow-red-600/20 transition-all"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Agent Modal */}
      <CreateAgentModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onAgentCreated={() => loadAgents()}
      />
    </div>
  );
}
