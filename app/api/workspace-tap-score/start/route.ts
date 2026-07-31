import { NextRequest, NextResponse } from "next/server";
import {
  loadTapScoreBriefForAccess,
  resolveTapSessionAccess,
} from "@/lib/tap-score-session-auth";
import { generateTapOpeningQuestion } from "@/lib/tap-score";
import { entryQueryParamsFromBody } from "@/lib/guest-link-access";
import {
  isTapPracticeRequest,
  resolveTapLiveMinutes,
  TAP_PRACTICE_DURATION_SECONDS,
} from "@/lib/tap-practice";
import {
  normalizeTapInteractionKind,
  resolveTapInteractionKindFromBody,
  type TapInteractionKind,
} from "@/lib/pow-api/tap-link-config";
import { looksLikeConversationalOpening } from "@/lib/exercise-tap";
import { generateTapExercisePrompt } from "@/lib/pow-api/tapbench-exercise-generate";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const privateToken = body.privateToken ? String(body.privateToken) : "";
    const workspaceId = body.workspaceId ? String(body.workspaceId) : "";
    const blockId = body.blockId ? String(body.blockId) : null;
    const focusSessionId = body.sessionId ? String(body.sessionId) : null;
    const practice = isTapPracticeRequest(body.practice);
    const minutes = resolveTapLiveMinutes({
      practice,
      minutes: Number(body.minutes || 15),
    });
    const requestedDurationSeconds = practice ? TAP_PRACTICE_DURATION_SECONDS : minutes * 60;
    const tapSessionId = body.tapSessionId ? String(body.tapSessionId) : "";
    const bodyInteractionKind = resolveTapInteractionKindFromBody(body as Record<string, unknown>);

    const access = await resolveTapSessionAccess({
      privateToken,
      workspaceId,
      tapSessionId,
      blockId,
      focusSessionId,
      entryQueryParams: entryQueryParamsFromBody(body as Record<string, unknown>),
    });
    if ("error" in access) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }

    const focusNodeIds = blockId ? [blockId] : access.blockId ? [access.blockId] : [];
    const resolvedFocusSessionId = focusSessionId || access.focusSessionId;
    // Brief as workspace owner; insert/PoW keep access.userId for participant attribution.
    const { brief } = await loadTapScoreBriefForAccess(
      access,
      focusNodeIds,
      resolvedFocusSessionId
    );

    // Prefer kind already stored on the link row; body can set it for owner starts.
    const existingKind = normalizeTapInteractionKind(
      (access.existingSession as { interaction_kind?: unknown } | null | undefined)?.interaction_kind,
    );
    const interactionKind: TapInteractionKind =
      access.existingSession?.id && existingKind === "exercise"
        ? "exercise"
        : access.existingSession?.id
          ? existingKind
          : bodyInteractionKind;

    const requestedOpeningQuestion = body.openingQuestion ? String(body.openingQuestion).trim() : "";
    let openingQuestion: string;

    if (interactionKind === "exercise") {
      // Solo exercise: LLM-authored concrete problem (same quality bar as TAPBench).
      // Not conversational "Teach me…" and not a topic-list template wrap.
      const focused = brief.nodes.length === 1 ? brief.nodes[0] : null;
      const explicitExercise =
        requestedOpeningQuestion && !looksLikeConversationalOpening(requestedOpeningQuestion)
          ? requestedOpeningQuestion
          : null;
      const generated = await generateTapExercisePrompt({
        exerciseText: explicitExercise,
        blockTitle: focused?.title,
        blockDescription: focused?.description,
        workspaceTitle: brief.plan.title,
        workspaceGoal: brief.plan.workspace_goal || brief.plan.description,
        workspaceDescription: brief.plan.description,
        notes: brief.plan.notes,
        rootTopic: brief.plan.root_topic,
        files: (brief.files || []).map((f) => ({
          name: f.name,
          mime_type: f.mime_type,
        })),
        durationSeconds: requestedDurationSeconds,
      });
      openingQuestion = generated.exercise;
    } else {
      // Conversational TAP already uses LLM opening generation.
      openingQuestion =
        requestedOpeningQuestion ||
        (await generateTapOpeningQuestion(brief, minutes, { practice }));
    }

    // Private TAP links are multi-use: reopening a completed link restarts a run
    // on the same row, preserving guest_user_id / assigned_user_id for identity.
    if (access.existingSession?.id) {
      await access.supabase
        .from("workspace_tap_sessions")
        .update({
          status: "in_progress",
          started_at: new Date().toISOString(),
          completed_at: null,
          duration_seconds: 0,
          requested_duration_seconds: requestedDurationSeconds,
          transcript: [],
          summary: null,
          analysis: {},
          overall_score: null,
          marker_scores: [],
          block_id: blockId || access.blockId,
          session_id: focusSessionId || access.focusSessionId,
        })
        .eq("id", access.existingSession.id);

      return NextResponse.json({
        tapSessionId: access.existingSession.id,
        openingQuestion,
        practice,
        minutes,
        interactionKind,
      });
    }

    if (privateToken) {
      return NextResponse.json({ error: "TAP session missing for private link" }, { status: 500 });
    }

    const { data: row, error } = await access.supabase
      .from("workspace_tap_sessions")
      .insert({
        workspace_id: access.workspaceId,
        user_id: access.userId,
        block_id: blockId,
        session_id: focusSessionId,
        requested_duration_seconds: requestedDurationSeconds,
        status: "in_progress",
        started_at: new Date().toISOString(),
        mode: "curious",
        interaction_kind: interactionKind,
      })
      .select("id")
      .single();

    if (error || !row) {
      return NextResponse.json({ error: error?.message || "Could not start TAP session" }, { status: 500 });
    }

    return NextResponse.json({
      tapSessionId: row.id,
      openingQuestion,
      practice,
      minutes,
      interactionKind,
    });
  } catch (error) {
    console.error("[workspace-tap-score/start] Error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}