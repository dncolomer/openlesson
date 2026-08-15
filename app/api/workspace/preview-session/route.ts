import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-error-envelope";
import { ayclTokenFromBody, guardWorkspaceRoute, requireAuthenticatedUser } from "@/lib/api/require-auth";
import { createSessionPlanLLM } from "@/lib/xai";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuthenticatedUser();
    if (!auth.ok) return auth.response;
    const { user, supabase } = auth;

    const { blockTitle, nodeDescription, planTopic, planningPrompt } = await req.json();

    if (!blockTitle) {
      return jsonError(400, "blockTitle is required");
    }

    // Generate a session plan without persisting it
    const problem = nodeDescription
      ? `${blockTitle}: ${nodeDescription}`
      : blockTitle;

    const result = await createSessionPlanLLM({
      problem,
      objectives: [`Learn about ${blockTitle} as part of the ${planTopic || "learning"} plan`],
      planningPrompt: planningPrompt || undefined,
    });

    if (!result.success || !result.plan) {
      return jsonError(500, result.error || "Failed to generate session preview");
    }

    return NextResponse.json({
      goal: result.plan.goal,
      strategy: result.plan.strategy,
      description: result.plan.description,
      steps: result.plan.steps,
    });
  } catch (error) {
    console.error("[Preview Session] Error:", error);
    return jsonError(500, error instanceof Error ? error.message : "Failed to generate preview");
  }
}
