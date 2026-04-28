import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

/**
 * POST /api/group-plan/start-session
 *
 * Called by non-owner participants on a group plan to start a session
 * on a plan node.  Creates the session (owned by the caller) and
 * records the link in `plan_node_sessions`.
 *
 * Body: { planId, nodeId, nodeTitle, planningPrompt? }
 * Returns: { session }
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { planId, nodeId, nodeTitle, planningPrompt } = await req.json();

    if (!planId || !nodeId || !nodeTitle) {
      return NextResponse.json(
        { error: "planId, nodeId, and nodeTitle are required" },
        { status: 400 }
      );
    }

    // Verify the plan exists and is a group plan
    const { data: plan, error: planError } = await supabase
      .from("learning_plans")
      .select("id, is_group, user_id")
      .eq("id", planId)
      .single();

    if (planError || !plan) {
      return NextResponse.json({ error: "Plan not found" }, { status: 404 });
    }

    if (!plan.is_group && plan.user_id !== user.id) {
      return NextResponse.json(
        { error: "This plan does not allow external participants" },
        { status: 403 }
      );
    }

    // Verify the node belongs to the plan
    const { data: node, error: nodeError } = await supabase
      .from("plan_nodes")
      .select("id, plan_id")
      .eq("id", nodeId)
      .eq("plan_id", planId)
      .single();

    if (nodeError || !node) {
      return NextResponse.json({ error: "Node not found in this plan" }, { status: 404 });
    }

    // Check if the user already has an active/paused session on this node
    const { data: existingLinks } = await supabase
      .from("plan_node_sessions")
      .select("session_id")
      .eq("plan_node_id", nodeId)
      .eq("user_id", user.id);

    if (existingLinks && existingLinks.length > 0) {
      const sessionIds = existingLinks.map(l => l.session_id);
      const { data: activeSessions } = await supabase
        .from("sessions")
        .select("id, status")
        .in("id", sessionIds)
        .in("status", ["active", "paused"]);

      if (activeSessions && activeSessions.length > 0) {
        // Resume existing session
        return NextResponse.json({
          session: activeSessions[0],
          resumed: true,
        });
      }
    }

    // Create a new session owned by the participant
    const metadata: Record<string, unknown> = {
      plan_id: planId,
      plan_node_id: nodeId,
      node_title: nodeTitle,
      group_plan: true,
    };

    const { data: session, error: sessionError } = await supabase
      .from("sessions")
      .insert({
        user_id: user.id,
        problem: nodeTitle,
        status: "active",
        planning_prompt: planningPrompt || null,
        metadata,
      })
      .select()
      .single();

    if (sessionError || !session) {
      console.error("[group-plan/start-session] Session creation error:", sessionError);
      return NextResponse.json(
        { error: "Failed to create session" },
        { status: 500 }
      );
    }

    // Record the link in plan_node_sessions
    const { error: linkError } = await supabase
      .from("plan_node_sessions")
      .insert({
        plan_node_id: nodeId,
        session_id: session.id,
        user_id: user.id,
        plan_id: planId,
      });

    if (linkError) {
      console.error("[group-plan/start-session] Link creation error:", linkError);
      // Session was created but link failed; still return the session
      // so the user isn't stuck.
    }

    return NextResponse.json({
      session,
      resumed: false,
    });
  } catch (error) {
    console.error("[group-plan/start-session] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
