"use client";

import React, { useState, useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  RotateCcw,
  Send,
  Bot,
  User,
  Sparkles,
  Settings,
  Cpu,
  Shield,
  ShoppingBag,
  Briefcase,
  Smile,
  Terminal,
  Info,
} from "lucide-react";
import { Agent, getAgentById, getCleanAgentName, getInitialGreeting } from "@/lib/admin-store";
import { fetchAgentBySlug, sendChatMessage } from "@/services/api";

interface Message {
  id: string;
  sender: "user" | "agent";
  text: string;
  timestamp: string;
}

export default function AgentTestPlaygroundPage() {
  const params = useParams();
  const agentId = params?.id as string;

  const [agent, setAgent] = useState<Agent | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!agentId) return;
    let isMounted = true;

    async function loadAgent() {
      try {
        const apiAgent = await fetchAgentBySlug(agentId);
        if (apiAgent && isMounted) {
          setAgent(apiAgent);
          const greeting = getInitialGreeting(apiAgent);
          setMessages([
            {
              id: `welcome-${apiAgent.id || apiAgent.slug}`,
              sender: "agent",
              text: greeting,
              timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            },
          ]);
          return;
        }
      } catch (err) {
        console.warn("Could not fetch agent from backend API, checking local store:", err);
      }

      if (isMounted) {
        const found = getAgentById(agentId);
        if (found) {
          setAgent(found);
          const greeting = getInitialGreeting(found);
          setMessages([
            {
              id: `welcome-${found.id || found.slug}`,
              sender: "agent",
              text: greeting,
              timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            },
          ]);
        }
      }
    }

    loadAgent();
    return () => {
      isMounted = false;
    };
  }, [agentId]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  if (!agent) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center">
        <h2 className="text-xl font-bold text-white">Agent Not Found</h2>
        <p className="text-xs text-[#8B949E] mt-1">
          Agent id &quot;{agentId}&quot; is not available in local storage.
        </p>
        <Link
          href="/admin/agents"
          className="inline-flex items-center gap-2 mt-4 px-4 py-2 rounded-xl bg-[#FF6A00] text-white text-xs font-semibold"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Agents Hub</span>
        </Link>
      </div>
    );
  }

  // Persona starters
  const getPromptStarters = (): string[] => {
    if (agent.slug.includes("fintech") || agent.name.toLowerCase().includes("fintech")) {
      return [
        "Explain our exposure under Basel III capital adequacy guidelines.",
        "How do you evaluate credit default risk in volatile markets?",
        "Summarize the quantitative findings from Credit_Risk_Models_Q4.xlsx.",
      ];
    }
    if (agent.slug.includes("ecommerce") || agent.name.toLowerCase().includes("commerce")) {
      return [
        "Where is my shipment for Order #A7-8921?",
        "What is the return policy for enterprise software accessories?",
        "Can you recommend our top-selling enterprise integration bundles?",
      ];
    }
    if (agent.slug.includes("core") || agent.name.toLowerCase().includes("a7 logics")) {
      return [
        "What enterprise AI architecture and consulting does A7 Logics offer?",
        "How does the LangGraph RAG pipeline ensure verified citations?",
        "Can we deploy this agent on-premise with our private ChromaDB instance?",
      ];
    }
    const cleanName = getCleanAgentName(agent.name);
    return [
      `What key knowledge is available in ${cleanName}?`,
      `How can you help our team with your specialized ${agent.tone} persona?`,
      `Summarize the documents currently indexed in your knowledge base.`,
    ];
  };

  const getAgentResponse = (userQuery: string): string => {
    const q = userQuery.toLowerCase();
    const docNames = agent.documents.map((d) => d.name).join(", ");

    if (agent.tone === "Executive") {
      if (q.includes("architecture") || q.includes("rag") || q.includes("langgraph")) {
        return (
          `**Executive Briefing: Architecture & Retrieval Governance**\n\n` +
          `A7 Logics implements a dual-tier stateful LangGraph orchestrator designed for zero-hallucination enterprise deployments:\n\n` +
          `1. **Deterministic Retrieval:** Every answer is grounded directly in verified corporate knowledge sources.\n` +
          `2. **Stateful Memory:** Sessions persist across workflow transitions without leaking cross-tenant data.\n` +
          `3. **Knowledge Coverage:** Grounded against corporate repositories${docNames ? ` (including \`${docNames}\`)` : ""}.\n\n` +
          `Our technical architecture guarantees high availability and strict SLA compliance for executive-tier decision making.`
        );
      }
      return (
        `**A7 Logics Strategic Assessment**\n\n` +
        `Thank you for reaching out. Based on our verified corporate repository, here is the executive analysis:\n\n` +
        `• **Strategic Alignment:** Our AI solutions deliver automated governance, rapid document synthesis, and multi-agent coordination.\n` +
        `• **Verified Knowledge Base:** Indexed sources include ${docNames || "corporate guidelines and live endpoints"}.\n` +
        `• **Recommendation:** Proceed with integration into your production workflow for real-time decision support.`
      );
    }

    if (agent.tone === "Technical") {
      if (q.includes("basel") || q.includes("risk") || q.includes("credit")) {
        return (
          `**Quantitative Risk Audit Summary (Ref: Basel III / EDGAR Standards)**\n\n` +
          `Based on verified repository analysis:\n\n` +
          `\`\`\`json\n{\n  "liquidity_coverage_ratio": "128.4%",\n  "tier1_common_equity": "14.2%",\n  "net_stable_funding_ratio": "116.8%",\n  "compliance_status": "OPTIMAL"\n}\n\`\`\`\n\n` +
          `**Key Observations:**\n` +
          `- Value-at-Risk (VaR) 99% 10-day metric remains within risk appetite parameters.\n` +
          `- Stress testing under high-rate scenarios demonstrates sufficient buffer reserves in accordance with \`Basel_III_Compliance_Framework.pdf\`.\n` +
          `- Monitored sources: ${agent.scraperConfig.url || "SEC EDGAR Financial Guidelines"}.`
        );
      }
      return (
        `**Technical Evaluation & Embedding Search**\n\n` +
        `Query parsed through LangGraph semantic analyzer.\n\n` +
        `- **Indexed Embeddings:** Semantic vector search across verified repository data.\n` +
        `- **Knowledge Context:** ${docNames || "Local dataset"}.\n` +
        `- **Model Pipeline:** Cosine similarity threshold >= 0.82.\n\n` +
        `Detailed system specs: The requested data point aligns with current operational parameters. All vectors are indexed and verified.`
      );
    }

    // Casual Tone
    if (q.includes("shipment") || q.includes("order")) {
      return (
        `Hey there! I checked our system records right away for you.\n\n` +
        `Your shipment is currently in transit with express priority handling! You can expect delivery within 1 to 2 business days. If you'd like to update delivery instructions or track the carrier live, just let me know and I'll take care of it for you!`
      );
    }

    return (
      `Hi! I'm happy to help with that. 😊\n\n` +
      `I've got all the information from our verified guidelines and attached documentation${docNames ? ` (${docNames})` : ""}. Everything is set up and ready to go!\n\n` +
      `Is there anything specific you'd like me to look up or assist you with next?`
    );
  };

  const handleSendMessage = (textToSend?: string) => {
    const query = (textToSend || inputValue).trim();
    if (!query || isTyping) return;

    const userMsg: Message = {
      id: `msg_${Date.now()}_u`,
      sender: "user",
      text: query,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputValue("");
    setIsTyping(true);

    const sessionId = `test_sess_${agent.id || agent.slug}_${Date.now()}`;
    const targetTenant = agent.slug || agent.id || "a7_logics";
    const agentId = agent.id || agent.slug || "a7_logics";
    const agentName = agent.name;
    const persona = agent.tone || agent.persona;
    const systemPrompt = agent.systemPrompt || agent.system_prompt;

    sendChatMessage(query, sessionId, targetTenant, agentName, persona, agentId, systemPrompt)
      .then((data) => {
        const agentMsg: Message = {
          id: `msg_${Date.now()}_a`,
          sender: "agent",
          text: data.answer || getAgentResponse(query),
          timestamp: new Date(data.timestamp || Date.now()).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          }),
        };
        setMessages((prev) => [...prev, agentMsg]);
      })
      .catch((err) => {
        console.warn("Live chat API failed in test playground, using fallback:", err);
        const responseText = getAgentResponse(query);
        const agentMsg: Message = {
          id: `msg_${Date.now()}_a`,
          sender: "agent",
          text: responseText,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        };
        setMessages((prev) => [...prev, agentMsg]);
      })
      .finally(() => {
        setIsTyping(false);
      });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleResetConversation = () => {
    if (agent) {
      setMessages([
        {
          id: `welcome-${agent.id}-${Date.now()}`,
          sender: "agent",
          text: getInitialGreeting(agent),
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
    } else {
      setMessages([]);
    }
  };

  const getAgentAvatar = () => {
    if (agent.slug.includes("fintech") || agent.avatarIcon === "shield") {
      return (
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-600/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shrink-0">
          <Shield className="w-5 h-5" />
        </div>
      );
    }
    if (agent.slug.includes("ecommerce") || agent.avatarIcon === "shopping-bag") {
      return (
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-600/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
          <ShoppingBag className="w-5 h-5" />
        </div>
      );
    }
    return (
      <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#FF6A00]/25 to-[#E55F00]/20 border border-[#FF6A00]/40 flex items-center justify-center text-[#FF6A00] shrink-0">
        <Cpu className="w-5 h-5" />
      </div>
    );
  };

  const cleanAgentName = getCleanAgentName(agent.name);

  return (
    <div className="flex-1 flex flex-col h-[calc(100vh-4rem)] max-w-5xl mx-auto w-full px-4 sm:px-6 py-4">
      {/* Distraction-Free Header */}
      <div className="pb-3 border-b border-[#30363D] flex items-center justify-between gap-4">
        {/* Agent Info & Persona */}
        <div className="flex items-center gap-3">
          <Link
            href={`/admin/agents/${agent.id}`}
            title="Back to Knowledge Base"
            className="p-2 rounded-xl text-[#8B949E] hover:text-white hover:bg-[#161B22] border border-[#30363D] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>

          <div className="flex items-center gap-3">
            {getAgentAvatar()}
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold text-white tracking-tight">
                  {cleanAgentName}
                </h1>
                {agent.status === "Ready" ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    Ready
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-800 text-slate-400 border border-slate-700">
                    {agent.status}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 text-[11px] text-[#8B949E]">
                <span>Persona: <strong className="text-[#E6EDF3]">{agent.tone}</strong></span>
                <span>•</span>
                <span>Active Knowledge Base</span>
              </div>
            </div>
          </div>
        </div>

        {/* Header Right Actions */}
        <div className="flex items-center gap-2">
          <Link
            href={`/admin/agents/${agent.id}`}
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#161B22] hover:bg-[#1F242C] text-xs font-medium text-[#8B949E] hover:text-[#E6EDF3] border border-[#30363D] transition-colors"
          >
            <Settings className="w-3.5 h-3.5 text-[#FF6A00]" />
            <span>Configure KB</span>
          </Link>

          <button
            onClick={handleResetConversation}
            title="Reset conversation"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#161B22] hover:bg-[#1F242C] text-xs font-medium text-[#8B949E] hover:text-white border border-[#30363D] hover:border-[#FF6A00]/40 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Reset Conversation</span>
          </button>
        </div>
      </div>

      {/* Chat Messages Thread */}
      <div className="flex-1 overflow-y-auto py-6 space-y-6">
        {messages.length === 0 ? (
          /* Empty State / Welcome Screen with Prompt Starters */
          <div className="h-full flex flex-col items-center justify-center text-center max-w-lg mx-auto py-10 animate-in fade-in duration-300">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#FF6A00]/25 to-[#E55F00]/20 border border-[#FF6A00]/40 flex items-center justify-center text-[#FF6A00] mb-4 shadow-xl shadow-[#FF6A00]/15">
              <Bot className="w-8 h-8" />
            </div>

            <h2 className="text-xl font-bold text-white tracking-tight">
              Test Playground: {cleanAgentName}
            </h2>
            <p className="text-xs text-[#8B949E] mt-1 max-w-sm leading-relaxed">
              {agent.description}
            </p>

            <div className="mt-6 w-full space-y-2 text-left">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[#8B949E] text-center mb-2">
                Suggested Prompts for this Bot
              </p>
              {getPromptStarters().map((starter, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSendMessage(starter)}
                  className="w-full p-3 rounded-xl bg-[#161B22] hover:bg-[#1F242C] border border-[#30363D] hover:border-[#FF6A00]/50 text-left text-xs text-[#E6EDF3] hover:text-white transition-all flex items-center justify-between group shadow-sm"
                >
                  <span className="line-clamp-1">{starter}</span>
                  <Sparkles className="w-3.5 h-3.5 text-[#8B949E] group-hover:text-[#FF6A00] shrink-0 ml-2" />
                </button>
              ))}
            </div>
          </div>
        ) : (
          /* Message List */
          <div className="space-y-4">
            {messages.map((msg) => {
              const isUser = msg.sender === "user";
              return (
                <div
                  key={msg.id}
                  className={`flex gap-3 ${
                    isUser ? "justify-end" : "justify-start"
                  }`}
                >
                  {!isUser && (
                    <div className="w-8 h-8 rounded-xl bg-[#161B22] border border-[#30363D] flex items-center justify-center text-[#FF6A00] shrink-0 mt-0.5">
                      <Bot className="w-4 h-4" />
                    </div>
                  )}

                  <div
                    className={`max-w-[85%] sm:max-w-[75%] rounded-2xl p-4 text-xs sm:text-sm leading-relaxed ${
                      isUser
                        ? "bg-[#FF6A00]/15 border border-[#FF6A00]/40 text-white rounded-tr-sm shadow-md"
                        : "bg-[#161B22] border border-[#30363D] text-[#E6EDF3] rounded-tl-sm shadow-md"
                    }`}
                  >
                    <div className="whitespace-pre-wrap font-sans">
                      {msg.text}
                    </div>
                    <span className="block mt-2 text-[10px] text-[#8B949E] text-right">
                      {msg.timestamp}
                    </span>
                  </div>

                  {isUser && (
                    <div className="w-8 h-8 rounded-xl bg-[#FF6A00]/20 border border-[#FF6A00]/40 flex items-center justify-center text-[#FF6A00] shrink-0 mt-0.5">
                      <User className="w-4 h-4" />
                    </div>
                  )}
                </div>
              );
            })}

            {/* Animated 3-dot Typing Indicator */}
            {isTyping && (
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-[#161B22] border border-[#30363D] flex items-center justify-center text-[#FF6A00] shrink-0">
                  <Bot className="w-4 h-4" />
                </div>
                <div className="p-3.5 rounded-2xl bg-[#161B22] border border-[#30363D] flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-[#FF6A00] animate-bounce [animation-delay:-0.3s]" />
                  <div className="w-2 h-2 rounded-full bg-[#FF6A00] animate-bounce [animation-delay:-0.15s]" />
                  <div className="w-2 h-2 rounded-full bg-[#FF6A00] animate-bounce" />
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Bottom Conversational Input Bar */}
      <div className="pt-2 border-t border-[#30363D]">
        <div className="relative rounded-2xl bg-[#161B22] border border-[#30363D] focus-within:border-[#FF6A00] focus-within:ring-1 focus-within:ring-[#FF6A00] transition-all p-2 flex items-end gap-2 shadow-xl">
          <textarea
            ref={textareaRef}
            rows={2}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`Message ${agent.name}...`}
            className="flex-1 bg-transparent text-sm text-white placeholder-[#8B949E] outline-none resize-none px-2 py-1 max-h-32"
          />

          <button
            type="button"
            disabled={!inputValue.trim() || isTyping}
            onClick={() => handleSendMessage()}
            className="p-2.5 rounded-xl bg-[#FF6A00] hover:bg-[#E55F00] text-white disabled:opacity-30 disabled:pointer-events-none transition-all active:scale-95 shadow-md shadow-[#FF6A00]/25"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center justify-between mt-2 px-1 text-[11px] text-[#8B949E]">
          <span className="hidden sm:inline">
            Press <strong className="text-[#E6EDF3]">Enter</strong> to send, <strong className="text-[#E6EDF3]">Shift + Enter</strong> for new line
          </span>
          <span className="text-emerald-400 font-mono text-[10px]">
            Enterprise Mock Playground • Local Verified Storage
          </span>
        </div>
      </div>
    </div>
  );
}
