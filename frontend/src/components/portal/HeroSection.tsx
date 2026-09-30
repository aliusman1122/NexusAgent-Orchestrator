"use client";

import React from "react";
import Link from "next/link";
import {
  Sparkles,
  ArrowRight,
  Database,
  Cpu,
  Server,
  ShieldCheck,
  Bot,
  Activity,
  Terminal,
} from "lucide-react";
import { SystemHealthResponse } from "@/types/chat";

interface HeroSectionProps {
  health: SystemHealthResponse | null;
  isBackendOnline: boolean | null;
}

export function HeroSection({ health, isBackendOnline }: HeroSectionProps) {
  const formattedModel = health?.llm_model
    ? health.llm_model.replace("openai/", "").replace("google/", "")
    : "GPT-OSS-120B";

  const dbStatus = health?.database || "PostgreSQL";

  return (
    <section className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-14 text-center">
      {/* Top Value Badge */}
      <div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-[#161B22]/90 border border-[#FF6A00]/30 text-xs text-[#FF6A00] font-semibold mb-8 shadow-md shadow-[#FF6A00]/10 hover:border-[#FF6A00]/60 transition-colors cursor-default">
        <Sparkles className="w-3.5 h-3.5 animate-spin [animation-duration:6s]" />
        <span>Enterprise Multi-Agent Orchestrator • Stateful LangGraph RAG</span>
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse ml-1" />
      </div>

      {/* Main Punchy Value Headline */}
      <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold text-white tracking-tight leading-[1.1] max-w-5xl mx-auto">
        Orchestrate Autonomous Agents Grounded in{" "}
        <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#FF6A00] via-[#FF8C38] to-[#FFB780]">
          Verified Enterprise Knowledge
        </span>
      </h1>

      {/* Value Proposition Description */}
      <p className="mt-6 text-base sm:text-xl text-[#94A3B8] max-w-3xl mx-auto leading-relaxed font-normal">
        NexusAgent Orchestrator coordinates multi-tenant vector retrieval, deterministic 
        factual grounding guardrails, and automated administrative escalations across 
        hybrid database infrastructures.
      </p>

      {/* Primary Action Buttons */}
      <div className="mt-9 flex flex-wrap items-center justify-center gap-4">
        <Link
          href="/admin"
          className="inline-flex items-center gap-2.5 px-6 py-3.5 rounded-xl bg-gradient-to-r from-[#FF6A00] to-[#E55F00] hover:from-[#FF7D20] hover:to-[#FF6A00] text-white font-bold text-sm sm:text-base shadow-xl shadow-[#FF6A00]/30 hover:shadow-[#FF6A00]/50 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 border border-white/20"
        >
          <Bot className="w-5 h-5" />
          <span>Launch Management Console</span>
          <ArrowRight className="w-4 h-4" />
        </Link>

        <a
          href="#playground"
          className="inline-flex items-center gap-2 px-5 py-3.5 rounded-xl bg-[#161B22] hover:bg-[#1F242C] text-[#CBD5E1] hover:text-white font-semibold text-sm sm:text-base border border-[#30363D] hover:border-[#FF6A00]/40 transition-all shadow-md hover:scale-[1.01]"
        >
          <Terminal className="w-4 h-4 text-[#FF6A00]" />
          <span>Test Live Playground</span>
        </a>
      </div>

      {/* Live Operational Metrics & Telemetry Grid */}
      <div id="telemetry" className="mt-14 pt-8 border-t border-[#30363D]/60 max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-4 px-1">
          <div className="flex items-center gap-2 text-xs font-mono text-[#94A3B8]">
            <Activity className="w-3.5 h-3.5 text-[#FF6A00]" />
            <span>REAL-TIME ENGINE TELEMETRY</span>
          </div>
          <span className="text-[11px] font-mono text-[#64748B]">
            Status: {isBackendOnline ? "Verified Synchronized" : "Connecting to Gateway"}
          </span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
          {/* Card 1: Vector Chunks */}
          <div className="p-4 rounded-2xl bg-[#161B22]/90 border border-[#30363D] hover:border-[#FF6A00]/40 transition-all text-left group">
            <div className="flex items-center justify-between text-[#94A3B8] text-xs">
              <span className="font-medium">Vector Chunks</span>
              <Database className="w-4 h-4 text-[#FF6A00] group-hover:scale-110 transition-transform" />
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-white mt-1.5 font-mono">
              {health?.indexed_chunks ?? 21}
            </div>
            <p className="text-[11px] text-[#64748B] mt-1 truncate">ChromaDB Collection</p>
          </div>

          {/* Card 2: Inference Model */}
          <div className="p-4 rounded-2xl bg-[#161B22]/90 border border-[#30363D] hover:border-[#38BDF8]/40 transition-all text-left group">
            <div className="flex items-center justify-between text-[#94A3B8] text-xs">
              <span className="font-medium">Inference Engine</span>
              <Cpu className="w-4 h-4 text-[#38BDF8] group-hover:scale-110 transition-transform" />
            </div>
            <div
              className="text-base sm:text-lg font-bold text-white mt-2 truncate font-mono"
              title={health?.llm_model}
            >
              {formattedModel}
            </div>
            <p className="text-[11px] text-[#64748B] mt-1 truncate">Zero-Shot RAG Evaluator</p>
          </div>

          {/* Card 3: Storage Layer */}
          <div className="p-4 rounded-2xl bg-[#161B22]/90 border border-[#30363D] hover:border-[#10B981]/40 transition-all text-left group">
            <div className="flex items-center justify-between text-[#94A3B8] text-xs">
              <span className="font-medium">Knowledge Store</span>
              <Server className="w-4 h-4 text-[#10B981] group-hover:scale-110 transition-transform" />
            </div>
            <div className="text-base sm:text-lg font-bold text-white mt-2 font-mono">
              {dbStatus}
            </div>
            <p className="text-[11px] text-[#64748B] mt-1 truncate">PostgreSQL + ChromaDB</p>
          </div>

          {/* Card 4: Governance Escalation */}
          <div className="p-4 rounded-2xl bg-[#161B22]/90 border border-[#30363D] hover:border-[#F59E0B]/40 transition-all text-left group">
            <div className="flex items-center justify-between text-[#94A3B8] text-xs">
              <span className="font-medium">Escalation Policy</span>
              <ShieldCheck className="w-4 h-4 text-[#F59E0B] group-hover:scale-110 transition-transform" />
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-white mt-1.5 font-mono">
              3 Strikes
            </div>
            <p className="text-[11px] text-[#64748B] mt-1 truncate">Automated Admin Alerts</p>
          </div>
        </div>
      </div>
    </section>
  );
}
