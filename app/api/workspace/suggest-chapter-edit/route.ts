import { NextRequest, NextResponse } from "next/server";
import { ayclTokenFromBody, guardSessionRoute } from "@/lib/api/require-auth";
import { callXaiJSON, systemMessage, userMessage, DEFAULT_MODEL } from "@/lib/xai-client";
import { buildWorkspacePerformanceContext } from "@/lib/agent-v2/performance-context";

interface SuggestChapterEditResponse {
  suggestions: string[];
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { sessionId, stepId, currentDescription, prompt, locale } = body;
    if (!sessionId || !stepId) {
      return NextResponse.json({ error: "sessionId and stepId are required" }, { status: 400 });
    }

    const auth = await guardSessionRoute(sessionId, { ayclToken: ayclTokenFromBody(body) });
    if (!auth.ok) return auth.response;

    const { user, supabase } = auth;

    const { data: session } = await supabase
      .from("sessions")
      .select("id, user_id, workspace_id, problem")
      .eq("id", sessionId)
      .single();
    if (!session || session.user_id !== user.id) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    const { data: planRow } = await supabase
      .from("session_plans")
      .select("steps, goal")
      .eq("session_id", sessionId)
      .single();

    const steps = (planRow?.steps || []) as Array<{ id: string; description: string }>;
    const chapterList = steps.map((s) => `- ${s.id === stepId ? "[editing] " : ""}${s.description}`).join("\n");

    let performanceNote = "No workspace performance context available.";
    if (session.workspace_id) {
      try {
        const ctx = await buildWorkspacePerformanceContext({
          supabase,
          auth: {
            user_id: user.id,
            guest_user_id: null,
            organization_id: null,
            is_org_admin: false,
            key_id: "web",
            scopes: ["workspaces:read"],
          },
          workspaceId: session.workspace_id,
        });
        performanceNote = `Evidence: ${ctx.payload.counts.proof_of_work_artifacts} proof-of-work artifacts, ${ctx.payload.counts.linked_sessions} linked sessions. Blocks: ${ctx.payload.blocks.map((b) => b.title).filter(Boolean).join(", ") || "none"}`;
      } catch {
        // optional context
      }
    }

    const languageNote =
      locale && locale !== "en" ? `Respond in ${locale}.` : "";

    const ai = await callXaiJSON<SuggestChapterEditResponse>(
      [
        systemMessage(
          'Suggest chapter description rewrites. Return JSON: { "suggestions": ["...", "...", "..."] } with exactly 3 options, each 1-2 sentences.',
        ),
        userMessage(`Session goal: ${planRow?.goal || session.problem}
Chapters:
${chapterList}

Current chapter text:
${currentDescription || "(empty)"}

User edit intent: ${prompt?.trim() || "Improve clarity and learning focus for this chapter."}

Performance context: ${performanceNote}
${languageNote}`),
      ],
      { model: DEFAULT_MODEL, maxTokens: 400, temperature: 0.6 },
    );

    if (!ai.success || !ai.data?.suggestions?.length) {
      return NextResponse.json({ error: "Failed to generate suggestions" }, { status: 502 });
    }

    return NextResponse.json({ suggestions: ai.data.suggestions.slice(0, 3) });
  } catch (error) {
    console.error("[suggest-chapter-edit]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}