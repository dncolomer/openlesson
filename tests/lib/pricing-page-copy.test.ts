/**
 * /pricing page: plans stay, cost scenarios gone, individual vs at-scale copy,
 * All-You-Can-Learn link. Drives shipped page source and audience-copy module.
 */
import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  formatIleSessionPrice,
  formatPowApiCallPrice,
  formatTapSessionPrice,
} from "@/lib/plans";
import {
  formatApiMeteredPlatformPrice,
  getPricingAudienceFullText,
  PRICING_AUDIENCE_COPY,
  PRICING_AYCL_HREF,
  PRICING_AYCL_LABEL,
} from "@/lib/pricing/audience-copy";

const ROOT = join(__dirname, "../..");

function read(rel: string): string {
  return readFileSync(join(ROOT, rel), "utf8");
}

describe("pricing audience cost copy", () => {
  it("uses shipped API Metered rates for individual harness and business at scale", () => {
    const full = getPricingAudienceFullText(PRICING_AUDIENCE_COPY);
    const platform = formatApiMeteredPlatformPrice();
    const tap = formatTapSessionPrice();
    const ile = formatIleSessionPrice();
    const pow = formatPowApiCallPrice();

    expect(full).toContain(platform);
    expect(full).toContain(tap);
    expect(full).toContain(ile);
    expect(PRICING_AUDIENCE_COPY.individual.body).toContain(platform);
    expect(PRICING_AUDIENCE_COPY.individual.body).toContain(tap);
    expect(PRICING_AUDIENCE_COPY.individual.body).toContain(ile);
    expect(PRICING_AUDIENCE_COPY.individual.body.toLowerCase()).toMatch(/harness|yourself|one person/);
    expect(PRICING_AUDIENCE_COPY.business.body).toContain(platform);
    expect(PRICING_AUDIENCE_COPY.business.body).toContain(tap);
    expect(PRICING_AUDIENCE_COPY.business.body).toContain(ile);
    expect(PRICING_AUDIENCE_COPY.business.body).toContain(pow);
    expect(PRICING_AUDIENCE_COPY.business.title.toLowerCase()).toMatch(/at scale/);
    expect(PRICING_AUDIENCE_COPY.business.eyebrow.toLowerCase()).toMatch(/business/);
    expect(full.toLowerCase()).toMatch(/api metered/);
  });
});

describe("pricing page source", () => {
  it("keeps the API Metered plan card and trial CTA; drops cost scenarios", () => {
    const pagePath = join(ROOT, "app/pricing/page.tsx");
    expect(existsSync(pagePath)).toBe(true);
    const src = read("app/pricing/page.tsx");

    expect(src).toContain('data-testid="pricing-plans"');
    expect(src).toContain("API Metered");
    expect(src).toContain("formatTapSessionPrice");
    expect(src).toContain("formatIleSessionPrice");
    expect(src).toContain("formatPowApiCallPrice");
    expect(src).toContain('data-testid="checkout-start-metered"');
    expect(src).toContain('data-testid="checkout-trial-3day"');
    expect(src).toMatch(/Start/);
    expect(src).toMatch(/3 days for \$19\.99/);

    expect(src).not.toContain('data-testid="pricing-scenarios"');
    expect(src).not.toContain("PRICING_SCENARIOS");
    expect(src).not.toContain("ScenarioPanel");
    expect(src).not.toContain("Real-world cost scenarios");
    expect(src).not.toContain("explore real-world cost scenarios");
    expect(src).not.toContain("@/lib/pricing/scenarios");
  });

  it("renders individual vs at-scale copy from the shipped module", () => {
    const src = read("app/pricing/page.tsx");
    expect(src).toContain("PRICING_AUDIENCE_COPY");
    expect(src).toContain("audience-copy");
    expect(src).toContain('data-testid="pricing-audiences"');
    expect(src).toContain('data-testid={`pricing-audience-${key}`}');
    expect(src).toContain("PRICING_AUDIENCE_COPY.individual");
    expect(src).toContain("PRICING_AUDIENCE_COPY.business");
    expect(src).toContain("copy.title");
    expect(src).toContain("copy.body");
  });

  it("links to All-You-Can-Learn", () => {
    const src = read("app/pricing/page.tsx");
    expect(src).toContain("PRICING_AYCL_HREF");
    expect(src).toContain("PRICING_AYCL_LABEL");
    expect(src).toContain('data-testid="pricing-aycl-link"');
    expect(PRICING_AYCL_HREF).toBe("/all-you-can-learn");
    expect(PRICING_AYCL_LABEL).toMatch(/All-You-Can-Learn/);
    expect(src).toContain("href={PRICING_AYCL_HREF}");
  });
});
