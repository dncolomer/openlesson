import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";

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

function workspaceLookupError(error: PostgrestError | null): Error {
  if (!error) {
    return new Error("Workspace not found");
  }
  if (error.code === "PGRST116") {
    return new Error("Workspace not found");
  }
  return new Error(`Workspace lookup failed: ${error.message}`);
}

async function applyArchiveUpdate(
  supabase: SupabaseClient,
  workspaceId: string,
  userId: string,
  archived: boolean
): Promise<WorkspaceArchiveRow> {
  const nextStatus = archived ? "archived" : "active";
  const archivedAt = archived ? new Date().toISOString() : null;

  const { data, error } = await supabase
    .from("workspaces")
    .update({
      status: nextStatus,
      archived_at: archivedAt,
    })
    .eq("id", workspaceId)
    .eq("user_id", userId)
    .select("id, user_id, status, archived_at, title, root_topic")
    .single();

  if (error || !data) {
    throw new Error(error?.message || "Failed to update workspace archive status");
  }

  return data as WorkspaceArchiveRow;
}

export async function setWorkspaceArchived(
  supabase: SupabaseClient,
  workspaceId: string,
  userId: string,
  archived: boolean
): Promise<WorkspaceArchiveRow> {
  const { data: workspace, error: fetchError } = await supabase
    .from("workspaces")
    .select("id, user_id, status, archived_at, title, root_topic")
    .eq("id", workspaceId)
    .single();

  if (fetchError || !workspace) {
    throw workspaceLookupError(fetchError);
  }

  if (!canUserManageWorkspace(workspace, userId)) {
    throw new Error("Only the workspace owner can archive or restore it");
  }

  return applyArchiveUpdate(supabase, workspaceId, userId, archived);
}
