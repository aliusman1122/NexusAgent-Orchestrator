"use client";

export type PersonaTone = "Executive" | "Casual" | "Technical";
export type AgentStatus = "Ready" | "Indexing" | "Draft";

export interface KnowledgeDocument {
  id: string;
  name: string;
  size: string;
  type: "pdf" | "docx" | "xlsx" | string;
  uploadedAt: string;
}

export interface ScraperConfig {
  url: string;
  crawlType: "single" | "deep";
  lastCrawled?: string;
}

export interface Agent {
  id: string;
  name: string;
  slug: string;
  description: string;
  tone: PersonaTone;
  persona?: PersonaTone | string;
  status: AgentStatus;
  chunksCount: number;
  avatarIcon?: string;
  createdAt: string;
  updatedAt: string;
  scraperConfig: ScraperConfig;
  targetUrl?: string;
  documents: KnowledgeDocument[];
  sources_count?: number;
  sourcesCount?: number;
  systemPrompt?: string;
  system_prompt?: string;
  welcome_message?: string;
  welcomeMessage?: string;
  is_default?: boolean;
  isDefault?: boolean;
}

/**
 * Returns clean agent name without duplicate "Assistant".
 * If the name already ends with "Assistant", "Advisor", "Agent", or similar role suffix, returns as-is.
 */
export function getCleanAgentName(name?: string): string {
  if (!name || !name.trim()) return "AI Assistant";
  const trimmed = name.trim();
  if (/(assistant|advisor|agent|bot|rep|representative|support|specialist)$/i.test(trimmed)) {
    return trimmed;
  }
  if (trimmed.toLowerCase() === "a7 logics") {
    return "A7 Logics Assistant";
  }
  return trimmed;
}

/**
 * Renders a clean, human-first dynamic initial greeting message.
 * Respects custom welcome_message if set, otherwise dynamically addresses the bot's name.
 */
export function getInitialGreeting(
  agent?: { name?: string; welcome_message?: string; welcomeMessage?: string } | Agent | null
): string {
  // 1. If explicit custom welcome message is saved in DB, use it
  const customWelcome =
    agent?.welcome_message?.trim() ||
    (agent as any)?.welcomeMessage?.trim();

  if (customWelcome && customWelcome.length > 0) {
    return customWelcome;
  }

  // 2. Resolve clean display name dynamically
  const botName =
    agent?.name && agent.name.trim().length > 0
      ? getCleanAgentName(agent.name)
      : "AI Assistant";

  // 3. Dynamic professional greeting for ANY current or future bot
  return `Hello! 👋 Welcome to ${botName}.\n\nHow can I assist you today?`;
}


const STORAGE_KEY = "a7_admin_agents_v1";
const STORAGE_EVENT = "a7_agents_storage_update";

export const DEFAULT_AGENTS: Agent[] = [
  {
    id: "a7_logics",
    name: "A7 Logics Assistant",
    slug: "a7_logics",
    is_default: true,
    description: "Executive Client Representative for A7 Logics services, pricing, and tech stacks.",
    tone: "Executive",
    persona: "Executive",
    status: "Ready",
    chunksCount: 21,
    avatarIcon: "cpu",
    targetUrl: "https://a7logics.com/",
    createdAt: "2026-03-01T10:00:00Z",
    updatedAt: "2026-03-25T12:00:00Z",
    scraperConfig: {
      url: "https://a7logics.com/",
      crawlType: "deep",
      lastCrawled: "2026-03-25T12:00:00Z",
    },
    documents: [
      {
        id: "doc-sample-services",
        name: "sample_services.docx",
        size: "1.2 MB",
        type: "docx",
        uploadedAt: "2026-03-25T12:00:00Z",
      },
    ],
    systemPrompt: "You are the primary executive client representative for A7 Logics. Maintain an executive, highly polished tone with concise strategic insights.",
  },
  {
    id: "fintech_risk_advisor",
    name: "Fintech Risk Advisor",
    slug: "fintech_risk_advisor",
    description: "Specialized compliance, credit risk assessment, and quantitative portfolio advisory bot.",
    tone: "Technical",
    status: "Ready",
    chunksCount: 118,
    avatarIcon: "shield",
    createdAt: "2026-02-15T08:00:00Z",
    updatedAt: "2026-03-21T18:20:00Z",
    scraperConfig: {
      url: "https://sec.gov/edgar/financial-guidelines",
      crawlType: "deep",
      lastCrawled: "2026-03-10T16:00:00Z",
    },
    documents: [
      {
        id: "doc-3",
        name: "Basel_III_Compliance_Framework.pdf",
        size: "4.8 MB",
        type: "pdf",
        uploadedAt: "2026-02-18T10:30:00Z",
      },
      {
        id: "doc-4",
        name: "Credit_Risk_Models_Q4.xlsx",
        size: "3.2 MB",
        type: "xlsx",
        uploadedAt: "2026-03-01T15:00:00Z",
      },
    ],
    systemPrompt: "You are a quantitative financial risk advisor. Provide rigorous, compliance-grade citations and analytical models in your responses.",
  },
  {
    id: "ecommerce_support",
    name: "E-Commerce Support",
    slug: "ecommerce_support",
    description: "Customer inquiry, product recommendation, and order tracking multi-channel support agent.",
    tone: "Casual",
    status: "Draft",
    chunksCount: 0,
    avatarIcon: "shopping-bag",
    createdAt: "2026-03-23T12:00:00Z",
    updatedAt: "2026-03-23T12:00:00Z",
    scraperConfig: {
      url: "",
      crawlType: "single",
    },
    documents: [],
    systemPrompt: "You are an empathetic, friendly customer service agent. Help shoppers resolve order queries and discover product recommendations.",
  },
];

function notifyStoreChange(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(STORAGE_EVENT));
  }
}

export function getAgents(): Agent[] {
  if (typeof window === "undefined") {
    return DEFAULT_AGENTS;
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_AGENTS));
      localStorage.setItem("a7_agents_cache", JSON.stringify(DEFAULT_AGENTS));
      return DEFAULT_AGENTS;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      // Purge any dummy mock agents (e.g. analytics_agent_) from storage
      const sanitized = parsed.filter(
        (a: Agent) =>
          !a.id?.startsWith("analytics_agent_") &&
          !a.slug?.startsWith("analytics_agent_") &&
          a.name !== "Analytics Bot"
      );

      // Ensure 'a7_logics' is present and updated with 21 chunks
      const existingIdx = sanitized.findIndex(
        (a: Agent) => a.id === "a7_logics" || a.slug === "a7_logics" || a.id === "a7_core_assistant"
      );
      if (existingIdx === -1) {
        sanitized.unshift(DEFAULT_AGENTS[0]);
      } else if (
        sanitized[existingIdx].id === "a7_core_assistant" ||
        sanitized[existingIdx].slug === "a7_core_assistant" ||
        sanitized[existingIdx].chunksCount !== 21
      ) {
        sanitized[existingIdx] = {
          ...sanitized[existingIdx],
          id: "a7_logics",
          slug: "a7_logics",
          name: "A7 Logics Assistant",
          description: "Executive Client Representative for A7 Logics services, pricing, and tech stacks.",
          chunksCount: 21,
          status: "Ready",
          tone: "Executive",
          persona: "Executive",
          targetUrl: "https://a7logics.com/",
        };
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(sanitized));
      localStorage.setItem("a7_agents_cache", JSON.stringify(sanitized));
      return sanitized;
    }
    // If empty array or invalid, restore defaults
    localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_AGENTS));
    localStorage.setItem("a7_agents_cache", JSON.stringify(DEFAULT_AGENTS));
    return DEFAULT_AGENTS;
  } catch (err) {
    console.error("Failed to read agents from localStorage", err);
    return DEFAULT_AGENTS;
  }
}

export function getAgentById(id: string): Agent | null {
  const agents = getAgents();
  return agents.find((a) => a.id === id || a.slug === id) || null;
}

export function saveAgents(agents: Agent[]): void {
  if (typeof window === "undefined") return;
  try {
    const seen = new Set<string>();
    const deduped: Agent[] = [];
    for (const a of agents) {
      if (
        a.id?.startsWith("analytics_agent_") ||
        a.slug?.startsWith("analytics_agent_") ||
        a.name === "Analytics Bot"
      ) {
        continue;
      }
      const key = `${a.id || ""}_${a.slug || ""}`.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        deduped.push(a);
      }
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(deduped));
    localStorage.setItem("a7_agents_cache", JSON.stringify(deduped));
    notifyStoreChange();
  } catch (err) {
    console.error("Failed to save agents to localStorage", err);
  }
}

export function createAgent(data: {
  name: string;
  slug: string;
  description: string;
  tone: PersonaTone;
  avatarIcon?: string;
}): Agent {
  const agents = getAgents();
  const cleanSlug = data.slug.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "_");
  const id = cleanSlug || `agent_${Date.now()}`;

  const existingIdx = agents.findIndex(
    (a) => a.id === id || a.slug === cleanSlug || (cleanSlug && a.slug === cleanSlug)
  );

  const now = new Date().toISOString();
  const newAgent: Agent = {
    id,
    name: data.name.trim(),
    slug: cleanSlug,
    description: data.description.trim(),
    tone: data.tone,
    status: "Draft",
    chunksCount: 0,
    avatarIcon: data.avatarIcon || "bot",
    createdAt: now,
    updatedAt: now,
    scraperConfig: {
      url: "",
      crawlType: "single",
    },
    documents: [],
  };

  let updated: Agent[];
  if (existingIdx !== -1) {
    agents[existingIdx] = { ...agents[existingIdx], ...newAgent };
    updated = agents;
  } else {
    updated = [newAgent, ...agents];
  }
  saveAgents(updated);
  return newAgent;
}

export function updateAgent(id: string, updates: Partial<Agent>): Agent | null {
  const agents = getAgents();
  const index = agents.findIndex((a) => a.id === id || a.slug === id);
  if (index === -1) return null;

  const current = agents[index];
  const updatedAgent: Agent = {
    ...current,
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  agents[index] = updatedAgent;
  saveAgents(agents);
  return updatedAgent;
}

/**
 * Permanently purges an agent from localStorage cache across all storage keys.
 */
export function purgeAgentFromLocalStorage(id: string): void {
  if (typeof window === "undefined") return;
  const cleanId = id.trim().toLowerCase();

  const keys = [STORAGE_KEY, "a7_agents_cache"];
  for (const key of keys) {
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          const filtered = parsed.filter((a: Agent) => {
            const aId = (a.id || "").toLowerCase();
            const aSlug = (a.slug || "").toLowerCase();
            return aId !== cleanId && aSlug !== cleanId;
          });
          localStorage.setItem(key, JSON.stringify(filtered));
        }
      }
    } catch (err) {
      console.warn(`Error purging agent '${id}' from ${key}:`, err);
    }
  }
}

/**
 * Full-stack agent deletion:
 * 1. Hard deletes from backend PostgreSQL and ChromaDB collection.
 * 2. Purges from local memory and localStorage caches so refresh won't restore it.
 * 3. Prevents deletion of the core 'a7_logics' agent.
 */
export async function deleteAgent(id: string): Promise<boolean> {
  const cleanId = id.trim();
  const lower = cleanId.toLowerCase();

  if (lower === "a7_logics" || lower === "a7logics") {
    throw new Error("Core A7 Logics agent cannot be deleted.");
  }

  const apiBase =
    typeof window !== "undefined" && process.env.NEXT_PUBLIC_API_URL
      ? process.env.NEXT_PUBLIC_API_URL.replace(/\/+$/, "")
      : "http://localhost:8000";

  let backendErr: Error | null = null;
  try {
    const res = await fetch(`${apiBase}/api/v1/admin/agents/${encodeURIComponent(cleanId)}`, {
      method: "DELETE",
      headers: { Accept: "application/json" },
    });
    if (!res.ok && res.status !== 404) {
      const errJson = await res.json().catch(() => ({}));
      backendErr = new Error(errJson.detail || `Failed to delete agent from database (status ${res.status})`);
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    backendErr = new Error(msg || "Failed to delete agent from database.");
  }

  // Remove from local memory state & purge from localStorage / cache so refresh won't restore it
  purgeAgentFromLocalStorage(cleanId);
  notifyStoreChange();

  if (backendErr) {
    throw backendErr;
  }

  return true;
}

export function resetDefaultAgents(): Agent[] {
  if (typeof window === "undefined") return DEFAULT_AGENTS;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_AGENTS));
  notifyStoreChange();
  return DEFAULT_AGENTS;
}

export function addDocumentToAgent(agentId: string, doc: Omit<KnowledgeDocument, "id" | "uploadedAt">): KnowledgeDocument | null {
  const agent = getAgentById(agentId);
  if (!agent) return null;

  const newDoc: KnowledgeDocument = {
    ...doc,
    id: `doc_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    uploadedAt: new Date().toISOString(),
  };

  const updatedDocs = [...agent.documents, newDoc];
  updateAgent(agentId, { documents: updatedDocs });
  return newDoc;
}

export function removeDocumentFromAgent(agentId: string, docId: string): boolean {
  const agent = getAgentById(agentId);
  if (!agent) return false;

  const updatedDocs = agent.documents.filter((d) => d.id !== docId);
  updateAgent(agentId, { documents: updatedDocs });
  return true;
}

export function updateAgentScraper(
  agentId: string,
  scraperConfig: ScraperConfig
): boolean {
  const agent = getAgentById(agentId);
  if (!agent) return false;

  updateAgent(agentId, { scraperConfig });
  return true;
}

export { STORAGE_EVENT };
