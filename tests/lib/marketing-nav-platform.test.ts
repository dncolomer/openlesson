/**
 * Marketing chrome: Use cases removed; Products → Platform; no product detail routes.
 * Drives real shipped source (LandingNav, Footer, ProductTable, home page, sitemap, redirects).
 */
import { describe, expect, it } from "vitest";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { LANDING_PRODUCT_ROWS } from "@/components/ProductTable";
import { PRODUCTS } from "@/lib/seo/products";

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
  it("LandingNav drops Use cases and links Platform to /#platform (desktop + mobile)", () => {
    const nav = read("components/LandingNav.tsx");
    expect(nav).not.toMatch(/href=["']\/use-cases/);
    expect(nav).not.toMatch(/>\s*Use cases\s*</);
    expect(nav).not.toMatch(/href=["']\/#products["']/);
    expect(nav).not.toMatch(/>\s*Products\s*</);
    expect(nav).toContain('href="/#platform"');
    expect(nav).toMatch(/>\s*Platform\s*</);
    // Both desktop and mobile should mention Platform
    expect(nav.split('href="/#platform"').length - 1).toBeGreaterThanOrEqual(2);
  });

  it("Footer no longer links to /use-cases", () => {
    const footer = read("components/Footer.tsx");
    expect(footer).not.toMatch(/href:\s*["']\/use-cases/);
    expect(footer).not.toContain("footer.useCases");
  });

  it("home platform section is knowledge visual above THE APPROACH (no product suite table)", () => {
    const page = read("app/page.tsx");
    expect(page).toContain('id="platform"');
    expect(page).toContain('eyebrow="PLATFORM"');
    expect(page).toContain("#platform");
    expect(page).toContain("See the platform");
    expect(page).toContain("/knowledgeg2.png");
    expect(page).toContain("data-landing-knowledge-visual");
    expect(page).toContain("knowledge distance");
    expect(page).toContain("custom knowledge regions");
    expect(page).toContain("private");
    // Scale is the last content section (after THE APPROACH) with ranking visual
    expect(page).toContain('id="scale"');
    expect(page).toContain("data-landing-scale-section");
    expect(page).toContain("data-landing-ranking-visual");
    expect(page).toContain("/ranking_app.png");
    expect(page).toContain("Verify and rank knowledge against your own knowledge regions at volume.");
    expect(page).toContain("knowledge verification at scale");
    expect(page).toContain("knowledge regions");
    expect(page).not.toMatch(/role regions/i);
    expect(page).not.toMatch(/recruitment at volume|high-volume hiring/i);
    expect(page).toContain('eyebrow="THE APPROACH"');
    expect(page).not.toContain("— not a quiz score.");
    // Platform → approach → scale (last before footer)
    expect(page.indexOf('id="platform"')).toBeLessThan(page.indexOf('id="approach"'));
    expect(page.indexOf('id="approach"')).toBeLessThan(page.indexOf('id="scale"'));
    expect(page.indexOf('id="scale"')).toBeLessThan(page.indexOf("<Footer"));
    // Ranking asset ships in public/
    expect(existsSync(join(ROOT, "public/ranking_app.png"))).toBe(true);
    // Former product-list suite section is gone
    expect(page).not.toContain("A Product Suite for Humans and AI Agents");
    expect(page).not.toContain("ProductTable");
    expect(page).not.toContain('id="products"');
    expect(page).not.toContain('eyebrow="PRODUCTS"');
    expect(page).not.toContain("See the products");
    expect(page).not.toContain("Browse use cases");
    expect(page).not.toMatch(/Learn more/);
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

    // Only workspace may keep a CTA
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
  it("has zero page.tsx under app/use-cases and app/products", () => {
    const useCasePages = collectPageTsx(join(ROOT, "app/use-cases"));
    const productPages = collectPageTsx(join(ROOT, "app/products"));
    expect(useCasePages).toEqual([]);
    expect(productPages).toEqual([]);
    expect(existsSync(join(ROOT, "app/use-cases"))).toBe(false);
    expect(existsSync(join(ROOT, "app/products"))).toBe(false);
  });

  it("sitemap does not list deleted use-cases or products URLs", () => {
    const sitemap = read("app/sitemap.ts");
    expect(sitemap).not.toContain("/use-cases");
    expect(sitemap).not.toContain("/products/");
  });

  it("next.config redirects former marketing paths to home, not /use-cases destinations", () => {
    const config = read("next.config.ts");
    expect(config).toMatch(/source:\s*["']\/platform["']/);
    expect(config).toMatch(/source:\s*["']\/use-cases["']/);
    expect(config).toMatch(/source:\s*["']\/products\/:path\*["']/);
    // Must not permanently bounce /platform into deleted use-cases hub
    expect(config).not.toMatch(
      /source:\s*["']\/platform["']\s*,\s*destination:\s*["']\/use-cases/,
    );
    // Destinations for removed surfaces should be home
    expect(config).toMatch(
      /source:\s*["']\/use-cases["']\s*,\s*destination:\s*["']\/["']/,
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
