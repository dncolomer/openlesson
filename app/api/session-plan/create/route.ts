import { NextRequest, NextResponse } from "next/server";
import { createSessionPlanLLM } from "@/lib/xai";
import { createSessionPlan, getUserCalibration, getSessionPlan } from "@/lib/storage";
import { getUserPrompts } from "@/lib/user-prompts";
import { createClient } from "@/lib/supabase/server";
import { getLanguageName } from "@/lib/tutoring-languages";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId, problem, objectives, force, planningPrompt, tutoringLanguage: bodyLanguage } = body;

    if (!sessionId || !problem) {
      return NextResponse.json(
        { error: "Missing sessionId or problem" },
        { status: 400 }
      );
    }

    // Get user for calibration data
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    // Get tutoring language from body or session metadata
    let tutoringLanguage = bodyLanguage;
    if (!tutoringLanguage) {
      const { data: sessionData, error: sessionError } = await supabase
        .from("sessions")
        .select("metadata")
        .eq("id", sessionId)
        .single();
      if (sessionError) {
        console.error("[session-plan/create] Failed to load session metadata:", sessionError);
        return NextResponse.json({ error: `Could not load session metadata: ${sessionError.message}` }, { status: 500 });
      }
      if (sessionData?.metadata?.tutoringLanguage) {
        tutoringLanguage = sessionData.metadata.tutoringLanguage;
      }
    }
    const languageName = tutoringLanguage ? getLanguageName(tutoringLanguage) : undefined;

    // If force=true, delete existing plan first
    if (force) {
      const existingPlan = await getSessionPlan(sessionId, supabase);
      if (existingPlan) {
        const { error: deleteError } = await supabase
          .from("session_plans")
          .delete()
          .eq("id", existingPlan.id);
        if (deleteError) {
          console.error("[session-plan/create] Failed to delete existing plan:", deleteError);
          return NextResponse.json({ error: `Could not replace existing plan: ${deleteError.message}` }, { status: 500 });
        }
      }
    }

    // Get user calibration data (learning history) for personalization
    let calibrationText = "";
    try {
      const calibration = await getUserCalibration(user.id, supabase);
      if (calibration.sessionCount > 0) {
        calibrationText = `Student has completed ${calibration.sessionCount} sessions. ` +
          `Average gap score: ${calibration.avgGapScore}. ` +
          `Trend: ${calibration.trend}. ` +
          `Common gaps: ${calibration.commonGaps.join(", ") || "none identified"}.`;
      }
    } catch (err) {
      console.warn("Could not fetch calibration:", err);
    }

    // Get user prompt overrides
    const promptOverrides = await getUserPrompts();

    // Generate the session plan using LLM
    const result = await createSessionPlanLLM({
      problem,
      objectives,
      calibration: calibrationText,
      promptOverrides,
      planningPrompt, // Pass custom planning prompt if provided
      tutoringLanguage: languageName,
    });

    if (!result.success || !result.plan) {
      return NextResponse.json(
        { error: result.error || "Plan generation failed" },
        { status: 500 }
      );
    }

    // Validate that the LLM produced usable steps before persisting
    const validSteps = (result.plan.steps || []).filter(
      (step) => step.description && step.description.trim().length > 0
    );
    if (validSteps.length === 0) {
      console.error('[Plan Create] LLM returned no valid steps:', result.plan.steps);
      return NextResponse.json(
        { error: "Plan generation produced no valid steps" },
        { status: 500 }
      );
    }
    // Use only validated steps
    result.plan.steps = validSteps;

    // Save the plan to the database (including description from LLM)
    const savedPlan = await createSessionPlan(sessionId, {
      goal: result.plan.goal,
      strategy: result.plan.strategy,
      description: result.plan.description,
      steps: result.plan.steps.map((step, idx) => ({
        id: step.id || `step_${idx + 1}_${Date.now()}`,
        description: step.description,
        status: idx === 0 ? "in_progress" : "pending",
        type: step.type,
        order: step.order,
      })),
    }, supabase);

    return NextResponse.json({ plan: savedPlan });
  } catch (error) {
    console.error("Create session plan error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: `Internal server error: ${errorMessage}` },
      { status: 500 }
    );
  }
}
