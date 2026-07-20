import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, errorResponse } from "@/lib/pow-api/auth";
import { canAccessAgentWorkspace } from "@/lib/pow-api/workspace-access";
import { resolveEvaluationSubject } from "@/lib/pow-api/evaluation-subject";
import { computeKnowledgeDistanceForSubject } from "@/lib/pow-api/custom-verification-model-store";
import { CustomVerificationModelError } from "@/lib/knowledge-config/custom-verification-model";

export const runtime = "nodejs";

interface RouteProps {
  params: Promise<{ id: string }>;
}

function parseRegionId(source: {
  region_id?: string | null;
  regionId?: string | null;
  model_id?: string | null;
  modelId?: string | null;
}): string {
  return (
    (typeof source.region_id === "string" && source.region_id) ||
    (typeof source.regionId === "string" && source.regionId) ||
    (typeof source.model_id === "string" && source.model_id) ||
    (typeof source.modelId === "string" && source.modelId) ||
    ""
  );
}

/**
 * Knowledge distance — pure knowledgecfg embedding geometry between a user and a region.
 *
 * NOT a vertical Eval: geometry-only computation (no vertical score pipeline, no history archive).
 *
 * GET  /api/v3/eval/workspaces/{id}/knowledge-distance?region_id=&user_id=
 * POST /api/v3/eval/workspaces/{id}/knowledge-distance
 *      { region_id, user_id?, guest_user_id? }
 * Subject addressing uses unique user_id / guest_user_id only.
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
  const regionId = parseRegionId({
    region_id: url.searchParams.get("region_id"),
    regionId: url.searchParams.get("regionId"),
    model_id: url.searchParams.get("model_id"),
    modelId: url.searchParams.get("modelId"),
  });
  if (!regionId) {
    return errorResponse(400, "region_id_required", "region_id is required");
  }

  const isWorkspaceOwner = Boolean(auth.user_id && workspace.user_id === auth.user_id);
  const subject = resolveEvaluationSubject(
    auth,
    {
      user_id: url.searchParams.get("user_id") || auth.user_id,
      guest_user_id: url.searchParams.get("guest_user_id"),
    },
    { isWorkspaceOwner },
  );

  try {
    const computed = await computeKnowledgeDistanceForSubject(supabase, {
      workspaceId,
      regionId,
      subject: {
        user_id: subject.user_id,
        guest_user_id: subject.guest_user_id,
      },
    });

    return NextResponse.json({
      workspace_id: workspaceId,
      computation: "knowledge_distance",
      note: "Pure embedding-space geometry in knowledgecfg-v1-d64 — not a vertical Eval score and not archived to history.",
      region: {
        id: computed.region.id,
        name: computed.region.name,
        embedding_model_id: computed.region.embedding_model_id,
        cosine_threshold: computed.region.cosine_threshold,
      },
      subject: computed.subject,
      knowledge_distance: computed.knowledge_distance,
    });
  } catch (error) {
    if (error instanceof CustomVerificationModelError) {
      return errorResponse(400, "knowledge_distance_error", error.message);
    }
    console.error("[eval/knowledge-distance] GET failed:", error);
    return errorResponse(500, "internal_error", "Failed to compute Knowledge distance");
  }
}

export async function POST(req: NextRequest, { params }: RouteProps) {
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

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const regionId = parseRegionId({
    region_id: typeof body.region_id === "string" ? body.region_id : null,
    regionId: typeof body.regionId === "string" ? body.regionId : null,
    model_id: typeof body.model_id === "string" ? body.model_id : null,
    modelId: typeof body.modelId === "string" ? body.modelId : null,
  });
  if (!regionId) {
    return errorResponse(400, "region_id_required", "region_id is required");
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

  try {
    const computed = await computeKnowledgeDistanceForSubject(supabase, {
      workspaceId,
      regionId,
      subject: {
        user_id: subject.user_id,
        guest_user_id: subject.guest_user_id,
      },
    });

    return NextResponse.json({
      workspace_id: workspaceId,
      computation: "knowledge_distance",
      note: "Pure embedding-space geometry in knowledgecfg-v1-d64 — not a vertical Eval score and not archived to history.",
      region: {
        id: computed.region.id,
        name: computed.region.name,
        embedding_model_id: computed.region.embedding_model_id,
        cosine_threshold: computed.region.cosine_threshold,
      },
      subject: computed.subject,
      knowledge_distance: computed.knowledge_distance,
    });
  } catch (error) {
    if (error instanceof CustomVerificationModelError) {
      return errorResponse(400, "knowledge_distance_error", error.message);
    }
    console.error("[eval/knowledge-distance] POST failed:", error);
    return errorResponse(500, "internal_error", "Failed to compute Knowledge distance");
  }
}
