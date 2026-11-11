import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-error-envelope";
import { uploadWorkspaceProofOfWork } from "@/lib/pow-api/upload-workspace-proof-of-work";
import { countWorkspaceProofOfWorkForPlan } from "@/lib/pow-api/workspace-proof-of-work";
import { withProofOfWorkApiResponse } from "@/lib/pow-api/predictive-interruption";
import { resolvePowInterruptionContext } from "@/lib/pow-interruption-resolver";
import { stampSourceLinkMetadata } from "@/lib/guest-link-access";
import {
  requireSessionProofAccess,
  sessionProofAccessFromBody,
} from "@/lib/session-proof-access";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return jsonError(400, "Invalid JSON body");
    }

    const access = await requireSessionProofAccess(sessionProofAccessFromBody(body));
    if (access instanceof NextResponse) return access;

    const sessionId = access.sessionId;
    if (!sessionId) return jsonError(400, "sessionId is required");

    const base64 = typeof body.data === "string" ? body.data : "";
    if (!base64) {
      return jsonError(400, "data (base64) is required");
    }

    const toolName = typeof body.tool_name === "string" ? body.tool_name : undefined;
    const toolAction = typeof body.tool_action === "string" ? body.tool_action : undefined;
    const rawMetadata =
      body.metadata && typeof body.metadata === "object" && !Array.isArray(body.metadata)
        ? (body.metadata as Record<string, unknown>)
        : { source: "session" };
    const metadata = access.ileLinkId
      ? stampSourceLinkMetadata(rawMetadata, { kind: "learn", linkId: access.ileLinkId })
      : rawMetadata;
    const workspaceId = access.workspaceId;

    const row = await uploadWorkspaceProofOfWork(
      access.supabase,
      access.auth,
      access.workspace,
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
        pow_model_version:
          typeof body.pow_model_version === "string" ? body.pow_model_version : undefined,
        band_powers:
          body.band_powers && typeof body.band_powers === "object"
            ? (body.band_powers as Record<string, number>)
            : null,
        device_name: typeof body.device_name === "string" ? body.device_name : null,
        sample_count: typeof body.sample_count === "number" ? body.sample_count : null,
      },
    );

    const proofOfWorkCount = await countWorkspaceProofOfWorkForPlan(
      access.supabase,
      workspaceId || "",
    );

    const interruptionContext = resolvePowInterruptionContext({
      workspaceId: workspaceId || "",
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
    console.error("[session/proof-of-work] Error:", error);
    return jsonError(500, error instanceof Error ? error.message : "Failed to upload proof of work");
  }
}
