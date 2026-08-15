import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-error-envelope";
import { callXai, systemMessage, userMessage } from "@/lib/xai-client";
import { buildTapScoreInstructions, TapScoreMode } from "@/lib/tap-score";
import { buildTapSelectiveThoughtSystemPrompt } from "@/lib/prompt-kernel/surfaces/tap";
import {
  authContextFromTapAccess,
  loadTapScoreBriefForAccess,
  resolveTapSessionAccess,
} from "@/lib/tap-score-session-auth";
import { uploadWorkspaceProofOfWork } from "@/lib/pow-api/upload-workspace-proof-of-work";
import {
  buildTapChatExchangePayload,
  TAP_CHAT_TOOL_NAME,
} from "@/lib/tap-score-traces";
import { countWorkspaceProofOfWorkForPlan } from "@/lib/pow-api/workspace-proof-of-work";
import { withProofOfWorkApiResponse } from "@/lib/pow-api/predictive-interruption";
import { buildTapInProgressPatch } from "@/lib/tap-started-at";
import {stampSourceLinkMetadata, entryQueryParamsFromBody} from "@/lib/guest-link-access";
import { isTapPracticeRequest, stampPoWPracticeFlag } from "@/lib/tap-practice";
import { withConversationLanguageInstruction } from "@/lib/tutoring-languages";

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
    const practice = isTapPracticeRequest(body.practice);
    const messages = Array.isArray(body.messages) ? body.messages : [];
    const latestThought = String(body.thought || "").trim();
    // Same selector as TAP briefing speech language (client conversationLanguage).
    const conversationLanguage =
      body.conversationLanguage != null
        ? String(body.conversationLanguage)
        : body.tutoringLanguage != null
          ? String(body.tutoringLanguage)
          : body.language != null
            ? String(body.language)
            : "";

    if (!latestThought) return jsonError(400, "thought is required");

    // Always resolve access first (enforces assigned_user_id when present).
    const access = await resolveTapSessionAccess({
      privateToken: privateToken || undefined,
      workspaceId: workspaceId || undefined,
      tapSessionId: tapSessionId || undefined,
      blockId,
      focusSessionId,
      entryQueryParams: entryQueryParamsFromBody(body as Record<string, unknown>),
    });

    if ("error" in access) {
      return jsonError(access.status, access.error);
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

    if (!workspaceId) return jsonError(400, "workspaceId is required");
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

    const systemPrompt = withConversationLanguageInstruction(
      buildTapSelectiveThoughtSystemPrompt(context, { practice }),
      conversationLanguage,
    );

    const response = await callXai([
      systemMessage(systemPrompt),
      userMessage(`Conversation so far:\n${history || "None"}\n\nLatest submitted thought:\n${latestThought}`),
    ], {
      maxTokens: practice ? 280 : 500,
      temperature: practice ? 0.4 : 0.55,
      fetchTimeout: 60000,
    });

    if (!response.success || !response.data) {
      return jsonError(500, response.error || "Failed to generate TAP response");
    }

    const heliosReply = response.data;
    let proofOfWorkCount = 0;

    // Fail closed: when a TAP session is in play, PoW must be recorded or we error.
    if (access.tapSessionId) {
      const timestampMs = Date.now();
      const payload = stampPoWPracticeFlag(
        buildTapChatExchangePayload({
          tapSessionId: access.tapSessionId,
          workspaceId: access.workspaceId,
          blockId: blockId || access.blockId,
          focusSessionId: focusSessionId || access.focusSessionId,
          learnerThought: latestThought,
          heliosReply,
          timestampMs,
        }),
        practice,
      );

      const fileName = `tap-chat-${access.tapSessionId}-${timestampMs}.json`;
      const base64 = Buffer.from(JSON.stringify(payload, null, 2), "utf8").toString("base64");
      const chatMetadata = stampPoWPracticeFlag(
        stampSourceLinkMetadata(
          {
            tap_session_id: access.tapSessionId,
            learner_thought: latestThought,
            helios_reply: heliosReply,
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
      try {
        await uploadWorkspaceProofOfWork(
          access.supabase,
          authContextFromTapAccess(access, "tap-chat"),
          workspace,
          {
            workspaceId: access.workspaceId,
            type: "tool",
            mime_type: "application/json",
            data: base64,
            block_id: blockId || access.blockId,
            session_id: focusSessionId || access.focusSessionId,
            file_name: fileName,
            timestamp_ms: timestampMs,
            tool_name: TAP_CHAT_TOOL_NAME,
            tool_action: "chat_exchange",
            metadata: chatMetadata,
          },
        );
      } catch (err) {
        console.error("[workspace-tap-score/chat] PoW upload failed:", err);
        return jsonError(502, err instanceof Error ? err.message : "Failed to store proof of work");
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
    return jsonError(status, message);
  }
}
