/**
 * Sales product cards: catalog content, optional LP product visuals, route wiring.
 */
import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  getSalesProductCard,
  groupSalesProductCards,
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

const EXPECTED_PRODUCTS = [
  {
    slug: "self-service-skill-check",
    title: "Self-Service Skill Check",
    path: "/sales/self-service-skill-check",
    image: "/ranking_app.png",
    oldPath: "early-self-service-screening",
  },
  {
    slug: "self-service-take-home",
    title: "Self-Service Take-Home",
    path: "/sales/self-service-take-home",
    image: "/knowledgeg2.png",
    oldPath: "self-service-take-home-assignment",
  },
  {
    slug: "learning-loop",
    title: "Learning Loop",
    path: "/sales/learning-loop",
    image: "/gaps.png",
    oldPath: "post-session-learning-check",
  },
] as const;

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
  it("maps skill-check → ranking_app and take-home → knowledgeg2", () => {
    const skillCheck = SALES_PRODUCT_CARDS.find((c) => c.slug === "self-service-skill-check");
    const takeHome = SALES_PRODUCT_CARDS.find((c) => c.slug === "self-service-take-home");
    expect(skillCheck?.image).toBe("/ranking_app.png");
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

describe("sales product catalog renames", () => {
  it("registers Self-Service Skill Check, Self-Service Take-Home, and Learning Loop", () => {
    expect(SALES_PRODUCT_CARDS.length).toBeGreaterThanOrEqual(3);

    // Old primary titles must not remain as catalog titles
    const titles = SALES_PRODUCT_CARDS.map((c) => c.title);
    expect(titles).not.toContain("Early Self-Service Screening");
    expect(titles).not.toContain("Post-Session Learning Check");
    expect(titles).not.toContain("Self-service Take-Home Assignment");

    for (const expected of EXPECTED_PRODUCTS) {
      const card = getSalesProductCard(expected.slug);
      expect(card, expected.slug).toBeDefined();
      if (!card) continue;
      expect(card.title).toBe(expected.title);
      expect(card.path).toBe(expected.path);
      expect(card.image).toBe(expected.image);
      assertCardShape(card);
    }
  });

  it("Learning Loop keeps post-session learning narrative fields", () => {
    const card = getSalesProductCard("learning-loop");
    expect(card).toBeDefined();
    if (!card) return;

    expect(card.eyebrow.toLowerCase()).toContain("learning");
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

    expect(blob).toMatch(/customizable/);
    expect(blob).toMatch(/length|duration/);
    expect(blob).toMatch(/class/);
    expect(blob).toMatch(/video|tutorial/);
    expect(blob).toMatch(/project/);
    expect(blob).toMatch(/read/);
    expect(blob).toMatch(/gap/);
    expect(blob).toMatch(/tutor|teacher/);
    expect(blob).toMatch(/reteach|correct|guidance/);
    expect(blob).toMatch(/iteration|evolution|over time/);
    expect(blob).toMatch(/ai|cheat|fake|quiz/);
  });

  it("every catalog card has consistent path and required fields", () => {
    for (const card of SALES_PRODUCT_CARDS) {
      assertCardShape(card);
      expect(getSalesProductCard(card.slug)?.slug).toBe(card.slug);
    }
  });

  it("groups first two as Verification Products and Learning Loop as Optimization Product", () => {
    const groups = groupSalesProductCards();
    expect(groups.map((g) => g.id)).toEqual(["verification", "optimization"]);
    expect(groups[0].label).toBe("Verification Products");
    expect(groups[1].label).toBe("Optimization Product");
    expect(groups[0].cards.map((c) => c.slug)).toEqual([
      "self-service-skill-check",
      "self-service-take-home",
    ]);
    expect(groups[1].cards.map((c) => c.slug)).toEqual(["learning-loop"]);
    for (const card of SALES_PRODUCT_CARDS) {
      expect(card.productLine === "verification" || card.productLine === "optimization").toBe(
        true,
      );
    }

    const index = readFileSync(join(ROOT, "app/sales/page.tsx"), "utf8");
    const catalog = readFileSync(join(ROOT, "lib/sales/product-cards.ts"), "utf8");
    expect(index).toContain("groupSalesProductCards");
    expect(index).toContain("data-sales-product-group");
    expect(index).toContain("group.label");
    expect(catalog).toContain("Verification Products");
    expect(catalog).toContain("Optimization Product");
  });

  it("detail route modules resolve new slugs; old paths redirect", () => {
    for (const expected of EXPECTED_PRODUCTS) {
      const page = readFileSync(
        join(ROOT, `app/sales/${expected.slug}/page.tsx`),
        "utf8",
      );
      expect(page).toContain(`const SLUG = "${expected.slug}"`);
      expect(page).toContain("getSalesProductCard(SLUG)");
      expect(page).toContain("SalesProductCardPage");
      expect(page).toContain("notFound");

      const oldPage = readFileSync(
        join(ROOT, `app/sales/${expected.oldPath}/page.tsx`),
        "utf8",
      );
      expect(oldPage).toContain("redirect");
      expect(oldPage).toContain(expected.path);
    }

    const autonomous = readFileSync(
      join(ROOT, "app/sales/autonomous-take-home-assignment/page.tsx"),
      "utf8",
    );
    expect(autonomous).toContain("redirect");
    expect(autonomous).toContain("/sales/self-service-take-home");

    const index = readFileSync(join(ROOT, "app/sales/page.tsx"), "utf8");
    // Index lists from catalog groups (not a hardcoded two-card slice)
    expect(index).toContain("groupSalesProductCards");
    expect(index).not.toMatch(/SALES_PRODUCT_CARDS\.slice\(0,\s*2\)/);
  });
});
