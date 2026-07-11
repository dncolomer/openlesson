import type { SupabaseClient } from "@supabase/supabase-js";
import { queryWorkspaceProofOfWorkRows } from "@/lib/agent-v2/workspace-proof-of-work";

export const GHL_TRACE_TOOL_NAME = "ghl-thought-trace";

export type GhlTraceType = "system1" | "system2";

export type GhlSystem1Action = "crystallize" | "pause_finalize";
export type GhlSystem2Action = "send" | "skip" | "select" | "deselect" | "resend";

export interface GhlThoughtTracePayload {
  type: "openlesson_ghl_thought_trace";
  trace_type: GhlTraceType;
  action: GhlSystem1Action | GhlSystem2Action;
  ghl_session_id: string;
  workspace_id: string;
  block_id?: string | null;
  focus_session_id?: string | null;
  thought_id?: string;
  thought_ids?: string[];
  chain_id?: string;
  text?: string;
  combined?: boolean;
  timestamp_ms: number;
  at: string;
}

export interface GhlTraceEvidenceRow {
  xai_file_id: string;
  metadata: Record<string, unknown>;
  timestamp_ms: number;
  tool_action: string | null;
}

export function buildGhlThoughtTracePayload(input: {
  traceType: GhlTraceType;
  action: GhlSystem1Action | GhlSystem2Action;
  ghlSessionId: string;
  workspaceId: string;
  blockId?: string | null;
  focusSessionId?: string | null;
  thoughtId?: string;
  thoughtIds?: string[];
  chainId?: string;
  text?: string;
  combined?: boolean;
  timestampMs?: number;
}): GhlThoughtTracePayload {
  const timestampMs = input.timestampMs ?? Date.now();
  return {
    type: "openlesson_ghl_thought_trace",
    trace_type: input.traceType,
    action: input.action,
    ghl_session_id: input.ghlSessionId,
    workspace_id: input.workspaceId,
    block_id: input.blockId ?? null,
    focus_session_id: input.focusSessionId ?? null,
    thought_id: input.thoughtId,
    thought_ids: input.thoughtIds,
    chain_id: input.chainId,
    text: input.text,
    combined: input.combined,
    timestamp_ms: timestampMs,
    at: new Date(timestampMs).toISOString(),
  };
}

export async function fetchGhlSessionTraces(
  supabase: SupabaseClient,
  ghlSessionId: string,
  workspaceId: string,
): Promise<GhlTraceEvidenceRow[]> {
  const { data, error } = await queryWorkspaceProofOfWorkRows<GhlTraceEvidenceRow>(
    supabase,
    (table) =>
      supabase
        .from(table)
        .select("xai_file_id, metadata, timestamp_ms, tool_action")
        .eq("workspace_id", workspaceId)
        .eq("tool_name", GHL_TRACE_TOOL_NAME)
        .contains("metadata", { ghl_session_id: ghlSessionId })
        .order("timestamp_ms", { ascending: true })
  );

  if (error) throw new Error(error.message);
  return data;
}

// xAI Responses allows at most 20 file attachments per request.
const MAX_TRACE_FILES_FOR_SCORING = 20;

export function buildTraceScoringContext(traces: GhlTraceEvidenceRow[]) {
  const system1 = traces.filter((row) => row.metadata?.trace_type === "system1");
  const system2 = traces.filter((row) => row.metadata?.trace_type === "system2");

  const manifestLines = traces.map((row) => {
    const traceType = String(row.metadata?.trace_type || "unknown");
    const action = String(row.metadata?.action || row.tool_action || "unknown");
    const thoughtId = String(row.metadata?.thought_id || "");
    const text = String(row.metadata?.text || "").trim();
    const at = new Date(Number(row.timestamp_ms || 0)).toISOString();
    return `[${at}] ${traceType}/${action}${thoughtId ? ` thought=${thoughtId}` : ""}: ${text}`;
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

export const GHL_SCORE_ANALYSIS_SCHEMA = {
  name: "ghl_score_analysis",
  schema: {
    type: "object",
    additionalProperties: true,
    properties: {
      overall_score: { type: "number" },
      conversion_score: { type: "number" },
      conversion_goal: { type: "string" },
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
      "overall_score",
      "conversion_score",
      "conversion_goal",
      "markers",
      "overall_reflection",
      "confidence",
    ],
  },
};

export function buildTraceScoringInstructions(traceContext: ReturnType<typeof buildTraceScoringContext>) {
  if (traceContext.system1Count === 0 && traceContext.system2Count === 0) return "";

  return `

Thought trace proof of work (System 1 and System 2):
- System 1 traces (${traceContext.system1Count}): spontaneous crystallized speech — everything the learner said aloud, including thoughts they did NOT submit to the TAP dialogue.
- System 2 traces (${traceContext.system2Count}): deliberate learner decisions — explicit send, skip, select/deselect, or resend actions.

Use the dialogue transcript as the primary Socratic exchange, but treat attached trace files and the manifest below as first-class proof of work. Compare System 1 vs System 2: knowledge articulated but not sent may reveal hesitation, incomplete understanding, or metacognitive filtering. Cite both sent and unsent traces in gap_analysis proof_of_work where relevant.

Trace manifest:
${traceContext.manifestText || "No trace manifest available."}`;
}