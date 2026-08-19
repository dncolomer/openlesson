import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { readWorkspaceViewSurface } from "@/tests/helpers/surface-source";
import {
  AYCL_FULL_PRICE_CENTS,
  AYCL_LEARNER_PRICE_CENTS,
} from "@/lib/aycl-shared";
import {
  assembleAyclCatalogCard,
  centsToDollarsInput,
  collectAyclCatalogCategories,
  dollarsInputToCents,
  filterAyclCatalogCards,
  formatAyclPriceCents,
  normalizeAyclCategory,
  normalizeAyclListingFields,
  normalizeAyclPriceCents,
  parseAyclListingUpdateBody,
  resolveAyclCheckoutCents,
  resolveAyclUpgradeCents,
} from "@/lib/aycl-marketplace";

const REPO_ROOT = path.resolve(__dirname, "../..");

describe("AYCL marketplace listing helpers (pure)", () => {
  it("formats cents as shopper labels", () => {
    expect(formatAyclPriceCents(999)).toBe("$9.99");
    expect(formatAyclPriceCents(1999)).toBe("$19.99");
    expect(formatAyclPriceCents(1000)).toBe("$10");
    expect(formatAyclPriceCents(0)).toBe("$0");
  });

  it("normalizes category / author / prices with null defaults", () => {
    expect(normalizeAyclCategory("  Engineering  ")).toBe("Engineering");
    expect(normalizeAyclCategory("")).toBe(null);
    expect(normalizeAyclPriceCents(null)).toBe(null);
    expect(normalizeAyclPriceCents("")).toBe(null);
    expect(normalizeAyclPriceCents(1499)).toBe(1499);
    expect(normalizeAyclPriceCents(-1)).toBe(null);
    expect(normalizeAyclPriceCents(99.4)).toBe(99);

    const listing = normalizeAyclListingFields({
      aycl_category: " AI & ML ",
      aycl_summary: " Deep dive into transformers ",
      aycl_author_name: " Ada ",
      aycl_author_avatar_url: "https://example.com/a.png",
      aycl_learner_price_cents: 500,
      aycl_full_price_cents: null,
    });
    expect(listing.category).toBe("AI & ML");
    expect(listing.summary).toBe("Deep dive into transformers");
    expect(listing.authorName).toBe("Ada");
    expect(listing.authorAvatarUrl).toBe("https://example.com/a.png");
    expect(listing.learnerPriceCents).toBe(500);
    expect(listing.fullPriceCents).toBe(null);
  });

  it("resolveAyclCheckoutCents uses listing when set, else global defaults", () => {
    expect(resolveAyclCheckoutCents("learner", null)).toBe(
      AYCL_LEARNER_PRICE_CENTS,
    );
    expect(resolveAyclCheckoutCents("full", {})).toBe(AYCL_FULL_PRICE_CENTS);

    const custom = {
      aycl_learner_price_cents: 499,
      aycl_full_price_cents: 2499,
    };
    expect(resolveAyclCheckoutCents("learner", custom)).toBe(499);
    expect(resolveAyclCheckoutCents("full", custom)).toBe(2499);

    // Partial: only full set → learner still default
    expect(
      resolveAyclCheckoutCents("learner", {
        aycl_full_price_cents: 3000,
      }),
    ).toBe(AYCL_LEARNER_PRICE_CENTS);
    expect(
      resolveAyclCheckoutCents("full", {
        aycl_full_price_cents: 3000,
      }),
    ).toBe(3000);
  });

  it("resolveAyclUpgradeCents is full − learner with same resolve rules", () => {
    expect(resolveAyclUpgradeCents(null)).toBe(
      AYCL_FULL_PRICE_CENTS - AYCL_LEARNER_PRICE_CENTS,
    );
    expect(
      resolveAyclUpgradeCents({
        aycl_learner_price_cents: 500,
        aycl_full_price_cents: 2000,
      }),
    ).toBe(1500);
    // Misconfigured full < learner floors at 0
    expect(
      resolveAyclUpgradeCents({
        aycl_learner_price_cents: 5000,
        aycl_full_price_cents: 1000,
      }),
    ).toBe(0);
  });

  it("assembleAyclCatalogCard prefers listing summary/author/prices over bare description/defaults", () => {
    const card = assembleAyclCatalogCard({
      id: "ws-1",
      title: "Bayesian Clinic",
      description: "Workspace description only",
      aycl_summary: "Marketplace summary wins",
      aycl_category: "Science",
      aycl_author_name: "Marie",
      aycl_author_avatar_url: "/marie.jpg",
      aycl_learner_price_cents: 799,
      aycl_full_price_cents: 1599,
      cover_image_url: "/cover.jpg",
      created_at: "2026-01-01T00:00:00Z",
    });

    expect(card.id).toBe("ws-1");
    expect(card.title).toBe("Bayesian Clinic");
    expect(card.summary).toBe("Marketplace summary wins");
    expect(card.description).toBe("Workspace description only");
    expect(card.category).toBe("Science");
    expect(card.authorName).toBe("Marie");
    expect(card.authorAvatarUrl).toBe("/marie.jpg");
    expect(card.offers.learner.priceCents).toBe(799);
    expect(card.offers.learner.priceLabel).toBe("$7.99");
    expect(card.offers.full.priceCents).toBe(1599);
    expect(card.offers.full.priceLabel).toBe("$15.99");
    expect(card.priceLabel).toBe("$15.99");
  });

  it("assembleAyclCatalogCard falls back to description and global prices when listing empty", () => {
    const card = assembleAyclCatalogCard({
      id: "ws-2",
      title: "Legacy Course",
      description: "Only description",
      aycl_summary: null,
      aycl_category: null,
      aycl_learner_price_cents: null,
      aycl_full_price_cents: null,
    });
    expect(card.summary).toBe("Only description");
    expect(card.category).toBe(null);
    expect(card.offers.learner.priceCents).toBe(AYCL_LEARNER_PRICE_CENTS);
    expect(card.offers.full.priceCents).toBe(AYCL_FULL_PRICE_CENTS);
    expect(card.offers.learner.priceLabel).toMatch(/\$/);
    expect(card.offers.full.priceLabel).toMatch(/\$/);
  });

  it("filterAyclCatalogCards filters by category and search query", () => {
    const cards = [
      assembleAyclCatalogCard({
        id: "1",
        title: "Bayes for Clinicians",
        aycl_category: "Science",
        aycl_author_name: "Marie",
        aycl_summary: "PPV and prevalence",
      }),
      assembleAyclCatalogCard({
        id: "2",
        title: "Systems Design",
        aycl_category: "Engineering",
        aycl_author_name: "Ada",
        aycl_summary: "Queues and latency",
      }),
    ];

    expect(filterAyclCatalogCards(cards, { category: "Science" })).toHaveLength(
      1,
    );
    expect(
      filterAyclCatalogCards(cards, { category: "Science" })[0].id,
    ).toBe("1");
    expect(filterAyclCatalogCards(cards, { category: "all" })).toHaveLength(2);
    expect(filterAyclCatalogCards(cards, { query: "latency" })[0].id).toBe("2");
    expect(filterAyclCatalogCards(cards, { query: "marie" })[0].id).toBe("1");
    expect(
      filterAyclCatalogCards(cards, {
        category: "Engineering",
        query: "bayes",
      }),
    ).toHaveLength(0);
  });

  it("collectAyclCatalogCategories returns sorted unique labels", () => {
    const cards = [
      assembleAyclCatalogCard({ id: "a", title: "A", aycl_category: "Science" }),
      assembleAyclCatalogCard({
        id: "b",
        title: "B",
        aycl_category: "Engineering",
      }),
      assembleAyclCatalogCard({ id: "c", title: "C", aycl_category: "Science" }),
      assembleAyclCatalogCard({ id: "d", title: "D", aycl_category: null }),
    ];
    expect(collectAyclCatalogCategories(cards)).toEqual([
      "Engineering",
      "Science",
    ]);
  });

  it("parseAyclListingUpdateBody maps admin payload; rejects bad avatar", () => {
    const ok = parseAyclListingUpdateBody({
      is_all_you_can_learn: true,
      aycl_category: "Math",
      aycl_summary: "Algebra depth",
      aycl_author_name: "Euclid",
      aycl_author_avatar_url: "https://cdn.example/e.png",
      aycl_learner_price_cents: 600,
      aycl_full_price_cents: 1800,
    });
    expect(ok.error).toBeUndefined();
    expect(ok.fields.is_all_you_can_learn).toBe(true);
    expect(ok.fields.aycl_category).toBe("Math");
    expect(ok.fields.aycl_learner_price_cents).toBe(600);
    expect(ok.fields.aycl_full_price_cents).toBe(1800);

    const bad = parseAyclListingUpdateBody({
      aycl_author_avatar_url: "javascript:alert(1)",
    });
    expect(bad.error).toMatch(/avatar/i);

    const clearPrice = parseAyclListingUpdateBody({
      aycl_learner_price_cents: null,
    });
    expect(clearPrice.fields.aycl_learner_price_cents).toBe(null);
  });

  it("dollars ↔ cents helpers for admin form", () => {
    expect(dollarsInputToCents("9.99")).toBe(999);
    expect(dollarsInputToCents("$19.99")).toBe(1999);
    expect(dollarsInputToCents("")).toBe(null);
    expect(centsToDollarsInput(999)).toBe("9.99");
    expect(centsToDollarsInput(null)).toBe("");
  });
});

describe("AYCL marketplace structure (settings + catalog + checkout)", () => {
  it("migration adds listing columns", () => {
    const mig = fs.readFileSync(
      path.join(
        REPO_ROOT,
        "supabase/migrations/20260805120000_aycl_marketplace_listing.sql",
      ),
      "utf8",
    );
    expect(mig).toContain("aycl_category");
    expect(mig).toContain("aycl_summary");
    expect(mig).toContain("aycl_author_name");
    expect(mig).toContain("aycl_author_avatar_url");
    expect(mig).toContain("aycl_learner_price_cents");
    expect(mig).toContain("aycl_full_price_cents");
  });

  it("AYCL settings sub-tab has controls for all listing fields", () => {
    const settings = fs.readFileSync(
      path.join(REPO_ROOT, "components/WorkspaceAyclMarketplaceSettings.tsx"),
      "utf8",
    );
    const panel = fs.readFileSync(
      path.join(REPO_ROOT, "components/WorkspaceIntegrationPanel.tsx"),
      "utf8",
    );
    expect(panel).toContain('id: "aycl"');
    expect(panel).toContain('data-settings-tab-panel="aycl"');
    expect(panel).toContain("WorkspaceAyclMarketplaceSettings");
    expect(settings).toContain("data-workspace-aycl-marketplace-settings");
    expect(settings).toContain("data-aycl-listing-enabled");
    expect(settings).toContain("data-aycl-listing-category");
    expect(settings).toContain("data-aycl-listing-summary");
    expect(settings).toContain("data-aycl-listing-author-name");
    expect(settings).toContain("data-aycl-listing-author-avatar");
    expect(settings).toContain("data-aycl-listing-learner-price");
    expect(settings).toContain("data-aycl-listing-full-price");
    expect(settings).toContain("Enable Paid (AYCL)");
    expect(settings).toContain("/api/workspaces/");
    expect(settings).toContain("/aycl");
  });

  it("Access settings no longer hosts AYCL toggle (moved to AYCL tab)", () => {
    const access = fs.readFileSync(
      path.join(REPO_ROOT, "components/WorkspaceAccessSettings.tsx"),
      "utf8",
    );
    expect(access).toContain("data-workspace-access-settings");
    expect(access).not.toContain("Enable Paid (AYCL)");
    expect(access).not.toContain("is_all_you_can_learn");
    expect(access).not.toContain("/aycl");
  });

  it("catalog page is marketplace-style with filters, author, prices", () => {
    const page = fs.readFileSync(
      path.join(REPO_ROOT, "app/all-you-can-learn/page.tsx"),
      "utf8",
    );
    expect(page).toContain("data-aycl-marketplace-filters");
    expect(page).toContain("data-aycl-marketplace-search");
    expect(page).toContain("data-aycl-marketplace-category-chips");
    expect(page).toContain("data-aycl-card-author");
    expect(page).toContain("data-aycl-card-price-chips");
    expect(page).toContain("data-aycl-card-summary");
    expect(page).toContain("filterAyclCatalogCards");
    expect(page).toContain("collectAyclCatalogCategories");
  });

  it("catalog API assembles cards via pure helper and selects listing columns", () => {
    const api = fs.readFileSync(
      path.join(REPO_ROOT, "app/api/aycl/workspaces/route.ts"),
      "utf8",
    );
    expect(api).toContain("assembleAyclCatalogCard");
    expect(api).toContain("aycl_category");
    expect(api).toContain("aycl_summary");
    expect(api).toContain("aycl_author_name");
    expect(api).toContain("aycl_author_avatar_url");
    expect(api).toContain("aycl_learner_price_cents");
    expect(api).toContain("aycl_full_price_cents");
  });

  it("create-checkout resolves per-workspace listing prices", () => {
    const checkout = fs.readFileSync(
      path.join(REPO_ROOT, "app/api/stripe/create-checkout/route.ts"),
      "utf8",
    );
    expect(checkout).toContain("resolveAyclCheckoutCents");
    expect(checkout).toContain("resolveAyclUpgradeCents");
    expect(checkout).toContain("aycl_learner_price_cents");
    expect(checkout).toContain("aycl_full_price_cents");
    expect(checkout).not.toMatch(
      /unit_amount:\s*ayclPriceCentsForTier/,
    );
    expect(checkout).not.toMatch(/unit_amount:\s*AYCL_UPGRADE_PRICE_CENTS/);
  });

  it("AYCL workspace API returns listing-aware upgrade price for shell bar", () => {
    const route = fs.readFileSync(
      path.join(REPO_ROOT, "app/api/aycl/workspace/route.ts"),
      "utf8",
    );
    expect(route).toContain("resolveAyclUpgradeCents");
    expect(route).toContain("upgradePriceCents");
    expect(route).toContain("upgradePriceLabel");
    const view = readWorkspaceViewSurface();
    expect(view).toContain("data-aycl-upgrade-price");
    expect(view).toContain("ayclUpgradePriceLabel");
  });

  it("AYCL update API parses listing body", () => {
    const route = fs.readFileSync(
      path.join(REPO_ROOT, "app/api/workspaces/[id]/aycl/route.ts"),
      "utf8",
    );
    expect(route).toContain("parseAyclListingUpdateBody");
    expect(route).toContain("aycl_category");
    expect(route).toContain("aycl_learner_price_cents");
  });

  it("SSR landing page + OG image select marketplace listing columns via shared constant", () => {
    const landingLib = fs.readFileSync(
      path.join(REPO_ROOT, "lib/aycl-landing.ts"),
      "utf8",
    );
    expect(landingLib).toContain("AYCL_LANDING_WORKSPACE_SELECT");
    expect(landingLib).toContain("aycl_category");
    expect(landingLib).toContain("aycl_summary");
    expect(landingLib).toContain("aycl_author_name");
    expect(landingLib).toContain("aycl_author_avatar_url");
    expect(landingLib).toContain("aycl_learner_price_cents");
    expect(landingLib).toContain("aycl_full_price_cents");

    const page = fs.readFileSync(
      path.join(REPO_ROOT, "app/all-you-can-learn/[workspaceId]/page.tsx"),
      "utf8",
    );
    expect(page).toContain("AYCL_LANDING_WORKSPACE_SELECT");
    expect(page).toContain("assembleAyclLandingSummary");
    // Must not use a bare pre-listing select string
    expect(page).not.toMatch(
      /\.select\(\s*["']id, title, root_topic, description, workspace_goal, notes, cover_image_url, is_all_you_can_learn["']\s*\)/,
    );

    const og = fs.readFileSync(
      path.join(
        REPO_ROOT,
        "app/all-you-can-learn/[workspaceId]/opengraph-image.tsx",
      ),
      "utf8",
    );
    // OG card is the unsys standard — no per-workspace listing select.
    expect(og).toContain("composeStandardOgImage");
    expect(og).not.toContain("AYCL_LANDING_WORKSPACE_SELECT");
    expect(og).not.toContain("assembleAyclLandingSummary");
    expect(og).not.toMatch(
      /\.select\(\s*["']id, title, root_topic, description, workspace_goal, notes, cover_image_url, is_all_you_can_learn["']\s*\)/,
    );

    const apiId = fs.readFileSync(
      path.join(REPO_ROOT, "app/api/aycl/workspaces/[id]/route.ts"),
      "utf8",
    );
    expect(apiId).toContain("AYCL_LANDING_WORKSPACE_SELECT");
  });
});
