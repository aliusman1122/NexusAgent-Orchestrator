"use client";

import React, { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Globe,
  UploadCloud,
  FileText,
  FileSpreadsheet,
  Trash2,
  Play,
  CheckCircle2,
  AlertCircle,
  Database,
  RefreshCw,
  Sparkles,
  Layers,
  File,
  Cpu,
  Shield,
  ShoppingBag,
  ExternalLink,
  Plus,
  Edit3,
  Eye,
  EyeOff,
  Check,
  X,
  MessageSquare,
  Bot,
  ChevronDown,
  ChevronUp,
  Key,
  Save,
  Code,
  Copy,
  BookOpen,
} from "lucide-react";
import {
  Agent,
  KnowledgeDocument,
  getAgentById,
  updateAgent,
  addDocumentToAgent,
  removeDocumentFromAgent,
  getCleanAgentName,
  getInitialGreeting,
} from "@/lib/admin-store";
import {
  fetchScrapePreview,
  ingestAgentContent,
  uploadAgentKnowledgeBase,
  fetchAgentSources,
  deleteAgentSource,
  updateAgentSource,
  updateAgentInApi,
  fetchAgentBySlug,
} from "@/services/api";
import { SourceItem, ScrapePreviewResponse } from "@/types/chat";

const PROVIDER_OPTIONS = [
  { id: "gemini", name: "Google Gemini (Direct)", icon: Cpu, badge: "AI Studio Free Tier" },
  { id: "groq", name: "Groq Cloud LPU", icon: Bot, badge: "Ultra-Fast Inference" },
  { id: "openrouter", name: "OpenRouter Gateway", icon: Globe, badge: "Multi-Model Hub" },
];

const MODEL_CATALOG: Record<string, { id: string; name: string; context: string }[]> = {
  gemini: [
    { id: "gemini-1.5-flash", name: "Google Gemini Flash (Gemini 1.5 Flash)", context: "1049k ctx" },
    { id: "gemini-1.5-pro", name: "Google Gemini Pro (Gemini 1.5 Pro)", context: "2097k ctx" },
    { id: "gemini-2.0-flash-exp", name: "Google Gemini 2.0 Flash (Experimental)", context: "1049k ctx" },
  ],
  groq: [
    { id: "llama-3.3-70b-versatile", name: "Meta Llama 3.3 70B Versatile", context: "128k ctx" },
    { id: "llama-3.1-8b-instant", name: "Meta Llama 3.1 8B Instant", context: "128k ctx" },
    { id: "mixtral-8x7b-32768", name: "Mistral MoE 8x7B (Mixtral 8x7b)", context: "32k ctx" },
  ],
  openrouter: [
    { id: "anthropic/claude-3.5-sonnet", name: "Anthropic Claude 3.5 Sonnet", context: "200k ctx" },
    { id: "openai/gpt-4o", name: "OpenAI GPT-4o", context: "128k ctx" },
    { id: "meta-llama/llama-3.3-70b-instruct", name: "Meta Llama 3.3 70B Instruct", context: "128k ctx" },
  ],
};

export default function AgentKnowledgeBasePage() {
  const params = useParams();
  const router = useRouter();
  const agentId = params?.id as string;

  const [agent, setAgent] = useState<Agent | null>(null);
  const [scraperUrl, setScraperUrl] = useState("");
  const [crawlType, setCrawlType] = useState<"single" | "deep">("single");

  // Web Scraping Preview & Proofreading State
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [previewData, setPreviewData] = useState<ScrapePreviewResponse | null>(null);
  const [previewText, setPreviewText] = useState("");
  const [isIngestingText, setIsIngestingText] = useState(false);

  // Direct Text / Note Ingestion State
  const [noteTitle, setNoteTitle] = useState("");
  const [noteContent, setNoteContent] = useState("");
  const [isIngestingNote, setIsIngestingNote] = useState(false);

  // File Upload Ingestion state
  const [isIngestingFiles, setIsIngestingFiles] = useState(false);
  const [fileIngestProgress, setFileIngestProgress] = useState(0);
  const [fileIngestStage, setFileIngestStage] = useState("");

  // Drag & drop & staged files
  const [isDragging, setIsDragging] = useState(false);
  const [stagedFiles, setStagedFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Live Knowledge Sources state
  const [activeSources, setActiveSources] = useState<SourceItem[]>([]);
  const [isLoadingSources, setIsLoadingSources] = useState(false);
  const [isRefreshingSources, setIsRefreshingSources] = useState(false);
  const [deletingSource, setDeletingSource] = useState<string | null>(null);

  // Edit / View Knowledge Source Modal State
  const [editingSource, setEditingSource] = useState<SourceItem | null>(null);
  const [editContent, setEditContent] = useState("");
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Custom Agent Instructions / System Prompt State
  const [systemPrompt, setSystemPrompt] = useState("");
  const [savedPrompt, setSavedPrompt] = useState("");
  const [isSavingPrompt, setIsSavingPrompt] = useState(false);

  // Initial Welcome / Greeting State
  const [welcomeMessage, setWelcomeMessage] = useState("");
  const [savedWelcome, setSavedWelcome] = useState("");
  const [isSavingWelcome, setIsSavingWelcome] = useState(false);

  // Notification message
  const [saveNotice, setSaveNotice] = useState<string | null>(null);
  const [isLoadingAgent, setIsLoadingAgent] = useState(true);
  const [notFoundNotice, setNotFoundNotice] = useState<string | null>(null);

  // Active Tab State ("setup" | "knowledge" | "provider" | "embed")
  const [activeTab, setActiveTab] = useState<"setup" | "knowledge" | "provider" | "embed">("setup");

  // Per-Agent Dedicated Client AI Provider (BYOK) State
  const [customLlmEnabled, setCustomLlmEnabled] = useState(false);
  const [customProvider, setCustomProvider] = useState("gemini");
  const [customModel, setCustomModel] = useState("gemini-1.5-flash");
  const [customApiKey, setCustomApiKey] = useState("");
  const [showCustomApiKey, setShowCustomApiKey] = useState(false);
  const [isSavingCustomLlm, setIsSavingCustomLlm] = useState(false);

  // Embeddable Chat Widget State
  const [embedPosition, setEmbedPosition] = useState<"bottom-right" | "bottom-left" | "top-right" | "top-left">("bottom-right");
  const [isPositionDropdownOpen, setIsPositionDropdownOpen] = useState(false);
  const [isSetupGuideModalOpen, setIsSetupGuideModalOpen] = useState(false);
  const [isSetupBuildersOpen, setIsSetupBuildersOpen] = useState(false);
  const [hasCopiedSnippet, setHasCopiedSnippet] = useState(false);

  // Load agent on mount directly from PostgreSQL backend API
  useEffect(() => {
    if (!agentId) return;

    let isMounted = true;
    let redirectTimer: NodeJS.Timeout | null = null;

    async function loadAgentDetails() {
      setIsLoadingAgent(true);
      try {
        const apiAgent = await fetchAgentBySlug(agentId);
        if (apiAgent && isMounted) {
          setAgent(apiAgent);
          setScraperUrl(apiAgent.scraperConfig?.url || apiAgent.targetUrl || "");
          setCrawlType(apiAgent.scraperConfig?.crawlType || "single");
          const initPrompt = (apiAgent as any).system_prompt || (apiAgent as any).systemPrompt || "";
          setSystemPrompt(initPrompt);
          setSavedPrompt(initPrompt);
          const initWelcome = (apiAgent as any).welcome_message || (apiAgent as any).welcomeMessage || "";
          setWelcomeMessage(initWelcome);
          setSavedWelcome(initWelcome);
          setCustomLlmEnabled(!!apiAgent.custom_llm_enabled);
          setCustomProvider(apiAgent.custom_llm_provider || "gemini");
          setCustomModel(apiAgent.custom_llm_model || "gemini-1.5-flash");
          setCustomApiKey(apiAgent.custom_llm_api_key || "");
          loadLiveSources(apiAgent.slug || apiAgent.id);
          setIsLoadingAgent(false);
          return;
        }
      } catch (err) {
        console.warn("Could not fetch agent by slug from backend API, checking local store:", err);
      }

      if (isMounted) {
        const found = getAgentById(agentId);
        if (found) {
          setAgent(found);
          setScraperUrl(found.scraperConfig?.url || "");
          setCrawlType(found.scraperConfig?.crawlType || "single");
          const initPrompt = (found as any).systemPrompt || (found as any).system_prompt || "";
          setSystemPrompt(initPrompt);
          setSavedPrompt(initPrompt);
          const initWelcome = (found as any).welcome_message || (found as any).welcomeMessage || "";
          setWelcomeMessage(initWelcome);
          setSavedWelcome(initWelcome);
          setCustomLlmEnabled(!!found.custom_llm_enabled);
          setCustomProvider(found.custom_llm_provider || "gemini");
          setCustomModel(found.custom_llm_model || "gemini-1.5-flash");
          setCustomApiKey(found.custom_llm_api_key || "");
          loadLiveSources(found.slug || found.id);
          setIsLoadingAgent(false);
          return;
        }

        // Both backend API and local store failed to find the agent (404 / Not Found)
        setNotFoundNotice("Agent not found. Redirecting to dashboard...");
        setIsLoadingAgent(false);
        redirectTimer = setTimeout(() => {
          router.push("/admin/agents");
        }, 1200);
      }
    }

    loadAgentDetails();
    return () => {
      isMounted = false;
      if (redirectTimer) clearTimeout(redirectTimer);
    };
  }, [agentId, router]);

  // Load active sources from ChromaDB
  const loadLiveSources = async (tenantId: string) => {
    setIsLoadingSources(true);
    try {
      const res = await fetchAgentSources(tenantId);
      setActiveSources(res.sources || []);
      // Sync chunks count if returned from vector store
      if (res.total_chunks !== undefined) {
        updateAgent(tenantId, { chunksCount: res.total_chunks });
        const refreshed = getAgentById(tenantId);
        if (refreshed) setAgent(refreshed);
      }
    } catch (err) {
      console.warn("Could not fetch live ChromaDB sources:", err);
    } finally {
      setIsLoadingSources(false);
    }
  };

  const handleRefreshSources = async () => {
    if (!agent) return;
    setIsRefreshingSources(true);
    try {
      await loadLiveSources(agent.slug || agent.id);
      // Ensure at least 600ms of visual spin so the user clearly sees the action
      await new Promise((resolve) => setTimeout(resolve, 600));
    } catch (err) {
      console.error("Failed to refresh sources:", err);
    } finally {
      setIsRefreshingSources(false);
    }
  };

  const showNotice = (msg: string) => {
    setSaveNotice(msg);
    setTimeout(() => {
      setSaveNotice(null);
    }, 4000);
  };

  if (isLoadingAgent) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-24 text-center flex flex-col items-center justify-center gap-3 animate-in fade-in duration-150">
        <RefreshCw className="w-8 h-8 text-[#FF6A00] animate-spin" />
        <p className="text-sm font-medium text-[#8B949E]">Loading agent configuration...</p>
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 text-center relative flex flex-col items-center justify-center animate-in fade-in duration-200">
        {notFoundNotice && (
          <div className="fixed top-5 right-5 z-50 p-4 rounded-xl bg-amber-950/90 border border-amber-500/40 text-amber-300 text-sm shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-top-2 duration-200">
            <AlertCircle className="w-5 h-5 text-amber-400 shrink-0" />
            <span>{notFoundNotice}</span>
          </div>
        )}

        <div className="w-14 h-14 mx-auto rounded-2xl bg-[#161B22] border border-[#30363D] flex items-center justify-center text-amber-400 mb-4 shadow-lg shadow-black/20">
          <AlertCircle className="w-7 h-7 text-amber-400" />
        </div>

        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-xs font-semibold text-amber-400 mb-2">
          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
          <span>{notFoundNotice || "Agent not found. Redirecting to dashboard..."}</span>
        </div>

        <h2 className="text-2xl font-bold text-white tracking-tight mt-1">Agent Not Found</h2>
        <p className="text-sm text-[#8B949E] mt-1.5 max-w-md leading-relaxed">
          The requested agent &quot;{agentId}&quot; does not exist in the database or local storage. You are being redirected to the dashboard.
        </p>
        <Link
          href="/admin/agents"
          className="inline-flex items-center gap-2 mt-5 px-5 py-2.5 rounded-xl bg-[#FF6A00] hover:bg-[#E55F00] text-white text-xs font-semibold shadow-lg shadow-[#FF6A00]/25 transition-all"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Return to Agents Hub Immediately</span>
        </Link>
      </div>
    );
  }

  // 1. Scrape Preview Handler
  const handleFetchPreview = async () => {
    const cleanUrl = scraperUrl.trim();
    if (!cleanUrl) {
      showNotice("Please enter a valid website or documentation URL.");
      return;
    }

    setIsPreviewLoading(true);
    try {
      const data = await fetchScrapePreview(cleanUrl, crawlType);
      setPreviewData(data);
      setPreviewText(data.extracted_text || "");
      showNotice(`Successfully fetched text from "${data.extracted_title || cleanUrl}". Proofread below before adding.`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to fetch website content";
      showNotice(`Preview Error: ${msg}`);
    } finally {
      setIsPreviewLoading(false);
    }
  };

  // 2. Ingest Approved Scraped / Custom Text
  const handleIngestApprovedText = async () => {
    if (!previewText.trim()) {
      showNotice("Extracted text is empty. Add content before ingesting.");
      return;
    }

    setIsIngestingText(true);
    const tenantId = agent.slug || agent.id;
    const sourceName = previewData?.target_url || scraperUrl.trim() || "Web Documentation";

    try {
      const res = await ingestAgentContent(tenantId, {
        source_type: "web_text",
        source_name: sourceName,
        content: previewText,
        agent_name: agent.name,
        persona: agent.tone,
      });

      // Update local storage status and chunks
      updateAgent(agent.id, {
        status: "Ready",
        chunksCount: res.total_chunks,
        scraperConfig: {
          url: scraperUrl.trim(),
          crawlType,
          lastCrawled: new Date().toISOString(),
        },
      });

      const refreshed = getAgentById(agent.id);
      if (refreshed) setAgent(refreshed);

      showNotice(`Added ${res.chunks_added} chunks to knowledge base! (Total: ${res.total_chunks})`);
      setPreviewData(null);
      setPreviewText("");
      await loadLiveSources(tenantId);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Ingestion failed";
      showNotice(`Ingestion Error: ${msg}`);
    } finally {
      setIsIngestingText(false);
    }
  };

  // 2b. Direct Note Ingestion Handler
  const handleIngestDirectNote = async () => {
    const cleanContent = noteContent.trim();
    if (!cleanContent) {
      showNotice("Please enter Content / Guidelines for the note.");
      return;
    }

    const firstLine = cleanContent.split("\n")[0].trim();
    const cleanTitle =
      noteTitle.trim() ||
      (firstLine.length > 40 ? `${firstLine.slice(0, 40)}...` : firstLine) ||
      `Quick Note - ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;

    setIsIngestingNote(true);
    const tenantId = agent.slug || agent.id;

    try {
      const res = await ingestAgentContent(tenantId, {
        source_type: "raw_note",
        source_name: cleanTitle,
        content: cleanContent,
        agent_name: agent.name,
        persona: agent.tone,
      });

      // Update local storage status and chunks
      updateAgent(agent.id, {
        status: "Ready",
        chunksCount: res.total_chunks,
      });

      const refreshed = getAgentById(agent.id);
      if (refreshed) setAgent(refreshed);

      showNotice(`Successfully added note "${cleanTitle}" (${res.chunks_added} chunks)! Total: ${res.total_chunks}`);
      setNoteTitle("");
      setNoteContent("");
      await loadLiveSources(tenantId);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to add note";
      showNotice(`Direct Note Error: ${msg}`);
    } finally {
      setIsIngestingNote(false);
    }
  };

  // Open Edit Modal
  const handleOpenEditModal = (source: SourceItem) => {
    setEditingSource(source);
    setEditContent(source.raw_content || "");
  };

  // Close Edit Modal
  const handleCloseEditModal = () => {
    setEditingSource(null);
    setEditContent("");
  };

  // Save and Re-Index Edited Source
  const handleSaveEditedSource = async () => {
    if (!editingSource) return;
    const cleanContent = editContent.trim();
    if (!cleanContent) {
      showNotice("Source content cannot be empty.");
      return;
    }

    setIsSavingEdit(true);
    const tenantId = agent.slug || agent.id;
    const sourceIdentifier = editingSource.id || editingSource.source_name;

    try {
      const res = await updateAgentSource(tenantId, sourceIdentifier, cleanContent);
      showNotice(`Source "${editingSource.source_name}" updated & re-indexed (${res.chunks_count} chunks)!`);
      handleCloseEditModal();
      await loadLiveSources(tenantId);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to update source";
      showNotice(`Update Error: ${msg}`);
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Save Custom Agent Instructions / System Prompt
  const handleSaveSystemPrompt = async () => {
    if (!agent) return;
    setIsSavingPrompt(true);
    const tenantSlug = agent.slug || agent.id;
    const cleanPrompt = systemPrompt.trim();
    try {
      // 1. Update in PostgreSQL backend API
      await updateAgentInApi(tenantSlug, {
        system_prompt: cleanPrompt,
      });

      // 2. Update in local store
      updateAgent(agent.id, {
        systemPrompt: cleanPrompt,
        system_prompt: cleanPrompt,
      });

      const refreshed = getAgentById(agent.id);
      if (refreshed) setAgent(refreshed);

      setSavedPrompt(cleanPrompt);
      showNotice("Custom instructions saved to agent system prompt!");
    } catch (err: unknown) {
      console.warn("Backend API error saving system prompt, saving to local store:", err);
      updateAgent(agent.id, {
        systemPrompt: cleanPrompt,
        system_prompt: cleanPrompt,
      });
      const refreshed = getAgentById(agent.id);
      if (refreshed) setAgent(refreshed);
      setSavedPrompt(cleanPrompt);
      showNotice("Custom instructions saved to agent profile!");
    } finally {
      setIsSavingPrompt(false);
    }
  };

  const handleSaveWelcomeMessage = async () => {
    if (!agent) return;
    setIsSavingWelcome(true);
    const tenantSlug = agent.slug || agent.id;
    const cleanWelcome = welcomeMessage.trim();
    try {
      const updated = await updateAgentInApi(tenantSlug, {
        welcome_message: cleanWelcome,
      });

      updateAgent(agent.id, {
        welcome_message: cleanWelcome,
        welcomeMessage: cleanWelcome,
      });

      setAgent((prev) => (prev ? { ...prev, welcome_message: cleanWelcome, welcomeMessage: cleanWelcome, ...(updated || {}) } : null));
      setSavedWelcome(cleanWelcome);
      showNotice("Welcome greeting saved successfully");
    } catch (err: unknown) {
      console.warn("Backend API error saving welcome message, saving to local store:", err);
      updateAgent(agent.id, {
        welcome_message: cleanWelcome,
        welcomeMessage: cleanWelcome,
      });
      setAgent((prev) => (prev ? { ...prev, welcome_message: cleanWelcome, welcomeMessage: cleanWelcome } : null));
      setSavedWelcome(cleanWelcome);
      showNotice("Welcome greeting saved successfully");
    } finally {
      setIsSavingWelcome(false);
    }
  };

  const handleCustomProviderChange = (newProvider: string) => {
    setCustomProvider(newProvider);
    const defaultModel = MODEL_CATALOG[newProvider]?.[0]?.id || "";
    setCustomModel(defaultModel);
  };

  const handleSaveCustomLlm = async () => {
    if (!agent) return;
    setIsSavingCustomLlm(true);
    const tenantSlug = agent.slug || agent.id;
    const payload = {
      custom_llm_enabled: customLlmEnabled,
      custom_llm_provider: customProvider,
      custom_llm_model: customModel,
      custom_llm_api_key: customApiKey.trim(),
    };

    try {
      // 1. Update backend API
      await updateAgentInApi(tenantSlug, payload);

      // 2. Update local storage
      updateAgent(agent.id, payload);

      const refreshed = getAgentById(agent.id);
      if (refreshed) {
        setAgent(refreshed);
      } else {
        setAgent((prev) => (prev ? { ...prev, ...payload } : null));
      }
      showNotice(
        customLlmEnabled
          ? `Dedicated client AI configuration saved! Agent is now powered by ${customProvider.toUpperCase()} (${customModel}).`
          : "Agent updated to use Platform Universal AI Provider default!"
      );
    } catch (err: unknown) {
      console.warn("Backend API error saving custom LLM, saving to local store:", err);
      updateAgent(agent.id, payload);
      const refreshed = getAgentById(agent.id);
      if (refreshed) {
        setAgent(refreshed);
      } else {
        setAgent((prev) => (prev ? { ...prev, ...payload } : null));
      }
      showNotice(
        customLlmEnabled
          ? `Saved dedicated client AI config (Local)! Agent is powered by ${customProvider.toUpperCase()}.`
          : "Agent updated to use Platform Universal AI Provider default (Local)!"
      );
    } finally {
      setIsSavingCustomLlm(false);
    }
  };

  // Handle Drag & Drop
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFiles(Array.from(e.dataTransfer.files));
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFiles(Array.from(e.target.files));
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + " B";
    const kb = bytes / 1024;
    if (kb < 1024) return kb.toFixed(1) + " KB";
    return (kb / 1024).toFixed(1) + " MB";
  };

  const processFiles = (files: File[]) => {
    const validExtensions = ["pdf", "docx", "xlsx", "txt", "md", "csv"];
    const accepted: File[] = [];

    files.forEach((file) => {
      const ext = file.name.split(".").pop()?.toLowerCase() || "";
      if (validExtensions.includes(ext)) {
        accepted.push(file);
        addDocumentToAgent(agent.id, {
          name: file.name,
          size: formatFileSize(file.size),
          type: ext,
        });
      }
    });

    if (accepted.length > 0) {
      setStagedFiles((prev) => [...prev, ...accepted]);
    }

    const refreshed = getAgentById(agent.id);
    if (refreshed) setAgent(refreshed);
    showNotice(`${accepted.length} file(s) staged. Click "Upload & Ingest Selected Files" to vectorize.`);
  };

  const addSampleDoc = () => {
    const samples = [
      {
        name: "Enterprise_SLA_Policies_2026.txt",
        size: "3.4 KB",
        type: "txt",
        content:
          "Enterprise SLA Policies 2026:\nA7 Logics guarantees 99.99% system availability with a maximum 1-hour P1 resolution response window. Dedicated technical account management and round-the-clock priority routing are standard across all enterprise tiers.",
      },
      {
        name: "Executive_Q1_Roadmap_Review.txt",
        size: "1.8 KB",
        type: "txt",
        content:
          "Executive Q1 Roadmap Review:\nKey strategic priorities include autonomous multi-agent orchestration, multi-tenant vector partitioning, dynamic tone adaptation, and sub-100ms vector retrieval benchmarks across enterprise clusters.",
      },
      {
        name: "Financial_Audit_Metrics_Q4.txt",
        size: "2.9 KB",
        type: "txt",
        content:
          "Financial Audit Metrics Q4:\nOperating revenue grew 42% YoY with net margin of 28.5%. Risk mitigation reserves strictly comply with Basel III standard capital adequacy guidelines and stress testing frameworks.",
      },
    ];
    const pick = samples[Math.floor(Math.random() * samples.length)];
    const sampleBlob = new Blob([pick.content], { type: "text/plain" });
    const sampleFile = new window.File([sampleBlob], pick.name, { type: "text/plain" });

    setStagedFiles((prev) => [...prev, sampleFile]);
    addDocumentToAgent(agent.id, {
      name: pick.name,
      size: pick.size,
      type: pick.type,
    });
    const refreshed = getAgentById(agent.id);
    if (refreshed) setAgent(refreshed);
    showNotice(`Added sample document: ${pick.name}`);
  };

  const handleRemoveStagedFile = (fileName: string) => {
    setStagedFiles((prev) => prev.filter((f) => f.name !== fileName));
    // Also remove from agent documents if present
    const doc = agent.documents.find((d) => d.name === fileName);
    if (doc) {
      removeDocumentFromAgent(agent.id, doc.id);
      const refreshed = getAgentById(agent.id);
      if (refreshed) setAgent(refreshed);
    }
  };

  // 3. Incremental File Upload Handler
  const handleIngestStagedFiles = async () => {
    if (stagedFiles.length === 0) {
      showNotice("No staged files to upload. Drag and drop or browse files first.");
      return;
    }

    setIsIngestingFiles(true);
    setFileIngestProgress(15);
    setFileIngestStage("Phase 1/3: Staging multipart payload & uploading files...");

    const tenantId = agent.slug || agent.id;
    const formData = new FormData();
    if (agent.name) formData.append("agent_name", agent.name);
    if (agent.tone) formData.append("persona", agent.tone);

    stagedFiles.forEach((file) => {
      formData.append("files", file, file.name);
    });

    const timer = setInterval(() => {
      setFileIngestProgress((p) => {
        if (p >= 85) return p;
        if (p >= 40) setFileIngestStage("Phase 2/3: Chunking documents & creating dense embeddings...");
        if (p >= 70) setFileIngestStage("Phase 3/3: Appending vectors to ChromaDB collection...");
        return p + 10;
      });
    }, 300);

    try {
      const result = await uploadAgentKnowledgeBase(tenantId, formData);
      clearInterval(timer);
      setFileIngestProgress(100);
      setFileIngestStage(`Ingestion complete: Indexed ${result.chunks_indexed} total chunks.`);

      // Update store
      updateAgent(agent.id, {
        status: "Ready",
        chunksCount: result.chunks_indexed,
      });
      const refreshed = getAgentById(agent.id);
      if (refreshed) setAgent(refreshed);

      setStagedFiles([]);
      showNotice(`Successfully indexed ${result.files_processed} file(s)! Total chunks: ${result.chunks_indexed}`);
      await loadLiveSources(tenantId);
    } catch (err: unknown) {
      clearInterval(timer);
      const msg = err instanceof Error ? err.message : "File ingestion failed";
      setFileIngestStage(`Error: ${msg}`);
      showNotice(`Upload error: ${msg}`);
    } finally {
      setIsIngestingFiles(false);
    }
  };

  // 4. Delete Source Handler
  const handleDeleteSource = async (sourceName: string) => {
    const tenantId = agent.slug || agent.id;
    setDeletingSource(sourceName);
    try {
      const res = await deleteAgentSource(tenantId, sourceName);
      // Remove from local agent documents if present
      const doc = agent.documents.find((d) => d.name === sourceName);
      if (doc) {
        removeDocumentFromAgent(agent.id, doc.id);
      }
      updateAgent(agent.id, { chunksCount: res.remaining_chunks });
      const refreshed = getAgentById(agent.id);
      if (refreshed) setAgent(refreshed);

      showNotice(`Source "${sourceName}" deleted. ${res.remaining_chunks} chunks remaining.`);
      await loadLiveSources(tenantId);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to delete source";
      showNotice(`Delete error: ${msg}`);
    } finally {
      setDeletingSource(null);
    }
  };

  const getSourceIcon = (type: string, name: string) => {
    if (type.includes("web") || name.startsWith("http")) {
      return (
        <div className="w-8 h-8 rounded-lg bg-[#FF6A00]/10 border border-[#FF6A00]/30 flex items-center justify-center text-[#FF6A00]">
          <Globe className="w-4 h-4" />
        </div>
      );
    }
    if (type === "pdf" || name.endsWith(".pdf")) {
      return (
        <div className="w-8 h-8 rounded-lg bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-400">
          <FileText className="w-4 h-4" />
        </div>
      );
    }
    if (type === "xlsx" || name.endsWith(".xlsx")) {
      return (
        <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
          <FileSpreadsheet className="w-4 h-4" />
        </div>
      );
    }
    return (
      <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400">
        <File className="w-4 h-4" />
      </div>
    );
  };

  return (
    <div className="max-w-5xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 flex flex-col gap-8">
      {/* Toast Notice */}
      {saveNotice && (
        <div className="fixed bottom-6 right-6 z-50 bg-white dark:bg-[#161B22] border border-orange-300 dark:border-[#FF6A00]/60 text-slate-900 dark:text-white px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 text-xs animate-in slide-in-from-bottom duration-200">
          <Sparkles className="w-4 h-4 text-[#FF6A00]" />
          <span>{saveNotice}</span>
        </div>
      )}

      {/* Breadcrumb Navigation */}
      <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-[#8B949E]">
        <Link
          href="/admin/agents"
          className="hover:text-slate-900 dark:hover:text-white transition-colors flex items-center gap-1.5"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Agents Hub</span>
        </Link>
        <span>/</span>
        <span className="text-slate-900 dark:text-white font-medium">{agent.name}</span>
        <span>/</span>
        <span className="text-[#FF6A00]">Knowledge Studio</span>
      </div>

      {/* Agent Header Hero Profile */}
      <div className="p-6 rounded-2xl bg-white dark:bg-[#161B22] border border-slate-200 dark:border-[#30363D] flex flex-col md:flex-row md:items-start justify-between gap-6 shadow-sm dark:shadow-xl relative overflow-hidden transition-colors">
        <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-bl from-[#FF6A00]/10 to-transparent pointer-events-none rounded-full blur-2xl" />

        <div className="flex items-start gap-4 z-10 flex-1 min-w-0">
          <div className="w-14 h-14 rounded-2xl bg-slate-50 dark:bg-[#0E1117] border border-slate-200 dark:border-[#30363D] flex items-center justify-center text-[#FF6A00] shrink-0 shadow-inner">
            {agent.avatarIcon === "shield" && <Shield className="w-7 h-7" />}
            {agent.avatarIcon === "shopping-bag" && <ShoppingBag className="w-7 h-7" />}
            {agent.avatarIcon !== "shield" && agent.avatarIcon !== "shopping-bag" && (
              <Cpu className="w-7 h-7" />
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
                {agent.name}
              </h1>
              {agent.status === "Ready" && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  Ready
                </span>
              )}
              {agent.status === "Draft" && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-300 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700">
                  Draft
                </span>
              )}
              <span className="px-2 py-0.5 rounded-md bg-slate-50 dark:bg-[#0E1117] border border-slate-200 dark:border-[#30363D] text-[11px] font-mono text-slate-500 dark:text-[#8B949E]">
                tenant: {agent.slug || agent.id}
              </span>
            </div>

            <p className="text-xs text-slate-600 dark:text-[#8B949E] max-w-xl leading-relaxed">
              {agent.description}
            </p>

            <div className="flex items-center gap-4 mt-2.5 text-xs text-slate-500 dark:text-[#8B949E]">
              <span className="flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5 text-[#FF6A00]" />
                <strong className="text-slate-900 dark:text-white font-mono">{agent.chunksCount}</strong> indexed sources
              </span>
              <span>•</span>
              <span>
                Persona: <strong className="text-slate-900 dark:text-white">{agent.tone}</strong>
              </span>
            </div>
          </div>
        </div>

        {/* Action Button: Preview */}
        <div className="flex md:flex-col items-center justify-end gap-2 shrink-0 z-10">
          <Link
            href={`/?agent=${agent.slug}&open=true`}
            className="w-full md:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-[#FF6A00] to-[#E55F00] hover:from-[#FF7B1A] hover:to-[#FF6A00] text-white font-bold text-sm shadow-lg shadow-[#FF6A00]/25 hover:shadow-[#FF6A00]/40 transition-all active:scale-95 group"
          >
            <span>Preview</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </Link>
          <span className="text-[11px] text-slate-500 dark:text-[#8B949E] text-center hidden md:inline">
            Test on live site widget
          </span>
        </div>
      </div>

      {/* Horizontal Tabs Navigation */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-[#30363D] pb-3 overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveTab("setup")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
            activeTab === "setup"
              ? "bg-[#FF6A00] text-white shadow-md shadow-[#FF6A00]/25"
              : "text-slate-600 dark:text-[#8B949E] hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#161B22]"
          }`}
        >
          <Bot className="w-4 h-4" />
          <span>1. Agent Setup &amp; Identity</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("knowledge")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
            activeTab === "knowledge"
              ? "bg-[#FF6A00] text-white shadow-md shadow-[#FF6A00]/25"
              : "text-slate-600 dark:text-[#8B949E] hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#161B22]"
          }`}
        >
          <Database className="w-4 h-4" />
          <span>2. Knowledge Base &amp; Ingestion</span>
          <span
            className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
              activeTab === "knowledge"
                ? "bg-white/20 text-white"
                : "bg-slate-200 dark:bg-[#30363D] text-slate-700 dark:text-slate-300"
            }`}
          >
            {agent.chunksCount}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("provider")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
            activeTab === "provider"
              ? "bg-[#FF6A00] text-white shadow-md shadow-[#FF6A00]/25"
              : "text-slate-600 dark:text-[#8B949E] hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#161B22]"
          }`}
        >
          <Key className="w-4 h-4" />
          <span>3. Dedicated AI Provider (BYOK)</span>
          {customLlmEnabled && (
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("embed")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
            activeTab === "embed"
              ? "bg-[#FF6A00] text-white shadow-md shadow-[#FF6A00]/25"
              : "text-slate-600 dark:text-[#8B949E] hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#161B22]"
          }`}
        >
          <Code className="w-4 h-4 text-sky-400" />
          <span>4. &lt;/&gt; Embed Widget</span>
        </button>
      </div>

      {/* TAB 1: AGENT SETUP & IDENTITY (WELCOME GREETING + SYSTEM PROMPT) */}
      {activeTab === "setup" && (
        <div className="flex flex-col gap-6 animate-in fade-in duration-150">
          {/* Initial Welcome Greeting Card */}
          <div className="p-6 rounded-2xl bg-white dark:bg-[#161B22] border border-slate-200 dark:border-[#30363D] flex flex-col gap-4 shadow-sm dark:shadow-lg transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-orange-500/10 border border-orange-500/30 flex items-center justify-center text-[#FF6A00]">
                  <MessageSquare className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                    <span>Initial Welcome Greeting</span>
                    {welcomeMessage.trim() !== savedWelcome.trim() && (
                      <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                        Unsaved edits
                      </span>
                    )}
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-[#8B949E]">
                    Customize the opening greeting displayed when users start a conversation with this agent.
                  </p>
                </div>
              </div>
            </div>

            <textarea
              rows={3}
              value={welcomeMessage}
              onChange={(e) => setWelcomeMessage(e.target.value)}
              placeholder={getInitialGreeting(agent)}
              className="w-full p-3.5 bg-slate-50 dark:bg-[#0E1117] border border-slate-300 dark:border-[#30363D] focus:border-[#FF6A00] focus:ring-1 focus:ring-[#FF6A00] rounded-xl text-xs font-sans text-slate-900 dark:text-[#E6EDF3] placeholder-slate-400 dark:placeholder-[#484F58] outline-none transition-all resize-y leading-relaxed"
            />

            <div className="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-[#30363D]">
              <span className="text-[11px] font-mono text-slate-500 dark:text-[#8B949E]">
                {welcomeMessage.length} characters
              </span>
              <button
                type="button"
                disabled={isSavingWelcome || welcomeMessage.trim() === savedWelcome.trim()}
                onClick={handleSaveWelcomeMessage}
                className="flex items-center gap-2 px-5 py-2 rounded-xl bg-gradient-to-r from-[#FF6A00] to-[#E55F00] hover:from-[#FF7B1A] hover:to-[#FF6A00] text-white font-bold text-xs shadow-lg shadow-[#FF6A00]/25 transition-all active:scale-95 disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
              >
                {isSavingWelcome ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Saving Greeting...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Save Greeting</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Custom Agent Instructions / System Prompt Card */}
          <div className="p-6 rounded-2xl bg-white dark:bg-[#161B22] border border-slate-200 dark:border-[#30363D] flex flex-col gap-4 shadow-sm dark:shadow-lg transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-orange-500/10 border border-orange-500/30 flex items-center justify-center text-[#FF6A00]">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                    <span>Custom Agent Instructions / System Prompt</span>
                    {systemPrompt.trim() !== savedPrompt.trim() && (
                      <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                        Unsaved edits
                      </span>
                    )}
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-[#8B949E]">
                    Define how this agent must behave, tone, specific formatting rules, or custom constraints.
                  </p>
                </div>
              </div>
            </div>

            <textarea
              rows={6}
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              placeholder="e.g. Speak as an enterprise technology advisor. Always format key points in clean Markdown bullets. Highlight high availability and strict SLA guarantees."
              className="w-full p-3.5 bg-slate-50 dark:bg-[#0E1117] border border-slate-300 dark:border-[#30363D] focus:border-[#FF6A00] focus:ring-1 focus:ring-[#FF6A00] rounded-xl text-xs font-mono text-slate-900 dark:text-[#E6EDF3] placeholder-slate-400 dark:placeholder-[#484F58] outline-none transition-all resize-y leading-relaxed"
            />

            <div className="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-[#30363D]">
              <span className="text-[11px] font-mono text-slate-500 dark:text-[#8B949E]">
                {systemPrompt.length} characters
              </span>
              <button
                type="button"
                disabled={isSavingPrompt || systemPrompt.trim() === savedPrompt.trim()}
                onClick={handleSaveSystemPrompt}
                className="flex items-center gap-2 px-5 py-2 rounded-xl bg-gradient-to-r from-[#FF6A00] to-[#E55F00] hover:from-[#FF7B1A] hover:to-[#FF6A00] text-white font-bold text-xs shadow-lg shadow-[#FF6A00]/25 transition-all active:scale-95 disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
              >
                {isSavingPrompt ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Saving Instructions...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Save Instructions</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: KNOWLEDGE BASE & INGESTION (SECTIONS 1, 2, 3, 4) */}
      {activeTab === "knowledge" && (
        <div className="flex flex-col gap-8 animate-in fade-in duration-150">
      {/* SECTION 1: WEB SCRAPER & HUMAN-IN-THE-LOOP PROOFREADING */}
      <section className="p-6 rounded-2xl bg-white dark:bg-[#161B22] border border-slate-200 dark:border-[#30363D] flex flex-col gap-5 shadow-sm dark:shadow-lg transition-colors">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-slate-50 dark:bg-[#0E1117] border border-slate-200 dark:border-[#30363D] flex items-center justify-center text-[#FF6A00]">
              <Globe className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                <span>1. Web Knowledge Scraper</span>
                <span className="px-2 py-0.5 rounded text-[10px] uppercase font-mono tracking-wider bg-[#FF6A00]/15 text-[#FF6A00] border border-[#FF6A00]/30 font-semibold">
                  Scrape &rarr; Preview &rarr; Ingest
                </span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-[#8B949E]">
                Scrape live URLs, proofread & edit the extracted text, then append it to your bot&apos;s brain
              </p>
            </div>
          </div>
        </div>

        {/* URL Input and Crawl Mode */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 dark:text-[#8B949E]">
              <Globe className="w-4 h-4" />
            </div>
            <input
              type="url"
              value={scraperUrl}
              onChange={(e) => setScraperUrl(e.target.value)}
              placeholder="https://company.com/about or https://docs.service.com/faq"
              className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 dark:bg-[#0E1117] border border-slate-300 dark:border-[#30363D] focus:border-[#FF6A00] focus:ring-1 focus:ring-[#FF6A00] rounded-xl text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-[#484F58] outline-none transition-all font-mono"
            />
          </div>

          {/* Crawl Mode Selector */}
          <div className="inline-flex rounded-xl bg-slate-50 dark:bg-[#0E1117] border border-slate-200 dark:border-[#30363D] p-1">
            <button
              type="button"
              onClick={() => setCrawlType("single")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                crawlType === "single"
                  ? "bg-[#FF6A00] text-white shadow"
                  : "text-slate-600 dark:text-[#8B949E] hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              Single Page
            </button>
            <button
              type="button"
              onClick={() => setCrawlType("deep")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                crawlType === "deep"
                  ? "bg-[#FF6A00] text-white shadow"
                  : "text-slate-600 dark:text-[#8B949E] hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              Deep Crawl
            </button>
          </div>

          {/* Fetch Preview Trigger Button */}
          <button
            type="button"
            disabled={isPreviewLoading}
            onClick={handleFetchPreview}
            className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#FF6A00] to-[#E55F00] hover:from-[#FF7B1A] hover:to-[#FF6A00] text-white font-bold text-xs shadow-lg shadow-[#FF6A00]/25 transition-all active:scale-95 disabled:opacity-50 disabled:pointer-events-none whitespace-nowrap cursor-pointer"
          >
            {isPreviewLoading ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Fetching Content...</span>
              </>
            ) : (
              <>
                <Eye className="w-3.5 h-3.5" />
                <span>Fetch & Preview Content</span>
              </>
            )}
          </button>
        </div>

        {/* HUMAN-IN-THE-LOOP PROOFREAD & EDIT BOX */}
        {previewData && (
          <div className="p-5 rounded-2xl bg-slate-50 dark:bg-[#0E1117] border border-orange-300 dark:border-[#FF6A00]/40 flex flex-col gap-3 animate-in fade-in duration-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-[#FF6A00]" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Proofread & Edit Extracted Knowledge
                </h3>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="px-2 py-0.5 rounded bg-white dark:bg-[#161B22] border border-slate-200 dark:border-[#30363D] text-slate-600 dark:text-[#8B949E] font-mono">
                  ~{previewData.estimated_chunks} est. chunks
                </span>
                <span className="text-[11px] text-slate-500 dark:text-[#8B949E]">
                  {previewText.length} characters
                </span>
              </div>
            </div>

            <p className="text-xs text-slate-600 dark:text-[#8B949E]">
              Review the extracted content below. Remove irrelevant navigation links, footers, or typos before adding to your bot&apos;s brain.
            </p>

            <div className="flex items-center gap-2 text-xs font-mono text-slate-600 dark:text-[#8B949E] bg-white dark:bg-[#161B22] px-3 py-1.5 rounded-lg border border-slate-200 dark:border-[#30363D]">
              <span className="text-[#FF6A00]">Title:</span>
              <span className="text-slate-900 dark:text-white truncate">{previewData.extracted_title}</span>
            </div>

            <textarea
              rows={8}
              value={previewText}
              onChange={(e) => setPreviewText(e.target.value)}
              placeholder="Extracted textual content appears here for live editing..."
              className="w-full p-3.5 bg-white dark:bg-[#161B22] border border-slate-300 dark:border-[#30363D] focus:border-[#FF6A00] focus:ring-1 focus:ring-[#FF6A00] rounded-xl text-xs font-mono text-slate-900 dark:text-[#E6EDF3] placeholder-slate-400 dark:placeholder-[#484F58] outline-none transition-all resize-y leading-relaxed"
            />

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-[#30363D]">
              <button
                type="button"
                onClick={() => {
                  setPreviewData(null);
                  setPreviewText("");
                }}
                className="px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-[#8B949E] hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#161B22] transition-colors"
              >
                Discard Preview
              </button>
              <button
                type="button"
                disabled={isIngestingText}
                onClick={handleIngestApprovedText}
                className="flex items-center gap-2 px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white text-xs font-bold shadow-lg shadow-emerald-500/25 transition-all active:scale-95 disabled:opacity-50"
              >
                {isIngestingText ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Indexing Approved Text...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Save & Ingest Approved Text</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </section>

      {/* SECTION 2: DIRECT TEXT & QUICK NOTES INGESTION */}
      <section className="p-6 rounded-2xl bg-white dark:bg-[#161B22] border border-slate-200 dark:border-[#30363D] flex flex-col gap-5 shadow-sm dark:shadow-lg transition-colors">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-slate-50 dark:bg-[#0E1117] border border-slate-200 dark:border-[#30363D] flex items-center justify-center text-amber-500 dark:text-amber-400">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                <span>2. Direct Text & Quick Notes Ingestion</span>
                <span className="px-2 py-0.5 rounded text-[10px] uppercase font-mono tracking-wider bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 font-semibold">
                  Direct Input
                </span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-[#8B949E]">
                Quickly add raw policies, office hours, escalation guidelines, or FAQ notes without uploading files.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          {/* Title / Topic Input */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-slate-600 dark:text-[#8B949E] uppercase tracking-wider font-mono">
                Title / Topic <span className="text-[11px] font-normal text-slate-400 font-sans">(Optional)</span>
              </label>
              {!noteTitle.trim() && noteContent.trim() && (
                <span className="text-[11px] text-amber-500 font-mono">
                  Auto-titles from first line
                </span>
              )}
            </div>
            <input
              type="text"
              value={noteTitle}
              onChange={(e) => setNoteTitle(e.target.value)}
              placeholder="e.g., Office Hours & Escalation Policy (optional - defaults to note summary)"
              className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-[#0E1117] border border-slate-300 dark:border-[#30363D] focus:border-[#FF6A00] focus:ring-1 focus:ring-[#FF6A00] rounded-xl text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-[#484F58] outline-none transition-all font-mono"
            />
          </div>

          {/* Content / Guidelines Textarea */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-slate-600 dark:text-[#8B949E] uppercase tracking-wider font-mono">
                Content / Guidelines
              </label>
              <span className="text-[11px] text-slate-500 dark:text-[#8B949E] font-mono">
                {noteContent.length} chars (~{Math.max(1, Math.ceil(noteContent.length / 500))} est. chunks)
              </span>
            </div>
            <textarea
              rows={6}
              value={noteContent}
              onChange={(e) => setNoteContent(e.target.value)}
              placeholder="Paste raw text, policies, operational procedures, or custom instructions here..."
              className="w-full p-3.5 bg-slate-50 dark:bg-[#0E1117] border border-slate-300 dark:border-[#30363D] focus:border-[#FF6A00] focus:ring-1 focus:ring-[#FF6A00] rounded-xl text-xs font-mono text-slate-900 dark:text-[#E6EDF3] placeholder-slate-400 dark:placeholder-[#484F58] outline-none transition-all resize-y leading-relaxed"
            />
          </div>

          {/* Action Row */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
            <p className="text-[11px] text-slate-500 dark:text-[#8B949E]">
              {noteContent.trim()
                ? "Ready to ingest! Content will be chunked, embedded, and appended to ChromaDB."
                : "Type or paste your text above to enable ingestion into the agent's active vector space."}
            </p>
            <button
              type="button"
              disabled={isIngestingNote || !noteContent.trim()}
              onClick={handleIngestDirectNote}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-white font-bold text-xs shadow-lg shadow-amber-500/25 transition-all active:scale-95 disabled:opacity-40 disabled:pointer-events-none whitespace-nowrap cursor-pointer"
            >
              {isIngestingNote ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Adding Note...</span>
                </>
              ) : (
                <>
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add to Knowledge Base</span>
                </>
              )}
            </button>
          </div>
        </div>
      </section>

      {/* SECTION 3: INCREMENTAL DOCUMENT UPLOAD */}
      <section className="p-6 rounded-2xl bg-white dark:bg-[#161B22] border border-slate-200 dark:border-[#30363D] flex flex-col gap-5 shadow-sm dark:shadow-lg transition-colors">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-slate-50 dark:bg-[#0E1117] border border-slate-200 dark:border-[#30363D] flex items-center justify-center text-cyan-600 dark:text-cyan-400">
              <UploadCloud className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                <span>3. Multi-Format Document Ingestion</span>
                <span className="px-2 py-0.5 rounded text-[10px] uppercase font-mono tracking-wider bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 border border-cyan-500/30 font-semibold">
                  Append-Only
                </span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-[#8B949E]">
                Upload PDF, Word, Excel, or Text files. New uploads append seamlessly without overwriting existing data.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={addSampleDoc}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-50 hover:bg-slate-100 dark:bg-[#0E1117] dark:hover:bg-[#1F242C] text-xs font-medium text-[#FF6A00] border border-orange-200 dark:border-[#FF6A00]/30 hover:border-[#FF6A00] transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Sample Doc</span>
          </button>
        </div>

        {/* Hidden File Input */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,.docx,.xlsx,.txt,.csv"
          onChange={handleFileSelect}
          className="hidden"
        />

        {/* Drag and Drop Zone */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center cursor-pointer transition-all ${
            isDragging
              ? "border-[#FF6A00] bg-[#FF6A00]/10 scale-[1.01]"
              : "border-slate-300 dark:border-[#30363D] hover:border-[#FF6A00]/50 bg-slate-50/50 dark:bg-[#0E1117]/60 hover:bg-slate-50 dark:hover:bg-[#0E1117]"
          }`}
        >
          <div className="w-12 h-12 rounded-2xl bg-white dark:bg-[#161B22] border border-slate-200 dark:border-[#30363D] flex items-center justify-center text-[#FF6A00] mb-3 shadow-inner">
            <UploadCloud className="w-6 h-6" />
          </div>
          <p className="text-sm font-semibold text-slate-900 dark:text-white text-center">
            Drag and drop files here, or <span className="text-[#FF6A00] underline">browse</span>
          </p>
          <p className="text-xs text-slate-500 dark:text-[#8B949E] mt-1 text-center">
            Supports <strong className="text-slate-700 dark:text-[#E6EDF3]">.pdf</strong>, <strong className="text-slate-700 dark:text-[#E6EDF3]">.docx</strong>, <strong className="text-slate-700 dark:text-[#E6EDF3]">.xlsx</strong>, and <strong className="text-slate-700 dark:text-[#E6EDF3]">.txt</strong> up to 25MB each
          </p>
        </div>

        {/* Staged Files Ready for Ingestion */}
        {stagedFiles.length > 0 && (
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#0E1117] border border-cyan-500/30 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-cyan-600 dark:text-cyan-400">
                {stagedFiles.length} file(s) staged for indexing
              </span>
              <button
                type="button"
                disabled={isIngestingFiles}
                onClick={handleIngestStagedFiles}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs shadow-lg shadow-cyan-600/25 transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                {isIngestingFiles ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Uploading & Indexing...</span>
                  </>
                ) : (
                  <>
                    <UploadCloud className="w-3.5 h-3.5" />
                    <span>Upload & Ingest Selected Files</span>
                  </>
                )}
              </button>
            </div>

            <div className="space-y-1.5">
              {stagedFiles.map((file, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-2 rounded-lg bg-white dark:bg-[#161B22] border border-slate-200 dark:border-[#30363D] text-xs"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText className="w-3.5 h-3.5 text-cyan-500 dark:text-cyan-400 shrink-0" />
                    <span className="text-slate-900 dark:text-white truncate font-mono">{file.name}</span>
                    <span className="text-slate-500 dark:text-[#8B949E] text-[11px]">({formatFileSize(file.size)})</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveStagedFile(file.name)}
                    className="text-slate-400 dark:text-[#8B949E] hover:text-red-500 dark:hover:text-red-400 p-1"
                    title="Remove from staging"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>

            {isIngestingFiles && (
              <div className="mt-2">
                <div className="flex items-center justify-between text-xs text-slate-500 dark:text-[#8B949E] mb-1 font-mono">
                  <span>{fileIngestStage}</span>
                  <span className="text-cyan-600 dark:text-cyan-400 font-bold">{fileIngestProgress}%</span>
                </div>
                <div className="w-full h-2 bg-slate-200 dark:bg-[#161B22] rounded-full overflow-hidden border border-slate-300 dark:border-[#30363D]">
                  <div
                    className="h-full bg-cyan-500 rounded-full transition-all duration-200"
                    style={{ width: `${fileIngestProgress}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      {/* SECTION 4: ACTIVE KNOWLEDGE SOURCES (INDIVIDUAL SOURCE MANAGEMENT) */}
      <section className="p-6 rounded-2xl bg-white dark:bg-[#161B22] border border-slate-200 dark:border-[#30363D] flex flex-col gap-4 shadow-sm dark:shadow-lg transition-colors">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-slate-50 dark:bg-[#0E1117] border border-slate-200 dark:border-[#30363D] flex items-center justify-center text-emerald-500 dark:text-emerald-400">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                <span>4. Active Knowledge Sources</span>
                <span className="px-2 py-0.5 rounded text-[10px] uppercase font-mono tracking-wider bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 font-semibold">
                  ChromaDB Vectors
                </span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-[#8B949E]">
                Currently indexed documents and web sources. View, edit, re-index, or delete any source individually.
              </p>
            </div>
          </div>

          <button
            type="button"
            disabled={isRefreshingSources || isLoadingSources}
            onClick={handleRefreshSources}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-50 hover:bg-slate-100 dark:bg-[#0E1117] dark:hover:bg-[#1F242C] text-xs text-slate-600 dark:text-[#8B949E] hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-[#30363D] transition-all shadow-sm ${
              isRefreshingSources ? "opacity-60 cursor-not-allowed" : "cursor-pointer"
            }`}
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${
                isRefreshingSources
                  ? "animate-spin text-orange-400"
                  : isLoadingSources
                  ? "animate-spin"
                  : ""
              }`}
            />
            <span>{isRefreshingSources ? "Refreshing..." : "Refresh Sources"}</span>
          </button>
        </div>

        {activeSources.length === 0 ? (
          <div className="p-8 rounded-xl bg-slate-50 dark:bg-[#0E1117] border border-slate-200 dark:border-[#30363D] text-center text-xs text-slate-500 dark:text-[#8B949E]">
            {isLoadingSources
              ? "Inspecting ChromaDB collections..."
              : "No sources currently indexed for this tenant. Use the Scraper, Notes Input, or File Uploader above to add knowledge."}
          </div>
        ) : (
          <div className="space-y-2">
            {activeSources.map((source, idx) => (
              <div
                key={source.id || idx}
                className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 dark:bg-[#0E1117] border border-slate-200 dark:border-[#30363D] hover:border-slate-300 dark:hover:border-[#484F58] transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  {getSourceIcon(source.source_type, source.source_name)}
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-slate-900 dark:text-white truncate max-w-sm sm:max-w-md font-mono">
                      {source.source_name}
                    </p>
                    <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-[#8B949E] mt-0.5">
                      <span className="uppercase font-mono text-[10px] px-1.5 py-0.2 rounded bg-white dark:bg-[#161B22] border border-slate-200 dark:border-[#30363D] text-emerald-600 dark:text-emerald-400 font-semibold">
                        {source.chunks_count} chunks
                      </span>
                      <span>•</span>
                      <span className="uppercase font-mono text-[10px] px-1.5 py-0.2 rounded bg-white dark:bg-[#161B22] border border-slate-200 dark:border-[#30363D]">
                        {source.source_type}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {/* View / Edit Action */}
                  <button
                    type="button"
                    onClick={() => handleOpenEditModal(source)}
                    title={`View & Edit source ${source.source_name}`}
                    className="p-2 rounded-lg text-slate-400 dark:text-[#8B949E] hover:text-[#FF6A00] hover:bg-[#FF6A00]/10 transition-colors cursor-pointer"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>

                  {/* Delete Source Action */}
                  <button
                    type="button"
                    disabled={deletingSource === source.source_name}
                    onClick={() => handleDeleteSource(source.source_name)}
                    title={`Delete source ${source.source_name}`}
                    className="p-2 rounded-lg text-slate-400 dark:text-[#8B949E] hover:text-red-500 hover:bg-red-50 dark:hover:text-red-400 dark:hover:bg-red-500/10 transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    {deletingSource === source.source_name ? (
                      <RefreshCw className="w-4 h-4 animate-spin text-red-400" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
        </div>
      )}

      {/* TAB 3: DEDICATED AI PROVIDER (CLIENT BYOK) */}
      {activeTab === "provider" && (
        <div className="flex flex-col gap-6 animate-in fade-in duration-150">
          <div className="p-6 rounded-2xl bg-white dark:bg-[#161B22] border border-slate-200 dark:border-[#30363D] flex flex-col gap-6 shadow-sm dark:shadow-lg transition-colors">
            {/* Header with Switch */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-200 dark:border-[#30363D]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-orange-500/10 border border-orange-500/30 flex items-center justify-center text-[#FF6A00]">
                  <Key className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                    <span>Dedicated Client AI Provider (BYOK)</span>
                    {customLlmEnabled ? (
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono tracking-wider bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 font-semibold">
                        Dedicated Active
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono tracking-wider bg-slate-100 dark:bg-[#0E1117] text-slate-600 dark:text-[#8B949E] border border-slate-200 dark:border-[#30363D] font-semibold">
                        Using Universal Default
                      </span>
                    )}
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-[#8B949E]">
                    Assign a dedicated AI model and API key for this agent. When enabled, this agent will bypass the platform universal provider.
                  </p>
                </div>
              </div>

              {/* Mode Toggle Switch */}
              <div className="flex items-center gap-3 self-end sm:self-center">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  {customLlmEnabled ? "Dedicated Provider (BYOK)" : "Platform Universal Default"}
                </span>
                <button
                  type="button"
                  onClick={() => setCustomLlmEnabled(!customLlmEnabled)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
                    customLlmEnabled ? "bg-[#FF6A00]" : "bg-slate-300 dark:bg-[#30363D]"
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      customLlmEnabled ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>
            </div>

            {/* Info Banner when disabled */}
            {!customLlmEnabled ? (
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#0E1117] border border-slate-200 dark:border-[#30363D] flex items-start gap-3 text-xs text-slate-600 dark:text-[#8B949E]">
                <Bot className="w-5 h-5 text-[#FF6A00] shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="font-semibold text-slate-900 dark:text-white mb-0.5">
                    Universal Platform Inference Active
                  </p>
                  <p>
                    All inferences for this agent are routed through the global provider configured in{" "}
                    <strong className="text-slate-900 dark:text-white">Admin System Settings</strong>.
                    Toggle the switch above if this client has their own API key (Bring Your Own Key) to dedicate inference quota.
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-5 animate-in fade-in duration-200">
                {/* Provider Dropdown Selector (Matching Settings Pic 3 Architecture) */}
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider font-mono">
                    Select Active Provider
                  </label>
                  <div className="relative">
                    <select
                      value={customProvider}
                      onChange={(e) => handleCustomProviderChange(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-50 dark:bg-[#0E1117] border border-slate-300 dark:border-[#30363D] rounded-xl text-sm font-semibold text-slate-900 dark:text-white focus:outline-none focus:border-[#FF6A00] transition-colors appearance-none cursor-pointer"
                    >
                      <option value="gemini">Google Gemini (Direct)</option>
                      <option value="groq">xAI Groq (Fast LPUs)</option>
                      <option value="openrouter">OpenRouter Gateway</option>
                    </select>
                    <ChevronDown className="w-4 h-4 text-slate-400 absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                </div>

                {/* Dynamic Active Provider Box (Exact Settings / Pic 3 Style) */}
                <div className="p-5 rounded-xl border border-slate-200 dark:border-[#30363D] bg-slate-50/50 dark:bg-[#0E1117] flex flex-col gap-5">
                  <div className="flex items-center justify-between border-b border-slate-200 dark:border-[#21262D] pb-3">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-slate-900 dark:text-white">
                        {customProvider === "gemini"
                          ? "Google Gemini"
                          : customProvider === "groq"
                          ? "Groq Cloud"
                          : "OpenRouter Unified"}
                      </span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                        ACTIVE
                      </span>
                    </div>

                    <span className="text-xs text-slate-400 dark:text-[#8B949E]">
                      Applies to this agent specifically
                    </span>
                  </div>

                  {/* API Key Input */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                      <span>API Key</span>
                      {customApiKey ? (
                        <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-mono">Configured ✓</span>
                      ) : (
                        <span className="text-[11px] text-amber-600 dark:text-amber-400 font-mono">Unset</span>
                      )}
                    </label>
                    <div className="relative">
                      <input
                        type={showCustomApiKey ? "text" : "password"}
                        value={customApiKey}
                        onChange={(e) => setCustomApiKey(e.target.value)}
                        placeholder={
                          customProvider === "gemini"
                            ? "AQ... or AIza..."
                            : customProvider === "groq"
                            ? "gsk_..."
                            : "sk-or-v1-..."
                        }
                        className="w-full pl-4 pr-12 py-2.5 bg-white dark:bg-[#161B22] border border-slate-300 dark:border-[#30363D] rounded-xl text-sm font-mono text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-[#8B949E] focus:outline-none focus:border-[#FF6A00] transition-colors"
                      />
                      <button
                        type="button"
                        onClick={() => setShowCustomApiKey(!showCustomApiKey)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                      >
                        {showCustomApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Model Selector */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Model
                    </label>
                    <div className="relative">
                      <select
                        value={customModel}
                        onChange={(e) => setCustomModel(e.target.value)}
                        className="w-full px-4 py-2.5 bg-white dark:bg-[#161B22] border border-slate-300 dark:border-[#30363D] rounded-xl text-sm font-mono text-slate-900 dark:text-white focus:outline-none focus:border-[#FF6A00] transition-colors appearance-none cursor-pointer"
                      >
                        {(MODEL_CATALOG[customProvider] || []).map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name} ({m.context})
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="w-4 h-4 text-slate-400 absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Save AI Configuration Button */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-200 dark:border-[#30363D]">
              <div className="text-[11px] text-slate-500 dark:text-[#8B949E]">
                {customLlmEnabled
                  ? `Dedicated mode: ${customProvider.toUpperCase()} (${customModel})`
                  : "Platform Universal mode active"}
              </div>
              <button
                type="button"
                disabled={isSavingCustomLlm}
                onClick={handleSaveCustomLlm}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#FF6A00] to-[#E55F00] hover:from-[#FF7B1A] hover:to-[#FF6A00] text-white font-bold text-xs shadow-lg shadow-[#FF6A00]/25 transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                {isSavingCustomLlm ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Saving Provider...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-3.5 h-3.5" />
                    <span>Save AI Provider Configuration</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: EMBED ON YOUR WEBSITE (MATCHING EXACT SCREENSHOTS 1, 2, 3, 4) */}
      {activeTab === "embed" && (
        <div className="flex flex-col gap-6 animate-in fade-in duration-150">
          <div className="p-6 rounded-2xl bg-white dark:bg-[#161B22] border border-slate-200 dark:border-[#30363D] flex flex-col gap-6 shadow-sm dark:shadow-lg transition-colors">
            {/* Header: Title + Action Buttons */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-[#30363D]">
              <div className="flex items-center gap-2">
                <span className="text-sky-500 font-mono text-base font-bold">&lt;/&gt;</span>
                <h2 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">
                  Embed on your website
                </h2>
              </div>

              <div className="flex items-center gap-2.5">
                {/* Preview Button */}
                <a
                  href={`/embed/widget?tenant=${agent.slug || agent.id}&pos=${embedPosition}&preview=true`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border border-slate-200 dark:border-[#30363D] bg-white dark:bg-[#0E1117] hover:bg-slate-50 dark:hover:bg-[#1F242C] text-xs font-semibold text-slate-700 dark:text-slate-200 transition-colors shadow-sm"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                  <span>Preview</span>
                </a>

                {/* Setup Guide Button */}
                <button
                  type="button"
                  onClick={() => setIsSetupGuideModalOpen(true)}
                  className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border text-xs font-semibold transition-all shadow-sm cursor-pointer ${
                    isSetupGuideModalOpen
                      ? "border-sky-500 bg-sky-50 dark:bg-sky-950/30 text-sky-600 dark:text-sky-400 ring-2 ring-sky-500/20"
                      : "border-slate-200 dark:border-[#30363D] bg-white dark:bg-[#0E1117] hover:bg-slate-50 dark:hover:bg-[#1F242C] text-slate-700 dark:text-slate-200"
                  }`}
                >
                  <BookOpen className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                  <span>Setup guide</span>
                </button>
              </div>
            </div>

            {/* Button Position Row (Screenshot 1) */}
            <div className="flex items-center gap-4">
              <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                Button position
              </span>

              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsPositionDropdownOpen(!isPositionDropdownOpen)}
                  className="flex items-center justify-between gap-3 px-4 py-2 bg-white dark:bg-[#0E1117] border border-slate-200 dark:border-[#30363D] rounded-xl text-xs font-medium text-slate-800 dark:text-slate-200 hover:border-slate-300 dark:hover:border-[#484F58] transition-colors min-w-[140px] shadow-sm cursor-pointer"
                >
                  <span>
                    {embedPosition === "bottom-right" && "Bottom right"}
                    {embedPosition === "bottom-left" && "Bottom left"}
                    {embedPosition === "top-right" && "Top right"}
                    {embedPosition === "top-left" && "Top left"}
                  </span>
                  <ChevronDown className="w-4 h-4 text-slate-400" />
                </button>

                {isPositionDropdownOpen && (
                  <div className="absolute left-0 top-full mt-1.5 w-48 bg-white dark:bg-[#161B22] border border-slate-200 dark:border-[#30363D] rounded-xl shadow-xl py-1 z-30 animate-in fade-in zoom-in-95 duration-100">
                    {[
                      { id: "bottom-right", label: "Bottom right" },
                      { id: "bottom-left", label: "Bottom left" },
                      { id: "top-right", label: "Top right" },
                      { id: "top-left", label: "Top left" },
                    ].map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => {
                          setEmbedPosition(opt.id as any);
                          setIsPositionDropdownOpen(false);
                        }}
                        className="w-full flex items-center justify-between px-3.5 py-2 text-xs text-left text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-[#0E1117] transition-colors cursor-pointer"
                      >
                        <span>{opt.label}</span>
                        {embedPosition === opt.id && (
                          <Check className="w-4 h-4 text-sky-500" />
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Script Snippet Box (Screenshot 1 & 4) */}
            <div className="relative rounded-2xl bg-[#F8FAFC] dark:bg-[#0E1117] border border-slate-200/90 dark:border-[#30363D] p-5 shadow-inner">
              <button
                type="button"
                onClick={() => {
                  const snippet = `<script\n  src="${typeof window !== "undefined" ? window.location.origin : "http://localhost:3000"}/widget.js"\n  data-tenant-id="${agent.slug || agent.id}"\n  data-profile-id="${agent.id}"\n  data-position="${embedPosition}"\n  data-app-url="${typeof window !== "undefined" ? window.location.origin : "http://localhost:3000"}"\n  async\n></script>`;
                  if (typeof navigator !== "undefined" && navigator.clipboard) {
                    navigator.clipboard.writeText(snippet);
                    setHasCopiedSnippet(true);
                    showNotice("Script snippet copied to clipboard!");
                    setTimeout(() => setHasCopiedSnippet(false), 2500);
                  }
                }}
                className="absolute top-4 right-4 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white dark:bg-[#161B22] border border-slate-200 dark:border-[#30363D] text-xs font-semibold text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white shadow-sm hover:shadow transition-all cursor-pointer"
              >
                {hasCopiedSnippet ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-500" />
                    <span className="text-emerald-600 dark:text-emerald-400">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-slate-500" />
                    <span>Copy</span>
                  </>
                )}
              </button>

              <pre className="font-mono text-xs text-slate-800 dark:text-[#E6EDF3] leading-relaxed overflow-x-auto pr-20 select-all">
                <code>
{`<script
  src="${typeof window !== "undefined" ? window.location.origin : "http://localhost:3000"}/widget.js"
  data-tenant-id="${agent.slug || agent.id}"
  data-profile-id="${agent.id}"
  data-position="${embedPosition}"
  data-app-url="${typeof window !== "undefined" ? window.location.origin : "http://localhost:3000"}"
  async
></script>`}
                </code>
              </pre>
            </div>
          </div>
        </div>
      )}

      {/* SETUP GUIDE MODAL (EXACT MATCH FOR USER SCREENSHOTS) */}
      {isSetupGuideModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs overflow-y-auto p-4 sm:p-6 flex items-start sm:items-center justify-center animate-in fade-in duration-150">
          <div className="bg-white dark:bg-[#161B22] border border-slate-200 dark:border-[#30363D] rounded-2xl max-w-lg w-full p-6 sm:p-7 shadow-2xl flex flex-col gap-5 max-h-[88vh] overflow-y-auto modal-scrollbar overscroll-contain relative my-auto">
            {/* Modal Header */}
            <div className="flex items-start justify-between gap-4 shrink-0">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">
                  Add the booking button to your website
                </h3>
                <p className="text-xs text-slate-500 dark:text-[#8B949E] mt-1.5 leading-relaxed">
                  One line of code adds the same floating booking button — AI chat, manual booking, and WhatsApp — to your site. It updates automatically whenever you change this agent, services, colors or hours.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setIsSetupGuideModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#30363D]/40 transition-colors shrink-0 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Numbered Steps (Screenshot 2 & 3) */}
            <div className="space-y-3.5 text-xs text-slate-700 dark:text-slate-300 shrink-0">
              <div className="flex items-start gap-3">
                <span className="w-5 h-5 rounded-full bg-sky-100 dark:bg-sky-950/60 border border-sky-300 dark:border-sky-500/40 text-sky-600 dark:text-sky-400 flex items-center justify-center font-bold text-[11px] shrink-0 mt-0.5">
                  1
                </span>
                <p className="leading-relaxed">
                  Set the button position and copy the snippet from this page.
                </p>
              </div>

              <div className="flex items-start gap-3">
                <span className="w-5 h-5 rounded-full bg-sky-100 dark:bg-sky-950/60 border border-sky-300 dark:border-sky-500/40 text-sky-600 dark:text-sky-400 flex items-center justify-center font-bold text-[11px] shrink-0 mt-0.5">
                  2
                </span>
                <p className="leading-relaxed">
                  Paste it just before the closing <code className="px-1 py-0.5 bg-slate-100 dark:bg-[#0E1117] border border-slate-200 dark:border-[#30363D] rounded font-mono text-[11px] text-slate-800 dark:text-slate-200">&lt;/body&gt;</code> tag on your site (or into your builder&apos;s &quot;custom code / footer&quot; box).
                </p>
              </div>

              <div className="flex items-start gap-3">
                <span className="w-5 h-5 rounded-full bg-sky-100 dark:bg-sky-950/60 border border-sky-300 dark:border-sky-500/40 text-sky-600 dark:text-sky-400 flex items-center justify-center font-bold text-[11px] shrink-0 mt-0.5">
                  3
                </span>
                <p className="leading-relaxed">
                  Save and publish — the booking button appears in the corner instantly.
                </p>
              </div>
            </div>

            {/* Collapsible Accordion: Setup Guides for Popular Website Builders (Screenshot 3 & 4) */}
            <div className="border border-slate-900 dark:border-slate-300 rounded-lg shrink-0">
              <button
                type="button"
                onClick={() => {
                  const nextState = !isSetupBuildersOpen;
                  setIsSetupBuildersOpen(nextState);
                  if (nextState) {
                    setTimeout(() => {
                      const el = document.getElementById("builders-accordion-content");
                      el?.scrollIntoView({ behavior: "smooth", block: "nearest" });
                    }, 50);
                  }
                }}
                className="w-full px-4 py-3 bg-white dark:bg-[#0E1117] hover:bg-slate-50 dark:hover:bg-[#161B22] flex items-center justify-between text-xs font-semibold text-slate-900 dark:text-white transition-colors cursor-pointer rounded-t-lg"
              >
                <span>Setup guides for popular website builders</span>
                {isSetupBuildersOpen ? (
                  <ChevronUp className="w-4 h-4 text-slate-800 dark:text-slate-200" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-slate-800 dark:text-slate-200" />
                )}
              </button>

              {isSetupBuildersOpen && (
                <div
                  id="builders-accordion-content"
                  className="p-4 bg-slate-50/50 dark:bg-[#0E1117]/80 border-t border-slate-200 dark:border-[#30363D] space-y-4 text-xs animate-in fade-in duration-100 rounded-b-lg"
                >
                  {/* WordPress */}
                  <div>
                    <h4 className="font-bold text-slate-900 dark:text-white mb-0.5">WordPress</h4>
                    <p className="text-slate-600 dark:text-[#8B949E] leading-relaxed">
                      Install the free &quot;WPCode&quot; (or &quot;Insert Headers and Footers&quot;) plugin, then paste the snippet into the Footer / Body box. It loads on every page automatically.
                    </p>
                  </div>

                  {/* Wix */}
                  <div>
                    <h4 className="font-bold text-slate-900 dark:text-white mb-0.5">Wix</h4>
                    <p className="text-slate-600 dark:text-[#8B949E] leading-relaxed">
                      Go to Settings &rarr; Custom Code &rarr; + Add Custom Code. Paste the snippet, set &quot;Place Code in&quot; to Body – end, and apply it to All pages.
                    </p>
                  </div>

                  {/* Squarespace */}
                  <div>
                    <h4 className="font-bold text-slate-900 dark:text-white mb-0.5">Squarespace</h4>
                    <p className="text-slate-600 dark:text-[#8B949E] leading-relaxed">
                      Go to Settings &rarr; Advanced &rarr; Code Injection and paste the snippet into the Footer box. It loads site-wide.
                    </p>
                  </div>

                  {/* Shopify */}
                  <div>
                    <h4 className="font-bold text-slate-900 dark:text-white mb-0.5">Shopify</h4>
                    <p className="text-slate-600 dark:text-[#8B949E] leading-relaxed">
                      Online Store &rarr; Themes &rarr; ••• &rarr; Edit code. Open layout/theme.liquid and paste the snippet just before the closing &lt;/body&gt; tag.
                    </p>
                  </div>

                  {/* Plain HTML */}
                  <div>
                    <h4 className="font-bold text-slate-900 dark:text-white mb-0.5">Plain HTML site</h4>
                    <p className="text-slate-600 dark:text-[#8B949E] leading-relaxed">
                      Paste the snippet just before the closing &lt;/body&gt; tag on each page (or in your shared footer include).
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-[#30363D] shrink-0">
              <a
                href="/demo.html"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-[#0E1117] dark:hover:bg-[#1F242C] text-xs font-semibold text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-[#30363D] transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5 text-[#FF6A00]" />
                <span>Test in Live Demo Page</span>
              </a>

              <button
                type="button"
                onClick={() => setIsSetupGuideModalOpen(false)}
                className="px-4 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 text-xs font-bold transition-all cursor-pointer shadow-sm"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* VIEW & EDIT KNOWLEDGE SOURCE MODAL */}
      {editingSource && (
        <div className="fixed inset-0 z-50 bg-black/60 dark:bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-[#161B22] border border-slate-200 dark:border-[#30363D] rounded-2xl max-w-2xl w-full p-6 shadow-2xl flex flex-col gap-4 max-h-[90vh] overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-start justify-between gap-4 pb-3 border-b border-slate-200 dark:border-[#30363D]">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-slate-50 dark:bg-[#0E1117] border border-slate-200 dark:border-[#30363D] flex items-center justify-center text-[#FF6A00] shrink-0">
                  <Edit3 className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-base font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                    <span>Edit Knowledge Source</span>
                  </h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="font-mono text-xs text-slate-500 dark:text-[#8B949E] truncate max-w-xs sm:max-w-sm">
                      {editingSource.source_name}
                    </span>
                    <span className="uppercase font-mono text-[10px] px-2 py-0.5 rounded bg-slate-50 dark:bg-[#0E1117] border border-slate-200 dark:border-[#30363D] text-[#FF6A00] font-semibold shrink-0">
                      {editingSource.source_type}
                    </span>
                    <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-semibold shrink-0">
                      {editingSource.chunks_count} chunks
                    </span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={handleCloseEditModal}
                disabled={isSavingEdit}
                className="p-1.5 rounded-lg text-slate-400 dark:text-[#8B949E] hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#30363D]/50 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex flex-col gap-2 overflow-y-auto flex-1">
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-[#8B949E]">
                <span>Modify raw content below. Saving will update PostgreSQL and re-index vector chunks in ChromaDB.</span>
                <span className="font-mono text-[11px] shrink-0">{editContent.length} chars</span>
              </div>
              <textarea
                rows={12}
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                placeholder="No raw content stored for this source yet. Paste or enter the updated source text..."
                className="w-full p-3.5 bg-slate-50 dark:bg-[#0E1117] border border-slate-300 dark:border-[#30363D] focus:border-[#FF6A00] focus:ring-1 focus:ring-[#FF6A00] rounded-xl text-xs font-mono text-slate-900 dark:text-[#E6EDF3] placeholder-slate-400 dark:placeholder-[#484F58] outline-none transition-all resize-y leading-relaxed"
              />
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200 dark:border-[#30363D]">
              <button
                type="button"
                onClick={handleCloseEditModal}
                disabled={isSavingEdit}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-[#8B949E] hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#30363D]/40 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSavingEdit || !editContent.trim()}
                onClick={handleSaveEditedSource}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#FF6A00] to-[#E55F00] hover:from-[#FF7B1A] hover:to-[#FF6A00] text-white text-xs font-bold shadow-lg shadow-[#FF6A00]/25 transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                {isSavingEdit ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Re-Indexing Chunks...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Save & Re-Index</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
