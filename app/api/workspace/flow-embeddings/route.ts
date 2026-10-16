/**
 * Persist a completed Calibrate, Learn, or Verify embedding (vector + recoverable raw).
 * Cookie / TAP Learning / TAP guest access. Not an LWM snapshot.
 */
import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-error-envelope";
import { persistCompletedFlowEmbedding } from "@/lib/flow-embedding-store";
import { entryQueryParamsFromBody } from "@/lib/guest-link-access";
import { parseLearningModelSize } from "@/lib/learning-model";
import { ileTokenFromPowBody, requireSessionWorkspaceProofOfWorkAccess } from "@/lib/pow-api/workspace-session-access";
import { sessionBranchModelFromUnknown } from "@/lib/session-branch-model";
import { resolveTapSessionAccess } from "@/lib/tap-score-session-auth";
import type { FlowKind, FlowPowRow } from "@/lib/flow-embedding";

export const runtime = "nodejs";

const FLOW_KINDS = new Set<FlowKind>(["calibrate", "learn", "verify"]);

function parsePow(raw: unknown): FlowPowRow[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((row): row is FlowPowRow => !!row && typeof row === "object");
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const workspaceId = typeof body.workspaceId === "string" ? body.workspaceId.trim() : "";
    if (!workspaceId) return jsonError(400, "workspaceId is required");
    const flowKind = FLOW_KINDS.has(body.flowKind as FlowKind) ? (body.flowKind as FlowKind) : null;
    if (!flowKind) return jsonError(400, "flowKind must be calibrate, learn, or verify");

    const privateToken = typeof body.privateToken === "string" ? body.privateToken.trim() : "";
    const tapSessionId = typeof body.tapSessionId === "string" ? body.tapSessionId.trim() : "";
    if (privateToken || tapSessionId) {
      const access = await resolveTapSessionAccess({
        privateToken: privateToken || undefined,
        workspaceId,
        tapSessionId: tapSessionId || undefined,
        entryQueryParams: entryQueryParamsFromBody(body),
      });
      if ("error" in access) return jsonError(access.status, access.error);
    } else {
      const sessionId =
        typeof body.sessionId === "string"
          ? body.sessionId
          : typeof body.session_id === "string"
            ? body.session_id
            : null;
      const access = await requireSessionWorkspaceProofOfWorkAccess(workspaceId, sessionId, {
        ileToken: ileTokenFromPowBody(body),
        entryQueryParams: entryQueryParamsFromBody(body),
      });
      if (access instanceof NextResponse) return access;
    }

    const sequence = Array.isArray(body.sequence)
      ? body.sequence.filter((id): id is string => typeof id === "string")
      : null;
    const stored = await persistCompletedFlowEmbedding({
      workspaceId,
      flowKind,
      flowId: typeof body.flowId === "string" ? body.flowId : null,
      runId: typeof body.runId === "string" ? body.runId : null,
      identity: typeof body.identity === "string" ? body.identity : null,
      source: typeof body.source === "string" ? body.source : flowKind,
      model: sessionBranchModelFromUnknown(body.model),
      catalogSize: parseLearningModelSize(body.catalogSize),
      sequence: flowKind === "calibrate" ? null : sequence,
      pow: parsePow(body.pow),
      raw: body.raw,
    });
    return NextResponse.json({
      id: stored.id,
      embedding_model_id: stored.embedding_model_id,
      dim: stored.dim,
      vector: stored.vector,
      raw: stored.raw,
      flow_kind: stored.flow_kind,
    });
  } catch (error) {
    return jsonError(500, error instanceof Error ? error.message : "Could not store flow embedding");
  }
}
