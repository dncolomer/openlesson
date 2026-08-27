import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  aestheticsDiskRoot,
  hasSafeAestheticsSegments,
  isAestheticsPublicPath,
  loadAestheticDataUrl,
  resolveAestheticDiskPath,
  resolveOgAestheticPath,
  toAestheticsPublicPath,
} from "@/lib/og/aesthetic";
import {
  openGraphImagePathForRoute,
  openGraphImagesForRoutePath,
} from "@/lib/og/paths";
import {
  REQUIRED_SHARE_SURFACE_IDS,
  getOgSurface,
  listRequiredShareSurfaces,
  resolveSurfaceAestheticPath,
} from "@/lib/og/surfaces";
import { PLATFORM_HERO } from "@/lib/marketing/platform";
import {
  UNSYS_STANDARD_SHARE,
  UNSYS_STANDARD_SHARE_AESTHETIC,
  UNSYS_STANDARD_SHARE_DESCRIPTION,
  UNSYS_STANDARD_SHARE_IMAGE_PATH,
  UNSYS_STANDARD_SHARE_TITLE,
  standardOpenGraph,
  standardShareImages,
  standardShareSocialMetadata,
  standardTwitter,
  unsysRootHtmlMetadata,
} from "@/lib/og/standard";
import {
  OG_DESCRIPTION_MAX,
  OG_TITLE_MAX,
  shortTitleFromMeta,
  truncateOgDescription,
  truncateOgText,
  truncateOgTitle,
} from "@/lib/og/text";

const REPO_ROOT = path.resolve(__dirname, "../..");
const SCRATCH =
  process.env.GROK_GOAL_SCRATCH ||
  "/var/folders/kd/98qlvkyd4mb3_9t32p9bmt_r0000gn/T/grok-goal-6c95ab69b7c0/implementer";

function writeScratch(name: string, body: string) {
  fs.mkdirSync(SCRATCH, { recursive: true });
  fs.writeFileSync(path.join(SCRATCH, name), body, "utf8");
}

describe("OG text helpers", () => {
  it("truncates long titles within OG_TITLE_MAX and appends ellipsis", () => {
    const long = "A".repeat(OG_TITLE_MAX + 40);
    const truncated = truncateOgTitle(long);
    expect(truncated.length).toBeLessThanOrEqual(OG_TITLE_MAX);
    expect(truncated.endsWith("…")).toBe(true);
    expect(truncated.length).toBe(OG_TITLE_MAX);
  });

  it("leaves short titles unchanged", () => {
    expect(truncateOgTitle("Hello world")).toBe("Hello world");
  });

  it("truncates descriptions within OG_DESCRIPTION_MAX", () => {
    const long = "word ".repeat(80);
    const truncated = truncateOgDescription(long);
    expect(truncated.length).toBeLessThanOrEqual(OG_DESCRIPTION_MAX);
    expect(truncated.endsWith("…")).toBe(true);
  });

  it("collapses whitespace before truncating", () => {
    expect(truncateOgText("  hello   \n  world  ", 100)).toBe("hello world");
  });

  it("shortTitleFromMeta strips brand suffixes", () => {
    expect(shortTitleFromMeta("Pricing - Proof-of-Work Volume | Uncertain Systems")).toBe(
      "Pricing - Proof-of-Work Volume",
    );
    expect(shortTitleFromMeta("Trace Interruption Model (TIM) | Core Engine")).toBe(
      "Trace Interruption Model (TIM)",
    );
  });
});

describe("OG aesthetic resolution", () => {
  it("accepts only /aesthetics/ public paths", () => {
    expect(isAestheticsPublicPath("/aesthetics/lunar/HE2xzURWUAAd6N2.jpeg")).toBe(true);
    expect(isAestheticsPublicPath("/og-default.jpg")).toBe(false);
    expect(isAestheticsPublicPath("https://uncertain.systems/aesthetics/mars/x.jpeg")).toBe(true);
    expect(isAestheticsPublicPath("https://cdn.example.com/other.jpg")).toBe(false);
  });

  it("resolveOgAestheticPath always returns /aesthetics/ prefix", () => {
    const preferred = resolveOgAestheticPath({
      preferred: "/aesthetics/architecture/HHfAOzYWYAAhCDa.jpeg",
      seed: "test",
    });
    expect(preferred.startsWith("/aesthetics/")).toBe(true);

    const fallback = resolveOgAestheticPath({
      preferred: "/og-default.jpg",
      seed: "stable-seed-xyz",
    });
    expect(fallback.startsWith("/aesthetics/")).toBe(true);

    const a = resolveOgAestheticPath({ seed: "stable-seed-xyz" });
    const b = resolveOgAestheticPath({ seed: "stable-seed-xyz" });
    expect(a).toBe(b);
  });

  it("toAestheticsPublicPath strips non-aesthetics URLs", () => {
    expect(toAestheticsPublicPath("/aesthetics/lunar/HE2xzURWUAAd6N2.jpeg")).toBe(
      "/aesthetics/lunar/HE2xzURWUAAd6N2.jpeg",
    );
    expect(toAestheticsPublicPath("/career.jpg")).toBeNull();
  });

  it("loadAestheticDataUrl reads a real aesthetics file from disk", async () => {
    const publicPath = "/aesthetics/lunar/HE2xzURWUAAd6N2.jpeg";
    const dataUrl = await loadAestheticDataUrl(publicPath);
    expect(dataUrl.startsWith("data:image/jpeg;base64,")).toBe(true);
    expect(dataUrl.length).toBeGreaterThan(100);
  });

  it("rejects path traversal attempts before readFile (DB/user-influenced paths)", async () => {
    const attacks = [
      "/aesthetics/../../.env.local",
      "/aesthetics/../.env.local",
      "/aesthetics/foo/../../../.env.local",
      "/aesthetics/./../../package.json",
      "/aesthetics/%2e%2e/%2e%2e/.env.local",
      "https://evil.example/aesthetics/../../.env.local",
    ];

    for (const attack of attacks) {
      expect(isAestheticsPublicPath(attack), attack).toBe(false);
      expect(toAestheticsPublicPath(attack), attack).toBeNull();
      expect(hasSafeAestheticsSegments(attack.startsWith("http") ? new URL(attack).pathname : attack)).toBe(
        false,
      );
      await expect(loadAestheticDataUrl(attack)).rejects.toThrow();
      expect(() => resolveAestheticDiskPath(attack)).toThrow();
    }

    // Preferred traversal falls back to a real aesthetics path (never escapes).
    const resolved = resolveOgAestheticPath({
      preferred: "/aesthetics/../../.env.local",
      seed: "safe-fallback-seed",
    });
    expect(resolved.startsWith("/aesthetics/")).toBe(true);
    expect(resolved.includes("..")).toBe(false);
    const disk = resolveAestheticDiskPath(resolved);
    expect(disk.startsWith(aestheticsDiskRoot() + path.sep)).toBe(true);
  });

  it("resolveAestheticDiskPath keeps legitimate files under public/aesthetics", () => {
    const publicPath = "/aesthetics/lunar/HE2xzURWUAAd6N2.jpeg";
    const disk = resolveAestheticDiskPath(publicPath);
    const root = aestheticsDiskRoot();
    expect(disk.startsWith(root + path.sep)).toBe(true);
    expect(fs.existsSync(disk)).toBe(true);
  });
});

describe("Unsys standard share (LP-derived)", () => {
  it("exports LP hero title, description, aesthetics image, and root image path", async () => {
    expect(UNSYS_STANDARD_SHARE_TITLE).toBe(PLATFORM_HERO.h1);
    expect(UNSYS_STANDARD_SHARE_TITLE).toBe("A Human Knowledge Platform.");
    expect(UNSYS_STANDARD_SHARE_DESCRIPTION).not.toBe(PLATFORM_HERO.p2);
    expect(UNSYS_STANDARD_SHARE_DESCRIPTION).toMatch(/Human Knowledge Platform/);
    expect(UNSYS_STANDARD_SHARE_DESCRIPTION).not.toContain("Learning Harness");
    expect(UNSYS_STANDARD_SHARE_DESCRIPTION).not.toContain("Knowledge Verification");
    expect(UNSYS_STANDARD_SHARE_DESCRIPTION).toMatch(/cannot be cheated or faked/i);
    expect(UNSYS_STANDARD_SHARE_DESCRIPTION.length).toBeGreaterThanOrEqual(120);
    expect(UNSYS_STANDARD_SHARE_DESCRIPTION.length).toBeLessThanOrEqual(160);
    expect(UNSYS_STANDARD_SHARE_AESTHETIC).toBe(
      "/aesthetics/Greco-futurism/HHnTrgVaQAAP-_3.jpeg",
    );
    expect(UNSYS_STANDARD_SHARE_AESTHETIC.startsWith("/aesthetics/")).toBe(true);
    expect(UNSYS_STANDARD_SHARE_IMAGE_PATH).toBe("/opengraph-image");
    const { OG_CONTENT_TYPE } = await import("@/lib/og/compose");
    expect(OG_CONTENT_TYPE).toBe("image/jpeg");
    expect(UNSYS_STANDARD_SHARE.title).toBe(UNSYS_STANDARD_SHARE_TITLE);
    expect(UNSYS_STANDARD_SHARE.description).toBe(UNSYS_STANDARD_SHARE_DESCRIPTION);
    expect(UNSYS_STANDARD_SHARE.eyebrow).toBe("Human Knowledge Platform");
    expect(UNSYS_STANDARD_SHARE.footerLabel).toMatch(/HUMAN KNOWLEDGE PLATFORM/i);
    expect(UNSYS_STANDARD_SHARE.aestheticImage).toBe(UNSYS_STANDARD_SHARE_AESTHETIC);
    expect(UNSYS_STANDARD_SHARE.title).not.toMatch(/learning efficiency for humans & agents/i);
    expect(UNSYS_STANDARD_SHARE.title).not.toMatch(/Beyond benchmarks for AI/i);
    expect(UNSYS_STANDARD_SHARE.description).not.toMatch(/Beyond benchmarks for AI/i);
    expect(UNSYS_STANDARD_SHARE.description).not.toMatch(/four products/i);
    expect(UNSYS_STANDARD_SHARE.description).not.toMatch(/TAP \/ ILE \/ ALE/i);

    // Aesthetic file exists on disk
    const onDisk = path.join(
      REPO_ROOT,
      "public",
      ...UNSYS_STANDARD_SHARE_AESTHETIC.slice(1).split("/"),
    );
    expect(fs.existsSync(onDisk)).toBe(true);

    // LP page still carries the same hero wording (source of truth for copy)
    const lp = fs.readFileSync(path.join(REPO_ROOT, "app/page.tsx"), "utf8");
    expect(lp).toContain("A Human Knowledge Platform.");
    expect(lp).toContain(PLATFORM_HERO.p2);
    expect(lp).not.toContain("Beyond benchmarks for AI.");
    expect(lp).not.toContain("Beyond tests for humans.");
    expect(lp).not.toContain("VERIFICATION . OPTIMIZATION . AUGMENTATION");
    expect(lp).toContain(UNSYS_STANDARD_SHARE_AESTHETIC);

    writeScratch(
      "og-social-copy.txt",
      [
        `title=${UNSYS_STANDARD_SHARE.title}`,
        `description=${UNSYS_STANDARD_SHARE.description}`,
        `eyebrow=${UNSYS_STANDARD_SHARE.eyebrow}`,
        `footer=${UNSYS_STANDARD_SHARE.footerLabel}`,
        `ogTitle=${standardOpenGraph().title}`,
        `ogDescription=${standardOpenGraph().description}`,
        `twitterTitle=${standardTwitter().title}`,
        `twitterDescription=${standardTwitter().description}`,
        `cardDescription=${truncateOgDescription(UNSYS_STANDARD_SHARE_DESCRIPTION)}`,
      ].join("\n"),
    );
  });

  it("unsysRootHtmlMetadata matches LP hero and is what layout emits for title/description", () => {
    const html = unsysRootHtmlMetadata();
    expect(html.title.default).toBe("Uncertain Systems builds a Human Knowledge Platform");
    expect(html.title.default.length).toBeGreaterThanOrEqual(50);
    expect(html.title.default.length).toBeLessThanOrEqual(60);
    expect(html.description).toBe(UNSYS_STANDARD_SHARE_DESCRIPTION);
    expect(html.title.default).not.toMatch(/Learning Efficiency for Humans/i);
    expect(html.description).not.toMatch(/Optimize learning efficiency/i);

    const layout = fs.readFileSync(path.join(REPO_ROOT, "app/layout.tsx"), "utf8");
    expect(layout).toContain("unsysRootHtmlMetadata()");
    expect(layout).toContain("title: rootHtml.title");
    expect(layout).toContain("description: rootHtml.description");
    expect(layout).not.toContain("Learning Efficiency for Humans & Agents");
    expect(layout).not.toContain("Optimize learning efficiency for humans and agentic systems");
  });

  it("standardShareSocialMetadata always points at root opengraph-image with LP copy", () => {
    const social = standardShareSocialMetadata({ url: "https://uncertain.systems/pricing" });
    expect(social.openGraph?.title).toBe(PLATFORM_HERO.h1);
    expect(social.openGraph?.title).toBe("A Human Knowledge Platform.");
    expect(social.openGraph?.description).toBe(UNSYS_STANDARD_SHARE_DESCRIPTION);
    expect(social.openGraph?.description).not.toBe(PLATFORM_HERO.p2);
    expect(social.twitter?.title).toBe(PLATFORM_HERO.h1);
    expect(social.twitter?.description).toBe(UNSYS_STANDARD_SHARE_DESCRIPTION);
    expect(social.twitter?.description).not.toBe(PLATFORM_HERO.p2);
    for (const text of [
      social.openGraph?.title,
      social.openGraph?.description,
      social.twitter?.title,
      social.twitter?.description,
      UNSYS_STANDARD_SHARE_TITLE,
      UNSYS_STANDARD_SHARE_DESCRIPTION,
    ]) {
      expect(text).not.toMatch(/Learning efficiency for humans & agents/i);
      expect(text).not.toMatch(/Learning Efficiency for Humans & Agents/);
      expect(text).not.toMatch(/Optimize learning efficiency for humans and agentic systems/i);
    }
    const images = standardShareImages();
    expect(Array.isArray(images)).toBe(true);
    expect(images).toEqual([
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: expect.stringContaining("A Human Knowledge Platform"),
      },
    ]);
    expect(standardOpenGraph().images).toEqual(images);
    expect(standardTwitter().images).toEqual(["/opengraph-image"]);
    const cardDescription = truncateOgDescription(UNSYS_STANDARD_SHARE_DESCRIPTION);
    expect(cardDescription.length).toBeLessThanOrEqual(OG_DESCRIPTION_MAX);
    expect(cardDescription).toMatch(/Human Knowledge Platform/);
    expect(cardDescription).not.toContain("Learning Harness");
    expect(cardDescription).not.toContain("Knowledge Verification");
    expect(cardDescription).toMatch(/cannot be cheated or faked/i);
    expect(social.openGraph?.description).toBe(UNSYS_STANDARD_SHARE_DESCRIPTION);
    expect(social.twitter?.description).toBe(UNSYS_STANDARD_SHARE_DESCRIPTION);
  });

  it("loadAestheticDataUrl loads the standard share aesthetic", async () => {
    const dataUrl = await loadAestheticDataUrl(UNSYS_STANDARD_SHARE_AESTHETIC);
    expect(dataUrl.startsWith("data:image/")).toBe(true);
    expect(dataUrl.length).toBeGreaterThan(100);
  });
});

describe("OG surface registry", () => {
  it("includes every required share surface with the unsys standard title/description", () => {
    for (const id of REQUIRED_SHARE_SURFACE_IDS) {
      const surface = getOgSurface(id);
      expect(surface.title).toBe(UNSYS_STANDARD_SHARE_TITLE);
      expect(surface.description).toBe(UNSYS_STANDARD_SHARE_DESCRIPTION);
      expect(surface.aestheticImage).toBe(UNSYS_STANDARD_SHARE_AESTHETIC);
      expect(surface.path.trim().length, id).toBeGreaterThan(0);
    }
  });

  it("resolves aesthetics paths under /aesthetics/ for all required surfaces", () => {
    for (const surface of listRequiredShareSurfaces()) {
      const aesthetic = resolveSurfaceAestheticPath(surface);
      expect(aesthetic).toBe(UNSYS_STANDARD_SHARE_AESTHETIC);
      expect(aesthetic.startsWith("/aesthetics/"), surface.id).toBe(true);
      const onDisk = path.join(REPO_ROOT, "public", ...aesthetic.slice(1).split("/"));
      expect(fs.existsSync(onDisk), `${surface.id} -> ${aesthetic}`).toBe(true);
    }
  });

  it("uses one shared aesthetic for every surface", () => {
    const paths = listRequiredShareSurfaces().map((s) => resolveSurfaceAestheticPath(s));
    expect(new Set(paths).size).toBe(1);
    expect(paths[0]).toBe(UNSYS_STANDARD_SHARE_AESTHETIC);
  });
});

describe("OG metadata image URLs", () => {
  it("maps routes to opengraph-image paths (route inventory helper)", () => {
    expect(openGraphImagePathForRoute("/")).toBe("/opengraph-image");
    expect(openGraphImagePathForRoute("/pricing")).toBe("/pricing/opengraph-image");
    expect(openGraphImagePathForRoute("/science")).toBe("/science/opengraph-image");
  });

  it("openGraphImagesForRoutePath returns width/height for crawlers", () => {
    const images = openGraphImagesForRoutePath("/pricing", "Pricing");
    expect(images[0]).toMatchObject({
      url: "/pricing/opengraph-image",
      width: 1200,
      height: 630,
      alt: "Pricing",
    });
  });
});

describe("OG entrypoint wiring (static audit)", () => {
  const expectedEntrypoints = [
    "app/opengraph-image.tsx",
    "app/twitter-image.tsx",
    "app/insights/[id]/opengraph-image.tsx",
    "app/insights/[id]/twitter-image.tsx",
    "app/p/[id]/[slug]/opengraph-image.tsx",
    "app/pricing/opengraph-image.tsx",
    "app/vision/opengraph-image.tsx",
    "app/science/opengraph-image.tsx",
    "app/docs/proof-of-work-api/opengraph-image.tsx",
    "app/all-you-can-learn/[workspaceId]/opengraph-image.tsx",
  ];

  it("ships opengraph-image entrypoints that use the shared compositor / standard", () => {
    for (const rel of expectedEntrypoints) {
      const full = path.join(REPO_ROOT, rel);
      expect(fs.existsSync(full), rel).toBe(true);
      const source = fs.readFileSync(full, "utf8");
      if (rel.endsWith("twitter-image.tsx")) {
        expect(source.includes("opengraph-image")).toBe(true);
        continue;
      }
      const usesShared =
        source.includes("@/lib/og/") ||
        source.includes('from "./opengraph-image"') ||
        source.includes("composeOgImage") ||
        source.includes("composeStandardOgImage") ||
        source.includes("createStaticOgImageHandler");
      expect(usesShared, rel).toBe(true);
      // No primary gradient-only ImageResponse trees left in entrypoints
      expect(source.includes("radial-gradient(circle at"), rel).toBe(false);
      expect(source.includes("linear-gradient(135deg, #0f172a"), rel).toBe(false);
      // No per-entity title/description overrides in image handlers
      expect(source.includes("insight?.title"), rel).toBe(false);
      expect(source.includes("planData?.title"), rel).toBe(false);
      expect(source.includes("assembleAyclLandingSummary"), rel).toBe(false);
    }
  });
});
