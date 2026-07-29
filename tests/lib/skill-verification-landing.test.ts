/**
 * Structural + content tests for the /skill-verification marketing landing page.
 * Drives the real shipped route sources (no reimplementation of page copy).
 */
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const REPO_ROOT = path.resolve(__dirname, "../..");

function read(rel: string): string {
  return fs.readFileSync(path.join(REPO_ROOT, rel), "utf8");
}

function exists(rel: string): boolean {
  return fs.existsSync(path.join(REPO_ROOT, rel));
}

/** Paths that must not introduce inbound discovery of /skill-verification */
const DISCOVERY_SURFACES = [
  "app/page.tsx",
  "components/LandingNav.tsx",
  "components/Footer.tsx",
  "app/sitemap.ts",
  "app/robots.ts",
  "app/sales/page.tsx",
  "app/pricing/page.tsx",
  "app/plans/page.tsx",
  "components/ProductLandingPage.tsx",
  "components/UseCaseLandingPage.tsx",
  "components/SolutionsBand.tsx",
  "lib/seo/use-case-page.ts",
  "lib/seo/product-page.ts",
] as const;

const SKILL_VERIFICATION_ROUTE_FILES = [
  "app/skill-verification/page.tsx",
  "app/skill-verification/SkillVerificationLanding.tsx",
] as const;

describe("skill-verification landing page route", () => {
  it("ships App Router page at app/skill-verification/page.tsx", () => {
    expect(exists("app/skill-verification/page.tsx")).toBe(true);
    const page = read("app/skill-verification/page.tsx");
    expect(page).toContain("SkillVerificationLanding");
    expect(page).toMatch(/export\s+const\s+metadata/);
    expect(page).toMatch(/export\s+default\s+function/);
  });

  it("ships a multi-section landing component (not a stub)", () => {
    expect(exists("app/skill-verification/SkillVerificationLanding.tsx")).toBe(true);
    const src = read("app/skill-verification/SkillVerificationLanding.tsx");
    // Design system tokens from current LP
    expect(src).toContain("bg-[#0a0a0a]");
    expect(src).toContain("font-mono");
    expect(src).toContain("tracking-[2px]");
    expect(src).toContain("border-zinc-800");
    expect(src).toContain("LandingNav");
    expect(src).toContain("Footer");
    // Multi-section LP structure
    expect(src).toContain('id="who"');
    expect(src).toContain('id="products"');
    expect(src).toContain('id="skill-check"');
    expect(src).toContain('id="take-home"');
    expect(src).toContain('id="funnel"');
    expect(src).toContain('id="cta"');
    expect(src).toContain('data-page="skill-verification"');
  });

  it("targets recruitment / HR / recruitment service provider ICP", () => {
    const src = read("app/skill-verification/SkillVerificationLanding.tsx");
    expect(src.toLowerCase()).toMatch(/recruitment teams/);
    expect(src.toLowerCase()).toMatch(/hr/);
    expect(src.toLowerCase()).toMatch(/fast-scaling startups|scaling startups/);
    expect(src.toLowerCase()).toMatch(/recruitment service providers/);
    expect(src.toLowerCase()).toMatch(/hard.?skill/);
  });

  it("presents both verification products by established product titles", () => {
    const src = read("app/skill-verification/SkillVerificationLanding.tsx");
    expect(src).toContain("Self-Service Skill Check");
    expect(src).toContain("Self-Service Take-Home");
    // Differentiation signals
    expect(src).toMatch(/15\s*min|~15/);
    expect(src.toLowerCase()).toMatch(/work.?sample|multi-block|take-home/);
    expect(src.toLowerCase()).toMatch(/screen|ranking|parallel/);
  });

  it("does not add inbound marketing links from discovery surfaces", () => {
    const offenders: string[] = [];
    for (const rel of DISCOVERY_SURFACES) {
      if (!exists(rel)) continue;
      const text = read(rel);
      if (
        text.includes("/skill-verification") ||
        text.includes("skill-verification")
      ) {
        offenders.push(rel);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("homepage page.tsx remains free of skill-verification coupling", () => {
    const homepage = read("app/page.tsx");
    expect(homepage).not.toContain("skill-verification");
    expect(homepage).not.toContain("SkillVerification");
  });

  it("sitemap does not list /skill-verification", () => {
    const sitemap = read("app/sitemap.ts");
    expect(sitemap).not.toContain("skill-verification");
  });

  it("route files export only local marketing page — no reverse discovery export", () => {
    for (const rel of SKILL_VERIFICATION_ROUTE_FILES) {
      const src = read(rel);
      // Page should not re-export into a shared marketing index
      expect(src).not.toMatch(/HERO_PILLAR|SALES_PRODUCT_CARDS\.push|sitemap/);
    }
  });
});
