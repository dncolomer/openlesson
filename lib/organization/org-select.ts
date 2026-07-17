/**
 * Shared select strings for organizations.
 * logo_url was added in 20260717200000_organization_logo — if that migration
 * has not been applied yet, Supabase returns a column error. Callers can fall
 * back to the without-logo variant so admin UIs stay usable.
 */

export const ORG_LIST_SELECT =
  "id, name, slug, logo_url, kind, billing_mode, plan, subscription_status, current_period_end, extra_lessons, billing_email, archived_at, xai_api_key_id, xai_api_key_name, xai_api_key_status, xai_collection_id, xai_collection_status, created_at, updated_at";

export const ORG_LIST_SELECT_NO_LOGO =
  "id, name, slug, kind, billing_mode, plan, subscription_status, current_period_end, extra_lessons, billing_email, archived_at, xai_api_key_id, xai_api_key_name, xai_api_key_status, xai_collection_id, xai_collection_status, created_at, updated_at";

export const ORG_DETAIL_SELECT =
  "id, name, slug, logo_url, metadata, kind, billing_mode, plan, subscription_status, current_period_end, extra_lessons, stripe_customer_id, stripe_subscription_id, billing_email, archived_at, xai_api_key_id, xai_api_key_name, xai_api_key_status, xai_api_key_error, xai_api_key_created_at, xai_collection_id, xai_collection_name, xai_collection_status, xai_collection_error, created_at, updated_at";

export const ORG_DETAIL_SELECT_NO_LOGO =
  "id, name, slug, metadata, kind, billing_mode, plan, subscription_status, current_period_end, extra_lessons, stripe_customer_id, stripe_subscription_id, billing_email, archived_at, xai_api_key_id, xai_api_key_name, xai_api_key_status, xai_api_key_error, xai_api_key_created_at, xai_collection_id, xai_collection_name, xai_collection_status, xai_collection_error, created_at, updated_at";

type PostgrestLikeError = {
  message?: string;
  code?: string;
  details?: string;
  hint?: string;
} | null;

/** True when PostgREST/Postgres reports that logo_url (or the column) is missing. */
export function isMissingLogoUrlColumn(error: PostgrestLikeError): boolean {
  if (!error) return false;
  const msg = `${error.message ?? ""} ${error.details ?? ""} ${error.hint ?? ""}`.toLowerCase();
  // 42703 = undefined_column
  if (error.code === "42703" && msg.includes("logo_url")) return true;
  if (msg.includes("logo_url") && (msg.includes("does not exist") || msg.includes("column"))) {
    return true;
  }
  return false;
}
