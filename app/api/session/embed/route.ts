/**
 * Persist a completed Solve / Calibrate / Verify / Learn embedding for a live session.
 */
import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-error-envelope";
import { persistCompletedFlowEmbedding } from "@/lib/flow-embedding-store";
import { persistSolveCompletedEmbedding } from "@/lib/solve-flow-embedding";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  parseMapPlayDataAccessFlags,
  playCopyContributionEmbeddingInput,
} from "@/lib/map-play-data-access";
import { isPlayCopyWorkspace } from "@/lib/workspace-play-copy";
import { sessionBranchModelFromUnknown } from "@/lib/session-branch-model";
import type { FlowKind, FlowPowRow } from "@/lib/flow-embedding";
import {
  requireSessionProofAccess,
  sessionProofAccessFromBody,
} from "@/lib/session-proof-access";
import { isProofWorkspaceId } from "@/lib/pow-api/billing-workspace";

export const runtime = "nodejs";

const FLOW_KINDS = new Set<FlowKind>(["calibrate", "learn", "verify", "solve"]);

function parsePow(raw: unknown): FlowPowRow[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((row): row is FlowPowRow => !!row && typeof row === "object");
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const access = await requireSessionProofAccess(sessionProofAccessFromBody(body));
    if (access instanceof NextResponse) return access;

    const requestedKind = FLOW_KINDS.has(body.flowKind as FlowKind)
      ? (body.flowKind as FlowKind)
      : access.flowKind;
    const flowKind = requestedKind;
    if (!flowKind) return jsonError(400, "flowKind must be calibrate, learn, verify, or solve");

    const sequence = Array.isArray(body.sequence)
      ? body.sequence.filter((id): id is string => typeof id === "string")
      : null;
    const runId =
      (typeof body.runId === "string" && body.runId.trim()) ||
      access.tapSessionId ||
      access.sessionId;
    const flowId =
      (typeof body.flowId === "string" && body.flowId.trim()) || access.flowId;
    const identity =
      (typeof body.identity === "string" && body.identity.trim()) || access.identity;
    const workspaceId = isProofWorkspaceId(access.workspaceId) ? access.workspaceId : null;
    const ownerUserId = access.ownerUserId;
    const source =
      (typeof body.source === "string" && body.source.trim()) || flowKind;

    const stored =
      flowKind === "solve" && flowId && runId
        ? await persistSolveCompletedEmbedding({
            ownerUserId,
            workspaceId,
            flowId,
            runId,
            identity,
            source,
            model: sessionBranchModelFromUnknown(body.model),
            sequence,
            pow: parsePow(body.pow),
          })
        : await persistCompletedFlowEmbedding({
            workspaceId: workspaceId || undefined,
            ownerUserId,
            flowKind,
            flowId,
            runId,
            identity,
            source,
            model: sessionBranchModelFromUnknown(body.model),
            sequence: flowKind === "calibrate" ? null : sequence,
            pow: parsePow(body.pow),
            raw: body.raw,
          });

    if (workspaceId && stored.flow_id && stored.run_id) {
      const admin = createAdminClient();
      const { data: copy } = await admin
        .from("workspaces")
        .select("is_play_copy, original_workspace_id, user_id")
        .eq("id", workspaceId)
        .maybeSingle();
      if (isPlayCopyWorkspace(copy)) {
        const originalId = String(copy?.original_workspace_id || "").trim();
        if (originalId) {
          const { data: sourceMap } = await admin
            .from("workspaces")
            .select("play_share_path, play_share_pow, user_id")
            .eq("id", originalId)
            .maybeSingle();
          const contribution = playCopyContributionEmbeddingInput({
            flags: parseMapPlayDataAccessFlags(sourceMap),
            playerUserId: String(copy?.user_id || stored.owner_user_id || ownerUserId),
            authorUserId: String(sourceMap?.user_id || ""),
            flowKind,
            flowId: stored.flow_id,
            runId: stored.run_id,
            identity: stored.identity,
            raw: stored.raw,
          });
          if (contribution) {
            await persistCompletedFlowEmbedding(contribution);
          }
        }
      }
    }

    return NextResponse.json({
      id: stored.id,
      embedding_model_id: stored.embedding_model_id,
      dim: stored.dim,
      vector: stored.vector,
      raw: stored.raw,
      flow_kind: stored.flow_kind,
      flow_id: stored.flow_id,
      run_id: stored.run_id,
      identity: stored.identity,
    });
  } catch (error) {
    return jsonError(
      500,
      error instanceof Error ? error.message : "Could not store flow embedding",
    );
  }
}
