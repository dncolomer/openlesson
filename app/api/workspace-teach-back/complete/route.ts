import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { callXaiJSON, systemMessage, userMessage } from "@/lib/xai-client";
import { getTeachBackBrief, TeachBackMode } from "@/lib/teach-back";

export const runtime = "nodejs";
export const maxDuration = 120;

interface TeachBackAnalysis {
  overall_reflection: string;
  what_was_clear: string[];
  where_reasoning_was_fuzzy: string[];
  terms_to_define_earlier: string[];
  connections_to_strengthen: string[];
  recommended_next_sessions: Array<{ node_id?: string; title: string; reason: string }>;
  follow_up_prompts: string[];
  confidence: "emerging" | "developing" | "clear" | "well-connected";
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const body = await req.json();
    const planId = String(body.planId || "");
    const transcript = Array.isArray(body.transcript) ? body.transcript : [];
    const durationSeconds = Number(body.durationSeconds || 0);
    const requestedDurationSeconds = Number(body.requestedDurationSeconds || 0);
    const mode = (body.mode || "curious") as TeachBackMode;
    const voice = String(body.voice || "ara");
    const focusNodeIds = Array.isArray(body.focusNodeIds) ? body.focusNodeIds.filter(Boolean) : [];
    const xaiConversationId = body.xaiConversationId ? String(body.xaiConversationId) : null;

    if (!planId) return NextResponse.json({ error: "planId is required" }, { status: 400 });
    if (transcript.length === 0) return NextResponse.json({ error: "transcript is required" }, { status: 400 });

    const { userId, brief } = await getTeachBackBrief(planId, focusNodeIds);
    const transcriptText = transcript
      .map((entry: any) => `${entry.role || "unknown"}: ${entry.text || entry.content || ""}`)
      .join("\n");

    const result = await callXaiJSON<TeachBackAnalysis>([
      systemMessage(`You create Teach Back reflections for OpenLesson. Be specific, educational, and non-judgmental. Do not grade like an exam. Return only JSON.`),
      userMessage(`Workspace: ${brief.plan.title}
Topic: ${brief.plan.root_topic}
Nodes: ${JSON.stringify(brief.nodes)}

Teach Back transcript:
${transcriptText}

Return JSON with:
{
  "overall_reflection": string,
  "what_was_clear": string[],
  "where_reasoning_was_fuzzy": string[],
  "terms_to_define_earlier": string[],
  "connections_to_strengthen": string[],
  "recommended_next_sessions": [{ "node_id": string optional, "title": string, "reason": string }],
  "follow_up_prompts": string[],
  "confidence": "emerging" | "developing" | "clear" | "well-connected"
}`),
    ], {
      maxTokens: 1800,
      temperature: 0.5,
      fetchTimeout: 120000,
    });

    if (!result.success || !result.data) {
      return NextResponse.json({ error: result.error || "Failed to generate reflection" }, { status: 500 });
    }

    const { data: row, error: insertError } = await supabase
      .from("workspace_teach_backs")
      .insert({
        plan_id: planId,
        user_id: userId,
        duration_seconds: durationSeconds,
        requested_duration_seconds: requestedDurationSeconds,
        mode,
        focus_node_ids: focusNodeIds,
        voice_id: voice,
        status: "completed",
        transcript,
        summary: result.data.overall_reflection,
        analysis: result.data,
        xai_conversation_id: xaiConversationId,
        completed_at: new Date().toISOString(),
      })
      .select("id, analysis, summary, created_at")
      .single();

    if (insertError) {
      console.error("[workspace-teach-back/complete] Insert error:", insertError);
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json({ teachBack: row });
  } catch (error) {
    console.error("[workspace-teach-back/complete] Error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    const status = message === "Not authenticated" ? 401 : message === "Not authorized" ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
