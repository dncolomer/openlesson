import type { SupabaseClient } from "@supabase/supabase-js";
import { sealString, openSealedString } from "@/lib/crypto/seal";
import {
  addFileToCollection,
  createCollection,
  createTeamApiKey,
  deleteTeamApiKey,
  isXaiManagementConfigured,
  orgXaiResourceName,
} from "@/lib/xai-management";

export type OrgXaiRow = {
  id: string;
  slug: string;
  name: string;
  xai_api_key_id: string | null;
  xai_api_key_name: string | null;
  xai_api_key_ciphertext: string | null;
  xai_api_key_status: string | null;
  xai_collection_id: string | null;
  xai_collection_name: string | null;
  xai_collection_status: string | null;
};

const ORG_XAI_SELECT =
  "id, slug, name, xai_api_key_id, xai_api_key_name, xai_api_key_ciphertext, xai_api_key_status, xai_collection_id, xai_collection_name, xai_collection_status";

/**
 * Ensure the org has an xAI API key. Returns the plaintext key for server use.
 * Falls back to platform XAI_API_KEY when Management API is not configured or provisioning fails.
 */
export async function ensureOrgXaiApiKey(
  admin: SupabaseClient,
  organizationId: string
): Promise<{ apiKey: string; apiKeyId: string | null; fromOrg: boolean }> {
  const platformKey = process.env.XAI_API_KEY;
  if (!platformKey) {
    throw new Error("XAI_API_KEY not configured");
  }

  const { data: org, error } = await admin
    .from("organizations")
    .select(ORG_XAI_SELECT)
    .eq("id", organizationId)
    .single();

  if (error || !org) {
    return { apiKey: platformKey, apiKeyId: null, fromOrg: false };
  }

  const row = org as OrgXaiRow;

  if (
    row.xai_api_key_status === "ready" &&
    row.xai_api_key_ciphertext &&
    row.xai_api_key_id
  ) {
    try {
      const apiKey = openSealedString(row.xai_api_key_ciphertext);
      return { apiKey, apiKeyId: row.xai_api_key_id, fromOrg: true };
    } catch (err) {
      console.error("[ensureOrgXaiApiKey] decrypt failed:", err);
    }
  }

  if (!isXaiManagementConfigured()) {
    return { apiKey: platformKey, apiKeyId: null, fromOrg: false };
  }

  try {
    const name = orgXaiResourceName("openlesson-org", row.slug || "org", row.id);
    const created = await createTeamApiKey({ name });
    const ciphertext = sealString(created.apiKey);

    await admin
      .from("organizations")
      .update({
        xai_api_key_id: created.apiKeyId,
        xai_api_key_name: created.name,
        xai_api_key_ciphertext: ciphertext,
        xai_api_key_status: "ready",
        xai_api_key_error: null,
        xai_api_key_created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", organizationId);

    return { apiKey: created.apiKey, apiKeyId: created.apiKeyId, fromOrg: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[ensureOrgXaiApiKey] provision failed:", message);
    await admin
      .from("organizations")
      .update({
        xai_api_key_status: "error",
        xai_api_key_error: message.slice(0, 500),
        updated_at: new Date().toISOString(),
      })
      .eq("id", organizationId);
    return { apiKey: platformKey, apiKeyId: null, fromOrg: false };
  }
}

/**
 * Resolve API key for an org without creating (uses platform fallback).
 */
export async function getXaiApiKeyForOrganization(
  admin: SupabaseClient,
  organizationId: string | null | undefined
): Promise<string> {
  const platformKey = process.env.XAI_API_KEY;
  if (!platformKey) {
    throw new Error("XAI_API_KEY not configured");
  }
  if (!organizationId) return platformKey;

  const { data: org } = await admin
    .from("organizations")
    .select("xai_api_key_status, xai_api_key_ciphertext")
    .eq("id", organizationId)
    .maybeSingle();

  if (org?.xai_api_key_status === "ready" && org.xai_api_key_ciphertext) {
    try {
      return openSealedString(org.xai_api_key_ciphertext);
    } catch {
      /* fall through */
    }
  }

  // Lazy provision
  const ensured = await ensureOrgXaiApiKey(admin, organizationId);
  return ensured.apiKey;
}

/**
 * Ensure org has an xAI Collection for grouping PoW documents.
 */
export async function ensureOrgXaiCollection(
  admin: SupabaseClient,
  organizationId: string
): Promise<{ collectionId: string | null; ready: boolean }> {
  const { data: org, error } = await admin
    .from("organizations")
    .select(ORG_XAI_SELECT)
    .eq("id", organizationId)
    .single();

  if (error || !org) {
    return { collectionId: null, ready: false };
  }

  const row = org as OrgXaiRow;
  if (row.xai_collection_status === "ready" && row.xai_collection_id) {
    return { collectionId: row.xai_collection_id, ready: true };
  }

  if (!isXaiManagementConfigured()) {
    return { collectionId: null, ready: false };
  }

  try {
    const name = orgXaiResourceName("openlesson-pow", row.slug || "org", row.id);
    const created = await createCollection({
      name,
      description: `Uncertain Systems PoW collection for org ${row.id} (${row.name})`,
    });

    await admin
      .from("organizations")
      .update({
        xai_collection_id: created.collectionId,
        xai_collection_name: created.collectionName,
        xai_collection_status: "ready",
        xai_collection_error: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", organizationId);

    return { collectionId: created.collectionId, ready: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[ensureOrgXaiCollection] failed:", message);
    await admin
      .from("organizations")
      .update({
        xai_collection_status: "error",
        xai_collection_error: message.slice(0, 500),
        updated_at: new Date().toISOString(),
      })
      .eq("id", organizationId);
    return { collectionId: null, ready: false };
  }
}

/** Best-effort attach of an uploaded file to the org collection. */
export async function attachFileToOrgCollection(
  admin: SupabaseClient,
  organizationId: string,
  fileId: string,
  fields?: Record<string, string>
): Promise<string | null> {
  try {
    const { collectionId, ready } = await ensureOrgXaiCollection(admin, organizationId);
    if (!ready || !collectionId) return null;
    await addFileToCollection(collectionId, fileId, fields);
    return collectionId;
  } catch (err) {
    console.error("[attachFileToOrgCollection] failed:", err);
    return null;
  }
}

/** Rotate org API key (delete old + create new). */
export async function rotateOrgXaiApiKey(
  admin: SupabaseClient,
  organizationId: string
): Promise<{ ok: boolean; error?: string }> {
  if (!isXaiManagementConfigured()) {
    return { ok: false, error: "XAI Management API not configured" };
  }

  const { data: org } = await admin
    .from("organizations")
    .select("xai_api_key_id")
    .eq("id", organizationId)
    .single();

  if (org?.xai_api_key_id) {
    try {
      await deleteTeamApiKey(org.xai_api_key_id);
    } catch (err) {
      console.error("[rotateOrgXaiApiKey] delete old key:", err);
    }
  }

  await admin
    .from("organizations")
    .update({
      xai_api_key_id: null,
      xai_api_key_ciphertext: null,
      xai_api_key_status: "pending",
      xai_api_key_error: null,
    })
    .eq("id", organizationId);

  const result = await ensureOrgXaiApiKey(admin, organizationId);
  return result.fromOrg ? { ok: true } : { ok: false, error: "Provision fell back to platform key" };
}
