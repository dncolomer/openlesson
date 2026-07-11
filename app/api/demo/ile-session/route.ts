import { NextRequest, NextResponse } from "next/server";
import { requireDemoAdminWorkspaceSession } from "@/lib/openlesson-demo/demo-access";
import { selectPracticeBlock } from "@/lib/openlesson-demo/tap-validation";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      body = {};
    }

    const workspaceId = typeof body.workspaceId === "string" ? body.workspaceId : "";
    if (!workspaceId) {
      return NextResponse.json({ error: "workspaceId is required" }, { status: 400 });
    }

    const access = await requireDemoAdminWorkspaceSession(workspaceId);
    if (access instanceof NextResponse) return access;

    let blockId = typeof body.blockId === "string" ? body.blockId : "";
    let blockTitle = "";
    let planningPrompt: string | null = null;

    if (!blockId) {
      const { data: blocks, error: blocksError } = await access.supabase
        .from("blocks")
        .select("id, title, description, planning_prompt")
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: true });

      if (blocksError) {
        return NextResponse.json({ error: blocksError.message }, { status: 500 });
      }

      const selected = selectPracticeBlock(blocks || []);
      if (!selected?.id) {
        return NextResponse.json({ error: "No workspace blocks available for ILE practice" }, { status: 404 });
      }
      blockId = selected.id;
      blockTitle = selected.title || "Practice block";
      planningPrompt =
        typeof (selected as { planning_prompt?: string | null }).planning_prompt === "string"
          ? (selected as { planning_prompt?: string | null }).planning_prompt!
          : selected.description || null;
    }

    const { data: block, error: blockError } = await access.supabase
      .from("blocks")
      .select("id, workspace_id, title, description, planning_prompt, session_id")
      .eq("id", blockId)
      .eq("workspace_id", workspaceId)
      .single();

    if (blockError || !block) {
      return NextResponse.json({ error: "Block not found" }, { status: 404 });
    }

    blockTitle = block.title || blockTitle || "Practice block";
    planningPrompt = block.planning_prompt || block.description || planningPrompt;

    if (block.session_id) {
      const { data: existingSession } = await access.supabase
        .from("sessions")
        .select("id, status")
        .eq("id", block.session_id)
        .single();

      if (existingSession && (existingSession.status === "active" || existingSession.status === "paused")) {
        return NextResponse.json({
          session: existingSession,
          session_url: `${req.nextUrl.origin}/session?id=${existingSession.id}`,
          block_title: blockTitle,
          resumed: true,
        });
      }
    }

    const { data: linkedSessions } = await access.supabase
      .from("block_sessions")
      .select("session_id")
      .eq("block_id", blockId)
      .eq("user_id", access.userId);

    if (linkedSessions && linkedSessions.length > 0) {
      const sessionIds = linkedSessions.map((link) => link.session_id);
      const { data: activeSessions } = await access.supabase
        .from("sessions")
        .select("id, status")
        .in("id", sessionIds)
        .in("status", ["active", "paused"]);

      if (activeSessions && activeSessions.length > 0) {
        return NextResponse.json({
          session: activeSessions[0],
          session_url: `${req.nextUrl.origin}/session?id=${activeSessions[0].id}`,
          block_title: blockTitle,
          resumed: true,
        });
      }
    }

    await access.supabase.from("blocks").update({ status: "in_progress" }).eq("id", blockId);

    const { data: session, error: sessionError } = await access.supabase
      .from("sessions")
      .insert({
        user_id: access.userId,
        problem: blockTitle,
        status: "active",
        planning_prompt: planningPrompt,
        metadata: {
          workspace_id: workspaceId,
          block_id: blockId,
          block_title: blockTitle,
          demo_integration: true,
        },
      })
      .select("id, status")
      .single();

    if (sessionError || !session) {
      console.error("[demo/ile-session] Create error:", sessionError);
      return NextResponse.json({ error: "Failed to create ILE session" }, { status: 500 });
    }

    await access.supabase.from("blocks").update({ session_id: session.id }).eq("id", blockId);

    const { error: linkError } = await access.supabase.from("block_sessions").insert({
      block_id: blockId,
      session_id: session.id,
      user_id: access.userId,
      workspace_id: workspaceId,
    });

    if (linkError) {
      console.error("[demo/ile-session] Link error:", linkError);
    }

    const sessionUrl = `${req.nextUrl.origin}/session?id=${session.id}`;

    return NextResponse.json({
      session,
      session_url: sessionUrl,
      block_title: blockTitle,
      resumed: false,
    });
  } catch (error) {
    console.error("[demo/ile-session] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create ILE session" },
      { status: 500 }
    );
  }
}