/**
 * Sales product cards: catalog content, optional LP product visuals, route wiring.
 */
import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  getSalesProductCard,
  SALES_PRODUCT_CARDS,
  type SalesProductCard,
} from "@/lib/sales/product-cards";

const ROOT = join(__dirname, "../..");

const REQUIRED_STRING_KEYS: (keyof SalesProductCard)[] = [
  "slug",
  "path",
  "title",
  "eyebrow",
  "oneLine",
  "whatItIs",
  "inputsHeading",
  "comparisonTitle",
  "comparisonWithoutLabel",
  "comparisonWithLabel",
  "funnel",
  "successMetrics",
  "footer",
  "demoUrl",
];

function assertCardShape(card: SalesProductCard) {
  for (const key of REQUIRED_STRING_KEYS) {
    const value = card[key];
    expect(typeof value, `${card.slug}.${String(key)}`).toBe("string");
    expect(String(value).trim().length, `${card.slug}.${String(key)} non-empty`).toBeGreaterThan(0);
  }
  expect(card.path).toBe(`/sales/${card.slug}`);
  expect(card.specs.length).toBeGreaterThan(0);
  expect(card.inputs.length).toBeGreaterThan(0);
  expect(card.experience.length).toBeGreaterThan(0);
  expect(card.deliverables.length).toBeGreaterThan(0);
  expect(card.whenToUse.length).toBeGreaterThan(0);
  expect(card.comparison.length).toBeGreaterThan(0);
  expect(card.pilot.length).toBeGreaterThan(0);
  expect(card.ask.length).toBeGreaterThan(0);
  if (card.image) {
    expect(card.image.startsWith("/")).toBe(true);
    expect(existsSync(join(ROOT, "public", card.image.replace(/^\//, "")))).toBe(true);
  }
}

describe("sales product cards embed LP product visuals", () => {
  it("maps screening → ranking_app and take-home → knowledgeg2", () => {
    const screening = SALES_PRODUCT_CARDS.find(
      (c) => c.slug === "early-self-service-screening",
    );
    const takeHome = SALES_PRODUCT_CARDS.find(
      (c) => c.slug === "self-service-take-home-assignment",
    );
    expect(screening?.image).toBe("/ranking_app.png");
    expect(takeHome?.image).toBe("/knowledgeg2.png");
    expect(existsSync(join(ROOT, "public/ranking_app.png"))).toBe(true);
    expect(existsSync(join(ROOT, "public/knowledgeg2.png"))).toBe(true);
  });

  it("detail page and sales index render product images", () => {
    const page = readFileSync(join(ROOT, "components/SalesProductCardPage.tsx"), "utf8");
    const index = readFileSync(join(ROOT, "app/sales/page.tsx"), "utf8");
    expect(page).toContain("data-sales-product-visual");
    expect(page).toContain("card.image");
    expect(page).toContain("next/image");
    expect(index).toContain("data-sales-index-thumb");
    expect(index).toContain("card.image");
  });
});

describe("sales product catalog includes Post-Session Learning Check", () => {
  it("registers a third card with path, title, and full narrative shape", () => {
    expect(SALES_PRODUCT_CARDS.length).toBeGreaterThanOrEqual(3);

    const card = getSalesProductCard("post-session-learning-check");
    expect(card).toBeDefined();
    if (!card) return;

    expect(card.title).toBe("Post-Session Learning Check");
    expect(card.path).toBe("/sales/post-session-learning-check");
    expect(card.eyebrow.toLowerCase()).toContain("learning");
    assertCardShape(card);

    const blob = [
      card.oneLine,
      card.whatItIs,
      ...card.specs.map((r) => `${r.label} ${r.value}`),
      ...card.inputs.map((r) => `${r.label} ${r.value}`),
      ...card.experience,
      ...card.deliverables.map((r) => `${r.label} ${r.value}`),
      ...(card.deliverablesNote ? [card.deliverablesNote] : []),
      ...card.whenToUse,
      ...card.comparison.flatMap((r) => [r.without, r.with]),
      card.funnel,
      ...(card.funnelNote ? [card.funnelNote] : []),
      ...card.pilot,
      card.successMetrics,
      ...(card.valueModes?.map((m) => `${m.title} ${m.body}`) ?? []),
    ]
      .join("\n")
      .toLowerCase();

    // Customizable link duration
    expect(blob).toMatch(/customizable/);
    expect(blob).toMatch(/length|duration/);
    // Post-session instructional contexts
    expect(blob).toMatch(/class/);
    expect(blob).toMatch(/video|tutorial/);
    expect(blob).toMatch(/project/);
    expect(blob).toMatch(/read/);
    // Tutor gap insights + correction guidance
    expect(blob).toMatch(/gap/);
    expect(blob).toMatch(/tutor|teacher/);
    expect(blob).toMatch(/reteach|correct|guidance/);
    // Multi-iteration vs cheatable tests / AI fakes
    expect(blob).toMatch(/iteration|evolution|over time/);
    expect(blob).toMatch(/ai|cheat|fake|quiz/);
  });

  it("every catalog card has consistent path and required fields", () => {
    for (const card of SALES_PRODUCT_CARDS) {
      assertCardShape(card);
      expect(getSalesProductCard(card.slug)?.slug).toBe(card.slug);
    }
  });

  it("detail route modules resolve the card the same way as existing product routes", () => {
    const screening = readFileSync(
      join(ROOT, "app/sales/early-self-service-screening/page.tsx"),
      "utf8",
    );
    const learningCheck = readFileSync(
      join(ROOT, "app/sales/post-session-learning-check/page.tsx"),
      "utf8",
    );
    const index = readFileSync(join(ROOT, "app/sales/page.tsx"), "utf8");

    expect(screening).toContain('const SLUG = "early-self-service-screening"');
    expect(screening).toContain("getSalesProductCard(SLUG)");
    expect(screening).toContain("SalesProductCardPage");

    expect(learningCheck).toContain('const SLUG = "post-session-learning-check"');
    expect(learningCheck).toContain("getSalesProductCard(SLUG)");
    expect(learningCheck).toContain("SalesProductCardPage");
    expect(learningCheck).toContain("notFound");

    // Index lists from full catalog — no hardcoded two-card list
    expect(index).toContain("SALES_PRODUCT_CARDS.map");
    expect(index).not.toMatch(/SALES_PRODUCT_CARDS\.slice\(0,\s*2\)/);
  });
});
