import { NextRequest, NextResponse } from "next/server";
import {
  ileTokenFromPowBody,
  requireSessionWorkspaceProofOfWorkAccess,
} from "@/lib/pow-api/workspace-session-access";
import { buildIleIdleHeartbeatPayload, ILE_IDLE_TOOL_NAME } from "@/lib/ile-thought-traces";
import { uploadFileToXAI } from "@/lib/xai-files";
import { countWorkspaceProofOfWorkForPlan } from "@/lib/pow-api/workspace-proof-of-work";
import { withProofOfWorkApiResponse } from "@/lib/pow-api/predictive-interruption";
import { entryQueryParamsFromBody, stampSourceLinkMetadata } from "@/lib/guest-link-access";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const workspaceId = body.workspaceId ? String(body.workspaceId) : "";
    const sessionId = body.sessionId ? String(body.sessionId) : "";
    const idleDurationMs =
      typeof body.idleDurationMs === "number" ? Math.max(0, Math.trunc(body.idleDurationMs)) : 60_000;
    const hasPendingTranscription = Boolean(body.hasPendingTranscription);
    const timestampMs = typeof body.timestampMs === "number" ? body.timestampMs : Date.now();

    if (!workspaceId || !sessionId) {
      return NextResponse.json({ error: "workspaceId and sessionId are required" }, { status: 400 });
    }

    const access = await requireSessionWorkspaceProofOfWorkAccess(workspaceId, sessionId, {
      ileToken: ileTokenFromPowBody(body as Record<string, unknown>),
      entryQueryParams: entryQueryParamsFromBody(body as Record<string, unknown>),
    });
    if (access instanceof NextResponse) return access;

    const payload = buildIleIdleHeartbeatPayload({
      sessionId,
      workspaceId,
      idleDurationMs,
      hasPendingTranscription,
      timestampMs,
    });

    const fileName = `ile-idle-${sessionId}-${timestampMs}.json`;
    const base64 = Buffer.from(JSON.stringify(payload, null, 2), "utf8").toString("base64");
    const uploaded = await uploadFileToXAI(fileName, "application/json", base64);

    const baseMetadata = {
      session_id: sessionId,
      idle_duration_ms: idleDurationMs,
      has_pending_transcription: hasPendingTranscription,
    };
    const metadata = access.ileLinkId
      ? stampSourceLinkMetadata(baseMetadata, { kind: "ile", linkId: access.ileLinkId })
      : baseMetadata;

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
        tool_name: ILE_IDLE_TOOL_NAME,
        tool_action: "idle_heartbeat",
        user_id: access.userId,
        guest_user_id: access.auth.guest_user_id,
        organization_id: access.workspace.organization_id,
      })
      .select("id, xai_file_id, timestamp_ms, metadata, tool_action")
      .single();

    if (error || !row) {
      return NextResponse.json({ error: error?.message || "Failed to store ILE idle heartbeat" }, { status: 500 });
    }

    const proofOfWorkCount = await countWorkspaceProofOfWorkForPlan(access.supabase, workspaceId);

    return NextResponse.json(
      await withProofOfWorkApiResponse(
        { idle: row },
        {
          endpoint: "upload_ile_idle",
          workspace_id: workspaceId,
          proof_of_work_artifacts: proofOfWorkCount,
          tool_name: ILE_IDLE_TOOL_NAME,
          idle_duration_ms: idleDurationMs,
          artifact_summary: `No learner action for ${Math.round(idleDurationMs / 1000)}s${hasPendingTranscription ? " (transcription pending)" : ""}`,
          artifact_metadata: metadata,
        },
      ),
      { status: 201 },
    );
  } catch (error) {
    console.error("[workspace-ile/idle] Error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}