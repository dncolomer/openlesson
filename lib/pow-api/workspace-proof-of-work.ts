import type { AuthContext } from "./types";

/** Current persisted Proof-of-Work model. Unknown versions are rejected on write. */
export const POW_MODEL_VERSION = "pow-model-v1" as const;
export type PowModelVersion = typeof POW_MODEL_VERSION;

export const WORKSPACE_PROOF_OF_WORK_TYPES = ["tool", "screen", "video", "eeg"] as const;
export type WorkspaceProofOfWorkType = (typeof WORKSPACE_PROOF_OF_WORK_TYPES)[number];

/** Wire types accepted on upload (stored types + aliases). `speech` is not in this list. */
export const WORKSPACE_PROOF_OF_WORK_WIRE_TYPES = [
  "tool",
  "screen",
  "screenshot",
  "screenshots",
  "video",
  "eeg",
] as const;
export type WorkspaceProofOfWorkWireType = (typeof WORKSPACE_PROOF_OF_WORK_WIRE_TYPES)[number];

/** Input aliases (e.g. screenshot → screen) for upload clients — not a legacy table path. */
const TYPE_ALIASES: Record<string, WorkspaceProofOfWorkType> = {
  tool: "tool",
  screen: "screen",
  screenshot: "screen",
  screenshots: "screen",
  video: "video",
  eeg: "eeg",
};

export const PROOF_OF_WORK_MIME_BY_TYPE: Record<WorkspaceProofOfWorkType, readonly string[]> = {
  tool: ["application/json", "text/plain", "text/markdown", "text/x-markdown"],
  screen: ["image/png", "image/jpeg", "image/jpg", "image/webp"],
  video: ["video/mp4", "video/webm", "video/quicktime"],
  eeg: ["application/json", "text/plain"],
};

const MIME_BY_TYPE: Record<WorkspaceProofOfWorkType, Set<string>> = {
  tool: new Set(PROOF_OF_WORK_MIME_BY_TYPE.tool),
  screen: new Set(PROOF_OF_WORK_MIME_BY_TYPE.screen),
  video: new Set(PROOF_OF_WORK_MIME_BY_TYPE.video),
  eeg: new Set(PROOF_OF_WORK_MIME_BY_TYPE.eeg),
};

export const MAX_WORKSPACE_PROOF_OF_WORK_BYTES = 10 * 1024 * 1024;

export function normalizeProofOfWorkType(value: unknown): WorkspaceProofOfWorkType | null {
  if (typeof value !== "string") return null;
  return TYPE_ALIASES[value.trim().toLowerCase()] || null;
}

export function isAllowedProofOfWorkMime(type: WorkspaceProofOfWorkType, mimeType: string): boolean {
  return MIME_BY_TYPE[type].has(mimeType.trim().toLowerCase());
}

export function resolvePowModelVersion(value: unknown): PowModelVersion | null {
  if (value == null || value === "") return POW_MODEL_VERSION;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return POW_MODEL_VERSION;
  return trimmed === POW_MODEL_VERSION ? POW_MODEL_VERSION : null;
}

export type ProofOfWorkSchemaCheck =
  | {
      ok: true;
      type: WorkspaceProofOfWorkType;
      mime_type: string;
      data: string;
      pow_model_version: PowModelVersion;
    }
  | {
      ok: false;
      code:
        | "unknown_type"
        | "unknown_model_version"
        | "missing_required_fields"
        | "mime_not_allowed"
        | "empty_data"
        | "too_large";
      message: string;
    };

/**
 * Sole write-time type / MIME / version gate for REST, MCP, stash, ILE, and TAP.
 * Required wire fields: type, mime_type, data. Aliases screenshot(s) → screen.
 */
export function checkProofOfWorkSchema(input: {
  type?: unknown;
  mime_type?: unknown;
  data?: unknown;
  pow_model_version?: unknown;
}): ProofOfWorkSchemaCheck {
  const pow_model_version = resolvePowModelVersion(input.pow_model_version);
  if (!pow_model_version) {
    return {
      ok: false,
      code: "unknown_model_version",
      message: `pow_model_version must be ${POW_MODEL_VERSION}`,
    };
  }

  const type = normalizeProofOfWorkType(input.type);
  if (!type) {
    return {
      ok: false,
      code: "unknown_type",
      message: `type must be one of: ${WORKSPACE_PROOF_OF_WORK_WIRE_TYPES.join(", ")}`,
    };
  }

  const mime_type = typeof input.mime_type === "string" ? input.mime_type.trim().toLowerCase() : "";
  const data = typeof input.data === "string" ? input.data : "";
  if (!mime_type || !data) {
    return {
      ok: false,
      code: "missing_required_fields",
      message: "mime_type and data (base64) are required",
    };
  }
  if (!isAllowedProofOfWorkMime(type, mime_type)) {
    return {
      ok: false,
      code: "mime_not_allowed",
      message: `mime_type ${mime_type} is not allowed for type ${type}`,
    };
  }

  const fileBytes = Buffer.from(data, "base64");
  if (!fileBytes.length) {
    return {
      ok: false,
      code: "empty_data",
      message: "data must be non-empty base64 content",
    };
  }
  if (fileBytes.length > MAX_WORKSPACE_PROOF_OF_WORK_BYTES) {
    return {
      ok: false,
      code: "too_large",
      message: "Proof-of-work file exceeds 10 MB limit",
    };
  }

  return { ok: true, type, mime_type, data, pow_model_version };
}

export function defaultProofOfWorkFileName(type: WorkspaceProofOfWorkType, provided?: string): string {
  if (provided?.trim()) return provided.trim();
  switch (type) {
    case "tool":
      return "tool-usage.json";
    case "screen":
      return "screenshot.png";
    case "video":
      return "capture.mp4";
    case "eeg":
      return "eeg-chunk.json";
  }
}

export interface WorkspaceProofOfWorkRow {
  id: string;
  workspace_id: string;
  block_id: string | null;
  session_id: string | null;
  proof_of_work_type: WorkspaceProofOfWorkType;
  pow_model_version: PowModelVersion;
  file_name: string;
  mime_type: string;
  file_size: number | null;
  xai_file_id: string;
  timestamp_ms: number;
  chunk_index: number;
  metadata: Record<string, unknown>;
  tool_name: string | null;
  tool_action: string | null;
  band_powers: Record<string, number> | null;
  device_name: string | null;
  sample_count: number | null;
  created_at: string;
}

export function proofOfWorkQueryForAuth(auth: AuthContext) {
  return {
    guestUserId: auth.guest_user_id,
    restrictToGuest: !!auth.guest_user_id,
    restrictToUser: !auth.guest_user_id && !auth.is_org_admin,
    userId: auth.user_id,
  };
}

const PROOF_OF_WORK_SELECT =
  "id, workspace_id, block_id, session_id, proof_of_work_type, pow_model_version, file_name, mime_type, file_size, xai_file_id, timestamp_ms, chunk_index, metadata, tool_name, tool_action, device_name, sample_count, created_at";

export async function insertWorkspaceProofOfWorkRow(
  supabase: import("@supabase/supabase-js").SupabaseClient,
  payload: Record<string, unknown>
): Promise<{ row: WorkspaceProofOfWorkRow | null; error: { message?: string } | null }> {
  const pow_model_version = resolvePowModelVersion(payload.pow_model_version);
  if (!pow_model_version) {
    return { row: null, error: { message: `pow_model_version must be ${POW_MODEL_VERSION}` } };
  }
  const stamped = { ...payload, pow_model_version };

  const { data, error } = await supabase
    .from("workspace_proof_of_work")
    .insert(stamped)
    .select(PROOF_OF_WORK_SELECT)
    .single();

  if (error || !data) {
    return { row: null, error: error || { message: "Insert returned no row" } };
  }

  return { row: data as WorkspaceProofOfWorkRow, error: null };
}

export async function queryWorkspaceProofOfWorkRows<T>(
  result: PromiseLike<{
    data: T[] | null;
    error: { code?: string; message?: string } | null;
  }>
): Promise<{ data: T[]; error: { message?: string } | null }> {
  const { data, error } = await result;
  if (error) {
    return { data: [], error };
  }
  return { data: data || [], error: null };
}

export async function countWorkspaceProofOfWorkForPlan(
  supabase: import("@supabase/supabase-js").SupabaseClient,
  workspaceId: string
): Promise<number> {
  const { count, error } = await supabase
    .from("workspace_proof_of_work")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", workspaceId);

  if (error) return 0;
  return count ?? 0;
}
