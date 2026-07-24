import { describe, expect, it } from "vitest";
import {
  orgHasReadyXaiApiKey,
  orgIsProductEntitled,
  orgNeedsXaiApiKey,
  orgNeedsXaiApiKeyReason,
  type OrgXaiKeyEligibility,
} from "@/lib/organization/org-xai-key-selection";

const base = (over: Partial<OrgXaiKeyEligibility> = {}): OrgXaiKeyEligibility => ({
  id: "org-1",
  archived_at: null,
  plan: "inactive",
  subscription_status: "inactive",
  billing_mode: "subscription",
  xai_api_key_status: "pending",
  xai_api_key_id: null,
  xai_api_key_ciphertext: null,
  xai_collection_id: null,
  xai_collection_status: "pending",
  ...over,
});

describe("orgNeedsXaiApiKey", () => {
  it("skips orgs that already have a ready key", () => {
    const org = base({
      plan: "api_metered",
      subscription_status: "active",
      xai_api_key_status: "ready",
      xai_api_key_id: "key-1",
      xai_api_key_ciphertext: "sealed",
    });
    expect(orgHasReadyXaiApiKey(org)).toBe(true);
    expect(orgNeedsXaiApiKey(org)).toBe(false);
    expect(orgNeedsXaiApiKeyReason(org)).toBe("already_ready");
  });

  it("provisions active paid subscription orgs", () => {
    expect(
      orgNeedsXaiApiKey(
        base({ plan: "api_metered", subscription_status: "active" })
      )
    ).toBe(true);
    expect(
      orgNeedsXaiApiKeyReason(
        base({ plan: "trial", subscription_status: "active" })
      )
    ).toBe("entitled");
    expect(orgIsProductEntitled(base({ plan: "api_metered", subscription_status: "active" }))).toBe(
      true
    );
    // Removed tiers are not product-entitled until migrated
    expect(orgIsProductEntitled(base({ plan: "pro_teams", subscription_status: "active" }))).toBe(
      false
    );
  });

  it("provisions partner orgs with non-inactive plan", () => {
    expect(
      orgNeedsXaiApiKey(
        base({
          plan: "api_metered",
          subscription_status: "inactive",
          billing_mode: "partner",
        })
      )
    ).toBe(true);
  });

  it("provisions inactive orgs that already have a ready collection (folder)", () => {
    expect(
      orgNeedsXaiApiKey(
        base({
          plan: "inactive",
          subscription_status: "inactive",
          xai_collection_status: "ready",
          xai_collection_id: "collection_abc",
        })
      )
    ).toBe(true);
    expect(
      orgNeedsXaiApiKeyReason(
        base({
          xai_collection_status: "ready",
          xai_collection_id: "collection_abc",
        })
      )
    ).toBe("has_collection");
  });

  it("skips inactive orgs without a collection", () => {
    expect(orgNeedsXaiApiKey(base())).toBe(false);
    expect(orgNeedsXaiApiKeyReason(base())).toBe("skip_inactive_no_collection");
  });

  it("skips archived orgs", () => {
    expect(
      orgNeedsXaiApiKey(
        base({
          archived_at: "2026-01-01T00:00:00Z",
          plan: "api_metered",
          subscription_status: "active",
        })
      )
    ).toBe(false);
    expect(
      orgNeedsXaiApiKeyReason(
        base({ archived_at: "2026-01-01T00:00:00Z", plan: "api_metered", subscription_status: "active" })
      )
    ).toBe("archived");
  });
});
