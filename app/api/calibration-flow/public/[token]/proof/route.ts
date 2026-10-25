/**
 * Store sounding proof for a calibration run and persist a recoverable flow embedding.
 * Calibrate sounding omits projected policy. Not a verification result and not a snapshot.
 */
import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-error-envelope";
import { addCalibrationProof, getCalibrationFlowByToken } from "@/lib/calibration-flow-repository";
import { persistCompletedFlowEmbedding } from "@/lib/flow-embedding-store";
import { sessionBranchModelFromUnknown } from "@/lib/session-branch-model";

export const runtime = "nodejs";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ token: string }> },
) {
  const { token } = await context.params;
  const body = (await req.json().catch(() => ({}))) as {
    events?: unknown;
    identity?: string;
    model?: unknown;
    catalogSize?: unknown;
    metadata?: unknown;
  };
  const stored = await addCalibrationProof(token, body.events, String(body.identity || ""));
  if (!stored.ok) {
    const status = stored.reason === "not_found" ? 404 : 400;
    return jsonError(status, stored.reason);
  }
  const flow = await getCalibrationFlowByToken(token);
  const payload =
    body.metadata && typeof body.metadata === "object"
      ? JSON.stringify(body.metadata)
      : JSON.stringify(stored.proof?.events ?? []);
  if (stored.proof && flow) {
    await persistCompletedFlowEmbedding({
      workspaceId: stored.proof.workspaceId,
      ownerUserId: flow.ownerUserId,
      flowKind: "calibrate",
      flowId: stored.proof.flowId,
      runId: stored.proof.id,
      identity: stored.proof.identity,
      source: "sounding",
      model: sessionBranchModelFromUnknown(body.model),
      catalogSize: body.catalogSize ?? flow.actionCatalog,
      sequence: null,
      pow: [
        {
          type: "tool",
          tool_name: "probe",
          tool_action: "sounding",
          timestamp_ms: 1,
          payload,
          metadata:
            body.metadata && typeof body.metadata === "object" && !Array.isArray(body.metadata)
              ? (body.metadata as Record<string, unknown>)
              : null,
        },
      ],
    });
  }
  return NextResponse.json({
    ok: true,
    proofId: stored.proof?.id ?? null,
    verificationRun: false,
  });
}
