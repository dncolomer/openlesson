// ============================================
// Product entitlement for billable API routes
// Mirrors middleware hasProductAccess for non-page callers.
// ============================================

import type { NextResponse } from "next/server";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { jsonError } from "@/lib/api-error-envelope";
import { hasProductAccess, type ProductAccessOrg, type ProductAccessProfile } from "@/lib/plans";
import { ensureTrialExpiryApplied } from "@/lib/usage-metrics";
import { createAdminClient } from "@/lib/supabase/admin";

export type ProductAccessResult =
  | { ok: true; profile: ProductAccessProfile; org: ProductAccessOrg | null }
  | { ok: false; response: NextResponse };

export type ProductAccessSnapshot =
  | {
      ok: true;
      profile: ProductAccessProfile;
      org: ProductAccessOrg | null;
      hasPaidAccess: boolean;
    }
  | { ok: false; response: NextResponse };

/**
 * Load profile + org billing without requiring a paid module.
 * Free accounts (`hasPaidAccess === false`) may still use Home / My Maps.
 */
export async function loadProductAccessSnapshot(
  supabase: SupabaseClient,
  userId: string,
): Promise<ProductAccessSnapshot> {
  const { data: rawProfile, error } = await supabase
    .from("profiles")
    .select(
      "plan, subscription_status, is_admin, organization_id, token_tier, token_validity_expires_at, current_period_end"
    )
    .eq("id", userId)
    .single();

  if (error || !rawProfile) {
    return {
      ok: false,
      response: jsonError(403, "Profile not found", "profile_required"),
    };
  }

  // Trial demotion may need service role after privileged-column freeze.
  let profile = rawProfile as ProductAccessProfile & {
    plan: string;
    subscription_status: string;
    current_period_end: string | null;
  };
  try {
    const admin = createAdminClient();
    profile = await ensureTrialExpiryApplied(admin, userId, profile);
  } catch {
    profile = await ensureTrialExpiryApplied(supabase, userId, profile);
  }

  let org: ProductAccessOrg | null = null;
  if (profile.organization_id) {
    try {
      const admin = createAdminClient();
      const { data: orgRow } = await admin
        .from("organizations")
        .select("id, plan, subscription_status, current_period_end, billing_mode, archived_at")
        .eq("id", profile.organization_id)
        .maybeSingle();
      org = (orgRow as ProductAccessOrg | null) ?? null;
    } catch {
      const { data: orgRow } = await supabase
        .from("organizations")
        .select("id, plan, subscription_status, current_period_end, billing_mode, archived_at")
        .eq("id", profile.organization_id)
        .maybeSingle();
      org = (orgRow as ProductAccessOrg | null) ?? null;
    }
  }

  return {
    ok: true,
    profile,
    org,
    hasPaidAccess: hasProductAccess(profile, org),
  };
}

/**
 * Verify the authenticated user has product entitlement (admin, valid token,
 * or entitled organization). Same rules as middleware `hasProductAccess`.
 * Skip this for AYCL token, TAP private-token, and Proof-of-Work API-key auth paths.
 */
export async function requireProductAccess(
  supabase: SupabaseClient,
  user: User
): Promise<ProductAccessResult> {
  const snapshot = await loadProductAccessSnapshot(supabase, user.id);
  if (!snapshot.ok) return snapshot;
  if (!snapshot.hasPaidAccess) {
    return {
      ok: false,
      response: jsonError(403, "Active subscription required", "product_access_required", {
        renew_url: "/pricing",
      }),
    };
  }
  return { ok: true, profile: snapshot.profile, org: snapshot.org };
}
