import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-error-envelope";
import { resolveTapSessionAccess } from "@/lib/tap-score-session-auth";
import {
  buildTapThoughtTracePayload,
  TAP_TRACE_TOOL_NAME,
  type TapSystem1Action,
  type TapSystem2Action,
  type TapTraceType,
} from "@/lib/tap-score-traces";
import { uploadFileToXAI } from "@/lib/xai-files";
import {
  checkProofOfWorkSchema,
  countWorkspaceProofOfWorkForPlan,
  insertWorkspaceProofOfWorkRow,
} from "@/lib/pow-api/workspace-proof-of-work";
import { withProofOfWorkApiResponse } from "@/lib/pow-api/predictive-interruption";
import {stampSourceLinkMetadata, entryQueryParamsFromBody} from "@/lib/guest-link-access";
import { isTapPracticeRequest, stampPoWPracticeFlag } from "@/lib/tap-practice";

export const runtime = "nodejs";
export const maxDuration = 30;

const SYSTEM1_ACTIONS = new Set<TapSystem1Action>([
  "crystallize",
  "pause_finalize",
  "auto_stash",
]);
const SYSTEM2_ACTIONS = new Set<TapSystem2Action>([
  "send",
  "skip",
  "select",
  "deselect",
  "resend",
  "edit",
  "remove",
  "end_of_chain_of_thought",
]);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const privateToken = body.privateToken ? String(body.privateToken) : "";
    const workspaceId = body.workspaceId ? String(body.workspaceId) : "";
    const blockId = body.blockId ? String(body.blockId) : null;
    const focusSessionId = body.sessionId ? String(body.sessionId) : null;
    const tapSessionId = String(body.tapSessionId || "");
    const practice = isTapPracticeRequest(body.practice);
    const traceType = String(body.traceType || "") as TapTraceType;
    const action = String(body.action || "");
    const thoughtId = body.thoughtId ? String(body.thoughtId) : undefined;
    const thoughtIds = Array.isArray(body.thoughtIds) ? body.thoughtIds.map(String).filter(Boolean) : undefined;
    const chainId = body.chainId ? String(body.chainId) : undefined;
    const text = body.text ? String(body.text).trim() : undefined;
    const originalText = body.originalText ? String(body.originalText).trim() : undefined;
    const combined = Boolean(body.combined);
    const timestampMs = typeof body.timestampMs === "number" ? body.timestampMs : Date.now();

    if (!tapSessionId) {
      return jsonError(400, "tapSessionId is required");
    }
    if (traceType !== "system1" && traceType !== "system2") {
      return jsonError(400, "traceType must be system1 or system2");
    }
    if (traceType === "system1" && !SYSTEM1_ACTIONS.has(action as TapSystem1Action)) {
      return jsonError(400, "Invalid system1 action");
    }
    if (traceType === "system2" && !SYSTEM2_ACTIONS.has(action as TapSystem2Action)) {
      return jsonError(400, "Invalid system2 action");
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
      buildTapThoughtTracePayload({
        traceType,
        action: action as TapSystem1Action | TapSystem2Action,
        tapSessionId: access.tapSessionId,
        workspaceId: access.workspaceId,
        blockId: blockId || access.blockId,
        focusSessionId: focusSessionId || access.focusSessionId,
        thoughtId,
        thoughtIds,
        chainId,
        text,
        originalText,
        combined,
        timestampMs,
      }),
      practice,
    );

    const fileName = `tap-trace-${traceType}-${action}-${thoughtId || timestampMs}.json`;
    const base64 = Buffer.from(JSON.stringify(payload, null, 2), "utf8").toString("base64");
    const schema = checkProofOfWorkSchema({
      type: "tool",
      mime_type: "application/json",
      data: base64,
    });
    if (!schema.ok) {
      return jsonError(400, schema.message);
    }
    const uploaded = await uploadFileToXAI(fileName, schema.mime_type, schema.data);

    const metadata = stampPoWPracticeFlag(
      stampSourceLinkMetadata(
        {
          tap_session_id: access.tapSessionId,
          trace_type: traceType,
          action,
          thought_id: thoughtId || null,
          thought_ids: thoughtIds || null,
          chain_id: chainId || null,
          text: text || null,
          original_text: originalText || null,
          combined,
        },
        { kind: "tap", linkId: access.tapSessionId },
      ),
      practice,
    );

    const { row, error } = await insertWorkspaceProofOfWorkRow(access.supabase, {
      workspace_id: access.workspaceId,
      block_id: blockId || access.blockId,
      session_id: focusSessionId || access.focusSessionId,
      proof_of_work_type: schema.type,
      pow_model_version: schema.pow_model_version,
      file_name: fileName,
      mime_type: schema.mime_type,
      file_size: Buffer.byteLength(JSON.stringify(payload), "utf8"),
      xai_file_id: uploaded.file_id,
      timestamp_ms: timestampMs,
      chunk_index: 0,
      metadata,
      tool_name: TAP_TRACE_TOOL_NAME,
      tool_action: `${traceType}:${action}`,
      user_id: access.guestUserId ? null : access.userId,
      guest_user_id: access.guestUserId,
      organization_id: access.organizationId,
    });

    if (error || !row) {
      return jsonError(500, error?.message || "Failed to store TAP trace");
    }

    const proofOfWorkCount = await countWorkspaceProofOfWorkForPlan(access.supabase, access.workspaceId);

    return NextResponse.json(
      await withProofOfWorkApiResponse(
        { trace: row },
        {
          endpoint: "upload_tap_trace",
          workspace_id: access.workspaceId,
          block_id: blockId || access.blockId,
          proof_of_work_artifacts: proofOfWorkCount,
          tool_name: TAP_TRACE_TOOL_NAME,
          tap_action: `${traceType}:${action}`,
          artifact_summary: text
            ? `${traceType}:${action} — "${text.slice(0, 500)}"`
            : `${traceType}:${action}${originalText ? ` (edited from "${originalText.slice(0, 200)}")` : ""}`,
          artifact_metadata: metadata,
        },
      ),
      { status: 201 },
    );
  } catch (error) {
    console.error("[workspace-tap-score/trace] Error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return jsonError(500, message);
  }
}