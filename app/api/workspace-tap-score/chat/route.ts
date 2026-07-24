import { NextRequest, NextResponse } from "next/server";
import { callXai, systemMessage, userMessage } from "@/lib/xai-client";
import { buildTapScoreInstructions, TapScoreMode } from "@/lib/tap-score";
import { buildTapSelectiveThoughtSystemPrompt } from "@/lib/prompt-kernel/surfaces/tap";
import {
  loadTapScoreBriefForAccess,
  resolveTapSessionAccess,
} from "@/lib/tap-score-session-auth";
import {
  buildTapChatExchangePayload,
  TAP_CHAT_TOOL_NAME,
} from "@/lib/tap-score-traces";
import { uploadFileToXAI } from "@/lib/xai-files";
import { countWorkspaceProofOfWorkForPlan } from "@/lib/pow-api/workspace-proof-of-work";
import { withProofOfWorkApiResponse } from "@/lib/pow-api/predictive-interruption";
import { buildTapInProgressPatch } from "@/lib/tap-started-at";
import { stampSourceLinkMetadata } from "@/lib/guest-link-access";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const privateToken = body.privateToken ? String(body.privateToken) : "";
    let workspaceId = String(body.workspaceId || "");
    let mode = "curious" as TapScoreMode;
    let minutes = Number(body.minutes || 15);
    let focusNodeIds = Array.isArray(body.focusNodeIds) ? body.focusNodeIds.filter(Boolean) : [];
    const blockId = body.blockId ? String(body.blockId) : null;
    let focusSessionId = body.sessionId ? String(body.sessionId) : null;
    const tapSessionId = body.tapSessionId ? String(body.tapSessionId) : "";
    const messages = Array.isArray(body.messages) ? body.messages : [];
    const latestThought = String(body.thought || "").trim();

    if (!latestThought) return NextResponse.json({ error: "thought is required" }, { status: 400 });

    // Always resolve access first (enforces assigned_user_id when present).
    const access = await resolveTapSessionAccess({
      privateToken: privateToken || undefined,
      workspaceId: workspaceId || undefined,
      tapSessionId: tapSessionId || undefined,
      blockId,
      focusSessionId,
    });

    if ("error" in access) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }

    workspaceId = access.workspaceId;
    focusSessionId = access.focusSessionId;
    if (access.blockId && !focusNodeIds.includes(access.blockId)) {
      focusNodeIds = [access.blockId, ...focusNodeIds];
    }

    const existing = access.existingSession as {
      status?: string | null;
      started_at?: string | null;
      requested_duration_seconds?: number | null;
      focus_block_ids?: string[] | null;
      session_id?: string | null;
    } | null;

    if (privateToken && access.tapSessionId) {
      const patch = buildTapInProgressPatch(existing);
      await access.supabase
        .from("workspace_tap_sessions")
        .update(patch)
        .eq("id", access.tapSessionId);

      mode = "curious";
      minutes = Math.max(1, Math.round((existing?.requested_duration_seconds || 900) / 60));
      if (Array.isArray(existing?.focus_block_ids) && existing!.focus_block_ids!.length > 0) {
        focusNodeIds = existing!.focus_block_ids as string[];
      }
      if (existing?.session_id) focusSessionId = existing.session_id;
    }

    if (!workspaceId) return NextResponse.json({ error: "workspaceId is required" }, { status: 400 });
    if (blockId && !focusNodeIds.includes(blockId)) focusNodeIds = [blockId, ...focusNodeIds];

    // Shared brief loader: owner for guest/assigned private links (not participant userId).
    // PoW insert below uses access.userId / access.guestUserId for attribution.
    const { brief } = await loadTapScoreBriefForAccess(access, focusNodeIds, focusSessionId);

    const context = buildTapScoreInstructions(brief, mode, minutes);
    const history = messages
      .slice(-12)
      .map((message: { role?: string; content?: string }) =>
        `${message.role === "assistant" ? "Helios" : "Learner"}: ${String(message.content || "").slice(0, 2000)}`
      )
      .join("\n\n");

    const response = await callXai([
      systemMessage(buildTapSelectiveThoughtSystemPrompt(context)),
      userMessage(`Conversation so far:\n${history || "None"}\n\nLatest submitted thought:\n${latestThought}`),
    ], {
      maxTokens: 500,
      temperature: 0.55,
      fetchTimeout: 60000,
    });

    if (!response.success || !response.data) {
      return NextResponse.json({ error: response.error || "Failed to generate TAP response" }, { status: 500 });
    }

    const heliosReply = response.data;
    let proofOfWorkCount = 0;

    // Fail closed: when a TAP session is in play, PoW must be recorded or we error.
    if (access.tapSessionId) {
      const timestampMs = Date.now();
      const payload = buildTapChatExchangePayload({
        tapSessionId: access.tapSessionId,
        workspaceId: access.workspaceId,
        blockId: blockId || access.blockId,
        focusSessionId: focusSessionId || access.focusSessionId,
        learnerThought: latestThought,
        heliosReply,
        timestampMs,
      });

      const fileName = `tap-chat-${access.tapSessionId}-${timestampMs}.json`;
      const base64 = Buffer.from(JSON.stringify(payload, null, 2), "utf8").toString("base64");
      let uploaded: { file_id: string };
      try {
        uploaded = await uploadFileToXAI(fileName, "application/json", base64);
      } catch (err) {
        console.error("[workspace-tap-score/chat] PoW upload failed:", err);
        return NextResponse.json(
          { error: err instanceof Error ? err.message : "Failed to store proof of work" },
          { status: 502 }
        );
      }

      const { error: insertError } = await access.supabase.from("workspace_proof_of_work").insert({
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
        metadata: stampSourceLinkMetadata(
          {
            tap_session_id: access.tapSessionId,
            learner_thought: latestThought,
            helios_reply: heliosReply,
          },
          { kind: "tap", linkId: access.tapSessionId },
        ),
        tool_name: TAP_CHAT_TOOL_NAME,
        tool_action: "chat_exchange",
        user_id: access.userId,
        guest_user_id: access.guestUserId,
        organization_id: access.organizationId,
      });

      if (insertError) {
        console.error("[workspace-tap-score/chat] PoW insert failed:", insertError);
        return NextResponse.json({ error: "Failed to store proof of work" }, { status: 500 });
      }

      proofOfWorkCount = await countWorkspaceProofOfWorkForPlan(access.supabase, access.workspaceId);
    }

    return NextResponse.json(
      await withProofOfWorkApiResponse(
        { message: heliosReply },
        {
          endpoint: "upload_tap_chat",
          workspace_id: workspaceId,
          block_id: blockId,
          proof_of_work_artifacts: proofOfWorkCount,
          tool_name: TAP_CHAT_TOOL_NAME,
          artifact_summary: latestThought
            ? `Learner: "${latestThought.slice(0, 400)}" → Helios: "${heliosReply.slice(0, 400)}"`
            : `Helios: "${heliosReply.slice(0, 500)}"`,
          artifact_metadata: {
            learner_thought: latestThought || null,
            helios_reply: heliosReply,
          },
        },
      ),
    );
  } catch (error) {
    console.error("[workspace-tap-score/chat] Error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    const status = message === "Not authenticated" ? 401 : message === "Not authorized" ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
