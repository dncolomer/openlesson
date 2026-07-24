import { NextRequest, NextResponse } from "next/server";
import { uploadWorkspaceProofOfWork } from "@/lib/pow-api/upload-workspace-proof-of-work";
import {
  ileTokenFromPowBody,
  requireSessionWorkspaceProofOfWorkAccess,
} from "@/lib/pow-api/workspace-session-access";
import { countWorkspaceProofOfWorkForPlan } from "@/lib/pow-api/workspace-proof-of-work";
import { withProofOfWorkApiResponse } from "@/lib/pow-api/predictive-interruption";
import { resolvePowInterruptionContext } from "@/lib/pow-interruption-resolver";
import { entryQueryParamsFromBody, stampSourceLinkMetadata } from "@/lib/guest-link-access";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const workspaceId = typeof body.workspaceId === "string" ? body.workspaceId : "";
    if (!workspaceId) {
      return NextResponse.json({ error: "workspaceId is required" }, { status: 400 });
    }

    const sessionId =
      typeof body.session_id === "string"
        ? body.session_id
        : typeof body.sessionId === "string"
          ? body.sessionId
          : null;
    const access = await requireSessionWorkspaceProofOfWorkAccess(workspaceId, sessionId, {
      ileToken: ileTokenFromPowBody(body),
      entryQueryParams: entryQueryParamsFromBody(body),
    });
    if (access instanceof NextResponse) return access;

    const base64 = typeof body.data === "string" ? body.data : "";
    if (!base64) {
      return NextResponse.json({ error: "data (base64) is required" }, { status: 400 });
    }

    const toolName = typeof body.tool_name === "string" ? body.tool_name : undefined;
    const toolAction = typeof body.tool_action === "string" ? body.tool_action : undefined;
    const rawMetadata =
      body.metadata && typeof body.metadata === "object" && !Array.isArray(body.metadata)
        ? (body.metadata as Record<string, unknown>)
        : { source: "ile_session" };
    const metadata =
      access.ileLinkId
        ? stampSourceLinkMetadata(rawMetadata, { kind: "ile", linkId: access.ileLinkId })
        : rawMetadata;

    const row = await uploadWorkspaceProofOfWork(
      access.supabase,
      access.auth,
      {
        id: workspaceId,
        user_id: access.workspace.user_id,
        organization_id: access.workspace.organization_id,
      },
      {
        workspaceId,
        type: typeof body.type === "string" ? body.type : "tool",
        mime_type: typeof body.mime_type === "string" ? body.mime_type : "application/json",
        data: base64,
        block_id: typeof body.block_id === "string" ? body.block_id : null,
        session_id: sessionId,
        file_name: typeof body.file_name === "string" ? body.file_name : undefined,
        timestamp_ms: typeof body.timestamp_ms === "number" ? body.timestamp_ms : Date.now(),
        tool_name: toolName,
        tool_action: toolAction,
        metadata,
      },
    );

    const proofOfWorkCount = await countWorkspaceProofOfWorkForPlan(access.supabase, workspaceId);

    const interruptionContext = resolvePowInterruptionContext({
      workspaceId,
      blockId: typeof body.block_id === "string" ? body.block_id : null,
      toolName,
      toolAction,
      proofOfWorkCount,
      artifact_summary: toolName ? `${toolName}${toolAction ? `:${toolAction}` : ""}` : null,
      artifact_metadata: metadata,
      idle_duration_ms:
        typeof metadata.idle_duration_ms === "number" ? metadata.idle_duration_ms : null,
      speech_transcript:
        typeof metadata.transcript_snapshot === "string" ? metadata.transcript_snapshot : null,
    });

    const payload = interruptionContext
      ? await withProofOfWorkApiResponse(
          {
            proof_of_work: {
              ...row,
              type: row.type,
            },
          },
          interruptionContext,
        )
      : {
          proof_of_work: {
            ...row,
            type: row.type,
          },
          interruption: null,
        };

    return NextResponse.json(payload, { status: 201 });
  } catch (error) {
    console.error("[workspace/proof-of-work] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to upload proof of work" },
      { status: 500 },
    );
  }
}