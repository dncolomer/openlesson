// ============================================
// Product entitlement for billable API routes
// Mirrors middleware hasProductAccess for non-page callers.
// ============================================

import { NextResponse } from "next/server";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { hasProductAccess, type ProductAccessOrg, type ProductAccessProfile } from "@/lib/plans";
import { ensureTrialExpiryApplied } from "@/lib/usage-metrics";
import { createAdminClient } from "@/lib/supabase/admin";

export type ProductAccessResult =
  | { ok: true; profile: ProductAccessProfile; org: ProductAccessOrg | null }
  | { ok: false; response: NextResponse };

/**
 * Verify the authenticated user has product entitlement (admin, valid token,
 * or entitled organization). Same rules as middleware `hasProductAccess`.
 * Skip this for AYCL token, TAP private-token, and agent API-key auth paths.
 */
export async function requireProductAccess(
  supabase: SupabaseClient,
  user: User
): Promise<ProductAccessResult> {
  const { data: rawProfile, error } = await supabase
    .from("profiles")
    .select(
      "plan, subscription_status, is_admin, organization_id, token_tier, token_validity_expires_at, current_period_end"
    )
    .eq("id", user.id)
    .single();

  if (error || !rawProfile) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Profile not found", code: "profile_required" },
        { status: 403 }
      ),
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
    profile = await ensureTrialExpiryApplied(admin, user.id, profile);
  } catch {
    profile = await ensureTrialExpiryApplied(supabase, user.id, profile);
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

  if (!hasProductAccess(profile, org)) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: "Active subscription required",
          code: "product_access_required",
          renew_url: "/pricing",
        },
        { status: 403 }
      ),
    };
  }

  return { ok: true, profile, org };
}
