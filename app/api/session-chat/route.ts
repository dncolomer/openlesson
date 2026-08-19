import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-error-envelope";
import { buildImageContent, callXaiText, systemMessage, userMessage, DEFAULT_MODEL, RECOMMENDED_TEMPS } from "@/lib/xai-client";
import { withConversationLanguageInstruction } from "@/lib/tutoring-languages";
import { ayclTokenFromBody,
  ileTokenFromBody, guardSessionRoute } from "@/lib/api/require-auth";
import { buildIleHeliosChatSystemPrompt } from "@/lib/prompt-kernel/surfaces/ile";
import { ileChapterSuggestionPowFromCoachText } from "@/lib/ile-chapter-depth";
import { resolveIleDurableSessionMode } from "@/lib/ile-mode";
import { powAttributionColumnsFromIds } from "@/lib/session-participant-identity";
import { uploadWorkspaceProofOfWork } from "@/lib/pow-api/upload-workspace-proof-of-work";
import {
  buildIleSessionChatPowFile,
  ILE_SESSION_CHAT_POW_TOOL_ACTION,
  ILE_SESSION_CHAT_POW_TOOL_NAME,
  resolveIleSessionChatPowUpload,
} from "@/lib/ile-session-chat-pow";

function sanitizeAssistantText(text: string) {
  return text
    .replace(/<system-reminder>[\s\S]*?<\/system-reminder>/gi, "")
    .replace(/<\/?(?:system|developer|assistant|user|tool|system-reminder)[^>]*>/gi, "")
    .replace(/```(?:system|developer|tool|assistant|user)[\s\S]*?```/gi, "")
    .trim();
}

function imageDataUrlToImageInput(dataUrl: string) {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return null;
  return { mimeType: match[1], data: match[2] };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { problem, messages, model, sessionId, tutoringLanguage: bodyLanguage, activeStepIndex, activeStepId, activeStepDescription, sessionPlan } = body;

    if (!problem) {
      return jsonError(400, "Missing problem");
    }

    const ayclToken = ayclTokenFromBody(body);
    const ileToken = ileTokenFromBody(body);
    const auth = await guardSessionRoute(sessionId, {
      ayclToken,
      ileToken,
      // Cookie-auth chat is always session-bound in product UI.
      requireSessionId: !ayclToken && !ileToken,
    });
    if (!auth.ok) return auth.response;
    const { supabase } = auth;

    // Tutoring language from body or session metadata. Mode is the same
    // durable source as the ILE shell (link/prop, then metadata).
    let tutoringLanguage = bodyLanguage;
    let sessionMeta: Record<string, unknown> | null = null;
    if (sessionId) {
      const { data: sessionData } = await supabase
        .from("sessions")
        .select("metadata")
        .eq("id", sessionId)
        .single();
      sessionMeta = (sessionData?.metadata as Record<string, unknown> | undefined) ?? null;
      if (!tutoringLanguage && sessionMeta?.tutoringLanguage) {
        tutoringLanguage = sessionMeta.tutoringLanguage;
      }
    }
    const sessionMode = resolveIleDurableSessionMode({
      metadata: sessionMeta,
    });
    const systemPrompt = withConversationLanguageInstruction(
      buildIleHeliosChatSystemPrompt(sessionMode),
      tutoringLanguage,
    );

    const inputMessages = (messages || []) as Array<{ role: string; content: string; imageDataUrl?: string }>;
    const planContext = sessionPlan?.steps?.length
      ? `Full session plan:\n${sessionPlan.steps.map((step: { id?: string; description?: string; status?: string }, index: number) => `${index + 1}. [${step.status || "pending"}] ${step.description || ""}${step.id === activeStepId ? " (focused)" : ""}`).join("\n")}`
      : "";
    const activeChapterContext = activeStepDescription
      ? `The current message is about focused Chapter ${(activeStepIndex ?? 0) + 1}: ${activeStepDescription}. Use this chapter as the local focus, but you may use the whole session plan as context.`
      : "";
    const conversationMessages = [
      systemMessage(systemPrompt),
      userMessage(`The user is working on: ${problem}`),
      ...(planContext ? [userMessage(planContext)] : []),
      ...(activeChapterContext ? [userMessage(activeChapterContext)] : []),
      ...inputMessages.map((m, index) => {
        const isLatestMessage = index === inputMessages.length - 1;
        const image = isLatestMessage && m.role === "user" && m.imageDataUrl
          ? imageDataUrlToImageInput(m.imageDataUrl)
          : null;
        return {
          role: m.role as "user" | "assistant",
          content: image ? buildImageContent(m.content, image) : m.content,
        };
      }),
    ];

    const response = await callXaiText(
      conversationMessages,
      {
        model: model || DEFAULT_MODEL,
        maxTokens: 400,
        temperature: RECOMMENDED_TEMPS.chat,
      }
    );

    if (!response.success || !response.data) {
      console.error("Session chat API error:", response.error);
      return jsonError(500, `API error: ${response.error}`);
    }

    const lastLearner =
      [...inputMessages].reverse().find((m) => m.role === "user")?.content ?? "";
    const extracted = ileChapterSuggestionPowFromCoachText({
      coachText: sanitizeAssistantText(response.data),
      learnerText: lastLearner,
      sessionMode,
      currentChapterId: typeof activeStepId === "string" ? activeStepId : null,
      currentChapterDescription:
        typeof activeStepDescription === "string" ? activeStepDescription : null,
      via: "helios_dialog",
    });

    const metaWorkspaceId =
      typeof sessionMeta?.workspace_id === "string" ? sessionMeta.workspace_id : "";
    const powTarget = resolveIleSessionChatPowUpload({
      sessionId,
      workspaceId: metaWorkspaceId,
    });
    if (powTarget.persist) {
      try {
        const { data: workspace } = await supabase
          .from("workspaces")
          .select("id, user_id, organization_id")
          .eq("id", powTarget.workspaceId)
          .maybeSingle();
        if (!workspace) {
          console.error("[session-chat] PoW workspace missing; returning coach reply");
        } else {
          const attribution = powAttributionColumnsFromIds({
            userId: auth.subjectId,
            guestUserId: auth.guestUserId,
          });
          const file = buildIleSessionChatPowFile({
            sessionId: powTarget.sessionId,
            workspaceId: powTarget.workspaceId,
            learnerText: lastLearner,
            assistantText: extracted.visibleText,
          });
          await uploadWorkspaceProofOfWork(
            supabase,
            {
              user_id: attribution.user_id,
              guest_user_id: attribution.guest_user_id,
              organization_id:
                typeof workspace.organization_id === "string"
                  ? workspace.organization_id
                  : null,
              is_org_admin: false,
              key_id: "ile-session-chat",
              scopes: ["workspaces:write"],
            },
            workspace,
            {
              workspaceId: powTarget.workspaceId,
              type: "tool",
              mime_type: "application/json",
              data: file.base64,
              session_id: powTarget.sessionId,
              file_name: file.fileName,
              timestamp_ms: file.timestampMs,
              tool_name: ILE_SESSION_CHAT_POW_TOOL_NAME,
              tool_action: ILE_SESSION_CHAT_POW_TOOL_ACTION,
              metadata: {
                session_id: powTarget.sessionId,
                via: "helios_dialog",
                chapter_suggest: extracted.toolData ?? null,
              },
            },
          );
        }
      } catch (err) {
        console.error("[session-chat] PoW upload failed:", err);
      }
    }

    return NextResponse.json({
      message: extracted.visibleText,
      chapterSuggestion: extracted.toolData,
    });
  } catch (error) {
    console.error("Session chat error:", error);
    return jsonError(500, "Internal server error");
  }
}
