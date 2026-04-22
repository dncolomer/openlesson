/**
 * Persist analysis heartbeat results to xAI Files + the session_analysis table.
 *
 * Every time the analysis heartbeat runs we write the full result (plan
 * update JSON + reasoning) as a txt file on xAI so it's available for
 * later review / replay via attachment_search.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { uploadFileToXAI } from "./xai-files";

export interface AnalysisResultSnapshot {
  gapScore?: number;
  planChanged?: boolean;
  canAutoAdvance?: boolean;
  signals?: string[];
  reasoning?: string;
  advanceReasoning?: string;
  nextRequest?: { type: string; text: string } | null;
  currentStepIndex?: number;
  probesToArchive?: string[];
  updatedSteps?: Array<Record<string, unknown>>;
}

export interface StoreAnalysisOptions {
  supabase: SupabaseClient;
  sessionId: string;
  userId: string;
  timestampMs?: number;
  /** Label for where this analysis originated (e.g. "heartbeat", "v2_analyze"). */
  source: string;
  /** Full parsed result from updateSessionPlanLLM (or equivalent). */
  result: AnalysisResultSnapshot;
  /** Any additional context you want captured in the txt file. */
  extra?: Record<string, unknown>;
}

/**
 * Upload a human-readable record of the analysis to xAI and persist a row
 * in `session_analysis`. Best-effort — failures are logged but don't throw.
 */
export async function storeAnalysisResult(opts: StoreAnalysisOptions): Promise<void> {
  const ts = opts.timestampMs ?? Date.now();

  const payload = {
    session_id: opts.sessionId,
    user_id: opts.userId,
    source: opts.source,
    timestamp_ms: ts,
    timestamp_iso: new Date(ts).toISOString(),
    result: opts.result,
    ...(opts.extra ? { context: opts.extra } : {}),
  };

  // Pretty-printed JSON as a text document
  const fileContent =
    `# Analysis @ ${new Date(ts).toISOString()} (${opts.source})\n\n` +
    JSON.stringify(payload, null, 2);

  const fileName = `${opts.sessionId}_analysis_${ts}.txt`;
  const base64 = Buffer.from(fileContent, "utf-8").toString("base64");

  let xaiFileId: string | null = null;
  try {
    const uploaded = await uploadFileToXAI(fileName, "text/plain", base64);
    xaiFileId = uploaded.file_id;
  } catch (err) {
    console.error("[storeAnalysisResult] xAI upload failed:", err);
    return;
  }

  const { error } = await opts.supabase.from("session_analysis").insert({
    session_id: opts.sessionId,
    user_id: opts.userId,
    timestamp_ms: ts,
    xai_file_id: xaiFileId,
    gap_score: opts.result.gapScore ?? null,
    plan_changed: opts.result.planChanged ?? false,
    can_auto_advance: opts.result.canAutoAdvance ?? false,
    signals: opts.result.signals ?? [],
    reasoning: opts.result.reasoning ?? null,
    source: opts.source,
    metadata: {
      advance_reasoning: opts.result.advanceReasoning,
      next_request: opts.result.nextRequest,
      current_step_index: opts.result.currentStepIndex,
      probes_to_archive: opts.result.probesToArchive,
      ...(opts.extra ?? {}),
    },
  });

  if (error) {
    console.error("[storeAnalysisResult] session_analysis insert failed:", error.message);
  }
}
