import { NextRequest, NextResponse } from "next/server";
import { buildImageContent, callXaiText, systemMessage, userMessage, DEFAULT_MODEL, RECOMMENDED_TEMPS } from "@/lib/xai-client";
import { createClient } from "@/lib/supabase/server";
import { getLanguageName } from "@/lib/tutoring-languages";

const BASE_SYSTEM_PROMPT = `You are Helios, the learner's Socratic companion in openLesson.

The user is in a live session thinking aloud about a topic. Your probing questions and the user's replies flow directly in this chat.

Voice:
- First person as Helios. Warm, direct, never flowery.
- Reply in 1–3 short paragraphs. Max 80 words unless they explicitly ask for a detailed explanation.
- Bullet points for lists.

Pedagogy (Socratic essence):
- Don't hand over answers. Briefly acknowledge what they said, then ask ONE targeted question that narrows the specific gap you heard.
- If they ask about a guiding question, keep it conversational and help them reason through the next step without giving the answer away.
- If they ask for detailed explanation, background, definitions, examples, or a full walkthrough, suggest using the Grok / Grokipedia tool for the deeper explanation, then coming back here to continue the conversation and reason through it together.
- Be specific. No filler, no "great question!"`;

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
    const { problem, messages, model, sessionId, tutoringLanguage: bodyLanguage } = body;

    if (!problem) {
      return NextResponse.json({ error: "Missing problem" }, { status: 400 });
    }

    // Get tutoring language from body or session metadata
    let tutoringLanguage = bodyLanguage;
    if (!tutoringLanguage && sessionId) {
      const supabase = await createClient();
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
    const conversationMessages = [
      systemMessage(systemPrompt),
      userMessage(`The user is working on: ${problem}`),
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
