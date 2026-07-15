import { NextRequest, NextResponse } from "next/server";
import { resolveTapSessionAccess } from "@/lib/tap-score-session-auth";
import { hashPrivateToken } from "@/lib/tap-score";
import {
  buildTapTranscriptPayload,
  TAP_TRANSCRIPT_TOOL_NAME,
} from "@/lib/tap-score-traces";
import { uploadWorkspaceProofOfWork } from "@/lib/agent-v2/upload-workspace-proof-of-work";
import type { AuthContext } from "@/lib/agent-v2/types";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const privateToken = body.privateToken ? String(body.privateToken) : "";
    const workspaceId = body.workspaceId ? String(body.workspaceId) : "";
    const transcript = Array.isArray(body.transcript) ? body.transcript : [];
    const durationSeconds = Number(body.durationSeconds || 0);
    const requestedDurationSeconds = Number(body.requestedDurationSeconds || 0);
    const blockId = body.blockId ? String(body.blockId) : null;
    const focusSessionId = body.sessionId ? String(body.sessionId) : null;
    const tapSessionId = body.tapSessionId ? String(body.tapSessionId) : "";

    if (transcript.length === 0) {
      return NextResponse.json({ error: "transcript is required" }, { status: 400 });
    }

    const access = await resolveTapSessionAccess({
      privateToken,
      workspaceId,
      tapSessionId,
      blockId,
      focusSessionId,
    });
    if ("error" in access) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }

    const resolvedTapSessionId = access.tapSessionId;
    if (!resolvedTapSessionId) {
      return NextResponse.json({ error: "tapSessionId is required" }, { status: 400 });
    }

    const { data: workspace } = await access.supabase
      .from("workspaces")
      .select("id, user_id, organization_id")
      .eq("id", access.workspaceId)
      .single();

    if (!workspace) {
      return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
    }

    const auth: AuthContext = {
      user_id: access.userId,
      guest_user_id: access.guestUserId,
      organization_id: access.organizationId,
      is_org_admin: false,
      key_id: "tap-complete",
      scopes: ["workspaces:write"],
    };

    const transcriptPayload = buildTapTranscriptPayload({
      tapSessionId: resolvedTapSessionId,
      workspaceId: access.workspaceId,
      blockId: blockId || access.blockId,
      focusSessionId: focusSessionId || access.focusSessionId,
      transcript: transcript.map((entry: { role?: string; text?: string; content?: string; at?: string }) => ({
        role: String(entry.role || "unknown"),
        text: String(entry.text || entry.content || ""),
        at: entry.at ? String(entry.at) : undefined,
      })),
      durationSeconds,
    });

    const transcriptJson = JSON.stringify(transcriptPayload, null, 2);
    await uploadWorkspaceProofOfWork(access.supabase, auth, workspace, {
      workspaceId: access.workspaceId,
      type: "tool",
      mime_type: "application/json",
      data: Buffer.from(transcriptJson, "utf8").toString("base64"),
      block_id: blockId || access.blockId,
      session_id: focusSessionId || access.focusSessionId,
      file_name: `tap-transcript-${resolvedTapSessionId}.json`,
      timestamp_ms: Date.now(),
      tool_name: TAP_TRANSCRIPT_TOOL_NAME,
      tool_action: "complete",
      metadata: {
        tap_session_id: resolvedTapSessionId,
        duration_seconds: durationSeconds,
        message_count: transcript.length,
      },
    });

    const completedAt = new Date().toISOString();
    const existingRequested =
      typeof access.existingSession?.requested_duration_seconds === "number"
        ? access.existingSession.requested_duration_seconds
        : null;
    const resolvedRequestedDuration =
      requestedDurationSeconds > 0 ? requestedDurationSeconds : existingRequested ?? 900;

    const sessionPayload = {
      duration_seconds: durationSeconds,
      requested_duration_seconds: resolvedRequestedDuration,
      status: "completed",
      completed_at: completedAt,
    };

    const query = access.existingSession
      ? access.supabase
          .from("workspace_tap_sessions")
          .update(sessionPayload)
          .eq("id", resolvedTapSessionId)
      : access.supabase.from("workspace_tap_sessions").insert({
          workspace_id: access.workspaceId,
          user_id: access.userId,
          guest_user_id: access.guestUserId,
          organization_id: access.organizationId,
          duration_seconds: durationSeconds,
          requested_duration_seconds: resolvedRequestedDuration,
          block_id: blockId || access.blockId,
          session_id: focusSessionId || access.focusSessionId,
          status: "completed",
          completed_at: completedAt,
          private_token_hash: privateToken ? hashPrivateToken(privateToken) : null,
        });

    const { data: row, error: writeError } = await query
      .select("id, workspace_id, block_id, session_id, status, completed_at")
      .single();

    if (writeError) {
      console.error("[workspace-tap-score/complete] Write error:", writeError);
      return NextResponse.json({ error: writeError.message }, { status: 500 });
    }

    if (access.completionWebhookUrl) {
      void fetch(access.completionWebhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event: "tap_session.completed",
          workspace_id: access.workspaceId,
          tap_session_id: resolvedTapSessionId,
          guest_user_id: access.guestUserId,
          assigned_user_id: access.assignedUserId,
          completed_at: completedAt,
          duration_seconds: durationSeconds,
        }),
      }).catch((webhookError) => {
        console.error("[workspace-tap-score/complete] Webhook error:", webhookError);
      });
    }

    return NextResponse.json({
      workspaceId: access.workspaceId,
      tapSession: row,
      postSession: access.postSession,
      redirectUrl: access.redirectUrl,
    });
  } catch (error) {
    console.error("[workspace-tap-score/complete] Error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    const status = message === "Not authenticated" ? 401 : message === "Not authorized" ? 403 : 500;
    return NextResponse.json({ error: message }, { status: status });
  }
}