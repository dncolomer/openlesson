/**
 * Store runner or skill proof of work on the verification flow that owns this public token.
 * Persists a recoverable flow embedding (gen model + projected policy + PoW). Not a snapshot.
 */
import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-error-envelope";
import { completeFlowEmbedding } from "@/lib/flow-embedding";
import { persistCompletedFlowEmbedding } from "@/lib/flow-embedding-store";
import { addPublicFlowResult, getVerificationFlowByToken } from "@/lib/verification-flow-repository";
import { policyScoreFromUnknown } from "@/lib/session-policy-score";

export const runtime = "nodejs";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ token: string }> },
) {
  const { token } = await context.params;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const source = body.source === "skill" ? "skill" : body.source === "runner" ? "runner" : null;
  if (!source) return jsonError(400, "source must be runner or skill");
  const prompt = String(body.prompt || "");
  const policy = policyScoreFromUnknown(body.policy);
  const flow = await getVerificationFlowByToken(token);
  const embedding = completeFlowEmbedding({
    flowKind: "verify",
    model: policy?.model ?? null,
    sequence: policy?.sequence ?? null,
    pow: [
      {
        type: source === "runner" ? "speech" : "tool",
        tool_name: source,
        timestamp_ms: 1,
        payload: prompt,
      },
      ...(policy?.sequence ?? []).map((action, index) => ({
        type: "tool" as const,
        tool_name: "session_policy",
        tool_action: action,
        timestamp_ms: index + 2,
      })),
    ],
  });
  const saved = await addPublicFlowResult({
    token,
    identity: String(body.identity || ""),
    source,
    prompt,
    questionId: typeof body.questionId === "string" ? body.questionId : null,
    embedding: embedding.vector,
  });
  if (!saved.ok) {
    const status = saved.reason === "not_found" ? 404 : 400;
    return jsonError(status, saved.reason);
  }
  if (saved.result) {
    await persistCompletedFlowEmbedding({
      workspaceId: saved.result.workspaceId,
      ownerUserId: flow?.ownerUserId,
      flowKind: "verify",
      flowId: saved.result.flowId,
      runId: saved.result.id,
      identity: saved.result.identity,
      source,
      raw: embedding.raw,
    });
  }
  return NextResponse.json({
    result: saved.result,
    embedding_model_id: embedding.embedding_model_id,
    raw: embedding.raw,
  });
}
