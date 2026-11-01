/**
 * Persist a completed Solve-flow embedding for the claimed public session.
 */
import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-error-envelope";
import { persistSolveCompletedEmbedding } from "@/lib/solve-flow-embedding";
import { resolveSolveSessionAccess } from "@/lib/solve-session-auth";
import { sessionBranchModelFromUnknown } from "@/lib/session-branch-model";
import type { FlowPowRow } from "@/lib/flow-embedding";

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
  const stored = await persistSolveCompletedEmbedding({
    ownerUserId: access.ownerUserId,
    flowId: access.flow.id,
    runId: sessionId,
    identity: String(body.identity || access.identity || "").trim() || access.identity,
    model: sessionBranchModelFromUnknown(body.model),
    sequence,
    pow: parsePow(body.pow),
  });
  return NextResponse.json({
    id: stored.id,
    flow_kind: stored.flow_kind,
    flow_id: stored.flow_id,
    run_id: stored.run_id,
    identity: stored.identity,
  });
}
