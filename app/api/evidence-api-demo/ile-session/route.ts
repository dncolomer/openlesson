import { NextRequest, NextResponse } from "next/server";
import { requireDemoAdminWorkspaceSession } from "@/lib/evidence-api-demo/demo-access";
import { selectPracticeBlock } from "@/lib/evidence-api-demo/tap-validation";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      body = {};
    }

    const planId = typeof body.planId === "string" ? body.planId : "";
    if (!planId) {
      return NextResponse.json({ error: "planId is required" }, { status: 400 });
    }

    const access = await requireDemoAdminWorkspaceSession(planId);
    if (access instanceof NextResponse) return access;

    let blockId = typeof body.blockId === "string" ? body.blockId : "";
    let blockTitle = "";
    let planningPrompt: string | null = null;

    if (!blockId) {
      const { data: blocks, error: blocksError } = await access.supabase
        .from("plan_nodes")
        .select("id, title, description, planning_prompt")
        .eq("plan_id", planId)
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
      .from("plan_nodes")
      .select("id, plan_id, title, description, planning_prompt, session_id")
      .eq("id", blockId)
      .eq("plan_id", planId)
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
      .from("plan_node_sessions")
      .select("session_id")
      .eq("plan_node_id", blockId)
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

    await access.supabase.from("plan_nodes").update({ status: "in_progress" }).eq("id", blockId);

    const { data: session, error: sessionError } = await access.supabase
      .from("sessions")
      .insert({
        user_id: access.userId,
        problem: blockTitle,
        status: "active",
        planning_prompt: planningPrompt,
        metadata: {
          plan_id: planId,
          plan_node_id: blockId,
          node_title: blockTitle,
          demo_integration: true,
        },
      })
      .select("id, status")
      .single();

    if (sessionError || !session) {
      console.error("[evidence-api-demo/ile-session] Create error:", sessionError);
      return NextResponse.json({ error: "Failed to create ILE session" }, { status: 500 });
    }

    await access.supabase.from("plan_nodes").update({ session_id: session.id }).eq("id", blockId);

    const { error: linkError } = await access.supabase.from("plan_node_sessions").insert({
      plan_node_id: blockId,
      session_id: session.id,
      user_id: access.userId,
      plan_id: planId,
    });

    if (linkError) {
      console.error("[evidence-api-demo/ile-session] Link error:", linkError);
    }

    const sessionUrl = `${req.nextUrl.origin}/session?id=${session.id}`;

    return NextResponse.json({
      session,
      session_url: sessionUrl,
      block_title: blockTitle,
      resumed: false,
    });
  } catch (error) {
    console.error("[evidence-api-demo/ile-session] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create ILE session" },
      { status: 500 }
    );
  }
}