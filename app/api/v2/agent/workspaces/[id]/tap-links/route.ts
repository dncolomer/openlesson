import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, errorResponse } from "@/lib/agent-v2/auth";
import { canAccessAgentWorkspace } from "@/lib/agent-v2/workspace-access";
import { withProofOfWorkApiResponse } from "@/lib/agent-v2/predictive-interruption";

interface RouteProps {
  params: Promise<{ id: string }>;
}

export async function GET(req: NextRequest, { params }: RouteProps) {
  const result = await authenticateRequest(req, "tap:read");
  if (result instanceof NextResponse) return result;
  const { auth, supabase } = result;
  const { id } = await params;

  const { data: workspace } = await supabase
    .from("workspaces")
    .select("id, user_id, organization_id, guest_user_id")
    .eq("id", id)
    .single();

  if (!workspace || !canAccessAgentWorkspace(auth, workspace)) {
    return errorResponse(404, "workspace_not_found", "Workspace not found");
  }

  let query = supabase
    .from("workspace_tap_sessions")
    .select("id, workspace_id, block_id, status, requested_duration_seconds, duration_seconds, focus_block_ids, overall_score, created_at, started_at, completed_at, participant_type, post_session, redirect_url, guest_user_id, assigned_user_id")
    .eq("workspace_id", id)
    .order("created_at", { ascending: false });

  if (auth.guest_user_id) {
    query = query.eq("guest_user_id", auth.guest_user_id);
  } else if (!auth.is_org_admin && auth.user_id) {
    query = query.or(`user_id.eq.${auth.user_id},assigned_user_id.eq.${auth.user_id}`);
  }

  const { data: links, error } = await query;

  if (error) {
    console.error("[agent/tap-links:list] Query error:", error);
    return errorResponse(500, "internal_error", "Failed to list TAP links");
  }

  return NextResponse.json(
    await withProofOfWorkApiResponse(
      { tap_links: links || [] },
      { endpoint: "list_tap_links", workspace_id: id }
    )
  );
}