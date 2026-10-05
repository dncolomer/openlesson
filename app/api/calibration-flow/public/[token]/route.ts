/**
 * Public calibration-flow entry. Identity is claimed before the question pool
 * is returned. Starting this flow does not pick a verification question.
 */
import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-error-envelope";
import { beginCalibrationSession } from "@/lib/calibration-flow";
import {
  claimCalibrationIdentity,
  getCalibrationFlowByToken,
} from "@/lib/calibration-flow-repository";

export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ token: string }> },
) {
  const { token } = await context.params;
  const flow = await getCalibrationFlowByToken(token);
  if (!flow) return jsonError(404, "Calibration flow not found");
  return NextResponse.json({
    flowId: flow.id,
    goal: flow.goal,
    questionCount: flow.questions.length,
    verificationRun: false,
  });
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ token: string }> },
) {
  try {
    const { token } = await context.params;
    const body = (await req.json().catch(() => ({}))) as { identity?: string };
    const claimed = await claimCalibrationIdentity(token, String(body.identity || ""));
    if (!claimed.ok) {
      const status = claimed.reason === "not_found" ? 404 : 400;
      return jsonError(status, claimed.reason);
    }
    const started = beginCalibrationSession(claimed.flow);
    return NextResponse.json({
      identity: claimed.identity,
      kind: started.kind,
      verificationRun: started.verificationRun,
      requiresClassification: started.requiresClassification,
      flowId: claimed.flow.id,
      goal: claimed.flow.goal,
      questions: claimed.flow.questions,
    });
  } catch (error) {
    console.error("calibration claim failed", error instanceof Error ? error.stack : error);
    return jsonError(500, "Could not start");
  }
}
