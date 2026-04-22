// ============================================
// OpenLesson Agentic API v2 - Restart Session
// POST /api/v2/agent/sessions/:id/restart
// ============================================

import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, errorResponse } from "@/lib/agent-v2/auth";
import { createProof, serializeProof } from "@/lib/agent-v2/proofs";
import { createSessionPlanLLM, generateOpeningProbe } from "@/lib/xai";
import { getLanguageName } from "@/lib/tutoring-languages";

export const runtime = "nodejs";
export const maxDuration = 60;

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
    // Body is optional
  }

  const { reason, preserve_transcript, new_strategy } = body as {
    reason?: string;
    preserve_transcript?: boolean;
    new_strategy?: string;
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
      return errorResponse(400, "session_already_ended", "Session has already ended and cannot be restarted");
    }

    // ── Archive all existing probes ────────────────────────────────────
    const { error: archiveErr } = await supabase
      .from("probes")
      .update({ archived: true })
      .eq("session_id", sessionId)
      .eq("archived", false);

    if (archiveErr) {
      console.warn("[v2/sessions/:id/restart] Probe archive error:", archiveErr);
    }

    // ── Optionally clear transcript ────────────────────────────────────
    if (!preserve_transcript) {
      const { data: transcriptRecords } = await supabase
        .from("session_transcript")
        .select("xai_file_id")
        .eq("session_id", sessionId);

      if (transcriptRecords && transcriptRecords.length > 0) {
        // Best-effort delete xAI files
        const { deleteFileFromXAI } = await import("@/lib/xai-files");
        await Promise.all(
          transcriptRecords
            .filter((r: { xai_file_id: string | null }) => !!r.xai_file_id && r.xai_file_id !== "_empty")
            .map((r: { xai_file_id: string }) => deleteFileFromXAI(r.xai_file_id).catch(() => {}))
        );

        await supabase
          .from("session_transcript")
          .delete()
          .eq("session_id", sessionId);
      }
    }

    // ── Delete existing session plan ───────────────────────────────────
    const { data: existingPlan } = await supabase
      .from("session_plans")
      .select("id")
      .eq("session_id", sessionId)
      .maybeSingle();

    if (existingPlan) {
      await supabase
        .from("session_plans")
        .delete()
        .eq("id", existingPlan.id);
    }

    // ── Generate new session plan ──────────────────────────────────────
    const sessionMeta = session.metadata as Record<string, unknown> | null;
    const tutoringLang = sessionMeta?.tutoring_language as string | undefined;
    const languageName = tutoringLang ? getLanguageName(tutoringLang) : undefined;

    const planResult = await createSessionPlanLLM({
      problem: session.problem,
      calibration: reason
        ? `Session was restarted. Reason: ${reason}`
        : "Session was restarted by the agent.",
      planningPrompt: new_strategy || undefined,
      tutoringLanguage: languageName,
    });

    let newPlan = null;

    if (planResult.success && planResult.plan) {
      const validSteps = (planResult.plan.steps || []).filter(
        (step) => step.description && step.description.trim().length > 0
      );

      if (validSteps.length > 0) {
        const stepsWithStatus = validSteps.map((step, idx) => ({
          id: step.id || `step_${idx + 1}_${Date.now()}`,
          type: step.type,
          description: step.description,
          order: idx + 1,
          status: idx === 0 ? "in_progress" : "pending",
        }));

        const { data: plan, error: planErr } = await supabase
          .from("session_plans")
          .insert({
            session_id: sessionId,
            user_id: auth.user_id,
            goal: planResult.plan.goal,
            strategy: planResult.plan.strategy,
            description: planResult.plan.description || null,
            steps: stepsWithStatus,
            current_step_index: 0,
          })
          .select()
          .single();

        if (planErr) {
          console.error("[v2/sessions/:id/restart] Plan insert error:", planErr);
        } else {
          newPlan = plan;
        }
      }
    } else {
      console.warn("[v2/sessions/:id/restart] Plan generation failed:", planResult.error);
    }

    // ── Generate new opening probe ─────────────────────────────────────
    const objectives = newPlan?.steps
      ? (newPlan.steps as { description: string }[]).slice(0, 3).map((s) => s.description)
      : undefined;

    const openingResult = await generateOpeningProbe(
      session.problem,
      undefined,
      objectives,
      languageName
    );

    let openingProbe: string | null = null;

    if (openingResult.success && openingResult.probe) {
      openingProbe = openingResult.probe;

      const { error: probeErr } = await supabase.from("probes").insert({
        session_id: sessionId,
        timestamp_ms: Date.now() - new Date(session.created_at).getTime(),
        gap_score: 0,
        signals: [],
        text: openingProbe,
        request_type: "opening",
        archived: false,
        focused: false,
        plan_step_id: newPlan?.steps?.[0]?.id || null,
      });

      if (probeErr) {
        console.warn("[v2/sessions/:id/restart] Opening probe insert error:", probeErr);
      }
    }

    // ── Update session ─────────────────────────────────────────────────
    const restartMetadata = {
      ...(sessionMeta || {}),
      restarted_at: new Date().toISOString(),
      restart_reason: reason || null,
      restart_count: ((sessionMeta?.restart_count as number) || 0) + 1,
      transcript_preserved: !!preserve_transcript,
      new_strategy: new_strategy || null,
    };

    const { data: updated, error: updateErr } = await supabase
      .from("sessions")
      .update({
        status: "active",
        metadata: restartMetadata,
      })
      .eq("id", sessionId)
      .select()
      .single();

    if (updateErr || !updated) {
      console.error("[v2/sessions/:id/restart] Update error:", updateErr);
      return errorResponse(500, "internal_error", "Failed to update session");
    }

    // ── Create proof ───────────────────────────────────────────────────
    const proof = await createProof(supabase, {
      type: "session_started",
      user_id: auth.user_id,
      session_id: sessionId,
      event_data: {
        action: "restart",
        reason: reason || null,
        transcript_preserved: !!preserve_transcript,
        new_strategy: new_strategy || null,
        has_new_plan: !!newPlan,
        has_opening_probe: !!openingProbe,
      },
    });

    return NextResponse.json({
      session: {
        id: updated.id,
        status: updated.status,
        problem: updated.problem,
        metadata: updated.metadata,
      },
      session_plan: newPlan
        ? {
            id: newPlan.id,
            goal: newPlan.goal,
            strategy: newPlan.strategy,
            description: newPlan.description,
            steps: newPlan.steps,
            current_step_index: newPlan.current_step_index,
          }
        : null,
      opening_probe: openingProbe,
      transcript_preserved: !!preserve_transcript,
      proof: proof ? serializeProof(proof) : null,
    });
  } catch (err) {
    console.error("[v2/sessions/:id/restart] Error:", err);
    return errorResponse(500, "internal_error", "Internal server error");
  }
}
