import { NextRequest, NextResponse } from "next/server";
import { updateSessionPlanLLM } from "@/lib/xai";
import { getSessionPlan, updateSessionPlan, validatePlanSteps, type SessionPlanStep, getRecentTranscripts, getRecentToolEvents, getRecentFacialData, getRecentEEGData, getRecentScreenshots, isUuid } from "@/lib/storage";
import { getUserPrompts } from "@/lib/user-prompts";
import { createClient } from "@/lib/supabase/server";
import { storeAnalysisResult } from "@/lib/session-analysis";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      sessionId, 
      previousProbes,
      activeProbes,
      focusedProbes,
      openProbeCount,
      lastProbeTimestamp,
    } = body;

    if (!sessionId) {
      return NextResponse.json(
        { error: "Missing sessionId" },
        { status: 400 }
      );
    }

    // Get user
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    // Fetch plan and prompt overrides in parallel
    const [currentPlan, promptOverrides, transcripts, toolEvents, facialData, eegData, screenshots] = await Promise.all([
      getSessionPlan(sessionId, supabase),
      getUserPrompts(supabase, user.id),
      getRecentTranscripts(sessionId, 180000),  // 3 minutes of transcripts for cumulative context
      getRecentToolEvents(sessionId, 60000),    // 1 minute of tool events
      getRecentFacialData(sessionId, 60000),
      getRecentEEGData(sessionId, 60000),
      getRecentScreenshots(sessionId, 60000),
    ]);
    
    if (!currentPlan) {
      return NextResponse.json(
        { error: "No plan found for this session" },
        { status: 404 }
      );
    }

    // Build a high-level context description (counts only — actual content
    // lives on xAI Files and Grok will agentically search via input_file).
    const contextLines: string[] = ["Recent session activity available via attached files:"];
    if (transcripts.length > 0) contextLines.push(`- ${transcripts.length} transcript chunk(s)`);
    if (toolEvents.length > 0) {
      const toolTypes = [...new Set(toolEvents.map(e => e.toolName))];
      contextLines.push(`- Tool events: ${toolTypes.join(", ")}`);
    }
    if (facialData.length > 0) contextLines.push(`- ${facialData.length} facial data chunk(s)`);
    if (eegData.length > 0) contextLines.push(`- ${eegData.length} EEG chunk(s)`);
    if (screenshots.length > 0) contextLines.push(`- ${screenshots.length} screenshot(s)`);
    const contextDescription = contextLines.join("\n");

    // If no transcripts, just return waiting state (no nudges)
    if (transcripts.length === 0) {
      return NextResponse.json({
        plan: currentPlan,
        gapScore: 0.5,
        signals: ["waiting_for_audio"],
        transcript: "",
        planChanged: false,
        nextRequest: null,
        probesToArchive: [],
        canGenerateProbe: true,
        reasoning: "No audio transcripts available yet",
      });
    }

    // Collect xAI file IDs across all artifact kinds so Grok can read what it
    // needs agentically. Cap each kind to bound tool-search cost per heartbeat.
    const sessionFileIds: string[] = [
      ...transcripts.slice(-10).map(t => t.xaiFileId),
      ...toolEvents.slice(-10).map(t => t.xaiFileId),
      ...facialData.slice(-3).map(f => f.xaiFileId),
      ...eegData.slice(-3).map(e => e.xaiFileId),
      ...screenshots.slice(-3).map(s => s.xaiFileId),
    ].filter((id): id is string => !!id && id !== "_empty");

    // Update the plan using LLM. Passing sessionFileIds switches to the
    // Responses API + input_file agentic path inside updateSessionPlanLLM.
    const result = await updateSessionPlanLLM({
      goal: currentPlan.goal,
      strategy: currentPlan.strategy,
      steps: currentPlan.steps,
      currentStepIndex: currentPlan.currentStepIndex,
      contextDescription,
      previousProbes: previousProbes || [],
      // Accept both the legacy shape (string[]) and the new shape
      // ({id, text}[]). Coerce to {id, text}[] for the LLM so it can
      // return real UUIDs in probes_to_archive.
      activeProbes: Array.isArray(activeProbes)
        ? (activeProbes as unknown[]).flatMap((p) => {
            if (typeof p === "string") return [{ id: "", text: p }];
            if (p && typeof p === "object" && "text" in p) {
              const obj = p as { id?: unknown; text?: unknown };
              return [{ id: typeof obj.id === "string" ? obj.id : "", text: typeof obj.text === "string" ? obj.text : "" }];
            }
            return [];
          })
        : [],
      focusedProbes: focusedProbes || [],
      openProbeCount: openProbeCount ?? 0,
      lastProbeTimestamp: lastProbeTimestamp ?? 0,
      promptOverrides,
      sessionFileIds,
    });

    if (!result.success || !result.result) {
      return NextResponse.json(
        { error: result.error || "Plan update failed" },
        { status: 500 }
      );
    }

    const { planChanged, updatedSteps, currentStepIndex, nextRequest, canGenerateProbe, reasoning, gapScore, signals, canAutoAdvance, advanceReasoning } = result.result;
    // Drop any non-UUID probe IDs the LLM might still emit before returning
    // them to the client; archiveProbe() on the client filters too, but
    // centralizing here keeps all downstream code safe (including the
    // fire-and-forget storeAnalysisResult below).
    const probesToArchive = (result.result.probesToArchive || []).filter(isUuid);

    // Fire-and-forget: persist the analysis result to xAI + session_analysis table
    storeAnalysisResult({
      supabase,
      sessionId,
      userId: user.id,
      source: "heartbeat",
      result: {
        gapScore, planChanged, canAutoAdvance, signals, reasoning,
        advanceReasoning, nextRequest, currentStepIndex, probesToArchive,
        updatedSteps: updatedSteps as Array<Record<string, unknown>> | undefined,
      },
      extra: {
        context_file_count: sessionFileIds.length,
        transcripts: transcripts.length,
        tool_events: toolEvents.length,
        facial: facialData.length,
        eeg: eegData.length,
        screenshots: screenshots.length,
      },
    }).catch(err => console.error("[session-plan/update] storeAnalysisResult failed:", err));

    // Update plan in database if it changed
    let updatedPlan = currentPlan;
    if (planChanged && updatedSteps) {
      const normalizedSteps: SessionPlanStep[] = updatedSteps.map((step, idx) => ({
        id: step.id || `step_${idx + 1}_${Date.now()}`,
        description: step.description,
        type: step.type,
        order: step.order,
        status: idx < currentStepIndex 
          ? "completed" 
          : idx === currentStepIndex 
            ? "in_progress" 
            : "pending",
      }));

      try {
        validatePlanSteps(normalizedSteps);
        updatedPlan = await updateSessionPlan(currentPlan.id, {
          steps: normalizedSteps,
          currentStepIndex,
        }, supabase);
      } catch (validationError) {
        console.warn('[Plan Update] LLM returned invalid steps, falling back to current steps with status updates:', validationError);
        const fallbackSteps: SessionPlanStep[] = currentPlan.steps.map((step, idx) => ({
          id: step.id,
          description: step.description,
          type: step.type,
          order: step.order,
          status: idx < currentStepIndex 
            ? "completed" 
            : idx === currentStepIndex 
              ? "in_progress" 
              : step.status === "skipped" ? "skipped" : "pending",
        }));
        updatedPlan = await updateSessionPlan(currentPlan.id, {
          steps: fallbackSteps,
          currentStepIndex,
        }, supabase);
      }
    } else if (currentStepIndex !== currentPlan.currentStepIndex) {
      const normalizedSteps: SessionPlanStep[] = currentPlan.steps.map((step, idx) => ({
        id: step.id,
        description: step.description,
        type: step.type,
        order: step.order,
        status: idx < currentStepIndex 
          ? "completed" 
          : idx === currentStepIndex 
            ? "in_progress" 
            : step.status === "skipped" ? "skipped" : "pending",
      }));

      updatedPlan = await updateSessionPlan(currentPlan.id, {
        steps: normalizedSteps,
        currentStepIndex,
      }, supabase);
    }

    return NextResponse.json({
      plan: updatedPlan,
      planChanged,
      nextRequest,
      probesToArchive,
      canGenerateProbe,
      reasoning,
      gapScore: gapScore ?? 0.5,
      signals: signals || [],
      canAutoAdvance: canAutoAdvance ?? false,
      advanceReasoning: advanceReasoning ?? "",
      transcript: "",
    });
  } catch (error) {
    console.error("Update session plan error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
