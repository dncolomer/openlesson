import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, errorResponse } from "@/lib/agent-v2/auth";
import { canAccessAgentWorkspace } from "@/lib/agent-v2/workspace-access";
import { withProofOfWorkApiResponse } from "@/lib/agent-v2/predictive-interruption";

interface RouteProps {
  params: Promise<{ id: string }>;
}

export async function GET(req: NextRequest, { params }: RouteProps) {
  const result = await authenticateRequest(req, "workspaces:read");
  if (result instanceof NextResponse) return result;
  const { auth, supabase } = result;
  const { id } = await params;

  const { data: workspace, error: workspaceError } = await supabase
    .from("workspaces")
    .select("id, user_id, organization_id, guest_user_id")
    .eq("id", id)
    .single();

  if (workspaceError || !workspace || !canAccessAgentWorkspace(auth, workspace)) {
    return errorResponse(404, "workspace_not_found", "Workspace not found");
  }

  const { data: blocks, error } = await supabase
    .from("blocks")
    .select("id, title, description, is_start, next_block_ids, status, created_at")
    .eq("workspace_id", id)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("[agent/workspace-blocks] Query error:", error);
    return errorResponse(500, "internal_error", "Failed to list blocks");
  }

  return NextResponse.json(
    await withProofOfWorkApiResponse(
      { blocks: blocks || [] },
      { endpoint: "list_blocks", workspace_id: id }
    )
  );
}
