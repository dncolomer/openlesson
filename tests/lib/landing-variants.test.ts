import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  LANDING_HERO_COPY,
  LANDING_HERO_STILL,
  LANDING_USES,
  landingHeroCopyText,
} from "@/lib/marketing/landing-variants";
import { PLATFORM_CORE, PLATFORM_HERO } from "@/lib/marketing/platform";

const ROOT = join(__dirname, "../..");

function read(rel: string): string {
  return readFileSync(join(ROOT, rel), "utf8");
}

function wordCount(text: string): number {
  return text.trim().split(/\s+/).length;
}

describe("live landing hero", () => {
  it("does not ship the LP design-variant comparison route", () => {
    expect(existsSync(join(ROOT, "app/marketing/lp-variants/page.tsx"))).toBe(false);
    expect(existsSync(join(ROOT, "app/marketing/lp-variants/layout.tsx"))).toBe(false);
    const home = read("app/page.tsx");
    const heroes = read("components/marketing/landing-heroes.tsx");
    const sitemap = read("app/sitemap.ts");
    const nextConfig = read("next.config.ts");
    expect(home).toContain("LandingHeroEditorial");
    expect(home).not.toContain("LandingHeroTriptych");
    expect(home).not.toContain("LandingHeroStrip");
    expect(heroes).not.toContain("LandingHeroTriptych");
    expect(heroes).not.toContain("LandingHeroStrip");
    expect(heroes).not.toContain("LandingRegionImageVariants");
    expect(heroes).toContain("<PublicConsoleWash />");
    expect(heroes).toContain("PublicPageField");
    expect(heroes).toContain("PUBLIC_FIELD_STILLS");
    expect(heroes).not.toContain("AccelerandoRun");
    expect(sitemap).not.toContain("/marketing/lp-variants");
    expect(nextConfig).toContain('source: "/marketing/lp-variants"');
    expect(nextConfig).toContain('destination: "/"');
  });

  it("ships medium-length copy and a combined editorial hero", () => {
    expect(LANDING_HERO_COPY.h1).toBe(PLATFORM_HERO.h1);
    expect(LANDING_USES.map((item) => item.name)).toEqual([
      "Build Understanding",
      "Knowledge Verification",
      "Knowledge Mapping",
    ]);
    for (const use of LANDING_USES) {
      expect(wordCount(use.body)).toBeGreaterThanOrEqual(40);
      expect(wordCount(use.body)).toBeLessThanOrEqual(90);
      expect(use.dek.split(" ").length).toBeGreaterThanOrEqual(6);
    }
    expect(wordCount(LANDING_HERO_COPY.p1)).toBeGreaterThanOrEqual(20);
    expect(wordCount(LANDING_HERO_COPY.p2)).toBeGreaterThanOrEqual(20);

    const heroes = read("components/marketing/landing-heroes.tsx");
    expect(heroes).toContain("data-home-layers");
    expect(heroes).toContain("md:grid-cols-3");
    expect(heroes).toContain("lg:grid-cols-12");
    expect(heroes).toContain("xl:grid-cols-3");
    expect(heroes).toContain("data-home-hero-editorial");
    expect(heroes).not.toContain("data-home-hero-strip");
    expect(heroes).not.toContain("data-region-image-variants");
    expect(heroes).not.toContain("bg-white px-5 py-3 text-sm font-medium text-black");
    expect(PLATFORM_CORE.imageSrc).toBe("/regions1.png");
    expect(existsSync(join(ROOT, "public/regions1.png"))).toBe(true);
    expect(LANDING_HERO_STILL).toBe("/lp-boxes/hero3.jpg");
    expect(existsSync(join(ROOT, "public", LANDING_HERO_STILL.replace(/^\//, "")))).toBe(true);
    expect(heroes).toContain("LANDING_HERO_STILL");
    expect(heroes).toContain("aspect-video");
    expect(heroes).toContain("object-cover");
    expect(heroes).toContain("bg-gradient-to-t from-black");
    expect(heroes).not.toContain("brightness-[1.18]");

    const copy = landingHeroCopyText();
    expect(copy).toMatch(/Problem Solving Harness/);
    expect(copy).toMatch(/Explore understanding/);
    expect(copy).toMatch(/knowledge region/);
    expect(copy).not.toMatch(/\u2014/);
    expect(copy).not.toMatch(/hard-domain learning experiences/i);
  });
});
