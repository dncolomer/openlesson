import { NextRequest, NextResponse } from "next/server";
import { createSessionPlanLLM } from "@/lib/xai";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { blockTitle, nodeDescription, planTopic, planningPrompt } = await req.json();

    if (!blockTitle) {
      return NextResponse.json({ error: "blockTitle is required" }, { status: 400 });
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
      return NextResponse.json(
        { error: result.error || "Failed to generate session preview" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      goal: result.plan.goal,
      strategy: result.plan.strategy,
      description: result.plan.description,
      steps: result.plan.steps,
    });
  } catch (error) {
    console.error("[Preview Session] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate preview" },
      { status: 500 }
    );
  }
}
