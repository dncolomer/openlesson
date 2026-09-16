/**
 * Single Uncertain Systems (“unsys”) social share standard.
 * Social copy stays on the homepage lead (hard-domain learning experiences).
 * All public OG/Twitter metadata and opengraph-image entrypoints should use this.
 */

import type { Metadata } from "next";
import { PLATFORM_HERO, PLATFORM_PHRASE } from "@/lib/marketing/platform";

/** Social card title — homepage hero lead, not product split. */
export const UNSYS_STANDARD_SHARE_TITLE = PLATFORM_HERO.h1;

/**
 * SERP `<title>` (50–60 characters). og/twitter titles stay on
 * `UNSYS_STANDARD_SHARE_TITLE`.
 */
export const UNSYS_STANDARD_HTML_TITLE =
  "Hard-domain learning experiences | Uncertain Systems" as const;

/**
 * Share + meta description: homepage lead, no product-split headline.
 * Length is 120–160 for SERP and under ~200 for X.
 */
export const UNSYS_STANDARD_SHARE_DESCRIPTION =
  "We author and run hard-domain learning experiences where experts are scarce. Curriculum, Unsys workspace, optional skill validation, and on-site training." as const;

/** LP hero platform phrase — hard-domain learning experiences */
export const UNSYS_STANDARD_SHARE_EYEBROW = PLATFORM_PHRASE;

/** Footer pill chrome on composed cards. */
export const UNSYS_STANDARD_SHARE_FOOTER = PLATFORM_HERO.pill;

/** Brand aesthetics image used on the LP hero set. */
export const UNSYS_STANDARD_SHARE_AESTHETIC =
  "/aesthetics/Greco-futurism/HHnTrgVaQAAP-_3.jpeg";

/** Canonical composed OG image route (root). */
export const UNSYS_STANDARD_SHARE_IMAGE_PATH = "/opengraph-image";

export const UNSYS_STANDARD_SHARE_BRAND = "Uncertain Systems";
export const UNSYS_STANDARD_SHARE_SITE = "uncertain.systems";
export const UNSYS_STANDARD_SHARE_SITE_NAME = "Uncertain Systems";
export const UNSYS_STANDARD_SHARE_TWITTER_CREATOR = "@uncertainsys";

export type UnsysStandardShare = {
  title: string;
  description: string;
  eyebrow: string;
  footerLabel: string;
  brand: string;
  aestheticImage: string;
  imagePath: string;
  siteLabel: string;
  siteName: string;
  twitterCreator: string;
};

/** One immutable standard for every shareable link. */
export const UNSYS_STANDARD_SHARE: UnsysStandardShare = {
  title: UNSYS_STANDARD_SHARE_TITLE,
  description: UNSYS_STANDARD_SHARE_DESCRIPTION,
  eyebrow: UNSYS_STANDARD_SHARE_EYEBROW,
  footerLabel: UNSYS_STANDARD_SHARE_FOOTER,
  brand: UNSYS_STANDARD_SHARE_BRAND,
  aestheticImage: UNSYS_STANDARD_SHARE_AESTHETIC,
  imagePath: UNSYS_STANDARD_SHARE_IMAGE_PATH,
  siteLabel: UNSYS_STANDARD_SHARE_SITE,
  siteName: UNSYS_STANDARD_SHARE_SITE_NAME,
  twitterCreator: UNSYS_STANDARD_SHARE_TWITTER_CREATOR,
};

export function standardShareAlt(): string {
  return `${UNSYS_STANDARD_SHARE.brand} — ${UNSYS_STANDARD_SHARE.title}`;
}

/** Image descriptors for Next Metadata openGraph.images. */
export function standardShareImages(): NonNullable<
  NonNullable<Metadata["openGraph"]>["images"]
> {
  return [
    {
      url: UNSYS_STANDARD_SHARE.imagePath,
      width: 1200,
      height: 630,
      alt: standardShareAlt(),
    },
  ];
}

export function standardOpenGraph(options?: {
  url?: string;
}): NonNullable<Metadata["openGraph"]> {
  return {
    title: UNSYS_STANDARD_SHARE.title,
    description: UNSYS_STANDARD_SHARE.description,
    siteName: UNSYS_STANDARD_SHARE.siteName,
    type: "website",
    locale: "en_US",
    ...(options?.url ? { url: options.url } : {}),
    images: standardShareImages(),
  };
}

export function standardTwitter(): NonNullable<Metadata["twitter"]> {
  return {
    card: "summary_large_image",
    title: UNSYS_STANDARD_SHARE.title,
    description: UNSYS_STANDARD_SHARE.description,
    creator: UNSYS_STANDARD_SHARE.twitterCreator,
    images: [UNSYS_STANDARD_SHARE.imagePath],
  };
}

/** openGraph + twitter blocks that always emit the unsys standard. */
export function standardShareSocialMetadata(options?: {
  url?: string;
}): Pick<Metadata, "openGraph" | "twitter"> {
  return {
    openGraph: standardOpenGraph(options),
    twitter: standardTwitter(),
  };
}

/** Root `<title>` template for nested routes. */
export const UNSYS_ROOT_TITLE_TEMPLATE = "%s | Uncertain Systems";

/**
 * Default HTML title + meta description for crawlers that prefer those
 * tags over Open Graph / Twitter cards.
 */
export function unsysRootHtmlMetadata(): {
  title: { default: string; template: string };
  description: string;
} {
  return {
    title: {
      default: UNSYS_STANDARD_HTML_TITLE,
      template: UNSYS_ROOT_TITLE_TEMPLATE,
    },
    description: UNSYS_STANDARD_SHARE_DESCRIPTION,
  };
}
