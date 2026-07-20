import type { AuthContext } from "./types";

export interface AgentWorkspaceAccess {
  user_id: string | null;
  organization_id: string | null;
  guest_user_id?: string | null;
}

/** Whether an API key may read/write a verification workspace (member, org, or guest-owned). */
export function canAccessAgentWorkspace(auth: AuthContext, workspace: AgentWorkspaceAccess): boolean {
  if (auth.user_id && workspace.user_id === auth.user_id) return true;
  if (auth.guest_user_id && workspace.guest_user_id === auth.guest_user_id) return true;
  if (auth.organization_id && workspace.organization_id === auth.organization_id) return true;
  return false;
}