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
  ChevronDown,
} from "lucide-react";
import { ChatMessage, ChatResponsePayload } from "@/types/chat";
import { sendChatMessage, fetchAgentBySlug } from "@/services/api";
import { getAgentById, Agent, getCleanAgentName, getInitialGreeting } from "@/lib/admin-store";

export const DEFAULT_INITIAL_MESSAGE = getInitialGreeting(null);

function ChatWidgetContent() {
  const searchParams = useSearchParams();
  const agentSlug = searchParams?.get("agent") || "";
  const openParam = searchParams?.get("open") || "";

  const [activeAgent, setActiveAgent] = useState<Agent | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    const targetSlug = agentSlug || "a7_logics";
    const initialLocalAgent = typeof window !== "undefined" ? getAgentById(targetSlug) : null;
    return [
      {
        id: "welcome-1",
        role: "assistant",
        content: getInitialGreeting(initialLocalAgent),
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      },
    ];
  });
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string>("");
  const [hasUnread, setHasUnread] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Detect and synchronize active agent from URL query parameter & PostgreSQL backend API
  useEffect(() => {
    let isMounted = true;
    const targetSlug = agentSlug || "a7_logics";

    async function syncActiveAgent() {
      try {
        const apiAgent = await fetchAgentBySlug(targetSlug);
        if (apiAgent && isMounted) {
          setActiveAgent(apiAgent);
          const welcomeContent = getInitialGreeting(apiAgent);
          const agentWelcome: ChatMessage = {
            id: `welcome-${apiAgent.slug || apiAgent.id}`,
            role: "assistant",
            content: welcomeContent,
            timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          };
          setMessages([agentWelcome]);
          return;
        }
      } catch (err) {
        console.warn("Could not fetch active agent from backend API, checking local store:", err);
      }

      if (isMounted) {
        const found = getAgentById(targetSlug);
        if (found) {
          setActiveAgent(found);
          const welcomeContent = getInitialGreeting(found);
          const agentWelcome: ChatMessage = {
            id: `welcome-${found.slug || found.id}`,
            role: "assistant",
            content: welcomeContent,
            timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          };
          setMessages([agentWelcome]);
        }
      }
    }

    syncActiveAgent();
    return () => {
      isMounted = false;
    };
  }, [agentSlug]);

  // Handle open query param
  useEffect(() => {
    if (openParam === "true" || openParam === "1") {
      setIsOpen(true);
    }
  }, [openParam]);

  // Generate a brand new sessionId on mount
  useEffect(() => {
    const newSession =
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : "sess_" + Math.random().toString(36).substring(2, 10);
    setSessionId(newSession);
  }, []);

  // Scroll to bottom when messages update
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isLoading, isOpen]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setHasUnread(false);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 150);
    }
  }, [isOpen]);

  const handleReset = () => {
    const newSession =
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : "sess_" + Math.random().toString(36).substring(2, 10);
    setSessionId(newSession);

    const welcomeContent = getInitialGreeting(activeAgent);

    setMessages([
      {
        id: `welcome-${activeAgent?.slug || activeAgent?.id || "default"}-${Date.now()}`,
        role: "assistant",
        content: welcomeContent,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      },
    ]);
  };

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputValue).trim();
    if (!text || isLoading) return;

    const userMessage: ChatMessage = {
      id: "usr-" + Date.now(),
      role: "user",
      content: text,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      sessionId,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue("");
    setIsLoading(true);

    // Bind request to active agent tenant_id if present, else fallback to 'a7_logics'
    const targetTenant = activeAgent?.slug || activeAgent?.id || "a7_logics";
    const agentId = activeAgent?.id || activeAgent?.slug || "a7_logics";
    const agentName = activeAgent?.name;
    const persona = activeAgent?.tone || activeAgent?.persona;
    const systemPrompt = activeAgent?.system_prompt || activeAgent?.systemPrompt;

    try {
      const data: ChatResponsePayload = await sendChatMessage(
        text,
        sessionId,
        targetTenant,
        agentName,
        persona,
        agentId,
        systemPrompt
      );

      if (data.session_id && data.session_id !== sessionId) {
        setSessionId(data.session_id);
      }

      const assistantMessage: ChatMessage = {
        id: "ast-" + Date.now(),
        role: "assistant",
        content: data.answer,
        timestamp: new Date(data.timestamp || Date.now()).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
        sessionId: data.session_id,
      };

      setMessages((prev) => [...prev, assistantMessage]);

      if (!isOpen) {
        setHasUnread(true);
      }
    } catch (err: unknown) {
      console.error("Chat API error:", err);
      const errorMessage: ChatMessage = {
        id: "err-" + Date.now(),
        role: "assistant",
        content: `⚠️ **Connection Notice:** Unable to communicate with the ${activeAgent?.name || "NexusAgent"} service. Please ensure the backend server is active.`,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };


  // Header Title and Subtitle
  const cleanAgentName = getCleanAgentName(activeAgent?.name);
  const widgetTitle = activeAgent ? cleanAgentName : "NexusAgent Assistant";
  const widgetSubtitle =
    !activeAgent ||
      activeAgent.slug === "a7_logics" ||
      activeAgent.id === "a7_logics" ||
      activeAgent.name.toLowerCase().includes("a7 logics") ||
      activeAgent.name.toLowerCase().includes("nexusagent")
      ? "Executive Client Representative"
      : (typeof activeAgent.persona === "string" && activeAgent.persona.trim() && activeAgent.persona !== "Executive"
        ? activeAgent.persona
        : `${activeAgent.persona || activeAgent.tone || "Executive"} Client Representative`);

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
      {/* Chat Window Panel */}
      {isOpen && (
        <div
          className="mb-4 w-[420px] max-w-[calc(100vw-2rem)] h-[620px] max-h-[calc(100vh-6rem)] flex flex-col bg-[#0E1117] border border-[#30363D] rounded-2xl shadow-2xl shadow-black/80 overflow-hidden transition-all duration-300 animate-in fade-in slide-in-from-bottom-5"
          role="dialog"
          aria-label={widgetTitle}
        >
          {/* Header */}
          <div className="px-4 py-3.5 bg-gradient-to-r from-[#161B22] to-[#1F242C] border-b border-[#30363D] flex items-center justify-between select-none">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="relative shrink-0">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#FF6A00] to-[#E55F00] flex items-center justify-center font-black text-white text-xs shadow-md shadow-[#FF6A00]/20">
                  {activeAgent?.name ? activeAgent.name.charAt(0) : "NX"}
                </div>
                <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-[#161B22]" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <h3 className="font-bold text-sm text-white tracking-tight truncate">
                    {widgetTitle}
                  </h3>
                </div>
                <p className="text-[11px] text-[#94A3B8] leading-none mt-0.5 truncate">
                  {widgetSubtitle}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1 text-[#94A3B8] shrink-0">
              <button
                type="button"
                onClick={handleReset}
                title="Clear conversation history"
                className="p-1.5 hover:text-white hover:bg-[#21262D] rounded-lg transition-colors"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                title="Minimize chat"
                className="p-1.5 hover:text-white hover:bg-[#21262D] rounded-lg transition-colors"
              >
                <ChevronDown className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Messages Body */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#0E1117]">
            {messages.map((msg) => {
              const isUser = msg.role === "user";

              return (
                <div
                  key={msg.id}
                  className={`flex gap-2.5 ${isUser ? "flex-row-reverse" : "flex-row"}`}
                >
                  {/* Avatar */}
                  <div className="shrink-0 mt-0.5">
                    {isUser ? (
                      <div className="w-7 h-7 rounded-full bg-[#1F242C] border border-[#30363D] flex items-center justify-center text-[#94A3B8]">
                        <User className="w-3.5 h-3.5" />
                      </div>
                    ) : (
                      <div className="w-7 h-7 rounded-full bg-[#FF6A00]/20 border border-[#FF6A00]/40 flex items-center justify-center text-[#FF6A00]">
                        <Bot className="w-3.5 h-3.5" />
                      </div>
                    )}
                  </div>

                  {/* Message Bubble Content */}
                  <div
                    className={`max-w-[85%] rounded-2xl ${isUser
                        ? "px-4 py-2.5 bg-[#FF6A00] text-white rounded-tr-none font-medium shadow-sm"
                        : "px-3.5 py-2.5 bg-[#161B22] text-[#E6EDF3] border border-[#30363D] rounded-tl-none"
                      }`}
                  >
                    {/* Clean Markdown content */}
                    {isUser ? (
                      <p className="whitespace-pre-wrap leading-snug text-sm">{msg.content}</p>
                    ) : (
                      <div className="text-sm text-[#E6EDF3] leading-relaxed space-y-2 [&>p]:leading-relaxed [&>p]:mb-2 [&>p:last-child]:mb-0 [&>ul]:my-2 [&>ul]:list-disc [&>ul]:pl-5 [&>ul]:space-y-1.5 [&>ol]:my-2 [&>ol]:list-decimal [&>ol]:pl-5 [&>ol]:space-y-1.5 [&>li]:leading-relaxed [&>li]:text-[#E6EDF3] [&>strong]:text-white [&>strong]:font-semibold">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {msg.content}
                        </ReactMarkdown>
                      </div>
                    )}

                    {/* Clean Timestamp */}
                    <div
                      className={`mt-1 text-[10px] ${isUser ? "text-orange-100/70 text-right" : "text-[#6E7681] text-right"
                        }`}
                    >
                      {msg.timestamp}
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Typing / Thinking Indicator */}
            {isLoading && (
              <div className="flex gap-2.5">
                <div className="w-7 h-7 rounded-full bg-[#FF6A00]/20 border border-[#FF6A00]/40 flex items-center justify-center text-[#FF6A00] shrink-0 mt-0.5">
                  <Bot className="w-3.5 h-3.5 animate-pulse" />
                </div>
                <div className="bg-[#161B22] border border-[#30363D] rounded-2xl rounded-tl-none px-4 py-3 text-xs text-[#94A3B8] flex items-center gap-2">
                  <div className="flex gap-1 items-center">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#FF6A00] animate-bounce [animation-delay:-0.3s]" />
                    <span className="w-1.5 h-1.5 rounded-full bg-[#FF6A00] animate-bounce [animation-delay:-0.15s]" />
                    <span className="w-1.5 h-1.5 rounded-full bg-[#FF6A00] animate-bounce" />
                  </div>
                  <span>{widgetTitle} is thinking...</span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>


          {/* Chat Input Bar */}
          <div className="p-3 bg-[#161B22] border-t border-[#30363D]">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
              className="flex items-end gap-2"
            >
              <div className="flex-1 relative rounded-xl bg-[#0E1117] border border-[#30363D] focus-within:border-[#FF6A00] focus-within:ring-1 focus-within:ring-[#FF6A00] transition-all">
                <textarea
                  ref={inputRef}
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  rows={1}
                  placeholder={`Ask ${widgetTitle}...`}
                  className="w-full bg-transparent px-3 py-2 text-xs text-[#E6EDF3] placeholder-[#64748B] focus:outline-none resize-none max-h-24"
                  disabled={isLoading}
                />
              </div>

              <button
                type="submit"
                disabled={!inputValue.trim() || isLoading}
                className="h-9 w-9 rounded-xl bg-[#FF6A00] hover:bg-[#E55F00] active:scale-95 disabled:opacity-40 disabled:pointer-events-none flex items-center justify-center text-white shadow-md shadow-[#FF6A00]/25 transition-all shrink-0"
                aria-label="Send message"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>

            <div className="mt-1.5 flex items-center justify-between text-[10px] text-[#64748B] px-1">
              <span>Official {cleanAgentName}</span>
              <span>Press Enter to send</span>
            </div>
          </div>
        </div>
      )}

      {/* Floating Trigger Button (Bottom-Right) */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-label={isOpen ? `Close ${widgetTitle}` : `Open ${widgetTitle}`}
        className="relative group h-14 w-14 rounded-full bg-gradient-to-tr from-[#FF6A00] to-[#FF8C38] hover:from-[#E55F00] hover:to-[#FF6A00] text-white flex items-center justify-center shadow-xl shadow-[#FF6A00]/30 hover:scale-105 active:scale-95 transition-all duration-200 border-2 border-white/20"
      >
        {isOpen ? (
          <X className="w-6 h-6 transition-transform duration-200 group-hover:rotate-90" />
        ) : (
          <>
            <MessageSquare className="w-6 h-6" />
            {hasUnread && (
              <span className="absolute -top-1 -right-1 flex h-4 w-4">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-4 w-4 bg-emerald-500 border-2 border-[#0E1117]" />
              </span>
            )}
          </>
        )}

        {!isOpen && (
          <span className="absolute right-16 px-3 py-1.5 rounded-lg bg-[#161B22] border border-[#30363D] text-xs font-medium text-white shadow-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none">
            {activeAgent ? `Chat with ${activeAgent.name}` : "Chat with NexusAgent AI"}
          </span>
        )}
      </button>
    </div>
  );
}

export const ChatWidget: React.FC = () => {
  return (
    <Suspense fallback={null}>
      <ChatWidgetContent />
    </Suspense>
  );
};

export default ChatWidget;

