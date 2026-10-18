import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  LANDING_FEATURED_MAP_IDS,
  LANDING_FEATURED_MAPS,
  LANDING_FEATURED_NOTES_MARKER,
  assertLandingFeaturedCatalog,
  landingFeaturedUuid,
  orderLandingFeaturedMaps,
} from "@/lib/marketing/landing-featured-maps";
import { LANDING_PUBLIC_MAPS_PATH } from "@/lib/dashboard-home-catalog";

const ROOT = join(__dirname, "../..");

function read(rel: string): string {
  return readFileSync(join(ROOT, rel), "utf8");
}

describe("landing featured maps catalog", () => {
  it("ships at least 20 specific frontier maps with stable ids and one start block each", () => {
    const catalog = assertLandingFeaturedCatalog();
    expect(catalog.mapCount).toBeGreaterThanOrEqual(20);
    expect(catalog.mapCount).toBe(LANDING_FEATURED_MAP_IDS.length);
    expect(catalog.blockCount).toBeGreaterThanOrEqual(catalog.mapCount * 6);
    expect(new Set(LANDING_FEATURED_MAP_IDS).size).toBe(LANDING_FEATURED_MAP_IDS.length);

    const generic = new Set([
      "Mathematics",
      "Physics",
      "Chemistry",
      "Biology",
      "Computer Science",
      "Engineering",
      "Science",
    ]);
    for (const map of LANDING_FEATURED_MAPS) {
      expect(generic.has(map.title)).toBe(false);
      expect(map.title.split(/\s+/).length).toBeGreaterThanOrEqual(3);
      expect(map.blocks.some((block) => block.isStart)).toBe(true);
      expect(map.id).toBe(landingFeaturedUuid(`workspace:${map.slug}`));
      expect(map.notesMarker).toContain(LANDING_FEATURED_NOTES_MARKER);
      expect(map.notesMarker).toContain(map.slug);
    }

    expect(landingFeaturedUuid("workspace:surface-code-mwpm-neural-decoding")).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(orderLandingFeaturedMaps([{ id: LANDING_FEATURED_MAP_IDS[1] }, { id: LANDING_FEATURED_MAP_IDS[0] }]).map(
      (row) => row.id,
    )).toEqual([LANDING_FEATURED_MAP_IDS[0], LANDING_FEATURED_MAP_IDS[1]]);
  });

  it("hardcodes featured ids on the landing maps API instead of latest public rows", () => {
    const route = read("app/api/landing/maps/route.ts");
    expect(route).toContain("LANDING_FEATURED_MAP_IDS");
    expect(route).toContain("orderLandingFeaturedMaps");
    expect(route).toContain('.in("id"');
    expect(route).not.toContain("LANDING_PUBLIC_MAPS_LIMIT");
    expect(route).not.toContain('.eq("is_public", true)');
    expect(read("components/marketing/LandingPublicMapsCarousel.tsx")).toContain(
      LANDING_PUBLIC_MAPS_PATH,
    );
    expect(read("scripts/seed-landing-featured-maps.ts")).toContain("LANDING_FEATURED_MAPS");
    expect(read("scripts/seed-landing-featured-maps.ts")).toContain("--target=prod");
  });
});
