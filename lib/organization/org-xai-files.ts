/**
 * Org-scoped xAI Files: one write/read/delete path for workspace files,
 * session artifacts, and proof-of-work. When the workspace (or user) has an
 * organization, uploads use that org’s API key and attach to the org collection
 * so later get/delete/score can resolve the same `file_` ids.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { getBlobStore } from "@/lib/ai/blob-store";
import {
  attachFileToOrgCollection,
  ensureOrgXaiApiKey,
} from "@/lib/organization/ensure-xai-resources";
import {
  loadOrgBackendRecord,
  loadOrgBackendRuntime,
  runWithOrgBackendRuntime,
} from "@/lib/organization/org-backend-runtime";
import { readOrgBackendStored } from "@/lib/organization/org-backends";
import type { XAIFileMetadata } from "@/lib/xai-files";

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
  const client = options?.admin ?? (organizationId ? createAdminClient() : undefined);
  const runtime = client
    ? await loadOrgBackendRuntime(client, organizationId)
    : null;
  const apiKey =
    runtime?.blob.apiKey ||
    runtime?.chat.apiKey ||
    (await resolveOrgXaiApiKey(organizationId, options?.admin));
  const fields: Record<string, string> = {
    ...(apiKey ? { apiKey } : {}),
    ...(organizationId ? { organizationId } : {}),
    ...(options?.collectionFields || {}),
  };
  const putBlob = async () =>
    getBlobStore().put({
      name,
      mimeType,
      bytes: base64Data,
      fields: Object.keys(fields).length ? fields : undefined,
    });
  const put = runtime
    ? await runWithOrgBackendRuntime(organizationId, runtime, putBlob)
    : await putBlob();
  const uploaded: XAIFileMetadata = {
    file_id: put.id,
    name,
    size_bytes: 0,
    content_type: mimeType,
  };
  let collectionId: string | null = null;
  const storedBlob = readOrgBackendStored(
    client ? await loadOrgBackendRecord(client, organizationId) : null,
  );
  if (organizationId && runtime?.blob.kind === "xai" && storedBlob.blob_backend !== "custom") {
    try {
      const adminClient = client ?? createAdminClient();
      collectionId = await attachFileToOrgCollection(
        adminClient,
        organizationId,
        put.id,
        options?.collectionFields,
      );
    } catch (err) {
      console.error("[uploadOrgScopedXaiFile] collection attach failed:", err);
    }
  }
  return { file_id: put.id, collectionId, apiKey, uploaded };
}

export async function getOrgScopedFileContentResponse(
  fileId: string,
  organizationId: string | null | undefined,
): Promise<Response> {
  const orgId = asOrgId(organizationId);
  const admin = orgId ? createAdminClient() : null;
  const runtime = admin ? await loadOrgBackendRuntime(admin, orgId) : null;
  const apiKey = runtime?.blob.apiKey || runtime?.chat.apiKey || (await resolveOrgXaiApiKey(orgId));
  const fields = apiKey ? { apiKey } : undefined;
  const load = async () => {
    const file = await getBlobStore().get(fileId, fields);
    return new Response(Buffer.from(file.bytes), {
      status: file.status,
      headers: { "Content-Type": file.mimeType },
    });
  };
  if (runtime) {
    return runWithOrgBackendRuntime(orgId, runtime, load);
  }
  return load();
}

export async function deleteOrgScopedXaiFile(
  fileId: string,
  organizationId: string | null | undefined,
): Promise<boolean> {
  const orgId = asOrgId(organizationId);
  const admin = orgId ? createAdminClient() : null;
  const runtime = admin ? await loadOrgBackendRuntime(admin, orgId) : null;
  const apiKey = runtime?.blob.apiKey || runtime?.chat.apiKey || (await resolveOrgXaiApiKey(orgId));
  const remove = () => getBlobStore().delete(fileId, apiKey ? { apiKey } : undefined);
  if (runtime) {
    return runWithOrgBackendRuntime(orgId, runtime, remove);
  }
  return remove();
}
