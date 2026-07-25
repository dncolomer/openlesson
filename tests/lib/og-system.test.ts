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
import {
  OG_DESCRIPTION_MAX,
  OG_TITLE_MAX,
  shortTitleFromMeta,
  truncateOgDescription,
  truncateOgText,
  truncateOgTitle,
} from "@/lib/og/text";
const REPO_ROOT = path.resolve(__dirname, "../..");

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

describe("OG surface registry", () => {
  it("includes every required share surface with non-empty title text", () => {
    for (const id of REQUIRED_SHARE_SURFACE_IDS) {
      const surface = getOgSurface(id);
      expect(surface.title.trim().length, id).toBeGreaterThan(0);
      expect(surface.description.trim().length, id).toBeGreaterThan(0);
      expect(surface.path.trim().length, id).toBeGreaterThan(0);
    }
  });

  it("resolves aesthetics paths under /aesthetics/ for all required surfaces", () => {
    for (const surface of listRequiredShareSurfaces()) {
      const aesthetic = resolveSurfaceAestheticPath(surface);
      expect(aesthetic.startsWith("/aesthetics/"), surface.id).toBe(true);
      const onDisk = path.join(REPO_ROOT, "public", ...aesthetic.slice(1).split("/"));
      expect(fs.existsSync(onDisk), `${surface.id} -> ${aesthetic}`).toBe(true);
    }
  });

  it("picks stable aesthetics per surface id", () => {
    const a = resolveSurfaceAestheticPath(getOgSurface("pricing"));
    const b = resolveSurfaceAestheticPath(getOgSurface("pricing"));
    expect(a).toBe(b);
  });
});

describe("OG metadata image URLs", () => {
  it("maps routes to opengraph-image paths", () => {
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
  ];

  it("ships opengraph-image entrypoints that use the shared compositor", () => {
    for (const rel of expectedEntrypoints) {
      const full = path.join(REPO_ROOT, rel);
      expect(fs.existsSync(full), rel).toBe(true);
      const source = fs.readFileSync(full, "utf8");
      // twitter re-exports are allowed without compositor import
      if (rel.endsWith("twitter-image.tsx")) {
        expect(source.includes("opengraph-image")).toBe(true);
        continue;
      }
      const usesShared =
        source.includes("@/lib/og/") ||
        source.includes('from "./opengraph-image"') ||
        source.includes("composeOgImage");
      expect(usesShared, rel).toBe(true);
      // No primary gradient-only ImageResponse trees left in entrypoints
      expect(source.includes("radial-gradient(circle at"), rel).toBe(false);
      expect(source.includes("linear-gradient(135deg, #0f172a"), rel).toBe(false);
    }
  });
});
