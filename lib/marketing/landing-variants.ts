/**
 * Live homepage hero copy and stills.
 * Variant experiments lived on `/marketing/lp-variants` and are gone.
 */
import { PLATFORM_HERO, PLATFORM_PRODUCTS } from "@/lib/marketing/platform";

/** Drafted Learn/Verify session: left rail plus Work canvas. */
export const LANDING_HERO_STILL = "/lp-boxes/session-canvas-blueprint.jpg" as const;
export const LANDING_HERO_STILL_ALT =
  "Blueprint of a live session: left command sidebar and an interactive Work canvas with grid, notes, and arrows" as const;

export const LANDING_USE_COPY = {
  harness: {
    dek: "Acquire knowledge as it is being made.",
    body: "A problem-solving harness for frontier tech research and learning: photonic computing, new materials, BCI systems, agent tooling. It is the working piece of a bottom-up approach based on the Free Energy Principle and epistemic foraging. The work you do is captured as proof, so the knowledge you acquire is held.",
  },
  verification: {
    dek: "Proof from work, for people and for agents.",
    body: "Verify that a person actually holds a skill from genuine work traces, without traditional tests. Results cannot be cheated or faked. The same stack benchmarks the knowledge of agentic harnesses, so labs and teams can score what a given setup knows and compare one configuration to another.",
  },
  mapping: {
    dek: "Correlate neurological patterns with knowledge regions.",
    body: "A product for science. Build studies that look for correlations between neurological patterns and knowledge regions: where a person sits in the embedding, and what the brain is doing there. Use it to study knowledge and to study the brain, with the same geometry the other two uses already write.",
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
} as const;

export function landingHeroCopyText(): string {
  return [
    LANDING_HERO_COPY.h1,
    LANDING_HERO_COPY.p1,
    ...LANDING_USES.flatMap((item) => [item.dek, item.body, item.name, item.href]),
  ].join("\n");
}
