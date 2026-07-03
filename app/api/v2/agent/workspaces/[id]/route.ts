import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, errorResponse } from "@/lib/agent-v2/auth";
import { normalizeConversionGoal } from "@/lib/agent-v2/conversion-goal";
import { canAccessAgentWorkspace } from "@/lib/agent-v2/workspace-access";

export const runtime = "nodejs";

interface RouteProps {
  params: Promise<{ id: string }>;
}

export async function GET(req: NextRequest, { params }: RouteProps) {
  const result = await authenticateRequest(req, "workspaces:read");
  if (result instanceof NextResponse) return result;
  const { auth, supabase } = result;
  const { id: workspaceId } = await params;

  const { data: workspace } = await supabase
    .from("learning_plans")
    .select("id, title, root_topic, description, notes, conversion_goal, status, created_at, updated_at, user_id, organization_id, guest_user_id")
    .eq("id", workspaceId)
    .single();

  if (!workspace || !canAccessAgentWorkspace(auth, workspace)) {
    return errorResponse(404, "workspace_not_found", "Workspace not found");
  }

  return NextResponse.json({
    workspace: {
      id: workspace.id,
      title: workspace.title,
      root_topic: workspace.root_topic,
      description: workspace.description,
      notes: workspace.notes,
      conversion_goal: workspace.conversion_goal,
      status: workspace.status,
      created_at: workspace.created_at,
      updated_at: workspace.updated_at,
    },
  });
}

export async function PATCH(req: NextRequest, { params }: RouteProps) {
  const result = await authenticateRequest(req, "workspaces:write");
  if (result instanceof NextResponse) return result;
  const { auth, supabase } = result;
  const { id: workspaceId } = await params;

  const { data: workspace } = await supabase
    .from("learning_plans")
    .select("id, user_id, organization_id, guest_user_id, conversion_goal")
    .eq("id", workspaceId)
    .single();

  if (!workspace || !canAccessAgentWorkspace(auth, workspace)) {
    return errorResponse(404, "workspace_not_found", "Workspace not found");
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return errorResponse(400, "validation_error", "Invalid JSON body");
  }

  if (!("conversion_goal" in body)) {
    return errorResponse(400, "validation_error", "conversion_goal is required");
  }

  const conversionGoal =
    body.conversion_goal === null ? null : normalizeConversionGoal(body.conversion_goal);

  if (body.conversion_goal !== null && !conversionGoal) {
    return errorResponse(400, "validation_error", "conversion_goal must be a non-empty string or null");
  }

  const { data: updated, error } = await supabase
    .from("learning_plans")
    .update({ conversion_goal: conversionGoal })
    .eq("id", workspaceId)
    .select("id, conversion_goal, updated_at")
    .single();

  if (error || !updated) {
    return errorResponse(500, "internal_error", "Failed to update workspace conversion goal");
  }

  return NextResponse.json({
    workspace_id: updated.id,
    conversion_goal: updated.conversion_goal,
    updated_at: updated.updated_at,
  });
}