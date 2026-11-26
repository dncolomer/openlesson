import { readGridOpsSurface, readWorkspaceViewSurface } from "@/tests/helpers/surface-source";
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  AYCL_FULL_PRICE_CENTS,
  AYCL_FULL_PRICE_LABEL,
  AYCL_LEARNER_PRICE_CENTS,
  AYCL_LEARNER_PRICE_LABEL,
  AYCL_UPGRADE_PRICE_CENTS,
  ayclCanUpgradeFromTier,
  ayclOfferDescription,
  ayclOfferLabel,
  ayclPriceCentsForTier,
  ayclTierAfterUpgrade,
  normalizeAyclAccessTier,
  resolveAyclCapabilities,
} from "@/lib/aycl-shared";
import { ayclPurchaseEligibleForUpgrade } from "@/lib/aycl";

const REPO_ROOT = path.resolve(__dirname, "../..");

describe("AYCL dual access tiers (pure)", () => {
  it("normalizes tiers; missing/legacy → full (never silent downgrade)", () => {
    expect(normalizeAyclAccessTier(null)).toBe("full");
    expect(normalizeAyclAccessTier(undefined)).toBe("full");
    expect(normalizeAyclAccessTier("")).toBe("full");
    expect(normalizeAyclAccessTier("learner")).toBe("learner");
    expect(normalizeAyclAccessTier("practice")).toBe("learner");
    expect(normalizeAyclAccessTier("full")).toBe("full");
    expect(normalizeAyclAccessTier("creator")).toBe("full");
  });

  it("prices: practice cheaper than full; upgrade is the difference", () => {
    expect(ayclPriceCentsForTier("learner")).toBe(AYCL_LEARNER_PRICE_CENTS);
    expect(ayclPriceCentsForTier("full")).toBe(AYCL_FULL_PRICE_CENTS);
    expect(AYCL_LEARNER_PRICE_CENTS).toBe(999);
    expect(AYCL_FULL_PRICE_CENTS).toBe(1999);
    expect(AYCL_UPGRADE_PRICE_CENTS).toBe(
      AYCL_FULL_PRICE_CENTS - AYCL_LEARNER_PRICE_CENTS,
    );
    expect(AYCL_LEARNER_PRICE_LABEL).toBe("$9.99");
    expect(AYCL_FULL_PRICE_LABEL).toBe("$19.99");
  });

  it("learner capabilities match the one workspace mode", () => {
    const caps = resolveAyclCapabilities("learner");
    expect(caps.tier).toBe("learner");
    expect(caps.canAuthor).toBe(true);
    expect(caps.canGrow).toBe(true);
    expect(caps.canUpgrade).toBe(false);
    expect(caps.allowCreatorModeToggle).toBe(true);
    expect(caps.allowExplore).toBe(true);
    expect(caps.defaultInteractionMode).toBe("learner");
    expect(ayclCanUpgradeFromTier("learner")).toBe(false);
  });

  it("full capabilities: author/grow; no upgrade CTA", () => {
    const caps = resolveAyclCapabilities("full");
    expect(caps.tier).toBe("full");
    expect(caps.canAuthor).toBe(true);
    expect(caps.canGrow).toBe(true);
    expect(caps.canUpgrade).toBe(false);
    expect(caps.allowCreatorModeToggle).toBe(true);
    expect(caps.allowExplore).toBe(true);
    expect(ayclCanUpgradeFromTier("full")).toBe(false);
    expect(ayclTierAfterUpgrade()).toBe("full");
  });

  it("customer-facing labels avoid rent/buy metaphors", () => {
    expect(ayclOfferLabel("learner")).toBe("All You Can Learn");
    expect(ayclOfferLabel("full")).toBe("All You Can Learn");
    const joined = [
      ayclOfferLabel("learner"),
      ayclOfferLabel("full"),
      ayclOfferDescription("learner"),
      ayclOfferDescription("full"),
    ]
      .join(" ")
      .toLowerCase();
    expect(joined).not.toMatch(/\brent\b/);
    expect(joined).not.toMatch(/\bbuy\b/);
    expect(joined).not.toMatch(/movie/);
  });

  it("upgrade eligibility requires completed learner purchase with fork", () => {
    expect(
      ayclPurchaseEligibleForUpgrade({
        status: "completed",
        access_tier: "learner",
        forked_workspace_id: "ws-1",
      }),
    ).toBe(true);
    expect(
      ayclPurchaseEligibleForUpgrade({
        status: "completed",
        access_tier: "full",
        forked_workspace_id: "ws-1",
      }),
    ).toBe(false);
    expect(
      ayclPurchaseEligibleForUpgrade({
        status: "pending",
        access_tier: "learner",
        forked_workspace_id: "ws-1",
      }),
    ).toBe(false);
    expect(
      ayclPurchaseEligibleForUpgrade({
        status: "completed",
        access_tier: "learner",
        forked_workspace_id: null,
      }),
    ).toBe(false);
  });
});

describe("AYCL dual-tier wiring (structural)", () => {
  it("migration adds access_tier with learner|full check", () => {
    const sql = fs.readFileSync(
      path.join(
        REPO_ROOT,
        "supabase/migrations/20260803140000_aycl_access_tier.sql",
      ),
      "utf8",
    );
    expect(sql).toContain("access_tier");
    expect(sql).toContain("'learner'");
    expect(sql).toContain("'full'");
    expect(sql).toContain("upgraded_from_purchase_id");
  });


  it("fulfill promotes upgrade without new fork and rebinds checkout session", () => {
    const src = fs.readFileSync(path.join(REPO_ROOT, "lib/aycl.ts"), "utf8");
    expect(src).toContain("aycl_upgrade");
    expect(src).toContain("upgrade_from_purchase_id");
    expect(src).toContain("ayclTierAfterUpgrade");
    expect(src).toContain("access_tier");
    // verify-session looks up by stripe_checkout_session_id — upgrade must set it.
    expect(src).toContain("stripe_checkout_session_id: sessionId");
  });


  it("AyclWorkspaceView is gone from the product tree", () => {
    expect(fs.existsSync(path.join(REPO_ROOT, "components/AyclWorkspaceView.tsx"))).toBe(
      false,
    );
  });
});
