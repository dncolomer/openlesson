import type { AuthContext } from "./types";

export const WORKSPACE_PROOF_OF_WORK_TYPES = ["tool", "screen", "video", "eeg"] as const;
export type WorkspaceProofOfWorkType = (typeof WORKSPACE_PROOF_OF_WORK_TYPES)[number];

/** Input aliases (e.g. screenshot → screen) for upload clients — not a legacy table path. */
const TYPE_ALIASES: Record<string, WorkspaceProofOfWorkType> = {
  tool: "tool",
  screen: "screen",
  screenshot: "screen",
  screenshots: "screen",
  video: "video",
  eeg: "eeg",
};

const MIME_BY_TYPE: Record<WorkspaceProofOfWorkType, Set<string>> = {
  tool: new Set(["application/json", "text/plain", "text/markdown", "text/x-markdown"]),
  screen: new Set(["image/png", "image/jpeg", "image/jpg", "image/webp"]),
  video: new Set(["video/mp4", "video/webm", "video/quicktime"]),
  eeg: new Set(["application/json", "text/plain"]),
};

export const MAX_WORKSPACE_PROOF_OF_WORK_BYTES = 10 * 1024 * 1024;

export function normalizeProofOfWorkType(value: unknown): WorkspaceProofOfWorkType | null {
  if (typeof value !== "string") return null;
  return TYPE_ALIASES[value.trim().toLowerCase()] || null;
}

export function isAllowedProofOfWorkMime(type: WorkspaceProofOfWorkType, mimeType: string): boolean {
  return MIME_BY_TYPE[type].has(mimeType.trim().toLowerCase());
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
  "id, workspace_id, block_id, session_id, proof_of_work_type, file_name, mime_type, file_size, xai_file_id, timestamp_ms, chunk_index, metadata, tool_name, tool_action, device_name, sample_count, created_at";

export async function insertWorkspaceProofOfWorkRow(
  supabase: import("@supabase/supabase-js").SupabaseClient,
  payload: Record<string, unknown>
): Promise<{ row: WorkspaceProofOfWorkRow | null; error: { message?: string } | null }> {
  const { data, error } = await supabase
    .from("workspace_proof_of_work")
    .insert(payload)
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
