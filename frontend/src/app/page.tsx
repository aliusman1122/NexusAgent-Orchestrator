"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Layers, ArrowRight, Bot } from "lucide-react";
import { PortalHeader } from "@/components/portal/PortalHeader";
import { HeroSection } from "@/components/portal/HeroSection";
import { AgentPlayground } from "@/components/portal/AgentPlayground";
import { FeaturePillars } from "@/components/portal/FeaturePillars";
import { ChatWidget } from "@/components/ChatWidget";
import { AdminAlertsModal } from "@/components/AdminAlertsModal";
import { checkSystemHealth } from "@/services/api";
import { SystemHealthResponse } from "@/types/chat";

export default function Home() {
  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const [health, setHealth] = useState<SystemHealthResponse | null>(null);
  const [isBackendOnline, setIsBackendOnline] = useState<boolean | null>(null);

  useEffect(() => {
    let isMounted = true;

    const checkHealth = async () => {
      try {
        const data = await checkSystemHealth();
        if (isMounted) {
          setHealth(data);
          setIsBackendOnline(true);
        }
      } catch {
        if (isMounted) {
          setIsBackendOnline(false);
        }
      }
    };

    checkHealth();
    const interval = setInterval(checkHealth, 15000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  return (
    <main className="min-h-screen bg-[#0E1117] text-[#E6EDF3] relative overflow-hidden selection:bg-[#FF6A00] selection:text-white flex flex-col">
      {/* Background Accent Gradients & Grid Pattern */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[1200px] h-[500px] bg-gradient-to-b from-[#FF6A00]/10 via-[#FF6A00]/4 to-transparent blur-3xl pointer-events-none -z-10" />
      <div className="fixed inset-0 bg-[radial-gradient(#1f242c_1px,transparent_1px)] [background-size:32px_32px] pointer-events-none opacity-40 -z-10" />

      {/* Global Glassmorphic Header */}
      <PortalHeader
        isBackendOnline={isBackendOnline}
        onOpenAlerts={() => setIsAdminOpen(true)}
        activeModel={health?.llm_model}
      />

      {/* Main SaaS Portal Content */}
      <div className="flex-1 flex flex-col">
        {/* Hero Section with Live Telemetry */}
        <HeroSection health={health} isBackendOnline={isBackendOnline} />

        {/* Agnostic Agent Playground / Interactive Sandbox */}
        <AgentPlayground />

        {/* Core Product Pillars Showcase */}
        <FeaturePillars />

        {/* Call-to-Action Enterprise Banner */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 w-full">
          <div className="max-w-5xl mx-auto rounded-3xl bg-gradient-to-r from-[#161B22] via-[#1A212C] to-[#161B22] border border-[#FF6A00]/30 p-8 sm:p-12 text-center relative overflow-hidden shadow-2xl">
            <div className="absolute -top-24 -right-24 w-64 h-64 bg-[#FF6A00]/15 rounded-full blur-3xl pointer-events-none" />
            <div className="relative z-10 max-w-2xl mx-auto">
              <span className="px-3 py-1 rounded-full text-xs font-mono font-semibold bg-[#FF6A00]/20 text-[#FF6A00] border border-[#FF6A00]/40">
                READY FOR PRODUCTION
              </span>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-white mt-4 tracking-tight">
                Scale Multi-Agent Intelligence With Confidence
              </h2>
              <p className="mt-3 text-sm sm:text-base text-[#94A3B8] leading-relaxed">
                Connect your enterprise knowledge base, configure tone and guardrails, and 
                deploy self-governing agents in minutes.
              </p>
              <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
                <Link
                  href="/admin"
                  className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-gradient-to-r from-[#FF6A00] to-[#E55F00] hover:from-[#FF7D20] hover:to-[#FF6A00] text-white font-bold text-sm shadow-xl shadow-[#FF6A00]/30 hover:shadow-[#FF6A00]/50 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 border border-white/20"
                >
                  <Bot className="w-4 h-4" />
                  <span>Open Admin Console</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
                <Link
                  href="/admin/agents"
                  className="inline-flex items-center gap-2 px-5 py-3.5 rounded-xl bg-[#161B22] hover:bg-[#1F242C] text-[#CBD5E1] hover:text-white font-semibold text-sm border border-[#30363D] hover:border-[#FF6A00]/40 transition-all"
                >
                  <span>Explore Agent Studio</span>
                </Link>
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* Enterprise Global Portal Footer */}
      <footer className="border-t border-[#30363D] bg-[#0A0D12] text-[#94A3B8] py-12 px-4 sm:px-6 lg:px-8 mt-12">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-[#FF6A00] to-[#E55F00] flex items-center justify-center text-white font-bold shadow-md shadow-[#FF6A00]/20">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <span className="font-bold text-white tracking-tight">NexusAgent Orchestrator</span>
              <span className="text-xs text-[#64748B] block font-mono">
                Enterprise Multi-Agent Governance & Stateful RAG
              </span>
            </div>
          </div>

          {/* Quick Jump Links */}
          <div className="flex flex-wrap items-center gap-6 text-xs font-medium">
            <a href="#playground" className="hover:text-white transition-colors">
              Playground
            </a>
            <a href="#pillars" className="hover:text-white transition-colors">
              Pillars
            </a>
            <a href="#telemetry" className="hover:text-white transition-colors">
              Telemetry
            </a>
            <Link href="/admin/agents" className="hover:text-[#FF6A00] transition-colors">
              Agent Studio
            </Link>
            <Link href="/admin/settings" className="hover:text-[#FF6A00] transition-colors">
              Settings & Quota
            </Link>
          </div>

          {/* Copyright & Engine Tag */}
          <div className="text-xs text-[#64748B] text-center md:text-right font-mono">
            <span>FastAPI • LangGraph • ChromaDB • PostgreSQL</span>
          </div>
        </div>
      </footer>

      {/* Ambient Floating Chat Widget Embed */}
      <ChatWidget />

      {/* Unresolved Admin Alerts Inspector Modal */}
      <AdminAlertsModal isOpen={isAdminOpen} onClose={() => setIsAdminOpen(false)} />
    </main>
  );
}
