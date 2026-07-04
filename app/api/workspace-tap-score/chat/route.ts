import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { callXai, systemMessage, userMessage } from "@/lib/xai-client";
import { buildGhcScoreInstructions, getGhcScoreBrief, getGhcScoreBriefForUser, GhcScoreMode, hashPrivateToken } from "@/lib/ghc-score";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const privateToken = body.privateToken ? String(body.privateToken) : "";
    let planId = String(body.planId || "");
    let mode = "curious" as GhcScoreMode;
    let minutes = Number(body.minutes || 15);
    let focusNodeIds = Array.isArray(body.focusNodeIds) ? body.focusNodeIds.filter(Boolean) : [];
    const planNodeId = body.planNodeId ? String(body.planNodeId) : null;
    let focusSessionId = body.sessionId ? String(body.sessionId) : null;
    const messages = Array.isArray(body.messages) ? body.messages : [];
    const latestThought = String(body.thought || "").trim();
    let userId: string | null = null;

    if (!latestThought) return NextResponse.json({ error: "thought is required" }, { status: 400 });

    if (privateToken) {
      const supabase = createAdminClient();
      const { data: session, error } = await supabase
        .from("workspace_ghc_sessions")
        .select("id, plan_id, user_id, guest_user_id, organization_id, requested_duration_seconds, mode, focus_node_ids, status, session_id, learning_plans!inner(user_id)")
        .eq("private_token_hash", hashPrivateToken(privateToken))
        .single();

      if (error || !session) return NextResponse.json({ error: "TAP block not found" }, { status: 404 });
      if (session.status === "completed") return NextResponse.json({ error: "TAP block is already completed" }, { status: 409 });

      await supabase
        .from("workspace_ghc_sessions")
        .update({ status: "in_progress", started_at: new Date().toISOString() })
        .eq("id", session.id);

      planId = session.plan_id;
      userId = session.user_id || (session as any).learning_plans?.user_id || null;
      mode = "curious";
      minutes = Math.max(1, Math.round((session.requested_duration_seconds || 900) / 60));
      focusNodeIds = session.focus_node_ids || [];
      focusSessionId = session.session_id || null;
    }

    if (!planId) return NextResponse.json({ error: "planId is required" }, { status: 400 });
    if (planNodeId && !focusNodeIds.includes(planNodeId)) focusNodeIds = [planNodeId, ...focusNodeIds];

    const { brief } = userId
      ? await getGhcScoreBriefForUser(planId, userId, focusNodeIds, true, focusSessionId)
      : await getGhcScoreBrief(planId, focusNodeIds, focusSessionId);

    const context = buildGhcScoreInstructions(brief, mode, minutes);
    const history = messages
      .slice(-12)
      .map((message: any) => `${message.role === "assistant" ? "Helios" : "Learner"}: ${String(message.content || "").slice(0, 2000)}`)
      .join("\n\n");

    const response = await callXai([
      systemMessage(`${context}\n\nYou are now responding in a selective thought interface, not a live voice call. The learner submits transcribed thought fragments. Reply in a Socratic style with one concise question, or at most one brief reflection followed by a question. Elicit evidence about what they learned, what they can transfer, and what gaps remain. Prioritize definitions, causal reasoning, examples, application, and repair. Do not score yet. Do not explain the answer for them unless they explicitly ask for help.`),
      userMessage(`Conversation so far:\n${history || "None"}\n\nLatest submitted thought:\n${latestThought}`),
    ], {
      maxTokens: 500,
      temperature: 0.55,
      fetchTimeout: 60000,
    });

    if (!response.success || !response.data) {
      return NextResponse.json({ error: response.error || "Failed to generate TAP response" }, { status: 500 });
    }

    return NextResponse.json({ message: response.data });
  } catch (error) {
    console.error("[workspace-tap-score/chat] Error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    const status = message === "Not authenticated" ? 401 : message === "Not authorized" ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
