import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-error-envelope";
import { createSessionPlanLLM } from "@/lib/xai";
import { createSessionPlan, getUserCalibration, getSessionPlan } from "@/lib/storage";
import { getUserPrompts } from "@/lib/user-prompts";
import { ayclTokenFromBody,
  ileTokenFromBody, guardSessionRoute } from "@/lib/api/require-auth";
import { getLanguageName } from "@/lib/tutoring-languages";
import { resolveInitialChaptersFromBody } from "@/lib/initial-chapters";
import { toPersistedCreatePlanSteps } from "@/lib/session-plan-create";
import {
  resolveIleSessionModeFromBody,
  resolveIleSessionModeFromSession,
} from "@/lib/ile-mode";

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
      return jsonError(400, "Missing sessionId or problem");
    }

    const auth = await guardSessionRoute(sessionId, { ayclToken: ayclTokenFromBody(body), ileToken: ileTokenFromBody(body) });
    if (!auth.ok) return auth.response;

    const { subjectId, supabase } = auth;

    const { data: sessionData, error: sessionError } = await supabase
      .from("sessions")
      .select("metadata")
      .eq("id", sessionId)
      .single();
    if (sessionError) {
      console.error("[session-plan/create] Failed to load session metadata:", sessionError);
      return jsonError(500, `Could not load session metadata: ${sessionError.message}`);
    }

    let tutoringLanguage = bodyLanguage;
    if (!tutoringLanguage && sessionData?.metadata?.tutoringLanguage) {
      tutoringLanguage = sessionData.metadata.tutoringLanguage;
    }

    const bodyHasMode =
      body &&
      typeof body === "object" &&
      ("session_mode" in body ||
        "sessionMode" in body ||
        "ile_mode" in body ||
        "ileMode" in body ||
        "project_mode" in body ||
        "projectMode" in body ||
        "project" in body ||
        "is_project" in body ||
        "isProject" in body);
    const sessionMode = bodyHasMode
      ? resolveIleSessionModeFromBody(body)
      : resolveIleSessionModeFromSession({
          metadata: (sessionData?.metadata as Record<string, unknown> | undefined) ?? null,
        });
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
      const calibration = await getUserCalibration(subjectId, supabase);
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
      sessionMode,
    });

    if (!result.success || !result.plan) {
      return jsonError(500, result.error || "Plan generation failed");
    }

    const validSteps = (result.plan.steps || []).filter(
      (step) => step.description && step.description.trim().length > 0
    );
    if (validSteps.length === 0) {
      console.error("[Plan Create] LLM returned no valid steps:", result.plan.steps);
      return jsonError(500, "Plan generation produced no valid steps");
    }
    result.plan.steps = validSteps;

    // Re-check after LLM: another request may have inserted while we generated.
    const planAfterGenerate = await getSessionPlan(sessionId, supabase);
    if (planAfterGenerate && !force) {
      return NextResponse.json({ plan: planAfterGenerate });
    }

    if (force || planAfterGenerate || existingPlan) {
      // Delete by session_id (not only plan id) so concurrent shells and empty
      // rows cannot leave a unique-constraint collision on insert.
      const { error: deleteError } = await supabase
        .from("session_plans")
        .delete()
        .eq("session_id", sessionId);
      if (deleteError) {
        console.error("[session-plan/create] Failed to delete existing plan:", deleteError);
        return jsonError(500, `Could not replace existing plan: ${deleteError.message}`);
      }
    }

    const savedPlan = await createSessionPlan(
      sessionId,
      {
        goal: result.plan.goal,
        strategy: result.plan.strategy,
        description: result.plan.description,
        steps: toPersistedCreatePlanSteps(result.plan.steps),
        unusable_cells: result.plan.unusable_cells ?? [],
      },
      supabase,
      { userId: subjectId },
    );

    return NextResponse.json({ plan: savedPlan });
  } catch (error) {
    console.error("Create session plan error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return jsonError(500, `Internal server error: ${errorMessage}`);
  }
}