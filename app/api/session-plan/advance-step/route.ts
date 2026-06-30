import { NextRequest, NextResponse } from "next/server";
import { getSessionPlan, updateSessionPlan, validatePlanSteps, logToolUsage, getRecentTranscripts, type SessionPlanStep } from "@/lib/storage";
import { createClient } from "@/lib/supabase/server";
import { updateSessionPlanLLM } from "@/lib/xai";
import { getUserPrompts } from "@/lib/user-prompts";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      sessionId,
      forceAdvance,
      markAsSkipped,
      targetStepIndex,
      evalSinceMs,
      previousProbes,
      focusedProbes,
      openProbeCount,
    } = body;

    if (!sessionId) {
      return NextResponse.json(
        { error: "Missing sessionId" },
        { status: 400 }
      );
    }

    // Auth check
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    // Load current plan
    const currentPlan = await getSessionPlan(sessionId, supabase);

    if (!currentPlan) {
      return NextResponse.json(
        { error: "No plan found for this session" },
        { status: 404 }
      );
    }

    const { steps } = currentPlan;
    const currentStepIndex = typeof targetStepIndex === "number" ? targetStepIndex : currentPlan.currentStepIndex;

    if (!steps || steps.length === 0) {
      return NextResponse.json(
        { error: "Plan has no steps" },
        { status: 400 }
      );
    }

    if (currentStepIndex < 0 || currentStepIndex >= steps.length) {
      return NextResponse.json({ error: "targetStepIndex out of bounds" }, { status: 400 });
    }

    // Discriminator for the bookkeeping log below so later analytics can
    // cleanly separate student-initiated advances from LLM-auto-advances
    // (both currently land in session_tool with tool_action='advance').
    //   - "user_click": client sent forceAdvance (Complete button, or
    //     dialog override after a disagreement).
    //   - "auto_eval_pass": the route's own LLM readiness eval ran and
    //     said the student was ready.
    //   - "auto_eval_skipped": eval couldn't run (no transcripts, or the
    //     LLM errored) — we fell through to a mechanical advance.
    let trigger: "user_click" | "auto_eval_pass" | "auto_eval_skipped" = "user_click";
    let evalGapScore: number | undefined;
    let evalAdvanceReasoning = "";

    const skipEvaluation = Boolean(markAsSkipped) || Boolean(forceAdvance);

    // Unless forceAdvance / markAsSkipped, evaluate whether the student is ready to move on
    if (!skipEvaluation) {
      trigger = "auto_eval_skipped";
      try {
        const [allTranscripts, promptOverrides] = await Promise.all([
          getRecentTranscripts(sessionId, 180000),
          getUserPrompts(supabase, user.id),
        ]);

        const focusCutoff = typeof evalSinceMs === "number" && evalSinceMs > 0 ? evalSinceMs : 0;
        const transcripts = focusCutoff > 0
          ? allTranscripts.filter(t => t.timestamp >= focusCutoff)
          : allTranscripts;

        if (transcripts.length === 0) {
          return NextResponse.json({
            plan: currentPlan,
            allComplete: false,
            blocked: true,
            advanceVerdict: "unavailable",
            advanceReasoning: "I couldn't evaluate this chapter yet because I don't have enough recent session evidence. Keep thinking aloud for a moment, then try marking the chapter done again.",
            gapScore: 0.6,
          });
        }

        if (transcripts.length > 0) {
          const fileIds = transcripts
            .slice(-10)
            .map(t => t.xaiFileId)
            .filter((id): id is string => !!id && id !== "_empty");

          const evalResult = await updateSessionPlanLLM({
            goal: currentPlan.goal,
            strategy: currentPlan.strategy,
            steps: currentPlan.steps,
            currentStepIndex,
            previousProbes: previousProbes || [],
            focusedProbes: focusedProbes || [],
            openProbeCount: openProbeCount ?? 0,
            lastProbeTimestamp: 0,
            promptOverrides,
            sessionFileIds: fileIds,
          });

          if (evalResult.success && evalResult.result && !evalResult.result.canAutoAdvance) {
            return NextResponse.json({
              plan: currentPlan,
              allComplete: false,
              blocked: true,
              advanceVerdict: "not_ready",
              advanceReasoning: evalResult.result.advanceReasoning || "The current step doesn't appear to be fully complete yet.",
              gapScore: evalResult.result.gapScore,
              nextRequest: evalResult.result.nextRequest,
            });
          }

          if (evalResult.success && evalResult.result) {
            trigger = "auto_eval_pass";
            evalGapScore = evalResult.result.gapScore;
            evalAdvanceReasoning = evalResult.result.advanceReasoning || "I see enough evidence to mark this chapter done.";
          } else {
            return NextResponse.json({
              plan: currentPlan,
              allComplete: false,
              blocked: true,
              advanceVerdict: "unavailable",
              advanceReasoning: "I couldn't complete the readiness check, so I did not mark this chapter done. Try again in a moment.",
              gapScore: 0.6,
            });
          }
        }
      } catch (err) {
        console.warn("[advance-step] Evaluation failed, blocking advance:", err);
        return NextResponse.json({
          plan: currentPlan,
          allComplete: false,
          blocked: true,
          advanceVerdict: "unavailable",
          advanceReasoning: "I couldn't complete the readiness check, so I did not mark this chapter done. Try again in a moment.",
          gapScore: 0.6,
        });
      }
    }

    // Mark the target step completed or skipped. Chapters are independent;
    // finishing one chapter must not mechanically complete or advance others.
    const terminalStatus = markAsSkipped ? "skipped" as const : "completed" as const;
    const updatedSteps: SessionPlanStep[] = steps.map((step, idx) => {
      if (idx === currentStepIndex) {
        return { ...step, status: terminalStatus };
      }
      return step;
    });

    const allComplete = updatedSteps.every(step => step.status === "completed" || step.status === "skipped");
    const nextIndex = currentStepIndex;

    // Validate and persist
    validatePlanSteps(updatedSteps);

    const updatedPlan = await updateSessionPlan(currentPlan.id, {
      steps: updatedSteps,
      currentStepIndex: nextIndex,
    }, supabase);

    const timestamp = Date.now();
    await logToolUsage(
      sessionId,
      "session_plan",
      "advance",
      timestamp,
      {
        source: "server",
        trigger,
        forceAdvance: Boolean(forceAdvance),
        markAsSkipped: Boolean(markAsSkipped),
        evalGapScore,
        previousStepIndex: currentStepIndex,
        newStepIndex: nextIndex,
        stepContent: {
          completedStep: steps[currentStepIndex] ? {
            id: steps[currentStepIndex].id,
            description: steps[currentStepIndex].description,
            type: steps[currentStepIndex].type,
            status: terminalStatus,
            order: steps[currentStepIndex].order,
          } : null,
          nextStep: nextIndex < updatedSteps.length ? {
            id: updatedSteps[nextIndex].id,
            description: updatedSteps[nextIndex].description,
            type: updatedSteps[nextIndex].type,
            status: updatedSteps[nextIndex].status,
            order: updatedSteps[nextIndex].order,
          } : null,
        },
      }
    );

    return NextResponse.json({
      plan: updatedPlan,
      allComplete,
      advanceVerdict: markAsSkipped
        ? "skipped"
        : forceAdvance
          ? "forced"
          : trigger === "auto_eval_pass"
            ? "agreed"
            : "advanced",
      advanceReasoning: evalAdvanceReasoning,
      gapScore: evalGapScore,
    });
  } catch (error) {
    console.error("Advance step error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
