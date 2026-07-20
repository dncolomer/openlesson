import type { SupabaseClient } from "@supabase/supabase-js";
import { queryWorkspaceProofOfWorkRows } from "@/lib/pow-api/workspace-proof-of-work";
import { ILE_TRACE_TOOL_NAME } from "@/lib/ile-thought-traces";

/** Max PoW rows scanned when building Knowledge insight suggestions. */
export const INSIGHT_TRACE_SCAN_LIMIT = 200;

/** Max distinct thoughts passed into suggest/create. */
export const INSIGHT_TRACE_MAX_THOUGHTS = 50;

export type WorkspaceInsightThought = {
  id: string;
  text: string;
  timestamp: number;
  sessionId?: string | null;
  blockId?: string | null;
};

type PowTraceRow = {
  id: string;
  session_id: string | null;
  block_id: string | null;
  timestamp_ms: number | null;
  created_at: string;
  metadata: Record<string, unknown> | null;
  tool_action: string | null;
};

/**
 * Collapse PoW ile-thought-trace rows into unique thoughts with non-empty text.
 * Prefers the latest row per thought_id (edits overwrite earlier text).
 */
export function extractInsightThoughtsFromPowRows(rows: PowTraceRow[]): WorkspaceInsightThought[] {
  const byThoughtId = new Map<string, WorkspaceInsightThought>();

  const ordered = [...rows].sort((a, b) => {
    const aMs = typeof a.timestamp_ms === "number" ? a.timestamp_ms : Date.parse(a.created_at) || 0;
    const bMs = typeof b.timestamp_ms === "number" ? b.timestamp_ms : Date.parse(b.created_at) || 0;
    return aMs - bMs;
  });

  for (const row of ordered) {
    const meta = row.metadata && typeof row.metadata === "object" ? row.metadata : {};
    const text = typeof meta.text === "string" ? meta.text.trim() : "";
    if (!text) continue;

    const thoughtId =
      typeof meta.thought_id === "string" && meta.thought_id.trim()
        ? meta.thought_id.trim()
        : row.id;
    const timestampMs =
      typeof row.timestamp_ms === "number" && Number.isFinite(row.timestamp_ms)
        ? row.timestamp_ms
        : Date.parse(row.created_at) || Date.now();

    byThoughtId.set(thoughtId, {
      id: thoughtId,
      text,
      timestamp: timestampMs,
      sessionId: row.session_id,
      blockId: row.block_id,
    });
  }

  return [...byThoughtId.values()]
    .sort((a, b) => a.timestamp - b.timestamp)
    .slice(-INSIGHT_TRACE_MAX_THOUGHTS);
}

/**
 * Load ILE thought traces for a workspace from proof-of-work metadata.
 * Used by Knowledge Insights to suggest/bookmark without an active session.
 */
export async function fetchWorkspaceInsightThoughts(
  supabase: SupabaseClient,
  workspaceId: string,
): Promise<WorkspaceInsightThought[]> {
  const { data, error } = await queryWorkspaceProofOfWorkRows<PowTraceRow>(
    supabase
      .from("workspace_proof_of_work")
      .select("id, session_id, block_id, timestamp_ms, created_at, metadata, tool_action")
      .eq("workspace_id", workspaceId)
      .eq("tool_name", ILE_TRACE_TOOL_NAME)
      .order("timestamp_ms", { ascending: false })
      .limit(INSIGHT_TRACE_SCAN_LIMIT),
  );

  if (error) {
    throw new Error(error.message || "Failed to load thought traces");
  }

  // Rows come newest-first; extractor re-sorts ascending.
  return extractInsightThoughtsFromPowRows(data);
}
