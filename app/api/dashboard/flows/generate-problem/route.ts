/**
 * Generate a flow Problem from attached artifacts during slow create/edit.
 * Dashboard wizard has no workspace yet; owner auth is enough.
 */
import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-error-envelope";
import { requireAuthenticatedUser } from "@/lib/api/require-auth";
import {
  DASHBOARD_FLOWS_GENERATE_PROBLEM_PATH,
  generateFlowProblemFromArtifacts,
} from "@/lib/flow-problem-generate";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const auth = await requireAuthenticatedUser();
  if (!auth.ok) return auth.response;
  try {
    const body = (await req.json()) as Record<string, unknown>;
    const result = await generateFlowProblemFromArtifacts(body);
    if (!result.ok) {
      const status = result.error === "Attach at least one artifact." ? 400 : 502;
      return jsonError(status, result.error);
    }
    return NextResponse.json({
      path: DASHBOARD_FLOWS_GENERATE_PROBLEM_PATH,
      problem: result.problem,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "The problem could not be generated.";
    return jsonError(500, message);
  }
}
