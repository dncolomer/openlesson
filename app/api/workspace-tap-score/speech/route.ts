import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-error-envelope";
import { authContextFromTapAccess, resolveTapSessionAccess } from "@/lib/tap-score-session-auth";
import { uploadWorkspaceProofOfWork } from "@/lib/pow-api/upload-workspace-proof-of-work";
import {
  buildTapSpeechSegmentPayload,
  TAP_SPEECH_TOOL_NAME,
  type TapSpeechSegmentEvent,
} from "@/lib/tap-speech-proof-of-work";
import { uploadFileToXAI } from "@/lib/xai-files";
import { countWorkspaceProofOfWorkForPlan } from "@/lib/pow-api/workspace-proof-of-work";
import { withProofOfWorkApiResponse } from "@/lib/pow-api/predictive-interruption";
import {stampSourceLinkMetadata, entryQueryParamsFromBody} from "@/lib/guest-link-access";
import { isTapPracticeRequest, stampPoWPracticeFlag } from "@/lib/tap-practice";

export const runtime = "nodejs";
export const maxDuration = 30;

const SPEECH_EVENTS = new Set<TapSpeechSegmentEvent>(["start", "stop"]);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const privateToken = body.privateToken ? String(body.privateToken) : "";
    const workspaceId = body.workspaceId ? String(body.workspaceId) : "";
    const blockId = body.blockId ? String(body.blockId) : null;
    const focusSessionId = body.sessionId ? String(body.sessionId) : null;
    const tapSessionId = String(body.tapSessionId || "");
    const practice = isTapPracticeRequest(body.practice);
    const event = String(body.event || "") as TapSpeechSegmentEvent;
    const segmentDurationMs =
      typeof body.segmentDurationMs === "number" ? Math.max(0, Math.trunc(body.segmentDurationMs)) : undefined;
    const transcriptSnapshot = body.transcriptSnapshot ? String(body.transcriptSnapshot).trim() : undefined;
    const timestampMs = typeof body.timestampMs === "number" ? body.timestampMs : Date.now();

    if (!tapSessionId) {
      return jsonError(400, "tapSessionId is required");
    }
    if (!SPEECH_EVENTS.has(event)) {
      return jsonError(400, "event must be start or stop");
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
      buildTapSpeechSegmentPayload({
        event,
        tapSessionId: access.tapSessionId,
        workspaceId: access.workspaceId,
        blockId: blockId || access.blockId,
        focusSessionId: focusSessionId || access.focusSessionId,
        segmentDurationMs,
        transcriptSnapshot,
        timestampMs,
      }),
      practice,
    );

    const fileName = `tap-speech-${event}-${access.tapSessionId}-${timestampMs}.json`;
    const base64 = Buffer.from(JSON.stringify(payload, null, 2), "utf8").toString("base64");

    const metadata = stampPoWPracticeFlag(
      stampSourceLinkMetadata(
        {
          tap_session_id: access.tapSessionId,
          event,
          segment_duration_ms: segmentDurationMs ?? null,
          transcript_snapshot: transcriptSnapshot || null,
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
      authContextFromTapAccess(access, "tap-speech"),
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
        tool_name: TAP_SPEECH_TOOL_NAME,
        tool_action: `speech_${event}`,
        metadata,
      },
    );

    const proofOfWorkCount = await countWorkspaceProofOfWorkForPlan(access.supabase, access.workspaceId);

    return NextResponse.json(
      await withProofOfWorkApiResponse(
        { speech: row },
        {
          endpoint: "upload_tap_speech",
          workspace_id: access.workspaceId,
          block_id: blockId || access.blockId,
          proof_of_work_artifacts: proofOfWorkCount,
          tool_name: TAP_SPEECH_TOOL_NAME,
          tap_action: `speech_${event}`,
          speech_transcript: transcriptSnapshot || null,
          artifact_summary: transcriptSnapshot
            ? `Speech ${event} (${segmentDurationMs ?? "?"}ms): "${transcriptSnapshot.slice(0, 500)}"`
            : `Speech segment ${event}${segmentDurationMs ? ` after ${segmentDurationMs}ms` : ""}`,
          artifact_metadata: metadata,
        },
      ),
      { status: 201 },
    );
  } catch (error) {
    console.error("[workspace-tap-score/speech] Error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return jsonError(500, message);
  }
}