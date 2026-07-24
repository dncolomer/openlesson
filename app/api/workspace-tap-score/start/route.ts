import { NextRequest, NextResponse } from "next/server";
import {
  loadTapScoreBriefForAccess,
  resolveTapSessionAccess,
} from "@/lib/tap-score-session-auth";
import { generateTapOpeningQuestion } from "@/lib/tap-score";
import { entryQueryParamsFromBody } from "@/lib/guest-link-access";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const privateToken = body.privateToken ? String(body.privateToken) : "";
    const workspaceId = body.workspaceId ? String(body.workspaceId) : "";
    const blockId = body.blockId ? String(body.blockId) : null;
    const focusSessionId = body.sessionId ? String(body.sessionId) : null;
    const minutes = Math.max(1, Number(body.minutes || 15));
    const tapSessionId = body.tapSessionId ? String(body.tapSessionId) : "";

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
    const requestedOpeningQuestion = body.openingQuestion ? String(body.openingQuestion).trim() : "";
    const openingQuestion = requestedOpeningQuestion || (await generateTapOpeningQuestion(brief, minutes));

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
          requested_duration_seconds: minutes * 60,
          transcript: [],
          summary: null,
          analysis: {},
          overall_score: null,
          marker_scores: [],
          block_id: blockId || access.blockId,
          session_id: focusSessionId || access.focusSessionId,
        })
        .eq("id", access.existingSession.id);

      return NextResponse.json({ tapSessionId: access.existingSession.id, openingQuestion });
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
        requested_duration_seconds: minutes * 60,
        status: "in_progress",
        started_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (error || !row) {
      return NextResponse.json({ error: error?.message || "Could not start TAP session" }, { status: 500 });
    }

    return NextResponse.json({ tapSessionId: row.id, openingQuestion });
  } catch (error) {
    console.error("[workspace-tap-score/start] Error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}