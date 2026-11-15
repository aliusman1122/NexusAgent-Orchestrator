"use client";

import React from "react";
import {
  Database,
  Cpu,
  Code2,
  CheckCircle2,
} from "lucide-react";

interface PillarItem {
  id: string;
  icon: React.ComponentType<{ className?: string }>;
  iconColor: string;
  title: string;
  badge: string;
  summary: string;
  bullets: string[];
}

const PILLARS: PillarItem[] = [
  {
    id: "kb-sync",
    icon: Database,
    iconColor: "text-[#FF6A00]",
    title: "Multi-Source Knowledge RAG",
    badge: "ChromaDB + PostgreSQL",
    summary:
      "Enterprise document ingestion across PDFs, Word DOCX, text notes, and website URLs with automated vector chunking and deduplication.",
    bullets: [
      "Per-tenant collection isolation with zero cross-tenant contamination",
      "Real-time chunk preview and human verification before indexing",
      "Instant ChromaDB semantic search with cosine similarity scoring",
    ],
  },
  {
    id: "ai-inference",
    icon: Cpu,
    iconColor: "text-[#0094C6]",
    title: "Universal & Dedicated AI (BYOK)",
    badge: "Multi-Model Hub",
    summary:
      "Run agents on platform-managed inference or provide client-specific API keys for dedicated Google Gemini, Groq Cloud, or Claude models.",
    bullets: [
      "Ultra-fast inference via Groq LPU and Google Gemini 1.5/2.0",
      "Client BYOK toggle allowing tenants to use their own private quotas",
      "Automated fallback to platform universal model if key is unset",
    ],
  },
  {
    id: "widget-embed",
    icon: Code2,
    iconColor: "text-emerald-500",
    title: "1-Line Embeddable Widget",
    badge: "< 5 KB Pure Vanilla JS",
    summary:
      "Embed a floating, reactive AI assistant on WordPress, Wix, Squarespace, Shopify, or plain HTML by pasting a single script tag.",
    bullets: [
      "Bi-directional window.postMessage dynamic resizing (no click blocking)",
      "Dedicated SSR iframe with transparent background & custom position",
      "Instant brand synchronization whenever agent tone or greeting changes",
    ],
  },
];

export function FeaturePillars() {
  return (
    <section id="features" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 sm:pt-6 pb-12 scroll-mt-16">
      {/* Section Header */}
      <div className="text-center max-w-3xl mx-auto mb-6 sm:mb-8">
        <span className="text-xs font-mono font-semibold uppercase tracking-wider text-[#FF6A00] bg-[#FF6A00]/10 border border-[#FF6A00]/25 px-3 py-1 rounded-full">
          Core Capabilities
        </span>
        <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-slate-900 dark:text-white mt-2.5 sm:mt-3 tracking-tight">
          Everything You Need to Deploy Enterprise AI Agents
        </h2>
        <p className="mt-2 text-xs sm:text-sm text-slate-600 dark:text-[#94A3B8] leading-relaxed">
          Built from the ground up for multi-tenancy, deterministic grounding, and zero-headache website embedding.
        </p>
      </div>

      {/* Feature Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 sm:gap-6">
        {PILLARS.map((pillar) => {
          const Icon = pillar.icon;
          return (
            <div
              key={pillar.id}
              className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-[#161B22] border border-slate-200 dark:border-[#30363D] hover:border-[#FF6A00]/40 dark:hover:border-[#FF6A00]/40 transition-all duration-300 shadow-sm hover:shadow-xl hover:-translate-y-1 group flex flex-col justify-between"
            >
              <div>
                {/* Header row */}
                <div className="flex items-center justify-between mb-3">
                  <div
                    className={`w-10 h-10 rounded-xl bg-slate-50 dark:bg-[#0E1117] border border-slate-200 dark:border-[#30363D] flex items-center justify-center ${pillar.iconColor} group-hover:scale-105 transition-transform`}
                  >
                    <Icon className="w-5 h-5" />
                  </div>
                  <span className="text-[11px] font-mono px-2.5 py-1 rounded-full bg-slate-100 dark:bg-[#0E1117] border border-slate-200 dark:border-[#30363D] text-slate-700 dark:text-[#CBD5E1]">
                    {pillar.badge}
                  </span>
                </div>

                {/* Title & Summary */}
                <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white group-hover:text-[#FF6A00] transition-colors">
                  {pillar.title}
                </h3>
                <p className="mt-1.5 text-xs sm:text-sm text-slate-600 dark:text-[#94A3B8] leading-relaxed">
                  {pillar.summary}
                </p>

                {/* Bullet Points */}
                <ul className="mt-3 pt-3 border-t border-slate-100 dark:border-[#30363D]/60 space-y-2">
                  {pillar.bullets.map((bullet, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-xs text-slate-700 dark:text-[#CBD5E1]">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                      <span>{bullet}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
