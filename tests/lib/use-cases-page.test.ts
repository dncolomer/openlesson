/**
 * Public Use cases listing: nav slot, magazine chrome, three long cases.
 */
import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { MAIN_NAV_PRODUCT_LINKS, USE_CASES_NAV_LINK } from "@/lib/marketing/nav";
import { ENTERPRISE_SETUP_MAILTO, USE_CASES_PATH } from "@/lib/marketing/paths";
import {
  USE_CASES,
  USE_CASES_COPY,
  USE_CASES_DIRECTORY,
  USE_CASES_OTHER,
  useCasesCopyText,
} from "@/lib/marketing/use-cases";

const ROOT = join(__dirname, "../..");

function read(rel: string): string {
  return readFileSync(join(ROOT, rel), "utf8");
}

describe("use cases listing", () => {
  it("sits in nav after the three products and before pricing", () => {
    expect(USE_CASES_PATH).toBe("/use-cases");
    expect(USE_CASES_NAV_LINK.href).toBe("/use-cases");
    expect(USE_CASES_NAV_LINK.label).toBe("Use cases");
    expect(MAIN_NAV_PRODUCT_LINKS.map((link) => link.label)).toEqual([
      "Understanding",
      "Verification",
      "Mapping",
    ]);
    const nav = read("components/LandingNav.tsx");
    expect(nav).toContain("data-nav-products");
    expect(nav).toContain("USE_CASES_NAV_LINK");
    expect(nav).toContain("PRICING_NAV_LINKS");
    const desktop = nav.slice(nav.indexOf('aria-label="Main navigation"'));
    const productsAt = desktop.indexOf("data-nav-products");
    const useCasesAt = desktop.indexOf("USE_CASES_NAV_LINK");
    const pricingAt = desktop.indexOf("PRICING_NAV_LINKS");
    expect(productsAt).toBeGreaterThan(-1);
    expect(useCasesAt).toBeGreaterThan(productsAt);
    expect(pricingAt).toBeGreaterThan(useCasesAt);
    expect(nav).toContain("font-medium text-zinc-100");
    expect(nav).toMatch(/data-nav-products[\s\S]*?console-copy|console-copy[\s\S]*?data-nav-products/);
  });

  it("ships a magazine page of three cases, connecting ideas, and a discovery close", () => {
    expect(existsSync(join(ROOT, "app/use-cases/page.tsx"))).toBe(true);
    const page = read("app/use-cases/page.tsx");
    expect(page).toContain("MarketingPageShell");
    expect(page).toContain("MarketingDirectoryHero");
    expect(page).toContain("console-copy");
    expect(page).toContain("data-use-cases-page");
    expect(page).toContain("data-use-cases-list");
    expect(page).toContain("data-use-cases-ideas");
    expect(page).toContain("data-use-cases-other");
    expect(page).toContain("data-use-cases-close");
    expect(page).toContain("data-use-case-example");
    expect(page).toContain("USE_CASES");
    expect(USE_CASES).toHaveLength(3);
    expect(USE_CASES_OTHER).toHaveLength(3);
    expect(USE_CASES.map((item) => item.id)).toEqual([
      "research-ai",
      "company-expertise",
      "technical-hiring",
    ]);
    expect(USE_CASES_DIRECTORY.map((item) => item.href)).toEqual([
      "#ideas",
      "#research-ai",
      "#company-expertise",
      "#technical-hiring",
      "#other-directions",
      "#start",
    ]);
    expect(USE_CASES_COPY.title).toBe("Put knowledge building to work");
    expect(USE_CASES_COPY.closeCta).toBe("Discuss your use case");
    expect(USE_CASES_COPY.closeHref).toBe(ENTERPRISE_SETUP_MAILTO);
    const text = useCasesCopyText();
    expect(text).not.toMatch(/thinking stays human/);
    expect(text).toMatch(/knowledge region/);
    expect(text).toMatch(/solve flow/);
    expect(text).toMatch(/technical hiring/);
    expect(text).toMatch(/team capability/);
    expect(text).toMatch(/AI-generated/);
    expect(text).toMatch(/Calibrate, Learn, and Verify/);
    expect(text).toMatch(/Institute and course-authoring/);
    expect(text).toMatch(/Agent-harness evaluation/);
    expect(text).toMatch(/Knowledge and neuroscience studies/);
    expect(text).toMatch(/does not enforce a tool policy/);
    expect(text).toMatch(/behavioral cognitive enhancements/);
    expect(text).toMatch(/Human interpretability here means/);
    expect(text).not.toMatch(/cannot be cheated or faked/);
    expect(text).not.toMatch(/WISER/);
    expect(text).not.toMatch(/\u2014/);
    expect(page).toContain("USE_CASES_COPY.closeHref");
    expect(read("app/sitemap.ts")).toContain("/use-cases");
    expect(read("next.config.ts")).not.toMatch(
      /source:\s*["']\/use-cases["']\s*,\s*destination:\s*["']\/["']/,
    );
    expect(read("next.config.ts")).toMatch(
      /source:\s*["']\/use-cases\/:path\+["']\s*,\s*destination:\s*["']\/use-cases["']/,
    );
  });
});
