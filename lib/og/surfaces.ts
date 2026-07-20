import { aestheticImageForId, FALLBACK_AESTHETIC_IMAGES } from "@/lib/aesthetics";
import {
  ALE_PAGE,
  ILE_PAGE,
  POW_API_PAGE,
  TAP_PAGE,
  TIM_PAGE,
  type SeoProductPageConfig,
} from "@/lib/seo/product-page";
import {
  LEARNING_AUGMENTATION_PAGE,
  LEARNING_OPTIMIZATION_PAGE,
  LEARNING_VERIFICATION_PAGE,
  type SeoUseCasePageConfig,
} from "@/lib/seo/use-case-page";
import { shortTitleFromMeta } from "@/lib/og/text";
import { resolveOgAestheticPath } from "@/lib/og/aesthetic";
import { openGraphImagePathForRoute, openGraphImagesForRoutePath } from "@/lib/og/paths";

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

const BRAND = "Uncertain Systems";

function productSurface(page: SeoProductPageConfig, extras?: Partial<OgSurface>): OgSurface {
  return {
    id: `product:${page.slug}`,
    path: page.path,
    title: shortTitleFromMeta(page.metaTitle) || page.eyebrow,
    description: page.metaDescription,
    eyebrow: page.eyebrow,
    brand: BRAND,
    footerLabel: "Product",
    aestheticSeed: page.path,
    ...extras,
  };
}

function buildUseCaseSurface(page: SeoUseCasePageConfig, extras?: Partial<OgSurface>): OgSurface {
  return {
    id: `use-case:${page.slug}`,
    path: page.path,
    title: shortTitleFromMeta(page.metaTitle) || page.eyebrow,
    description: page.metaDescription,
    eyebrow: page.eyebrow,
    brand: BRAND,
    footerLabel: "Use case",
    aestheticSeed: page.path,
    ...extras,
  };
}

/**
 * Declarative registry of public share surfaces.
 * Add a row here, then a thin `opengraph-image.tsx` that calls `createStaticOgImageHandler(id)`.
 */
export const OG_SURFACES: Record<string, OgSurface> = {
  home: {
    id: "home",
    path: "/",
    title: "Learning efficiency for humans & agents",
    description:
      "Measure what learners actually absorb — not just completion. Proof-of-Work API, Think Aloud Protocol, ILE, and ALE on Workspaces.",
    eyebrow: "Learning efficiency",
    brand: BRAND,
    footerLabel: "LEARNING EFFICIENCY • HUMANS & AGENTS",
    aestheticSeed: "home",
    aestheticImage: "/aesthetics/Greco-futurism/HHnTrgVaQAAP-_3.jpeg",
  },
  pricing: {
    id: "pricing",
    path: "/pricing",
    title: "Pricing — Proof-of-Work volume",
    description:
      "Meter proof-of-work artifacts across TAP, ILE, and the API. Plans scale with measurement and learning world model effort.",
    eyebrow: "Pricing",
    brand: BRAND,
    footerLabel: "Plans",
    aestheticSeed: "/pricing",
  },
  vision: {
    id: "vision",
    path: "/vision",
    title: "Self-driving technology for learning",
    description:
      "Non-invasive systems that raise attention and understanding without asking humans to burn proportionally more energy.",
    eyebrow: "Vision",
    brand: BRAND,
    footerLabel: "Company",
    aestheticSeed: "/vision",
    aestheticImage: "/aesthetics/Greco-futurism/HHnTrjJbQAAOz7K.jpeg",
  },
  science: {
    id: "science",
    path: "/science",
    title: "A holistic model of knowledge",
    description:
      "Knowledge configuration, proximity, transformation, and a non-invasive path to self-driving learning.",
    eyebrow: "Science",
    brand: BRAND,
    footerLabel: "Research",
    aestheticSeed: "/science",
    aestheticImage: "/aesthetics/Greco-futurism/HHnTrlMaAAAg_4I.jpeg",
  },
  demo: {
    id: "demo",
    path: "/demo",
    title: "Proof-of-Work API demo",
    description: "Try workspace creation, evidence upload, and learning efficiency scoring in the browser.",
    eyebrow: "Demo",
    brand: BRAND,
    footerLabel: "Interactive",
    aestheticSeed: "/demo",
  },
  "docs-proof-of-work-api": {
    id: "docs-proof-of-work-api",
    path: "/docs/proof-of-work-api",
    title: "Proof-of-Work API specification",
    description:
      "Enable AI agents to create Workspaces, issue Think Aloud Protocol links, route ILE practice, and read learning efficiency results.",
    eyebrow: "Docs",
    brand: BRAND,
    footerLabel: "API reference",
    aestheticSeed: "/docs/proof-of-work-api",
  },
  "use-cases": {
    id: "use-cases",
    path: "/use-cases",
    title: "Use cases & products",
    description:
      "Learning verification, learning optimization, and reasoning augmentation — plus Proof-of-Work API, TAP, ILE, and ALE.",
    eyebrow: "Use cases",
    brand: BRAND,
    footerLabel: "Hub",
    aestheticSeed: "use-cases-hub",
  },
  "product:trace-interruption-model": productSurface(TIM_PAGE),
  "product:proof-of-work-api": productSurface(POW_API_PAGE),
  "product:think-aloud-protocol": productSurface(TAP_PAGE),
  "product:integrated-learning-environment": productSurface(ILE_PAGE),
  "product:agentic-learning-environment": productSurface(ALE_PAGE),
  "use-case:learning-verification": buildUseCaseSurface(LEARNING_VERIFICATION_PAGE),
  "use-case:learning-optimization": buildUseCaseSurface(LEARNING_OPTIMIZATION_PAGE),
  "use-case:reasoning-augmentation": buildUseCaseSurface(LEARNING_AUGMENTATION_PAGE),
  /** Entity chrome — title/description filled at request time. */
  insight: {
    id: "insight",
    path: "/insights/[id]",
    title: "Insight",
    description: "A bookmark from think-aloud learning on Uncertain Systems.",
    eyebrow: "Insight",
    brand: BRAND,
    footerLabel: "Think-aloud bookmark",
    aestheticSeed: "insight",
  },
  "public-workspace": {
    id: "public-workspace",
    path: "/p/[id]/[slug]",
    title: "Workspace",
    description: "A public workspace on Uncertain Systems.",
    eyebrow: "Public workspace",
    brand: BRAND,
    footerLabel: "Public plan",
    aestheticSeed: "public-workspace",
  },
};

/**
 * Surfaces that must ship non-empty title text and aesthetics-backed OG cards
 * (acceptance criterion 4).
 */
export const REQUIRED_SHARE_SURFACE_IDS = [
  "home",
  "pricing",
  "vision",
  "science",
  "demo",
  "docs-proof-of-work-api",
  "use-cases",
  "product:trace-interruption-model",
  "product:proof-of-work-api",
  "product:think-aloud-protocol",
  "product:integrated-learning-environment",
  "product:agentic-learning-environment",
  "use-case:learning-verification",
  "use-case:learning-optimization",
  "use-case:reasoning-augmentation",
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

export function openGraphImagesForSurface(surfaceId: string) {
  const surface = getOgSurface(surfaceId);
  // Dynamic entity paths are handled by their own generateMetadata; static surfaces only.
  if (surface.path.includes("[")) {
    return [{ url: "/opengraph-image", width: 1200, height: 630, alt: surface.title }];
  }
  return openGraphImagesForRoutePath(surface.path, surface.title);
}
