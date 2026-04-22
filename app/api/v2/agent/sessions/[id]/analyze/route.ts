// ============================================
// OpenLesson Agentic API v2 - Analysis Heartbeat
// POST /api/v2/agent/sessions/:id/analyze
// ============================================

import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, errorResponse } from "@/lib/agent-v2/auth";
import { createProof, serializeProof, hashData } from "@/lib/agent-v2/proofs";
import { analyzeGap, updateSessionPlanLLM } from "@/lib/xai";
import type { AnalysisInput } from "@/lib/agent-v2/types";
import type { SessionPlanStep, FocusedProbeInfo } from "@/lib/xai";
import type { SupabaseClient } from "@supabase/supabase-js";
import { uploadFileToXAI, getFileTextContent } from "@/lib/xai-files";
import { storeAnalysisResult } from "@/lib/session-analysis";
import { isUuid } from "@/lib/storage";

export const runtime = "nodejs";
export const maxDuration = 60;

// ─── Types ───────────────────────────────────────────────────────────────────

interface AnalyzeRequestBody {
  inputs: AnalysisInput[];
  context?: {
    active_probe_ids?: string[];
    focused_probe_id?: string;
    tools_in_use?: string[];
    user_actions_since_last?: Array<{
      tool: string;
      action: string;
      timestamp: number;
      data?: unknown;
    }>;
  };
}

interface ProbeRecord {
  id: string;
  text: string;
  gap_score: number;
  signals: string[];
  request_type: string;
  archived: boolean;
  focused: boolean;
  timestamp_ms: number;
  plan_step_id: string | null;
}

interface SessionPlan {
  id: string;
  session_id: string;
  user_id: string;
  goal: string;
  strategy: string;
  description: string | null;
  steps: SessionPlanStep[];
  current_step_index: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function storeTranscriptChunk(
  supabase: SupabaseClient,
  sessionId: string,
  transcript: string,
  timestampMs: number
): Promise<{ chunkIndex: number; xaiFileId: string } | null> {
  if (!transcript || transcript.trim().length === 0) return null;

  const { count } = await supabase
    .from("session_transcript")
    .select("id", { count: "exact", head: true })
    .eq("session_id", sessionId);

  const chunkIndex = count ?? 0;
  const wordCount = transcript.split(/\s+/).filter((w) => w.length > 0).length;

  // Upload transcript to xAI Files
  const fileName = `${sessionId}_chunk_${chunkIndex}.txt`;
  const base64 = Buffer.from(transcript, "utf-8").toString("base64");
  let xaiFileId: string;
  try {
    const uploaded = await uploadFileToXAI(fileName, "text/plain", base64);
    xaiFileId = uploaded.file_id;
  } catch (err) {
    console.error("[v2/analyze] xAI transcript upload failed:", err);
    return null;
  }

  const { error: insertErr } = await supabase.from("session_transcript").insert({
    session_id: sessionId,
    xai_file_id: xaiFileId,
    chunk_index: chunkIndex,
    word_count: wordCount,
    timestamp_ms: timestampMs,
  });

  if (insertErr) {
    console.error("[v2/analyze] Transcript record insert error:", insertErr);
    return null;
  }

  return { chunkIndex, xaiFileId };
}

function buildContextDescription(
  context: AnalyzeRequestBody["context"],
  inputTypes: string[]
): string {
  const parts: string[] = [];

  parts.push(`Input types received: ${inputTypes.join(", ")}`);

  if (context?.tools_in_use?.length) {
    parts.push(`Tools currently in use: ${context.tools_in_use.join(", ")}`);
  }

  if (context?.focused_probe_id) {
    parts.push(`Student is focused on probe: ${context.focused_probe_id}`);
  }

  if (context?.user_actions_since_last?.length) {
    const actions = context.user_actions_since_last
      .slice(-5) // Last 5 actions max
      .map((a) => `${a.tool}:${a.action}`)
      .join(", ");
    parts.push(`Recent user actions: ${actions}`);
  }

  return parts.join("\n");
}

// ─── POST Handler ────────────────────────────────────────────────────────────

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await authenticateRequest(req, "analysis:write");
  if (result instanceof NextResponse) return result;
  const { auth, supabase } = result;

  const { id: sessionId } = await params;

  if (!sessionId) {
    return errorResponse(400, "validation_error", "Session ID is required");
  }

  let body: AnalyzeRequestBody;
  try {
    body = await req.json();
  } catch {
    return errorResponse(400, "validation_error", "Invalid JSON body");
  }

  if (!body.inputs || !Array.isArray(body.inputs) || body.inputs.length === 0) {
    return errorResponse(400, "validation_error", "inputs array is required and must not be empty");
  }

  // Validate input types
  for (const input of body.inputs) {
    if (!["audio", "image", "text"].includes(input.type)) {
      return errorResponse(400, "validation_error", `Invalid input type: ${input.type}`);
    }
    if (input.type === "audio" && (!("data" in input) || !("format" in input))) {
      return errorResponse(400, "validation_error", "Audio input requires data and format fields");
    }
    if (input.type === "image" && (!("data" in input) || !("mime_type" in input))) {
      return errorResponse(400, "validation_error", "Image input requires data and mime_type fields");
    }
    if (input.type === "text" && !("content" in input)) {
      return errorResponse(400, "validation_error", "Text input requires content field");
    }
  }

  try {
    // ── 1. Validate session ownership, active state, is_agent_session ──
    const { data: session, error: sessionErr } = await supabase
      .from("sessions")
      .select("id, user_id, problem, status, is_agent_session, metadata, created_at")
      .eq("id", sessionId)
      .single();

    if (sessionErr || !session) {
      return errorResponse(404, "not_found", "Session not found");
    }

    if (session.user_id !== auth.user_id) {
      return errorResponse(403, "forbidden", "Session does not belong to this user");
    }

    if (!session.is_agent_session) {
      return errorResponse(403, "forbidden", "This endpoint is for agent sessions only");
    }

    if (session.status !== "active") {
      return errorResponse(400, "session_not_active", "Session is not active");
    }

    // ── 2. Get current session plan ───────────────────────────────────
    const { data: planData } = await supabase
      .from("session_plans")
      .select("*")
      .eq("session_id", sessionId)
      .maybeSingle();

    const plan = planData as SessionPlan | null;

    // ── 3. Get existing probes ────────────────────────────────────────
    const { data: probesData } = await supabase
      .from("probes")
      .select("id, text, gap_score, signals, request_type, archived, focused, timestamp_ms, plan_step_id")
      .eq("session_id", sessionId)
      .order("timestamp_ms", { ascending: true });

    const allProbes = (probesData || []) as ProbeRecord[];
    const activeProbes = allProbes.filter((p) => !p.archived);
    const archivedProbes = allProbes.filter((p) => p.archived);
    const focusedProbes = activeProbes.filter((p) => p.focused);
    const openProbeCount = activeProbes.length;

    const lastProbeTimestamp = allProbes.length > 0
      ? allProbes[allProbes.length - 1].timestamp_ms
      : undefined;

    // ── 4. Extract inputs ─────────────────────────────────────────────
    const audioInput = body.inputs.find((i) => i.type === "audio") as
      | { type: "audio"; data: string; format: string; duration_ms?: number }
      | undefined;
    const textInputs = body.inputs.filter((i) => i.type === "text") as
      Array<{ type: "text"; content: string }>;
    const inputTypes = body.inputs.map((i) => i.type);

    // ── 5. Transcribe / analyze audio or use text ─────────────────────
    let transcript = "";
    let gapScore = 0.3; // Default: reasonable progress
    let signals: string[] = [];
    let understandingSummary = "";

    if (audioInput) {
      // Use analyzeGap for audio transcription + gap detection
      const gapResult = await analyzeGap({
        audioBase64: audioInput.data,
        audioFormat: audioInput.format,
        problem: session.problem,
        openProbeCount,
        lastProbeTimestamp,
        tutoringLanguage: (session.metadata as Record<string, unknown> | null)?.tutoring_language as string | undefined,
      });

      if (gapResult.success && gapResult.result) {
        transcript = gapResult.result.transcript || "";
        gapScore = gapResult.result.gap_score;
        signals = gapResult.result.signals;
      } else {
        console.warn("[v2/analyze] Gap analysis failed:", gapResult.error);
        // Continue without audio analysis - don't fail the whole request
      }
    }

    // Append text inputs to transcript
    if (textInputs.length > 0) {
      const textContent = textInputs.map((t) => t.content).join("\n");
      transcript = transcript ? `${transcript}\n\n${textContent}` : textContent;

      // If no audio was provided, use a default neutral gap score
      if (!audioInput) {
        gapScore = 0.4;
        signals = ["text_input"];
      }
    }

    // ── 6. Store transcript chunk ─────────────────────────────────────
    const nowMs = Date.now();
    if (transcript.trim()) {
      await storeTranscriptChunk(supabase, sessionId, transcript, nowMs);
    }

    // ── 7. Call updateSessionPlanLLM if plan exists ───────────────────
    let planChanged = false;
    let currentStepIndex = plan?.current_step_index ?? 0;
    let currentStep: SessionPlanStep | null = null;
    let stepsCompleted: string[] = [];
    let stepsAdded: string[] = [];
    let stepsModified: string[] = [];
    let canAutoAdvance = false;
    let advanceReasoning = "";

    // Guidance fields
    let nextProbe: {
      id: string;
      text: string;
      type: string;
      gap_addressed: string;
      suggested_tools: string[];
      plan_step_id: string | null;
    } | null = null;
    let probesToArchive: string[] = [];
    let requiresFollowUp = false;
    let recommendedWaitMs = 5000;

    if (plan) {
      const previousProbeTexts = allProbes.map((p) => p.text).filter(Boolean);
      // Pass active probes as {id, text} so the LLM can echo real UUIDs
      // back in probes_to_archive (otherwise it hallucinates ordinals).
      const activeProbeInfos: FocusedProbeInfo[] = activeProbes
        .filter((p) => !!p.text)
        .map((p) => ({ id: p.id, text: p.text }));
      const focusedProbeInfos: FocusedProbeInfo[] = focusedProbes.map((p) => ({
        id: p.id,
        text: p.text,
      }));

      const contextDescription = buildContextDescription(body.context, inputTypes);

      // Fetch xAI file IDs for the recent transcript chunks. Grok will read
      // them agentically via attachment_search inside updateSessionPlanLLM.
      const { data: recentTranscripts } = await supabase
        .from("session_transcript")
        .select("xai_file_id, chunk_index")
        .eq("session_id", sessionId)
        .order("chunk_index", { ascending: false })
        .limit(5);

      const sessionFileIds = (recentTranscripts || [])
        .map((r: { xai_file_id: string | null }) => r.xai_file_id)
        .filter((id: string | null): id is string => !!id && id !== "_empty");

      const updateResult = await updateSessionPlanLLM({
        goal: plan.goal,
        strategy: plan.strategy,
        steps: plan.steps,
        currentStepIndex: plan.current_step_index,
        contextDescription,
        previousProbes: previousProbeTexts,
        activeProbes: activeProbeInfos,
        focusedProbes: focusedProbeInfos,
        openProbeCount,
        lastProbeTimestamp,
        sessionFileIds,
      });

      if (updateResult.success && updateResult.result) {
        const r = updateResult.result;

        // Fire-and-forget: persist to xAI + session_analysis
        storeAnalysisResult({
          supabase,
          sessionId,
          userId: auth.user_id,
          source: "v2_analyze",
          result: {
            gapScore: r.gapScore,
            planChanged: r.planChanged,
            canAutoAdvance: r.canAutoAdvance,
            signals: r.signals,
            reasoning: r.reasoning,
            advanceReasoning: r.advanceReasoning,
            nextRequest: r.nextRequest,
            currentStepIndex: r.currentStepIndex,
            probesToArchive: r.probesToArchive,
            updatedSteps: r.updatedSteps as Array<Record<string, unknown>> | undefined,
          },
          extra: {
            context_file_count: sessionFileIds.length,
            input_types: inputTypes,
          },
        }).catch(err => console.error("[v2/analyze] storeAnalysisResult failed:", err));

        // Use LLM gap analysis as primary (overrides audio-only analysis)
        gapScore = r.gapScore;
        signals = r.signals;
        understandingSummary = r.reasoning;
        canAutoAdvance = r.canAutoAdvance;
        advanceReasoning = r.advanceReasoning;

        // Plan update tracking
        const oldStepIndex = plan.current_step_index;
        currentStepIndex = r.currentStepIndex;
        planChanged = r.planChanged;

        if (r.updatedSteps) {
          // Track what changed
          const oldStepIds = new Set(plan.steps.map((s) => s.id));
          const newStepIds = new Set(r.updatedSteps.map((s) => s.id));

          stepsAdded = r.updatedSteps
            .filter((s) => s.id && !oldStepIds.has(s.id))
            .map((s) => s.id!)
            .filter(Boolean);

          stepsModified = r.updatedSteps
            .filter((s) => {
              if (!s.id || !oldStepIds.has(s.id)) return false;
              const old = plan.steps.find((o) => o.id === s.id);
              return old && (old.description !== s.description || old.type !== s.type);
            })
            .map((s) => s.id!)
            .filter(Boolean);
        }

        // Track completed steps
        if (currentStepIndex > oldStepIndex) {
          const steps = r.updatedSteps || plan.steps;
          stepsCompleted = steps
            .filter((s) => s.status === "completed")
            .map((s) => s.id!)
            .filter(Boolean);
        }

        // Update plan in DB if changed
        if (planChanged && r.updatedSteps) {
          await supabase
            .from("session_plans")
            .update({
              steps: r.updatedSteps,
              current_step_index: currentStepIndex,
              updated_at: new Date().toISOString(),
            })
            .eq("id", plan.id);
        } else if (currentStepIndex !== oldStepIndex) {
          // Just step index changed
          await supabase
            .from("session_plans")
            .update({
              current_step_index: currentStepIndex,
              updated_at: new Date().toISOString(),
            })
            .eq("id", plan.id);
        }

        // Probes to archive — filter out any non-UUID ids that the LLM
        // might still emit (e.g. "1", "probe_1"), otherwise the .in()
        // query below 500s with Postgres 22P02.
        probesToArchive = (r.probesToArchive || []).filter(isUuid);

        // Archive probes if suggested
        if (probesToArchive.length > 0) {
          await supabase
            .from("probes")
            .update({ archived: true })
            .in("id", probesToArchive)
            .eq("session_id", sessionId);
        }

        // Create new probe if guidance suggests one
        if (r.canGenerateProbe && r.nextRequest && r.nextRequest.text) {
          const currentSteps = r.updatedSteps || plan.steps;
          const stepForProbe =
            currentStepIndex >= 0 && currentStepIndex < currentSteps.length
              ? currentSteps[currentStepIndex]
              : null;

          const { data: newProbe, error: probeErr } = await supabase
            .from("probes")
            .insert({
              session_id: sessionId,
              text: r.nextRequest.text,
              request_type: r.nextRequest.type || "question",
              gap_score: gapScore,
              signals,
              archived: false,
              focused: false,
              timestamp_ms: nowMs,
              plan_step_id: stepForProbe?.id || null,
            })
            .select("id")
            .single();

          if (!probeErr && newProbe) {
            const suggestedTools = (r.nextRequest as unknown as { suggested_tools?: string[] })
              ?.suggested_tools || [];

            nextProbe = {
              id: newProbe.id,
              text: r.nextRequest.text,
              type: r.nextRequest.type,
              gap_addressed: signals.length > 0 ? signals[0] : "general",
              suggested_tools: suggestedTools,
              plan_step_id: stepForProbe?.id || null,
            };
          }
        }

        // Follow-up and wait recommendations
        requiresFollowUp = gapScore > 0.6;
        recommendedWaitMs = gapScore > 0.7 ? 3000 : gapScore > 0.4 ? 5000 : 8000;
      } else {
        console.warn("[v2/analyze] Plan update LLM call failed:", updateResult.error);
        understandingSummary = "Plan update analysis unavailable";
      }
    } else {
      // No plan - still provide basic analysis
      understandingSummary = signals.length > 0
        ? `Detected signals: ${signals.join(", ")}`
        : "No significant gaps detected";
      requiresFollowUp = gapScore > 0.6;
      recommendedWaitMs = 5000;
    }

    // Resolve current step
    if (plan) {
      const steps = plan.steps;
      currentStep =
        currentStepIndex >= 0 && currentStepIndex < steps.length
          ? steps[currentStepIndex]
          : null;
    }

    // ── 8. Generate proof ─────────────────────────────────────────────
    const inputHash = hashData(JSON.stringify(body.inputs.map((i) => i.type)));
    const outputHash = hashData(
      JSON.stringify({
        gap_score: gapScore,
        signals,
        plan_changed: planChanged,
        probe_generated: !!nextProbe,
      })
    );

    const proof = await createProof(supabase, {
      type: "analysis_heartbeat",
      user_id: auth.user_id,
      session_id: sessionId,
      input_hash: inputHash,
      output_hash: outputHash,
      event_data: {
        input_types: inputTypes,
        gap_score: gapScore,
        signals,
        plan_changed: planChanged,
        probe_generated: !!nextProbe,
        probes_archived: probesToArchive.length,
        transcript_words: transcript.split(/\s+/).filter((w) => w.length > 0).length,
      },
    });

    // ── 9. Build response ─────────────────────────────────────────────
    return NextResponse.json({
      analysis: {
        gap_score: gapScore,
        signals,
        transcript: transcript || null,
        understanding_summary: understandingSummary,
      },
      session_plan_update: {
        changed: planChanged,
        current_step_index: currentStepIndex,
        current_step: currentStep
          ? {
              id: currentStep.id,
              type: currentStep.type,
              description: currentStep.description,
              order: currentStep.order,
              status: currentStep.status,
            }
          : null,
        steps_completed: stepsCompleted,
        steps_added: stepsAdded,
        steps_modified: stepsModified,
        can_auto_advance: canAutoAdvance,
        advance_reasoning: advanceReasoning,
      },
      guidance: {
        next_probe: nextProbe,
        probes_to_archive: probesToArchive,
        requires_follow_up: requiresFollowUp,
        recommended_wait_ms: recommendedWaitMs,
      },
      proof: proof ? serializeProof(proof) : null,
    });
  } catch (err) {
    console.error("[v2/analyze] Error:", err);
    return errorResponse(500, "internal_error", "Internal server error");
  }
}
