"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Layers,
  ArrowRight,
  BellRing,
  Menu,
  X,
  Cpu,
} from "lucide-react";

interface PortalHeaderProps {
  isBackendOnline: boolean | null;
  onOpenAlerts?: () => void;
  activeModel?: string;
}

export function PortalHeader({
  isBackendOnline,
  onOpenAlerts,
  activeModel,
}: PortalHeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const cleanModel = activeModel ? activeModel.replace("openai/", "").replace("google/", "") : null;

  return (
    <header className="sticky top-0 z-50 w-full border-b border-[#30363D] bg-[#0E1117]/85 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand & Identity */}
        <div className="flex items-center gap-6">
          <Link
            href="/"
            className="flex items-center gap-3 group transition-transform active:scale-95"
          >
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#FF6A00] via-[#FF7D20] to-[#FF9E4D] flex items-center justify-center font-black text-white text-base shadow-lg shadow-[#FF6A00]/30 group-hover:shadow-[#FF6A00]/50 transition-all duration-300">
              <Layers className="w-5 h-5 text-white animate-pulse" />
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-base sm:text-lg text-white tracking-tight group-hover:text-[#FF6A00] transition-colors">
                  NexusAgent
                </span>
                <span className="font-medium text-base sm:text-lg text-[#94A3B8] -ml-1">
                  Orchestrator
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-wider font-semibold bg-[#FF6A00]/15 text-[#FF6A00] border border-[#FF6A00]/30 hidden sm:inline-block">
                  v1.4 Enterprise
                </span>
              </div>
              <span className="text-[10px] text-[#64748B] font-mono tracking-wide hidden lg:inline">
                MULTI-AGENT GOVERNANCE & RAG ENGINE
              </span>
            </div>
          </Link>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-1 pl-4 border-l border-[#30363D]/80">
            <a
              href="#playground"
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-[#94A3B8] hover:text-white hover:bg-[#161B22] transition-colors"
            >
              Live Sandbox
            </a>
            <a
              href="#pillars"
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-[#94A3B8] hover:text-white hover:bg-[#161B22] transition-colors"
            >
              Platform Pillars
            </a>
            <a
              href="#telemetry"
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-[#94A3B8] hover:text-white hover:bg-[#161B22] transition-colors"
            >
              Telemetry
            </a>
          </nav>
        </div>

        {/* Right Action Controls */}
        <div className="flex items-center gap-3">
          {/* Backend Status Badge */}
          <div className="hidden sm:flex items-center gap-2 px-3 py-1 rounded-full bg-[#161B22] border border-[#30363D] text-xs font-medium shadow-inner">
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
              FastAPI:{" "}
              <strong
                className={
                  isBackendOnline === true
                    ? "text-emerald-400 font-semibold"
                    : isBackendOnline === false
                    ? "text-red-400"
                    : "text-amber-400"
                }
              >
                {isBackendOnline === true
                  ? "Online"
                  : isBackendOnline === false
                  ? "Offline"
                  : "Connecting..."}
              </strong>
            </span>
          </div>

          {/* Admin Alerts Inspector Trigger */}
          {onOpenAlerts && (
            <button
              onClick={onOpenAlerts}
              className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#161B22] hover:bg-[#1F242C] text-xs text-[#CBD5E1] hover:text-[#FF6A00] border border-[#30363D] hover:border-[#FF6A00]/40 transition-all shadow-sm"
              title="Inspect unresolved query alerts"
            >
              <BellRing className="w-3.5 h-3.5 text-[#FF6A00]" />
              <span>Escalations</span>
            </button>
          )}

          {/* High-Contrast Management Console Button */}
          <Link
            href="/admin"
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-[#FF6A00] to-[#E55F00] hover:from-[#FF7D20] hover:to-[#FF6A00] text-white text-xs sm:text-sm font-bold shadow-lg shadow-[#FF6A00]/30 hover:shadow-[#FF6A00]/50 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 border border-white/20"
          >
            <span>Launch Console</span>
            <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
          </Link>

          {/* Mobile Hamburger Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 rounded-lg bg-[#161B22] border border-[#30363D] text-[#94A3B8] hover:text-white"
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden px-4 pt-3 pb-4 bg-[#161B22] border-b border-[#30363D] space-y-2">
          <a
            href="#playground"
            onClick={() => setMobileMenuOpen(false)}
            className="block px-3 py-2 rounded-lg text-sm text-[#E6EDF3] hover:bg-[#1F242C]"
          >
            Live Sandbox
          </a>
          <a
            href="#pillars"
            onClick={() => setMobileMenuOpen(false)}
            className="block px-3 py-2 rounded-lg text-sm text-[#E6EDF3] hover:bg-[#1F242C]"
          >
            Platform Pillars
          </a>
          <a
            href="#telemetry"
            onClick={() => setMobileMenuOpen(false)}
            className="block px-3 py-2 rounded-lg text-sm text-[#E6EDF3] hover:bg-[#1F242C]"
          >
            Telemetry & Metrics
          </a>
          <div className="pt-2 border-t border-[#30363D] flex items-center justify-between">
            <span className="text-xs text-[#94A3B8]">
              Backend Engine:{" "}
              <strong className={isBackendOnline ? "text-emerald-400" : "text-amber-400"}>
                {isBackendOnline ? "Online" : "Offline"}
              </strong>
            </span>
            {onOpenAlerts && (
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  onOpenAlerts();
                }}
                className="text-xs text-[#FF6A00] flex items-center gap-1 font-semibold"
              >
                <BellRing className="w-3.5 h-3.5" />
                Alerts
              </button>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
