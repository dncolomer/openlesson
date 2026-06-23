import { NextRequest, NextResponse } from "next/server";
import { getSessionPlan, logToolUsage } from "@/lib/storage";
import { generateProbe } from "@/lib/xai";
import { getUserPrompts } from "@/lib/user-prompts";
import { createClient } from "@/lib/supabase/server";
import { getLanguageName } from "@/lib/tutoring-languages";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId } = body;

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

    // Bulk archive all non-archived probes
    const { data: archivedRows, error: archiveError } = await supabase
      .from("probes")
      .update({ archived: true })
      .eq("session_id", sessionId)
      .eq("archived", false)
      .select("id");

    if (archiveError) {
      console.error("Failed to archive probes:", archiveError);
      return NextResponse.json(
        { error: "Failed to archive probes" },
        { status: 500 }
      );
    }

    const archivedCount = archivedRows?.length ?? 0;

    // Load session + plan for probe generation context
    const [sessionResult, currentPlan] = await Promise.all([
      supabase
        .from("sessions")
        .select("problem, metadata")
        .eq("id", sessionId)
        .single(),
      getSessionPlan(sessionId, supabase),
    ]);

    const sessionData = sessionResult.data;
    if (!sessionData?.problem) {
      return NextResponse.json(
        { error: "Block has no problem text" },
        { status: 400 }
      );
    }

    // Get tutoring language
    const tutoringLanguage = sessionData.metadata?.tutoringLanguage;
    const languageName = tutoringLanguage ? getLanguageName(tutoringLanguage) : undefined;

    const promptOverrides = await getUserPrompts(supabase, user.id);

    // Build context for the current step
    let ragContext = "";
    if (currentPlan) {
      const currentStep = currentPlan.steps[currentPlan.currentStepIndex];
      const completedSteps = currentPlan.steps.filter(s => s.status === "completed" || s.status === "skipped");
      ragContext = `SESSION PLAN CONTEXT:
- Goal: ${currentPlan.goal}
- Current step (${currentPlan.currentStepIndex + 1}/${currentPlan.steps.length}): [${currentStep?.type || "question"}] ${currentStep?.description || "Continue guiding"}
- Progress: ${completedSteps.length}/${currentPlan.steps.length} steps completed
${completedSteps.length > 0 ? `- Completed steps: ${completedSteps.map((s, i) => `${i + 1}. ${s.description}`).join("; ")}` : ""}

IMPORTANT: Your question MUST be specifically about the current step topic: "${currentStep?.description || "Continue guiding"}". This is a fresh start on this step — all previous probes have been cleared.`;
    }

    // Generate a fresh probe for the current step
    const probeResult = await generateProbe({
      problem: sessionData.problem,
      gapScore: 0.5,
      signals: ["fresh_start"],
      previousProbes: [], // clean slate
      ragContext,
      promptOverrides,
      tutoringLanguage: languageName,
    });

    let newProbe = null;
    let probeGenError: string | null = null;

    if (!probeResult.success || !probeResult.probe) {
      probeGenError = probeResult.error || "Probe generation returned empty result";
      console.error("[reset-probes] Probe generation failed:", {
        sessionId,
        error: probeGenError,
        hasPlan: !!currentPlan,
      });
    } else {
      const currentStep = currentPlan?.steps[currentPlan.currentStepIndex];
      const nowMs = Date.now();

      const { data: insertedProbe, error: probeError } = await supabase
        .from("probes")
        .insert({
          session_id: sessionId,
          text: probeResult.probe,
          request_type: currentStep?.type || "question",
          gap_score: 0.5,
          signals: ["fresh_start"],
          archived: false,
          focused: false,
          timestamp_ms: nowMs,
          plan_step_id: currentStep?.id || null,
        })
        .select()
        .single();

      if (probeError || !insertedProbe) {
        probeGenError = probeError?.message || "Failed to insert probe into database";
        console.error("[reset-probes] Probe insert failed:", {
          sessionId,
          error: probeError,
        });
      } else {
        newProbe = {
          id: insertedProbe.id,
          timestamp: insertedProbe.timestamp_ms,
          gapScore: insertedProbe.gap_score,
          signals: insertedProbe.signals,
          text: insertedProbe.text,
          requestType: insertedProbe.request_type,
          planStepId: insertedProbe.plan_step_id,
          archived: false,
          focused: false,
        };
      }
    }

    await logToolUsage(
      sessionId,
      "probe",
      "reset",
      Date.now(),
      {
        archivedCount,
        newProbeId: newProbe?.id || null,
        newProbeText: newProbe?.text || null,
        probeGenError,
      }
    );

    return NextResponse.json({
      archivedCount,
      newProbe,
      probeGenError,
    });
  } catch (error) {
    console.error("Reset probes error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
