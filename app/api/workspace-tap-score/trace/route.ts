import { NextRequest, NextResponse } from "next/server";
import { resolveTapSessionAccess } from "@/lib/tap-score-session-auth";
import {
  buildTapThoughtTracePayload,
  TAP_TRACE_TOOL_NAME,
  type TapSystem1Action,
  type TapSystem2Action,
  type TapTraceType,
} from "@/lib/tap-score-traces";
import { uploadFileToXAI } from "@/lib/xai-files";
import { countWorkspaceProofOfWorkForPlan } from "@/lib/pow-api/workspace-proof-of-work";
import { withProofOfWorkApiResponse } from "@/lib/pow-api/predictive-interruption";

export const runtime = "nodejs";
export const maxDuration = 30;

const SYSTEM1_ACTIONS = new Set<TapSystem1Action>(["crystallize", "pause_finalize"]);
const SYSTEM2_ACTIONS = new Set<TapSystem2Action>(["send", "skip", "select", "deselect", "resend", "edit"]);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const privateToken = body.privateToken ? String(body.privateToken) : "";
    const workspaceId = body.workspaceId ? String(body.workspaceId) : "";
    const blockId = body.blockId ? String(body.blockId) : null;
    const focusSessionId = body.sessionId ? String(body.sessionId) : null;
    const tapSessionId = String(body.tapSessionId || "");
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
      return NextResponse.json({ error: "tapSessionId is required" }, { status: 400 });
    }
    if (traceType !== "system1" && traceType !== "system2") {
      return NextResponse.json({ error: "traceType must be system1 or system2" }, { status: 400 });
    }
    if (traceType === "system1" && !SYSTEM1_ACTIONS.has(action as TapSystem1Action)) {
      return NextResponse.json({ error: "Invalid system1 action" }, { status: 400 });
    }
    if (traceType === "system2" && !SYSTEM2_ACTIONS.has(action as TapSystem2Action)) {
      return NextResponse.json({ error: "Invalid system2 action" }, { status: 400 });
    }

    const access = await resolveTapSessionAccess({
      privateToken,
      workspaceId,
      tapSessionId,
      blockId,
      focusSessionId,
    });
    if ("error" in access) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }

    const payload = buildTapThoughtTracePayload({
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
    });

    const fileName = `tap-trace-${traceType}-${action}-${thoughtId || timestampMs}.json`;
    const base64 = Buffer.from(JSON.stringify(payload, null, 2), "utf8").toString("base64");
    const uploaded = await uploadFileToXAI(fileName, "application/json", base64);

    const metadata = {
      tap_session_id: access.tapSessionId,
      trace_type: traceType,
      action,
      thought_id: thoughtId || null,
      thought_ids: thoughtIds || null,
      chain_id: chainId || null,
      text: text || null,
      original_text: originalText || null,
      combined,
    };

    const { data: row, error } = await access.supabase
      .from("workspace_proof_of_work")
      .insert({
        workspace_id: access.workspaceId,
        block_id: blockId || access.blockId,
        session_id: focusSessionId || access.focusSessionId,
        proof_of_work_type: "tool",
        file_name: fileName,
        mime_type: "application/json",
        file_size: Buffer.byteLength(JSON.stringify(payload), "utf8"),
        xai_file_id: uploaded.file_id,
        timestamp_ms: timestampMs,
        chunk_index: 0,
        metadata,
        tool_name: TAP_TRACE_TOOL_NAME,
        tool_action: `${traceType}:${action}`,
        user_id: access.userId,
        guest_user_id: access.guestUserId,
        organization_id: access.organizationId,
      })
      .select("id, xai_file_id, timestamp_ms, metadata, tool_action")
      .single();

    if (error || !row) {
      return NextResponse.json({ error: error?.message || "Failed to store TAP trace" }, { status: 500 });
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
    return NextResponse.json({ error: message }, { status: 500 });
  }
}