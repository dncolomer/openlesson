export type AdminProofOfWorkDetails = {
  id: string;
  proofOfWorkType: string;
  fileName: string;
  mimeType: string;
  fileSize: number | null;
  toolName: string | null;
  toolAction: string | null;
  deviceName: string | null;
  sampleCount: number | null;
  workspaceId: string | null;
  workspaceTitle: string | null;
  blockId: string | null;
  sessionId: string | null;
  chunkIndex: number;
  timestampMs: number | null;
  metadata: Record<string, unknown>;
  bandPowers: Record<string, unknown> | null;
  createdByApiKeyId: string | null;
  createdAt: string;
};

export const ADMIN_POW_SELECT =
  "id, workspace_id, block_id, session_id, proof_of_work_type, pow_model_version, file_name, mime_type, file_size, xai_file_id, timestamp_ms, chunk_index, metadata, tool_name, tool_action, band_powers, device_name, sample_count, user_id, guest_user_id, created_by_api_key_id, created_at";

type PowDbRow = {
  id: string;
  workspace_id: string | null;
  block_id: string | null;
  session_id: string | null;
  proof_of_work_type: string;
  file_name: string;
  mime_type: string;
  file_size: number | null;
  timestamp_ms: number | null;
  chunk_index: number | null;
  metadata: Record<string, unknown> | null;
  tool_name: string | null;
  tool_action: string | null;
  band_powers: Record<string, unknown> | null;
  device_name: string | null;
  sample_count: number | null;
  created_by_api_key_id: string | null;
  created_at: string;
  user_id?: string | null;
};

export function mapProofOfWorkRow(
  row: PowDbRow,
  workspaceTitle: string | null = null
): AdminProofOfWorkDetails {
  return {
    id: row.id,
    proofOfWorkType: row.proof_of_work_type || "unknown",
    fileName: row.file_name || "—",
    mimeType: row.mime_type || "—",
    fileSize: row.file_size ?? null,
    toolName: row.tool_name ?? null,
    toolAction: row.tool_action ?? null,
    deviceName: row.device_name ?? null,
    sampleCount: row.sample_count ?? null,
    workspaceId: row.workspace_id ?? null,
    workspaceTitle,
    blockId: row.block_id ?? null,
    sessionId: row.session_id ?? null,
    chunkIndex: row.chunk_index ?? 0,
    timestampMs: row.timestamp_ms ?? null,
    metadata: (row.metadata && typeof row.metadata === "object" ? row.metadata : {}) as Record<
      string,
      unknown
    >,
    bandPowers: row.band_powers ?? null,
    createdByApiKeyId: row.created_by_api_key_id ?? null,
    createdAt: row.created_at,
  };
}

export function proofOfWorkSummary(details: Pick<AdminProofOfWorkDetails, "proofOfWorkType" | "toolName" | "fileName" | "workspaceTitle">): string {
  const type = details.proofOfWorkType || "upload";
  if (details.toolName) return `PoW · ${type} · ${details.toolName}`;
  if (details.workspaceTitle) return `PoW · ${type} · ${details.workspaceTitle}`;
  if (details.fileName && details.fileName !== "—") return `PoW · ${type} · ${details.fileName}`;
  return `Proof of work · ${type}`;
}

export function formatFileSize(bytes: number | null | undefined): string {
  if (bytes == null || !Number.isFinite(bytes) || bytes < 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
