"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Layers, Menu, X } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";

interface PortalHeaderProps {
  isBackendOnline?: boolean | null;
  onOpenAlerts?: () => void;
  activeModel?: string;
}

export function PortalHeader({}: PortalHeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleSmoothScroll = (e: React.MouseEvent<HTMLAnchorElement>, targetId: string) => {
    e.preventDefault();
    setMobileMenuOpen(false);
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
    <header className="fixed top-0 left-0 right-0 z-50 w-full border-b border-slate-200 dark:border-[#30363D] bg-white/95 dark:bg-[#0E1117]/90 backdrop-blur-xl transition-colors duration-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand & Identity */}
        <div className="flex items-center gap-6">
          <Link
            href="/"
            className="flex items-center gap-3 group transition-transform active:scale-95"
          >
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#FF6A00] via-[#FF7D20] to-[#FF9E4D] flex items-center justify-center font-black text-white text-base shadow-lg shadow-[#FF6A00]/30 group-hover:shadow-[#FF6A00]/50 transition-all duration-300">
              <Layers className="w-5 h-5 text-white" />
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-base sm:text-lg text-slate-900 dark:text-white tracking-tight group-hover:text-[#FF6A00] transition-colors">
                  NexusAgent
                </span>
                <span className="font-medium text-base sm:text-lg text-slate-500 dark:text-[#94A3B8] -ml-1">
                  Orchestrator
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-wider font-semibold bg-[#FF6A00]/15 text-[#FF6A00] border border-[#FF6A00]/30 hidden sm:inline-block">
                  v1.4 Enterprise
                </span>
              </div>
            </div>
          </Link>

          {/* Clean Visitor Navigation with Smooth Sliding */}
          <nav className="hidden md:flex items-center gap-1 pl-4 border-l border-slate-200 dark:border-[#30363D]/80">
            <a
              href="#overview"
              onClick={(e) => handleSmoothScroll(e, "overview")}
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-[#94A3B8] dark:hover:text-white dark:hover:bg-[#161B22] transition-colors cursor-pointer"
            >
              Overview
            </a>
            <a
              href="#features"
              onClick={(e) => handleSmoothScroll(e, "features")}
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-[#94A3B8] dark:hover:text-white dark:hover:bg-[#161B22] transition-colors cursor-pointer"
            >
              Capabilities
            </a>
            <a
              href="#playground"
              onClick={(e) => handleSmoothScroll(e, "playground")}
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-[#94A3B8] dark:hover:text-white dark:hover:bg-[#161B22] transition-colors cursor-pointer"
            >
              Live Demo
            </a>
          </nav>
        </div>

        {/* Right Controls: Only Theme Toggle & Mobile Hamburger (Admin button removed) */}
        <div className="flex items-center gap-3">
          <ThemeToggle />

          {/* Mobile Hamburger Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 rounded-lg bg-slate-100 border border-slate-200 text-slate-700 dark:bg-[#161B22] dark:border-[#30363D] dark:text-[#94A3B8] hover:text-slate-900 dark:hover:text-white"
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden px-4 pt-3 pb-4 bg-white dark:bg-[#161B22] border-b border-slate-200 dark:border-[#30363D] space-y-2 animate-in fade-in duration-150">
          <a
            href="#overview"
            onClick={(e) => handleSmoothScroll(e, "overview")}
            className="block px-3 py-2 rounded-lg text-sm text-slate-700 dark:text-[#E6EDF3] hover:bg-slate-100 dark:hover:bg-[#1F242C]"
          >
            Overview
          </a>
          <a
            href="#features"
            onClick={(e) => handleSmoothScroll(e, "features")}
            className="block px-3 py-2 rounded-lg text-sm text-slate-700 dark:text-[#E6EDF3] hover:bg-slate-100 dark:hover:bg-[#1F242C]"
          >
            Capabilities
          </a>
          <a
            href="#playground"
            onClick={(e) => handleSmoothScroll(e, "playground")}
            className="block px-3 py-2 rounded-lg text-sm text-slate-700 dark:text-[#E6EDF3] hover:bg-slate-100 dark:hover:bg-[#1F242C]"
          >
            Live Demo
          </a>
        </div>
      )}
    </header>
  );
}
