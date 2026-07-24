import type { SupabaseClient } from "@supabase/supabase-js";
import { queryWorkspaceProofOfWorkRows } from "@/lib/pow-api/workspace-proof-of-work";

export const TAP_TRACE_TOOL_NAME = "tap-thought-trace";
export const TAP_CHAT_TOOL_NAME = "tap-helios-chat";
export const TAP_TRANSCRIPT_TOOL_NAME = "tap-transcript";

export interface TapTranscriptEntry {
  role: string;
  text: string;
  at?: string;
}

export interface TapTranscriptPayload {
  type: "uncertain_systems_tap_transcript";
  tap_session_id: string;
  workspace_id: string;
  block_id?: string | null;
  session_id?: string | null;
  transcript: TapTranscriptEntry[];
  duration_seconds: number;
  completed_at: string;
  /** Embedded in PoW JSON for export — not a separate DB column. */
  quality?: "pure" | "impure";
  impure?: boolean;
  session_quality?: "pure" | "impure";
}

export function buildTapTranscriptPayload(input: {
  tapSessionId: string;
  workspaceId: string;
  blockId?: string | null;
  focusSessionId?: string | null;
  transcript: TapTranscriptEntry[];
  durationSeconds: number;
  completedAt?: string;
  /** When impure, flags are written into the PoW payload itself. */
  sessionQuality?: "pure" | "impure";
}): TapTranscriptPayload {
  const base: TapTranscriptPayload = {
    type: "uncertain_systems_tap_transcript",
    tap_session_id: input.tapSessionId,
    workspace_id: input.workspaceId,
    block_id: input.blockId ?? null,
    session_id: input.focusSessionId ?? null,
    transcript: input.transcript,
    duration_seconds: input.durationSeconds,
    completed_at: input.completedAt ?? new Date().toISOString(),
  };
  if (input.sessionQuality === "impure") {
    return {
      ...base,
      quality: "impure",
      impure: true,
      session_quality: "impure",
    };
  }
  return base;
}

export type TapTraceType = "system1" | "system2";

/** pause_finalize = deliberate stash; auto_stash = silence-driven stash (degrades session purity). */
export type TapSystem1Action = "crystallize" | "pause_finalize" | "auto_stash";
export type TapSystem2Action = "send" | "skip" | "select" | "deselect" | "resend" | "edit";

export interface TapChatExchangePayload {
  type: "uncertain_systems_tap_chat_exchange";
  tap_session_id: string;
  workspace_id: string;
  block_id?: string | null;
  focus_session_id?: string | null;
  learner_thought: string;
  helios_reply: string;
  timestamp_ms: number;
  at: string;
}

export function buildTapChatExchangePayload(input: {
  tapSessionId: string;
  workspaceId: string;
  blockId?: string | null;
  focusSessionId?: string | null;
  learnerThought: string;
  heliosReply: string;
  timestampMs?: number;
}): TapChatExchangePayload {
  const timestampMs = input.timestampMs ?? Date.now();
  return {
    type: "uncertain_systems_tap_chat_exchange",
    tap_session_id: input.tapSessionId,
    workspace_id: input.workspaceId,
    block_id: input.blockId ?? null,
    focus_session_id: input.focusSessionId ?? null,
    learner_thought: input.learnerThought,
    helios_reply: input.heliosReply,
    timestamp_ms: timestampMs,
    at: new Date(timestampMs).toISOString(),
  };
}

export interface TapThoughtTracePayload {
  type: "uncertain_systems_tap_thought_trace";
  trace_type: TapTraceType;
  action: TapSystem1Action | TapSystem2Action;
  tap_session_id: string;
  workspace_id: string;
  block_id?: string | null;
  focus_session_id?: string | null;
  thought_id?: string;
  thought_ids?: string[];
  chain_id?: string;
  text?: string;
  original_text?: string;
  combined?: boolean;
  timestamp_ms: number;
  at: string;
}

export interface TapTraceEvidenceRow {
  xai_file_id: string;
  metadata: Record<string, unknown>;
  timestamp_ms: number;
  tool_action: string | null;
}

export function buildTapThoughtTracePayload(input: {
  traceType: TapTraceType;
  action: TapSystem1Action | TapSystem2Action;
  tapSessionId: string;
  workspaceId: string;
  blockId?: string | null;
  focusSessionId?: string | null;
  thoughtId?: string;
  thoughtIds?: string[];
  chainId?: string;
  text?: string;
  originalText?: string;
  combined?: boolean;
  timestampMs?: number;
}): TapThoughtTracePayload {
  const timestampMs = input.timestampMs ?? Date.now();
  return {
    type: "uncertain_systems_tap_thought_trace",
    trace_type: input.traceType,
    action: input.action,
    tap_session_id: input.tapSessionId,
    workspace_id: input.workspaceId,
    block_id: input.blockId ?? null,
    focus_session_id: input.focusSessionId ?? null,
    thought_id: input.thoughtId,
    thought_ids: input.thoughtIds,
    chain_id: input.chainId,
    text: input.text,
    original_text: input.originalText,
    combined: input.combined,
    timestamp_ms: timestampMs,
    at: new Date(timestampMs).toISOString(),
  };
}

export async function fetchTapSessionTraces(
  supabase: SupabaseClient,
  tapSessionId: string,
  workspaceId: string,
): Promise<TapTraceEvidenceRow[]> {
  const { data, error } = await queryWorkspaceProofOfWorkRows<TapTraceEvidenceRow>(
    supabase
      .from("workspace_proof_of_work")
      .select("xai_file_id, metadata, timestamp_ms, tool_action")
      .eq("workspace_id", workspaceId)
      .eq("tool_name", TAP_TRACE_TOOL_NAME)
      .contains("metadata", { tap_session_id: tapSessionId })
      .order("timestamp_ms", { ascending: true })
  );

  if (error) throw new Error(error.message);
  return data;
}

/**
 * Flag every PoW row for a TAP session as impure inside `metadata` (no new DB column).
 * Makes session quality part of the exportable PoW data blob.
 */
export async function flagTapSessionProofOfWorkImpure(
  supabase: SupabaseClient,
  workspaceId: string,
  tapSessionId: string,
): Promise<number> {
  const { data, error } = await queryWorkspaceProofOfWorkRows<{
    id: string;
    metadata: Record<string, unknown> | null;
  }>(
    supabase
      .from("workspace_proof_of_work")
      .select("id, metadata")
      .eq("workspace_id", workspaceId)
      .contains("metadata", { tap_session_id: tapSessionId }),
  );

  if (error) throw new Error(error.message);
  if (!data.length) return 0;

  let updated = 0;
  for (const row of data) {
    const nextMetadata = {
      ...(row.metadata && typeof row.metadata === "object" ? row.metadata : {}),
      quality: "impure",
      impure: true,
      session_quality: "impure",
    };
    const { error: updateError } = await supabase
      .from("workspace_proof_of_work")
      .update({ metadata: nextMetadata })
      .eq("id", row.id)
      .eq("workspace_id", workspaceId);
    if (!updateError) updated += 1;
  }
  return updated;
}

// xAI Responses allows at most 20 file attachments per request.
const MAX_TRACE_FILES_FOR_SCORING = 20;

export function buildTraceScoringContext(traces: TapTraceEvidenceRow[]) {
  const system1 = traces.filter((row) => row.metadata?.trace_type === "system1");
  const system2 = traces.filter((row) => row.metadata?.trace_type === "system2");

  const manifestLines = traces.map((row) => {
    const traceType = String(row.metadata?.trace_type || "unknown");
    const action = String(row.metadata?.action || row.tool_action || "unknown");
    const thoughtId = String(row.metadata?.thought_id || "");
    const text = String(row.metadata?.text || "").trim();
    const originalText = String(row.metadata?.original_text || "").trim();
    const at = new Date(Number(row.timestamp_ms || 0)).toISOString();
    const editSuffix =
      action === "edit" && originalText && originalText !== text ? ` (original: ${originalText})` : "";
    return `[${at}] ${traceType}/${action}${thoughtId ? ` thought=${thoughtId}` : ""}: ${text}${editSuffix}`;
  });

  const fileIds = [
    ...new Set(traces.map((row) => row.xai_file_id).filter(Boolean)),
  ].slice(-MAX_TRACE_FILES_FOR_SCORING);

  return {
    system1Count: system1.length,
    system2Count: system2.length,
    manifestText: manifestLines.join("\n"),
    fileIds,
  };
}

export const TAP_SCORE_ANALYSIS_SCHEMA = {
  name: "tap_score_analysis",
  schema: {
    type: "object",
    additionalProperties: true,
    properties: {
      score: { type: "number" },
      lwm_snapshot_score: { type: "number" },
      /** History-compatible mirror of score — not product primary name. */
      verification_score: { type: "number" },
      workspace_goal: { type: "string" },
      markers: { type: "array" },
      gap_analysis: { type: "object" },
      knowledge_gaps: { type: "array" },
      overall_reflection: { type: "string" },
      strengths: { type: "array" },
      growth_areas: { type: "array" },
      follow_up_prompts: { type: "array" },
      confidence: { type: "string" },
    },
    required: [
      "score",
      "lwm_snapshot_score",
      "workspace_goal",
      "markers",
      "overall_reflection",
      "confidence",
    ],
  },
};

export function buildTraceScoringInstructions(traceContext: ReturnType<typeof buildTraceScoringContext>) {
  if (traceContext.system1Count === 0 && traceContext.system2Count === 0) return "";

  return `

Thought trace proof of work (System 1 and System 2) — primary GHC (Genuine Human Cognition) signal:
- System 1 traces (${traceContext.system1Count}): spontaneous crystallized speech — everything the learner said aloud, including thoughts they did NOT submit (stashed/unsent) to the TAP dialogue.
- System 2 traces (${traceContext.system2Count}): deliberate learner decisions — explicit send, edit, skip, select/deselect, or resend actions.

Use the dialogue transcript as the primary TAP exchange (System 1 and System 2 elicitation), and treat attached trace files and the manifest below as first-class proof of work for LWM Snapshot and especially ghc_score / ghc_confidence.
Compare System 1 vs System 2: knowledge articulated but not sent may reveal hesitation, incomplete understanding, or metacognitive filtering — cite both sent and unsent traces in gap_analysis proof_of_work and temporal_summary where relevant.
Timestamps on traces inform temporal scoring (inter-event gaps, dwell before send, idle before crystallize).

Trace manifest:
${traceContext.manifestText || "No trace manifest available."}`;
}