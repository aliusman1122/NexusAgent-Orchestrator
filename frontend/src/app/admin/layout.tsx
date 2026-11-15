import React from "react";
import type { Metadata } from "next";
import { AdminLayoutWrapper } from "@/components/admin/AdminLayoutWrapper";

export const metadata: Metadata = {
  title: "NexusAgent Studio | Enterprise Admin Dashboard",
  description: "Enterprise Multi-Agent Orchestrator and Knowledge Base Management.",
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AdminLayoutWrapper>{children}</AdminLayoutWrapper>;
}
