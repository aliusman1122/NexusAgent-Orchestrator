"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Menu, ArrowLeft, Layers } from "lucide-react";
import { AdminSidebar } from "./AdminSidebar";
import { ThemeToggle } from "@/components/ThemeToggle";
import { getAdminSession } from "@/services/api";

export function AdminLayoutWrapper({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isAuthChecking, setIsAuthChecking] = useState(true);

  // Authenticate admin access
  useEffect(() => {
    const session = getAdminSession();
    if (!session || !session.success) {
      router.replace("/login");
    } else {
      setIsAuthChecking(false);
    }
  }, [router]);

  if (isAuthChecking) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-slate-50 dark:bg-[#0E1117] text-slate-600 dark:text-slate-300">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#FF6A00] to-[#E55F00] flex items-center justify-center text-white font-bold animate-pulse">
            <Layers className="w-5 h-5 text-white" />
          </div>
          <p className="text-xs font-mono font-medium tracking-wide">Authenticating NexusAgent Admin...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-full overflow-hidden bg-slate-50 dark:bg-[#0E1117] text-slate-900 dark:text-[#E6EDF3] flex flex-col lg:flex-row selection:bg-[#FF6A00] selection:text-white transition-colors duration-200">
      {/* Background Accent Ambient Glow */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[1200px] h-[360px] bg-gradient-to-b from-[#FF6A00]/8 via-[#FF6A00]/3 to-transparent blur-3xl pointer-events-none -z-10" />

      {/* Mobile Top App Bar (Visible only on < lg screens) */}
      <header className="lg:hidden shrink-0 sticky top-0 z-40 w-full bg-white/95 dark:bg-[#0E1117]/95 border-b border-slate-200 dark:border-[#30363D] backdrop-blur-md px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="p-2 rounded-xl text-slate-600 dark:text-[#8B949E] hover:bg-slate-100 dark:hover:bg-[#161B22] border border-slate-200 dark:border-[#30363D]"
            aria-label="Open Navigation Menu"
          >
            <Menu className="w-5 h-5 text-slate-700 dark:text-slate-200" />
          </button>

          <Link href="/admin" className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#FF6A00] to-[#E55F00] flex items-center justify-center font-bold text-white text-xs shadow-sm">
              NA
            </div>
            <span className="font-bold text-sm text-slate-900 dark:text-white">
              NexusAgent Studio
            </span>
          </Link>
        </div>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Link
            href="/"
            className="p-2 rounded-xl text-slate-600 dark:text-[#8B949E] hover:text-[#FF6A00] hover:bg-slate-100 dark:hover:bg-[#161B22] border border-slate-200 dark:border-[#30363D]"
            title="Back to Public Site"
          >
            <ArrowLeft className="w-4 h-4 text-[#FF6A00]" />
          </Link>
        </div>
      </header>

      {/* 100% Fixed Persistent Left Sidebar */}
      <AdminSidebar
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />

      {/* Main Independently Scrollable Content Area */}
      <main className="flex-1 h-[calc(100vh-61px)] lg:h-screen overflow-y-auto min-w-0 flex flex-col">
        {children}
      </main>
    </div>
  );
}
