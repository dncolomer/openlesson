import type { SupabaseClient } from "@supabase/supabase-js";
import { canCreateWorkspace, type UserProfile, type WorkspaceCheckResult } from "@/lib/plans";
import { countActiveWorkspaces } from "@/lib/usage-metrics";

export { countActiveWorkspaces };

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