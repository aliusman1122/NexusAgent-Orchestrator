"use client";

import React, { useState, useEffect, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  MessageSquare,
  X,
  Send,
  RotateCcw,
  Bot,
  User,
  Sparkles,
  ChevronDown,
  ExternalLink,
} from "lucide-react";
import { ChatMessage } from "@/types/chat";
import { sendChatMessage, fetchAgentBySlug } from "@/services/api";
import { getAgentById, Agent, getInitialGreeting } from "@/lib/admin-store";

function EmbedWidgetInner() {
  const searchParams = useSearchParams();
  const tenantSlug = searchParams?.get("tenant") || searchParams?.get("clinic-id") || "a7_logics";
  const position = (searchParams?.get("pos") || "bottom-right").toLowerCase();
  const isPreview = searchParams?.get("preview") === "true";

  const [activeAgent, setActiveAgent] = useState<Agent | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string>("");

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Notify parent iframe container to resize
  const notifyParent = (state: "expanded" | "collapsed") => {
    if (typeof window !== "undefined" && window.parent && window.parent !== window) {
      window.parent.postMessage({ type: "nexus_widget_resize", state }, "*");
    }
  };

  // Sync state with parent window
  useEffect(() => {
    notifyParent(isOpen ? "expanded" : "collapsed");
  }, [isOpen]);

  // Load Agent details
  useEffect(() => {
    let isMounted = true;

    async function loadAgent() {
      try {
        const apiAgent = await fetchAgentBySlug(tenantSlug);
        if (apiAgent && isMounted) {
          setActiveAgent(apiAgent);
          const greeting = getInitialGreeting(apiAgent);
          setMessages([
            {
              id: "welcome-1",
              role: "assistant",
              content: greeting,
              timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            },
          ]);
          return;
        }
      } catch (err) {
        console.warn("Could not load agent from API, checking store:", err);
      }

      if (isMounted) {
        const local = getAgentById(tenantSlug);
        if (local) {
          setActiveAgent(local);
          setMessages([
            {
              id: "welcome-1",
              role: "assistant",
              content: getInitialGreeting(local),
              timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            },
          ]);
        } else {
          setMessages([
            {
              id: "welcome-1",
              role: "assistant",
              content: `Hello! 👋 How can I assist you with ${tenantSlug} today?`,
              timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            },
          ]);
        }
      }
    }

    loadAgent();
  }, [tenantSlug]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputValue).trim();
    if (!text || isLoading) return;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: text,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue("");
    setIsLoading(true);

    try {
      const response = await sendChatMessage(
        text,
        sessionId || undefined,
        activeAgent?.slug || tenantSlug,
        activeAgent?.name,
        activeAgent?.tone,
        activeAgent?.id,
        (activeAgent as any)?.system_prompt || (activeAgent as any)?.systemPrompt
      );

      if (response?.session_id) {
        setSessionId(response.session_id);
      }

      const botMessage: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: response?.answer || "I received your message and processed your inquiry.",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };

      setMessages((prev) => [...prev, botMessage]);
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : "Network error";
      const errorResponse: ChatMessage = {
        id: `err-${Date.now()}`,
        role: "assistant",
        content: `Sorry, I encountered an issue connecting to the inference engine: ${errMsg}. Please try again shortly.`,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      setMessages((prev) => [...prev, errorResponse]);
    } finally {
      setIsLoading(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  const handleResetChat = () => {
    setSessionId("");
    const greeting = getInitialGreeting(activeAgent);
    setMessages([
      {
        id: `welcome-${Date.now()}`,
        role: "assistant",
        content: greeting,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      },
    ]);
  };

  const isTop = position.includes("top");
  const isLeft = position.includes("left");

  const agentDisplayName = activeAgent?.name || "AI Assistant";

  return (
    <div
      className={`fixed inset-0 select-none overflow-hidden font-sans pointer-events-none flex flex-col ${
        isTop ? "justify-start" : "justify-end"
      } ${isLeft ? "items-start" : "items-end"} p-3 sm:p-4`}
    >
      {/* Expanded Floating Chat Panel */}
      {isOpen && (
        <div
          className={`pointer-events-auto w-full max-w-[400px] h-[580px] max-h-[85vh] flex flex-col rounded-2xl bg-white dark:bg-[#161B22] border border-slate-200 dark:border-[#30363D] shadow-2xl overflow-hidden transition-all duration-200 animate-in fade-in ${
            isTop ? "slide-in-from-top-4 mb-3" : "slide-in-from-bottom-4 mb-3"
          }`}
        >
          {/* Header */}
          <div className="p-4 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white flex items-center justify-between shadow-md shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#FF6A00] flex items-center justify-center text-white shadow-md shadow-[#FF6A00]/30 font-bold shrink-0">
                <Bot className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h3 className="text-sm font-bold truncate leading-tight tracking-tight">
                  {agentDisplayName}
                </h3>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-[11px] text-emerald-400 font-medium">Online • Active</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handleResetChat}
                title="Reset conversation"
                className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                title="Close chat"
                className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Messages Stream */}
          <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-slate-50/60 dark:bg-[#0E1117] text-xs">
            {messages.map((msg) => {
              const isUser = msg.role === "user";
              return (
                <div
                  key={msg.id}
                  className={`flex items-start gap-2.5 ${isUser ? "flex-row-reverse" : "flex-row"}`}
                >
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs font-semibold ${
                      isUser
                        ? "bg-slate-300 dark:bg-slate-700 text-slate-800 dark:text-white"
                        : "bg-[#FF6A00] text-white shadow-sm"
                    }`}
                  >
                    {isUser ? <User className="w-3.5 h-3.5" /> : <Bot className="w-3.5 h-3.5" />}
                  </div>

                  <div
                    className={`max-w-[82%] p-3 rounded-2xl shadow-sm text-xs leading-relaxed ${
                      isUser
                        ? "bg-[#FF6A00] text-white rounded-tr-none font-medium"
                        : "bg-white dark:bg-[#161B22] text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-[#30363D] rounded-tl-none"
                    }`}
                  >
                    {isUser ? (
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                    ) : (
                      <div className="prose prose-xs dark:prose-invert max-w-none leading-relaxed space-y-1.5">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {msg.content}
                        </ReactMarkdown>
                      </div>
                    )}
                    <div
                      className={`mt-1 text-[10px] text-right ${
                        isUser ? "text-orange-100/80" : "text-slate-400 dark:text-slate-500"
                      }`}
                    >
                      {msg.timestamp}
                    </div>
                  </div>
                </div>
              );
            })}

            {isLoading && (
              <div className="flex items-start gap-2.5">
                <div className="w-7 h-7 rounded-full bg-[#FF6A00] text-white flex items-center justify-center shrink-0">
                  <Bot className="w-3.5 h-3.5 animate-pulse" />
                </div>
                <div className="p-3 rounded-2xl rounded-tl-none bg-white dark:bg-[#161B22] border border-slate-200 dark:border-[#30363D] shadow-sm flex items-center gap-2 text-slate-500 dark:text-slate-400">
                  <div className="flex gap-1 items-center">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#FF6A00] animate-bounce [animation-delay:-0.3s]" />
                    <span className="w-1.5 h-1.5 rounded-full bg-[#FF6A00] animate-bounce [animation-delay:-0.15s]" />
                    <span className="w-1.5 h-1.5 rounded-full bg-[#FF6A00] animate-bounce" />
                  </div>
                  <span>Thinking...</span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Quick Prompt Chips (when few messages) */}
          {messages.length <= 1 && !isLoading && (
            <div className="px-3 pt-2 pb-1 bg-slate-50/60 dark:bg-[#0E1117] flex items-center gap-1.5 overflow-x-auto border-t border-slate-200/50 dark:border-[#30363D]/50">
              {["What services do you provide?", "How can I contact support?", "Tell me about pricing"].map(
                (prompt, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSendMessage(prompt)}
                    className="px-2.5 py-1 rounded-full bg-white dark:bg-[#161B22] border border-slate-200 dark:border-[#30363D] text-[11px] text-slate-700 dark:text-slate-300 hover:border-[#FF6A00] hover:text-[#FF6A00] transition-colors whitespace-nowrap cursor-pointer shadow-2xl"
                  >
                    {prompt}
                  </button>
                )
              )}
            </div>
          )}

          {/* Input Bar */}
          <div className="p-3 bg-white dark:bg-[#161B22] border-t border-slate-200 dark:border-[#30363D] shrink-0">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
              className="flex items-center gap-2"
            >
              <textarea
                ref={inputRef}
                rows={1}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                placeholder="Type your message..."
                disabled={isLoading}
                className="flex-1 px-3 py-2 text-xs bg-slate-50 dark:bg-[#0E1117] border border-slate-300 dark:border-[#30363D] rounded-xl focus:border-[#FF6A00] focus:ring-1 focus:ring-[#FF6A00] outline-none resize-none text-slate-900 dark:text-white"
              />
              <button
                type="submit"
                disabled={!inputValue.trim() || isLoading}
                className="w-8 h-8 rounded-xl bg-[#FF6A00] hover:bg-[#E55F00] text-white flex items-center justify-center disabled:opacity-40 disabled:pointer-events-none transition-all shadow-md shadow-[#FF6A00]/25 shrink-0 cursor-pointer"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
            <div className="flex items-center justify-between text-[10px] text-slate-400 dark:text-slate-500 mt-1.5 px-1">
              <span>Press Enter to send</span>
              <span className="font-medium text-[#FF6A00]">Powered by A7 Logics</span>
            </div>
          </div>
        </div>
      )}

      {/* Floating Action Button (FAB) */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-label={isOpen ? "Close AI chat" : "Open AI chat"}
        className="pointer-events-auto h-14 w-14 rounded-full bg-gradient-to-tr from-[#FF6A00] to-[#FF8C38] hover:from-[#E55F00] hover:to-[#FF6A00] text-white flex items-center justify-center shadow-2xl shadow-[#FF6A00]/40 hover:scale-105 active:scale-95 transition-all duration-200 border-2 border-white/20 cursor-pointer"
      >
        {isOpen ? (
          <X className="w-6 h-6 transition-transform duration-200" />
        ) : (
          <MessageSquare className="w-6 h-6 transition-transform duration-200" />
        )}
      </button>
    </div>
  );
}

export default function EmbedWidgetPage() {
  return (
    <Suspense fallback={null}>
      <EmbedWidgetInner />
    </Suspense>
  );
}
