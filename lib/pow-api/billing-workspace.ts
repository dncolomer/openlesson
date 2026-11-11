import type { SupabaseClient } from "@supabase/supabase-js";
import type { UploadWorkspaceProofOfWorkWorkspace } from "@/lib/pow-api/upload-workspace-proof-of-work";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isProofWorkspaceId(value: string | null | undefined): value is string {
  return typeof value === "string" && UUID_RE.test(value.trim());
}

export function stubBillingWorkspace(input: {
  workspaceId?: string | null;
  userId?: string | null;
  organizationId?: string | null;
}): UploadWorkspaceProofOfWorkWorkspace {
  return {
    id: isProofWorkspaceId(input.workspaceId) ? input.workspaceId.trim() : "",
    user_id: input.userId || null,
    organization_id: input.organizationId || null,
  };
}

export async function loadBillingWorkspaceForProof(
  supabase: SupabaseClient,
  input: {
    workspaceId?: string | null;
    ownerUserId?: string | null;
    organizationId?: string | null;
  },
): Promise<UploadWorkspaceProofOfWorkWorkspace> {
  const workspaceId = String(input.workspaceId || "").trim();
  if (isProofWorkspaceId(workspaceId)) {
    const { data } = await supabase
      .from("workspaces")
      .select(
        "id, user_id, organization_id, evaluation_mode, protocol_config, external_refs, title, root_topic",
      )
      .eq("id", workspaceId)
      .maybeSingle();
    if (data) {
      return {
        id: String(data.id),
        user_id: data.user_id ? String(data.user_id) : null,
        organization_id: data.organization_id ? String(data.organization_id) : null,
        evaluation_mode: (data as { evaluation_mode?: string | null }).evaluation_mode,
        protocol_config: (data as { protocol_config?: unknown }).protocol_config,
        external_refs: (data as { external_refs?: unknown }).external_refs,
        title: (data as { title?: string | null }).title,
        root_topic: (data as { root_topic?: string | null }).root_topic,
      };
    }
  }
  return stubBillingWorkspace({
    workspaceId,
    userId: input.ownerUserId || null,
    organizationId: input.organizationId || null,
  });
}

export async function billingWorkspaceFromTapAccess(access: {
  supabase: SupabaseClient;
  workspaceId: string;
  workspaceOwnerUserId?: string | null;
  organizationId?: string | null;
  userId?: string | null;
}): Promise<UploadWorkspaceProofOfWorkWorkspace> {
  return loadBillingWorkspaceForProof(access.supabase, {
    workspaceId: access.workspaceId,
    ownerUserId: access.workspaceOwnerUserId || access.userId || null,
    organizationId: access.organizationId || null,
  });
}
