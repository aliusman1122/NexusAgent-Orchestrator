"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Layers, Shield } from "lucide-react";
import { PortalHeader } from "@/components/portal/PortalHeader";
import { HeroSection } from "@/components/portal/HeroSection";
import { AgentPlayground } from "@/components/portal/AgentPlayground";
import { FeaturePillars } from "@/components/portal/FeaturePillars";
import { ChatWidget } from "@/components/ChatWidget";
import { checkSystemHealth } from "@/services/api";
import { SystemHealthResponse } from "@/types/chat";

export default function Home() {
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
    const interval = setInterval(checkHealth, 20000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  const handleSmoothScroll = (e: React.MouseEvent<HTMLAnchorElement>, targetId: string) => {
    e.preventDefault();
    const element = document.getElementById(targetId);
    if (element) {
      const headerOffset = 70;
      const elementPosition = element.getBoundingClientRect().top + window.pageYOffset;
      window.scrollTo({
        top: Math.max(0, elementPosition - headerOffset),
        behavior: "smooth",
      });
    }
  };

  return (
    <main className="min-h-screen bg-slate-50 dark:bg-[#0E1117] text-slate-900 dark:text-[#E6EDF3] relative overflow-x-clip selection:bg-[#FF6A00] selection:text-white flex flex-col pt-16 transition-colors duration-200">
      {/* Background Accent Gradients & Grid Pattern */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[1200px] h-[500px] bg-gradient-to-b from-[#FF6A00]/10 via-[#FF6A00]/4 to-transparent blur-3xl pointer-events-none -z-10" />
      <div className="fixed inset-0 bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] dark:bg-[radial-gradient(#1f242c_1px,transparent_1px)] [background-size:32px_32px] pointer-events-none opacity-40 -z-10" />

      {/* Global Clean Glassmorphic Header (With Single Admin Button) */}
      <PortalHeader
        isBackendOnline={isBackendOnline}
        activeModel={health?.llm_model}
      />

      {/* Main SaaS Portal Content */}
      <div className="flex-1 flex flex-col">
        {/* Hero Section with Showcase Picture / Graphic */}
        <HeroSection health={health} isBackendOnline={isBackendOnline} />

        {/* 3 Core Product Capabilities Showcase */}
        <FeaturePillars />

        {/* Interactive Chat Sandbox / Live Demo */}
        <AgentPlayground />
      </div>

      {/* Simple, Clean SaaS Footer */}
      <footer className="border-t border-slate-200 dark:border-[#30363D] bg-white dark:bg-[#0A0D12] text-slate-600 dark:text-[#94A3B8] py-8 px-4 sm:px-6 lg:px-8 mt-12 transition-colors">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-[#FF6A00] to-[#E55F00] flex items-center justify-center text-white font-bold shadow-md shadow-[#FF6A00]/20">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <span className="font-bold text-sm text-slate-900 dark:text-white tracking-tight">
                NexusAgent Orchestrator
              </span>
              <span className="text-[11px] text-slate-400 dark:text-[#64748B] block font-mono">
                Enterprise Autonomous Multi-Agent Governance
              </span>
            </div>
          </div>

          <div className="flex items-center gap-6 text-xs font-medium">
            <a
              href="#overview"
              onClick={(e) => handleSmoothScroll(e, "overview")}
              className="hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
            >
              Overview
            </a>
            <a
              href="#features"
              onClick={(e) => handleSmoothScroll(e, "features")}
              className="hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
            >
              Capabilities
            </a>
            <a
              href="#playground"
              onClick={(e) => handleSmoothScroll(e, "playground")}
              className="hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
            >
              Live Demo
            </a>
            <Link
              href="/login"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#FF6A00] hover:text-[#FF8C38] transition-colors"
            >
              <Shield className="w-3.5 h-3.5" />
              <span>Admin Portal</span>
            </Link>
          </div>

          <div className="text-xs text-slate-400 dark:text-[#64748B] font-mono">
            &copy; {new Date().getFullYear()} NexusAgent. All rights reserved.
          </div>
        </div>
      </footer>

      {/* Ambient Floating Chat Widget Embed */}
      <ChatWidget />
    </main>
  );
}
