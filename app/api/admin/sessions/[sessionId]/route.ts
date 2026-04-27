import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

function getAdminClient() {
  return createAdminClient();
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;
    const supabase = await createClient();
    const { data: { user: authUser } } = await supabase.auth.getUser();
    
    if (!authUser) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", authUser.id)
      .single();

    if (!profile?.is_admin) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const adminClient = getAdminClient();

    // Load session
    const { data: sessionData, error: sessionError } = await adminClient
      .from("sessions")
      .select("id, user_id, problem, status, created_at, duration_ms, plan_node_id")
      .eq("id", sessionId)
      .single();

    if (sessionError || !sessionData) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    // Load owner profile
    const { data: ownerData } = await adminClient
      .from("profiles")
      .select("id, username, email")
      .eq("id", sessionData.user_id)
      .single();

    // Load plan node if exists
    let planNode = null;
    if (sessionData.plan_node_id) {
      const { data: nodeData } = await adminClient
        .from("plan_nodes")
        .select("id, plan_id, label")
        .eq("id", sessionData.plan_node_id)
        .single();

      if (nodeData) {
        const { data: planData } = await adminClient
          .from("learning_plans")
          .select("id, root_topic")
          .eq("id", nodeData.plan_id)
          .single();

        planNode = { ...nodeData, plan: planData || undefined };
      }
    }

    return NextResponse.json({
      session: { ...sessionData, owner: ownerData || undefined },
      planNode,
    });
  } catch (err) {
    console.error("Admin session detail error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
