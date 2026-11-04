/**
 * Persist a completed Solve-flow embedding on the flow owner (no workspace id).
 */

import { persistCompletedFlowEmbedding, type StoredFlowEmbedding } from "@/lib/flow-embedding-store";
import type { SessionBranchModel } from "@/lib/session-branch-model";
import type { FlowPowRow } from "@/lib/flow-embedding";

export async function persistSolveCompletedEmbedding(input: {
  ownerUserId: string;
  flowId: string;
  runId: string;
  workspaceId?: string | null;
  identity?: string | null;
  source?: string | null;
  model?: SessionBranchModel | null;
  sequence?: readonly string[] | null;
  pow?: readonly FlowPowRow[] | null;
}): Promise<StoredFlowEmbedding> {
  return persistCompletedFlowEmbedding({
    ownerUserId: input.ownerUserId,
    workspaceId: input.workspaceId ?? undefined,
    flowKind: "solve",
    flowId: input.flowId,
    runId: input.runId,
    identity: input.identity,
    source: input.source || "solve",
    model: input.model ?? null,
    sequence: input.sequence ?? null,
    pow: input.pow ?? [],
  });
}
