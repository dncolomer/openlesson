/**
 * Split pricing: harness $24.99 / $14.99 / AYCL vs verification $10 / $1 + contact.
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
import { VERIFICATION_PRICING_COPY } from "@/lib/pricing/verification-copy";
import {
  formatHarnessMonthlyPrice,
  formatHarnessTrialPrice,
  HARNESS_MONTHLY_PRICE_CENTS,
  TRIAL_PRICE_CENTS,
} from "@/lib/plans";

const ROOT = join(__dirname, "../..");

function read(rel: string): string {
  return readFileSync(join(ROOT, rel), "utf8");
}

describe("harness pricing amounts", () => {
  it("uses shipped $24.99 monthly and $14.99 3-day trial", () => {
    expect(HARNESS_MONTHLY_PRICE_CENTS).toBe(2499);
    expect(TRIAL_PRICE_CENTS).toBe(1499);
    expect(formatHarnessMonthlyPrice()).toBe("$24.99");
    expect(formatHarnessTrialPrice()).toBe("$14.99");
    expect(HARNESS_PRICING_COPY.monthlyPrice).toBe("$24.99");
    expect(HARNESS_PRICING_COPY.trialCta).toContain("$14.99");
    expect(HARNESS_PRICING_COPY.trialCta.toLowerCase()).toMatch(/try unlimited for 3 days/);
  });
});

describe("harness pricing page source", () => {
  it("keeps harness plan card and trial CTA; drops API Metered / cost scenarios", () => {
    const pagePath = join(ROOT, "app/pricing/page.tsx");
    expect(existsSync(pagePath)).toBe(true);
    const src = read("app/pricing/page.tsx");

    expect(src).toContain('data-testid="pricing-plans"');
    expect(src).toContain("Learning Harness");
    expect(src).toContain("$24.99");
    expect(src).toContain('data-testid="checkout-start-harness"');
    expect(src).toContain('data-testid="checkout-trial-3day"');
    expect(src).toMatch(/Start/);
    expect(src).toMatch(/3 days for \$14\.99/);

    expect(src).not.toContain("API Metered");
    expect(src).not.toContain('data-testid="pricing-scenarios"');
    expect(src).not.toContain("PRICING_SCENARIOS");
    expect(src).not.toContain("ScenarioPanel");
    expect(src).not.toContain("Real-world cost scenarios");
    expect(src).not.toContain("@/lib/pricing/scenarios");
  });

  it("links to All-You-Can-Learn as a visible CTA", () => {
    const src = read("app/pricing/page.tsx");
    expect(src).toContain("HARNESS_PRICING_COPY.ayclHref");
    expect(src).toContain('data-testid="pricing-aycl-link"');
    expect(PRICING_AYCL_HREF).toBe("/all-you-can-learn");
    expect(PRICING_AYCL_LABEL).toMatch(/All-You-Can-Learn/);
    expect(PRICING_AYCL_CTA.toLowerCase()).toMatch(/browse ready-made workspaces/);
  });
});

describe("verification pricing page source", () => {
  it("is contact-only with Deep Project vs light weight rates", () => {
    const src = read("app/pricing/verification/page.tsx");
    expect(src).toContain("$10 per assessment");
    expect(src).toContain("$1 per run");
    expect(src).toContain("Deep Project");
    expect(src).toContain("Light weight");
    expect(src).toContain("daniel@uncertain.systems");
    expect(src).not.toContain("/api/stripe/create-checkout");
    expect(VERIFICATION_PRICING_COPY.deepProject.price).toBe("$10 per assessment");
    expect(VERIFICATION_PRICING_COPY.lightWeight.price).toBe("$1 per run");
    expect(src).toContain("grayscale");
    expect(src).toContain("deepProject.image");
    expect(src).toContain("lightWeight.image");
    expect(existsSync(join(ROOT, "public/deep-verification.png"))).toBe(true);
    expect(existsSync(join(ROOT, "public/shallow_verification.png"))).toBe(true);
  });
});
