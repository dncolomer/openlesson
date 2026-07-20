import { NextRequest, NextResponse } from "next/server";
import {
  ileTokenFromPowBody,
  requireSessionWorkspaceProofOfWorkAccess,
} from "@/lib/pow-api/workspace-session-access";
import {
  buildIleSpeechSegmentPayload,
  ILE_SPEECH_TOOL_NAME,
  type IleSpeechSegmentEvent,
} from "@/lib/ile-thought-traces";
import { uploadFileToXAI } from "@/lib/xai-files";
import { countWorkspaceProofOfWorkForPlan } from "@/lib/pow-api/workspace-proof-of-work";
import { withProofOfWorkApiResponse } from "@/lib/pow-api/predictive-interruption";

export const runtime = "nodejs";
export const maxDuration = 30;

const SPEECH_EVENTS = new Set<IleSpeechSegmentEvent>(["start", "stop"]);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const workspaceId = body.workspaceId ? String(body.workspaceId) : "";
    const sessionId = body.sessionId ? String(body.sessionId) : "";
    const event = String(body.event || "") as IleSpeechSegmentEvent;
    const segmentDurationMs =
      typeof body.segmentDurationMs === "number" ? Math.max(0, Math.trunc(body.segmentDurationMs)) : undefined;
    const transcriptSnapshot = body.transcriptSnapshot ? String(body.transcriptSnapshot).trim() : undefined;
    const timestampMs = typeof body.timestampMs === "number" ? body.timestampMs : Date.now();

    if (!workspaceId || !sessionId) {
      return NextResponse.json({ error: "workspaceId and sessionId are required" }, { status: 400 });
    }
    if (!SPEECH_EVENTS.has(event)) {
      return NextResponse.json({ error: "event must be start or stop" }, { status: 400 });
    }

    const access = await requireSessionWorkspaceProofOfWorkAccess(workspaceId, sessionId, {
      ileToken: ileTokenFromPowBody(body as Record<string, unknown>),
    });
    if (access instanceof NextResponse) return access;

    const payload = buildIleSpeechSegmentPayload({
      event,
      sessionId,
      workspaceId,
      segmentDurationMs,
      transcriptSnapshot,
      timestampMs,
    });

    const fileName = `ile-speech-${event}-${sessionId}-${timestampMs}.json`;
    const base64 = Buffer.from(JSON.stringify(payload, null, 2), "utf8").toString("base64");
    const uploaded = await uploadFileToXAI(fileName, "application/json", base64);

    const metadata = {
      session_id: sessionId,
      event,
      segment_duration_ms: segmentDurationMs ?? null,
      transcript_snapshot: transcriptSnapshot || null,
    };

    const { data: row, error } = await access.supabase
      .from("workspace_proof_of_work")
      .insert({
        workspace_id: workspaceId,
        session_id: sessionId,
        proof_of_work_type: "tool",
        file_name: fileName,
        mime_type: "application/json",
        file_size: Buffer.byteLength(JSON.stringify(payload), "utf8"),
        xai_file_id: uploaded.file_id,
        timestamp_ms: timestampMs,
        chunk_index: 0,
        metadata,
        tool_name: ILE_SPEECH_TOOL_NAME,
        tool_action: `speech_${event}`,
        user_id: access.userId,
        organization_id: access.workspace.organization_id,
      })
      .select("id, xai_file_id, timestamp_ms, metadata, tool_action")
      .single();

    if (error || !row) {
      return NextResponse.json({ error: error?.message || "Failed to store ILE speech segment" }, { status: 500 });
    }

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
    return NextResponse.json({ error: message }, { status: 500 });
  }
}