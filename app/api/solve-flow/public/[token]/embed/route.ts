/**
 * Persist a completed Solve-flow embedding for the claimed public session.
 */
import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-error-envelope";
import { persistSolveCompletedEmbedding } from "@/lib/solve-flow-embedding";
import { persistCompletedFlowEmbedding } from "@/lib/flow-embedding-store";
import { resolveSolveSessionAccess } from "@/lib/solve-session-auth";
import { sessionBranchModelFromUnknown } from "@/lib/session-branch-model";
import type { FlowPowRow } from "@/lib/flow-embedding";
import {
  parseMapPlayDataAccessFlags,
  playCopyContributionEmbeddingInput,
} from "@/lib/map-play-data-access";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

function parsePow(raw: unknown): FlowPowRow[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((row) => row && typeof row === "object") as FlowPowRow[];
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ token: string }> },
) {
  const { token } = await context.params;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const sessionId = String(body.sessionId || body.session_id || "").trim();
  const access = await resolveSolveSessionAccess(token, sessionId);
  if ("error" in access) return jsonError(access.status, access.error);
  const sequence = Array.isArray(body.sequence)
    ? body.sequence.map((item) => String(item))
    : null;
  const playCopy = Boolean(access.workspaceId);
  const stored = await persistSolveCompletedEmbedding({
    ownerUserId: access.runOwnerUserId,
    workspaceId: access.workspaceId || null,
    flowId: access.flow.id,
    runId: sessionId,
    identity: String(body.identity || access.identity || "").trim() || access.identity,
    source: playCopy ? "play_copy" : "solve",
    model: sessionBranchModelFromUnknown(body.model),
    sequence,
    pow: parsePow(body.pow),
  });
  if (playCopy && access.workspaceId) {
    const admin = createAdminClient();
    const { data: copy } = await admin
      .from("workspaces")
      .select("original_workspace_id")
      .eq("id", access.workspaceId)
      .maybeSingle();
    const originalId = String(copy?.original_workspace_id || "").trim();
    if (originalId) {
      const { data: sourceMap } = await admin
        .from("workspaces")
        .select("play_share_path, play_share_pow, user_id")
        .eq("id", originalId)
        .maybeSingle();
      const flags = parseMapPlayDataAccessFlags(sourceMap);
      const contribution = playCopyContributionEmbeddingInput({
        flags,
        playerUserId: access.runOwnerUserId,
        authorUserId: String(sourceMap?.user_id || access.ownerUserId),
        flowKind: "solve",
        flowId: access.flow.id,
        runId: sessionId,
        identity: stored.identity,
        raw: stored.raw,
      });
      if (contribution) {
        await persistCompletedFlowEmbedding(contribution);
      }
    }
  }
  return NextResponse.json({
    id: stored.id,
    flow_kind: stored.flow_kind,
    flow_id: stored.flow_id,
    run_id: stored.run_id,
    identity: stored.identity,
  });
}
