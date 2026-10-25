/**
 * Landing-page featured maps. Catalog JSON is the source of DEFS;
 * IDs are UUID v5 from slug (not a DB feature flag). Seed writes the same IDs
 * into staging and production so the carousel list is identical.
 */

import { createHash } from "node:crypto";
import { LANDING_FEATURED_MAP_IDS } from "@/lib/marketing/landing-featured-ids";
import landingFeaturedCatalogJson from "@/lib/marketing/landing-featured-maps.json";

export {
  LANDING_FEATURED_MAP_IDS,
  orderLandingFeaturedMaps,
} from "@/lib/marketing/landing-featured-ids";

/** DNS namespace UUID; namespaced as openlesson.landing.featured.v1.<name> */
const LANDING_FEATURED_NS = Buffer.from("6ba7b8109dad11d180b400c04fd430c8", "hex");

export const LANDING_FEATURED_NOTES_MARKER = "[LP:featured-v1]";

export function landingFeaturedUuid(name: string): string {
  const hash = createHash("sha1");
  hash.update(LANDING_FEATURED_NS);
  hash.update(`openlesson.landing.featured.v1.${name}`);
  const bytes = Buffer.from(hash.digest().subarray(0, 16));
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

export type LandingFeaturedCategory =
  | "Engineering"
  | "AI & ML"
  | "Science"
  | "Math"
  | "Health";

export type LandingFeaturedBlockDef = {
  key: string;
  title: string;
  description: string;
  isStart?: boolean;
  next: readonly string[];
  x: number;
  y: number;
};

export type LandingFeaturedMapDef = {
  slug: string;
  title: string;
  category: LandingFeaturedCategory;
  summary: string;
  description: string;
  goal: string;
  blocks: readonly LandingFeaturedBlockDef[];
};

type LandingFeaturedNode = {
  key: string;
  title: string;
  description: string;
};

type LandingFeaturedCatalogEntry = {
  slug: string;
  title: string;
  category: LandingFeaturedCategory;
  summary: string;
  description: string;
  goal: string;
  start: LandingFeaturedNode;
  left: readonly [LandingFeaturedNode, LandingFeaturedNode, LandingFeaturedNode];
  right: readonly [LandingFeaturedNode, LandingFeaturedNode, LandingFeaturedNode];
  capstone: LandingFeaturedNode;
};

const CATEGORIES = new Set<LandingFeaturedCategory>([
  "Engineering",
  "AI & ML",
  "Science",
  "Math",
  "Health",
]);

function requireNode(value: unknown, label: string): LandingFeaturedNode {
  if (!value || typeof value !== "object") {
    throw new Error(`Featured catalog ${label} must be an object`);
  }
  const rec = value as Record<string, unknown>;
  const key = rec.key;
  const title = rec.title;
  const description = rec.description;
  if (typeof key !== "string" || !key) throw new Error(`Featured catalog ${label}.key missing`);
  if (typeof title !== "string" || !title) throw new Error(`Featured catalog ${label}.title missing`);
  if (typeof description !== "string" || !description) {
    throw new Error(`Featured catalog ${label}.description missing`);
  }
  return { key, title, description };
}

function requireTriple(value: unknown, label: string): LandingFeaturedCatalogEntry["left"] {
  if (!Array.isArray(value) || value.length !== 3) {
    throw new Error(`Featured catalog ${label} must have 3 nodes`);
  }
  return [
    requireNode(value[0], `${label}[0]`),
    requireNode(value[1], `${label}[1]`),
    requireNode(value[2], `${label}[2]`),
  ];
}

function parseLandingFeaturedCatalog(raw: unknown): LandingFeaturedCatalogEntry[] {
  if (!Array.isArray(raw)) throw new Error("Featured catalog JSON must be an array");
  return raw.map((entry, index) => {
    if (!entry || typeof entry !== "object") {
      throw new Error(`Featured catalog entry ${index} must be an object`);
    }
    const rec = entry as Record<string, unknown>;
    const slug = rec.slug;
    const title = rec.title;
    const category = rec.category;
    const summary = rec.summary;
    const description = rec.description;
    const goal = rec.goal;
    if (typeof slug !== "string" || !slug) throw new Error(`Featured catalog entry ${index} slug missing`);
    if (typeof title !== "string" || !title) throw new Error(`${slug} title missing`);
    if (typeof category !== "string" || !CATEGORIES.has(category as LandingFeaturedCategory)) {
      throw new Error(`${slug} category invalid`);
    }
    if (typeof summary !== "string" || !summary) throw new Error(`${slug} summary missing`);
    if (typeof description !== "string" || !description) throw new Error(`${slug} description missing`);
    if (typeof goal !== "string" || !goal) throw new Error(`${slug} goal missing`);
    return {
      slug,
      title,
      category: category as LandingFeaturedCategory,
      summary,
      description,
      goal,
      start: requireNode(rec.start, `${slug}.start`),
      left: requireTriple(rec.left, `${slug}.left`),
      right: requireTriple(rec.right, `${slug}.right`),
      capstone: requireNode(rec.capstone, `${slug}.capstone`),
    };
  });
}

function eightBlockGraph(
  start: LandingFeaturedNode,
  left: LandingFeaturedCatalogEntry["left"],
  right: LandingFeaturedCatalogEntry["right"],
  capstone: LandingFeaturedNode,
): LandingFeaturedBlockDef[] {
  const [l1, l2, l3] = left;
  const [r1, r2, r3] = right;
  return [
    { ...start, isStart: true, next: [l1.key, r1.key], x: 0, y: 0 },
    { ...l1, next: [l2.key], x: -2, y: 1 },
    { ...r1, next: [r2.key], x: 2, y: 1 },
    { ...l2, next: [l3.key], x: -2, y: 2 },
    { ...r2, next: [r3.key], x: 2, y: 2 },
    { ...l3, next: [capstone.key], x: -2, y: 3 },
    { ...r3, next: [capstone.key], x: 2, y: 3 },
    { ...capstone, next: [], x: 0, y: 4 },
  ];
}

const DEFS: readonly LandingFeaturedMapDef[] = parseLandingFeaturedCatalog(
  landingFeaturedCatalogJson,
).map((entry) => ({
  slug: entry.slug,
  title: entry.title,
  category: entry.category,
  summary: entry.summary,
  description: entry.description,
  goal: entry.goal,
  blocks: eightBlockGraph(entry.start, entry.left, entry.right, entry.capstone),
}));

export type LandingFeaturedMap = LandingFeaturedMapDef & {
  id: string;
  notesMarker: string;
  blocks: readonly (LandingFeaturedBlockDef & { id: string })[];
};

export function landingFeaturedNotesMarker(slug: string): string {
  return `${LANDING_FEATURED_NOTES_MARKER} SLUG:${slug}`;
}

export const LANDING_FEATURED_MAPS: readonly LandingFeaturedMap[] = DEFS.map((def) => ({
  ...def,
  id: landingFeaturedUuid(`workspace:${def.slug}`),
  notesMarker: landingFeaturedNotesMarker(def.slug),
  blocks: def.blocks.map((block) => ({
    ...block,
    id: landingFeaturedUuid(`block:${def.slug}:${block.key}`),
  })),
}));

export function landingFeaturedMapById(id: string): LandingFeaturedMap | undefined {
  return LANDING_FEATURED_MAPS.find((map) => map.id === id);
}

export function assertLandingFeaturedCatalog(): {
  mapCount: number;
  blockCount: number;
} {
  if (LANDING_FEATURED_MAPS.length < 20) {
    throw new Error(`Need at least 20 featured maps, got ${LANDING_FEATURED_MAPS.length}`);
  }
  const computedIds = LANDING_FEATURED_MAPS.map((map) => map.id);
  if (computedIds.join(",") !== LANDING_FEATURED_MAP_IDS.join(",")) {
    throw new Error("Featured map UUID v5 ids drifted from LANDING_FEATURED_MAP_IDS");
  }
  const slugs = new Set<string>();
  const ids = new Set<string>();
  let blockCount = 0;
  for (const map of LANDING_FEATURED_MAPS) {
    if (slugs.has(map.slug)) throw new Error(`Duplicate featured slug ${map.slug}`);
    if (ids.has(map.id)) throw new Error(`Duplicate featured id ${map.id}`);
    slugs.add(map.slug);
    ids.add(map.id);
    const starts = map.blocks.filter((block) => block.isStart);
    if (starts.length !== 1) {
      throw new Error(`${map.slug} must have exactly one start block`);
    }
    const keys = new Set(map.blocks.map((block) => block.key));
    for (const block of map.blocks) {
      if (ids.has(block.id)) throw new Error(`Duplicate block id ${block.id}`);
      ids.add(block.id);
      for (const next of block.next) {
        if (!keys.has(next)) throw new Error(`${map.slug} next ${next} missing`);
      }
    }
    blockCount += map.blocks.length;
  }
  return { mapCount: LANDING_FEATURED_MAPS.length, blockCount };
}
