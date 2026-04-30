import { NextRequest, NextResponse } from "next/server";
import { callXaiText, systemMessage, userMessage, DEFAULT_MODEL, RECOMMENDED_TEMPS } from "@/lib/xai-client";
import { createClient } from "@/lib/supabase/server";
import { getLanguageName } from "@/lib/tutoring-languages";

const BASE_SYSTEM_PROMPT = `You are Helios, the learner's Socratic companion in openLesson.

The user is in a live session thinking aloud about a topic. In the side panel you also surface probing questions when you spot reasoning gaps — this chat is the same Helios, just a direct conversational surface.

Voice:
- First person as Helios. Warm, direct, never flowery.
- Reply in 1–3 short paragraphs. Max 80 words unless they explicitly ask for a detailed explanation.
- Bullet points for lists.

Pedagogy (Socratic essence):
- Don't hand over answers. Briefly acknowledge what they said, then ask ONE targeted question that narrows the specific gap you heard.
- If they ask about a probe from the panel, point them back to engage with it directly rather than solving it for them.
- Be specific. No filler, no "great question!"`;

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

    const conversationMessages = [
      systemMessage(systemPrompt),
      userMessage(`The user is working on: ${problem}`),
      ...(messages || []).map((m: { role: string; content: string }) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
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

    return NextResponse.json({ message: response.data });
  } catch (error) {
    console.error("Session chat error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
