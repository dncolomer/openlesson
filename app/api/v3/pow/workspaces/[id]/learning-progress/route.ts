import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, errorResponse } from "@/lib/pow-api/auth";
import { getAgentLearningProgress } from "@/lib/pow-api/agent-workspace-ops";
import { getAppOrigin } from "@/lib/pow-api/mcp-oauth/config";
import { withProofOfWorkApiResponse } from "@/lib/pow-api/predictive-interruption";

export const runtime = "nodejs";
export const maxDuration = 60;

interface RouteProps {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/v3/pow/workspaces/{id}/learning-progress
 * One-call progress snapshot — REST twin of MCP get_learning_progress.
 */
export async function GET(req: NextRequest, { params }: RouteProps) {
  const result = await authenticateRequest(req, "workspaces:read");
  if (result instanceof NextResponse) return result;
  const { auth, supabase } = result;
  const { id: workspaceId } = await params;
  const origin = getAppOrigin(req);

  try {
    const progress = await getAgentLearningProgress(supabase, auth, workspaceId, origin);
    const { counts, workspace_row: _ws, ...payload } = progress;
    return NextResponse.json(
      await withProofOfWorkApiResponse(payload, {
        endpoint: "get_learning_progress",
        workspace_id: workspaceId,
        proof_of_work_artifacts: counts.proof_of_work_artifacts,
      }),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load learning progress";
    if (message.toLowerCase().includes("not found")) {
      return errorResponse(404, "workspace_not_found", "Workspace not found");
    }
    return errorResponse(500, "internal_error", message);
  }
}
