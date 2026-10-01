/**
 * Public verification-flow entry: identity claim and the single pooled question.
 * Does not list the question pool and does not mint a knowledge link.
 */
import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-error-envelope";
import {
  verificationQuestionStartingPrompt,
} from "@/lib/verification-flow";
import {
  claimPublicIdentity,
  getVerificationFlowByToken,
} from "@/lib/verification-flow-repository";

export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ token: string }> },
) {
  const { token } = await context.params;
  const flow = await getVerificationFlowByToken(token);
  if (!flow) return jsonError(404, "Verification flow not found");
  return NextResponse.json({
    topic: flow.topic,
    questionCount: flow.questions.length,
    flowId: flow.id,
  });
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ token: string }> },
) {
  const { token } = await context.params;
  const body = (await req.json().catch(() => ({}))) as { identity?: string };
  const claimed = await claimPublicIdentity(token, String(body.identity || ""));
  if (!claimed.ok) {
    const status = claimed.reason === "not_found" ? 404 : 400;
    return jsonError(status, claimed.reason);
  }
  const question = claimed.choices.question;
  return NextResponse.json({
    identity: claimed.identity,
    emptyPool: claimed.choices.emptyPool,
    practice: claimed.choices.practice,
    question: question
      ? {
          id: question.id,
          title: question.text,
          openingQuestion: verificationQuestionStartingPrompt(question),
        }
      : null,
    topics: claimed.choices.topics,
  });
}
