/**
 * Org-scoped xAI Files: one write/read/delete path for workspace files,
 * session artifacts, and proof-of-work. When the workspace (or user) has an
 * organization, uploads use that org’s API key and attach to the org collection
 * so later get/delete/score can resolve the same `file_` ids.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { runWithXaiContext } from "@/lib/xai-context";
import {
  attachFileToOrgCollection,
  ensureOrgXaiApiKey,
} from "@/lib/organization/ensure-xai-resources";
import {
  deleteFileFromXAI,
  getFileContentResponse,
  uploadFileToXAI,
  type XAIFileMetadata,
} from "@/lib/xai-files";

function asOrgId(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export async function organizationIdFromWorkspace(
  supabase: SupabaseClient,
  workspaceId: string | null | undefined,
): Promise<string | null> {
  if (!workspaceId) return null;
  const { data } = await supabase
    .from("workspaces")
    .select("organization_id")
    .eq("id", workspaceId)
    .maybeSingle();
  return asOrgId(data?.organization_id);
}

export async function organizationIdFromUser(
  supabase: SupabaseClient,
  userId: string | null | undefined,
): Promise<string | null> {
  if (!userId) return null;
  const { data } = await supabase
    .from("profiles")
    .select("organization_id")
    .eq("id", userId)
    .maybeSingle();
  return asOrgId(data?.organization_id);
}

export async function organizationIdFromSession(
  supabase: SupabaseClient,
  sessionId: string | null | undefined,
): Promise<string | null> {
  if (!sessionId) return null;
  const { data } = await supabase
    .from("sessions")
    .select("user_id, metadata")
    .eq("id", sessionId)
    .maybeSingle();
  const meta =
    data?.metadata && typeof data.metadata === "object" && !Array.isArray(data.metadata)
      ? (data.metadata as Record<string, unknown>)
      : {};
  const workspaceId = asOrgId(meta.workspace_id);
  const fromWorkspace = await organizationIdFromWorkspace(supabase, workspaceId);
  if (fromWorkspace) return fromWorkspace;
  return organizationIdFromUser(supabase, asOrgId(data?.user_id));
}

export async function resolveOrgXaiApiKey(
  organizationId: string | null | undefined,
  admin?: SupabaseClient,
): Promise<string | null> {
  if (!organizationId) return null;
  try {
    const client = admin ?? createAdminClient();
    return (await ensureOrgXaiApiKey(client, organizationId)).apiKey;
  } catch (err) {
    console.error("[resolveOrgXaiApiKey] failed:", err);
    return null;
  }
}

export async function uploadOrgScopedXaiFile(
  name: string,
  mimeType: string,
  base64Data: string,
  options?: {
    organizationId?: string | null;
    collectionFields?: Record<string, string>;
    admin?: SupabaseClient;
  },
): Promise<{
  file_id: string;
  collectionId: string | null;
  apiKey: string | null;
  uploaded: XAIFileMetadata;
}> {
  const organizationId = asOrgId(options?.organizationId);
  const apiKey = await resolveOrgXaiApiKey(organizationId, options?.admin);
  const uploaded = await uploadFileToXAI(name, mimeType, base64Data, { apiKey });
  let collectionId: string | null = null;
  if (organizationId) {
    try {
      const client = options?.admin ?? createAdminClient();
      collectionId = await attachFileToOrgCollection(
        client,
        organizationId,
        uploaded.file_id,
        options?.collectionFields,
      );
    } catch (err) {
      console.error("[uploadOrgScopedXaiFile] collection attach failed:", err);
    }
  }
  return { file_id: uploaded.file_id, collectionId, apiKey, uploaded };
}

export async function getOrgScopedFileContentResponse(
  fileId: string,
  organizationId: string | null | undefined,
): Promise<Response> {
  const orgId = asOrgId(organizationId);
  const apiKey = await resolveOrgXaiApiKey(orgId);
  if (orgId && apiKey) {
    return runWithXaiContext({ organizationId: orgId, apiKey }, () =>
      getFileContentResponse(fileId, { apiKey }),
    );
  }
  return getFileContentResponse(fileId, { apiKey });
}

export async function deleteOrgScopedXaiFile(
  fileId: string,
  organizationId: string | null | undefined,
): Promise<boolean> {
  const apiKey = await resolveOrgXaiApiKey(organizationId);
  return deleteFileFromXAI(fileId, { apiKey });
}
