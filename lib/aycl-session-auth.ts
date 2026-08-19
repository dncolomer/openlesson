import { createAdminClient } from "@/lib/supabase/admin";
import {
  getAyclPurchaseByToken,
  sessionBelongsToAyclFork,
  type AyclPurchase,
} from "@/lib/aycl";
import {
  normalizeAyclAccessTier,
  resolveAyclCapabilities,
  type AyclCapabilities,
} from "@/lib/aycl-shared";
import { ayclSubjectId } from "@/lib/workspace-access-policy";

export interface ResolvedAyclContext {
  supabase: ReturnType<typeof createAdminClient>;
  purchase: AyclPurchase;
  workspaceId: string;
  ownerUserId: string;
  /** Purchase subject — never the workspace owner User. */
  subjectId: string;
  accessTier: ReturnType<typeof normalizeAyclAccessTier>;
  capabilities: AyclCapabilities;
}

export async function resolveAyclAccess(
  accessToken: string
): Promise<ResolvedAyclContext | { error: string; status: number }> {
  const token = accessToken.trim();
  if (!token) return { error: "Access token required", status: 401 };

  const supabase = createAdminClient();
  const purchase = await getAyclPurchaseByToken(supabase, token);

  if (!purchase?.forked_workspace_id) {
    return { error: "Invalid or expired access link", status: 404 };
  }

  const { data: workspace, error } = await supabase
    .from("workspaces")
    .select("id, user_id")
    .eq("id", purchase.forked_workspace_id)
    .single();

  if (error || !workspace?.user_id) {
    return { error: "Workspace not found", status: 404 };
  }

  const accessTier = normalizeAyclAccessTier(purchase.access_tier);
  const capabilities = resolveAyclCapabilities(accessTier);
  const subjectId = ayclSubjectId(purchase.id);

  return {
    supabase,
    purchase,
    workspaceId: workspace.id,
    ownerUserId: workspace.user_id,
    subjectId,
    accessTier,
    capabilities,
  };
}

export async function resolveAyclSessionAccess(
  accessToken: string,
  sessionId: string
): Promise<ResolvedAyclContext | { error: string; status: number }> {
  const base = await resolveAyclAccess(accessToken);
  if ("error" in base) return base;

  const allowed = await sessionBelongsToAyclFork(
    base.supabase,
    sessionId,
    base.workspaceId
  );

  if (!allowed) {
    return { error: "Session not found", status: 404 };
  }

  return base;
}