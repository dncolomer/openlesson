import { describe, expect, it } from "vitest";
import {
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
  plan: "pro_teams",
  subscription_status: "active",
  current_period_end: "2099-01-01T00:00:00.000Z",
  extra_lessons: 1500,
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

  it("uses org billing when member of entitled org (even if personal plan inactive)", () => {
    const entity = resolveBillingEntity(
      { ...baseProfile, organization_id: "org-1" },
      entitledOrg
    );
    expect(entity.source).toBe("organization");
    expect(entity.entitled).toBe(true);
    if (entity.source === "organization") {
      expect(entity.plan).toBe("pro_teams");
      expect(entity.limit).toBe(1000 + 1500);
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
    expect(billingEntityHasProductAccess(entity)).toBe(false);
  });

  it("uses partner org without Stripe period", () => {
    const entity = resolveBillingEntity(
      { ...baseProfile, organization_id: "org-1" },
      {
        ...entitledOrg,
        billing_mode: "partner",
        subscription_status: "inactive",
        current_period_end: null,
        plan: "regular_2026",
        extra_lessons: 0,
      }
    );
    expect(entity.entitled).toBe(true);
    if (entity.source === "organization") {
      expect(entity.limit).toBe(100);
      expect(entity.billingMode).toBe("partner");
    }
  });

  it("denies product access without organization (personal plan not authoritative)", () => {
    const entity = resolveBillingEntity(
      {
        ...baseProfile,
        plan: "regular_2026",
        subscription_status: "active",
        current_period_end: "2099-01-01T00:00:00.000Z",
      },
      null
    );
    expect(entity.source).toBe("none");
    expect(entity.entitled).toBe(false);
  });
});

describe("hasProductAccess with org", () => {
  it("no longer grants access from organization_id alone", () => {
    expect(
      hasProductAccess({
        plan: "inactive",
        subscription_status: "inactive",
        is_admin: false,
        token_tier: null,
        token_validity_expires_at: null,
        organization_id: "org-1",
      })
    ).toBe(false);
  });

  it("grants access for entitled subscription org", () => {
    expect(
      hasProductAccess(
        {
          plan: "inactive",
          subscription_status: "inactive",
          is_admin: false,
          token_tier: null,
          token_validity_expires_at: null,
          organization_id: "org-1",
        },
        {
          id: "org-1",
          plan: "pro_teams",
          subscription_status: "active",
          current_period_end: "2099-01-01T00:00:00.000Z",
          billing_mode: "subscription",
        }
      )
    ).toBe(true);
  });

  it("grants access for partner org", () => {
    expect(
      hasProductAccess(
        {
          plan: "inactive",
          subscription_status: "inactive",
          is_admin: false,
          token_tier: null,
          token_validity_expires_at: null,
          organization_id: "org-1",
        },
        {
          id: "org-1",
          plan: "pro_teams",
          subscription_status: "inactive",
          current_period_end: null,
          billing_mode: "partner",
        }
      )
    ).toBe(true);
  });
});
