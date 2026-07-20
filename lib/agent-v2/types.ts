// ============================================
// Uncertain Systems Proof-of-Work API - Shared Types
// ============================================

// --- API Key Types ---

export type ApiKeyScope =
  | "workspaces:read"
  | "workspaces:write"
  | "tap:read"
  | "tap:write"
  | "org:read"
  | "org:write"
  | "*";

export interface AgentApiKey {
  id: string;
  user_id: string;
  key_hash: string;
  key_prefix: string;
  label: string | null;
  scopes: ApiKeyScope[];
  rate_limit: number;
  is_active: boolean;
  created_at: string;
  last_used_at: string | null;
  expires_at: string | null;
}

// --- Auth Context ---

export interface AuthContext {
  user_id: string | null;
  guest_user_id: string | null;
  organization_id: string | null;
  is_org_admin: boolean;
  key_id: string;
  scopes: ApiKeyScope[];
  auth_method?: "api_key" | "oauth";
  oauth_client_id?: string;
}

// --- Error Types ---
// Legacy blockchain / proof-tracking types were removed from the agent surface.

export type ErrorCode =
  | "unauthorized"
  | "key_expired"
  | "key_revoked"
  | "forbidden"
  | "subscription_lapsed"
  | "not_found"
  | "validation_error"
  | "rate_limit_exceeded"
  | "workspace_not_found"
  | "workspace_limit_reached"
  | "usage_limit_reached"
  | "block_not_found"
  | "tap_link_not_found"
  /** @deprecated Prefer api_plan_required — kept for reading older client payloads only. */
  | "teams_required"
  /** Canonical plan-gate code for Teams tier / API plan requirements. */
  | "api_plan_required"
  | "guest_not_found"
  | "internal_error"
  | "performance_report_generation_failed"
  /** Re-run blocked until new proof of work is available for this vertical. */
  | "no_new_pow"
  | "model_id_required"
  | "region_id_required"
  | "custom_verification_model_error"
  | "knowledge_distance_error";

const ERROR_CODES: ReadonlySet<string> = new Set<ErrorCode>([
  "unauthorized",
  "key_expired",
  "key_revoked",
  "forbidden",
  "subscription_lapsed",
  "not_found",
  "validation_error",
  "rate_limit_exceeded",
  "workspace_not_found",
  "workspace_limit_reached",
  "usage_limit_reached",
  "block_not_found",
  "tap_link_not_found",
  "teams_required",
  "api_plan_required",
  "guest_not_found",
  "internal_error",
  "performance_report_generation_failed",
  "no_new_pow",
  "model_id_required",
  "region_id_required",
  "custom_verification_model_error",
  "knowledge_distance_error",
]);

/** Narrow unknown thrown codes to a valid API ErrorCode. */
export function toErrorCode(value: unknown, fallback: ErrorCode = "internal_error"): ErrorCode {
  return typeof value === "string" && ERROR_CODES.has(value)
    ? (value as ErrorCode)
    : fallback;
}

export interface ApiError {
  code: ErrorCode;
  message: string;
  details?: Record<string, unknown>;
}

// --- Request/Response Helpers ---

export interface PaginationParams {
  limit: number;
  offset: number;
}

export interface PaginationResponse {
  total: number;
  limit: number;
  offset: number;
  has_more: boolean;
}

// --- Analysis Input Types ---

export interface AudioInput {
  type: "audio";
  data: string; // base64
  format: string; // webm, mp4, ogg, m4a
  duration_ms?: number;
}

export interface ImageInput {
  type: "image";
  data: string; // base64
  mime_type: string;
  description?: string;
}

export interface TextInput {
  type: "text";
  content: string;
}

export type AnalysisInput = AudioInput | ImageInput | TextInput;

// --- Session Types ---

export type SessionStatus = "active" | "paused" | "completed" | "ended_by_tutor";

// --- Scope requirements per endpoint ---

export const ENDPOINT_SCOPES: Record<string, ApiKeyScope> = {
  "POST /workspaces": "workspaces:write",
  "GET /workspaces/:id/blocks": "workspaces:read",
  "POST /workspaces/:id/proof-of-work": "workspaces:write",
  "POST /workspaces/:id/proof-of-work-schema": "workspaces:read",
  "POST /workspaces/:id/integration-skill": "workspaces:read",
  "POST /workspaces/:id/blocks/:blockId/tap-links": "tap:write",
  "GET /workspaces/:id/tap-links": "tap:read",
};
