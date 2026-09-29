"use client";

import React, { useEffect, useState, useCallback } from "react";
import {
  Activity,
  AlertCircle,
  CheckCircle2,
  Cpu,
  DollarSign,
  Globe,
  RefreshCw,
  Zap,
} from "lucide-react";
import { fetchProviderLimits } from "@/services/api";
import { ProviderLimitsResponse } from "@/types/chat";

interface LiveProviderQuotaCardProps {
  className?: string;
}

export function LiveProviderQuotaCard({ className = "" }: LiveProviderQuotaCardProps) {
  const [data, setData] = useState<ProviderLimitsResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadLimits = useCallback(async (isManual = false) => {
    if (isManual) {
      setIsSyncing(true);
    }
    try {
      const res = await fetchProviderLimits();
      setData(res);
      setLastUpdated(new Date());
      setError(null);
    } catch (err: any) {
      console.warn("Failed to fetch provider limits:", err);
      setError(err?.message || "Failed to reach inference telemetry endpoint");
    } finally {
      setLoading(false);
      if (isManual) {
        setTimeout(() => setIsSyncing(false), 500);
      }
    }
  }, []);

  useEffect(() => {
    loadLimits(false);
    // Auto-refresh every 30 seconds
    const interval = setInterval(() => {
      loadLimits(false);
    }, 30000);
    return () => clearInterval(interval);
  }, [loadLimits]);

  // Derived Groq metrics
  const groq = data?.groq;
  const groqRemaining = groq?.remaining_tokens ?? 6000;
  const groqLimit = groq?.limit_tokens ?? 6000;
  const groqPercent = groqLimit > 0 ? Math.min(100, Math.max(0, (groqRemaining / groqLimit) * 100)) : 100;

  // Derived OpenRouter metrics
  const openrouter = data?.openrouter;
  const orUsage = openrouter?.usage ?? 0.0;
  const orLimit = openrouter?.limit;
  const orIsFree = openrouter?.is_free_tier;

  return (
    <div
      className={`rounded-2xl bg-gradient-to-br from-[#161B22] to-[#0E1117] border border-[#30363D] p-5 shadow-xl shadow-black/25 flex flex-col gap-4 ${className}`}
    >
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#30363D]/60">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-[#FF6A00]/10 border border-[#FF6A00]/30 flex items-center justify-center text-[#FF6A00]">
            <Activity className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-white tracking-wide">
                Live Provider Quota & Rate Limits
              </h3>
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Live 30s
              </span>
            </div>
            <p className="text-xs text-[#8B949E]">
              Real-time inference telemetry from Groq LPUs and OpenRouter Gateway
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          {lastUpdated && (
            <span className="text-[11px] text-[#8B949E] font-mono hidden md:inline">
              Updated: {lastUpdated.toLocaleTimeString()}
            </span>
          )}
          <button
            type="button"
            onClick={() => loadLimits(true)}
            disabled={isSyncing || loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0E1117] hover:bg-[#1C2128] text-xs font-semibold text-[#FF6A00] border border-[#FF6A00]/30 transition-all active:scale-95 disabled:opacity-50 cursor-pointer shadow-sm"
            title="Force refresh live quota from upstream provider APIs"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${isSyncing ? "animate-spin" : ""}`}
            />
            <span>{isSyncing ? "Syncing..." : "Sync Provider API"}</span>
          </button>
        </div>
      </div>

      {error && !data && (
        <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-400 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* 2-Column Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Column 1: Groq LPUs */}
        <div className="p-4 rounded-xl bg-[#0E1117]/80 border border-[#30363D] flex flex-col justify-between gap-3.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                <Zap className="w-4 h-4" />
              </div>
              <div>
                <span className="text-xs font-bold text-white tracking-wide">
                  Groq Cloud LPU
                </span>
                <span className="text-[10px] text-[#8B949E] block">
                  Ultra-Fast Inference
                </span>
              </div>
            </div>

            {groq?.status === "active" ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                <CheckCircle2 className="w-3 h-3" />
                Active
              </span>
            ) : groq?.configured ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/30">
                <AlertCircle className="w-3 h-3" />
                API Error
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-800 text-slate-400 border border-slate-700">
                Not Configured
              </span>
            )}
          </div>

          {/* Tokens Per Minute Live Bar */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-baseline justify-between text-xs">
              <span className="text-[#8B949E] font-medium">Remaining Tokens / Min:</span>
              <span className="font-mono font-bold text-emerald-400">
                {groqRemaining.toLocaleString()}{" "}
                <span className="text-[#8B949E] font-normal">/ {groqLimit.toLocaleString()} TPM</span>
              </span>
            </div>
            <div className="w-full h-2 rounded-full bg-[#161B22] overflow-hidden border border-[#30363D]">
              <div
                className="h-full bg-gradient-to-r from-emerald-500 via-teal-400 to-[#FF6A00] rounded-full transition-all duration-500"
                style={{ width: `${groqPercent}%` }}
              />
            </div>
          </div>

          {/* Static / Header Chips */}
          <div className="grid grid-cols-3 gap-2 pt-1">
            <div className="p-2 rounded-lg bg-[#161B22]/70 border border-[#30363D]/70 text-center">
              <span className="text-[10px] text-[#8B949E] block">Daily Quota</span>
              <span className="text-xs font-mono font-bold text-white">100k TPD</span>
            </div>
            <div className="p-2 rounded-lg bg-[#161B22]/70 border border-[#30363D]/70 text-center">
              <span className="text-[10px] text-[#8B949E] block">Rate Limit</span>
              <span className="text-xs font-mono font-bold text-white">
                {groq?.remaining_requests ?? 30} RPM
              </span>
            </div>
            <div className="p-2 rounded-lg bg-[#161B22]/70 border border-[#30363D]/70 text-center">
              <span className="text-[10px] text-[#8B949E] block">LPU Speed</span>
              <span className="text-xs font-mono font-bold text-amber-400">~500 t/s</span>
            </div>
          </div>
        </div>

        {/* Column 2: OpenRouter */}
        <div className="p-4 rounded-xl bg-[#0E1117]/80 border border-[#30363D] flex flex-col justify-between gap-3.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400">
                <Globe className="w-4 h-4" />
              </div>
              <div>
                <span className="text-xs font-bold text-white tracking-wide">
                  OpenRouter Gateway
                </span>
                <span className="text-[10px] text-[#8B949E] block truncate max-w-[140px]">
                  {openrouter?.label || "Frontier Model Hub"}
                </span>
              </div>
            </div>

            {openrouter?.status === "active" ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                <CheckCircle2 className="w-3 h-3" />
                {orIsFree ? "Free Tier" : "Pay-As-You-Go"}
              </span>
            ) : openrouter?.configured ? (
              <span
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/30"
                title={openrouter?.message || "OpenRouter Key Status"}
              >
                <AlertCircle className="w-3 h-3" />
                {openrouter.status_code === 401 ? "Unauthorized Key" : "Standby"}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-800 text-slate-400 border border-slate-700">
                Not Configured
              </span>
            )}
          </div>

          {/* Usage & Credit Limit */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-baseline justify-between text-xs">
              <span className="text-[#8B949E] font-medium">USD Usage / Balance:</span>
              <span className="font-mono font-bold text-cyan-400">
                ${orUsage.toFixed(4)} USD{" "}
                <span className="text-[#8B949E] font-normal">
                  {orLimit !== null && orLimit !== undefined
                    ? `/ $${orLimit.toFixed(2)} limit`
                    : "(Unlimited)"}
                </span>
              </span>
            </div>
            <div className="w-full h-2 rounded-full bg-[#161B22] overflow-hidden border border-[#30363D]">
              <div
                className="h-full bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 rounded-full transition-all duration-500"
                style={{
                  width: orLimit && orLimit > 0
                    ? `${Math.min(100, Math.max(2, (orUsage / orLimit) * 100))}%`
                    : "100%",
                }}
              />
            </div>
          </div>

          {/* OpenRouter Chips */}
          <div className="grid grid-cols-3 gap-2 pt-1">
            <div className="p-2 rounded-lg bg-[#161B22]/70 border border-[#30363D]/70 text-center">
              <span className="text-[10px] text-[#8B949E] block">Frontier Access</span>
              <span className="text-xs font-mono font-bold text-white">Claude & GPT</span>
            </div>
            <div className="p-2 rounded-lg bg-[#161B22]/70 border border-[#30363D]/70 text-center">
              <span className="text-[10px] text-[#8B949E] block">Rate Limit</span>
              <span className="text-xs font-mono font-bold text-white">
                {openrouter?.rate_limit?.requests
                  ? `${openrouter.rate_limit.requests} / ${openrouter.rate_limit.interval || "10s"}`
                  : "20-50 Req/Day"}
              </span>
            </div>
            <div className="p-2 rounded-lg bg-[#161B22]/70 border border-[#30363D]/70 text-center">
              <span className="text-[10px] text-[#8B949E] block">Billing Tier</span>
              <span className="text-xs font-mono font-bold text-purple-400">
                {orIsFree ? "Free Pool" : "Tier 1"}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
