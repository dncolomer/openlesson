// ============================================
// OpenLesson Agentic API v2 - Shared Types
// ============================================

// --- API Key Types ---

export type ApiKeyScope =
  | "workspaces:read"
  | "workspaces:write"
  | "ghl:read"
  | "ghl:write"
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
}

// --- Proof Types ---

export type ProofType =
  | "plan_created"
  | "plan_adapted"
  | "session_started"
  | "session_paused"
  | "session_resumed"
  | "session_ended"
  | "analysis_heartbeat"
  | "assistant_query"
  | "session_batch";

export const PROOF_TYPE_VALUES: Record<ProofType, number> = {
  plan_created: 0,
  plan_adapted: 1,
  session_started: 2,
  session_paused: 3,
  session_resumed: 4,
  session_ended: 5,
  analysis_heartbeat: 6,
  assistant_query: 7,
  session_batch: 8,
};

export interface Proof {
  id: string;
  type: ProofType;
  fingerprint: string;
  timestamp: string;
  session_id?: string | null;
  plan_id?: string | null;
  previous_proof_id?: string | null;
  input_hash?: string | null;
  output_hash?: string | null;
  data_hash: string;
  data?: Record<string, unknown> | null;
  anchored: boolean;
  anchor_tx_signature?: string | null;
  anchor_slot?: number | null;
  anchor_timestamp?: string | null;
}

export interface ProofBatch {
  id: string;
  session_id: string;
  user_id: string;
  merkle_root: string;
  proof_ids: string[];
  proof_count: number;
  anchored: boolean;
  anchor_tx_signature?: string | null;
  anchor_slot?: number | null;
  anchor_timestamp?: string | null;
}

// --- Error Types ---

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
  | "block_not_found"
  | "ghl_link_not_found"
  | "teams_required"
  | "guest_not_found"
  | "internal_error";

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
  "POST /workspaces/:id/evidence": "workspaces:write",
  "POST /workspaces/:id/evidence-schema": "workspaces:read",
  "POST /workspaces/:id/integration-skill": "workspaces:read",
  "POST /workspaces/:id/performance": "workspaces:read",
  "POST /workspaces/:id/blocks/:blockId/ghl-links": "ghl:write",
  "GET /workspaces/:id/ghl-links": "ghl:read",
  "GET /workspaces/:id/ghl-links/:linkId/results": "ghl:read",
};
