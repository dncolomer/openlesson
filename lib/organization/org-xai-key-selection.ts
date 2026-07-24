/**
 * Pure selection: which organizations need an individual xAI inference API key.
 * Runtime ensure remains in ensure-xai-resources.ts; this only decides who to backfill.
 */

export type OrgXaiKeyEligibility = {
  id: string;
  archived_at?: string | null;
  plan?: string | null;
  subscription_status?: string | null;
  billing_mode?: string | null;
  xai_api_key_status?: string | null;
  xai_api_key_id?: string | null;
  xai_api_key_ciphertext?: string | null;
  xai_collection_id?: string | null;
  xai_collection_status?: string | null;
};

const PAID_PLANS = new Set(["trial", "api_metered"]);

/** True when org already has a usable individual xAI key stored. */
export function orgHasReadyXaiApiKey(org: OrgXaiKeyEligibility): boolean {
  return (
    org.xai_api_key_status === "ready" &&
    !!org.xai_api_key_id &&
    !!org.xai_api_key_ciphertext
  );
}

/** Product-entitled org (subscription active paid, or partner grant). */
export function orgIsProductEntitled(org: OrgXaiKeyEligibility): boolean {
  if (org.archived_at) return false;
  const plan = org.plan || "inactive";
  const mode = org.billing_mode || "subscription";
  if (mode === "partner") {
    return plan !== "inactive" && PAID_PLANS.has(plan);
  }
  if (org.subscription_status !== "active") return false;
  return PAID_PLANS.has(plan);
}

/** Org already has a ready xAI Collection ("folder"). */
export function orgHasReadyXaiCollection(org: OrgXaiKeyEligibility): boolean {
  return (
    org.xai_collection_status === "ready" && !!org.xai_collection_id
  );
}

/**
 * Should we provision an individual xAI API key for this org?
 * - Already ready → no
 * - Archived → no
 * - Product-entitled (active paid / partner) → yes
 * - Inactive but has ready collection → yes
 * - Inactive with no collection → no
 */
export function orgNeedsXaiApiKey(org: OrgXaiKeyEligibility): boolean {
  if (org.archived_at) return false;
  if (orgHasReadyXaiApiKey(org)) return false;
  if (orgIsProductEntitled(org)) return true;
  if (orgHasReadyXaiCollection(org)) return true;
  return false;
}

export type NeedsKeyReason =
  | "already_ready"
  | "archived"
  | "entitled"
  | "has_collection"
  | "skip_inactive_no_collection";

export function orgNeedsXaiApiKeyReason(org: OrgXaiKeyEligibility): NeedsKeyReason {
  if (org.archived_at) return "archived";
  if (orgHasReadyXaiApiKey(org)) return "already_ready";
  if (orgIsProductEntitled(org)) return "entitled";
  if (orgHasReadyXaiCollection(org)) return "has_collection";
  return "skip_inactive_no_collection";
}
