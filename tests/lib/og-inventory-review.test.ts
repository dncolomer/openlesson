/**
 * Structural inventory: one unsys standard OG share config across registry,
 * dedicated image routes, and public metadata surfaces.
 */
import { describe, expect, it } from "vitest";
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  OG_SURFACES,
  REQUIRED_SHARE_SURFACE_IDS,
  listOgSurfaces,
  resolveSurfaceAestheticPath,
} from "@/lib/og/surfaces";
import { staticOgAlt } from "@/lib/og/create-static-og";
import { openGraphImagePathForRoute } from "@/lib/og/paths";
import { PLATFORM_HERO } from "@/lib/marketing/platform";
import {
  UNSYS_STANDARD_SHARE,
  UNSYS_STANDARD_SHARE_AESTHETIC,
  UNSYS_STANDARD_SHARE_DESCRIPTION,
  UNSYS_STANDARD_SHARE_TITLE,
  standardShareSocialMetadata,
} from "@/lib/og/standard";

const ROOT = join(__dirname, "../..");
const SCRATCH =
  process.env.GROK_GOAL_SCRATCH ||
  "/var/folders/kd/98qlvkyd4mb3_9t32p9bmt_r0000gn/T/grok-goal-6c95ab69b7c0/implementer";

function writeScratch(name: string, body: string) {
  mkdirSync(SCRATCH, { recursive: true });
  writeFileSync(join(SCRATCH, name), body, "utf8");
}

function read(rel: string) {
  return readFileSync(join(ROOT, rel), "utf8");
}

function walkOgRoutes(dir: string, acc: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walkOgRoutes(full, acc);
    else if (name === "opengraph-image.tsx" || name === "twitter-image.tsx") {
      acc.push(full.slice(join(ROOT, "app").length + 1));
    }
  }
  return acc;
}

describe("OG share inventory (one unsys standard)", () => {
  it("lists all registry surfaces with identical unsys standard title, description, aesthetic", () => {
    const surfaces = listOgSurfaces();
    expect(surfaces.length).toBe(7);
    expect(Object.keys(OG_SURFACES).sort()).toEqual(
      [...REQUIRED_SHARE_SURFACE_IDS].sort(),
    );

    expect(UNSYS_STANDARD_SHARE_TITLE).toBe(PLATFORM_HERO.h1);
    expect(UNSYS_STANDARD_SHARE_DESCRIPTION).not.toBe(PLATFORM_HERO.p2);
    expect(UNSYS_STANDARD_SHARE_DESCRIPTION).toMatch(/Human Knowledge Platform/);

    for (const s of surfaces) {
      expect(s.title).toBe(UNSYS_STANDARD_SHARE_TITLE);
      expect(s.description).toBe(UNSYS_STANDARD_SHARE_DESCRIPTION);
      expect(s.eyebrow.trim().length).toBeGreaterThan(0);
      expect(s.brand || "Uncertain Systems").toMatch(/Uncertain Systems/);
      expect(s.footerLabel?.trim().length || 0).toBeGreaterThan(0);
      const aesthetic = resolveSurfaceAestheticPath(s);
      expect(aesthetic).toBe(UNSYS_STANDARD_SHARE_AESTHETIC);
      expect(aesthetic.startsWith("/aesthetics/")).toBe(true);
      expect(staticOgAlt(s.id)).toContain(UNSYS_STANDARD_SHARE_TITLE);
    }

    // One title/description across the whole registry
    const titles = new Set(surfaces.map((s) => s.title));
    const descriptions = new Set(surfaces.map((s) => s.description));
    expect(titles.size).toBe(1);
    expect(descriptions.size).toBe(1);
  });

  it("quotes LP-derived standard from surfaces + standard modules (not per-page product copy)", () => {
    const src = read("lib/og/surfaces.ts");
    const standard = read("lib/og/standard.ts");
    expect(standard).toContain("PLATFORM_HERO.h1");
    expect(UNSYS_STANDARD_SHARE_TITLE).toBe("A Human Knowledge Platform.");
    expect(UNSYS_STANDARD_SHARE_DESCRIPTION).toMatch(/Human Knowledge Platform/);
    expect(UNSYS_STANDARD_SHARE_DESCRIPTION).not.toBe(PLATFORM_HERO.p2);
    expect(standard).not.toContain("Beyond benchmarks for AI. Beyond tests for humans.");
    expect(standard).not.toContain("three verticals for human and agentic learning");
    expect(standard).toContain("Human Knowledge Platform");
    expect(standard).not.toContain("Verification · Optimization · Augmentation");
    expect(standard).toContain("/aesthetics/Greco-futurism/HHnTrgVaQAAP-_3.jpeg");
    expect(src).toContain("UNSYS_STANDARD_SHARE");
    // Old divergent surface copy must be gone
    expect(src).not.toContain("Pricing — Proof-of-Work volume");
    expect(src).not.toContain("Self-driving technology for learning");
    expect(src).not.toContain("A holistic model of knowledge");
    expect(src).not.toContain("Proof-of-Work API specification");
    expect(src).not.toContain("Think-aloud bookmark");
    expect(src).not.toContain("Public plan");
    expect(src).not.toContain("Learning efficiency for humans & agents");
  });

  it("static routes still map to opengraph-image path helpers; entity paths stay dynamic", () => {
    expect(openGraphImagePathForRoute("/")).toBe("/opengraph-image");
    expect(openGraphImagePathForRoute("/pricing")).toBe(
      "/pricing/opengraph-image",
    );
    expect(openGraphImagePathForRoute("/vision")).toBe("/vision/opengraph-image");
    expect(openGraphImagePathForRoute("/science")).toBe(
      "/science/opengraph-image",
    );
    expect(openGraphImagePathForRoute("/docs/proof-of-work-api")).toBe(
      "/docs/proof-of-work-api/opengraph-image",
    );
    expect(OG_SURFACES.insight.path).toContain("[id]");
    expect(OG_SURFACES["public-workspace"].path).toContain("[id]");
  });

  it("discovers every dedicated opengraph-image / twitter-image route under app/", () => {
    const routes = walkOgRoutes(join(ROOT, "app")).sort();
    const expected = [
      "all-you-can-learn/[workspaceId]/opengraph-image.tsx",
      "docs/proof-of-work-api/opengraph-image.tsx",
      "insights/[id]/opengraph-image.tsx",
      "insights/[id]/twitter-image.tsx",
      "opengraph-image.tsx",
      "p/[id]/[slug]/opengraph-image.tsx",
      "pricing/opengraph-image.tsx",
      "pricing/twitter-image.tsx",
      "science/opengraph-image.tsx",
      "twitter-image.tsx",
      "vision/opengraph-image.tsx",
    ].sort();
    expect(routes).toEqual(expected);

    // Static surfaces use createStaticOgImageHandler / staticOgAlt → standard card
    expect(read("app/opengraph-image.tsx")).toContain('staticOgAlt("home")');
    expect(read("app/opengraph-image.tsx")).toContain('runtime = "nodejs"');
    expect(read("app/pricing/opengraph-image.tsx")).toContain(
      'createStaticOgImageHandler("pricing")',
    );
    expect(read("app/vision/opengraph-image.tsx")).toContain('"vision"');
    expect(read("app/science/opengraph-image.tsx")).toContain('"science"');
    expect(read("app/docs/proof-of-work-api/opengraph-image.tsx")).toContain(
      "docs-proof-of-work-api",
    );

    // Dynamic entity cards emit the unsys standard (no per-entity title overrides)
    const insightOg = read("app/insights/[id]/opengraph-image.tsx");
    expect(insightOg).toContain("composeStandardOgImage");
    expect(insightOg).not.toContain("insight?.title");
    expect(insightOg).not.toContain("insight?.summary");

    const publicOg = read("app/p/[id]/[slug]/opengraph-image.tsx");
    expect(publicOg).toContain("composeStandardOgImage");
    expect(publicOg).not.toContain("planData?.title");

    const ayclOg = read("app/all-you-can-learn/[workspaceId]/opengraph-image.tsx");
    expect(ayclOg).toContain("composeStandardOgImage");
    expect(ayclOg).not.toContain("assembleAyclLandingSummary");
    expect(ayclOg).not.toContain("All-You-Can-Learn");
  });

  it("twitter-image routes re-export opengraph-image where present", () => {
    expect(read("app/twitter-image.tsx")).toContain(
      'from "./opengraph-image"',
    );
    expect(read("app/pricing/twitter-image.tsx")).toContain(
      'from "./opengraph-image"',
    );
    expect(read("app/insights/[id]/twitter-image.tsx")).toContain(
      'from "./opengraph-image"',
    );
  });

  it("public share metadata surfaces use standardShareSocialMetadata / standard image", () => {
    const layout = read("app/layout.tsx");
    expect(layout).toContain("standardShareSocialMetadata");
    expect(layout).toContain("@/lib/og/standard");
    expect(layout).toContain("unsysRootHtmlMetadata");
    expect(layout).not.toContain("Learning Efficiency for Humans & Agents");
    expect(layout).not.toContain("Optimize learning efficiency for humans and agentic systems");
    expect(layout).not.toContain("learning efficiency platform");
    expect(layout).toContain("Human Knowledge Platform");
    expect(read("app/manifest.ts")).toContain("UNSYS_STANDARD_SHARE_DESCRIPTION");
    expect(read("app/manifest.ts")).not.toContain(
      "Learning efficiency for humans and agents",
    );

    const pricing = read("app/pricing/layout.tsx");
    expect(pricing).toContain("standardShareSocialMetadata");
    // page <title> may still be product-specific; openGraph must use standard
    expect(pricing).toMatch(/openGraph:\s*standardSocial\.openGraph/);
    expect(pricing).toMatch(/twitter:\s*standardSocial\.twitter/);

    const vision = read("app/vision/page.tsx");
    expect(vision).toContain("standardShareSocialMetadata");
    expect(vision).not.toContain("/vision/opengraph-image");

    const science = read("app/science/page.tsx");
    expect(science).toContain("standardShareSocialMetadata");
    expect(science).not.toContain("/science/opengraph-image");

    const harness = read("app/learning-harness/page.tsx");
    expect(harness).toContain("standardShareSocialMetadata");
    expect(harness).toMatch(/openGraph:\s*standardSocial\.openGraph/);
    expect(harness).toMatch(/twitter:\s*standardSocial\.twitter/);

    const verification = read("app/knowledge-verification/page.tsx");
    expect(verification).toContain("standardShareSocialMetadata");
    expect(verification).toMatch(/openGraph:\s*standardSocial\.openGraph/);
    expect(verification).toMatch(/twitter:\s*standardSocial\.twitter/);

    const docs = read("app/docs/proof-of-work-api/layout.tsx");
    expect(docs).toContain("standardShareSocialMetadata");

    const insightPage = read("app/insights/[id]/page.tsx");
    expect(insightPage).toContain("standardShareSocialMetadata");
    expect(insightPage).not.toContain("openGraph: {\n      title,");

    const publicPage = read("app/p/[id]/[slug]/page.tsx");
    expect(publicPage).toContain("standardShareSocialMetadata");

    const ayclPage = read("app/all-you-can-learn/[workspaceId]/page.tsx");
    expect(ayclPage).toContain("standardShareSocialMetadata");

    const workspacePage = read("app/workspace/[id]/page.tsx");
    expect(workspacePage).toContain("standardShareSocialMetadata");

    const mok = read("app/map-of-knowledge/page.tsx");
    expect(mok).toContain("standardShareSocialMetadata");
    expect(mok).not.toContain("The Map of Knowledge | Uncertain Systems");

    const tapbench = read("app/tapbench/page.tsx");
    expect(tapbench).toContain("standardShareSocialMetadata");

    const hack = read("app/community-events/page.tsx");
    expect(hack).toContain("standardShareSocialMetadata");

    const skill = read("app/skill-verification/page.tsx");
    expect(skill).toContain("metadata");
    expect(skill).not.toContain("openGraph:");

    // SEO helpers
    expect(read("lib/seo/product-page.ts")).toContain("standardShareSocialMetadata");
    expect(read("lib/seo/use-case-page.ts")).toContain("standardShareSocialMetadata");
    expect(read("lib/seo/platform-page.ts")).toContain("standardShareSocialMetadata");

    // Standard module is the single source of share title/description/image
    expect(UNSYS_STANDARD_SHARE.imagePath).toBe("/opengraph-image");
    expect(UNSYS_STANDARD_SHARE.aestheticImage).toBe(
      "/aesthetics/Greco-futurism/HHnTrgVaQAAP-_3.jpeg",
    );
    const social = standardShareSocialMetadata();
    expect(social.openGraph?.title).toBe(PLATFORM_HERO.h1);
    expect(social.openGraph?.description).toBe(UNSYS_STANDARD_SHARE_DESCRIPTION);
    expect(social.twitter?.title).toBe(PLATFORM_HERO.h1);
    expect(social.twitter?.description).toBe(UNSYS_STANDARD_SHARE_DESCRIPTION);
    for (const text of [
      social.openGraph?.title,
      social.openGraph?.description,
      social.twitter?.title,
      social.twitter?.description,
    ]) {
      expect(text).not.toMatch(/Learning efficiency for humans & agents/i);
      expect(text).not.toMatch(/Learning Efficiency for Humans & Agents/);
      expect(text).not.toMatch(/Optimize learning efficiency for humans and agentic systems/i);
    }
    expect(existsSync(join(ROOT, "lib/og/standard.ts"))).toBe(true);

    writeScratch(
      "og-social-surfaces.txt",
      [
        "layout: standardShareSocialMetadata + unsysRootHtmlMetadata",
        "surfaces: UNSYS_STANDARD_SHARE title/description/eyebrow from PLATFORM_HERO",
        "compose: composeStandardOgImage uses UNSYS_STANDARD_SHARE.title + description",
        `ogTitle=${social.openGraph?.title}`,
        `ogDescription=${social.openGraph?.description}`,
        `twitterTitle=${social.twitter?.title}`,
        "TAP/in-app product copy is not the OG source",
        `layoutHasEfficiencyPlatform=${layout.includes("learning efficiency platform")}`,
        `docsOgUsesStandard=${docs.includes("standardShareSocialMetadata")}`,
      ].join("\n"),
    );
  });

  it("composed card chrome fields remain brand + eyebrow + title + description + footerLabel + siteLabel", () => {
    const compose = read("lib/og/compose.tsx");
    expect(compose).toContain("footerLabel");
    expect(compose).toContain("eyebrow");
    expect(compose).toContain("siteLabel");
    expect(compose).toContain("composeStandardOgImage");
    expect(compose).toContain("UNSYS_STANDARD_SHARE");
    expect(compose).toContain("UNSYS_STANDARD_SHARE.title");
    expect(compose).toContain("UNSYS_STANDARD_SHARE.description");
    expect(compose).not.toContain("Uncertain Systems is a Human Knowledge Platform.");
    expect(compose).toContain(
      'input.siteLabel?.trim() || "uncertain.systems"',
    );
    expect(compose).toContain(
      'input.footerLabel?.trim() || "Uncertain Systems"',
    );
  });
});
