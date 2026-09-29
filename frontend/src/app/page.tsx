"use client";

import React, { useState, useEffect } from "react";
import {
  Code2,
  Smartphone,
  Cpu,
  ShieldCheck,
  ArrowRight,
  Sparkles,
  Server,
  Layers,
  Database,
  BellRing,
  ExternalLink,
} from "lucide-react";
import { ChatWidget } from "@/components/ChatWidget";
import { AdminAlertsModal } from "@/components/AdminAlertsModal";
import { checkSystemHealth } from "@/services/api";
import { SystemHealthResponse } from "@/types/chat";

export default function Home() {
  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const [health, setHealth] = useState<SystemHealthResponse | null>(null);
  const [isBackendOnline, setIsBackendOnline] = useState<boolean | null>(null);

  useEffect(() => {
    const checkHealth = async () => {
      try {
        const data = await checkSystemHealth();
        setHealth(data);
        setIsBackendOnline(true);
      } catch {
        setIsBackendOnline(false);
      }
    };

    checkHealth();
    const interval = setInterval(checkHealth, 15000);
    return () => clearInterval(interval);
  }, []);

  return (
    <main className="min-h-screen bg-[#0E1117] text-[#E6EDF3] relative overflow-hidden selection:bg-[#FF6A00] selection:text-white">
      {/* Background Accent Gradients */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[400px] bg-gradient-to-b from-[#FF6A00]/10 via-[#FF6A00]/5 to-transparent blur-3xl pointer-events-none" />

      {/* Navigation Header */}
      <header className="border-b border-[#30363D] bg-[#0E1117]/80 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#FF6A00] to-[#E55F00] flex items-center justify-center font-black text-white text-sm shadow-lg shadow-[#FF6A00]/25">
              A7
            </div>
            <div>
              <span className="font-bold text-lg text-white tracking-tight">A7 LOGICS</span>
              <span className="ml-2 text-xs text-[#94A3B8] font-mono hidden sm:inline">
                ENTERPRISE AI SUITE
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Backend Connectivity Status Badge */}
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-[#161B22] border border-[#30363D] text-xs font-medium">
              <span
                className={`w-2 h-2 rounded-full ${
                  isBackendOnline === true
                    ? "bg-emerald-400 shadow-sm shadow-emerald-400 animate-pulse"
                    : isBackendOnline === false
                    ? "bg-red-400"
                    : "bg-amber-400"
                }`}
              />
              <span className="text-[#94A3B8]">
                FastAPI Backend:{" "}
                <strong className={isBackendOnline ? "text-emerald-400" : "text-amber-400"}>
                  {isBackendOnline === true ? "Online (8000)" : isBackendOnline === false ? "Offline" : "Checking..."}
                </strong>
              </span>
            </div>

            {/* Admin Alerts Button */}
            <button
              onClick={() => setIsAdminOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#161B22] hover:bg-[#1F242C] text-xs text-[#CBD5E1] hover:text-[#FF6A00] border border-[#30363D] hover:border-[#FF6A00]/40 transition-colors"
            >
              <BellRing className="w-3.5 h-3.5 text-[#FF6A00]" />
              <span>Admin Alerts</span>
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-6 pt-16 pb-12 text-center relative z-10">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#161B22] border border-[#FF6A00]/30 text-xs text-[#FF6A00] font-medium mb-6 shadow-sm">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Production-Grade LangGraph RAG + Next.js Client Widget</span>
        </div>

        <h1 className="text-4xl sm:text-6xl font-extrabold text-white tracking-tight leading-tight max-w-4xl mx-auto">
          Intelligent Client Interactions Grounded in{" "}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#FF6A00] via-[#FF8C38] to-[#FFA96B]">
            Enterprise Knowledge
          </span>
        </h1>

        <p className="mt-6 text-base sm:text-lg text-[#94A3B8] max-w-2xl mx-auto leading-relaxed">
          Welcome to the migrated A7 Logics AI Assistant. Powered by a headless FastAPI LangGraph pipeline
          and an embeddable Next.js floating chat bubble with strict factual grounding and automated admin escalations.
        </p>

        {/* Live System Specs Cards */}
        <div className="mt-12 grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto">
          <div className="p-4 rounded-xl bg-[#161B22] border border-[#30363D] text-left">
            <div className="flex items-center justify-between text-[#94A3B8] text-xs">
              <span>Vector Chunks</span>
              <Database className="w-4 h-4 text-[#FF6A00]" />
            </div>
            <div className="text-2xl font-bold text-white mt-1">
              {health?.indexed_chunks ?? 21}
            </div>
            <p className="text-[11px] text-[#64748B] mt-1">ChromaDB Collection</p>
          </div>

          <div className="p-4 rounded-xl bg-[#161B22] border border-[#30363D] text-left">
            <div className="flex items-center justify-between text-[#94A3B8] text-xs">
              <span>Grounding LLM</span>
              <Cpu className="w-4 h-4 text-[#38BDF8]" />
            </div>
            <div className="text-sm font-bold text-white mt-2 truncate" title={health?.llm_model}>
              {health?.llm_model ? health.llm_model.replace("openai/", "") : "GPT-OSS-120B"}
            </div>
            <p className="text-[11px] text-[#64748B] mt-1">Structured QA Evaluator</p>
          </div>

          <div className="p-4 rounded-xl bg-[#161B22] border border-[#30363D] text-left">
            <div className="flex items-center justify-between text-[#94A3B8] text-xs">
              <span>Database Engine</span>
              <Server className="w-4 h-4 text-[#10B981]" />
            </div>
            <div className="text-base font-bold text-white mt-1">
              {health?.database ?? "SQLite Engine"}
            </div>
            <p className="text-[11px] text-[#64748B] mt-1">unanswered_logs Table</p>
          </div>

          <div className="p-4 rounded-xl bg-[#161B22] border border-[#30363D] text-left">
            <div className="flex items-center justify-between text-[#94A3B8] text-xs">
              <span>Escalation Rule</span>
              <ShieldCheck className="w-4 h-4 text-[#F59E0B]" />
            </div>
            <div className="text-2xl font-bold text-white mt-1">3 Strikes</div>
            <p className="text-[11px] text-[#64748B] mt-1">Automated Admin Alert</p>
          </div>
        </div>
      </section>

      {/* Services Grid Section */}
      <section className="max-w-7xl mx-auto px-6 py-12">
        <div className="text-center mb-10">
          <h2 className="text-2xl font-bold text-white tracking-tight">
            A7 Logics Core Engineering Capabilities
          </h2>
          <p className="text-xs text-[#94A3B8] mt-1">
            All services below are indexed in the knowledge base and retrievable via the chat widget.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {/* Card 1 */}
          <div className="p-6 rounded-2xl bg-[#161B22] border border-[#30363D] hover:border-[#FF6A00]/50 transition-all group">
            <div className="w-10 h-10 rounded-xl bg-[#FF6A00]/10 border border-[#FF6A00]/20 flex items-center justify-center text-[#FF6A00] mb-4">
              <Code2 className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold text-white group-hover:text-[#FF6A00] transition-colors">
              Full-Stack Web Engineering
            </h3>
            <p className="mt-2 text-xs text-[#94A3B8] leading-relaxed">
              React, Next.js, Node.js, Python, TypeScript, and cloud-native backends engineered with enterprise security and microservices architecture.
            </p>
            <div className="mt-4 pt-4 border-t border-[#30363D]/60 flex items-center gap-2 text-xs text-[#FF6A00] font-medium">
              <span>6-Step Agile Development</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </div>
          </div>

          {/* Card 2 */}
          <div className="p-6 rounded-2xl bg-[#161B22] border border-[#30363D] hover:border-[#FF6A00]/50 transition-all group">
            <div className="w-10 h-10 rounded-xl bg-[#FF6A00]/10 border border-[#FF6A00]/20 flex items-center justify-center text-[#FF6A00] mb-4">
              <Smartphone className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold text-white group-hover:text-[#FF6A00] transition-colors">
              Cross-Platform Mobile Apps
            </h3>
            <p className="mt-2 text-xs text-[#94A3B8] leading-relaxed">
              Native and hybrid mobile applications built on Flutter and React Native with offline caching, push notifications, and App Store compliance.
            </p>
            <div className="mt-4 pt-4 border-t border-[#30363D]/60 flex items-center gap-2 text-xs text-[#FF6A00] font-medium">
              <span>iOS & Android Optimization</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </div>
          </div>

          {/* Card 3 */}
          <div className="p-6 rounded-2xl bg-[#161B22] border border-[#30363D] hover:border-[#FF6A00]/50 transition-all group">
            <div className="w-10 h-10 rounded-xl bg-[#FF6A00]/10 border border-[#FF6A00]/20 flex items-center justify-center text-[#FF6A00] mb-4">
              <Layers className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold text-white group-hover:text-[#FF6A00] transition-colors">
              Enterprise AI & RAG Solutions
            </h3>
            <p className="mt-2 text-xs text-[#94A3B8] leading-relaxed">
              LangGraph-compiled state workflows, vector retrieval deduplication, hallucination prevention, and automated administrative intelligence.
            </p>
            <div className="mt-4 pt-4 border-t border-[#30363D]/60 flex items-center gap-2 text-xs text-[#FF6A00] font-medium">
              <span>Grounded QA Verification</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </div>
          </div>
        </div>
      </section>

      {/* Floating Chat Widget Embed */}
      <ChatWidget />

      {/* Admin Alerts Inspector Modal */}
      <AdminAlertsModal isOpen={isAdminOpen} onClose={() => setIsAdminOpen(false)} />
    </main>
  );
}
