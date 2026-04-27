import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

function getAdminClient() {
  return createAdminClient();
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ planId: string }> }
) {
  try {
    const { planId } = await params;
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

    // Load plan
    const { data: planData, error: planError } = await adminClient
      .from("learning_plans")
      .select("id, user_id, root_topic, status, is_public, is_agent_session, created_at")
      .eq("id", planId)
      .single();

    if (planError || !planData) {
      return NextResponse.json({ error: "Plan not found" }, { status: 404 });
    }

    // Load owner profile
    const { data: ownerData } = await adminClient
      .from("profiles")
      .select("id, username, email")
      .eq("id", planData.user_id)
      .single();

    // Load nodes
    const { data: nodesData } = await adminClient
      .from("plan_nodes")
      .select("id, label, depth, status, session_id")
      .eq("plan_id", planId)
      .order("depth", { ascending: true });

    // Load sessions for this plan's nodes
    const sessionIds = (nodesData || [])
      .filter((n: { session_id: string | null }) => n.session_id)
      .map((n: { session_id: string | null }) => n.session_id);

    let sessionsData: { id: string; problem: string; status: string; created_at: string; duration_ms: number }[] = [];
    if (sessionIds.length > 0) {
      const { data } = await adminClient
        .from("sessions")
        .select("id, problem, status, created_at, duration_ms")
        .in("id", sessionIds)
        .order("created_at", { ascending: false });
      sessionsData = data || [];
    }

    return NextResponse.json({
      plan: { ...planData, owner: ownerData || undefined },
      nodes: nodesData || [],
      sessions: sessionsData,
    });
  } catch (err) {
    console.error("Admin plan detail error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
