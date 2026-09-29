import React from "react";
import type { Metadata } from "next";
import { AdminNavbar } from "@/components/admin/Navbar";

export const metadata: Metadata = {
  title: "A7 Agent Studio | Enterprise Admin Dashboard",
  description: "Enterprise Multi-Agent Orchestrator and Knowledge Base Management for A7 Logics.",
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#0E1117] text-[#E6EDF3] flex flex-col selection:bg-[#FF6A00] selection:text-white">
      {/* Background Accent Ambient Glow */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[1200px] h-[360px] bg-gradient-to-b from-[#FF6A00]/8 via-[#FF6A00]/3 to-transparent blur-3xl pointer-events-none -z-10" />

      {/* Dedicated Admin Navigation Bar */}
      <AdminNavbar />

      {/* Admin Content Area */}
      <main className="flex-1 flex flex-col">{children}</main>
    </div>
  );
}
