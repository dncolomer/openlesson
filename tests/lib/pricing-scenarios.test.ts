import { describe, expect, it } from "vitest";
import {
  API_METERED_PLATFORM_FEE_CENTS,
  estimateApiMeteredInvoice,
  ILE_SESSION_PRICE_CENTS,
  POW_API_CALL_PRICE_CENTS,
  TAP_SESSION_PRICE_CENTS,
} from "@/lib/plans";
import { SALES_PRODUCT_CARDS } from "@/lib/sales/product-cards";
import {
  estimateScenarioMonthly,
  getPricingScenario,
  mapScenarioToBillableUnits,
  PRICING_SCENARIOS,
  PRICING_SCENARIO_SLUGS,
  resolveScenarioSliderValues,
} from "@/lib/pricing/scenarios";

describe("pricing scenarios catalog", () => {
  it("covers the four shipped sales product lines with matching titles", () => {
    expect(PRICING_SCENARIO_SLUGS).toEqual([
      "self-service-skill-check",
      "self-service-take-home",
      "learning-loop",
      "pow-augmented-apps",
    ]);
    expect(PRICING_SCENARIOS).toHaveLength(4);

    for (const scenario of PRICING_SCENARIOS) {
      const card = SALES_PRODUCT_CARDS.find((c) => c.slug === scenario.slug);
      expect(card, `sales card for ${scenario.slug}`).toBeDefined();
      expect(scenario.title).toBe(card!.title);
      expect(scenario.salesPath).toBe(card!.path);
      expect(scenario.context.length).toBeGreaterThan(20);
      expect(scenario.assumptions.length).toBeGreaterThanOrEqual(3);
      expect(scenario.sliders.length).toBeGreaterThanOrEqual(1);
      // Assumptions must surface trial vs metered and TAP/ILE vs external PoW.
      const assumptionsBlob = scenario.assumptions.join(" ").toLowerCase();
      expect(assumptionsBlob).toMatch(/api metered|platform/);
      expect(assumptionsBlob).toMatch(/tap|ile|pow|external/);
      expect(assumptionsBlob).toMatch(/illustrative|assumption|not a live|not.*contract/);
    }
  });

  it("getPricingScenario resolves known slugs and rejects unknown", () => {
    expect(getPricingScenario("learning-loop")?.title).toBe("Learning Loop");
    expect(getPricingScenario("nope")).toBeUndefined();
  });
});

describe("mapScenarioToBillableUnits", () => {
  it("Skill Check: candidates + retakes → TAP only", () => {
    const scenario = getPricingScenario("self-service-skill-check")!;
    const units = mapScenarioToBillableUnits(scenario, {
      volume: 50,
      secondary: 10,
    });
    expect(units).toEqual({
      externalPowCount: 0,
      tapSessionCount: 60,
      ileSessionCount: 0,
    });
  });

  it("Take-Home: candidates → ILE, prior skill checks → TAP", () => {
    const scenario = getPricingScenario("self-service-take-home")!;
    const units = mapScenarioToBillableUnits(scenario, {
      volume: 10,
      secondary: 50,
    });
    expect(units).toEqual({
      externalPowCount: 0,
      tapSessionCount: 50,
      ileSessionCount: 10,
    });
  });

  it("Learning Loop: checks → TAP, deeper blocks → ILE", () => {
    const scenario = getPricingScenario("learning-loop")!;
    const units = mapScenarioToBillableUnits(scenario, {
      volume: 100,
      secondary: 5,
    });
    expect(units).toEqual({
      externalPowCount: 0,
      tapSessionCount: 100,
      ileSessionCount: 5,
    });
  });

  it("PoW Augmented Apps: volume → external PoW, secondary → TAP", () => {
    const scenario = getPricingScenario("pow-augmented-apps")!;
    const units = mapScenarioToBillableUnits(scenario, {
      volume: 10_000,
      secondary: 20,
    });
    expect(units).toEqual({
      externalPowCount: 10_000,
      tapSessionCount: 20,
      ileSessionCount: 0,
    });
  });

  it("clamps slider values to configured min/max", () => {
    const scenario = getPricingScenario("self-service-skill-check")!;
    const high = mapScenarioToBillableUnits(scenario, { volume: 99999 });
    expect(high.tapSessionCount).toBe(500);
    const low = mapScenarioToBillableUnits(scenario, { volume: -5 });
    expect(low.tapSessionCount).toBe(10);
  });

  it("uses defaults when values omitted", () => {
    const scenario = getPricingScenario("self-service-skill-check")!;
    const units = mapScenarioToBillableUnits(scenario, {});
    const defaults = resolveScenarioSliderValues(scenario, {});
    expect(units.tapSessionCount).toBe(defaults.volume + defaults.secondary);
  });
});

describe("estimateScenarioMonthly uses real plan rates", () => {
  const cases: Array<{
    slug: (typeof PRICING_SCENARIO_SLUGS)[number];
    values: { volume: number; secondary: number };
  }> = [
    { slug: "self-service-skill-check", values: { volume: 50, secondary: 0 } },
    { slug: "self-service-skill-check", values: { volume: 200, secondary: 20 } },
    { slug: "self-service-take-home", values: { volume: 10, secondary: 50 } },
    { slug: "self-service-take-home", values: { volume: 1, secondary: 0 } },
    { slug: "learning-loop", values: { volume: 100, secondary: 5 } },
    { slug: "learning-loop", values: { volume: 500, secondary: 0 } },
    { slug: "pow-augmented-apps", values: { volume: 10_000, secondary: 0 } },
    { slug: "pow-augmented-apps", values: { volume: 50_000, secondary: 40 } },
  ];

  for (const { slug, values } of cases) {
    it(`${slug} @ volume=${values.volume} secondary=${values.secondary} matches estimateApiMeteredInvoice`, () => {
      const scenario = getPricingScenario(slug)!;
      const result = estimateScenarioMonthly(scenario, values);
      const expected = estimateApiMeteredInvoice(
        result.units.externalPowCount,
        result.units.tapSessionCount,
        result.units.ileSessionCount,
      );

      expect(result.invoice).toEqual(expected);
      expect(result.invoice.platformCents).toBe(API_METERED_PLATFORM_FEE_CENTS);
      expect(result.invoice.externalPowCents).toBe(
        result.units.externalPowCount * POW_API_CALL_PRICE_CENTS,
      );
      expect(result.invoice.tapSessionCents).toBe(
        result.units.tapSessionCount * TAP_SESSION_PRICE_CENTS,
      );
      expect(result.invoice.ileSessionCents).toBe(
        result.units.ileSessionCount * ILE_SESSION_PRICE_CENTS,
      );
      expect(result.totalUsd).toBe(expected.totalCents / 100);
      expect(result.usageUsd).toBe(expected.usageCentsRounded / 100);
      expect(result.platformUsd).toBe(API_METERED_PLATFORM_FEE_CENTS / 100);
    });
  }

  it("Skill Check 50 candidates = $99 platform + $50 TAP", () => {
    const scenario = getPricingScenario("self-service-skill-check")!;
    const result = estimateScenarioMonthly(scenario, {
      volume: 50,
      secondary: 0,
    });
    // 50 TAP * $1 = $50 usage + $99 platform = $149
    expect(result.units.tapSessionCount).toBe(50);
    expect(result.invoice.tapSessionCents).toBe(5000);
    expect(result.invoice.usageCentsRounded).toBe(5000);
    expect(result.invoice.totalCents).toBe(9900 + 5000);
    expect(result.totalUsd).toBe(149);
  });

  it("Take-Home 10 ILE + 50 TAP = $99 + $100 + $50", () => {
    const scenario = getPricingScenario("self-service-take-home")!;
    const result = estimateScenarioMonthly(scenario, {
      volume: 10,
      secondary: 50,
    });
    // 10 * $10 ILE + 50 * $1 TAP = $150 usage + $99 = $249
    expect(result.units.ileSessionCount).toBe(10);
    expect(result.units.tapSessionCount).toBe(50);
    expect(result.invoice.ileSessionCents).toBe(10_000);
    expect(result.invoice.tapSessionCents).toBe(5000);
    expect(result.invoice.totalCents).toBe(9900 + 15_000);
    expect(result.totalUsd).toBe(249);
  });

  it("PoW 10k submissions uses real 0.05¢ rate", () => {
    const scenario = getPricingScenario("pow-augmented-apps")!;
    const result = estimateScenarioMonthly(scenario, {
      volume: 10_000,
      secondary: 0,
    });
    // 10000 * 0.05 = 500 cents = $5 usage
    expect(result.units.externalPowCount).toBe(10_000);
    expect(result.invoice.externalPowCents).toBe(500);
    expect(result.invoice.usageCentsRounded).toBe(500);
    expect(result.invoice.totalCents).toBe(9900 + 500);
    expect(result.totalUsd).toBe(104);
  });
});
