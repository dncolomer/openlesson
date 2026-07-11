import { NextRequest, NextResponse } from "next/server";
import { resolveGhlSessionAccess } from "@/lib/ghl-score-session-auth";
import {
  buildGhlThoughtTracePayload,
  GHL_TRACE_TOOL_NAME,
  type GhlSystem1Action,
  type GhlSystem2Action,
  type GhlTraceType,
} from "@/lib/ghl-score-traces";
import { uploadFileToXAI } from "@/lib/xai-files";

export const runtime = "nodejs";
export const maxDuration = 30;

const SYSTEM1_ACTIONS = new Set<GhlSystem1Action>(["crystallize", "pause_finalize"]);
const SYSTEM2_ACTIONS = new Set<GhlSystem2Action>(["send", "skip", "select", "deselect", "resend"]);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const privateToken = body.privateToken ? String(body.privateToken) : "";
    const workspaceId = body.workspaceId ? String(body.workspaceId) : "";
    const blockId = body.blockId ? String(body.blockId) : null;
    const focusSessionId = body.sessionId ? String(body.sessionId) : null;
    const ghlSessionId = String(body.ghlSessionId || "");
    const traceType = String(body.traceType || "") as GhlTraceType;
    const action = String(body.action || "");
    const thoughtId = body.thoughtId ? String(body.thoughtId) : undefined;
    const thoughtIds = Array.isArray(body.thoughtIds) ? body.thoughtIds.map(String).filter(Boolean) : undefined;
    const chainId = body.chainId ? String(body.chainId) : undefined;
    const text = body.text ? String(body.text).trim() : undefined;
    const combined = Boolean(body.combined);
    const timestampMs = typeof body.timestampMs === "number" ? body.timestampMs : Date.now();

    if (!ghlSessionId) {
      return NextResponse.json({ error: "ghlSessionId is required" }, { status: 400 });
    }
    if (traceType !== "system1" && traceType !== "system2") {
      return NextResponse.json({ error: "traceType must be system1 or system2" }, { status: 400 });
    }
    if (traceType === "system1" && !SYSTEM1_ACTIONS.has(action as GhlSystem1Action)) {
      return NextResponse.json({ error: "Invalid system1 action" }, { status: 400 });
    }
    if (traceType === "system2" && !SYSTEM2_ACTIONS.has(action as GhlSystem2Action)) {
      return NextResponse.json({ error: "Invalid system2 action" }, { status: 400 });
    }

    const access = await resolveGhlSessionAccess({
      privateToken,
      workspaceId,
      ghlSessionId,
      blockId,
      focusSessionId,
    });
    if ("error" in access) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }

    const payload = buildGhlThoughtTracePayload({
      traceType,
      action: action as GhlSystem1Action | GhlSystem2Action,
      ghlSessionId: access.ghlSessionId,
      workspaceId: access.workspaceId,
      blockId: blockId || access.blockId,
      focusSessionId: focusSessionId || access.focusSessionId,
      thoughtId,
      thoughtIds,
      chainId,
      text,
      combined,
      timestampMs,
    });

    const fileName = `ghl-trace-${traceType}-${action}-${thoughtId || timestampMs}.json`;
    const base64 = Buffer.from(JSON.stringify(payload, null, 2), "utf8").toString("base64");
    const uploaded = await uploadFileToXAI(fileName, "application/json", base64);

    const metadata = {
      ghl_session_id: access.ghlSessionId,
      trace_type: traceType,
      action,
      thought_id: thoughtId || null,
      thought_ids: thoughtIds || null,
      chain_id: chainId || null,
      text: text || null,
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
        tool_name: GHL_TRACE_TOOL_NAME,
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

    return NextResponse.json({ trace: row }, { status: 201 });
  } catch (error) {
    console.error("[workspace-tap-score/trace] Error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}