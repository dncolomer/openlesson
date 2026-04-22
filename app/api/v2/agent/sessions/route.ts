// ============================================
// OpenLesson Agentic API v2 - Sessions
// GET  /api/v2/agent/sessions  — List sessions
// POST /api/v2/agent/sessions  — Start a new session
// ============================================

import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, errorResponse } from "@/lib/agent-v2/auth";
import { createProof, serializeProof } from "@/lib/agent-v2/proofs";
import { createSessionPlanLLM, generateOpeningProbe } from "@/lib/xai";
import { getLanguageName } from "@/lib/tutoring-languages";

export const runtime = "nodejs";
export const maxDuration = 60;

// ─── GET: List sessions with pagination ──────────────────────────────────────

export async function GET(req: NextRequest) {
  const result = await authenticateRequest(req, "sessions:read");
  if (result instanceof NextResponse) return result;
  const { auth, supabase } = result;

  const url = req.nextUrl;
  const status = url.searchParams.get("status");
  const planId = url.searchParams.get("plan_id");
  const limit = Math.min(Math.max(parseInt(url.searchParams.get("limit") || "20", 10), 1), 100);
  const offset = Math.max(parseInt(url.searchParams.get("offset") || "0", 10), 0);

  try {
    let query = supabase
      .from("sessions")
      .select("*", { count: "exact" })
      .eq("user_id", auth.user_id)
      .eq("is_agent_session", true)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (status) {
      query = query.eq("status", status);
    }

    if (planId) {
      query = query.contains("metadata", { plan_id: planId });
    }

    const { data: sessions, error, count } = await query;

    if (error) {
      console.error("[v2/sessions] List error:", error);
      return errorResponse(500, "internal_error", "Failed to list sessions");
    }

    const total = count ?? 0;

    return NextResponse.json({
      sessions: sessions || [],
      pagination: {
        total,
        limit,
        offset,
        has_more: offset + limit < total,
      },
    });
  } catch (err) {
    console.error("[v2/sessions] GET error:", err);
    return errorResponse(500, "internal_error", "Internal server error");
  }
}

// ─── POST: Start a new session ───────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const result = await authenticateRequest(req, "sessions:write");
  if (result instanceof NextResponse) return result;
  const { auth, supabase } = result;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return errorResponse(400, "validation_error", "Invalid JSON body");
  }

  const { topic, plan_id, plan_node_id, tutoring_language, metadata } = body as {
    topic?: string;
    plan_id?: string;
    plan_node_id?: string;
    tutoring_language?: string;
    metadata?: Record<string, unknown>;
  };

  if (!topic || typeof topic !== "string" || topic.trim().length === 0) {
    return errorResponse(400, "validation_error", "topic is required and must be a non-empty string");
  }

  try {
    // ── Resolve plan node if provided ──────────────────────────────────
    let resolvedPlanId = plan_id || null;
    let nodeTitle: string | null = null;

    if (plan_node_id) {
      const { data: node, error: nodeErr } = await supabase
        .from("plan_nodes")
        .select("id, title, plan_id, status")
        .eq("id", plan_node_id)
        .single();

      if (nodeErr || !node) {
        return errorResponse(404, "node_not_found", "Plan node not found");
      }

      // If plan_id was provided, verify consistency
      if (resolvedPlanId && node.plan_id !== resolvedPlanId) {
        return errorResponse(400, "validation_error", "plan_node_id does not belong to the specified plan_id");
      }

      resolvedPlanId = node.plan_id;
      nodeTitle = node.title;
    }

    // Verify plan ownership if plan_id is provided
    if (resolvedPlanId) {
      const { data: plan, error: planErr } = await supabase
        .from("learning_plans")
        .select("id, user_id")
        .eq("id", resolvedPlanId)
        .single();

      if (planErr || !plan) {
        return errorResponse(404, "plan_not_found", "Learning plan not found");
      }

      if (plan.user_id !== auth.user_id) {
        return errorResponse(403, "forbidden", "Plan does not belong to this user");
      }
    }

    // ── Create session ────────────────────────────────────────────────
    const sessionMetadata: Record<string, unknown> = {
      ...(metadata || {}),
      plan_id: resolvedPlanId,
      plan_node_id: plan_node_id || null,
      node_title: nodeTitle,
      tutoring_language: tutoring_language || null,
      api_version: "v2",
    };

    const { data: session, error: sessionErr } = await supabase
      .from("sessions")
      .insert({
        user_id: auth.user_id,
        problem: topic.trim(),
        status: "active",
        is_agent_session: true,
        agent_api_key_id: auth.key_id,
        metadata: sessionMetadata,
      })
      .select()
      .single();

    if (sessionErr || !session) {
      console.error("[v2/sessions] Create error:", sessionErr);
      return errorResponse(500, "internal_error", "Failed to create session");
    }

    // ── Generate session plan via LLM ─────────────────────────────────
    const languageName = tutoring_language ? getLanguageName(tutoring_language) : undefined;

    // Fetch user calibration for plan personalization
    let calibrationText = "";
    try {
      const { data: recentSessions } = await supabase
        .from("sessions")
        .select("id, probes(gap_score, signals)")
        .eq("user_id", auth.user_id)
        .eq("status", "completed")
        .order("created_at", { ascending: false })
        .limit(10);

      if (recentSessions && recentSessions.length > 0) {
        let totalGap = 0;
        let probeCount = 0;
        for (const s of recentSessions) {
          const probes = s.probes as { gap_score: number; signals: string[] }[];
          if (probes) {
            for (const p of probes) {
              totalGap += p.gap_score || 0;
              probeCount++;
            }
          }
        }
        const avgGap = probeCount > 0 ? totalGap / probeCount : 0.5;
        calibrationText = `Student has completed ${recentSessions.length} recent sessions. Average gap score: ${avgGap.toFixed(2)}.`;
      }
    } catch (calErr) {
      console.warn("[v2/sessions] Calibration fetch failed:", calErr);
    }

    const planResult = await createSessionPlanLLM({
      problem: topic.trim(),
      calibration: calibrationText || undefined,
      tutoringLanguage: languageName,
    });

    let sessionPlan = null;

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

        const { data: plan, error: planInsertErr } = await supabase
          .from("session_plans")
          .insert({
            session_id: session.id,
            user_id: auth.user_id,
            goal: planResult.plan.goal,
            strategy: planResult.plan.strategy,
            description: planResult.plan.description || null,
            steps: stepsWithStatus,
            current_step_index: 0,
          })
          .select()
          .single();

        if (planInsertErr) {
          console.error("[v2/sessions] Plan insert error:", planInsertErr);
          // Non-fatal: session was created, plan just didn't save
        } else {
          sessionPlan = plan;
        }
      }
    } else {
      console.warn("[v2/sessions] Plan generation failed:", planResult.error);
    }

    // ── Generate opening probe ────────────────────────────────────────
    const objectives = sessionPlan?.steps
      ? (sessionPlan.steps as { description: string }[]).slice(0, 3).map((s) => s.description)
      : undefined;

    const openingResult = await generateOpeningProbe(
      topic.trim(),
      undefined,
      objectives,
      languageName
    );

    let openingProbe: string | null = null;

    if (openingResult.success && openingResult.probe) {
      openingProbe = openingResult.probe;

      // Store the opening probe in the probes table
      const { error: probeErr } = await supabase.from("probes").insert({
        session_id: session.id,
        timestamp_ms: 0,
        gap_score: 0,
        signals: [],
        text: openingProbe,
        request_type: "opening",
        archived: false,
        focused: false,
        plan_step_id: sessionPlan?.steps?.[0]?.id || null,
      });

      if (probeErr) {
        console.warn("[v2/sessions] Opening probe insert error:", probeErr);
      }
    } else {
      console.warn("[v2/sessions] Opening probe generation failed:", openingResult.error);
    }

    // ── Create proof ──────────────────────────────────────────────────
    const proof = await createProof(supabase, {
      type: "session_started",
      user_id: auth.user_id,
      session_id: session.id,
      plan_id: resolvedPlanId,
      event_data: {
        topic: topic.trim(),
        plan_node_id: plan_node_id || null,
        has_plan: !!sessionPlan,
        has_opening_probe: !!openingProbe,
      },
    });

    // ── Return response ───────────────────────────────────────────────
    return NextResponse.json(
      {
        session: {
          id: session.id,
          user_id: session.user_id,
          problem: session.problem,
          status: session.status,
          is_agent_session: session.is_agent_session,
          metadata: session.metadata,
          created_at: session.created_at,
        },
        session_plan: sessionPlan
          ? {
              id: sessionPlan.id,
              goal: sessionPlan.goal,
              strategy: sessionPlan.strategy,
              description: sessionPlan.description,
              steps: sessionPlan.steps,
              current_step_index: sessionPlan.current_step_index,
            }
          : null,
        opening_probe: openingProbe,
        instructions: {
          audio_format: "webm",
          analyze_endpoint: `/api/v2/agent/sessions/${session.id}/analyze`,
          pause_endpoint: `/api/v2/agent/sessions/${session.id}/pause`,
          resume_endpoint: `/api/v2/agent/sessions/${session.id}/resume`,
          end_endpoint: `/api/v2/agent/sessions/${session.id}/end`,
          max_chunk_duration_ms: 60000,
        },
        proof: proof ? serializeProof(proof) : null,
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("[v2/sessions] POST error:", err);
    return errorResponse(500, "internal_error", "Internal server error");
  }
}
