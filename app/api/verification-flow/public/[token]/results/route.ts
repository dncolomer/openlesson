/**
 * Store runner or skill proof of work on the verification flow that owns this public token.
 */
import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-error-envelope";
import { verificationProofEmbedding } from "@/lib/verification-flow";
import { addPublicFlowResult } from "@/lib/verification-flow-repository";

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
  const saved = await addPublicFlowResult({
    token,
    identity: String(body.identity || ""),
    source,
    prompt,
    questionId: typeof body.questionId === "string" ? body.questionId : null,
    embedding: verificationProofEmbedding({
      prompt,
      source,
      workspaceId: token,
    }),
  });
  if (!saved.ok) {
    const status = saved.reason === "not_found" ? 404 : 400;
    return jsonError(status, saved.reason);
  }
  return NextResponse.json({ result: saved.result });
}
