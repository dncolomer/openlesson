/**
 * Live homepage hero copy and stills.
 * Variant experiments lived on `/marketing/lp-variants` and are gone.
 */
import { PLATFORM_HERO, PLATFORM_PRODUCTS } from "@/lib/marketing/platform";

/** Live session Work canvas still from Downloads/hero3.jpg. */
export const LANDING_HERO_STILL = "/lp-boxes/hero3.jpg" as const;
export const LANDING_HERO_STILL_ALT =
  "Full session: left command sidebar and a Work canvas with a mathematical argument, notes, and a Thinking panel" as const;

export const LANDING_USE_COPY = {
  harness: {
    dek: "Develop understanding through work on difficult problems, through an interface that implements behavioral cognitive enhancements like think-aloud protocols.",
    body: "",
  },
  verification: {
    dek: "Examine understanding through the work itself, and compare verification results on a custom knowledge embeddings model.",
    body: "",
  },
  mapping: {
    dek: "Build a concrete knowledge embeddings model of how a team, a fleet of agents, a mix of both, or just you thinks and works through problems. Then set it against a target region to see where you stand and what to work on next.",
    body: "",
  },
} as const;

export const LANDING_USES = [
  {
    ...PLATFORM_PRODUCTS.harness,
    name: "Solve / Practice",
    dek: LANDING_USE_COPY.harness.dek,
    body: LANDING_USE_COPY.harness.body,
  },
  {
    ...PLATFORM_PRODUCTS.verification,
    dek: LANDING_USE_COPY.verification.dek,
    body: LANDING_USE_COPY.verification.body,
  },
  {
    ...PLATFORM_PRODUCTS.mapping,
    eyebrow: "TARGET MAP",
    dek: LANDING_USE_COPY.mapping.dek,
    body: LANDING_USE_COPY.mapping.body,
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
