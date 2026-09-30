"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Database,
  ShieldCheck,
  Zap,
  BellRing,
  ArrowRight,
  CheckCircle2,
  Layers,
} from "lucide-react";

interface PillarItem {
  id: string;
  icon: React.ComponentType<{ className?: string }>;
  iconColor: string;
  title: string;
  badge: string;
  summary: string;
  bullets: string[];
  consoleRoute: string;
  routeLabel: string;
}

const PILLARS: PillarItem[] = [
  {
    id: "kb-sync",
    icon: Database,
    iconColor: "text-[#FF6A00]",
    title: "Dynamic Knowledge Base Sync",
    badge: "Dual-Tier Storage",
    summary:
      "Enterprise document ingestion across multi-format files (PDF, DOCX, XLSX) and deep recursive web crawlers with automated vector deduplication.",
    bullets: [
      "Real-time sync to Supabase PostgreSQL metadata and ChromaDB vectors",
      "Chunk preview and human verification before index commitment",
      "Per-tenant collection isolation with zero cross-tenant contamination",
    ],
    consoleRoute: "/admin/agents",
    routeLabel: "Manage Knowledge Repositories",
  },
  {
    id: "guardrails",
    icon: ShieldCheck,
    iconColor: "text-[#10B981]",
    title: "Deterministic Factual Grounding",
    badge: "Zero Hallucination",
    summary:
      "Every user prompt passes through stateful LangGraph nodes that compute cosine similarity thresholds against verified enterprise vector embeddings.",
    bullets: [
      "Strict citation attribution with source file and section tagging",
      "Automated rejection of speculative or ungrounded claims",
      "Stateful session persistence isolated per user conversation",
    ],
    consoleRoute: "/admin/agents",
    routeLabel: "Inspect Agent Guardrails",
  },
  {
    id: "token-telemetry",
    icon: Zap,
    iconColor: "text-[#38BDF8]",
    title: "Token Telemetry & Rate Governance",
    badge: "Live Provider Quotas",
    summary:
      "Continuous tracking of inference costs, rate limits, and budget quotas across Groq and OpenRouter models with automated failover policies.",
    bullets: [
      "Live RPM / TPM inspection and proactive quota exhaustion alerts",
      "Granular token consumption analytics per tenant and agent",
      "Dynamic model switching without client-side downtime",
    ],
    consoleRoute: "/admin/settings",
    routeLabel: "Configure Model & Limits",
  },
  {
    id: "escalations",
    icon: BellRing,
    iconColor: "text-[#F59E0B]",
    title: "Autonomous Escalation Lifecycle",
    badge: "3-Strike Policy",
    summary:
      "When queries cannot be answered with high grounding confidence, NexusAgent logs them into the unanswered repository and alerts operations.",
    bullets: [
      "Automated capture in PostgreSQL unanswered_logs table",
      "Configurable 3-strike threshold triggering immediate admin alerts",
      "Human-in-the-loop review workflow to close knowledge gaps",
    ],
    consoleRoute: "/admin/agents",
    routeLabel: "Review Escalation Queue",
  },
];

export function FeaturePillars() {
  const [activePillar, setActivePillar] = useState<string>(PILLARS[0].id);

  return (
    <section id="pillars" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
      {/* Section Header */}
      <div className="text-center max-w-3xl mx-auto mb-14">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#161B22] border border-[#30363D] text-xs font-semibold text-[#94A3B8] mb-3">
          <Layers className="w-3.5 h-3.5 text-[#FF6A00]" />
          <span>Core Architectural Fabric</span>
        </div>
        <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
          Engineered for Enterprise Compliance & Reliability
        </h2>
        <p className="mt-3 text-sm sm:text-base text-[#94A3B8]">
          Four architectural pillars powering continuous knowledge ingestion, mathematical grounding, 
          and production observability.
        </p>
      </div>

      {/* 4 Pillars Grid */}
      <div className="grid md:grid-cols-2 gap-6 max-w-5xl mx-auto">
        {PILLARS.map((pillar) => {
          const Icon = pillar.icon;
          const isSelected = activePillar === pillar.id;

          return (
            <div
              key={pillar.id}
              onClick={() => setActivePillar(pillar.id)}
              className={`p-6 sm:p-7 rounded-2xl bg-[#161B22]/90 border transition-all duration-200 cursor-pointer group flex flex-col justify-between ${
                isSelected
                  ? "border-[#FF6A00]/60 shadow-xl shadow-[#FF6A00]/10 bg-[#191F28]"
                  : "border-[#30363D] hover:border-[#FF6A00]/30 hover:bg-[#191F28]/60"
              }`}
            >
              <div>
                {/* Header row */}
                <div className="flex items-center justify-between mb-4">
                  <div
                    className={`w-11 h-11 rounded-xl bg-[#0E1117] border border-[#30363D] flex items-center justify-center ${pillar.iconColor} group-hover:scale-105 transition-transform`}
                  >
                    <Icon className="w-5 h-5" />
                  </div>
                  <span className="text-[11px] font-mono px-2.5 py-1 rounded-full bg-[#0E1117] border border-[#30363D] text-[#CBD5E1]">
                    {pillar.badge}
                  </span>
                </div>

                {/* Title & Summary */}
                <h3 className="text-lg font-bold text-white group-hover:text-[#FF6A00] transition-colors">
                  {pillar.title}
                </h3>
                <p className="mt-2 text-xs sm:text-sm text-[#94A3B8] leading-relaxed">
                  {pillar.summary}
                </p>

                {/* Bullet Points */}
                <ul className="mt-4 pt-4 border-t border-[#30363D]/60 space-y-2">
                  {pillar.bullets.map((bullet, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-xs text-[#CBD5E1]">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                      <span>{bullet}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Console Route Link */}
              <div className="mt-6 pt-4 border-t border-[#30363D]/40">
                <Link
                  href={pillar.consoleRoute}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#FF6A00] hover:text-[#FF8C38] transition-colors"
                >
                  <span>{pillar.routeLabel}</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
