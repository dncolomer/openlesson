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

function isMissingArchivedAtColumn(error: PostgrestError | null): boolean {
  if (!error) return false;
  const message = error.message.toLowerCase();
  return (
    error.code === "42703" ||
    message.includes("archived_at") ||
    message.includes("column") && message.includes("does not exist")
  );
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

  const withTimestamp = await supabase
    .from("learning_plans")
    .update({
      status: nextStatus,
      archived_at: archivedAt,
    })
    .eq("id", workspaceId)
    .eq("user_id", userId)
    .select("id, user_id, status, title, root_topic")
    .single();

  if (!withTimestamp.error && withTimestamp.data) {
    return {
      ...withTimestamp.data,
      archived_at: archivedAt,
    };
  }

  if (isMissingArchivedAtColumn(withTimestamp.error)) {
    const statusOnly = await supabase
      .from("learning_plans")
      .update({ status: nextStatus })
      .eq("id", workspaceId)
      .eq("user_id", userId)
      .select("id, user_id, status, title, root_topic")
      .single();

    if (statusOnly.error || !statusOnly.data) {
      throw new Error(statusOnly.error?.message || "Failed to update workspace archive status");
    }

    return {
      ...statusOnly.data,
      archived_at: null,
    };
  }

  throw new Error(withTimestamp.error?.message || "Failed to update workspace archive status");
}

export async function setWorkspaceArchived(
  supabase: SupabaseClient,
  workspaceId: string,
  userId: string,
  archived: boolean
): Promise<WorkspaceArchiveRow> {
  const { data: workspace, error: fetchError } = await supabase
    .from("learning_plans")
    .select("id, user_id, status, title, root_topic")
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