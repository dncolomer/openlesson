// ============================================
// Uncertain Systems Proof-of-Work API - Shared Types
// ============================================

// --- API Key Types ---

export type ApiKeyScope =
  | "protocols:read"
  | "protocols:write"
  | "knowledge-regions:read"
  | "knowledge-regions:write"
  | "sessions:read"
  | "sessions:write"
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
  /** API key row organization_id only — not the last-switched profile org. */
  key_organization_id?: string | null;
  is_org_admin: boolean;
  key_id: string;
  scopes: ApiKeyScope[];
  auth_method?: "api_key" | "oauth";
  oauth_client_id?: string;
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
  "GET /api/v3/protocols": "protocols:read",
  "POST /api/v3/protocols": "protocols:write",
  "GET /api/v3/protocol-settings": "protocols:read",
  "GET /api/v3/knowledge-regions": "knowledge-regions:read",
  "POST /api/v3/knowledge-regions": "knowledge-regions:write",
};
