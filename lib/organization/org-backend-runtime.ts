/**
 * Load org BYOK (or platform fallback) and expose it on the request ALS.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { openSealedString } from "@/lib/crypto/seal";
import { getPlatformChatConfig } from "@/lib/ai/chat";
import { enterXaiContext, runWithXaiContext } from "@/lib/xai-context";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  platformBlobConfigFromEnv,
  readOrgBackendStored,
  resolveOrgRuntime,
  type OrgBackendRecord,
  type OrgBackendRuntime,
} from "@/lib/organization/org-backends";

const ORG_BACKEND_SELECT =
  "llm_backend, llm_provider, llm_base_url, llm_api_key_ciphertext, llm_api_key_last_four, llm_model, blob_backend, blob_provider, blob_base_url, blob_api_key_ciphertext, blob_api_key_last_four, openrouter_api_key_ciphertext, openrouter_api_key_last_four";

function openCustomerSecret(ciphertext: string | null | undefined): string | null {
  const sealed = String(ciphertext || "").trim();
  if (!sealed) return null;
  try {
    return openSealedString(sealed);
  } catch (err) {
    console.error("[org-backends] failed to open customer secret:", err);
    return null;
  }
}

export async function loadOrgBackendRecord(
  admin: SupabaseClient,
  organizationId: string | null | undefined,
): Promise<OrgBackendRecord | null> {
  const id = String(organizationId || "").trim();
  if (!id) return null;
  const { data, error } = await admin
    .from("organizations")
    .select(ORG_BACKEND_SELECT)
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return null;
  return data as OrgBackendRecord;
}

export function runtimeFromOrgRecord(org: OrgBackendRecord | null | undefined): OrgBackendRuntime {
  const stored = readOrgBackendStored(org);
  const llmApiKey =
    stored.llm_backend === "custom" ? openCustomerSecret(stored.llm_api_key_ciphertext) : null;
  const blobApiKey =
    stored.blob_backend === "custom" ? openCustomerSecret(stored.blob_api_key_ciphertext) : null;
  return resolveOrgRuntime(
    stored,
    getPlatformChatConfig(),
    platformBlobConfigFromEnv(),
    { llmApiKey, blobApiKey },
  );
}

export async function loadOrgBackendRuntime(
  admin: SupabaseClient,
  organizationId: string | null | undefined,
): Promise<OrgBackendRuntime> {
  const org = await loadOrgBackendRecord(admin, organizationId);
  return runtimeFromOrgRecord(org);
}

function contextFromRuntime(
  organizationId: string | null | undefined,
  runtime: OrgBackendRuntime,
) {
  return {
    organizationId: organizationId ?? null,
    apiKey: runtime.chat.apiKey,
    chatConfig: runtime.chat,
    blobKind: runtime.blob.kind,
    blobBaseURL: runtime.blob.baseURL,
    blobApiKey: runtime.blob.apiKey,
  };
}

export function runWithOrgBackendRuntime<T>(
  organizationId: string | null | undefined,
  runtime: OrgBackendRuntime,
  fn: () => T,
): T {
  return runWithXaiContext(contextFromRuntime(organizationId, runtime), fn);
}

export function bindOrgBackendRuntime(
  organizationId: string | null | undefined,
  runtime: OrgBackendRuntime,
): void {
  enterXaiContext(contextFromRuntime(organizationId, runtime));
}

export async function bindOrgBackendContext(
  admin: SupabaseClient,
  organizationId: string | null | undefined,
): Promise<OrgBackendRuntime> {
  const runtime = await loadOrgBackendRuntime(admin, organizationId);
  bindOrgBackendRuntime(organizationId, runtime);
  return runtime;
}

let openRouterApiKeyForTests: string | null | undefined;

/** `undefined` restores DB lookup. `null` simulates a missing org key. */
export function setOrgOpenRouterApiKeyForTests(key: string | null | undefined): void {
  openRouterApiKeyForTests = key;
}

export function openOrgOpenRouterApiKey(org: OrgBackendRecord | null | undefined): string | null {
  const stored = readOrgBackendStored(org);
  return openCustomerSecret(stored.openrouter_api_key_ciphertext);
}

export async function loadOpenRouterApiKeyForOwner(
  admin: SupabaseClient,
  userId: string | null | undefined,
): Promise<string | null> {
  if (openRouterApiKeyForTests !== undefined) return openRouterApiKeyForTests;
  const id = String(userId || "").trim();
  if (!id) return null;
  const { data: profile } = await admin
    .from("profiles")
    .select("organization_id")
    .eq("id", id)
    .maybeSingle();
  const org = await loadOrgBackendRecord(admin, profile?.organization_id);
  return openOrgOpenRouterApiKey(org);
}

export async function loadOpenRouterApiKeyForOwnerUser(
  userId: string | null | undefined,
): Promise<string | null> {
  if (openRouterApiKeyForTests !== undefined) return openRouterApiKeyForTests;
  try {
    return loadOpenRouterApiKeyForOwner(createAdminClient(), userId);
  } catch (err) {
    console.error("[org-backends] OpenRouter key lookup failed:", err);
    return null;
  }
}

export async function bindOrgBackendContextForUser(
  admin: SupabaseClient,
  userId: string | null | undefined,
): Promise<OrgBackendRuntime> {
  const id = String(userId || "").trim();
  if (!id) {
    const runtime = runtimeFromOrgRecord(null);
    bindOrgBackendRuntime(null, runtime);
    return runtime;
  }
  const { data } = await admin
    .from("profiles")
    .select("organization_id")
    .eq("id", id)
    .maybeSingle();
  return bindOrgBackendContext(admin, data?.organization_id);
}
