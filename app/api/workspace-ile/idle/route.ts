import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-error-envelope";
import {
  ileTokenFromPowBody,
  requireSessionWorkspaceProofOfWorkAccess,
} from "@/lib/pow-api/workspace-session-access";
import { ILE_IDLE_TOOL_NAME } from "@/lib/ile-thought-traces";
import {
  buildTutoringIdleOutcome,
  resolveTutoringContext,
} from "@/lib/tutoring-runtime";
import { countWorkspaceProofOfWorkForPlan } from "@/lib/pow-api/workspace-proof-of-work";
import { uploadWorkspaceProofOfWork } from "@/lib/pow-api/upload-workspace-proof-of-work";
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
      return jsonError(400, "workspaceId and sessionId are required");
    }

    const access = await requireSessionWorkspaceProofOfWorkAccess(workspaceId, sessionId, {
      ileToken: ileTokenFromPowBody(body as Record<string, unknown>),
      entryQueryParams: entryQueryParamsFromBody(body as Record<string, unknown>),
    });
    if (access instanceof NextResponse) return access;
    const participantUserId = access.auth.guest_user_id ? null : access.auth.user_id;
    void participantUserId;

    const payload = buildTutoringIdleOutcome(
      resolveTutoringContext({
        product: "ile",
        modality: "dialog",
        authKind: access.ileLinkId ? "ile" : "cookie",
        workspaceId,
        sessionId,
      }),
      {
        idleDurationMs,
        hasPendingTranscription,
        timestampMs,
      },
    ).payload;

    const fileName = `ile-idle-${sessionId}-${timestampMs}.json`;
    const base64 = Buffer.from(JSON.stringify(payload, null, 2), "utf8").toString("base64");

    const baseMetadata = {
      session_id: sessionId,
      idle_duration_ms: idleDurationMs,
      has_pending_transcription: hasPendingTranscription,
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
        tool_name: ILE_IDLE_TOOL_NAME,
        tool_action: "idle_heartbeat",
        metadata,
      },
    );

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
    return jsonError(500, message);
  }
}