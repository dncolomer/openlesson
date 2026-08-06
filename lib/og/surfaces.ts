import { aestheticImageForId, FALLBACK_AESTHETIC_IMAGES } from "@/lib/aesthetics";
import { resolveOgAestheticPath } from "@/lib/og/aesthetic";
import { openGraphImagePathForRoute, openGraphImagesForRoutePath } from "@/lib/og/paths";
import {
  UNSYS_STANDARD_SHARE,
  standardShareImages,
} from "@/lib/og/standard";

export { openGraphImagePathForRoute, openGraphImagesForRoutePath };

export type OgSurface = {
  /** Stable registry key (also used as aesthetic seed unless aestheticImage is set). */
  id: string;
  /** Canonical site path, e.g. `/pricing` or `/`. */
  path: string;
  /** Primary headline on the card. */
  title: string;
  /** Supporting line under the title. */
  description: string;
  /** Small badge / category label. */
  eyebrow: string;
  brand?: string;
  footerLabel?: string;
  /** Explicit `/aesthetics/...` path; when omitted, picked from seed. */
  aestheticImage?: string;
  /** Override aesthetic seed (defaults to `id`). */
  aestheticSeed?: string;
};

/**
 * Build one registry row: every public surface uses the same unsys standard
 * (LP title/text + aesthetics image). Path is kept only for inventory/route mapping.
 */
function standardSurface(id: string, path: string): OgSurface {
  return {
    id,
    path,
    title: UNSYS_STANDARD_SHARE.title,
    description: UNSYS_STANDARD_SHARE.description,
    eyebrow: UNSYS_STANDARD_SHARE.eyebrow,
    brand: UNSYS_STANDARD_SHARE.brand,
    footerLabel: UNSYS_STANDARD_SHARE.footerLabel,
    aestheticSeed: "home",
    aestheticImage: UNSYS_STANDARD_SHARE.aestheticImage,
  };
}

/**
 * Declarative registry of public share surfaces.
 * All surfaces share one unsys standard card (LP-derived title/description + aesthetics).
 * Thin `opengraph-image.tsx` handlers call `createStaticOgImageHandler` / `composeStandardOgImage`.
 */
export const OG_SURFACES: Record<string, OgSurface> = {
  home: standardSurface("home", "/"),
  pricing: standardSurface("pricing", "/pricing"),
  vision: standardSurface("vision", "/vision"),
  science: standardSurface("science", "/science"),
  "docs-proof-of-work-api": standardSurface(
    "docs-proof-of-work-api",
    "/docs/proof-of-work-api",
  ),
  insight: standardSurface("insight", "/insights/[id]"),
  "public-workspace": standardSurface("public-workspace", "/p/[id]/[slug]"),
};

/**
 * Surfaces that must ship the unsys standard title text and aesthetics-backed OG cards.
 */
export const REQUIRED_SHARE_SURFACE_IDS = [
  "home",
  "pricing",
  "vision",
  "science",
  "docs-proof-of-work-api",
  "insight",
  "public-workspace",
] as const;

export type RequiredShareSurfaceId = (typeof REQUIRED_SHARE_SURFACE_IDS)[number];

export function getOgSurface(id: string): OgSurface {
  const surface = OG_SURFACES[id];
  if (!surface) {
    throw new Error(`Unknown OG surface id: ${id}`);
  }
  return surface;
}

export function listOgSurfaces(): OgSurface[] {
  return Object.values(OG_SURFACES);
}

export function listRequiredShareSurfaces(): OgSurface[] {
  return REQUIRED_SHARE_SURFACE_IDS.map((id) => getOgSurface(id));
}

/** Aesthetic public path for a registered surface (always `/aesthetics/...`). */
export function resolveSurfaceAestheticPath(surface: OgSurface): string {
  return resolveOgAestheticPath({
    preferred: surface.aestheticImage,
    seed: surface.aestheticSeed ?? surface.id,
    pool: FALLBACK_AESTHETIC_IMAGES,
  });
}

/** Stable aesthetic for an arbitrary seed (entity routes, ad-hoc cards). */
export function aestheticPathForSeed(seed: string): string {
  return aestheticImageForId(seed, FALLBACK_AESTHETIC_IMAGES);
}

/**
 * Share image descriptors for metadata. Always the unsys standard root card
 * (not per-route `/pricing/opengraph-image` etc.).
 */
export function openGraphImagesForSurface(_surfaceId: string) {
  return standardShareImages();
}
