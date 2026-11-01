/**
 * Public pricing: sparse module list; course authoring is its own page.
 */
import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  HARNESS_PRICING_COPY,
  PRICING_AYCL_CTA,
  PRICING_AYCL_HREF,
  PRICING_AYCL_LABEL,
} from "@/lib/pricing/harness-copy";
import { UNIFIED_PRICING_COPY } from "@/lib/pricing/unified-copy";
import { VERIFICATION_PRICING_COPY } from "@/lib/pricing/verification-copy";
import { AUTHORING_PRICING_COPY } from "@/lib/pricing/authoring-copy";
import { MAPPING_PRICING_COPY } from "@/lib/pricing/mapping-copy";
import {
  AUTHORING_PRICING_PATH,
  MAPPING_PRICING_PATH,
  VERIFICATION_PRICING_PATH,
} from "@/lib/marketing/paths";
import { PRICING_PAGE_SKUS, CREDIT_PACK_CARDS } from "@/lib/pricing/modules";
import {
  CREDIT_PACKS,
  FLOW_SESSION_CREDIT_COST,
  STARTER_CREDIT_GRANT,
} from "@/lib/credits/constants";

const ROOT = join(__dirname, "../..");

function read(rel: string): string {
  return readFileSync(join(ROOT, rel), "utf8");
}

describe("unified pricing amounts", () => {
  it("sells one-time credit packs and a free signup grant", () => {
    expect(STARTER_CREDIT_GRANT).toBeGreaterThan(0);
    expect(FLOW_SESSION_CREDIT_COST).toBeGreaterThan(0);
    expect(HARNESS_PRICING_COPY.trialCta.toLowerCase()).toMatch(/start free/);
    expect(HARNESS_PRICING_COPY.monthlyCadence).toMatch(/one-time/);
    expect(CREDIT_PACKS.every((pack) => pack.priceCents > 0 && pack.credits > 0)).toBe(true);
  });
});

describe("unified pricing page source", () => {
  it("ships free signup plus one-time credit packs", () => {
    const pagePath = join(ROOT, "app/pricing/page.tsx");
    expect(existsSync(pagePath)).toBe(true);
    const src = read("app/pricing/page.tsx");

    expect(src).toContain('data-testid="pricing-plans"');
    expect(src).toContain("PRICING_PAGE_SKUS");
    expect(src).toContain("data-testid={`checkout-${sku}`}");
    expect(src).toContain("SKU_SECTION_ID");
    expect(src).not.toContain('module_learn: "learning"');
    expect(src).toContain("credits_100");
    expect(src).toContain("credits_500");
    expect(src).toContain("credits_2000");
    expect(src).toContain('id="custom"');
    expect(src).toContain('data-testid="pricing-sku-free"');
    expect(src).toContain("UNIFIED_PRICING_COPY.free");
    expect(src).toContain("currentPlan");
    expect(src).toMatch(
      /\{ user, needsPlan, loadingPlan, handleCheckout, currentPlan \} = usePricingCheckout/,
    );
    expect(UNIFIED_PRICING_COPY.free.name).toBe("Free");
    expect(UNIFIED_PRICING_COPY.free.priceLabel).toBe("$0");
    expect(UNIFIED_PRICING_COPY.free.href).toBe("/register");
    expect(UNIFIED_PRICING_COPY.free.cadence).toMatch(/starter credits/);
    expect(UNIFIED_PRICING_COPY.lead.toLowerCase()).toMatch(/credit/);
    expect(src.match(/console-copy/g)?.length).toBe(1);
    expect(src).not.toContain("ThesisDirectory");
    expect(CREDIT_PACK_CARDS.every((card) => card.cadence === "one-time")).toBe(true);
    expect(PRICING_PAGE_SKUS.map((card) => card.id)).toEqual([
      "credits_100",
      "credits_500",
      "credits_2000",
    ]);
    expect(src).not.toContain("$24.99/mo");

    expect(src).not.toContain("API Metered");
    expect(src).not.toContain('data-testid="pricing-scenarios"');
    expect(src).not.toContain("$14.99");
    expect(src).not.toContain("AUTHORING_PRICING_COPY");
    expect(src).not.toContain("MAPPING_PRICING_COPY");
    expect(src).not.toContain("VERIFICATION_PRICING_COPY");
  });

  it("links to All-You-Can-Learn as a visible CTA", () => {
    const src = read("app/pricing/page.tsx");
    expect(src).toContain("UNIFIED_PRICING_COPY.ayclHref");
    expect(src).toContain('data-testid="pricing-aycl-link"');
    expect(PRICING_AYCL_HREF).toBe("/all-you-can-learn");
    expect(PRICING_AYCL_LABEL).toMatch(/All-You-Can-Learn/);
    expect(PRICING_AYCL_CTA.toLowerCase()).toMatch(/browse ready-made workspaces/);
  });

  it("links Academy-k on modules and authoring pricing", () => {
    expect(UNIFIED_PRICING_COPY.academyHref).toBe("https://academy-k.com/");
    expect(UNIFIED_PRICING_COPY.academyCta).toBe("Academy-k");
    const modules = read("app/pricing/page.tsx");
    const authoring = read("app/pricing/authoring/page.tsx");
    expect(modules).toContain('data-testid="pricing-academy-k-link"');
    expect(modules).toContain("UNIFIED_PRICING_COPY.academyHref");
    expect(authoring).toContain('data-testid="pricing-academy-k-link"');
    expect(authoring).toContain("UNIFIED_PRICING_COPY.academyHref");
  });
});

describe("course authoring stays on its own page", () => {
  it("keeps /pricing/authoring as a live page with the monthly SKU and 40h package", () => {
    const src = read("app/pricing/authoring/page.tsx");
    expect(src).not.toContain("redirect(");
    expect(src).toContain("AUTHORING_PRICING_COPY");
    expect(src).toContain("checkout-module_author");
    expect(src).toContain("authoring-40h-package");
    expect(AUTHORING_PRICING_PATH).toBe("/pricing/authoring");
    expect(UNIFIED_PRICING_COPY.authoringHref).toBe("/pricing/authoring");
    expect(read("app/pricing/page.tsx")).toContain("UNIFIED_PRICING_COPY.authoringHref");
    expect(read("next.config.ts")).not.toContain('source: "/pricing/authoring"');
  });

  it("folds verification and mapping routes onto /pricing hashes", () => {
    expect(read("app/pricing/verification/page.tsx")).toContain('redirect("/pricing#verification")');
    expect(read("app/pricing/mapping/page.tsx")).toContain('redirect("/pricing#mapping")');
    expect(VERIFICATION_PRICING_PATH).toBe("/pricing#verification");
    expect(MAPPING_PRICING_PATH).toBe("/pricing#mapping");
    expect(MAPPING_PRICING_COPY.quote.price).toBe("$1 per data point");
    expect(AUTHORING_PRICING_COPY.package.price).toMatch(/Starting at \$15,000/);
    expect(VERIFICATION_PRICING_COPY.deepProject.price).toBe("$10 per assessment");
    expect(VERIFICATION_PRICING_COPY.lightWeight.price).toBe("$1 per run");
    expect(UNIFIED_PRICING_COPY.custom.mailto).toBe("mailto:daniel@uncertain.systems");
  });
});
