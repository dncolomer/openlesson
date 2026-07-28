/**
 * Pure pricing-scenario helpers for the /pricing page.
 *
 * Maps sales product lines (from SALES_PRODUCT_CARDS) to illustrative
 * billable units and estimates monthly API Metered cost via the same
 * rates as production billing (`estimateApiMeteredInvoice`).
 *
 * Scenario → unit mappings are assumptions for education, not contractual SKUs.
 */

import {
  estimateApiMeteredInvoice,
  type ApiMeteredInvoiceEstimate,
} from "@/lib/plans";
import { SALES_PRODUCT_CARDS } from "@/lib/sales/product-cards";

/** Sales product slugs used as scenario tabs on the pricing page. */
export const PRICING_SCENARIO_SLUGS = [
  "self-service-skill-check",
  "self-service-take-home",
  "learning-loop",
  "pow-augmented-apps",
] as const;

export type PricingScenarioSlug = (typeof PRICING_SCENARIO_SLUGS)[number];

export type ScenarioSliderKey = "volume" | "secondary";

export type ScenarioSliderDef = {
  key: ScenarioSliderKey;
  /** Short label shown next to the control. */
  label: string;
  /** Help text under the slider. */
  hint: string;
  min: number;
  max: number;
  step: number;
  defaultValue: number;
};

/**
 * How a scenario converts UI slider values into billable units.
 * All multipliers are documented assumptions (see `assumptions`).
 */
export type ScenarioUnitMapping =
  | {
      kind: "tap_per_unit";
      /** Billable TAP sessions = volume * tapPerUnit */
      tapPerUnit: number;
      /** Optional secondary volume → extra TAP sessions (e.g. rechecks). */
      secondaryTapPerUnit?: number;
    }
  | {
      kind: "ile_per_unit";
      ilePerUnit: number;
      /** Optional screening TAP sessions run before each take-home. */
      screeningTapPerUnit?: number;
    }
  | {
      kind: "api_pow";
      /** External/API PoW submissions = volume * powPerUnit */
      powPerUnit: number;
      /** Optional secondary: active users × sessions-like multiplier still as PoW. */
      secondaryPowPerUnit?: number;
    };

export type PricingScenarioConfig = {
  slug: PricingScenarioSlug;
  /** Must match sales product card title. */
  title: string;
  /** Short context from the sales card (one-liner). */
  context: string;
  salesPath: string;
  sliders: ScenarioSliderDef[];
  mapping: ScenarioUnitMapping;
  /**
   * Human-readable assumptions shown next to the estimate.
   * Must make trial vs metered and TAP/ILE vs external PoW clear.
   */
  assumptions: string[];
};

function salesCardMeta(slug: PricingScenarioSlug): {
  title: string;
  context: string;
  salesPath: string;
} {
  const card = SALES_PRODUCT_CARDS.find((c) => c.slug === slug);
  if (!card) {
    throw new Error(`Missing sales product card for pricing scenario: ${slug}`);
  }
  return {
    title: card.title,
    context: card.oneLine,
    salesPath: card.path,
  };
}

/**
 * Scenario catalog aligned with sales product cards.
 * Defaults illustrate a modest monthly campaign / integration volume.
 */
export const PRICING_SCENARIOS: readonly PricingScenarioConfig[] = [
  (() => {
    const meta = salesCardMeta("self-service-skill-check");
    return {
      slug: "self-service-skill-check" as const,
      ...meta,
      sliders: [
        {
          key: "volume" as const,
          label: "Candidates / month",
          hint: "Each candidate completes one ~15-minute Skill Check (TAP session).",
          min: 10,
          max: 500,
          step: 10,
          defaultValue: 50,
        },
        {
          key: "secondary" as const,
          label: "Retakes / month",
          hint: "Optional re-screens billed as additional TAP sessions.",
          min: 0,
          max: 100,
          step: 5,
          defaultValue: 0,
        },
      ],
      mapping: {
        kind: "tap_per_unit" as const,
        tapPerUnit: 1,
        secondaryTapPerUnit: 1,
      },
      assumptions: [
        "Illustrative API Metered estimate — not a live invoice or contract quote.",
        "Each candidate Skill Check maps to 1 TAP session ($1 each).",
        "Retakes map 1:1 to extra TAP sessions.",
        "PoW produced inside TAP is not billed as external API PoW.",
        "Platform access is $99/mo on API Metered; 3-day trial is a separate one-time $19.99 product access purchase (unlimited during trial).",
      ],
    };
  })(),
  (() => {
    const meta = salesCardMeta("self-service-take-home");
    return {
      slug: "self-service-take-home" as const,
      ...meta,
      sliders: [
        {
          key: "volume" as const,
          label: "Take-home candidates / month",
          hint: "Each multi-block assignment maps to 1 ILE session ($10).",
          min: 1,
          max: 100,
          step: 1,
          defaultValue: 10,
        },
        {
          key: "secondary" as const,
          label: "Prior skill checks / month",
          hint: "Optional TAP screens before the take-home (common funnel).",
          min: 0,
          max: 500,
          step: 10,
          defaultValue: 50,
        },
      ],
      mapping: {
        kind: "ile_per_unit" as const,
        ilePerUnit: 1,
        screeningTapPerUnit: 1,
      },
      assumptions: [
        "Illustrative API Metered estimate — not a live invoice or contract quote.",
        "Each Self-Service Take-Home journey maps to 1 ILE session ($10 each).",
        "Prior skill checks (if any) map to TAP sessions ($1 each), not extra ILE.",
        "PoW generated inside ILE/TAP is not billed as external API PoW.",
        "Platform access is $99/mo on API Metered; trial is separate one-time access.",
      ],
    };
  })(),
  (() => {
    const meta = salesCardMeta("learning-loop");
    return {
      slug: "learning-loop" as const,
      ...meta,
      sliders: [
        {
          key: "volume" as const,
          label: "Learner checks / month",
          hint: "Short post-session or mid-stream learning checks as TAP sessions.",
          min: 10,
          max: 1000,
          step: 10,
          defaultValue: 100,
        },
        {
          key: "secondary" as const,
          label: "Deeper ILE blocks / month",
          hint: "Optional longer comprehension blocks billed as ILE ($10 each).",
          min: 0,
          max: 50,
          step: 1,
          defaultValue: 0,
        },
      ],
      mapping: {
        kind: "tap_per_unit" as const,
        tapPerUnit: 1,
        // secondary is ILE for this scenario — handled in mapScenarioToBillableUnits
        secondaryTapPerUnit: 0,
      },
      assumptions: [
        "Illustrative API Metered estimate — not a live invoice or contract quote.",
        "Default learning checks map to TAP sessions ($1 each) — short pulse validation.",
        "Optional deeper blocks map to ILE sessions ($10 each).",
        "Internal product PoW from TAP/ILE is not charged as external API PoW.",
        "Platform access is $99/mo on API Metered; 3-day trial is separate one-time access.",
      ],
    };
  })(),
  (() => {
    const meta = salesCardMeta("pow-augmented-apps");
    return {
      slug: "pow-augmented-apps" as const,
      ...meta,
      sliders: [
        {
          key: "volume" as const,
          label: "External API PoW submissions / month",
          hint: "Real-time proof-of-work events sent from your app via the API.",
          min: 0,
          max: 100_000,
          step: 1000,
          defaultValue: 10_000,
        },
        {
          key: "secondary" as const,
          label: "In-app insight sessions (TAP) / month",
          hint: "Optional hosted TAP sessions for deep reviews outside your UI.",
          min: 0,
          max: 200,
          step: 5,
          defaultValue: 0,
        },
      ],
      mapping: {
        kind: "api_pow" as const,
        powPerUnit: 1,
        secondaryPowPerUnit: 0,
      },
      assumptions: [
        "Illustrative API Metered estimate — not a live invoice or contract quote.",
        "Each external/API-direct PoW submission is billed at the PoW rate (0.05¢ each).",
        "Optional hosted TAP sessions are billed at $1 each; ILE at $10 if used.",
        "PoW that only happens inside TAP/ILE product sessions is not billed as API PoW.",
        "Platform access is $99/mo on API Metered; trial is separate one-time access.",
      ],
    };
  })(),
];

export type ScenarioSliderValues = Partial<Record<ScenarioSliderKey, number>>;

export type ScenarioBillableUnits = {
  externalPowCount: number;
  tapSessionCount: number;
  ileSessionCount: number;
};

function clampSlider(
  def: ScenarioSliderDef,
  raw: number | undefined,
): number {
  const v = raw === undefined || Number.isNaN(raw) ? def.defaultValue : raw;
  const stepped = Math.round(v / def.step) * def.step;
  return Math.min(def.max, Math.max(def.min, stepped));
}

export function resolveScenarioSliderValues(
  scenario: PricingScenarioConfig,
  values: ScenarioSliderValues = {},
): Record<ScenarioSliderKey, number> {
  const out: Record<ScenarioSliderKey, number> = {
    volume: 0,
    secondary: 0,
  };
  for (const slider of scenario.sliders) {
    out[slider.key] = clampSlider(slider, values[slider.key]);
  }
  return out;
}

/**
 * Map scenario slider values → billable unit counts.
 * Pure; no Stripe / React dependencies.
 */
export function mapScenarioToBillableUnits(
  scenario: PricingScenarioConfig,
  values: ScenarioSliderValues = {},
): ScenarioBillableUnits {
  const resolved = resolveScenarioSliderValues(scenario, values);
  const volume = resolved.volume;
  const secondary = resolved.secondary;

  // Learning Loop: volume = TAP checks; secondary = ILE deeper blocks
  if (scenario.slug === "learning-loop") {
    return {
      externalPowCount: 0,
      tapSessionCount: volume,
      ileSessionCount: secondary,
    };
  }

  // PoW Augmented Apps: volume = external PoW; secondary = TAP sessions
  if (scenario.slug === "pow-augmented-apps") {
    return {
      externalPowCount: volume,
      tapSessionCount: secondary,
      ileSessionCount: 0,
    };
  }

  const mapping = scenario.mapping;
  if (mapping.kind === "tap_per_unit") {
    const tap =
      volume * mapping.tapPerUnit +
      secondary * (mapping.secondaryTapPerUnit ?? 0);
    return {
      externalPowCount: 0,
      tapSessionCount: tap,
      ileSessionCount: 0,
    };
  }

  if (mapping.kind === "ile_per_unit") {
    return {
      externalPowCount: 0,
      tapSessionCount: secondary * (mapping.screeningTapPerUnit ?? 0),
      ileSessionCount: volume * mapping.ilePerUnit,
    };
  }

  // api_pow fallback
  return {
    externalPowCount: volume * mapping.powPerUnit,
    tapSessionCount: 0,
    ileSessionCount: 0,
  };
}

export type ScenarioEstimate = {
  scenarioSlug: PricingScenarioSlug;
  units: ScenarioBillableUnits;
  invoice: ApiMeteredInvoiceEstimate;
  /** Display total in whole USD (platform + rounded usage). */
  totalUsd: number;
  /** Usage-only in USD (before platform), using rounded usage cents. */
  usageUsd: number;
  platformUsd: number;
};

/**
 * Full illustrative monthly estimate for a scenario at given slider values.
 * Uses the same `estimateApiMeteredInvoice` as production webhook/billing.
 */
export function estimateScenarioMonthly(
  scenario: PricingScenarioConfig,
  values: ScenarioSliderValues = {},
): ScenarioEstimate {
  const units = mapScenarioToBillableUnits(scenario, values);
  const invoice = estimateApiMeteredInvoice(
    units.externalPowCount,
    units.tapSessionCount,
    units.ileSessionCount,
  );
  return {
    scenarioSlug: scenario.slug,
    units,
    invoice,
    totalUsd: invoice.totalCents / 100,
    usageUsd: invoice.usageCentsRounded / 100,
    platformUsd: invoice.platformCents / 100,
  };
}

export function getPricingScenario(
  slug: string,
): PricingScenarioConfig | undefined {
  return PRICING_SCENARIOS.find((s) => s.slug === slug);
}

/** Format cents as a USD string suitable for UI. */
export function formatEstimateUsd(usd: number): string {
  if (Number.isInteger(usd)) return `$${usd}`;
  return `$${usd.toFixed(2)}`;
}
