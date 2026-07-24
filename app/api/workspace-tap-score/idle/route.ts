import { NextRequest, NextResponse } from "next/server";
import { resolveTapSessionAccess } from "@/lib/tap-score-session-auth";
import { buildTapIdleHeartbeatPayload, TAP_IDLE_TOOL_NAME } from "@/lib/tap-idle-proof-of-work";
import { uploadFileToXAI } from "@/lib/xai-files";
import { countWorkspaceProofOfWorkForPlan } from "@/lib/pow-api/workspace-proof-of-work";
import { withProofOfWorkApiResponse } from "@/lib/pow-api/predictive-interruption";
import { stampSourceLinkMetadata } from "@/lib/guest-link-access";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const privateToken = body.privateToken ? String(body.privateToken) : "";
    const workspaceId = body.workspaceId ? String(body.workspaceId) : "";
    const blockId = body.blockId ? String(body.blockId) : null;
    const focusSessionId = body.sessionId ? String(body.sessionId) : null;
    const tapSessionId = String(body.tapSessionId || "");
    const idleDurationMs =
      typeof body.idleDurationMs === "number" ? Math.max(0, Math.trunc(body.idleDurationMs)) : 60_000;
    const hasPendingTranscription = Boolean(body.hasPendingTranscription);
    const timestampMs = typeof body.timestampMs === "number" ? body.timestampMs : Date.now();

    if (!tapSessionId) {
      return NextResponse.json({ error: "tapSessionId is required" }, { status: 400 });
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

    const payload = buildTapIdleHeartbeatPayload({
      tapSessionId: access.tapSessionId,
      workspaceId: access.workspaceId,
      blockId: blockId || access.blockId,
      focusSessionId: focusSessionId || access.focusSessionId,
      idleDurationMs,
      hasPendingTranscription,
      timestampMs,
    });

    const fileName = `tap-idle-${access.tapSessionId}-${timestampMs}.json`;
    const base64 = Buffer.from(JSON.stringify(payload, null, 2), "utf8").toString("base64");
    const uploaded = await uploadFileToXAI(fileName, "application/json", base64);

    const metadata = stampSourceLinkMetadata(
      {
        tap_session_id: access.tapSessionId,
        idle_duration_ms: idleDurationMs,
        has_pending_transcription: hasPendingTranscription,
      },
      { kind: "tap", linkId: access.tapSessionId },
    );

    const { data: row, error } = await access.supabase
      .from("workspace_proof_of_work")
      .insert({
        workspace_id: access.workspaceId,
        block_id: blockId || access.blockId,
        session_id: focusSessionId || access.focusSessionId,
        proof_of_work_type: "tool",
        file_name: fileName,
        mime_type: "application/json",
        file_size: Buffer.byteLength(JSON.stringify(payload), "utf8"),
        xai_file_id: uploaded.file_id,
        timestamp_ms: timestampMs,
        chunk_index: 0,
        metadata,
        tool_name: TAP_IDLE_TOOL_NAME,
        tool_action: "idle_heartbeat",
        user_id: access.userId,
        guest_user_id: access.guestUserId,
        organization_id: access.organizationId,
      })
      .select("id, xai_file_id, timestamp_ms, metadata, tool_action")
      .single();

    if (error || !row) {
      return NextResponse.json({ error: error?.message || "Failed to store TAP idle heartbeat" }, { status: 500 });
    }

    const proofOfWorkCount = await countWorkspaceProofOfWorkForPlan(access.supabase, access.workspaceId);

    return NextResponse.json(
      await withProofOfWorkApiResponse(
        { idle: row },
        {
          endpoint: "upload_tap_idle",
          workspace_id: access.workspaceId,
          block_id: blockId || access.blockId,
          proof_of_work_artifacts: proofOfWorkCount,
          tool_name: TAP_IDLE_TOOL_NAME,
          idle_duration_ms: idleDurationMs,
          artifact_summary: `No learner action for ${Math.round(idleDurationMs / 1000)}s${hasPendingTranscription ? " (transcription pending)" : ""}`,
          artifact_metadata: metadata,
        },
      ),
      { status: 201 },
    );
  } catch (error) {
    console.error("[workspace-tap-score/idle] Error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}