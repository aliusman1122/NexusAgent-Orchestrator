"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Bot,
  FlaskConical,
  ShieldAlert,
  Settings,
  ArrowLeft,
  X,
  ChevronRight,
  LogOut,
} from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { AdminAlertsModal } from "@/components/AdminAlertsModal";
import { fetchAdminAlerts, clearAdminSession } from "@/services/api";

interface AdminSidebarProps {
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

interface NavItem {
  label: string;
  href?: string;
  icon: React.ComponentType<{ className?: string }>;
  active?: boolean;
  badge?: number;
  badgeColor?: string;
  onClick?: () => void;
}

interface NavGroup {
  group: string;
  items: NavItem[];
}

export function AdminSidebar({ mobileOpen = false, onMobileClose }: AdminSidebarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [alertsCount, setAlertsCount] = useState<number>(0);
  const [isAlertsModalOpen, setIsAlertsModalOpen] = useState(false);

  const handleSignOut = () => {
    clearAdminSession();
    if (onMobileClose) onMobileClose();
    router.push("/login");
  };

  // Poll or fetch pending alerts count on mount
  useEffect(() => {
    let isMounted = true;
    const loadAlerts = async () => {
      try {
        const data = await fetchAdminAlerts("pending");
        if (isMounted && data) {
          setAlertsCount(data.count ?? data.escalated_count ?? 0);
        }
      } catch (err) {
        if (isMounted) setAlertsCount(0);
      }
    };

    loadAlerts();
    const interval = setInterval(loadAlerts, 20000); // 20s telemetry poll
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  const isDashboardActive = pathname === "/admin";
  const isAgentsActive =
    pathname === "/admin/agents" ||
    (pathname.startsWith("/admin/agents/") && !pathname.includes("/test"));
  const isPlaygroundActive = pathname.includes("/test");
  const isSettingsActive = pathname === "/admin/settings";

  const navItems: NavGroup[] = [
    {
      group: "MAIN",
      items: [
        {
          label: "Dashboard",
          href: "/admin",
          icon: LayoutDashboard,
          active: isDashboardActive,
        },
        {
          label: "Agents Studio",
          href: "/admin/agents",
          icon: Bot,
          active: isAgentsActive,
        },
        {
          label: "Playground",
          href: "/admin/agents/a7_logics/test",
          icon: FlaskConical,
          active: isPlaygroundActive,
        },
      ],
    },
    {
      group: "OPERATIONS",
      items: [
        {
          label: "Escalations & Alerts",
          icon: ShieldAlert,
          badge: alertsCount > 0 ? alertsCount : undefined,
          badgeColor: "bg-amber-500 text-white",
          onClick: () => setIsAlertsModalOpen(true),
          active: isAlertsModalOpen,
        },
      ],
    },
    {
      group: "PREFERENCES",
      items: [
        {
          label: "System Settings",
          href: "/admin/settings",
          icon: Settings,
          active: isSettingsActive,
        },
      ],
    },
  ];

  return (
    <>
      {/* Mobile Backdrop */}
      {mobileOpen && (
        <div
          onClick={onMobileClose}
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-40 lg:hidden transition-opacity"
          aria-hidden="true"
        />
      )}

      {/* 100% Fixed Persistent Sidebar Container */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 w-[245px] bg-white dark:bg-[#0E1117] border-r border-slate-200 dark:border-[#30363D] flex flex-col justify-between transition-all duration-300 ease-in-out lg:translate-x-0 lg:sticky lg:top-0 lg:h-screen lg:shrink-0 ${
          mobileOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full"
        }`}
      >
        {/* Top Header / Branding */}
        <div className="flex flex-col">
          <div className="p-4 sm:p-4.5 flex items-center justify-between border-b border-slate-100 dark:border-[#21262D]">
            <Link
              href="/admin"
              onClick={onMobileClose}
              className="flex items-center gap-3 group transition-transform active:scale-95 min-w-0"
            >
              <div className="w-8.5 h-8.5 rounded-xl bg-gradient-to-br from-[#FF6A00] to-[#E55F00] flex items-center justify-center font-black text-white text-xs shadow-md shadow-[#FF6A00]/25 group-hover:shadow-[#FF6A00]/40 transition-all shrink-0">
                NA
              </div>
              <div className="flex flex-col min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-sm tracking-tight text-slate-900 dark:text-white group-hover:text-[#FF6A00] transition-colors truncate">
                    NexusAgent Studio
                  </span>
                  <span className="px-1.5 py-0.2 rounded text-[9px] font-mono uppercase tracking-wider font-bold bg-[#FF6A00]/15 text-[#FF6A00] border border-[#FF6A00]/30 shrink-0">
                    Admin
                  </span>
                </div>
                <span className="text-[11px] text-slate-500 dark:text-[#8B949E] font-medium truncate">
                  Enterprise Orchestrator
                </span>
              </div>
            </Link>

            {/* Mobile Close Button */}
            {onMobileClose && (
              <button
                type="button"
                onClick={onMobileClose}
                className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#161B22]"
                aria-label="Close Sidebar"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Navigation Links Grouped */}
          <nav className="p-3.5 flex flex-col gap-5 overflow-y-auto max-h-[calc(100vh-210px)]">
            {navItems.map((section, idx) => (
              <div key={idx} className="flex flex-col gap-1.5">
                <span className="px-3 text-[10px] font-mono tracking-wider text-slate-400 dark:text-[#8B949E] font-semibold uppercase">
                  {section.group}
                </span>

                <div className="flex flex-col gap-1">
                  {section.items.map((item, itemIdx) => {
                    const IconComponent = item.icon;

                    const activeClasses = item.active
                      ? "bg-orange-50 text-[#FF6A00] font-semibold border border-orange-200/80 dark:bg-[#161B22] dark:text-[#FF6A00] dark:border-[#FF6A00]/30 shadow-sm"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-[#8B949E] dark:hover:text-white dark:hover:bg-[#161B22]/60 font-medium";

                    if (item.onClick) {
                      return (
                        <button
                          key={itemIdx}
                          type="button"
                          onClick={() => {
                            item.onClick?.();
                            if (onMobileClose) onMobileClose();
                          }}
                          className={`flex items-center justify-between w-full px-3 py-2 rounded-xl text-sm transition-all text-left cursor-pointer ${activeClasses}`}
                        >
                          <div className="flex items-center gap-2.5 truncate">
                            <IconComponent className={`w-4 h-4 shrink-0 ${item.active ? "text-[#FF6A00]" : "text-slate-400 dark:text-[#8B949E]"}`} />
                            <span className="truncate">{item.label}</span>
                          </div>

                          {item.badge !== undefined && (
                            <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-[#FF6A00] text-white shadow-sm shrink-0">
                              {item.badge}
                            </span>
                          )}
                        </button>
                      );
                    }

                    return (
                      <Link
                        key={itemIdx}
                        href={item.href || "/admin"}
                        onClick={onMobileClose}
                        className={`flex items-center justify-between px-3 py-2 rounded-xl text-sm transition-all ${activeClasses}`}
                      >
                        <div className="flex items-center gap-2.5 truncate">
                          <IconComponent className={`w-4 h-4 shrink-0 ${item.active ? "text-[#FF6A00]" : "text-slate-400 dark:text-[#8B949E]"}`} />
                          <span className="truncate">{item.label}</span>
                        </div>

                        {item.active && (
                          <span className="w-1.5 h-1.5 rounded-full bg-[#FF6A00] shrink-0" />
                        )}
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>
        </div>

        {/* Bottom Panel (Storage, Theme Toggle, Back Link) */}
        <div className="p-3.5 border-t border-slate-200 dark:border-[#21262D] flex flex-col gap-3 bg-slate-50/50 dark:bg-[#0A0D12]">
          {/* Storage & DB Status */}
          <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-white dark:bg-[#161B22] border border-slate-200 dark:border-[#30363D] text-xs">
            <div className="flex items-center gap-2 truncate">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
              <span className="text-slate-500 dark:text-[#8B949E] text-[11px] font-medium truncate">
                Storage: <span className="text-emerald-600 dark:text-emerald-400 font-semibold font-mono">Local Sync</span>
              </span>
            </div>
            <ThemeToggle className="!w-7 !h-7 !rounded-lg text-xs shrink-0" />
          </div>

          {/* Back to Public Site */}
          <Link
            href="/"
            onClick={onMobileClose}
            className="flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:text-[#FF6A00] dark:text-[#8B949E] dark:hover:text-white hover:bg-white dark:hover:bg-[#161B22] border border-transparent hover:border-slate-200 dark:border-[#30363D] transition-all group"
          >
            <div className="flex items-center gap-2 truncate">
              <ArrowLeft className="w-3.5 h-3.5 text-[#FF6A00] group-hover:-translate-x-0.5 transition-transform shrink-0" />
              <span className="truncate">Back to Public Site</span>
            </div>
            <ChevronRight className="w-3 h-3 text-slate-400 opacity-60 shrink-0" />
          </Link>

          {/* Admin Sign Out */}
          <button
            type="button"
            onClick={handleSignOut}
            className="flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 border border-transparent hover:border-rose-200 dark:hover:border-rose-900/40 transition-all cursor-pointer group"
          >
            <div className="flex items-center gap-2 truncate">
              <LogOut className="w-3.5 h-3.5 text-rose-500 group-hover:rotate-12 transition-transform shrink-0" />
              <span className="truncate">Sign Out</span>
            </div>
          </button>
        </div>
      </aside>

      {/* Escalation Alerts Modal when triggered from Sidebar */}
      <AdminAlertsModal
        isOpen={isAlertsModalOpen}
        onClose={() => {
          setIsAlertsModalOpen(false);
          fetchAdminAlerts("pending")
            .then((data) => setAlertsCount(data?.count ?? data?.escalated_count ?? 0))
            .catch(() => {});
        }}
      />
    </>
  );
}
