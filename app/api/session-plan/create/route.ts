import { NextRequest, NextResponse } from "next/server";
import { createSessionPlanLLM } from "@/lib/xai";
import { createSessionPlan, getUserCalibration, getSessionPlan } from "@/lib/storage";
import { getUserPrompts } from "@/lib/user-prompts";
import { ayclTokenFromBody,
  ileTokenFromBody, guardSessionRoute } from "@/lib/api/require-auth";
import { getLanguageName } from "@/lib/tutoring-languages";
import { resolveInitialChaptersFromBody } from "@/lib/initial-chapters";
import { toPersistedCreatePlanSteps } from "@/lib/session-plan-create";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      sessionId,
      problem,
      objectives,
      force,
      planningPrompt,
      tutoringLanguage: bodyLanguage,
    } = body;
    const initialChapters = resolveInitialChaptersFromBody(body);

    if (!sessionId || !problem) {
      return NextResponse.json(
        { error: "Missing sessionId or problem" },
        { status: 400 }
      );
    }

    const auth = await guardSessionRoute(sessionId, { ayclToken: ayclTokenFromBody(body), ileToken: ileTokenFromBody(body) });
    if (!auth.ok) return auth.response;

    const { user, supabase } = auth;

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

    // Look up any existing plan up front. When force-replacing, generate the
    // new plan first and only delete the old row after generation succeeds —
    // otherwise a failed regenerate permanently wipes chapters.
    const existingPlan = await getSessionPlan(sessionId, supabase);
    if (existingPlan && !force) {
      return NextResponse.json({ plan: existingPlan });
    }

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

    const promptOverrides = await getUserPrompts();

    const result = await createSessionPlanLLM({
      problem,
      objectives,
      calibration: calibrationText,
      promptOverrides,
      planningPrompt,
      tutoringLanguage: languageName,
      initialChapters,
    });

    if (!result.success || !result.plan) {
      return NextResponse.json(
        { error: result.error || "Plan generation failed" },
        { status: 500 }
      );
    }

    const validSteps = (result.plan.steps || []).filter(
      (step) => step.description && step.description.trim().length > 0
    );
    if (validSteps.length === 0) {
      console.error("[Plan Create] LLM returned no valid steps:", result.plan.steps);
      return NextResponse.json(
        { error: "Plan generation produced no valid steps" },
        { status: 500 }
      );
    }
    result.plan.steps = validSteps;

    if (existingPlan && force) {
      const { error: deleteError } = await supabase
        .from("session_plans")
        .delete()
        .eq("id", existingPlan.id);
      if (deleteError) {
        console.error("[session-plan/create] Failed to delete existing plan:", deleteError);
        return NextResponse.json({ error: `Could not replace existing plan: ${deleteError.message}` }, { status: 500 });
      }
    }

    const savedPlan = await createSessionPlan(sessionId, {
      goal: result.plan.goal,
      strategy: result.plan.strategy,
      description: result.plan.description,
      steps: toPersistedCreatePlanSteps(result.plan.steps),
    }, supabase, { userId: user.id });

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