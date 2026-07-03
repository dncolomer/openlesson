import type { SupabaseClient } from "@supabase/supabase-js";

export type WorkspaceLifecycleStatus = "active" | "paused" | "completed" | "archived" | string;

export interface WorkspaceArchiveRow {
  id: string;
  user_id: string;
  status: WorkspaceLifecycleStatus | null;
  archived_at: string | null;
  title?: string | null;
  root_topic?: string | null;
}

export function isWorkspaceArchived(workspace: { status?: string | null }): boolean {
  return workspace.status === "archived";
}

export function canUserManageWorkspace(workspace: { user_id: string }, userId: string): boolean {
  return workspace.user_id === userId;
}

export async function setWorkspaceArchived(
  supabase: SupabaseClient,
  workspaceId: string,
  userId: string,
  archived: boolean
): Promise<WorkspaceArchiveRow> {
  const { data: workspace, error: fetchError } = await supabase
    .from("learning_plans")
    .select("id, user_id, status, archived_at, title, root_topic")
    .eq("id", workspaceId)
    .single();

  if (fetchError || !workspace) {
    throw new Error("Workspace not found");
  }

  if (!canUserManageWorkspace(workspace, userId)) {
    throw new Error("Only the workspace owner can archive or restore it");
  }

  const nextStatus = archived ? "archived" : "active";
  const { data: updated, error: updateError } = await supabase
    .from("learning_plans")
    .update({
      status: nextStatus,
      archived_at: archived ? new Date().toISOString() : null,
    })
    .eq("id", workspaceId)
    .eq("user_id", userId)
    .select("id, user_id, status, archived_at, title, root_topic")
    .single();

  if (updateError || !updated) {
    throw new Error(updateError?.message || "Failed to update workspace archive status");
  }

  return updated;
}