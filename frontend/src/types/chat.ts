/**
 * Production TypeScript interfaces for A7 Logics Client API and state.
 */

export interface ChatRequestPayload {
  message: string;
  session_id?: string;
  tenant_id?: string;
  agent_id?: string;
  agent_name?: string;
  persona?: string;
  system_prompt?: string;
}

export interface IngestResult {
  status: string;
  tenant_id: string;
  chunks_indexed: number;
  files_processed: number;
  url_scraped?: string | null;
}

export interface SourceCitation {
  source: string;
  section?: string;
  content: string;
  metadata?: Record<string, unknown>;
}

export interface ChatResponsePayload {
  answer: string;
  session_id: string;
  timestamp: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: string;
  sessionId?: string;
}

export interface UnansweredLogItem {
  id: number;
  user_query: string;
  normalized_query: string;
  frequency_count: number;
  first_asked_at: string | null;
  last_asked_at: string | null;
  alert_triggered: boolean;
  status: string;
}

export interface AdminAlertsResponse {
  count: number;
  escalated_count: number;
  threshold: number;
  alerts: UnansweredLogItem[];
}

export interface SystemHealthResponse {
  status: string;
  service: string;
  version: string;
  database: string;
  indexed_chunks: number;
  llm_model: string;
  timestamp: string;
}

export interface ScrapePreviewResponse {
  status: string;
  target_url: string;
  extracted_title: string;
  extracted_text: string;
  estimated_chunks: number;
}

export interface IngestContentPayload {
  source_type: "web_text" | "custom_text" | string;
  source_name: string;
  content: string;
  agent_name?: string;
  persona?: string;
}

export interface IngestContentResponse {
  status: string;
  tenant_id: string;
  source_name: string;
  source_type: string;
  chunks_added: number;
  total_chunks: number;
}

export interface SourceItem {
  id?: string;
  source_name: string;
  source_type: string;
  chunks_count: number;
  raw_content?: string;
  created_at?: string;
}

export interface AgentSourcesResponse {
  tenant_id: string;
  total_chunks: number;
  sources: SourceItem[];
}

export interface DeleteSourceResponse {
  status: string;
  tenant_id: string;
  source_name: string;
  deleted: boolean;
  remaining_chunks: number;
}

export interface CreateAgentPayload {
  name: string;
  slug?: string;
  description?: string;
  persona?: string;
  tone?: string;
  target_url?: string;
  targetUrl?: string;
  system_prompt?: string;
  systemPrompt?: string;
  welcome_message?: string;
  welcomeMessage?: string;
}

export interface UpdateAgentPayload {
  name?: string;
  description?: string;
  persona?: string;
  tone?: string;
  target_url?: string;
  targetUrl?: string;
  system_prompt?: string;
  systemPrompt?: string;
  welcome_message?: string;
  welcomeMessage?: string;
  status?: string;
}

export interface AppSettings {
  active_provider: string;
  active_model: string;
  token_monthly_quota: string;
  groq_api_key?: string;
  openrouter_api_key?: string;
  openai_api_key?: string;
}

export interface CuratedModel {
  id: string;
  name: string;
  label?: string;
  provider: string;
  description?: string;
  context_length?: number;
  pricing?: Record<string, any>;
}

export interface AgentTokenBreakdown {
  agent_id: string;
  agent_name: string;
  total_tokens: number;
  queries_count: number;
}

export interface ModelTokenBreakdown {
  model: string;
  tokens: number;
  percentage: number;
}

export interface TokenAnalyticsResponse {
  total_consumed: number;
  monthly_quota: number;
  remaining_tokens: number;
  percentage_used: number;
  prompt_tokens: number;
  completion_tokens: number;
  agents_breakdown: AgentTokenBreakdown[];
  by_model?: ModelTokenBreakdown[];
  by_provider?: Record<string, number>;
}

export interface GroqLimitData {
  configured: boolean;
  status: "active" | "error" | "not_configured" | string;
  status_code?: number | null;
  remaining_tokens?: number | null;
  limit_tokens?: number | null;
  remaining_requests?: number | null;
  limit_requests?: number | null;
  reset_tokens?: string | null;
  reset_requests?: string | null;
  message?: string | null;
}

export interface OpenRouterLimitData {
  configured: boolean;
  status: "active" | "error" | "not_configured" | string;
  status_code?: number | null;
  label?: string | null;
  usage?: number | null;
  limit?: number | null;
  is_free_tier?: boolean | null;
  rate_limit?: {
    requests?: number;
    interval?: string;
  } | null;
  message?: string | null;
}

export interface ProviderLimitsResponse {
  status: string;
  timestamp: string;
  groq: GroqLimitData;
  openrouter: OpenRouterLimitData;
}
