import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, errorResponse } from "@/lib/agent-v2/auth";
import { canAccessAgentWorkspace } from "@/lib/agent-v2/workspace-access";
import { loadLearningWorldModel } from "@/lib/agent-v2/learning-world-model-store";
import { resolveEvaluationSubject } from "@/lib/agent-v2/evaluation-subject";

export const runtime = "nodejs";

interface RouteProps {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/v3/eval/workspaces/{id}/world-model
 * Durable merged learning world model for a workspace × subject.
 */
export async function GET(req: NextRequest, { params }: RouteProps) {
  const result = await authenticateRequest(req, "workspaces:read");
  if (result instanceof NextResponse) return result;
  const { auth, supabase } = result;
  const { id: workspaceId } = await params;

  const { data: workspace } = await supabase
    .from("workspaces")
    .select("id, user_id, organization_id, guest_user_id")
    .eq("id", workspaceId)
    .single();

  if (!workspace || !canAccessAgentWorkspace(auth, workspace)) {
    return errorResponse(404, "workspace_not_found", "Workspace not found");
  }

  const url = new URL(req.url);
  const isWorkspaceOwner = Boolean(auth.user_id && workspace.user_id === auth.user_id);
  const subject = resolveEvaluationSubject(
    auth,
    {
      user_id: url.searchParams.get("user_id") || auth.user_id,
      guest_user_id: url.searchParams.get("guest_user_id"),
    },
    { isWorkspaceOwner },
  );

  const { id, model } = await loadLearningWorldModel(supabase, workspaceId, subject);

  return NextResponse.json({
    workspace_id: workspaceId,
    subject,
    lwm_id: id,
    learning_world_model: model,
  });
}
