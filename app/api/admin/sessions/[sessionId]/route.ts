import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/require-admin";
import { getProfileEmail } from "@/lib/admin/users";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;
    const auth = await requireAdmin();
    if ("error" in auth) return auth.error;
    const { adminClient } = auth;

    const { data: sessionData, error: sessionError } = await adminClient
      .from("sessions")
      .select("id, user_id, problem, status, created_at, duration_ms, plan_node_id")
      .eq("id", sessionId)
      .single();

    if (sessionError || !sessionData) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    const [{ data: ownerData }, email] = await Promise.all([
      adminClient.from("profiles").select("id, username").eq("id", sessionData.user_id).single(),
      getProfileEmail(adminClient, sessionData.user_id),
    ]);

    let planNode = null;
    if (sessionData.plan_node_id) {
      const { data: nodeData } = await adminClient
        .from("plan_nodes")
        .select("id, plan_id, title")
        .eq("id", sessionData.plan_node_id)
        .single();

      if (nodeData) {
        const { data: planData } = await adminClient
          .from("learning_plans")
          .select("id, title, root_topic")
          .eq("id", nodeData.plan_id)
          .single();

        planNode = {
          ...nodeData,
          plan: planData
            ? { ...planData, display_topic: planData.title || planData.root_topic }
            : undefined,
        };
      }
    }

    return NextResponse.json({
      session: {
        ...sessionData,
        owner: ownerData ? { ...ownerData, email } : undefined,
      },
      planNode,
    });
  } catch (err) {
    console.error("Admin session detail error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}