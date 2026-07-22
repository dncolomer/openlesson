import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, errorResponse } from "@/lib/pow-api/auth";
import { canAccessAgentWorkspace } from "@/lib/pow-api/workspace-access";
import { resolveEvaluationSubject } from "@/lib/pow-api/evaluation-subject";
import {
  loadKnowledgeConfigTrajectory,
  projectTrajectory2D,
  trajectoryPathLength,
} from "@/lib/pow-api/knowledge-config-store";
import {
  KNOWLEDGE_CONFIG_EMBEDDING_MODEL_ID,
} from "@/lib/knowledge-config";

export const runtime = "nodejs";

interface RouteProps {
  params: Promise<{ id: string }>;
}

function parseMs(value: string | null): number | null {
  if (!value) return null;
  if (/^\d+$/.test(value)) return Number(value);
  const t = Date.parse(value);
  return Number.isFinite(t) ? t : null;
}

/**
 * GET /api/v3/snapshot/workspaces/{id}/knowledge-config/trajectory
 * Time series of knowledge config embeddings + optional fixed 2D projection.
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

  const maxPoints = Math.min(
    500,
    Math.max(2, Number(url.searchParams.get("max_points") || 100) || 100),
  );
  const includeProjection = url.searchParams.get("project") !== "false";
  const modelId = url.searchParams.get("embedding_model_id") || KNOWLEDGE_CONFIG_EMBEDDING_MODEL_ID;

  const points = await loadKnowledgeConfigTrajectory(supabase, {
    workspaceId,
    subject,
    fromMs: parseMs(url.searchParams.get("from")),
    toMs: parseMs(url.searchParams.get("to")),
    maxPoints,
    embeddingModelId: modelId,
  });

  return NextResponse.json({
    workspace_id: workspaceId,
    subject,
    embedding_model_id: modelId,
    point_count: points.length,
    path_length: trajectoryPathLength(points),
    points,
    projection: includeProjection
      ? {
          frame_id: `${modelId}:ui2d`,
          embedding_model_id: modelId,
          coords: projectTrajectory2D(points),
        }
      : undefined,
  });
}
