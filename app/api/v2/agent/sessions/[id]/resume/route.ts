// ============================================
// OpenLesson Agentic API v2 - Resume Session
// POST /api/v2/agent/sessions/:id/resume
// ============================================

import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, errorResponse } from "@/lib/agent-v2/auth";
import { createProof, serializeProof } from "@/lib/agent-v2/proofs";
import { generateOpeningProbe } from "@/lib/xai";
import { getLanguageName } from "@/lib/tutoring-languages";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await authenticateRequest(req, "sessions:write");
  if (result instanceof NextResponse) return result;
  const { auth, supabase } = result;

  const { id: sessionId } = await params;

  if (!sessionId) {
    return errorResponse(400, "validation_error", "Session ID is required");
  }

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    // Body is optional for resume
  }

  const { continuation_context } = body as {
    continuation_context?: string;
  };

  try {
    // ── Fetch and validate session ─────────────────────────────────────
    const { data: session, error: sessionErr } = await supabase
      .from("sessions")
      .select("*")
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

    if (session.status === "completed" || session.status === "ended_by_tutor") {
      return errorResponse(400, "session_already_ended", "Session has already ended");
    }

    if (session.status !== "paused") {
      return errorResponse(400, "session_not_active", `Session is in "${session.status}" state and cannot be resumed (must be paused)`);
    }

    // ── Gather current context ─────────────────────────────────────────
    const { data: plan } = await supabase
      .from("session_plans")
      .select("*")
      .eq("session_id", sessionId)
      .maybeSingle();

    const { data: activeProbes } = await supabase
      .from("probes")
      .select("id, text, gap_score, signals, focused, plan_step_id")
      .eq("session_id", sessionId)
      .eq("archived", false)
      .order("timestamp_ms", { ascending: false })
      .limit(5);

    // ── Generate reorientation probe ───────────────────────────────────
    const sessionMeta = session.metadata as Record<string, unknown> | null;
    const tutoringLang = sessionMeta?.tutoring_language as string | undefined;
    const languageName = tutoringLang ? getLanguageName(tutoringLang) : undefined;

    const currentStep = plan?.steps?.[plan.current_step_index];
    const currentStepDesc = currentStep
      ? (currentStep as { description: string }).description
      : undefined;

    // Build a problem context that includes continuation context if provided
    const resumeProblem = continuation_context
      ? `${session.problem}\n\nContinuation context: ${continuation_context}`
      : session.problem;

    const objectives = currentStepDesc ? [currentStepDesc] : undefined;

    const probeResult = await generateOpeningProbe(
      resumeProblem,
      undefined,
      objectives,
      languageName
    );

    let reorientationProbe: string | null = null;

    if (probeResult.success && probeResult.probe) {
      reorientationProbe = probeResult.probe;

      const { error: probeInsertErr } = await supabase.from("probes").insert({
        session_id: sessionId,
        timestamp_ms: Date.now() - new Date(session.created_at).getTime(),
        gap_score: 0,
        signals: [],
        text: reorientationProbe,
        request_type: "reorientation",
        archived: false,
        focused: false,
        plan_step_id: currentStep?.id || null,
      });

      if (probeInsertErr) {
        console.warn("[v2/sessions/:id/resume] Probe insert error:", probeInsertErr);
      }
    }

    // ── Update session status ──────────────────────────────────────────
    const pausedAt = sessionMeta?.paused_at as string | undefined;
    const pauseDurationMs = pausedAt
      ? Date.now() - new Date(pausedAt).getTime()
      : 0;

    const resumeMetadata = {
      ...(sessionMeta || {}),
      paused_at: null,
      pause_reason: null,
      estimated_resume_minutes: null,
      resumed_at: new Date().toISOString(),
      last_pause_duration_ms: pauseDurationMs,
      continuation_context: continuation_context || null,
    };

    const { data: updated, error: updateErr } = await supabase
      .from("sessions")
      .update({
        status: "active",
        metadata: resumeMetadata,
      })
      .eq("id", sessionId)
      .select()
      .single();

    if (updateErr || !updated) {
      console.error("[v2/sessions/:id/resume] Update error:", updateErr);
      return errorResponse(500, "internal_error", "Failed to resume session");
    }

    // ── Create proof ───────────────────────────────────────────────────
    const proof = await createProof(supabase, {
      type: "session_resumed",
      user_id: auth.user_id,
      session_id: sessionId,
      event_data: {
        pause_duration_ms: pauseDurationMs,
        has_continuation_context: !!continuation_context,
        has_reorientation_probe: !!reorientationProbe,
      },
    });

    return NextResponse.json({
      session: {
        id: updated.id,
        status: updated.status,
        problem: updated.problem,
        metadata: updated.metadata,
      },
      reorientation_probe: reorientationProbe,
      current_context: {
        plan: plan
          ? {
              id: plan.id,
              goal: plan.goal,
              current_step_index: plan.current_step_index,
              current_step: currentStepDesc || null,
              total_steps: Array.isArray(plan.steps) ? plan.steps.length : 0,
            }
          : null,
        active_probes: (activeProbes || []).map((p) => ({
          id: p.id,
          text: p.text,
          gap_score: p.gap_score,
          focused: p.focused,
        })),
        pause_duration_ms: pauseDurationMs,
      },
      proof: proof ? serializeProof(proof) : null,
    });
  } catch (err) {
    console.error("[v2/sessions/:id/resume] Error:", err);
    return errorResponse(500, "internal_error", "Internal server error");
  }
}
