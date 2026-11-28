/**
 * Persist a completed Verify / leftover Learn embedding for a live session.
 */
import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-error-envelope";
import { persistCompletedFlowEmbedding } from "@/lib/flow-embedding-store";
import { sessionBranchModelFromUnknown } from "@/lib/session-branch-model";
import type { FlowPowRow } from "@/lib/flow-embedding";
import {
  requireSessionProofAccess,
  sessionProofAccessFromBody,
} from "@/lib/session-proof-access";
import { isProofWorkspaceId } from "@/lib/pow-api/billing-workspace";

export const runtime = "nodejs";

const FLOW_KINDS = new Set<string>(["verify"]);

function parsePow(raw: unknown): FlowPowRow[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((row): row is FlowPowRow => !!row && typeof row === "object");
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const access = await requireSessionProofAccess(sessionProofAccessFromBody(body));
    if (access instanceof NextResponse) return access;

    const requestedKind = FLOW_KINDS.has(String(body.flowKind || ""))
      ? String(body.flowKind)
      : access.flowKind;
    const flowKind = requestedKind;
    if (!flowKind || !FLOW_KINDS.has(flowKind)) {
      return jsonError(400, "flowKind must be verify");
    }

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
    const linkLabel =
      (typeof body.linkLabel === "string" && body.linkLabel.trim()) ||
      access.linkLabel ||
      null;

    const stored = await persistCompletedFlowEmbedding({
      workspaceId: workspaceId || undefined,
      ownerUserId,
      flowKind,
      flowId,
      runId,
      identity,
      source,
      linkLabel,
      model: sessionBranchModelFromUnknown(body.model),
      sequence,
      pow: parsePow(body.pow),
      raw: body.raw,
    });

    const { maybePostLtiUnsysGrades } = await import("@/lib/lti/maybe-post-grades");
    await maybePostLtiUnsysGrades({ stored });

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
