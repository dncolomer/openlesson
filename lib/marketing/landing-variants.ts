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
    dek: "Develop understanding through work on difficult problems.",
    body: "The Problem Solving Harness is how Build Understanding works in software today. You work through a demanding problem, make reasoning visible through supported session inputs, and follow up on gaps the work reveals. AI can sit in that working environment where the session supports it. The result is a work trace and a clearer basis for further investigation, not a finished course.",
  },
  verification: {
    dek: "Examine understanding through the work itself.",
    body: "Knowledge Verification looks at how someone explores a demanding problem, tests assumptions, and develops their reasoning, alongside the answer they reach. A session stores that work and can relate it to a knowledge region you define. The result is evidence for a hiring or development decision, not a score of the whole person.",
  },
  mapping: {
    dek: "Relate understanding to your domain of work.",
    body: "Knowledge Mapping is the domain asset: a knowledge region built around your expertise, with positions informed by work. Use it as a reference while people develop understanding and when you examine that understanding. It is a model of the domain you care about, not a neurological instrument and not a complete picture of competence.",
  },
} as const;

export const LANDING_USES = [
  {
    ...PLATFORM_PRODUCTS.harness,
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
