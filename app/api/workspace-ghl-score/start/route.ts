import { NextRequest, NextResponse } from "next/server";
import { resolveGhlSessionAccess } from "@/lib/ghl-score-session-auth";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const privateToken = body.privateToken ? String(body.privateToken) : "";
    const planId = body.planId ? String(body.planId) : "";
    const planNodeId = body.planNodeId ? String(body.planNodeId) : null;
    const focusSessionId = body.sessionId ? String(body.sessionId) : null;
    const minutes = Math.max(1, Number(body.minutes || 15));
    const ghlSessionId = body.ghlSessionId ? String(body.ghlSessionId) : "";

    const access = await resolveGhlSessionAccess({
      privateToken,
      planId,
      ghlSessionId,
      planNodeId,
      focusSessionId,
    });
    if ("error" in access) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }

    if (access.existingSession?.id) {
      await access.supabase
        .from("workspace_ghc_sessions")
        .update({
          status: "in_progress",
          started_at: new Date().toISOString(),
          plan_node_id: planNodeId || access.planNodeId,
          session_id: focusSessionId || access.focusSessionId,
        })
        .eq("id", access.existingSession.id);

      return NextResponse.json({ ghlSessionId: access.existingSession.id });
    }

    if (privateToken) {
      return NextResponse.json({ error: "GHL session missing for private link" }, { status: 500 });
    }

    const { data: row, error } = await access.supabase
      .from("workspace_ghc_sessions")
      .insert({
        plan_id: access.planId,
        user_id: access.userId,
        plan_node_id: planNodeId,
        session_id: focusSessionId,
        requested_duration_seconds: minutes * 60,
        status: "in_progress",
        started_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (error || !row) {
      return NextResponse.json({ error: error?.message || "Could not start GHL session" }, { status: 500 });
    }

    return NextResponse.json({ ghlSessionId: row.id });
  } catch (error) {
    console.error("[workspace-ghl-score/start] Error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}