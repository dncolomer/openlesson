import type { SupabaseClient } from "@supabase/supabase-js";
import { canCreateWorkspace, type UserProfile, type WorkspaceCheckResult } from "@/lib/plans";

export async function countActiveWorkspaces(
  supabase: SupabaseClient,
  userId: string
): Promise<number> {
  const { count, error } = await supabase
    .from("learning_plans")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .neq("status", "archived");

  if (error) {
    console.error("[workspace-limits] count failed:", error);
    return 0;
  }

  return count ?? 0;
}

export async function checkWorkspaceCreation(
  supabase: SupabaseClient,
  userId: string,
  profile: UserProfile
): Promise<WorkspaceCheckResult> {
  const workspaceCount = await countActiveWorkspaces(supabase, userId);
  return canCreateWorkspace(profile, workspaceCount);
}

export function workspaceLimitErrorResponse(result: WorkspaceCheckResult) {
  return {
    error: result.reason || "Workspace limit reached",
    code: "workspace_limit_reached",
    used: result.used,
    limit: result.limit,
    renew_url: "/pricing",
  };
}