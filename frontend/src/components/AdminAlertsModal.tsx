"use client";

import React, { useState, useEffect } from "react";
import {
  AlertCircle,
  RefreshCw,
  X,
  ShieldAlert,
  CheckCircle,
  Clock,
  Check,
  Trash2,
  Bot,
} from "lucide-react";
import { AdminAlertsResponse, UnansweredLogItem } from "@/types/chat";
import {
  fetchAdminAlerts,
  deleteAdminAlert,
  resolveAdminAlert,
  clearAllAdminAlerts,
} from "@/services/api";

interface AdminAlertsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AdminAlertsModal: React.FC<AdminAlertsModalProps> = ({ isOpen, onClose }) => {
  const [alertsData, setAlertsData] = useState<AdminAlertsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [actionId, setActionId] = useState<number | null>(null);
  const [isClearing, setIsClearing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);
  const [filterMode, setFilterMode] = useState<"pending" | "all">("pending");

  const fetchAlerts = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchAdminAlerts(filterMode);
      setAlertsData(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error connecting to alerts API");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchAlerts();
    }
  }, [isOpen, filterMode]);

  const showNotification = (msg: string) => {
    setSuccessToast(msg);
    setTimeout(() => {
      setSuccessToast((prev) => (prev === msg ? null : prev));
    }, 3000);
  };

  const handleResolve = async (id: number) => {
    setActionId(id);
    const previousState = alertsData;

    // Optimistic UI update
    if (alertsData) {
      const targetItem = alertsData.alerts.find((a) => a.id === id);
      const isEscalated = targetItem ? targetItem.frequency_count >= alertsData.threshold : false;

      if (filterMode === "pending") {
        setAlertsData({
          ...alertsData,
          count: Math.max(0, alertsData.count - 1),
          escalated_count: isEscalated
            ? Math.max(0, alertsData.escalated_count - 1)
            : alertsData.escalated_count,
          alerts: alertsData.alerts.filter((a) => a.id !== id),
        });
      } else {
        setAlertsData({
          ...alertsData,
          alerts: alertsData.alerts.map((a) =>
            a.id === id ? { ...a, status: "resolved" } : a
          ),
        });
      }
    }

    try {
      await resolveAdminAlert(id);
      showNotification(`Alert #${id} marked as resolved.`);
    } catch (err: unknown) {
      // Revert optimistic update
      setAlertsData(previousState);
      setError(err instanceof Error ? err.message : `Failed to resolve alert #${id}`);
    } finally {
      setActionId(null);
    }
  };

  const handleDelete = async (id: number) => {
    setActionId(id);
    const previousState = alertsData;

    // Optimistic UI update
    if (alertsData) {
      const targetItem = alertsData.alerts.find((a) => a.id === id);
      const isEscalated = targetItem ? targetItem.frequency_count >= alertsData.threshold : false;

      setAlertsData({
        ...alertsData,
        count: Math.max(0, alertsData.count - 1),
        escalated_count: isEscalated
          ? Math.max(0, alertsData.escalated_count - 1)
          : alertsData.escalated_count,
        alerts: alertsData.alerts.filter((a) => a.id !== id),
      });
    }

    try {
      await deleteAdminAlert(id);
      showNotification(`Alert #${id} permanently deleted.`);
    } catch (err: unknown) {
      // Revert optimistic update
      setAlertsData(previousState);
      setError(err instanceof Error ? err.message : `Failed to delete alert #${id}`);
    } finally {
      setActionId(null);
    }
  };

  const handleClearAll = async () => {
    if (!alertsData || alertsData.alerts.length === 0) return;
    if (!window.confirm("Are you sure you want to clear all pending unanswered query alerts?")) {
      return;
    }

    setIsClearing(true);
    const previousState = alertsData;

    // Optimistic UI update
    setAlertsData({
      ...alertsData,
      count: 0,
      escalated_count: 0,
      alerts: [],
    });

    try {
      const result = await clearAllAdminAlerts("pending", "delete");
      showNotification(result.message || "All pending alerts cleared successfully.");
    } catch (err: unknown) {
      setAlertsData(previousState);
      setError(err instanceof Error ? err.message : "Failed to clear pending alerts.");
    } finally {
      setIsClearing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in">
      <div className="bg-[#161B22] border border-[#30363D] rounded-2xl w-full max-w-4xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#30363D] flex items-center justify-between bg-[#1F242C]">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                Unanswered Queries & Admin Escalations
                {alertsData && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-red-950/80 text-red-300 border border-red-800">
                    {alertsData.escalated_count} Escalated
                  </span>
                )}
              </h2>
              <p className="text-xs text-[#94A3B8]">
                Real-time governance feed with agent attribution & resolution actions
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchAlerts}
              disabled={loading || isClearing}
              className="p-2 rounded-lg text-[#94A3B8] hover:text-white hover:bg-[#30363D] transition-colors disabled:opacity-50"
              title="Refresh alerts"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-lg text-[#94A3B8] hover:text-white hover:bg-[#30363D] transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Filter & Actions Toolbar */}
        <div className="px-6 py-3 bg-[#12161E] border-b border-[#30363D] flex flex-wrap items-center justify-between text-xs gap-3">
          <div className="flex items-center gap-2">
            <span className="text-[#94A3B8]">Filter:</span>
            <button
              onClick={() => setFilterMode("pending")}
              className={`px-3 py-1 rounded-md transition-colors ${
                filterMode === "pending"
                  ? "bg-[#FF6A00] text-white font-medium shadow-sm shadow-[#FF6A00]/20"
                  : "bg-[#161B22] text-[#94A3B8] hover:text-white border border-[#30363D]"
              }`}
            >
              Pending Queries
            </button>
            <button
              onClick={() => setFilterMode("all")}
              className={`px-3 py-1 rounded-md transition-colors ${
                filterMode === "all"
                  ? "bg-[#FF6A00] text-white font-medium shadow-sm shadow-[#FF6A00]/20"
                  : "bg-[#161B22] text-[#94A3B8] hover:text-white border border-[#30363D]"
              }`}
            >
              All Records
            </button>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-[#94A3B8] hidden sm:block">
              Threshold: <strong className="text-white">{alertsData?.threshold ?? 3}+ repeated queries</strong>
            </div>

            {/* Clear All Pending Action */}
            <button
              onClick={handleClearAll}
              disabled={isClearing || !alertsData || alertsData.alerts.length === 0}
              className="px-3 py-1 rounded-md bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 text-xs font-semibold transition-all flex items-center gap-1.5 disabled:opacity-40 disabled:pointer-events-none"
              title="Delete all pending unanswered query logs"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>{isClearing ? "Clearing..." : "Clear All Pending"}</span>
            </button>
          </div>
        </div>

        {/* Toast / Notification Banner */}
        {successToast && (
          <div className="px-6 py-2 bg-emerald-950/60 border-b border-emerald-800 text-emerald-300 text-xs flex items-center gap-2 animate-in fade-in">
            <Check className="w-3.5 h-3.5 text-emerald-400" />
            <span>{successToast}</span>
          </div>
        )}

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-3">
          {loading && !alertsData && (
            <div className="flex flex-col items-center justify-center py-12 text-[#94A3B8]">
              <RefreshCw className="w-8 h-8 animate-spin text-[#FF6A00] mb-2" />
              <p className="text-sm">Querying backend database...</p>
            </div>
          )}

          {error && (
            <div className="p-4 rounded-xl bg-red-950/40 border border-red-800 text-red-200 text-sm flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Notice</p>
                <p className="text-xs text-red-300 mt-1">{error}</p>
              </div>
            </div>
          )}

          {alertsData && alertsData.alerts.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-center text-[#94A3B8]">
              <CheckCircle className="w-12 h-12 text-emerald-500 mb-3" />
              <h4 className="text-white font-semibold text-base">Knowledge Base is Pristine</h4>
              <p className="text-xs text-[#94A3B8] max-w-md mt-1">
                No unresolved questions are currently logged in <code>unanswered_logs</code>. All client inquiries
                have been successfully grounded or resolved.
              </p>
            </div>
          )}

          {alertsData && alertsData.alerts.length > 0 && (
            <div className="space-y-3">
              {alertsData.alerts.map((item: UnansweredLogItem) => {
                const isEscalated = item.frequency_count >= alertsData.threshold;
                const isItemActionLoading = actionId === item.id;

                return (
                  <div
                    key={item.id}
                    className={`p-4 rounded-xl border transition-all ${
                      isEscalated
                        ? "bg-red-950/20 border-red-800/80 shadow-sm"
                        : "bg-[#12161E] border-[#30363D]"
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
                      {/* Left side: Query info & agent attribution */}
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`text-xs px-2 py-0.5 rounded font-mono font-bold ${
                              isEscalated
                                ? "bg-red-500 text-white"
                                : "bg-[#21262D] text-[#FF6A00] border border-[#30363D]"
                            }`}
                          >
                            {item.frequency_count}x Asked
                          </span>

                          {/* Agent Attribution Badge */}
                          <span className="px-2 py-0.5 rounded text-[11px] bg-[#FF6A00]/10 text-[#FF8C38] font-mono border border-[#FF6A00]/25 font-semibold flex items-center gap-1">
                            <Bot className="w-3 h-3 text-[#FF6A00]" />
                            <span>Agent: {item.agent_name || "General Agent"}</span>
                          </span>

                          {isEscalated && (
                            <span className="text-[11px] font-bold text-red-400 uppercase tracking-wider flex items-center gap-1">
                              <ShieldAlert className="w-3.5 h-3.5" /> High Escalation
                            </span>
                          )}

                          <span className="text-xs text-[#64748B] font-mono">ID #{item.id}</span>
                        </div>

                        <h4 className="mt-2.5 text-sm font-semibold text-white break-words">
                          &ldquo;{item.user_query}&rdquo;
                        </h4>
                        <p className="text-xs text-[#94A3B8] mt-1 font-mono break-all">
                          Normalized: {item.normalized_query}
                        </p>
                      </div>

                      {/* Right side: Status, timestamp & action buttons */}
                      <div className="flex flex-col sm:items-end gap-2 shrink-0 w-full sm:w-auto">
                        <div className="flex items-center gap-2 justify-between sm:justify-end">
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-[10px] uppercase font-semibold ${
                              item.status === "pending"
                                ? "bg-amber-950/80 text-amber-300 border border-amber-800"
                                : "bg-emerald-950/80 text-emerald-300 border border-emerald-800"
                            }`}
                          >
                            {item.status}
                          </span>

                          <div className="text-[#64748B] text-[11px] flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            <span>
                              {item.last_asked_at
                                ? new Date(item.last_asked_at).toLocaleString([], {
                                    month: "short",
                                    day: "numeric",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })
                                : "N/A"}
                            </span>
                          </div>
                        </div>

                        {/* Action Buttons: Resolve & Delete */}
                        <div className="flex items-center gap-2 pt-1 border-t border-[#30363D]/40 sm:border-0 sm:pt-0">
                          {item.status !== "resolved" && (
                            <button
                              onClick={() => handleResolve(item.id)}
                              disabled={isItemActionLoading}
                              title="Mark as resolved"
                              className="px-2.5 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 transition-all flex items-center gap-1 text-xs font-semibold disabled:opacity-50"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>{isItemActionLoading ? "Saving..." : "Resolve"}</span>
                            </button>
                          )}

                          <button
                            onClick={() => handleDelete(item.id)}
                            disabled={isItemActionLoading}
                            title="Delete query log"
                            className="px-2.5 py-1 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 transition-all flex items-center gap-1 text-xs font-semibold disabled:opacity-50"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>{isItemActionLoading ? "Deleting..." : "Delete"}</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-[#12161E] border-t border-[#30363D] flex items-center justify-between text-xs text-[#94A3B8]">
          <span>
            Total Displayed: <strong className="text-white">{alertsData?.count ?? 0}</strong>
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-[#21262D] hover:bg-[#30363D] text-white transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
