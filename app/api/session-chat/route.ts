import { NextRequest, NextResponse } from "next/server";
import { buildImageContent, callXaiText, systemMessage, userMessage, DEFAULT_MODEL, RECOMMENDED_TEMPS } from "@/lib/xai-client";
import { getLanguageName } from "@/lib/tutoring-languages";
import { ayclTokenFromBody, guardSessionRoute } from "@/lib/api/require-auth";
import { buildIleHeliosChatSystemPrompt } from "@/lib/prompt-kernel/surfaces/ile";

const BASE_SYSTEM_PROMPT = buildIleHeliosChatSystemPrompt();

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
      return NextResponse.json({ error: "Missing problem" }, { status: 400 });
    }

    const auth = await guardSessionRoute(sessionId, { ayclToken: ayclTokenFromBody(body) });
    if (!auth.ok) return auth.response;
    const { supabase } = auth;

    // Get tutoring language from body or session metadata
    let tutoringLanguage = bodyLanguage;
    if (!tutoringLanguage && sessionId) {
      const { data: sessionData } = await supabase
        .from("sessions")
        .select("metadata")
        .eq("id", sessionId)
        .single();
      if (sessionData?.metadata?.tutoringLanguage) {
        tutoringLanguage = sessionData.metadata.tutoringLanguage;
      }
    }
    const languageName = tutoringLanguage ? getLanguageName(tutoringLanguage) : undefined;

    const systemPrompt = languageName 
      ? `IMPORTANT: Respond in ${languageName} throughout.\n\n${BASE_SYSTEM_PROMPT}`
      : BASE_SYSTEM_PROMPT;

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
      return NextResponse.json({ error: `API error: ${response.error}` }, { status: 500 });
    }

    return NextResponse.json({ message: sanitizeAssistantText(response.data) });
  } catch (error) {
    console.error("Session chat error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
