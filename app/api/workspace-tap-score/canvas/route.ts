import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-error-envelope";
import { authContextFromTapAccess, resolveTapSessionAccess } from "@/lib/tap-score-session-auth";
import { uploadWorkspaceProofOfWork } from "@/lib/pow-api/upload-workspace-proof-of-work";
import { countWorkspaceProofOfWorkForPlan } from "@/lib/pow-api/workspace-proof-of-work";
import { withProofOfWorkApiResponse } from "@/lib/pow-api/predictive-interruption";
import { stampSourceLinkMetadata, entryQueryParamsFromBody } from "@/lib/guest-link-access";
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
    const timestampMs = typeof body.timestampMs === "number" ? body.timestampMs : Date.now();
    const toolName = typeof body.tool_name === "string" ? body.tool_name : "canvas";
    const toolAction = typeof body.tool_action === "string" ? body.tool_action : "canvas_draw";
    const fileName =
      typeof body.file_name === "string" && body.file_name.trim()
        ? body.file_name
        : `tap-canvas-${toolName}-${toolAction}-${timestampMs}.json`;
    const payloadText =
      typeof body.payload === "string"
        ? body.payload
        : typeof body.data === "string"
          ? body.data
          : "";

    if (!tapSessionId) {
      return jsonError(400, "tapSessionId is required");
    }
    if (!payloadText) {
      return jsonError(400, "payload is required");
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

    const looksBase64 = /^[A-Za-z0-9+/]+=*$/.test(payloadText.replace(/\s/g, "")) && payloadText.length > 24;
    const base64 = looksBase64
      ? payloadText
      : Buffer.from(payloadText, "utf8").toString("base64");

    const metadata = stampPoWPracticeFlag(
      stampSourceLinkMetadata(
        {
          tap_session_id: access.tapSessionId,
          via: "excalidraw",
          ...(body.metadata && typeof body.metadata === "object" && !Array.isArray(body.metadata)
            ? (body.metadata as Record<string, unknown>)
            : {}),
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
      authContextFromTapAccess(access, "tap-canvas"),
      workspace,
      {
        workspaceId: access.workspaceId,
        type: "tool",
        mime_type: typeof body.mime_type === "string" ? body.mime_type : "application/json",
        data: base64,
        block_id: blockId || access.blockId,
        session_id: focusSessionId || access.focusSessionId,
        file_name: fileName,
        timestamp_ms: timestampMs,
        tool_name: toolName,
        tool_action: toolAction,
        metadata,
      },
    );

    const proofOfWorkCount = await countWorkspaceProofOfWorkForPlan(
      access.supabase,
      access.workspaceId,
    );

    return NextResponse.json(
      await withProofOfWorkApiResponse(
        { canvas: row },
        {
          endpoint: "upload_tap_canvas",
          workspace_id: access.workspaceId,
          block_id: blockId || access.blockId,
          proof_of_work_artifacts: proofOfWorkCount,
          tool_name: toolName,
          artifact_summary: `TAP Work canvas ${toolName}/${toolAction}`,
          artifact_metadata: metadata,
        },
      ),
      { status: 201 },
    );
  } catch (error) {
    console.error("[workspace-tap-score/canvas] Error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return jsonError(500, message);
  }
}
