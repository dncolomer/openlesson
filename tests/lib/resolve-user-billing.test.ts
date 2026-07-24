import { describe, expect, it } from "vitest";
import {
  billingEntityHasApiAccess,
  billingEntityToUserProfile,
  resolveBillingEntity,
} from "@/lib/billing-entity";
import { canCreateWorkspace } from "@/lib/plans";

/**
 * Structural tests for the org-billing path used by workspace create and API gates.
 * Mirrors resolveUserBilling() without I/O: entity → userProfile → canCreateWorkspace.
 */
describe("org-resolved workspace and API gates (post-migrate)", () => {
  const inactivePersonal = {
    plan: "inactive" as const,
    is_admin: false,
    extra_lessons: 0,
    subscription_status: "inactive",
    current_period_end: null as string | null,
    token_tier: null as string | null,
    token_validity_expires_at: null as string | null,
    organization_id: "org-1",
  };

  const entitledOrg = {
    id: "org-1",
    plan: "api_metered",
    subscription_status: "active",
    current_period_end: "2099-01-01T00:00:00.000Z",
    extra_lessons: 0,
    billing_mode: "subscription",
    archived_at: null,
  };

  it("allows workspace create for entitled org member with demoted personal plan", () => {
    const entity = resolveBillingEntity(inactivePersonal, entitledOrg);
    const userProfile = billingEntityToUserProfile(entity);
    expect(userProfile.plan).toBe("api_metered");
    expect(userProfile.subscription_status).toBe("active");
    const check = canCreateWorkspace(userProfile, 0);
    expect(check.allowed).toBe(true);
  });

  it("denies workspace create when org inactive even if personal fields look paid", () => {
    const entity = resolveBillingEntity(
      {
        ...inactivePersonal,
        plan: "api_metered",
        subscription_status: "active",
        extra_lessons: 0,
        current_period_end: "2099-01-01T00:00:00.000Z",
      },
      {
        ...entitledOrg,
        plan: "inactive",
        subscription_status: "inactive",
        current_period_end: null,
      }
    );
    const userProfile = billingEntityToUserProfile(entity);
    expect(userProfile.plan).toBe("inactive");
    const check = canCreateWorkspace(userProfile, 0);
    expect(check.allowed).toBe(false);
  });

  it("grants API access from org api_metered not personal plan", () => {
    const entity = resolveBillingEntity(inactivePersonal, {
      ...entitledOrg,
      plan: "api_metered",
    });
    expect(billingEntityHasApiAccess(entity)).toBe(true);
  });

  it("denies API access when personal was metered but org is inactive", () => {
    const entity = resolveBillingEntity(
      {
        ...inactivePersonal,
        plan: "api_metered",
        subscription_status: "active",
      },
      {
        ...entitledOrg,
        plan: "inactive",
        subscription_status: "inactive",
        current_period_end: null,
      }
    );
    expect(billingEntityHasApiAccess(entity)).toBe(false);
  });
});
