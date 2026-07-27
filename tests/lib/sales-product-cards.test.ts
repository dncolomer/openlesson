/**
 * Sales product cards: catalog content, optional LP product visuals, route wiring.
 */
import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  getSalesProductCard,
  groupSalesProductCards,
  resolveSalesProductSectionHeadings,
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
    oldPath: "early-self-service-screening" as string | null,
  },
  {
    slug: "self-service-take-home",
    title: "Self-Service Take-Home",
    path: "/sales/self-service-take-home",
    image: "/knowledgeg2.png",
    oldPath: "self-service-take-home-assignment" as string | null,
  },
  {
    slug: "learning-loop",
    title: "Learning Loop",
    path: "/sales/learning-loop",
    image: "/gaps.png",
    oldPath: "post-session-learning-check" as string | null,
  },
  {
    slug: "pow-augmented-apps",
    title: "PoW Augmented Apps",
    path: "/sales/pow-augmented-apps",
    image: "/embeddings.png",
    oldPath: null,
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
  it("registers Skill Check, Take-Home, Learning Loop, and PoW Augmented Apps", () => {
    expect(SALES_PRODUCT_CARDS.length).toBeGreaterThanOrEqual(4);

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

  it("groups Verification, Optimization, and Augmentation product lines", () => {
    const groups = groupSalesProductCards();
    expect(groups.map((g) => g.id)).toEqual([
      "verification",
      "optimization",
      "augmentation",
    ]);
    expect(groups[0].label).toBe("Verification Products");
    expect(groups[1].label).toBe("Optimization Product");
    expect(groups[2].label).toBe("Augmentation Product");
    expect(groups[0].cards.map((c) => c.slug)).toEqual([
      "self-service-skill-check",
      "self-service-take-home",
    ]);
    expect(groups[1].cards.map((c) => c.slug)).toEqual(["learning-loop"]);
    expect(groups[2].cards.map((c) => c.slug)).toEqual(["pow-augmented-apps"]);
    for (const card of SALES_PRODUCT_CARDS) {
      expect(
        card.productLine === "verification" ||
          card.productLine === "optimization" ||
          card.productLine === "augmentation",
      ).toBe(true);
    }

    const index = readFileSync(join(ROOT, "app/sales/page.tsx"), "utf8");
    const catalog = readFileSync(join(ROOT, "lib/sales/product-cards.ts"), "utf8");
    expect(index).toContain("groupSalesProductCards");
    expect(index).toContain("data-sales-product-group");
    expect(index).toContain("group.label");
    expect(catalog).toContain("Verification Products");
    expect(catalog).toContain("Optimization Product");
    expect(catalog).toContain("Augmentation Product");
  });

  it("uses context section headings for non-verification cards (not Candidate experience)", () => {
    const page = readFileSync(join(ROOT, "components/SalesProductCardPage.tsx"), "utf8");
    expect(page).toContain("resolveSalesProductSectionHeadings");
    expect(page).toContain("headings.experience");
    expect(page).not.toMatch(/title=\{?"Candidate experience"?\}/);

    const skill = getSalesProductCard("self-service-skill-check");
    const takeHome = getSalesProductCard("self-service-take-home");
    const loop = getSalesProductCard("learning-loop");
    const pow = getSalesProductCard("pow-augmented-apps");
    expect(skill && takeHome && loop && pow).toBeTruthy();
    if (!skill || !takeHome || !loop || !pow) return;

    // Verification keeps hiring defaults
    expect(resolveSalesProductSectionHeadings(skill).experience).toBe("Candidate experience");
    expect(resolveSalesProductSectionHeadings(takeHome).experience).toBe("Candidate experience");
    expect(resolveSalesProductSectionHeadings(skill).deliverables).toBe("What the client gets");
    expect(resolveSalesProductSectionHeadings(skill).funnel).toBe(
      "Suggested placement in the funnel",
    );

    // Learning Loop — learner / tutor-host
    expect(loop.experienceHeading).toBe("Learner experience");
    expect(loop.deliverablesHeading).toBe("What the tutor / host gets");
    expect(loop.funnelHeading).toBe("Where it sits in the learning flow");
    const loopH = resolveSalesProductSectionHeadings(loop);
    expect(loopH.experience).toBe("Learner experience");
    expect(loopH.experience.toLowerCase()).not.toContain("candidate");
    expect(loopH.deliverables.toLowerCase()).not.toContain("client");

    // PoW Augmented Apps — in-app / agent
    expect(pow.experienceHeading).toBe("In-app / agent flow");
    expect(pow.deliverablesHeading).toBe("What your product can surface");
    expect(pow.funnelHeading).toBe("Where it sits in the product loop");
    const powH = resolveSalesProductSectionHeadings(pow);
    expect(powH.experience).toBe("In-app / agent flow");
    expect(powH.experience.toLowerCase()).not.toContain("candidate");

    for (const card of [loop, pow]) {
      expect(card.productLine).not.toBe("verification");
      expect(card.experienceHeading).toBeTruthy();
      expect(card.experienceHeading).not.toBe("Candidate experience");
      const exp = card.experience.join(" ").toLowerCase();
      expect(exp).not.toMatch(/\bcandidate\b/);
    }
  });

  it("PoW Augmented Apps covers real-time PoW enrichment narrative", () => {
    const card = getSalesProductCard("pow-augmented-apps");
    expect(card).toBeDefined();
    if (!card) return;
    expect(card.title).toBe("PoW Augmented Apps");
    expect(card.path).toBe("/sales/pow-augmented-apps");
    expect(card.productLine).toBe("augmentation");
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
      ...(card.integration
        ? [
            card.integration.title,
            card.integration.body,
            ...card.integration.bullets,
            card.integration.note ?? "",
          ]
        : []),
    ]
      .join("\n")
      .toLowerCase();

    expect(blob).toMatch(/real[- ]?time|stream/);
    expect(blob).toMatch(/proof of work|pow/);
    expect(blob).toMatch(/api/);
    expect(blob).toMatch(/gap/);
    expect(blob).toMatch(/strength|achievement|positive/);
    expect(blob).toMatch(/suggest|next/);
    expect(blob).toMatch(/tour|walkthrough/);
    expect(blob).toMatch(/agent/);
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

      if (expected.oldPath) {
        const oldPage = readFileSync(
          join(ROOT, `app/sales/${expected.oldPath}/page.tsx`),
          "utf8",
        );
        expect(oldPage).toContain("redirect");
        expect(oldPage).toContain(expected.path);
      }
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
