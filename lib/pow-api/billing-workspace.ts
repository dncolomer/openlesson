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
  _supabase: SupabaseClient,
  input: {
    workspaceId?: string | null;
    ownerUserId?: string | null;
    organizationId?: string | null;
  },
): Promise<UploadWorkspaceProofOfWorkWorkspace> {
  return stubBillingWorkspace({
    workspaceId: String(input.workspaceId || "").trim(),
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
