import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-error-envelope";
import {
  ileTokenFromPowBody,
  requireSessionWorkspaceProofOfWorkAccess,
} from "@/lib/pow-api/workspace-session-access";
import { ILE_SPEECH_TOOL_NAME } from "@/lib/ile-thought-traces";
import {
  buildTutoringSpeechOutcome,
  resolveTutoringContext,
} from "@/lib/tutoring-runtime";
import { countWorkspaceProofOfWorkForPlan } from "@/lib/pow-api/workspace-proof-of-work";
import { uploadWorkspaceProofOfWork } from "@/lib/pow-api/upload-workspace-proof-of-work";
import { withProofOfWorkApiResponse } from "@/lib/pow-api/predictive-interruption";
import { entryQueryParamsFromBody, stampSourceLinkMetadata } from "@/lib/guest-link-access";

export const runtime = "nodejs";
export const maxDuration = 30;

const SPEECH_EVENTS = new Set(["start", "stop"]);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const workspaceId = body.workspaceId ? String(body.workspaceId) : "";
    const sessionId = body.sessionId ? String(body.sessionId) : "";
    const event = String(body.event || "");
    const segmentDurationMs =
      typeof body.segmentDurationMs === "number" ? Math.max(0, Math.trunc(body.segmentDurationMs)) : undefined;
    const transcriptSnapshot = body.transcriptSnapshot ? String(body.transcriptSnapshot).trim() : undefined;
    const timestampMs = typeof body.timestampMs === "number" ? body.timestampMs : Date.now();

    if (!workspaceId || !sessionId) {
      return jsonError(400, "workspaceId and sessionId are required");
    }
    if (!SPEECH_EVENTS.has(event)) {
      return jsonError(400, "event must be start or stop");
    }

    const access = await requireSessionWorkspaceProofOfWorkAccess(workspaceId, sessionId, {
      ileToken: ileTokenFromPowBody(body as Record<string, unknown>),
      entryQueryParams: entryQueryParamsFromBody(body as Record<string, unknown>),
    });
    if (access instanceof NextResponse) return access;
    const participantUserId = access.auth.guest_user_id ? null : access.auth.user_id;
    void participantUserId;

    const outcome = buildTutoringSpeechOutcome(
      resolveTutoringContext({
        product: "ile",
        modality: "dialog",
        authKind: access.ileLinkId ? "ile" : "cookie",
        workspaceId,
        sessionId,
      }),
      {
        event: event === "stop" ? "stop" : "start",
        segmentDurationMs,
        transcriptSnapshot,
        timestampMs,
      },
    );
    const payload = outcome.payload;

    const fileName = `ile-speech-${event}-${sessionId}-${timestampMs}.json`;
    const base64 = Buffer.from(JSON.stringify(payload, null, 2), "utf8").toString("base64");

    const baseMetadata = {
      session_id: sessionId,
      event,
      segment_duration_ms: segmentDurationMs ?? null,
      transcript_snapshot: transcriptSnapshot || null,
    };
    const metadata = access.ileLinkId
      ? stampSourceLinkMetadata(baseMetadata, { kind: "ile", linkId: access.ileLinkId })
      : baseMetadata;

    const row = await uploadWorkspaceProofOfWork(
      access.supabase,
      access.auth,
      access.workspace,
      {
        workspaceId,
        type: "tool",
        mime_type: "application/json",
        data: base64,
        session_id: sessionId,
        file_name: fileName,
        timestamp_ms: timestampMs,
        tool_name: ILE_SPEECH_TOOL_NAME,
        tool_action: `speech_${event}`,
        metadata,
      },
    );

    const proofOfWorkCount = await countWorkspaceProofOfWorkForPlan(access.supabase, workspaceId);

    return NextResponse.json(
      await withProofOfWorkApiResponse(
        { speech: row },
        {
          endpoint: "upload_ile_speech",
          workspace_id: workspaceId,
          proof_of_work_artifacts: proofOfWorkCount,
          tool_name: ILE_SPEECH_TOOL_NAME,
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
    console.error("[workspace-ile/speech] Error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return jsonError(500, message);
  }
}