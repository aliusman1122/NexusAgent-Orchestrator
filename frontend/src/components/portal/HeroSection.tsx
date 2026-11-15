"use client";

import React from "react";
import {
  Sparkles,
  Bot,
  Database,
  Cpu,
  Code,
  CheckCircle2,
  ChevronDown,
  Layers,
  ShieldCheck,
  Zap,
  Clock,
  MessageSquare,
  ExternalLink,
} from "lucide-react";
import { SystemHealthResponse } from "@/types/chat";

interface HeroSectionProps {
  health?: SystemHealthResponse | null;
  isBackendOnline?: boolean | null;
}

export function HeroSection({ health }: HeroSectionProps) {
  const formattedModel = health?.llm_model
    ? health.llm_model.replace("openai/", "").replace("google/", "")
    : "Gemini 1.5 Flash";

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
    <section id="overview" className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 sm:pt-6 pb-10 scroll-mt-20">
      {/* 2-COLUMN MODERN SPLIT HERO LAYOUT */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-8 items-start">
        {/* LEFT COLUMN: Value Proposition, Headline & Key Benefits */}
        <div className="lg:col-span-6 text-left flex flex-col items-start">
          {/* Business-Friendly Top Pill (No technical jargon) */}
          <div className="inline-flex items-center gap-2.5 px-3.5 py-1 rounded-full bg-orange-50 dark:bg-[#161B22] border border-orange-200 dark:border-[#FF6A00]/30 text-xs text-[#FF6A00] font-bold mb-3 sm:mb-4 shadow-sm">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>YOUR BUSINESS&apos;S AI AGENT HUB — 24/7</span>
          </div>

          {/* Main Headline */}
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-slate-900 dark:text-white tracking-tight leading-[1.15]">
            Your Company&apos;s AI Agent Workforce —{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#FF6A00] via-[#FF8C38] to-[#FFB780]">
              Always Online, Always Accurate
            </span>
          </h1>

          {/* Simple Customer-Centric Subtitle */}
          <p className="mt-3 sm:mt-4 text-sm sm:text-base text-slate-600 dark:text-[#94A3B8] leading-relaxed font-normal">
            Transform your customer inquiries, sales support, and documents into an always-on, intelligent 
            AI assistant that answers questions accurately from your business data.
          </p>

          {/* 4 Feature Pills with Checkmarks (Sample Pic 3 & 4 style) */}
          <div className="mt-5 space-y-2.5 w-full">
            <div className="flex items-center gap-3 p-2.5 rounded-xl bg-white dark:bg-[#161B22]/80 border border-slate-200/80 dark:border-[#30363D] shadow-sm">
              <div className="w-7 h-7 rounded-lg bg-orange-500/10 flex items-center justify-center text-[#FF6A00] shrink-0">
                <Clock className="w-4 h-4" />
              </div>
              <span className="text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-200">
                24/7 Autonomous Customer Inquiries Handling
              </span>
            </div>

            <div className="flex items-center gap-3 p-2.5 rounded-xl bg-white dark:bg-[#161B22]/80 border border-slate-200/80 dark:border-[#30363D] shadow-sm">
              <div className="w-7 h-7 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-500 shrink-0">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <span className="text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-200">
                100% Verified Answers — Grounded in Your Exact Data
              </span>
            </div>

            <div className="flex items-center gap-3 p-2.5 rounded-xl bg-white dark:bg-[#161B22]/80 border border-slate-200/80 dark:border-[#30363D] shadow-sm">
              <div className="w-7 h-7 rounded-lg bg-sky-500/10 flex items-center justify-center text-sky-500 shrink-0">
                <Code className="w-4 h-4" />
              </div>
              <span className="text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-200">
                1-Line Code Embed for WordPress, Shopify, Wix &amp; HTML
              </span>
            </div>

            <div className="flex items-center gap-3 p-2.5 rounded-xl bg-white dark:bg-[#161B22]/80 border border-slate-200/80 dark:border-[#30363D] shadow-sm">
              <div className="w-7 h-7 rounded-lg bg-purple-500/10 flex items-center justify-center text-purple-500 shrink-0">
                <Zap className="w-4 h-4" />
              </div>
              <span className="text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-200">
                Multi-Model Engine Powered by Google Gemini &amp; Groq LPU
              </span>
            </div>
          </div>

          {/* Primary Visitor CTA with Smooth Sliding */}
          <div className="mt-6 flex items-center gap-4">
            <a
              href="#playground"
              onClick={(e) => handleSmoothScroll(e, "playground")}
              className="inline-flex items-center gap-2.5 px-6 py-3 rounded-xl bg-gradient-to-r from-[#FF6A00] to-[#E55F00] hover:from-[#FF7D20] hover:to-[#FF6A00] text-white font-bold text-sm sm:text-base shadow-xl shadow-[#FF6A00]/25 hover:shadow-[#FF6A00]/45 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 border border-white/20 cursor-pointer"
            >
              <Bot className="w-5 h-5 text-white" />
              <span>Test Live Interactive Assistant</span>
              <ChevronDown className="w-4 h-4 animate-bounce" />
            </a>
          </div>
        </div>

        {/* RIGHT COLUMN: Realistic 3D Perspective Visual Mockup (Matching Pic 3 & 4) */}
        <div className="lg:col-span-6 relative">
          {/* Ambient Colorful Glows */}
          <div className="absolute -top-12 -right-12 w-96 h-96 bg-[#FF6A00]/20 rounded-full blur-3xl pointer-events-none -z-10" />
          <div className="absolute -bottom-10 -left-10 w-80 h-80 bg-sky-500/15 rounded-full blur-3xl pointer-events-none -z-10" />

          {/* Main Desktop Monitor Frame */}
          <div className="relative rounded-2xl sm:rounded-3xl bg-white dark:bg-[#12161F] border border-slate-200 dark:border-[#30363D] shadow-2xl overflow-hidden transition-all duration-300 hover:shadow-[#FF6A00]/10">
            {/* macOS-style Top Bar */}
            <div className="px-4 py-3 bg-slate-100/90 dark:bg-[#0E1117] border-b border-slate-200 dark:border-[#21262D] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-rose-500 inline-block" />
                <span className="w-3 h-3 rounded-full bg-amber-500 inline-block" />
                <span className="w-3 h-3 rounded-full bg-emerald-500 inline-block" />
                <span className="ml-2 text-xs font-mono font-medium text-slate-500 dark:text-[#8B949E]">
                  NexusAgent Studio — Enterprise Dashboard
                </span>
              </div>
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-mono font-bold">
                ● ONLINE
              </span>
            </div>

            {/* Dashboard Mockup Content */}
            <div className="p-4 sm:p-5 space-y-3.5 bg-slate-50/50 dark:bg-[#12161F]">
              {/* Top Stats Cards Row */}
              <div className="grid grid-cols-3 gap-2.5 text-left">
                <div className="p-2.5 rounded-xl bg-white dark:bg-[#161B22] border border-slate-200 dark:border-[#30363D] shadow-xs">
                  <span className="text-[10px] text-slate-400 dark:text-[#8B949E] block uppercase font-mono">
                    Conversations
                  </span>
                  <span className="text-base sm:text-lg font-bold text-slate-900 dark:text-white font-mono">
                    1,248
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-white dark:bg-[#161B22] border border-slate-200 dark:border-[#30363D] shadow-xs">
                  <span className="text-[10px] text-slate-400 dark:text-[#8B949E] block uppercase font-mono">
                    Grounding
                  </span>
                  <span className="text-base sm:text-lg font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                    99.8%
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-white dark:bg-[#161B22] border border-slate-200 dark:border-[#30363D] shadow-xs">
                  <span className="text-[10px] text-slate-400 dark:text-[#8B949E] block uppercase font-mono">
                    Active Agent
                  </span>
                  <span className="text-base sm:text-lg font-bold text-[#FF6A00] font-mono">
                    Ready
                  </span>
                </div>
              </div>

              {/* Active Agent & RAG Pipeline Card */}
              <div className="p-3.5 rounded-xl bg-white dark:bg-[#161B22] border border-slate-200 dark:border-[#30363D] text-left">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#FF6A00] to-[#E55F00] flex items-center justify-center text-white">
                      <Bot className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                        NexusAgent Core Assistant
                      </h4>
                      <span className="text-[10px] text-slate-500 dark:text-[#8B949E]">
                        Knowledge: 21 ChromaDB Chunks
                      </span>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-[10px] font-mono text-emerald-600 dark:text-emerald-400 font-bold">
                    ACTIVE
                  </span>
                </div>

                <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-[#21262D] flex items-center justify-between text-[11px] text-slate-500 dark:text-[#8B949E]">
                  <span className="font-mono">Inference Engine:</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">{formattedModel}</span>
                </div>
              </div>

              {/* Floating Perspective Live Chat Bubble (Simulating Real Chat Widget) */}
              <div className="p-3.5 rounded-xl bg-gradient-to-r from-orange-500/10 via-amber-500/5 to-transparent border border-orange-500/20 text-left relative">
                <div className="flex items-start gap-2.5">
                  <div className="w-6 h-6 rounded-full bg-[#FF6A00] flex items-center justify-center text-white text-[10px] font-bold shrink-0 mt-0.5">
                    AI
                  </div>
                  <div className="space-y-1.5 flex-1">
                    <p className="text-xs text-slate-800 dark:text-slate-200 leading-relaxed font-medium">
                      &quot;Hello! How can I assist you with our services and pricing today?&quot;
                    </p>
                    <div className="flex items-center gap-2 text-[10px] text-emerald-600 dark:text-emerald-400 font-mono">
                      <CheckCircle2 className="w-3 h-3" />
                      <span>Verified from uploaded knowledge base</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
