/**
 * Centralized API client service for communicating with the A7 Logics FastAPI backend.
 * Reads the base URL strictly from environment variable NEXT_PUBLIC_API_URL.
 */

import {
  AdminAlertsResponse,
  AgentSourcesResponse,
  AppSettings,
  ChatRequestPayload,
  ChatResponsePayload,
  CreateAgentPayload,
  CuratedModel,
  DeleteSourceResponse,
  IngestContentPayload,
  IngestContentResponse,
  IngestResult,
  ProviderLimitsResponse,
  ScrapePreviewResponse,
  SourceItem,
  SystemHealthResponse,
  TokenAnalyticsResponse,
  UpdateAgentPayload,
} from "@/types/chat";
import { Agent } from "@/lib/admin-store";

const getBaseUrl = (): string => {
  const envUrl = process.env.NEXT_PUBLIC_API_URL;
  if (!envUrl) {
    return "http://localhost:8000";
  }
  return envUrl.replace(/\/+$/, "");
};

const BASE_URL = getBaseUrl();

/**
 * Send a user query to the A7 Logics LangGraph RAG chat endpoint.
 *
 * @param message The user query string
 * @param sessionId Optional conversation session identifier
 * @param tenantId Optional tenant identifier for collection routing
 * @param agentName Optional display name of the agent
 * @param persona Optional tone of persona (Executive, Technical, Casual)
 * @returns Production ChatResponsePayload containing answer, session_id, and timestamp
 */
export async function sendChatMessage(
  message: string,
  sessionId?: string,
  tenantId?: string,
  agentName?: string,
  persona?: string,
  agentId?: string,
  systemPrompt?: string
): Promise<ChatResponsePayload> {
  const cleanMessage = message.trim();
  if (!cleanMessage) {
    throw new Error("Message cannot be empty.");
  }

  const payload: ChatRequestPayload = {
    message: cleanMessage,
    session_id: sessionId,
    tenant_id: tenantId,
    agent_id: agentId || tenantId,
    agent_name: agentName,
    persona: persona,
    system_prompt: systemPrompt,
  };

  const response = await fetch(`${BASE_URL}/api/v1/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorJson = await response.json().catch(() => ({}));
    throw new Error(
      errorJson.detail || `Chat request failed with status ${response.status}`
    );
  }

  return response.json();
}

/**
 * Upload multi-format files and trigger live website scraping for a tenant knowledge base.
 *
 * @param tenantId The identifier of the agent / tenant collection
 * @param formData FormData containing files, website_url, crawl_mode, agent_name, and persona
 * @returns Real IngestResult with chunks_indexed count
 */
export async function uploadAgentKnowledgeBase(
  tenantId: string,
  formData: FormData
): Promise<IngestResult> {
  const cleanTenant = encodeURIComponent(tenantId.trim());
  const response = await fetch(`${BASE_URL}/api/v1/admin/agents/${cleanTenant}/ingest`, {
    method: "POST",
    body: formData,
    // Browser automatically sets Content-Type to multipart/form-data with boundary
  });

  if (!response.ok) {
    const errorJson = await response.json().catch(() => ({}));
    throw new Error(
      errorJson.detail || `Ingestion failed with status ${response.status}`
    );
  }

  return response.json();
}

/**
 * Fetch and parse website content for human proofreading and editing before indexing.
 *
 * @param websiteUrl Target website or documentation URL
 * @param crawlMode Crawl mode ("single" | "deep")
 * @returns ScrapePreviewResponse with extracted text and estimated chunks
 */
export async function fetchScrapePreview(
  websiteUrl: string,
  crawlMode: "single" | "deep" = "single"
): Promise<ScrapePreviewResponse> {
  const response = await fetch(`${BASE_URL}/api/v1/admin/scrape-preview`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      website_url: websiteUrl.trim(),
      crawl_mode: crawlMode,
    }),
  });

  if (!response.ok) {
    const errorJson = await response.json().catch(() => ({}));
    throw new Error(
      errorJson.detail || `Scrape preview failed with status ${response.status}`
    );
  }

  return response.json();
}

/**
 * Ingest reviewed and approved text content incrementally into tenant ChromaDB.
 *
 * @param tenantId Identifier of the tenant collection
 * @param payload Payload containing content, source_name, source_type, and optional persona
 * @returns IngestContentResponse with added and total chunk counts
 */
export async function ingestAgentContent(
  tenantId: string,
  payload: IngestContentPayload
): Promise<IngestContentResponse> {
  const cleanTenant = encodeURIComponent(tenantId.trim());
  const response = await fetch(
    `${BASE_URL}/api/v1/admin/agents/${cleanTenant}/ingest-content`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
    }
  );

  if (!response.ok) {
    const errorJson = await response.json().catch(() => ({}));
    throw new Error(
      errorJson.detail || `Content ingestion failed with status ${response.status}`
    );
  }

  return response.json();
}

/**
 * Get list of active knowledge sources with chunk counts for an agent.
 *
 * @param tenantId Identifier of the tenant collection
 * @returns AgentSourcesResponse with total chunks and list of sources
 */
export async function fetchAgentSources(
  tenantId: string
): Promise<AgentSourcesResponse> {
  const cleanTenant = encodeURIComponent(tenantId.trim());
  const response = await fetch(
    `${BASE_URL}/api/v1/admin/agents/${cleanTenant}/sources`,
    {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
      cache: "no-store",
    }
  );

  if (!response.ok) {
    const errorJson = await response.json().catch(() => ({}));
    throw new Error(
      errorJson.detail || `Failed to fetch sources with status ${response.status}`
    );
  }

  return response.json();
}

/**
 * Delete a specific source from an agent's ChromaDB knowledge base.
 *
 * @param tenantId Identifier of the tenant collection
 * @param sourceName The source_name or filename to delete
 * @returns DeleteSourceResponse
 */
export async function deleteAgentSource(
  tenantId: string,
  sourceName: string
): Promise<DeleteSourceResponse> {
  const cleanTenant = encodeURIComponent(tenantId.trim());
  const encodedSource = encodeURIComponent(sourceName.trim());
  const response = await fetch(
    `${BASE_URL}/api/v1/admin/agents/${cleanTenant}/sources?source_name=${encodedSource}`,
    {
      method: "DELETE",
      headers: {
        Accept: "application/json",
      },
    }
  );

  if (!response.ok) {
    const errorJson = await response.json().catch(() => ({}));
    throw new Error(
      errorJson.detail || `Failed to delete source with status ${response.status}`
    );
  }

  return response.json();
}

/**
 * Update raw content of a knowledge source and trigger ChromaDB re-indexing.
 *
 * @param tenantId Identifier of the tenant collection
 * @param sourceId Database UUID or name of the source
 * @param updatedContent Modified raw text content
 * @returns Updated SourceItem
 */
export async function updateAgentSource(
  tenantId: string,
  sourceId: string,
  updatedContent: string
): Promise<SourceItem> {
  const cleanTenant = encodeURIComponent(tenantId.trim());
  const encodedSourceId = encodeURIComponent(sourceId.trim());
  const response = await fetch(
    `${BASE_URL}/api/v1/admin/agents/${cleanTenant}/sources/${encodedSourceId}`,
    {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ updated_content: updatedContent }),
    }
  );

  if (!response.ok) {
    const errorJson = await response.json().catch(() => ({}));
    throw new Error(
      errorJson.detail || `Failed to update source (status ${response.status})`
    );
  }

  return response.json();
}

/**
 * Fetch unresolved or high-frequency unanswered queries for administrative monitoring.
 *
 * @param statusFilter Filter mode ('pending', 'all', 'resolved', 'ignored')
 * @param minFrequency Optional minimum query frequency count
 * @returns AdminAlertsResponse containing count, escalated_count, threshold, and alert items
 */
export async function fetchAdminAlerts(
  statusFilter: string = "pending",
  minFrequency?: number
): Promise<AdminAlertsResponse> {
  const params = new URLSearchParams();
  if (statusFilter) {
    params.set("status_filter", statusFilter);
  }
  if (minFrequency !== undefined && minFrequency > 0) {
    params.set("min_frequency", String(minFrequency));
  }

  const queryString = params.toString() ? `?${params.toString()}` : "";
  const response = await fetch(`${BASE_URL}/api/v1/admin/alerts${queryString}`, {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const errorJson = await response.json().catch(() => ({}));
    throw new Error(
      errorJson.detail || `Failed to fetch alerts (status ${response.status})`
    );
  }

  return response.json();
}

/**
 * Permanently delete a specific unanswered query alert by ID.
 */
export async function deleteAdminAlert(
  alertId: number
): Promise<{ success: boolean; id: number; message: string }> {
  const response = await fetch(`${BASE_URL}/api/v1/admin/alerts/${alertId}`, {
    method: "DELETE",
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    const errorJson = await response.json().catch(() => ({}));
    throw new Error(
      errorJson.detail || `Failed to delete alert #${alertId} (status ${response.status})`
    );
  }

  return response.json();
}

/**
 * Mark a specific unanswered query alert as resolved.
 */
export async function resolveAdminAlert(
  alertId: number
): Promise<{ success: boolean; id: number; status: string; message: string }> {
  const response = await fetch(`${BASE_URL}/api/v1/admin/alerts/${alertId}/resolve`, {
    method: "PATCH",
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    const errorJson = await response.json().catch(() => ({}));
    throw new Error(
      errorJson.detail || `Failed to resolve alert #${alertId} (status ${response.status})`
    );
  }

  return response.json();
}

/**
 * Bulk clear or resolve unanswered query alerts.
 */
export async function clearAllAdminAlerts(
  statusFilter: string = "pending",
  action: "delete" | "resolve" = "delete"
): Promise<{ success: boolean; action: string; affected_count: number; message: string }> {
  const params = new URLSearchParams();
  if (statusFilter) {
    params.set("status_filter", statusFilter);
  }
  if (action) {
    params.set("action", action);
  }

  const response = await fetch(
    `${BASE_URL}/api/v1/admin/alerts/clear-all?${params.toString()}`,
    {
      method: "DELETE",
      headers: {
        Accept: "application/json",
      },
    }
  );

  if (!response.ok) {
    const errorJson = await response.json().catch(() => ({}));
    throw new Error(
      errorJson.detail || `Failed to clear alerts (status ${response.status})`
    );
  }

  return response.json();
}

/**
 * Check backend operational health and vector collection metrics.
 */
export async function checkSystemHealth(): Promise<SystemHealthResponse> {
  const response = await fetch(`${BASE_URL}/health`, {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Health check returned status ${response.status}`);
  }

  return response.json();
}

/**
 * Fetch all agents from PostgreSQL database.
 */
export async function fetchAgents(): Promise<Agent[]> {
  const response = await fetch(`${BASE_URL}/api/v1/admin/agents`, {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const errorJson = await response.json().catch(() => ({}));
    throw new Error(
      errorJson.detail || `Failed to fetch agents with status ${response.status}`
    );
  }

  return response.json();
}

/**
 * Fetch a single agent and its knowledge sources by slug from PostgreSQL database.
 */
export async function fetchAgentBySlug(slug: string): Promise<Agent> {
  const cleanSlug = encodeURIComponent(slug.trim());
  const response = await fetch(`${BASE_URL}/api/v1/admin/agents/${cleanSlug}`, {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const errorJson = await response.json().catch(() => ({}));
    throw new Error(
      errorJson.detail || `Failed to fetch agent '${slug}' (status ${response.status})`
    );
  }

  return response.json();
}

/**
 * Create a new agent in PostgreSQL.
 */
export async function createAgent(
  payload: CreateAgentPayload
): Promise<Agent> {
  const response = await fetch(`${BASE_URL}/api/v1/admin/agents`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorJson = await response.json().catch(() => ({}));
    throw new Error(
      errorJson.detail || `Failed to create agent (status ${response.status})`
    );
  }

  return response.json();
}

/**
 * Update agent metadata, persona, or custom system prompt in PostgreSQL.
 */
export async function updateAgentInApi(
  slug: string,
  payload: UpdateAgentPayload
): Promise<Agent> {
  const cleanSlug = encodeURIComponent(slug.trim());
  const response = await fetch(`${BASE_URL}/api/v1/admin/agents/${cleanSlug}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorJson = await response.json().catch(() => ({}));
    throw new Error(
      errorJson.detail || `Failed to update agent '${slug}' (status ${response.status})`
    );
  }

  return response.json();
}

export const updateAgentApi = updateAgentInApi;

/**
 * Delete an agent and its knowledge sources from PostgreSQL and ChromaDB.
 */
export async function deleteAgent(
  agentId: string
): Promise<{ success: boolean; deleted_id: string; message?: string }> {
  const cleanId = encodeURIComponent(agentId.trim());
  const response = await fetch(`${BASE_URL}/api/v1/admin/agents/${cleanId}`, {
    method: "DELETE",
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    const errorJson = await response.json().catch(() => ({}));
    const err: any = new Error(
      errorJson.detail || `Failed to delete agent '${agentId}' (status ${response.status})`
    );
    err.status = response.status;
    throw err;
  }

  return response.json();
}

/**
 * Fetch global application settings (active provider, model, token quota, API keys).
 */
export async function fetchAppSettings(): Promise<AppSettings> {
  const response = await fetch(`${BASE_URL}/api/v1/admin/settings`, {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  if (!response.ok) {
    const errorJson = await response.json().catch(() => ({}));
    throw new Error(errorJson.detail || "Failed to fetch application settings");
  }
  return response.json();
}

/**
 * Update global application settings (active provider, model, token quota, API keys).
 */
export async function updateAppSettings(
  payload: Partial<AppSettings>
): Promise<{ status: string; message: string; settings: AppSettings }> {
  const response = await fetch(`${BASE_URL}/api/v1/admin/settings`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const errorJson = await response.json().catch(() => ({}));
    throw new Error(errorJson.detail || "Failed to update application settings");
  }
  return response.json();
}

/**
 * Fetch curated and live list of available LLM models.
 * @param refresh If true, bypasses backend cache and fetches latest models from OpenRouter
 */
export async function fetchAvailableModels(refresh = false): Promise<CuratedModel[]> {
  const url = `${BASE_URL}/api/v1/admin/settings/models${refresh ? "?refresh=true" : ""}`;
  const response = await fetch(url, {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  if (!response.ok) {
    const errorJson = await response.json().catch(() => ({}));
    throw new Error(errorJson.detail || "Failed to fetch available models");
  }
  return response.json();
}

/**
 * Fetch real-time token consumption analytics and budget metrics.
 */
export async function fetchTokenAnalytics(): Promise<TokenAnalyticsResponse> {
  const response = await fetch(`${BASE_URL}/api/v1/admin/analytics/tokens`, {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  if (!response.ok) {
    const errorJson = await response.json().catch(() => ({}));
    throw new Error(errorJson.detail || "Failed to fetch token analytics");
  }
  return response.json();
}

/**
 * Fetch real-time rate limits, usage, and quota status across Groq and OpenRouter.
 */
export async function fetchProviderLimits(): Promise<ProviderLimitsResponse> {
  const response = await fetch(`${BASE_URL}/api/v1/admin/provider-limits`, {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  if (!response.ok) {
    const errorJson = await response.json().catch(() => ({}));
    throw new Error(errorJson.detail || "Failed to fetch provider quota limits");
  }
  return response.json();
}



