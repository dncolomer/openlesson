import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/require-admin";
import { getProfileEmail } from "@/lib/admin/users";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ workspaceId: string }> }
) {
  try {
    const { workspaceId } = await params;
    const auth = await requireAdmin();
    if ("error" in auth) return auth.error;
    const { adminClient } = auth;

    const { data: planData, error: planError } = await adminClient
      .from("workspaces")
      .select(
        "id, user_id, title, root_topic, status, is_public, is_agent_workspace, organization_id, created_at, notes"
      )
      .eq("id", workspaceId)
      .single();

    if (planError || !planData) {
      return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
    }

    const [{ data: ownerData }, email, { data: nodesData }, { data: tapSessions }] = await Promise.all([
      adminClient.from("profiles").select("id, username").eq("id", planData.user_id).single(),
      getProfileEmail(adminClient, planData.user_id),
      adminClient
        .from("blocks")
        .select("id, title, description, is_start, status, created_at")
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: true }),
      adminClient
        .from("workspace_tap_sessions")
        .select("id, status, overall_score, created_at, completed_at, requested_duration_seconds")
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: false }),
    ]);

    const blockIds = (nodesData || []).map((node) => node.id);
    let sessionsData: Array<{
      id: string;
      problem: string;
      status: string;
      created_at: string;
      duration_ms: number;
    }> = [];

    if (blockIds.length > 0) {
      const { data: nodeSessionLinks } = await adminClient
        .from("block_sessions")
        .select("session_id")
        .in("block_id", blockIds);

      const sessionIds = [
        ...new Set((nodeSessionLinks || []).map((row) => row.session_id).filter(Boolean)),
      ];

      if (sessionIds.length > 0) {
        const { data } = await adminClient
          .from("sessions")
          .select("id, problem, status, created_at, duration_ms")
          .in("id", sessionIds)
          .order("created_at", { ascending: false });
        sessionsData = data || [];
      }
    }

    return NextResponse.json({
      plan: {
        ...planData,
        display_topic: planData.title || planData.root_topic,
        owner: ownerData ? { ...ownerData, email } : undefined,
      },
      nodes: nodesData || [],
      sessions: sessionsData,
      tapSessions: tapSessions || [],
    });
  } catch (err) {
    console.error("Admin plan detail error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}