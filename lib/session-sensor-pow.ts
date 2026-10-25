/**
 * Session sensor media → proof of work.
 * Audio, transcript, screen, tool, EEG, and facial writes land on
 * proof_of_work with an xAI file id. Product code does not delete them.
 */

import { POW_MODEL_VERSION, parseProofOfWorkType, type ProofOfWorkType } from "@/lib/core-data-model";

export const SENSOR_POW_TOOL_NAMES = {
  audio: "audio",
  transcript: "transcript",
  facial: "facial",
  analysis: "analysis",
  probe: "probe",
} as const;

export type SessionSensorKind = "facial" | "tool" | "eeg" | "screen" | "transcript" | "audio" | "analysis";

export function proofOfWorkTypeForSensor(kind: SessionSensorKind): ProofOfWorkType {
  if (kind === "screen") return "screen";
  if (kind === "eeg") return "eeg";
  if (kind === "audio") return "video";
  return "tool";
}

export function toolNameForSensor(kind: SessionSensorKind, toolName?: string | null): string | null {
  if (kind === "tool") return toolName || "tool";
  if (kind === "screen" || kind === "eeg") return toolName || null;
  return SENSOR_POW_TOOL_NAMES[kind as keyof typeof SENSOR_POW_TOOL_NAMES] || kind;
}

export function sensorPowInsertPayload(input: {
  sessionId: string;
  userId: string;
  workspaceId: string;
  kind: SessionSensorKind;
  xaiFileId: string;
  fileName?: string;
  mimeType: string;
  fileSize?: number | null;
  timestampMs?: number;
  chunkIndex?: number;
  metadata?: Record<string, unknown>;
  toolName?: string | null;
  toolAction?: string | null;
  deviceName?: string | null;
  sampleCount?: number | null;
  blockId?: string | null;
}): Record<string, unknown> {
  const type = parseProofOfWorkType(proofOfWorkTypeForSensor(input.kind)) || "tool";
  return {
    workspace_id: input.workspaceId,
    session_id: input.sessionId,
    block_id: input.blockId ?? null,
    user_id: input.userId,
    proof_of_work_type: type,
    pow_model_version: POW_MODEL_VERSION,
    file_name: input.fileName || `${input.kind}.bin`,
    mime_type: input.mimeType,
    file_size: input.fileSize ?? null,
    xai_file_id: input.xaiFileId,
    timestamp_ms: typeof input.timestampMs === "number" ? input.timestampMs : Date.now(),
    chunk_index: typeof input.chunkIndex === "number" ? input.chunkIndex : 0,
    metadata: { ...(input.metadata || {}), sensor_kind: input.kind },
    tool_name: toolNameForSensor(input.kind, input.toolName),
    tool_action: input.toolAction ?? null,
    device_name: input.deviceName ?? null,
    sample_count: input.sampleCount ?? null,
  };
}

export function sensorKindFromPowRow(row: {
  proof_of_work_type?: string | null;
  tool_name?: string | null;
  metadata?: Record<string, unknown> | null;
}): SessionSensorKind | null {
  const metaKind = row.metadata?.sensor_kind;
  if (
    metaKind === "facial" ||
    metaKind === "tool" ||
    metaKind === "eeg" ||
    metaKind === "screen" ||
    metaKind === "transcript" ||
    metaKind === "audio" ||
    metaKind === "analysis"
  ) {
    return metaKind;
  }
  if (row.tool_name === "transcript") return "transcript";
  if (row.tool_name === "audio") return "audio";
  if (row.tool_name === "facial") return "facial";
  if (row.tool_name === "analysis") return "analysis";
  if (row.proof_of_work_type === "screen") return "screen";
  if (row.proof_of_work_type === "eeg") return "eeg";
  if (row.proof_of_work_type === "tool") return "tool";
  return null;
}

export function powRowsForSensorKind<T extends {
  proof_of_work_type?: string | null;
  tool_name?: string | null;
  metadata?: Record<string, unknown> | null;
}>(rows: T[] | null | undefined, kind: SessionSensorKind): T[] {
  return (rows || []).filter((row) => sensorKindFromPowRow(row) === kind);
}

export async function workspaceIdForSession(
  supabase: { from: (table: string) => any },
  sessionId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from("sessions")
    .select("workspace_id, metadata, block_id")
    .eq("id", sessionId)
    .maybeSingle();
  if (!data) return null;
  if (typeof data.workspace_id === "string" && data.workspace_id) return data.workspace_id;
  const meta = data.metadata && typeof data.metadata === "object" ? (data.metadata as Record<string, unknown>) : {};
  if (typeof meta.workspace_id === "string" && meta.workspace_id) return meta.workspace_id;
  return null;
}
