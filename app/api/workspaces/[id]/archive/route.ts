import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-error-envelope";
import { ayclTokenFromBody, guardWorkspaceRoute, requireAuthenticatedUser } from "@/lib/api/require-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { canUserManageWorkspace, setWorkspaceArchived } from "@/lib/workspace-archive";

export const runtime = "nodejs";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: workspaceId } = await params;
    const auth = await requireAuthenticatedUser();
    if (!auth.ok) return auth.response;
    const { user, supabase } = auth;

    const { data: plan, error: planError } = await supabase
      .from("workspaces")
      .select("id, user_id")
      .eq("id", workspaceId)
      .single();

    if (planError?.code === "PGRST116" || !plan) {
      return jsonError(404, "Workspace not found");
    }

    if (!canUserManageWorkspace(plan, user.id)) {
      return jsonError(403, "Only the workspace owner can archive or restore it");
    }

    const workspace = await setWorkspaceArchived(
      createAdminClient(),
      workspaceId,
      user.id,
      true
    );

    return NextResponse.json({
      success: true,
      workspace: {
        id: workspace.id,
        status: workspace.status,
        archived_at: workspace.archived_at,
        title: workspace.title || workspace.root_topic,
      },
      message: "Workspace archived. It is hidden from your dashboard but data is preserved.",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to archive workspace";
    const status = message.includes("not found") ? 404 : message.includes("owner") ? 403 : 500;
    return jsonError(status, message);
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: workspaceId } = await params;
    const auth = await requireAuthenticatedUser();
    if (!auth.ok) return auth.response;
    const { user, supabase } = auth;

    const { data: plan, error: planError } = await supabase
      .from("workspaces")
      .select("id, user_id")
      .eq("id", workspaceId)
      .single();

    if (planError?.code === "PGRST116" || !plan) {
      return jsonError(404, "Workspace not found");
    }

    if (!canUserManageWorkspace(plan, user.id)) {
      return jsonError(403, "Only the workspace owner can archive or restore it");
    }

    const workspace = await setWorkspaceArchived(
      createAdminClient(),
      workspaceId,
      user.id,
      false
    );

    return NextResponse.json({
      success: true,
      workspace: {
        id: workspace.id,
        status: workspace.status,
        archived_at: workspace.archived_at,
        title: workspace.title || workspace.root_topic,
      },
      message: "Workspace restored to active.",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to restore workspace";
    const status = message.includes("not found") ? 404 : message.includes("owner") ? 403 : 500;
    return jsonError(status, message);
  }
}