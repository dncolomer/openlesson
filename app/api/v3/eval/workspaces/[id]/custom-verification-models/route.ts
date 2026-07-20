import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, errorResponse } from "@/lib/pow-api/auth";
import { canAccessAgentWorkspace } from "@/lib/pow-api/workspace-access";
import {
  createCustomVerificationModelFromSubjects,
  evalSubjectAgainstCustomVerificationModel,
  listCustomVerificationModels,
  listSubjectsWithKnowledgeConfig,
} from "@/lib/pow-api/custom-verification-model-store";
import { CustomVerificationModelError } from "@/lib/knowledge-config/custom-verification-model";
import { resolveEvaluationSubject } from "@/lib/pow-api/evaluation-subject";

export const runtime = "nodejs";

interface RouteProps {
  params: Promise<{ id: string }>;
}

/**
 * GET  /api/v3/eval/workspaces/{id}/custom-verification-models
 * POST /api/v3/eval/workspaces/{id}/custom-verification-models
 *      body.action: create | eval
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

  const [models, subjects] = await Promise.all([
    listCustomVerificationModels(supabase, workspaceId),
    listSubjectsWithKnowledgeConfig(supabase, workspaceId),
  ]);

  return NextResponse.json({ workspace_id: workspaceId, models, subjects });
}

export async function POST(req: NextRequest, { params }: RouteProps) {
  const result = await authenticateRequest(req, "workspaces:write");
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

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const action = typeof body.action === "string" ? body.action : "create";

  try {
    if (action === "eval") {
      // eval only needs read — but we already required write; allow if they have write
      const modelId = typeof body.model_id === "string" ? body.model_id : typeof body.modelId === "string" ? body.modelId : "";
      if (!modelId) {
        return errorResponse(400, "model_id_required", "model_id is required");
      }
      const isWorkspaceOwner = Boolean(auth.user_id && workspace.user_id === auth.user_id);
      const subject = resolveEvaluationSubject(
        auth,
        {
          user_id: typeof body.user_id === "string" ? body.user_id : auth.user_id,
          guest_user_id: typeof body.guest_user_id === "string" ? body.guest_user_id : null,
        },
        { isWorkspaceOwner },
      );
      const scored = await evalSubjectAgainstCustomVerificationModel(supabase, {
        workspaceId,
        modelId,
        subject: {
          user_id: subject.user_id,
          guest_user_id: subject.guest_user_id,
        },
      });
      return NextResponse.json({
        workspace_id: workspaceId,
        model: { id: scored.model.id, name: scored.model.name },
        score: scored.score,
      });
    }

    const name = typeof body.name === "string" ? body.name : "";
    const subjects = Array.isArray(body.subjects) ? body.subjects : [];
    const { model, spec } = await createCustomVerificationModelFromSubjects(supabase, {
      workspaceId,
      name,
      description: typeof body.description === "string" ? body.description : null,
      subjects: subjects.map((s: Record<string, unknown>) => ({
        user_id: typeof s.user_id === "string" ? s.user_id : null,
        guest_user_id: typeof s.guest_user_id === "string" ? s.guest_user_id : null,
        label: typeof s.label === "string" ? s.label : null,
      })),
      createdBy: auth.user_id,
    });

    return NextResponse.json({
      workspace_id: workspaceId,
      model,
      spec: {
        name: spec.name,
        subject_count: spec.subject_count,
        cosine_threshold: spec.cosine_threshold,
        cohort_cohesion: spec.cohort_cohesion,
        embedding_model_id: spec.embedding_model_id,
      },
    });
  } catch (error) {
    if (error instanceof CustomVerificationModelError) {
      return errorResponse(400, "custom_verification_model_error", error.message);
    }
    console.error("[eval/custom-verification-models] failed:", error);
    return errorResponse(500, "internal_error", "Failed to process custom verification model");
  }
}
