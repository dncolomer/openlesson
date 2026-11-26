/**
 * Dual persist for region-simulation samples: embedding bag + TAP-shaped PoW.
 * session_id stays null. Inspect matches metadata.tap_session_id.
 */

import { getBlobStore } from "@/lib/ai/blob-store";
import { assertNoPersonMedia } from "@/lib/behavior-capture";
import { POW_MODEL_VERSION } from "@/lib/core-data-model";
import { isUuid } from "@/lib/domain/types";
import type { FlowPowRow } from "@/lib/flow-embedding";
import { persistCompletedFlowEmbedding, type StoredFlowEmbedding } from "@/lib/flow-embedding-store";
import { insertWorkspaceProofOfWorkRow } from "@/lib/pow-api/workspace-proof-of-work";
import { REGION_SIMULATION_SOURCE } from "@/lib/region-simulation";
import { createAdminClient } from "@/lib/supabase/admin";
import type { FlowKind } from "@/lib/flow-embedding";
import type { SessionBranchModel } from "@/lib/session-branch-model";

export function applyProofOfWorkRunIdFilter<T>(query: T, runId: string): T {
  const id = String(runId || "").trim();
  if (!id) return query;
  const next = query as {
    or: (filter: string) => T;
    contains: (col: string, value: Record<string, unknown>) => T;
  };
  if (isUuid(id)) {
    return next.or(`session_id.eq.${id},metadata->>tap_session_id.eq.${id}`);
  }
  return next.contains("metadata", { tap_session_id: id });
}

function supabaseConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

function jsonBytes(value: unknown): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(value));
}

export async function persistRegionSimulationProof(input: {
  ownerUserId: string;
  workspaceId?: string | null;
  runId: string;
  family: "exploration" | "ai_use";
  pow: readonly FlowPowRow[];
}): Promise<number> {
  if (!supabaseConfigured()) return 0;
  const ownerUserId = String(input.ownerUserId || "").trim();
  const runId = String(input.runId || "").trim();
  if (!ownerUserId || !runId) return 0;
  const supabase = createAdminClient();
  const store = getBlobStore();
  let written = 0;
  for (let index = 0; index < input.pow.length; index += 1) {
    const row = input.pow[index]!;
    const payload = {
      type: row.type,
      tool_name: row.tool_name,
      tool_action: row.tool_action,
      timestamp_ms: row.timestamp_ms,
      payload: row.payload ?? null,
      metadata: row.metadata ?? null,
    };
    assertNoPersonMedia({
      mimeType: "application/json",
      kind: "tool",
      payload: JSON.stringify(payload),
      fileName: `${runId}-${index}.json`,
    });
    const put = await store.put({
      name: `${runId}-${index}.json`,
      mimeType: "application/json",
      bytes: jsonBytes(payload),
    });
    const { error } = await insertWorkspaceProofOfWorkRow(supabase, {
      session_id: null,
      user_id: ownerUserId,
      workspace_id: input.workspaceId || null,
      proof_of_work_type: row.type === "screen" ? "screen" : "tool",
      pow_model_version: POW_MODEL_VERSION,
      file_name: `${runId}-${index}.json`,
      mime_type: "application/json",
      xai_file_id: put.id,
      timestamp_ms: row.timestamp_ms ?? index,
      chunk_index: index,
      tool_name: row.tool_name || "canvas",
      tool_action: row.tool_action || "scene",
      metadata: {
        ...(row.metadata && typeof row.metadata === "object" ? row.metadata : {}),
        tap_session_id: runId,
        origin: REGION_SIMULATION_SOURCE,
        family: input.family,
      },
    });
    if (!error) written += 1;
  }
  return written;
}

export async function persistRegionSimulationSample(input: {
  ownerUserId: string;
  workspaceId?: string | null;
  flowKind: FlowKind;
  flowId: string;
  runId: string;
  identity: string;
  linkLabel?: string | null;
  family: "exploration" | "ai_use";
  model: SessionBranchModel;
  sequence: readonly string[];
  pow: readonly FlowPowRow[];
}): Promise<StoredFlowEmbedding> {
  const stored = await persistCompletedFlowEmbedding({
    ownerUserId: input.ownerUserId,
    workspaceId: input.workspaceId || undefined,
    flowKind: input.flowKind,
    flowId: input.flowId,
    runId: input.runId,
    identity: input.identity,
    source: REGION_SIMULATION_SOURCE,
    linkLabel: input.linkLabel,
    model: input.model,
    sequence: input.sequence,
    pow: input.pow,
    audioEnforced: false,
  });
  try {
    await persistRegionSimulationProof({
      ownerUserId: input.ownerUserId,
      workspaceId: input.workspaceId,
      runId: input.runId,
      family: input.family,
      pow: input.pow,
    });
  } catch {
    /* embedding already stored */
  }
  return stored;
}
