import { NextRequest, NextResponse } from "next/server";
import { ayclTokenFromBody, ileTokenFromBody, guardWorkspaceRoute } from "@/lib/api/require-auth";
import { buildLearnerLaunchBody } from "@/lib/workspace-learner-writes";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const payload = buildLearnerLaunchBody({
      workspaceId: String(body.workspaceId || ""),
      blockId: String(body.blockId || ""),
      sessionMode: body.sessionMode || body.session_mode,
      ayclToken: ayclTokenFromBody(body),
      ileToken: ileTokenFromBody(body),
    });
    const workspaceId = String(payload.workspaceId || "");
    const blockId = String(payload.blockId || "");
    if (!workspaceId || !blockId) {
      return NextResponse.json({ error: "workspaceId and blockId are required" }, { status: 400 });
    }

    const auth = await guardWorkspaceRoute(workspaceId, {
      ayclToken: ayclTokenFromBody(body),
      ileToken: ileTokenFromBody(body),
    });
    if (!auth.ok) return auth.response;

    const { data: block, error: blockError } = await auth.supabase
      .from("blocks")
      .select("id, title, planning_prompt, workspace_id")
      .eq("id", blockId)
      .eq("workspace_id", workspaceId)
      .single();
    if (blockError || !block) {
      return NextResponse.json({ error: "Block not found" }, { status: 404 });
    }

    const sessionMode = payload.sessionMode === "project" ? "project" : "learning";
    const { data: session, error: sessionError } = await auth.supabase
      .from("sessions")
      .insert({
        user_id: auth.user.id,
        problem: block.title,
        status: "active",
        planning_prompt: block.planning_prompt || null,
        metadata: {
          session_mode: sessionMode,
          ile_session_mode: sessionMode,
          block_id: block.id,
          block_title: block.title,
          workspace_id: workspaceId,
        },
      })
      .select("id")
      .single();
    if (sessionError || !session) {
      return NextResponse.json({ error: sessionError?.message || "Failed to create session" }, { status: 500 });
    }

    await auth.supabase
      .from("blocks")
      .update({ status: "in_progress", session_id: session.id })
      .eq("id", blockId)
      .eq("workspace_id", workspaceId);

    await auth.supabase.from("block_sessions").insert({
      block_id: blockId,
      session_id: session.id,
      user_id: auth.user.id,
      workspace_id: workspaceId,
    });

    return NextResponse.json({ sessionId: session.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to launch";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
