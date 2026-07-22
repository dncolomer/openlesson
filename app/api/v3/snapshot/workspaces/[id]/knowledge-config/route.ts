import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, errorResponse } from "@/lib/pow-api/auth";
import { canAccessAgentWorkspace } from "@/lib/pow-api/workspace-access";
import { resolveEvaluationSubject } from "@/lib/pow-api/evaluation-subject";
import { loadLatestKnowledgeConfig } from "@/lib/pow-api/knowledge-config-store";
import { loadLearningWorldModel } from "@/lib/pow-api/learning-world-model-store";
import {
  KNOWLEDGE_CONFIG_DIM,
  KNOWLEDGE_CONFIG_EMBEDDING_MODEL_ID,
  emptyKnowledgeConfig,
} from "@/lib/knowledge-config";

export const runtime = "nodejs";

interface RouteProps {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/v3/snapshot/workspaces/{id}/knowledge-config
 * Latest knowledge configuration embedding for workspace × subject.
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
  const modelId = url.searchParams.get("embedding_model_id") || KNOWLEDGE_CONFIG_EMBEDDING_MODEL_ID;

  const [latest, lwm] = await Promise.all([
    loadLatestKnowledgeConfig(supabase, workspaceId, subject, modelId),
    loadLearningWorldModel(supabase, workspaceId, subject),
  ]);

  if (!latest) {
    const empty = emptyKnowledgeConfig();
    return NextResponse.json({
      workspace_id: workspaceId,
      subject,
      embedding_model_id: empty.embedding_model_id,
      dim: empty.dim,
      vector: empty.vector,
      as_of: empty.as_of,
      as_of_ms: empty.as_of_ms,
      confidence: 0,
      pow_event_count: 0,
      lwm_updated_at: lwm.model.updated_at,
      empty: true,
    });
  }

  return NextResponse.json({
    workspace_id: workspaceId,
    subject,
    embedding_model_id: latest.embedding_model_id,
    dim: latest.dim || KNOWLEDGE_CONFIG_DIM,
    vector: latest.vector,
    as_of: new Date(latest.as_of_ms).toISOString(),
    as_of_ms: latest.as_of_ms,
    confidence: latest.confidence,
    pow_event_count: latest.pow_event_count,
    trigger: latest.trigger,
    lwm_updated_at: lwm.model.updated_at,
    empty: false,
  });
}
