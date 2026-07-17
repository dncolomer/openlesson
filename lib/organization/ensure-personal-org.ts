import type { SupabaseClient } from "@supabase/supabase-js";

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

function shortId(): string {
  return Math.random().toString(36).slice(2, 8);
}

export type EnsurePersonalOrgResult = {
  organizationId: string;
  created: boolean;
};

/**
 * Ensure the user has an organization. Creates a personal org when missing.
 * If the user already has organization_id, returns it (no-op).
 *
 * When creating, copies active personal plan fields onto the org so entitlement
 * moves to the org without losing paid access during migration.
 */
export async function ensurePersonalOrganization(
  admin: SupabaseClient,
  userId: string,
  options?: { username?: string | null; email?: string | null }
): Promise<EnsurePersonalOrgResult> {
  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select(
      "id, username, organization_id, plan, subscription_status, current_period_end, extra_lessons, stripe_customer_id, stripe_subscription_id"
    )
    .eq("id", userId)
    .single();

  if (profileError || !profile) {
    throw new Error(profileError?.message || "Profile not found");
  }

  if (profile.organization_id) {
    return { organizationId: profile.organization_id, created: false };
  }

  const baseName =
    options?.username ||
    profile.username ||
    (options?.email ? options.email.split("@")[0] : null) ||
    "user";
  const displayName = `${baseName}'s workspace`;
  let slug = `user-${slugify(String(baseName)) || "member"}-${shortId()}`;

  // Retry on slug collision
  for (let attempt = 0; attempt < 5; attempt++) {
    const orgInsert: Record<string, unknown> = {
      name: displayName,
      slug,
      kind: "personal",
      billing_mode: "subscription",
      plan: profile.plan || "inactive",
      subscription_status: profile.subscription_status || "inactive",
      current_period_end: profile.current_period_end,
      extra_lessons: profile.extra_lessons ?? 0,
      stripe_customer_id: profile.stripe_customer_id ?? null,
      stripe_subscription_id: profile.stripe_subscription_id ?? null,
    };

    const { data: org, error: orgError } = await admin
      .from("organizations")
      .insert(orgInsert)
      .select("id")
      .single();

    if (!orgError && org) {
      const { error: linkError } = await admin
        .from("profiles")
        .update({ organization_id: org.id, is_org_admin: true })
        .eq("id", userId)
        .is("organization_id", null);

      if (linkError) {
        // Another concurrent ensure may have won — re-read
        const { data: again } = await admin
          .from("profiles")
          .select("organization_id")
          .eq("id", userId)
          .single();
        if (again?.organization_id) {
          // Orphan the org we just created if we lost the race
          if (again.organization_id !== org.id) {
            await admin
              .from("organizations")
              .update({ archived_at: new Date().toISOString() })
              .eq("id", org.id);
          }
          return { organizationId: again.organization_id, created: false };
        }
        throw new Error(linkError.message);
      }

      return { organizationId: org.id, created: true };
    }

    if (orgError?.code === "23505") {
      slug = `user-${slugify(String(baseName)) || "member"}-${shortId()}`;
      continue;
    }

    throw new Error(orgError?.message || "Failed to create personal organization");
  }

  throw new Error("Failed to allocate unique organization slug");
}
