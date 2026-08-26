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
  auth_method?: "api_key" | "oauth" | "tapbench_key";
  oauth_client_id?: string;
  /** Set for TAPBench task keys — PoW is allowed only on this workspace. */
  tapbench_workspace_id?: string | null;
}

// --- Error Types ---
// Canonical envelope types live in lib/api so product auth does not import PoW.

export type { ApiError, ErrorCode } from "@/lib/api/error-codes";
export { toErrorCode } from "@/lib/api/error-codes";

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
