import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  FEATURED_AESTHETIC_MIN_LONG_EDGE,
  FEATURED_AESTHETIC_MIN_SHORT_EDGE,
  FEATURED_FALLBACK_AESTHETIC_IMAGES,
  HIGH_RESOLUTION_SYSTEM_AESTHETIC_IMAGES,
  featuredStoredCoverUrl,
  filterFeaturedAestheticPool,
  isHighResolutionAestheticSize,
  isHighResolutionSystemAestheticUrl,
  readRasterDimensions,
  systemAestheticPath,
} from "@/lib/aesthetic-resolution";
import { readRepo } from "../helpers/surface-source";

const ROOT = join(__dirname, "../..");
const AESTHETICS_DIR = join(ROOT, "public", "aesthetics");

function listSystemAestheticImages(): string[] {
  const images: string[] = [];
  for (const entry of readdirSync(AESTHETICS_DIR, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name.startsWith(".")) continue;
    const dir = join(AESTHETICS_DIR, entry.name);
    for (const file of readdirSync(dir, { withFileTypes: true })) {
      if (!file.isFile()) continue;
      if (!/\.(jpe?g|png|webp|gif|avif)$/i.test(file.name)) continue;
      images.push(`/aesthetics/${entry.name}/${file.name}`);
    }
  }
  return images.sort();
}

function publicPathForAestheticUrl(url: string): string {
  return join(ROOT, "public", url.replace(/^\//, ""));
}

describe("high-resolution featured aesthetics", () => {
  const onDisk = listSystemAestheticImages();
  const measuredHighRes = onDisk.filter((url) => {
    const bytes = new Uint8Array(readFileSync(publicPathForAestheticUrl(url)));
    const size = readRasterDimensions(bytes);
    expect(size, url).toBeTruthy();
    return isHighResolutionAestheticSize(size!.width, size!.height);
  });

  it("treats long≥1600 and short≥800 as high-res", () => {
    expect(FEATURED_AESTHETIC_MIN_LONG_EDGE).toBe(1600);
    expect(FEATURED_AESTHETIC_MIN_SHORT_EDGE).toBe(800);
    expect(isHighResolutionAestheticSize(1600, 800)).toBe(true);
    expect(isHighResolutionAestheticSize(1920, 800)).toBe(true);
    expect(isHighResolutionAestheticSize(2048, 2048)).toBe(true);
    expect(isHighResolutionAestheticSize(896, 1200)).toBe(false);
    expect(isHighResolutionAestheticSize(307, 680)).toBe(false);
    expect(isHighResolutionAestheticSize(816, 1456)).toBe(false);
    expect(isHighResolutionAestheticSize(1600, 799)).toBe(false);
  });

  it("keep the allowlist equal to on-disk stills that pass the size bar", () => {
    expect(measuredHighRes.length).toBeGreaterThan(0);
    expect([...HIGH_RESOLUTION_SYSTEM_AESTHETIC_IMAGES].sort()).toEqual(
      measuredHighRes,
    );
    expect(
      HIGH_RESOLUTION_SYSTEM_AESTHETIC_IMAGES.includes(
        "/aesthetics/galactic-stoneworks/HHpCr91aoAAVXmd.jpeg",
      ),
    ).toBe(false);
    expect(
      isHighResolutionSystemAestheticUrl(
        "/aesthetics/piotr-binkowski/HGHQJOtWgAAOGtm.jpeg",
      ),
    ).toBe(false);
    expect(
      isHighResolutionSystemAestheticUrl(
        "/aesthetics/lunar/HE2xzURWUAAd6N2.jpeg",
      ),
    ).toBe(true);
    for (const url of FEATURED_FALLBACK_AESTHETIC_IMAGES) {
      expect(HIGH_RESOLUTION_SYSTEM_AESTHETIC_IMAGES).toContain(url);
    }
  });

  it("reads JPEG SOF dimensions for shipped stills", () => {
    const tiny = readRasterDimensions(
      new Uint8Array(
        readFileSync(
          publicPathForAestheticUrl(
            "/aesthetics/galactic-stoneworks/HHpCr91aoAAVXmd.jpeg",
          ),
        ),
      ),
    );
    expect(tiny).toEqual({ width: 307, height: 680 });
    const large = readRasterDimensions(
      new Uint8Array(
        readFileSync(
          publicPathForAestheticUrl(
            "/aesthetics/piotr-binkowski/HF4WSpPWIAAe0iD.jpeg",
          ),
        ),
      ),
    );
    expect(large).toEqual({ width: 3085, height: 4096 });
  });

  it("drops Twitter-crop system stills from the Featured pool", () => {
    const mixed = [
      "/aesthetics/galactic-stoneworks/HHpCr91aoAAVXmd.jpeg",
      "/aesthetics/piotr-binkowski/HGHQJOtWgAAOGtm.jpeg",
      "/aesthetics/lunar/HE2xzURWUAAd6N2.jpeg",
      "/aesthetics/architecture/HHfAOzYWYAAhCDa.jpeg",
      "/aesthetics/piotr-binkowski/HF4WSpPWIAAe0iD.jpeg",
    ];
    expect(filterFeaturedAestheticPool(mixed)).toEqual([
      "/aesthetics/lunar/HE2xzURWUAAd6N2.jpeg",
      "/aesthetics/piotr-binkowski/HF4WSpPWIAAe0iD.jpeg",
    ]);
    expect(filterFeaturedAestheticPool(null)).toEqual([
      ...FEATURED_FALLBACK_AESTHETIC_IMAGES,
    ]);
    expect(
      filterFeaturedAestheticPool([
        "/aesthetics/galactic-stoneworks/HHpCr91aoAAVXmd.jpeg",
      ]),
    ).toEqual([...FEATURED_FALLBACK_AESTHETIC_IMAGES]);
  });

  it("keeps a custom org set for Featured instead of mixing system stills", () => {
    const custom = [
      "https://cdn.example/org/wide.png",
      "https://cdn.example/org/tall.webp",
    ];
    expect(filterFeaturedAestheticPool(custom)).toEqual(custom);
  });

  it("ignores stored low-res /aesthetics/ covers on Featured cards", () => {
    expect(
      featuredStoredCoverUrl("/aesthetics/galactic-stoneworks/HHpCr91aoAAVXmd.jpeg"),
    ).toBeNull();
    expect(
      featuredStoredCoverUrl("/aesthetics/piotr-binkowski/HGHQJOtWgAAOGtm.jpeg"),
    ).toBeNull();
    expect(
      featuredStoredCoverUrl("/aesthetics/lunar/HE2xzURWUAAd6N2.jpeg"),
    ).toBe("/aesthetics/lunar/HE2xzURWUAAd6N2.jpeg");
    expect(featuredStoredCoverUrl("https://cdn.example/org/cover.jpg")).toBe(
      "https://cdn.example/org/cover.jpg",
    );
    expect(featuredStoredCoverUrl(null)).toBeNull();
    expect(systemAestheticPath("/aesthetics/lunar/HE2xzURWUAAd6N2.jpeg")).toBe(
      "/aesthetics/lunar/HE2xzURWUAAd6N2.jpeg",
    );
  });

  it("wires Home Featured hero and secondary to the high-res pool", () => {
    const home = readRepo("components/dashboard/dashboard-home-tab.tsx");
    expect(home).toContain("filterFeaturedAestheticPool");
    expect(home).toContain("featuredStoredCoverUrl");
    expect(home).toContain("featuredCoverPool");
    const heroAt = home.indexOf("data-dashboard-home-hero");
    const secondaryAt = home.indexOf("data-dashboard-home-secondary");
    const gridAt = home.indexOf("data-dashboard-home-maps-grid");
    expect(heroAt).toBeGreaterThan(-1);
    expect(secondaryAt).toBeGreaterThan(heroAt);
    expect(gridAt).toBeGreaterThan(secondaryAt);
    expect(home.slice(heroAt, secondaryAt)).toContain("featuredCoverPool");
    expect(home.slice(heroAt, secondaryAt)).toContain("featuredStoredCoverUrl");
    expect(home.slice(secondaryAt, gridAt)).toContain("featuredImagePool={featuredCoverPool}");
    expect(home).toContain("isHomeFeaturedMapId");
    expect(home.slice(gridAt)).toContain("imagePool={coverImagePool}");
  });
});
