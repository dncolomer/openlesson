import { NextRequest, NextResponse } from "next/server";
import { ayclTokenFromBody,
  ileTokenFromBody, guardSessionRoute } from "@/lib/api/require-auth";
import { callXaiText, systemMessage, userMessage, DEFAULT_MODEL, RECOMMENDED_TEMPS } from "@/lib/xai-client";
import { withConversationLanguageInstruction } from "@/lib/tutoring-languages";

export const runtime = "nodejs";
export const maxDuration = 30;

function sanitizeAssistantText(text: string) {
  return text
    .replace(/<system-reminder>[\s\S]*?<\/system-reminder>/gi, "")
    .replace(/<\/?(?:system|developer|assistant|user|tool|system-reminder)[^>]*>/gi, "")
    .replace(/```(?:system|developer|tool|assistant|user)[\s\S]*?```/gi, "")
    .trim();
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId, problem, tutoringLanguage } = body as {
      sessionId?: string;
      problem?: string;
      tutoringLanguage?: string;
    };
    if (!sessionId || !problem) {
      return NextResponse.json({ error: "Missing sessionId or problem" }, { status: 400 });
    }

    const auth = await guardSessionRoute(sessionId, {
      ayclToken: ayclTokenFromBody(body as Record<string, unknown>), ileToken: ileTokenFromBody(body as Record<string, unknown>),
      requireSessionId: true,
    });
    if (!auth.ok) return auth.response;
    const { user, supabase } = auth;

    const { data: currentSession } = await supabase
      .from("sessions")
      .select("id, user_id, problem, metadata")
      .eq("id", sessionId)
      .single();

    if (!currentSession) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }

    const workspaceId = typeof currentSession.metadata?.workspace_id === "string"
      ? currentSession.metadata.workspace_id
      : null;

    const { data: recentSessions } = workspaceId
      ? await supabase
        .from("sessions")
        .select("problem, report, duration_ms, created_at, metadata")
        .eq("user_id", user.id)
        .neq("id", sessionId)
        .filter("metadata->>workspace_id", "eq", workspaceId)
        .order("created_at", { ascending: false })
        .limit(4)
      : { data: [] };

    const recentContext = (recentSessions || [])
      .map((session, index) => {
        const report = typeof session.report === "string" ? session.report.slice(0, 400) : "";
        return `${index + 1}. ${session.problem}${report ? ` — ${report}` : ""}`;
      })
      .join("\n") || "No prior completed sessions available.";

    const { buildIleWelcomeSystemPrompt } = await import("@/lib/prompt-kernel/surfaces/ile");
    const welcomeSystem = withConversationLanguageInstruction(
      `${buildIleWelcomeSystemPrompt()}

Rules:
- 2 short paragraphs maximum.
- Sound personal and welcoming, not generic.
- If prior sessions are relevant, lightly connect to them without sounding creepy or over-specific.
- Mention the current topic naturally.
- End with one gentle invitation to resume practice (question or next-step prompt).
- Do not say you reviewed private data; just sound like you remember the learning journey.`,
      tutoringLanguage,
    );
    const response = await callXaiText([
      systemMessage(welcomeSystem),
      userMessage(`Current session topic: ${problem}\n\nRecent sessions:\n${recentContext}`),
    ], {
      model: DEFAULT_MODEL,
      maxTokens: 180,
      temperature: RECOMMENDED_TEMPS.chat,
    });

    if (!response.success || !response.data) {
      return NextResponse.json({ error: response.error || "Welcome generation failed" }, { status: 500 });
    }

    const message = sanitizeAssistantText(response.data);
    if (!message) {
      return NextResponse.json({ error: "Welcome generation returned empty message" }, { status: 500 });
    }

    return NextResponse.json({ message });
  } catch (error) {
    console.error("Session chat welcome error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
