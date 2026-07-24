import { describe, expect, it } from "vitest";
import {
  billingEntityHasApiAccess,
  billingEntityHasProductAccess,
  isOrgEntitled,
  resolveBillingEntity,
  type OrgBillingRow,
} from "@/lib/billing-entity";
import { hasProductAccess } from "@/lib/plans";

const baseProfile = {
  plan: "inactive" as const,
  is_admin: false,
  extra_lessons: 0,
  subscription_status: "inactive",
  current_period_end: null as string | null,
  token_tier: null as string | null,
  token_validity_expires_at: null as string | null,
  organization_id: null as string | null,
};

const entitledOrg: OrgBillingRow = {
  id: "org-1",
  plan: "api_metered",
  subscription_status: "active",
  current_period_end: "2099-01-01T00:00:00.000Z",
  extra_lessons: 0,
  billing_mode: "subscription",
  kind: "team",
  archived_at: null,
};

describe("isOrgEntitled", () => {
  it("requires active subscription for subscription mode", () => {
    expect(isOrgEntitled(entitledOrg)).toBe(true);
    expect(
      isOrgEntitled({ ...entitledOrg, subscription_status: "inactive" })
    ).toBe(false);
    expect(isOrgEntitled({ ...entitledOrg, plan: "inactive" })).toBe(false);
  });

  it("grants partner mode when plan is not inactive", () => {
    expect(
      isOrgEntitled({
        ...entitledOrg,
        billing_mode: "partner",
        subscription_status: "inactive",
        current_period_end: null,
      })
    ).toBe(true);
    expect(
      isOrgEntitled({
        ...entitledOrg,
        billing_mode: "partner",
        plan: "inactive",
      })
    ).toBe(false);
  });

  it("denies archived orgs", () => {
    expect(
      isOrgEntitled({ ...entitledOrg, archived_at: "2026-01-01T00:00:00.000Z" })
    ).toBe(false);
  });

  it("does not entitle removed plan ids without migration", () => {
    expect(isOrgEntitled({ ...entitledOrg, plan: "pro_teams" })).toBe(false);
    expect(isOrgEntitled({ ...entitledOrg, plan: "regular_2026" })).toBe(false);
  });
});

describe("resolveBillingEntity", () => {
  it("prefers platform admin", () => {
    const entity = resolveBillingEntity(
      { ...baseProfile, is_admin: true, plan: "inactive" },
      entitledOrg
    );
    expect(entity.source).toBe("admin");
    expect(entity.entitled).toBe(true);
    expect(entity.limit).toBeNull();
  });

  it("uses org billing when member of entitled api_metered org", () => {
    const entity = resolveBillingEntity(
      { ...baseProfile, organization_id: "org-1" },
      entitledOrg
    );
    expect(entity.source).toBe("organization");
    expect(entity.entitled).toBe(true);
    if (entity.source === "organization") {
      expect(entity.plan).toBe("api_metered");
      expect(entity.limit).toBeNull();
    }
  });

  it("does not grant access for org membership without entitlement", () => {
    const entity = resolveBillingEntity(
      { ...baseProfile, organization_id: "org-1" },
      {
        ...entitledOrg,
        plan: "inactive",
        subscription_status: "inactive",
        extra_lessons: 0,
      }
    );
    expect(entity.source).toBe("organization");
    expect(entity.entitled).toBe(false);
  });

  it("grants API access only for api_metered", () => {
    const metered = resolveBillingEntity(
      { ...baseProfile, organization_id: "org-1" },
      entitledOrg
    );
    expect(billingEntityHasApiAccess(metered)).toBe(true);
    expect(billingEntityHasProductAccess(metered)).toBe(true);

    const trial = resolveBillingEntity(
      { ...baseProfile, organization_id: "org-1" },
      { ...entitledOrg, plan: "trial" }
    );
    expect(billingEntityHasApiAccess(trial)).toBe(false);
    expect(billingEntityHasProductAccess(trial)).toBe(true);
  });

  it("aligns with hasProductAccess for org members", () => {
    expect(
      hasProductAccess(
        {
          ...baseProfile,
          organization_id: "org-1",
        },
        {
          id: "org-1",
          plan: "api_metered",
          subscription_status: "active",
          current_period_end: "2099-01-01T00:00:00.000Z",
          billing_mode: "subscription",
        }
      )
    ).toBe(true);
  });
});
