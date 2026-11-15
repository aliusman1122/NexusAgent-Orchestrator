"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bot,
  ExternalLink,
  Layers,
  Database,
  Sparkles,
  ArrowLeft,
  Settings,
} from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";

export function AdminNavbar() {
  const pathname = usePathname();

  const isAgentsActive =
    pathname === "/admin/agents" ||
    pathname.startsWith("/admin/agents/");

  const isSettingsActive = pathname === "/admin/settings";

  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-200 dark:border-[#30363D] bg-white/90 dark:bg-[#0E1117]/90 backdrop-blur-md transition-colors duration-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand & Studio Title */}
        <div className="flex items-center gap-6">
          <Link
            href="/admin/agents"
            className="flex items-center gap-3 group transition-transform active:scale-95"
          >
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#FF6A00] to-[#E55F00] flex items-center justify-center font-black text-white text-sm shadow-lg shadow-[#FF6A00]/25 group-hover:shadow-[#FF6A00]/40 transition-all">
              A7
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="font-bold text-base sm:text-lg text-slate-900 dark:text-white tracking-tight group-hover:text-[#FF6A00] transition-colors">
                  A7 Agent Studio
                </span>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-mono uppercase tracking-wider font-semibold bg-[#FF6A00]/15 text-[#FF6A00] border border-[#FF6A00]/30">
                  Admin
                </span>
              </div>
              <span className="text-[11px] text-slate-500 dark:text-[#8B949E] font-medium hidden sm:inline">
                Enterprise Multi-Agent Orchestrator
              </span>
            </div>
          </Link>

          {/* Navigation Links */}
          <nav className="hidden md:flex items-center gap-1 pl-4 border-l border-slate-200 dark:border-[#30363D]">
            <Link
              href="/admin/agents"
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                isAgentsActive
                  ? "bg-orange-50 text-[#FF6A00] border border-orange-200 dark:bg-[#161B22] dark:text-[#FF6A00] dark:border-[#FF6A00]/40 shadow-sm shadow-[#FF6A00]/10"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-[#8B949E] dark:hover:text-[#E6EDF3] dark:hover:bg-[#161B22]/60"
              }`}
            >
              <Bot className="w-4 h-4" />
              <span>Agents Dashboard</span>
            </Link>

            <Link
              href="/admin/settings"
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                isSettingsActive
                  ? "bg-orange-50 text-[#FF6A00] border border-orange-200 dark:bg-[#161B22] dark:text-[#FF6A00] dark:border-[#FF6A00]/40 shadow-sm shadow-[#FF6A00]/10"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-[#8B949E] dark:hover:text-[#E6EDF3] dark:hover:bg-[#161B22]/60"
              }`}
            >
              <Settings className="w-4 h-4" />
              <span>Settings ⚙️</span>
            </Link>
          </nav>
        </div>

        {/* Right side controls */}
        <div className="flex items-center gap-3">
          {/* Storage & Environment Tag */}
          <div className="hidden lg:flex items-center gap-2 px-3 py-1 rounded-full bg-slate-100 dark:bg-[#161B22] border border-slate-200 dark:border-[#30363D] text-xs">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-slate-500 dark:text-[#8B949E]">
              Storage: <span className="text-emerald-600 dark:text-emerald-400 font-mono">Synchronized Local</span>
            </span>
          </div>

          {/* Theme Mode Toggle (Dark / Light) */}
          <ThemeToggle />

          {/* Back to Public Site Button */}
          <Link
            href="/"
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-white hover:bg-slate-100 text-slate-700 hover:text-[#FF6A00] border border-slate-200 hover:border-[#FF6A00]/50 dark:bg-[#161B22] dark:hover:bg-[#1F242C] dark:text-[#E6EDF3] dark:border-[#30363D] transition-all shadow-sm"
          >
            <ArrowLeft className="w-3.5 h-3.5 text-[#FF6A00]" />
            <span>Back to Public Site</span>
          </Link>
        </div>
      </div>
    </header>
  );
}
