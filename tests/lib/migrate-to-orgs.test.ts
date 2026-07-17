import { describe, expect, it } from "vitest";
import {
  buildPersonalOrgSlug,
  demoteProfilePersonalBilling,
  mapProfileBillingToOrg,
  pickBestMemberBilling,
  profileHasMigratableEntitlement,
  shouldOverwriteOrgBilling,
  verificationPassed,
  type ProfileBillingSnapshot,
} from "@/lib/organization/migrate-to-orgs";
import { resolveBillingEntity } from "@/lib/billing-entity";
import { hasProductAccess } from "@/lib/plans";

const paidProfile = (over: Partial<ProfileBillingSnapshot> = {}): ProfileBillingSnapshot => ({
  id: "u1",
  username: "alice",
  organization_id: null,
  is_org_admin: true,
  plan: "pro_teams",
  subscription_status: "active",
  current_period_end: "2099-06-01T00:00:00.000Z",
  extra_lessons: 1500,
  stripe_customer_id: "cus_1",
  stripe_subscription_id: "sub_1",
  ...over,
});

describe("migrate-to-orgs pure helpers", () => {
  it("maps paid profile billing onto org patch", () => {
    const patch = mapProfileBillingToOrg(paidProfile());
    expect(patch.plan).toBe("pro_teams");
    expect(patch.subscription_status).toBe("active");
    expect(patch.extra_lessons).toBe(1500);
    expect(patch.stripe_subscription_id).toBe("sub_1");
    expect(patch.kind).toBe("personal");
  });

  it("does not migrate inactive personal plan as entitled", () => {
    expect(
      profileHasMigratableEntitlement(
        paidProfile({ plan: "inactive", subscription_status: "inactive", extra_lessons: 0 })
      )
    ).toBe(false);
    const patch = mapProfileBillingToOrg(
      paidProfile({ plan: "inactive", subscription_status: "inactive", extra_lessons: 99 })
    );
    expect(patch.plan).toBe("inactive");
    expect(patch.extra_lessons).toBe(0);
  });

  it("picks org-admin paid member for multi-member org", () => {
    const best = pickBestMemberBilling([
      paidProfile({
        id: "member",
        is_org_admin: false,
        plan: "regular_2026",
        extra_lessons: 0,
        stripe_subscription_id: "sub_reg",
      }),
      paidProfile({
        id: "admin",
        is_org_admin: true,
        plan: "pro_teams",
        extra_lessons: 4000,
        stripe_subscription_id: "sub_teams",
      }),
    ]);
    expect(best?.plan).toBe("pro_teams");
    expect(best?.extra_lessons).toBe(4000);
    expect(best?.kind).toBe("team");
  });

  it("does not overwrite partner org grants", () => {
    expect(
      shouldOverwriteOrgBilling(
        {
          id: "o1",
          kind: "partner",
          billing_mode: "partner",
          plan: "pro_teams",
          subscription_status: "inactive",
          current_period_end: null,
          extra_lessons: 9000,
          stripe_customer_id: null,
          stripe_subscription_id: null,
          archived_at: null,
        },
        mapProfileBillingToOrg(paidProfile({ plan: "api_metered" }))
      )
    ).toBe(false);
  });

  it("overwrites inactive org with paid candidate", () => {
    expect(
      shouldOverwriteOrgBilling(
        {
          id: "o1",
          kind: "personal",
          billing_mode: "subscription",
          plan: "inactive",
          subscription_status: "inactive",
          current_period_end: null,
          extra_lessons: 0,
          stripe_customer_id: null,
          stripe_subscription_id: null,
          archived_at: null,
        },
        mapProfileBillingToOrg(paidProfile())
      )
    ).toBe(true);
  });

  it("builds stable personal org slug from user id", () => {
    const slug = buildPersonalOrgSlug("Alice Bob", "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee");
    expect(slug).toMatch(/^user-alice-bob-aaaaaaaa$/);
  });

  it("demotes personal profile billing after migrate", () => {
    expect(demoteProfilePersonalBilling()).toEqual({
      plan: "inactive",
      subscription_status: "inactive",
      extra_lessons: 0,
      extra_workspaces: 0,
      current_period_end: null,
      stripe_subscription_id: null,
    });
  });

  it("verification requires zero null-org profiles and stamped rows", () => {
    expect(
      verificationPassed({
        profilesTotal: 10,
        profilesWithoutOrg: 0,
        orgsWithPaidPlan: 3,
        workspacesMissingOrgButOwnerHasOrg: 0,
        powMissingOrgButOwnerHasOrg: 0,
      })
    ).toBe(true);
    expect(
      verificationPassed({
        profilesTotal: 10,
        profilesWithoutOrg: 1,
        orgsWithPaidPlan: 3,
        workspacesMissingOrgButOwnerHasOrg: 0,
        powMissingOrgButOwnerHasOrg: 0,
      })
    ).toBe(false);
  });
});

describe("post-migrate entitlement is org-only", () => {
  it("inactive personal plan + entitled org → access and org PoW limit", () => {
    const entity = resolveBillingEntity(
      {
        plan: "inactive",
        is_admin: false,
        extra_lessons: 0,
        subscription_status: "inactive",
        current_period_end: null,
        token_tier: null,
        token_validity_expires_at: null,
        organization_id: "org-1",
      },
      {
        id: "org-1",
        plan: "regular_2026",
        subscription_status: "active",
        current_period_end: "2099-01-01T00:00:00.000Z",
        extra_lessons: 150,
        billing_mode: "subscription",
        archived_at: null,
      }
    );
    expect(entity.source).toBe("organization");
    expect(entity.entitled).toBe(true);
    expect(entity.limit).toBe(250); // 100 + 150
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
          plan: "regular_2026",
          subscription_status: "active",
          current_period_end: "2099-01-01T00:00:00.000Z",
          billing_mode: "subscription",
        }
      )
    ).toBe(true);
  });

  it("does not fall back to personal paid plan when org is present but inactive", () => {
    const entity = resolveBillingEntity(
      {
        plan: "pro_teams",
        is_admin: false,
        extra_lessons: 5000,
        subscription_status: "active",
        current_period_end: "2099-01-01T00:00:00.000Z",
        token_tier: null,
        token_validity_expires_at: null,
        organization_id: "org-1",
      },
      {
        id: "org-1",
        plan: "inactive",
        subscription_status: "inactive",
        current_period_end: null,
        extra_lessons: 0,
        billing_mode: "subscription",
        archived_at: null,
      }
    );
    // Org is source of truth when organization_id is set — no personal fallback
    expect(entity.source).toBe("organization");
    expect(entity.entitled).toBe(false);
  });
});
