import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, errorResponse } from "@/lib/agent-v2/auth";
import { canAccessAgentWorkspace } from "@/lib/agent-v2/workspace-access";

interface RouteProps {
  params: Promise<{ id: string }>;
}

export async function GET(req: NextRequest, { params }: RouteProps) {
  const result = await authenticateRequest(req, "ghl:read");
  if (result instanceof NextResponse) return result;
  const { auth, supabase } = result;
  const { id } = await params;

  const { data: workspace } = await supabase
    .from("learning_plans")
    .select("id, user_id, organization_id, guest_user_id")
    .eq("id", id)
    .single();

  if (!workspace || !canAccessAgentWorkspace(auth, workspace)) {
    return errorResponse(404, "workspace_not_found", "Workspace not found");
  }

  let query = supabase
    .from("workspace_ghc_sessions")
    .select("id, plan_id, plan_node_id, status, requested_duration_seconds, duration_seconds, focus_node_ids, overall_score, created_at, started_at, completed_at")
    .eq("plan_id", id)
    .order("created_at", { ascending: false });

  if (auth.guest_user_id) query = query.eq("guest_user_id", auth.guest_user_id);
  else if (!auth.is_org_admin) query = query.eq("user_id", auth.user_id);

  const { data: links, error } = await query;

  if (error) {
    console.error("[agent/ghl-links:list] Query error:", error);
    return errorResponse(500, "internal_error", "Failed to list GHL links");
  }

  return NextResponse.json({ ghl_links: links || [] });
}
