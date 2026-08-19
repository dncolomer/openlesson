import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-error-envelope";
import { authContextFromTapAccess, resolveTapSessionAccess } from "@/lib/tap-score-session-auth";
import { uploadWorkspaceProofOfWork } from "@/lib/pow-api/upload-workspace-proof-of-work";
import { TAP_IDLE_TOOL_NAME } from "@/lib/tap-idle-proof-of-work";
import {
  buildTutoringIdleOutcome,
  resolveTutoringContext,
} from "@/lib/tutoring-runtime";
import { uploadFileToXAI } from "@/lib/xai-files";
import { countWorkspaceProofOfWorkForPlan } from "@/lib/pow-api/workspace-proof-of-work";
import { withProofOfWorkApiResponse } from "@/lib/pow-api/predictive-interruption";
import {stampSourceLinkMetadata, entryQueryParamsFromBody} from "@/lib/guest-link-access";
import { isTapPracticeRequest, stampPoWPracticeFlag } from "@/lib/tap-practice";

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
    const practice = isTapPracticeRequest(body.practice);
    const idleDurationMs =
      typeof body.idleDurationMs === "number" ? Math.max(0, Math.trunc(body.idleDurationMs)) : 60_000;
    const hasPendingTranscription = Boolean(body.hasPendingTranscription);
    const timestampMs = typeof body.timestampMs === "number" ? body.timestampMs : Date.now();

    if (!tapSessionId) {
      return jsonError(400, "tapSessionId is required");
    }

    const access = await resolveTapSessionAccess({
      privateToken,
      workspaceId,
      tapSessionId,
      blockId,
      focusSessionId,
      entryQueryParams: entryQueryParamsFromBody(body as Record<string, unknown>),
    });
    if ("error" in access) {
      return jsonError(access.status, access.error);
    }

    const payload = stampPoWPracticeFlag(
      buildTutoringIdleOutcome(
        resolveTutoringContext({
          product: "tap",
          modality: practice ? "solo" : "dialog",
          authKind: "tap",
          workspaceId: access.workspaceId,
          sessionId: access.tapSessionId,
          blockId: blockId || access.blockId,
        }),
        {
          idleDurationMs,
          hasPendingTranscription,
          timestampMs,
        },
      ).payload,
      practice,
    );

    const fileName = `tap-idle-${access.tapSessionId}-${timestampMs}.json`;
    const base64 = Buffer.from(JSON.stringify(payload, null, 2), "utf8").toString("base64");

    const metadata = stampPoWPracticeFlag(
      stampSourceLinkMetadata(
        {
          tap_session_id: access.tapSessionId,
          idle_duration_ms: idleDurationMs,
          has_pending_transcription: hasPendingTranscription,
        },
        { kind: "tap", linkId: access.tapSessionId },
      ),
      practice,
    );

    const { data: workspace } = await access.supabase
      .from("workspaces")
      .select("id, user_id, organization_id")
      .eq("id", access.workspaceId)
      .single();
    if (!workspace) {
      return jsonError(404, "Workspace not found");
    }
    const row = await uploadWorkspaceProofOfWork(
      access.supabase,
      authContextFromTapAccess(access, "tap-idle"),
      workspace,
      {
        workspaceId: access.workspaceId,
        type: "tool",
        mime_type: "application/json",
        data: base64,
        block_id: blockId || access.blockId,
        session_id: focusSessionId || access.focusSessionId,
        file_name: fileName,
        timestamp_ms: timestampMs,
        tool_name: TAP_IDLE_TOOL_NAME,
        tool_action: "idle_heartbeat",
        metadata,
      },
    );

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
    return jsonError(500, message);
  }
}