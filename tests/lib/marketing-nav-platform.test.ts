/**
 * Marketing chrome: three products in main nav; Use cases listing; AYCL not in community; no product-detail trees.
 */
import { describe, expect, it } from "vitest";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { LANDING_PRODUCT_ROWS } from "@/components/ProductTable";
import { PRODUCTS } from "@/lib/seo/products";
import {
  COMMUNITY_LINKS,
  MAIN_NAV_PRODUCT_LINKS,
  PLATFORM_NAV_LABEL,
  PRICING_NAV_LINKS,
  USE_CASES_NAV_LINK,
} from "@/lib/marketing/nav";

const ROOT = join(__dirname, "../..");

function read(rel: string): string {
  return readFileSync(join(ROOT, rel), "utf8");
}

function collectPageTsx(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      out.push(...collectPageTsx(full));
    } else if (name === "page.tsx") {
      out.push(full);
    }
  }
  return out;
}

describe("marketing nav and platform rename", () => {
  it("LandingNav opens Explore the Protocols onto Solve, Verify, and Mapping Protocols, then Use cases, then Pricing", () => {
    const nav = read("components/LandingNav.tsx");
    expect(nav).toContain("USE_CASES_NAV_LINK");
    expect(nav).toContain("data-nav-products");
    expect(nav).toContain("PLATFORM_NAV_LABEL");
    expect(nav).toContain("bg-white");
    expect(nav).toContain("text-black");
    expect(nav).toContain("platform-menu");
    expect(nav).not.toMatch(/<div className="console-copy flex items-stretch" data-nav-products>/);
    expect(nav).not.toMatch(/href=["']\/#products["']/);
    expect(nav).not.toMatch(/>\s*Products\s*</);
    expect(nav).not.toContain('href="/#platform"');
    expect(nav).toContain("MAIN_NAV_PRODUCT_LINKS");
    expect(PLATFORM_NAV_LABEL).toBe("Explore the Protocols");
    expect(MAIN_NAV_PRODUCT_LINKS.map((l) => l.href)).toEqual([
      "/verify-protocols",
      "/mapping-protocols",
      "/solve-protocols",
    ]);
    expect(USE_CASES_NAV_LINK).toEqual({ href: "/use-cases", label: "Use cases" });
    expect(nav).toContain("PRICING_NAV_LINKS");
    expect(nav).toContain('href="/dashboard"');
    expect(nav).toContain("Dashboard");
    expect(nav).toContain("getUser");
    expect(PRICING_NAV_LINKS.map((l) => l.label)).toEqual(["Pricing"]);
    expect(PRICING_NAV_LINKS.map((l) => l.href)).toEqual(["/pricing"]);
    expect(nav).not.toContain("Create your Workspace");
    expect(nav).not.toContain("TrackedCtaLink");
    expect(MAIN_NAV_PRODUCT_LINKS.map((l) => l.label)).toEqual([
      "Verify Protocols",
      "Mapping Protocols",
      "Solve / Practice Protocols",
    ]);
  });

  it("Footer links Use cases and Support this Project", () => {
    const footer = read("components/Footer.tsx");
    expect(footer).toMatch(/href:\s*["']\/use-cases["']/);
    expect(footer).toContain("footer.useCases");
    expect(footer).not.toContain('href: "/support"');
  });

  it("home leads with knowledge acquisition, verification, and mapping (no #platform suite, no optimization cards)", () => {
    const page = `${read("app/page.tsx")}\n${read("components/marketing/landing-heroes.tsx")}`;
    expect(page).toContain("LandingHeroEditorial");
    expect(page).toContain("{copy.h1}");
    expect(page).toContain("LANDING_USES");
    expect(page).not.toContain("A Human Knowledge Platform.");
    expect(page).not.toContain("PLATFORM_PRODUCT_LIST");
    expect(page).not.toContain('id="platform"');
    expect(page).not.toContain('eyebrow="PLATFORM"');
    expect(page).not.toContain("See the platform");
    expect(page).not.toContain('id="scale"');
    expect(page).not.toContain('eyebrow="THE APPROACH"');
    expect(page).not.toContain("A Product Suite for Humans and AI Agents");
    expect(page).not.toContain("ProductTable");
    expect(page).not.toContain('id="products"');
    expect(page).not.toContain('eyebrow="PRODUCTS"');
    expect(page).not.toContain("See the products");
    expect(page).not.toContain("Browse use cases");
    expect(page).not.toMatch(/href=\{pillar\.path\}/);
  });
});

describe("platform suite listing CTAs", () => {
  it("ProductTable has no product-page or use-case deep links or Learn more", () => {
    const src = read("components/ProductTable.tsx");
    expect(src).not.toContain("/products/");
    expect(src).not.toContain("/use-cases");
    expect(src).not.toContain("Browse use cases");
    expect(src).not.toContain("Learn more");
    expect(src).toMatch(/Platform/);

    for (const row of LANDING_PRODUCT_ROWS) {
      if (row.href) {
        expect(row.href.startsWith("/products")).toBe(false);
        expect(row.href.startsWith("/use-cases")).toBe(false);
      }
      if (row.ctaLabel) {
        expect(row.ctaLabel.toLowerCase()).not.toContain("learn more");
      }
    }

    const withCta = LANDING_PRODUCT_ROWS.filter((r) => r.href || r.ctaLabel);
    expect(withCta.every((r) => r.name === "Workspace")).toBe(true);
  });

  it("PRODUCTS seo defs no longer carry product-page Learn more CTAs", () => {
    for (const product of PRODUCTS) {
      for (const copy of [product.forHuman, product.forAgent]) {
        if (!copy) continue;
        expect(copy.href).toBeUndefined();
        expect(copy.ctaLabel).toBeUndefined();
      }
    }
  });
});

describe("removed public route trees", () => {
  it("ships a use-cases listing page and no nested product or use-case trees", () => {
    const useCasePages = collectPageTsx(join(ROOT, "app/use-cases"));
    const productPages = collectPageTsx(join(ROOT, "app/products"));
    expect(useCasePages).toEqual([join(ROOT, "app/use-cases/page.tsx")]);
    expect(productPages).toEqual([]);
    expect(existsSync(join(ROOT, "app/use-cases/page.tsx"))).toBe(true);
    expect(existsSync(join(ROOT, "app/products"))).toBe(false);
  });

  it("sitemap lists the use-cases hub and not deleted product URLs", () => {
    const sitemap = read("app/sitemap.ts");
    expect(sitemap).toContain("/use-cases");
    expect(sitemap).not.toContain("/use-cases/");
    expect(sitemap).not.toContain("/products/");
  });

  it("next.config keeps the use-cases listing live and redirects nested leftovers onto it", () => {
    const config = read("next.config.ts");
    expect(config).toMatch(/source:\s*["']\/platform["']/);
    expect(config).toMatch(/source:\s*["']\/use-cases\/:path\+["']/);
    expect(config).toMatch(/source:\s*["']\/products\/:path\*["']/);
    expect(config).not.toMatch(
      /source:\s*["']\/platform["']\s*,\s*destination:\s*["']\/use-cases/,
    );
    expect(config).not.toMatch(
      /source:\s*["']\/use-cases["']\s*,\s*destination:\s*["']\/["']/,
    );
    expect(config).toMatch(
      /source:\s*["']\/use-cases\/:path\+["']\s*,\s*destination:\s*["']\/use-cases["']/,
    );
    expect(config).toMatch(
      /source:\s*["']\/products\/:path\*["']\s*,\s*destination:\s*["']\/["']/,
    );
  });

  it("agent shortcut no longer targets a product page", () => {
    const agent = read("app/agent/page.tsx");
    expect(agent).not.toContain("/products/");
    expect(agent).toMatch(/redirect\(\s*["']\/["']\s*\)/);
  });
});

describe("community nav does not include AYCL", () => {
  it("COMMUNITY_LINKS omits All-You-Can-Learn", () => {
    expect(COMMUNITY_LINKS.map((l) => l.href)).not.toContain("/all-you-can-learn");
  });
});
