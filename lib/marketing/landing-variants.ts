/**
 * Live homepage hero copy and stills.
 * Variant experiments lived on `/marketing/lp-variants` and are gone.
 */
import { PLATFORM_HERO, PLATFORM_PRODUCTS } from "@/lib/marketing/platform";

/** Live session Work canvas still with proof-of-work annotations (pitch slide). */
export const LANDING_HERO_STILL = "/lp-boxes/hero3.jpg" as const;
export const LANDING_HERO_STILL_ALT =
  "Full session Work canvas with proof-of-work annotations on spoken questions, canvas revisions, and verification checks" as const;

export const LANDING_USE_COPY = {
  verification: {
    dek: "Embeddable Knowledge Verification Protocols examine understanding through the work itself, set against a knowledge region and The Protocol Challenge.",
    body: "",
  },
} as const;

export const LANDING_USES = [
  {
    ...PLATFORM_PRODUCTS.verification,
    dek: LANDING_USE_COPY.verification.dek,
    body: LANDING_USE_COPY.verification.body,
  },
] as const;

export const LANDING_HERO_COPY = {
  eyebrow: "PLATFORM",
  h1: PLATFORM_HERO.h1,
  p1: PLATFORM_HERO.p1,
  p2: PLATFORM_HERO.p2,
} as const;

export function landingHeroCopyText(): string {
  return [
    LANDING_HERO_COPY.h1,
    LANDING_HERO_COPY.p1,
    LANDING_HERO_COPY.p2,
    ...LANDING_USES.flatMap((item) => [item.dek, item.body, item.name, item.href, item.cta]),
  ].join("\n");
}
