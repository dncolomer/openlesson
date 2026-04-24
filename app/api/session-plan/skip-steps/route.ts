import { NextRequest, NextResponse } from "next/server";
import { getSessionPlan, updateSessionPlan, validatePlanSteps, logToolUsage, type SessionPlanStep } from "@/lib/storage";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 10;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId, skipToIndex } = body;

    if (!sessionId || skipToIndex === undefined || skipToIndex === null) {
      return NextResponse.json(
        { error: "Missing sessionId or skipToIndex" },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const currentPlan = await getSessionPlan(sessionId, supabase);

    if (!currentPlan) {
      return NextResponse.json(
        { error: "No plan found for this session" },
        { status: 404 }
      );
    }

    const { steps, currentStepIndex } = currentPlan;

    if (!steps || steps.length === 0) {
      return NextResponse.json(
        { error: "Plan has no steps" },
        { status: 400 }
      );
    }

    if (skipToIndex <= currentStepIndex || skipToIndex >= steps.length) {
      return NextResponse.json(
        { error: "skipToIndex must be after current step and within bounds" },
        { status: 400 }
      );
    }

    // Mark everything from current through skipToIndex-1 as skipped,
    // and set the target step to in_progress
    const updatedSteps: SessionPlanStep[] = steps.map((step, idx) => {
      if (idx >= currentStepIndex && idx < skipToIndex) {
        return { ...step, status: "skipped" as const };
      }
      if (idx === skipToIndex) {
        return { ...step, status: "in_progress" as const };
      }
      return step;
    });

    validatePlanSteps(updatedSteps);

    const updatedPlan = await updateSessionPlan(currentPlan.id, {
      steps: updatedSteps,
      currentStepIndex: skipToIndex,
    }, supabase);

    const skippedSteps = steps
      .slice(currentStepIndex, skipToIndex)
      .map(s => ({ id: s.id, description: s.description, type: s.type }));

    await logToolUsage(
      sessionId,
      "session_plan",
      "skip",
      Date.now(),
      {
        fromStepIndex: currentStepIndex,
        toStepIndex: skipToIndex,
        skippedCount: skipToIndex - currentStepIndex,
        skippedSteps,
        targetStep: {
          id: steps[skipToIndex].id,
          description: steps[skipToIndex].description,
          type: steps[skipToIndex].type,
        },
      }
    );

    return NextResponse.json({ plan: updatedPlan });
  } catch (error) {
    console.error("Skip steps error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
