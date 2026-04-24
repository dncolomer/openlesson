import { NextRequest, NextResponse } from "next/server";
import { createSessionPlanLLM } from "@/lib/xai";
import { getSessionPlan, updateSessionPlan, validatePlanSteps, logToolUsage, getUserCalibration, type SessionPlanStep } from "@/lib/storage";
import { getUserPrompts } from "@/lib/user-prompts";
import { createClient } from "@/lib/supabase/server";
import { getLanguageName } from "@/lib/tutoring-languages";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId, reason } = body;

    if (!sessionId) {
      return NextResponse.json(
        { error: "Missing sessionId" },
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

    // Get the session problem text
    const { data: sessionData } = await supabase
      .from("sessions")
      .select("problem, metadata")
      .eq("id", sessionId)
      .single();

    if (!sessionData?.problem) {
      return NextResponse.json(
        { error: "Session has no problem text" },
        { status: 400 }
      );
    }

    // Separate completed/skipped steps (preserve) from remaining (regenerate)
    const preservedSteps: SessionPlanStep[] = [];
    for (let i = 0; i < currentPlan.currentStepIndex; i++) {
      preservedSteps.push(currentPlan.steps[i]);
    }

    // Build calibration context that includes what was already covered
    const coveredTopics = preservedSteps
      .map((s, i) => `${i + 1}. [${s.status}] ${s.description}`)
      .join("\n");

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

    const contextCalibration = [
      calibrationText,
      preservedSteps.length > 0
        ? `\nThe student has already covered these steps (DO NOT repeat them, generate only NEW remaining steps that build on this progress):\n${coveredTopics}`
        : "",
      reason ? `\nThe student requested plan regeneration with this context: "${reason}"` : "",
      `\nOriginal plan goal: ${currentPlan.goal}`,
      `\nOriginal plan strategy: ${currentPlan.strategy}`,
    ].filter(Boolean).join("\n");

    // Get tutoring language
    const tutoringLanguage = sessionData.metadata?.tutoringLanguage;
    const languageName = tutoringLanguage ? getLanguageName(tutoringLanguage) : undefined;

    const promptOverrides = await getUserPrompts(supabase, user.id);

    // Generate new steps via LLM
    const result = await createSessionPlanLLM({
      problem: sessionData.problem,
      calibration: contextCalibration,
      promptOverrides,
      tutoringLanguage: languageName,
    });

    if (!result.success || !result.plan) {
      return NextResponse.json(
        { error: result.error || "Plan regeneration failed" },
        { status: 500 }
      );
    }

    // Filter out empty steps from LLM response
    const newSteps = (result.plan.steps || []).filter(
      (step) => step.description && step.description.trim().length > 0
    );

    if (newSteps.length === 0) {
      return NextResponse.json(
        { error: "Regeneration produced no valid steps" },
        { status: 500 }
      );
    }

    // Merge: preserved steps + new LLM-generated steps
    const newStepIndex = preservedSteps.length;
    const mergedSteps: SessionPlanStep[] = [
      ...preservedSteps,
      ...newSteps.map((step, idx) => ({
        id: step.id || `step_${newStepIndex + idx + 1}_${Date.now()}`,
        description: step.description,
        type: step.type,
        order: newStepIndex + idx + 1,
        status: (idx === 0 ? "in_progress" : "pending") as SessionPlanStep["status"],
      })),
    ];

    validatePlanSteps(mergedSteps);

    const updatedPlan = await updateSessionPlan(currentPlan.id, {
      steps: mergedSteps,
      currentStepIndex: newStepIndex,
    }, supabase);

    const oldRemainingCount = currentPlan.steps.length - currentPlan.currentStepIndex;

    await logToolUsage(
      sessionId,
      "session_plan",
      "regenerate",
      Date.now(),
      {
        preservedStepCount: preservedSteps.length,
        oldRemainingCount,
        newStepCount: newSteps.length,
        reason: reason || null,
        newGoal: result.plan.goal,
        newStrategy: result.plan.strategy,
      }
    );

    return NextResponse.json({ plan: updatedPlan });
  } catch (error) {
    console.error("Regenerate plan error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
