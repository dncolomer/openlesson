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

  it("learner capabilities: no author/grow; can upgrade; force practice mode", () => {
    const caps = resolveAyclCapabilities("learner");
    expect(caps.tier).toBe("learner");
    expect(caps.canAuthor).toBe(false);
    expect(caps.canGrow).toBe(false);
    expect(caps.canUpgrade).toBe(true);
    expect(caps.allowCreatorModeToggle).toBe(false);
    expect(caps.allowExplore).toBe(true);
    expect(caps.defaultInteractionMode).toBe("learner");
    expect(ayclCanUpgradeFromTier("learner")).toBe(true);
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
    expect(ayclOfferLabel("learner")).toBe("play mode only");
    expect(ayclOfferLabel("full")).toBe("Play + Build");
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

  it("catalog API exposes dual offers via marketplace card assembler", () => {
    const src = fs.readFileSync(
      path.join(REPO_ROOT, "app/api/aycl/workspaces/route.ts"),
      "utf8",
    );
    expect(src).toContain("assembleAyclCatalogCard");
    expect(src).toContain("aycl_category");
    // Dual offers live in pure assembler (priceCents + labels).
    const marketplace = fs.readFileSync(
      path.join(REPO_ROOT, "lib/aycl-marketplace.ts"),
      "utf8",
    );
    expect(marketplace).toContain("offers");
    expect(marketplace).toContain('"learner"');
    expect(marketplace).toContain('"full"');
  });

  it("catalog page has dual CTAs without rent/buy wording", () => {
    const src = fs.readFileSync(
      path.join(REPO_ROOT, "app/all-you-can-learn/page.tsx"),
      "utf8",
    );
    expect(src).toContain("ayclAccessTier");
    expect(src).toContain('data-aycl-dual-offers');
    expect(src).toContain('data-aycl-checkout-learner');
    expect(src).toContain('data-aycl-checkout-full');
    expect(src).toMatch(/play mode only|ayclOfferLabel|ayclOfferCheckoutCta/);
    expect(src).toMatch(/Play \+ Build|ayclOfferCheckoutCta|ayclOfferLabel/);
    expect(src.toLowerCase()).not.toMatch(/\brent\b/);
    expect(src.toLowerCase()).not.toMatch(/\bbuy a movie\b/);
  });

  it("checkout accepts tier + upgrade-by-token with resolved listing prices", () => {
    const src = fs.readFileSync(
      path.join(REPO_ROOT, "app/api/stripe/create-checkout/route.ts"),
      "utf8",
    );
    expect(src).toContain("ayclAccessTier");
    expect(src).toContain("aycl_access_tier");
    expect(src).toContain("aycl_upgrade");
    expect(src).toContain("upgrade_from_purchase_id");
    expect(src).toContain("ayclPurchaseEligibleForUpgrade");
    expect(src).toContain("resolveAyclCheckoutCents");
    expect(src).toContain("resolveAyclUpgradeCents");
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

  it("API authoring gate uses requireAyclAuthoring", () => {
    for (const rel of [
      "app/api/workspace/grid-ops/route.ts",
      "app/api/workspace/add-block-at-slot/route.ts",
      "app/api/workspace/map-ground/route.ts",
      "lib/api/require-auth.ts",
    ]) {
      const src = fs.readFileSync(path.join(REPO_ROOT, rel), "utf8");
      expect(src).toContain("requireAyclAuthoring");
    }
    const auth = fs.readFileSync(
      path.join(REPO_ROOT, "lib/api/require-auth.ts"),
      "utf8",
    );
    expect(auth).toContain("aycl_authoring_required");
    expect(auth).toContain("canAuthor");
  });

  it("WorkspaceView gates owner + upgrade bar on capabilities", () => {
    const src = readWorkspaceViewSurface();
    expect(src).toContain("ayclCapabilities");
    expect(src).toContain("canAuthor");
    expect(src).toContain("data-aycl-upgrade-bar");
    expect(src).toContain("startAyclUpgradeCheckout");
    expect(src).toContain("allowCreatorModeToggle");
    expect(src).toContain("allowExplore");
  });

  it("AyclWorkspaceView reuses WorkspaceView and passes tier", () => {
    const src = fs.readFileSync(
      path.join(REPO_ROOT, "components/AyclWorkspaceView.tsx"),
      "utf8",
    );
    expect(src).toContain("WorkspaceView");
    expect(src).toContain("ayclToken={accessToken}");
    expect(src).toContain("ayclAccessTier={accessTier}");
    expect(src).toContain("data-aycl-access-tier");
  });
});
