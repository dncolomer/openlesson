import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { PLATFORM_PITCH_DECK } from "@/lib/sales/platform-pitch-deck";
import { buildFounderSlides } from "@/lib/sales/founder-slides";
import { LIVE_PITCH_PATHS, PITCH_INDEX, PITCH_PATHS } from "@/lib/sales/pitch-index";
import {
  assertNonEmptyTitles,
  collectPreservedItemStrings,
  inventoryDeck,
} from "@/lib/sales/pitch-content-inventory";
import {
  PITCH_ASSETS,
  type SalesSlide,
  type SolutionSlideDeck,
} from "@/lib/sales/solution-slide-decks";
import { buildPrivacyDataSlides } from "@/lib/sales/privacy-data-slide";

const REPO_ROOT = path.resolve(__dirname, "../..");

const ALL_DECKS: SolutionSlideDeck[] = [PLATFORM_PITCH_DECK];

function slideCorpus(deck: SolutionSlideDeck): string {
  return deck.slides
    .map((slide) =>
      [
        slide.kicker,
        slide.title,
        slide.subtitle,
        slide.footnote,
        ...(slide.highlights ?? []),
        ...(slide.highlightLabels ?? []),
        ...((slide.cards ?? []).flatMap((c) => [
          c.label,
          c.body,
          ...((c.ideas ?? []).flatMap((idea) => [idea.title, idea.body])),
        ])),
        ...(slide.bullets ?? []),
        ...(slide.left?.items ?? []),
        ...(slide.right?.items ?? []),
        slide.left?.label,
        slide.right?.label,
        slide.image,
        slide.backgroundImage,
        slide.imageCaption,
      ]
        .filter(Boolean)
        .join("\n"),
    )
    .join("\n");
}

function collectImagePaths(deck: SolutionSlideDeck): string[] {
  const paths = new Set<string>();
  if (deck.backgroundImage) paths.add(deck.backgroundImage);
  for (const slide of deck.slides) {
    if (slide.backgroundImage) paths.add(slide.backgroundImage);
    if (slide.image) paths.add(slide.image);
    for (const card of slide.cards ?? []) {
      if (card.image) paths.add(card.image);
    }
    for (const highlightImage of slide.highlightImages ?? []) {
      if (highlightImage) paths.add(highlightImage);
    }
  }
  return [...paths];
}

function publicAssetExists(publicPath: string): boolean {
  const relative = publicPath.startsWith("/") ? publicPath.slice(1) : publicPath;
  return fs.existsSync(path.join(REPO_ROOT, "public", relative));
}

const FOUNDER_FACT_ANCHORS = [
  "Daniel Colomer",
  "UPC",
  "Xavier Franch",
  "quantum",
  "ETH",
  "Extropic",
  "Guillaume Verdon",
  "TensorFlow Quantum",
  "Barcelona",
  "Germany",
  "Karpathy",
  "Omega Quest",
  "Strangeworks",
  "TheWiser",
];

describe("pitch deck content (platform only)", () => {
  it("platform deck opens each section with a centered title slide", () => {
    expect(PLATFORM_PITCH_DECK.vertical).toBe("pitch");
    expect(PLATFORM_PITCH_DECK.label.toLowerCase()).toContain("platform");
    assertNonEmptyTitles(PLATFORM_PITCH_DECK);

    const founderSlides = buildFounderSlides("platform");
    // Cover + TOC + section titles (5) + founder content + thesis (4) + method (2) + privacy×2 + products (1)
    expect(PLATFORM_PITCH_DECK.slides).toHaveLength(
      2 + 5 + founderSlides.length + 4 + 2 + 2 + 1,
    );

    // Cover + TOC open the deck
    expect(PLATFORM_PITCH_DECK.slides[0]?.layout).toBe("title");
    expect(PLATFORM_PITCH_DECK.slides[0]?.title).toBe("Uncertain Systems");
    expect(PLATFORM_PITCH_DECK.slides[0]?.image).toBe(PITCH_ASSETS.logo);
    expect(PLATFORM_PITCH_DECK.slides[1]?.title).toMatch(/table of contents/i);
    expect(PLATFORM_PITCH_DECK.slides[1]?.layout).toBe("bullets");
    expect(PLATFORM_PITCH_DECK.slides[1]?.bullets).toEqual([
      "Founder",
      "What is Uncertain Systems?",
      "How do we ensure high quality data?",
      "Data Privacy and Confidential Learning",
      "Our products",
    ]);
    // Each TOC item matches a title-layout section slide (click targets).
    for (const item of PLATFORM_PITCH_DECK.slides[1]?.bullets ?? []) {
      const targetIdx = PLATFORM_PITCH_DECK.slides.findIndex(
        (s) => s.layout === "title" && s.title === item,
      );
      expect(targetIdx, `TOC missing title slide for: ${item}`).toBeGreaterThanOrEqual(0);
    }
    const deckUi = fs.readFileSync(path.join(REPO_ROOT, "components/SalesSlideDeck.tsx"), "utf8");
    expect(deckUi).toContain("data-pitch-toc-link");
    expect(deckUi).toContain("resolveBulletSlideTargets");
    expect(deckUi).toContain("onGoToSlide");

    const sectionTitles = PLATFORM_PITCH_DECK.slides.filter((s) => s.layout === "title");
    expect(sectionTitles.map((s) => s.title)).toEqual([
      "Uncertain Systems",
      "Founder",
      "What is Uncertain Systems?",
      "How do we ensure high quality data?",
      "Data Privacy and Confidential Learning",
      "Our products",
    ]);
    // Every section title shows the brand favicon.
    expect(sectionTitles.every((s) => s.image === PITCH_ASSETS.logo)).toBe(true);
    expect(sectionTitles.map((s) => s.title)).not.toContain("Productized");

    // After cover + TOC: Founder section title then founder content
    const openOffset = 2;
    expect(PLATFORM_PITCH_DECK.slides[openOffset]?.layout).toBe("title");
    expect(PLATFORM_PITCH_DECK.slides[openOffset]?.title).toBe("Founder");
    const founderBlock = PLATFORM_PITCH_DECK.slides.slice(
      openOffset + 1,
      openOffset + 1 + founderSlides.length,
    );
    expect(founderBlock.map((s) => s.title)).toEqual(founderSlides.map((s) => s.title));
    expect(founderBlock[0]?.layout).toBe("founder");

    // Thesis section after founder block
    const thesisStart = openOffset + 1 + founderSlides.length;
    expect(PLATFORM_PITCH_DECK.slides[thesisStart]?.title).toMatch(/What is Uncertain Systems\?/);
    expect(PLATFORM_PITCH_DECK.slides[thesisStart + 1]?.kicker?.toLowerCase()).toMatch(/thesis/);
    expect(PLATFORM_PITCH_DECK.slides[thesisStart + 2]?.image).toBe("/terrance.png");
    expect(PLATFORM_PITCH_DECK.slides[thesisStart + 3]?.image).toBe("/mechaarm2.jpg");
    expect(PLATFORM_PITCH_DECK.slides[thesisStart + 4]?.image).toBe("/embeddings.png");

    // Method section
    const methodStart = thesisStart + 5;
    expect(PLATFORM_PITCH_DECK.slides[methodStart]?.title).toBe(
      "How do we ensure high quality data?",
    );
    expect(PLATFORM_PITCH_DECK.slides[methodStart + 1]?.title.toLowerCase()).toMatch(/think aloud/);
    expect(PLATFORM_PITCH_DECK.slides[methodStart + 2]?.title.toLowerCase()).toMatch(
      /grounded|game/,
    );

    // Close sections: Data Privacy and Confidential Learning · Our products
    const closeStart = methodStart + 3;
    expect(PLATFORM_PITCH_DECK.slides[closeStart]?.title).toBe(
      "Data Privacy and Confidential Learning",
    );
    expect(PLATFORM_PITCH_DECK.slides[closeStart + 1]?.kicker?.toLowerCase()).toMatch(
      /data privacy|confidential learning/,
    );
    expect(PLATFORM_PITCH_DECK.slides[closeStart + 2]?.kicker?.toLowerCase()).toMatch(
      /data privacy|confidential learning/,
    );
    expect(PLATFORM_PITCH_DECK.slides[closeStart + 3]?.title).toBe("Our products");
    // Products stack is the only content slide under Our products (interface slide removed)
    expect(PLATFORM_PITCH_DECK.slides[closeStart + 4]?.kicker?.toLowerCase()).toMatch(
      /our products/,
    );
    expect(PLATFORM_PITCH_DECK.slides[closeStart + 4]?.cardLayout).toBe("product-stack");
    expect(PLATFORM_PITCH_DECK.slides[closeStart + 4]?.cards?.map((c) => c.label.toLowerCase())).toEqual([
      "tap",
      "ile",
      "stash api",
      "pow api",
    ]);
    // Former “One interface: Proof of Work with stash / submit” slide is gone
    expect(
      PLATFORM_PITCH_DECK.slides.some((s) =>
        /one interface:\s*proof of work with stash/i.test(s.title ?? ""),
      ),
    ).toBe(false);
  });

  it("platform deck: thesis + fullImage + 2 media video + privacy×2 + products stack, schema anchors", () => {
    const corpus = slideCorpus(PLATFORM_PITCH_DECK).toLowerCase();
    expect(corpus).toMatch(/thesis|ratio of correct answers/);
    expect(corpus).toMatch(/knowledge config|proximity/);
    expect(corpus).toMatch(/think aloud protocol/);
    expect(corpus).toMatch(/submit.stash|submit\/stash|submit–stash/);
    expect(corpus).toMatch(/system 1/);
    expect(corpus).toMatch(/system 2/);
    expect(corpus).toMatch(/embedding/);
    expect(corpus).toMatch(/tool agnostic|protocol purity|submit.stash|system 1|system 2/);
    expect(corpus).not.toMatch(/silence ratio/);
    expect(corpus).toMatch(/\bpow\b/);
    expect(corpus).toMatch(/\btap\b/);
    expect(corpus).toMatch(/\bile\b/);
    const integrationHits = [
      /hire|hiring|résumé|resume/,
      /certif/,
      /interview|think-aloud|think aloud/,
      /take-home|practice|onboard/,
      /agent|ci|remote work/,
    ].filter((re) => re.test(corpus));
    expect(integrationHits.length).toBeGreaterThanOrEqual(3);

    const founderCount = buildFounderSlides("platform").length;
    // After: cover + TOC + Founder title + founder slides
    const openOffset = 2;
    const thesisTitleIdx = openOffset + 1 + founderCount;
    const titleSlide = PLATFORM_PITCH_DECK.slides[thesisTitleIdx];
    expect(titleSlide?.layout).toBe("title");
    expect(titleSlide?.title).toBe("What is Uncertain Systems?");
    expect(titleSlide?.image).toBe(PITCH_ASSETS.logo);
    expect(publicAssetExists(titleSlide?.image ?? "")).toBe(true);

    const thesisSlide = PLATFORM_PITCH_DECK.slides[thesisTitleIdx + 1];
    expect(thesisSlide?.layout).toBe("statement");
    expect(thesisSlide?.kicker?.toLowerCase()).toMatch(/thesis/);
    expect(thesisSlide?.video).toBeUndefined();
    expect(
      publicAssetExists(thesisSlide?.backgroundImage ?? PLATFORM_PITCH_DECK.backgroundImage ?? ""),
    ).toBe(true);

    const terranceSlide = PLATFORM_PITCH_DECK.slides[thesisTitleIdx + 2];
    expect(terranceSlide?.layout).toBe("fullImage");
    expect(terranceSlide?.image).toBe("/terrance.png");
    expect(publicAssetExists(terranceSlide?.image ?? "")).toBe(true);
    expect(terranceSlide?.imageCaption?.trim().length).toBeGreaterThan(0);

    const configSlide = PLATFORM_PITCH_DECK.slides[thesisTitleIdx + 3];
    expect(configSlide?.layout).toBe("fullImage");
    expect(configSlide?.image).toBe("/mechaarm2.jpg");
    expect(publicAssetExists(configSlide?.image ?? "")).toBe(true);
    expect(configSlide?.imageCaption?.trim().length).toBeGreaterThan(0);

    const embeddingsSlide = PLATFORM_PITCH_DECK.slides[thesisTitleIdx + 4];
    expect(embeddingsSlide?.layout).toBe("fullImage");
    expect(embeddingsSlide?.image).toBe("/embeddings.png");
    expect(publicAssetExists(embeddingsSlide?.image ?? "")).toBe(true);
    expect(embeddingsSlide?.imageCaption?.trim().length).toBeGreaterThan(0);

    // Method section title + TAP media
    const methodTitleIdx = thesisTitleIdx + 5;
    expect(PLATFORM_PITCH_DECK.slides[methodTitleIdx]?.title).toBe(
      "How do we ensure high quality data?",
    );
    const tapSlide = PLATFORM_PITCH_DECK.slides[methodTitleIdx + 1];
    expect(tapSlide?.layout).toBe("media");
    expect(tapSlide?.video).toBe("/animations/selective_interface.mp4");
    expect(publicAssetExists(tapSlide?.video ?? "")).toBe(true);
    expect(tapSlide?.cards?.map((c) => c.label.toLowerCase())).toEqual([
      "system 1",
      "system 2",
    ]);

    const puritySlide = PLATFORM_PITCH_DECK.slides[methodTitleIdx + 2];
    expect(puritySlide?.layout).toBe("media");
    expect(puritySlide?.video).toBe("/animations/selective_interface.mp4");
    expect(publicAssetExists(puritySlide?.video ?? "")).toBe(true);

    const dataTitleIdx = methodTitleIdx + 3;
    expect(PLATFORM_PITCH_DECK.slides[dataTitleIdx]?.title).toBe(
      "Data Privacy and Confidential Learning",
    );
    const privacySlides = PLATFORM_PITCH_DECK.slides.slice(dataTitleIdx + 1, dataTitleIdx + 3);
    expect(privacySlides).toHaveLength(2);
    expect(
      privacySlides.every((s) => /data privacy|confidential learning/i.test(s.kicker ?? "")),
    ).toBe(true);
    expect(privacySlides.every((s) => s.layout === "statement")).toBe(true);
    expect(privacySlides.every((s) => !s.imagePlaceholder && !s.image && !s.video)).toBe(true);
    expect(
      privacySlides
        .flatMap((s) => [s.title, s.subtitle, ...(s.highlights ?? [])])
        .join(" ")
        .toLowerCase(),
    ).toMatch(/custom verification model|knowledge config|proprietary/);

    const productsTitleIdx = dataTitleIdx + 3;
    expect(PLATFORM_PITCH_DECK.slides[productsTitleIdx]?.title).toBe("Our products");
    // Four-product layer stack: TAP|ILE top → Stash → PoW bottom (no integration examples)
    const productsSlide = PLATFORM_PITCH_DECK.slides[productsTitleIdx + 1];
    expect(productsSlide?.layout).toBe("statement");
    expect(productsSlide?.kicker?.toLowerCase()).toMatch(/our products/);
    expect(productsSlide?.title.toLowerCase()).toMatch(/four products/);
    expect(productsSlide?.cardLayout).toBe("product-stack");
    expect(productsSlide?.cards?.map((c) => c.label.toLowerCase())).toEqual([
      "tap",
      "ile",
      "stash api",
      "pow api",
    ]);
    expect(productsSlide?.cards).toHaveLength(4);
    for (const card of productsSlide?.cards ?? []) {
      expect(card.body?.trim().length).toBeGreaterThan(20);
      expect(card.ideas ?? []).toHaveLength(0);
    }
    // Layer stack only — no bullets outside the cards (no-scroll stage)
    expect(productsSlide?.bullets ?? []).toHaveLength(0);
    const productsCorpus = [
      productsSlide?.subtitle,
      ...(productsSlide?.cards ?? []).flatMap((c) => [c.label, c.body]),
    ]
      .join("\n")
      .toLowerCase();
    expect(productsCorpus).toMatch(/pow api/);
    expect(productsCorpus).toMatch(/think aloud protocol/);
    expect(productsCorpus).toMatch(/integrated learning environment/);
    expect(productsCorpus).toMatch(/stash api/);
    expect(productsCorpus).toMatch(/buffer agent proof of work|stash \(system 1\)|submit \(system 2\)/);
    expect(productsCorpus).toMatch(/knowledge config|measurement/);
    expect(
      PLATFORM_PITCH_DECK.slides.some((s) =>
        /one interface:\s*proof of work with stash/i.test(s.title ?? ""),
      ),
    ).toBe(false);

    const deckUiProducts = fs.readFileSync(
      path.join(REPO_ROOT, "components/SalesSlideDeck.tsx"),
      "utf8",
    );
    expect(deckUiProducts).toContain("data-pitch-card-grid-product-stack");
    expect(deckUiProducts).toMatch(/grid-cols-2/);
    expect(deckUiProducts).toMatch(/productStack|isProductLayerStack/);

    const deckUi = fs.readFileSync(path.join(REPO_ROOT, "components/SalesSlideDeck.tsx"), "utf8");
    expect(deckUi).toContain("data-pitch-idea");
    expect(deckUi).toContain("data-pitch-idea-icon");
    expect(deckUi).toContain("data-pitch-media-video");
    expect(deckUi).toContain("data-pitch-full-image");
    expect(deckUi).toContain("data-pitch-title-logo");
    expect(deckUi).toContain("data-pitch-title-centered");
    expect(deckUi).toContain('slide.layout === "fullImage"');
    expect(deckUi).toMatch(/autoPlay/);
    expect(deckUi).toMatch(/muted/);
    expect(deckUi).toContain("data-pitch-image-placeholder");
    expect(deckUi).toContain("data-pitch-card-grid");
    expect(deckUi).toContain("CardGrid");
  });

  it("platform deck includes founder facts and required public image paths", () => {
    for (const deck of ALL_DECKS) {
      const text = slideCorpus(deck);
      for (const anchor of FOUNDER_FACT_ANCHORS) {
        expect(text, `${deck.vertical} missing founder fact: ${anchor}`).toMatch(
          new RegExp(anchor.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"),
        );
      }

      const images = collectImagePaths(deck);
      expect(images.some((p) => p === PITCH_ASSETS.founder || p.endsWith("founder.png"))).toBe(
        true,
      );
      expect(images.some((p) => p === PITCH_ASSETS.andrej || p.includes("andrej"))).toBe(true);
      expect(images.some((p) => p.includes("/aesthetics/"))).toBe(true);

      for (const imagePath of images) {
        expect(publicAssetExists(imagePath), `missing public asset: ${imagePath}`).toBe(true);
      }
    }
  });

  it("buildFounderSlides is the shared source; platform places founders after cover + TOC", () => {
    const founderSlides = buildFounderSlides("platform");
    expect(founderSlides.length).toBeGreaterThanOrEqual(3);
    expect(founderSlides.some((s: SalesSlide) => s.layout === "founder")).toBe(true);
    expect(founderSlides.some((s: SalesSlide) => s.layout === "media" && s.image?.includes("andrej"))).toBe(
      true,
    );

    const founderText = founderSlides
      .map((s) => [s.kicker, s.title, s.subtitle, ...(s.bullets ?? [])].join("\n"))
      .join("\n")
      .toLowerCase();
    expect(founderText).toContain("all-you-can-learn");
    expect(founderText).toContain("all-you-can-learn hackathons");
    expect(founderText).toMatch(/hack products and their own knowledge|own knowledge/);
    expect(founderText).toContain("barcelona");
    expect(founderText).toMatch(/\buk\b|united kingdom/);
    expect(founderText).toContain("eth");
    expect(founderText).toContain("extropic");
    expect(founderText).toContain("i*");
    expect(founderText).toMatch(/modeling goals using i\*/);

    // Platform: cover + TOC, then Founder section title, founder content, then thesis section title
    const openOffset = 2;
    expect(PLATFORM_PITCH_DECK.slides[0]?.title).toBe("Uncertain Systems");
    expect(PLATFORM_PITCH_DECK.slides[1]?.title).toMatch(/table of contents/i);
    expect(PLATFORM_PITCH_DECK.slides[openOffset]?.layout).toBe("title");
    expect(PLATFORM_PITCH_DECK.slides[openOffset]?.title).toBe("Founder");
    const platformFounder = PLATFORM_PITCH_DECK.slides.slice(
      openOffset + 1,
      openOffset + 1 + founderSlides.length,
    );
    expect(platformFounder.map((s) => s.title)).toEqual(founderSlides.map((s) => s.title));
    const platformTrajectory = platformFounder.find((s) => s.kicker === "Trajectory");
    expect(platformTrajectory?.title).toMatch(
      /From modeling goals using i\* to building learning verification, optimization, and augmentation tech/,
    );
    expect(PLATFORM_PITCH_DECK.slides[openOffset + 1 + founderSlides.length]?.layout).toBe("title");
    expect(PLATFORM_PITCH_DECK.slides[openOffset + 1 + founderSlides.length]?.title).toMatch(
      /What is Uncertain Systems\?/,
    );
    expect(
      PLATFORM_PITCH_DECK.slides[openOffset + 2 + founderSlides.length]?.kicker?.toLowerCase(),
    ).toMatch(/thesis/);
  });

  it("pitch index: platform only; no vertical decks listed; sales route removed", () => {
    expect(PITCH_PATHS).toEqual(["/pitch"]);
    expect(PITCH_INDEX).toHaveLength(1);
    expect(LIVE_PITCH_PATHS).toEqual(["/pitch"]);
    expect(PITCH_INDEX[0]?.comingSoon).toBeFalsy();
    expect(PITCH_INDEX[0]?.deck).toBe(PLATFORM_PITCH_DECK);
    expect(PITCH_INDEX.map((e) => e.vertical)).toEqual(["platform"]);
    expect(PITCH_PATHS).not.toContain("/pitch-product");
    expect(PITCH_PATHS).not.toContain("/pitch-verification");
    expect(PITCH_PATHS).not.toContain("/pitch-optimization");
    expect(PITCH_PATHS).not.toContain("/pitch-augmentation");
    expect(fs.existsSync(path.join(REPO_ROOT, "app/pitch-product/page.tsx"))).toBe(false);
    expect(fs.existsSync(path.join(REPO_ROOT, "app/pitch-verification/page.tsx"))).toBe(false);
    expect(fs.existsSync(path.join(REPO_ROOT, "app/pitch-optimization/page.tsx"))).toBe(false);
    expect(fs.existsSync(path.join(REPO_ROOT, "app/pitch-augmentation/page.tsx"))).toBe(false);
    expect(fs.existsSync(path.join(REPO_ROOT, "lib/sales/product-pitch-deck.ts"))).toBe(false);
    expect(fs.existsSync(path.join(REPO_ROOT, "app/sales/page.tsx"))).toBe(false);
    expect(fs.existsSync(path.join(REPO_ROOT, "app/sales"))).toBe(false);
  });

  it("route page module: platform pitch only", () => {
    const source = fs.readFileSync(path.join(REPO_ROOT, "app/pitch/page.tsx"), "utf8");
    expect(source).toContain("PLATFORM_PITCH_DECK");
    expect(source).toContain("SalesSlideDeck");
    expect(source).toContain("Platform Pitch");
    expect(source).toMatch(/robots:\s*\{[\s\S]*index:\s*false/);
  });

  it("SalesSlideDeck uses marketing aesthetics (zinc + aesthetics backgrounds, not emerald-only)", () => {
    const deckUi = fs.readFileSync(path.join(REPO_ROOT, "components/SalesSlideDeck.tsx"), "utf8");
    expect(deckUi).toContain("bg-[#0a0a0a]");
    expect(deckUi).toContain("zinc");
    expect(deckUi).toContain("backgroundImage");
    expect(deckUi).toContain("font-mono");
    expect(deckUi).not.toMatch(/bg-emerald-500\/80/);
    expect(deckUi).not.toMatch(/text-emerald-400\/90/);
  });

  it("SalesSlideDeck wraps main copy in dark content panels while keeping aesthetic full-bleed BGs", () => {
    const deckUi = fs.readFileSync(path.join(REPO_ROOT, "components/SalesSlideDeck.tsx"), "utf8");

    expect(deckUi).toContain("data-pitch-content-panel");
    expect(deckUi).toContain("ContentPanel");
    expect(deckUi).toMatch(/bg-black\/50/);
    expect(deckUi).toContain("data-pitch-aesthetic-bg");
    expect(deckUi).toMatch(/backgroundImage:\s*`url\(\$\{backgroundImage\}\)`/);
    expect(deckUi).toContain("bg-cover bg-center");
    expect(deckUi).toMatch(/bg-\[#0a0a0a\]\/30/);
    expect(deckUi).not.toMatch(/bg-\[#0a0a0a\]\/82/);
    expect(deckUi).toMatch(/h-full min-h-0 w-full max-w-none flex-col items-stretch justify-start/);
    expect(deckUi).toContain("text-left");
    expect(deckUi).toMatch(/clamp\(/);

    expect(deckUi).toContain("h-dvh");
    expect(deckUi).toContain("max-h-dvh");
    expect(deckUi).toContain("data-pitch-no-scroll");
    expect(deckUi).toMatch(/w-full max-w-none/);
    expect(deckUi).toContain("overflow-y-auto");

    for (const layout of [
      "title",
      "founder",
      "media",
      "fullImage",
      "statement",
      "bullets",
      "split",
      "close",
    ] as const) {
      if (layout === "close") {
        expect(deckUi).toContain("ContentPanel");
        continue;
      }
      expect(deckUi).toContain(`slide.layout === "${layout}"`);
    }

    for (const deck of ALL_DECKS) {
      const images = collectImagePaths(deck);
      expect(images.some((p) => p.includes("/aesthetics/"))).toBe(true);
    }
  });

  it("SalesSlideDeck uses single-column text layout with larger type (no multi-col bullets)", () => {
    const deckUi = fs.readFileSync(path.join(REPO_ROOT, "components/SalesSlideDeck.tsx"), "utf8");

    expect(deckUi).toContain('data-pitch-layout="single-column"');
    expect(deckUi).toContain("data-pitch-single-column");
    expect(deckUi).toContain("data-pitch-stacked-sections");
    expect(deckUi).toContain("StackedSections");

    expect(deckUi).toMatch(/data-pitch-bullet-list[\s\S]*?flex w-full flex-col/);
    expect(deckUi).not.toMatch(/xl:grid-cols-3/);
    expect(deckUi).not.toMatch(/columns\s*=\s*["']auto["']/);
    expect(deckUi).not.toMatch(/BulletList[^>]*columns=\{2\}/);
    expect(deckUi).toContain("data-pitch-media-stage");
    expect(deckUi).toContain("data-pitch-media-float");
    expect(deckUi).toMatch(/md:grid-cols-\[minmax\(0,1fr\)_minmax\(0,min\(42%,26rem\)\)\]/);
    expect(deckUi).not.toMatch(/md:float-right/);

    expect(deckUi).toMatch(/clamp\(1\.85rem/);
    expect(deckUi).toMatch(/clamp\(1\.5rem/);
    expect(deckUi).toMatch(/clamp\(1\.05rem/);
    expect(deckUi).toMatch(/clamp\(1rem/);
    expect(deckUi).toMatch(/3\.5rem/);
    expect(deckUi).toMatch(/2\.75rem/);
    expect(deckUi).toMatch(/1\.25rem/);
  });

  it("inventory: platform deck keeps non-empty titles and preserves all list items", () => {
    for (const deck of ALL_DECKS) {
      assertNonEmptyTitles(deck);
      const inv = inventoryDeck(deck);
      expect(inv.slideCount).toBe(deck.slides.length);
      expect(inv.slideCount).toBeGreaterThanOrEqual(8);

      const preserved = collectPreservedItemStrings(deck);
      expect(preserved.length).toBeGreaterThan(0);
      for (const item of preserved) {
        expect(item.trim().length).toBeGreaterThan(0);
      }

      for (const slide of inv.slides) {
        if (slide.layout === "split") {
          expect(slide.leftItems.length).toBeGreaterThan(0);
          expect(slide.rightItems.length).toBeGreaterThan(0);
          expect(slide.leftLabel?.trim()).toBeTruthy();
          expect(slide.rightLabel?.trim()).toBeTruthy();
        }
        const raw = deck.slides[slide.index];
        if (raw.bullets !== undefined) {
          expect(raw.bullets.length).toBeGreaterThan(0);
          expect(slide.bulletCount).toBe(raw.bullets.length);
        }
      }
    }

    const platformText = inventoryDeck(PLATFORM_PITCH_DECK).allTextStrings.join("\n").toLowerCase();
    for (const anchor of [
      "think aloud",
      "proof of work",
      "proximity",
      "stash",
      "submit",
      "ile",
      "stash api",
      "pow api",
    ]) {
      expect(platformText).toContain(anchor);
    }

    const founderText = inventoryDeck({
      vertical: "founder",
      label: "Founder",
      slides: buildFounderSlides("platform"),
    })
      .allTextStrings.join("\n")
      .toLowerCase();
    for (const anchor of [
      "daniel colomer",
      "i*",
      "all-you-can-learn",
      "karpathy",
      "omega quest",
      "barcelona",
      "eth",
    ]) {
      expect(founderText).toContain(anchor);
    }
  });

  it("platform Our thesis slide: three concept cards with small images, no supporting bullets", () => {
    const deckUi = fs.readFileSync(path.join(REPO_ROOT, "components/SalesSlideDeck.tsx"), "utf8");
    expect(deckUi).toContain("CardGrid");
    expect(deckUi).toContain("data-pitch-card-grid");
    expect(deckUi).toContain("data-pitch-card-image");
    expect(deckUi).toMatch(/card\.image/);

    // After cover + TOC + founder block + section title
    const openOffset = 2;
    const founderCount = buildFounderSlides("platform").length;
    const thesisIdx = openOffset + 2 + founderCount;
    expect(thesisIdx).toBe(8);
    const platformThesis = PLATFORM_PITCH_DECK.slides[thesisIdx];
    expect(platformThesis).toBeTruthy();
    expect(platformThesis!.kicker?.toLowerCase()).toMatch(/our thesis/);
    expect(platformThesis!.title.toLowerCase()).toMatch(/ratio of correct|correct (test )?answers/);
    expect(platformThesis!.subtitle?.toLowerCase()).toMatch(
      /abstracted away from pure result samples/,
    );
    expect(platformThesis!.cards).toHaveLength(3);
    expect(platformThesis!.cards?.map((c) => c.label.toLowerCase())).toEqual([
      "proof of work proxy",
      "configuration space",
      "distance to “knowing x”",
    ]);
    // Cards stay scannable; small images replace the old four bullets.
    for (const card of platformThesis!.cards ?? []) {
      expect(card.body?.trim().length).toBeGreaterThan(10);
      expect(card.body!.trim().length).toBeLessThan(90);
      expect(card.image?.trim().length).toBeGreaterThan(0);
    }
    expect(platformThesis!.cards?.map((c) => c.image)).toEqual([
      "/terrance.png",
      "/mechaarm2.jpg",
      "/embeddings.png",
    ]);
    // No non-empty bullet list under the cards
    const nonEmptyBullets = (platformThesis!.bullets ?? []).filter((b) => b.trim().length > 0);
    expect(nonEmptyBullets).toHaveLength(0);

    // Lead-in text section above the three boxes: knowledge-as-function + intractability
    expect(platformThesis!.highlights?.length).toBeGreaterThanOrEqual(1);
    const leadIn = (platformThesis!.highlights ?? []).join(" ").toLowerCase();
    expect(leadIn).toMatch(/function/);
    expect(leadIn).toMatch(/intractable|hand-pick|hand.?craft/);
    expect(leadIn).toMatch(/measure|comput/);
    // Flywire image on the left of the lead-in box + source credit
    expect(platformThesis!.highlightImages?.[0]).toBe("/flywire.png");
    expect(platformThesis!.highlightImageSources?.[0]?.toLowerCase()).toMatch(/flywire\.ai/);
    expect(platformThesis!.highlightLabels?.[0]).toMatch(/the hypothesis/i);
    expect(publicAssetExists("/flywire.png")).toBe(true);
    expect(deckUi).toContain("data-pitch-highlight-image");
    expect(deckUi).toContain("data-pitch-highlight-source");
    // Statement layout renders highlights before CardGrid (above the boxes)
    const statementBranch = deckUi.slice(deckUi.indexOf('slide.layout === "statement"'));
    const highlightsAt = statementBranch.indexOf("HighlightCallouts");
    const cardGridAt = statementBranch.indexOf("<CardGrid");
    expect(highlightsAt).toBeGreaterThan(-1);
    expect(cardGridAt).toBeGreaterThan(-1);
    expect(highlightsAt).toBeLessThan(cardGridAt);

    // Full-size follow-ons after thesis cards: terrance, mechaarm2, embeddings
    // (1-based slides 10–12 when thesis is slide 9 / index 8)
    expect(PLATFORM_PITCH_DECK.slides[thesisIdx + 1]?.image).toBe("/terrance.png");
    expect(PLATFORM_PITCH_DECK.slides[thesisIdx + 2]?.image).toBe("/mechaarm2.jpg");
    expect(PLATFORM_PITCH_DECK.slides[thesisIdx + 3]?.image).toBe("/embeddings.png");
    for (const asset of ["/mechaarm2.jpg", "/terrance.png", "/embeddings.png"]) {
      expect(publicAssetExists(asset), `missing public asset: ${asset}`).toBe(true);
    }

    // Card thumbnails link to matching fullImage slides; those have Back → thesis
    expect(deckUi).toContain("resolveFullImageSlideForAsset");
    expect(deckUi).toContain("resolveBackSlideForFullImage");
    expect(deckUi).toContain("data-pitch-card-image-link");
    expect(deckUi).toContain("data-pitch-full-image-back");
    for (const [cardImage, zoomOffset] of [
      ["/terrance.png", 1],
      ["/mechaarm2.jpg", 2],
      ["/embeddings.png", 3],
    ] as const) {
      const zoomIdx = thesisIdx + zoomOffset;
      expect(PLATFORM_PITCH_DECK.slides[zoomIdx]?.layout).toBe("fullImage");
      expect(PLATFORM_PITCH_DECK.slides[zoomIdx]?.image).toBe(cardImage);
      // Back target is the thesis statement that owns the card
      const ownerIdx = PLATFORM_PITCH_DECK.slides.findIndex((s) =>
        (s.cards ?? []).some((c) => c.image === cardImage),
      );
      expect(ownerIdx).toBe(thesisIdx);
    }

    const thesisCorpus = [
      platformThesis!.title,
      platformThesis!.subtitle,
      ...(platformThesis!.highlights ?? []),
      ...(platformThesis!.cards ?? []).flatMap((c) => [c.label, c.body]),
    ]
      .join("\n")
      .toLowerCase();
    expect(thesisCorpus).toMatch(/configuration space/);
    expect(thesisCorpus).toMatch(/proof of work|pow/);
    expect(thesisCorpus).toMatch(/embedding|distance/);
    expect(thesisCorpus).toMatch(/tools/);
    expect(thesisCorpus).toMatch(/proxy/);
    expect(thesisCorpus).toMatch(/function/);
    expect(thesisCorpus).toMatch(/intractable/);

    // Thesis comes after cover + TOC + Founder title + founder slides + What is Uncertain Systems? title
    expect(PLATFORM_PITCH_DECK.slides[0]?.title).toBe("Uncertain Systems");
    expect(PLATFORM_PITCH_DECK.slides[1]?.title).toMatch(/table of contents/i);
    expect(PLATFORM_PITCH_DECK.slides[openOffset]?.title).toBe("Founder");
    expect(PLATFORM_PITCH_DECK.slides[openOffset + 1 + founderCount]?.title).toMatch(
      /What is Uncertain Systems\?/,
    );
    expect(PLATFORM_PITCH_DECK.slides[thesisIdx]).toBe(platformThesis);
  });

  it("pitch slide copy avoids mocking theater/theatre framing", () => {
    const salesRoot = path.join(REPO_ROOT, "lib/sales");
    const files = fs
      .readdirSync(salesRoot)
      .filter((f) => f.endsWith(".ts"))
      .map((f) => path.join(salesRoot, f));

    const offenders: string[] = [];
    let contrastHits = 0;
    for (const file of files) {
      const text = fs.readFileSync(file, "utf8");
      if (/theat(?:er|re)/i.test(text)) {
        offenders.push(path.relative(REPO_ROOT, file));
      }
      if (
        /proof of work|proof-of-work/i.test(text) &&
        /prox(y|ies)|verified|deploy readiness|configuration proximity|thin (outputs?|take-home)/i.test(
          text,
        )
      ) {
        contrastHits += 1;
      }
    }

    expect(offenders, `theater/theatre still present in: ${offenders.join(", ")}`).toEqual([]);
    expect(contrastHits).toBeGreaterThan(0);

    for (const deck of ALL_DECKS) {
      const corpus = slideCorpus(deck).toLowerCase();
      expect(corpus).toMatch(/proof of work|proof-of-work/);
      expect(corpus).not.toMatch(/theat(?:er|re)/);
    }
  });

  it("labeled highlight callouts appear on platform deck method/product slides", () => {
    const deckUi = fs.readFileSync(path.join(REPO_ROOT, "components/SalesSlideDeck.tsx"), "utf8");
    expect(deckUi).toContain("data-pitch-highlight");
    expect(deckUi).toContain("HighlightCallouts");

    const platformHighlights = PLATFORM_PITCH_DECK.slides.filter(
      (s) => (s.highlights?.length ?? 0) > 0 && (s.highlightLabels?.length ?? 0) > 0,
    );
    // Thesis lead-in + method / privacy slides use labeled highlights.
    expect(platformHighlights.length).toBeGreaterThanOrEqual(3);
    const thesisLabeled = platformHighlights.find((s) => /our thesis/i.test(s.kicker ?? ""));
    expect(thesisLabeled?.highlightLabels?.[0]).toMatch(/the hypothesis/i);
  });

  it("media layout is side-by-side grid; Karpathy media + TAP video media on platform", () => {
    const deckUi = fs.readFileSync(path.join(REPO_ROOT, "components/SalesSlideDeck.tsx"), "utf8");
    const mediaBranch = deckUi.slice(deckUi.indexOf('slide.layout === "media"'));
    expect(mediaBranch).toContain("data-pitch-media-stage");
    expect(mediaBranch).toMatch(/grid-cols-1/);
    expect(mediaBranch).toMatch(/md:grid-cols-/);
    expect(mediaBranch).not.toMatch(/md:float-right/);
    expect(deckUi).toMatch(/data-pitch-bullet-list[\s\S]*?flex w-full flex-col/);

    const karpathy = PLATFORM_PITCH_DECK.slides.find(
      (s) => s.layout === "media" && s.image?.includes("andrej"),
    );
    expect(karpathy, "platform missing Karpathy media slide").toBeTruthy();
    const text = [karpathy!.title, karpathy!.subtitle, karpathy!.imageCaption, ...(karpathy!.bullets ?? [])]
      .join("\n")
      .toLowerCase();
    expect(text).toMatch(/karpathy|omega quest/);

    const tapMedia = PLATFORM_PITCH_DECK.slides.filter(
      (s) => s.layout === "media" && s.video === "/animations/selective_interface.mp4",
    );
    expect(tapMedia.length).toBe(2);
  });

  it("platform deck includes privacy / custom verification model slides", () => {
    const privacySlides = buildPrivacyDataSlides();
    expect(privacySlides).toHaveLength(2);
    expect(privacySlides.every((s) => s.layout === "statement")).toBe(true);
    expect(privacySlides.every((s) => !s.imagePlaceholder && !s.image && !s.video)).toBe(true);
    const privacyCorpus = privacySlides
      .flatMap((s) => [
        s.kicker,
        s.title,
        s.subtitle,
        ...(s.bullets ?? []),
        ...(s.highlights ?? []),
        ...(s.highlightLabels ?? []),
        s.imageCaption,
      ])
      .join("\n")
      .toLowerCase();
    expect(privacyCorpus).toMatch(/custom verification model/);
    expect(privacyCorpus).toMatch(/knowledge config/);
    expect(privacyCorpus).toMatch(/hash|anonymiz/);
    expect(privacyCorpus).toMatch(/proprietary|confidential/);
    expect(privacyCorpus).toMatch(/sre|production/);
    expect(privacyCorpus).toMatch(/internal talent|internal candidates/);

    const platformPrivacy = PLATFORM_PITCH_DECK.slides.filter((s) =>
      /data privacy|confidential learning/i.test(s.kicker ?? ""),
    );
    expect(platformPrivacy.length, "platform deck should include two privacy slides").toBe(2);
    const platformText = PLATFORM_PITCH_DECK.slides
      .flatMap((s) => [s.title, s.subtitle, ...(s.bullets ?? []), ...(s.highlights ?? [])])
      .join("\n")
      .toLowerCase();
    expect(platformText).toMatch(/custom verification model/);
    expect(platformText).toMatch(/proprietary|confidential|anonymiz|hash/);
  });

  it("middleware exempts pitch prefix; sales route gone", () => {
    const middleware = fs.readFileSync(path.join(REPO_ROOT, "middleware.ts"), "utf8");
    expect(middleware).toContain('"/pitch"');
    expect(middleware).not.toContain('"/sales"');

    const prefixesMatch =
      middleware.includes("pathname.startsWith(prefix)") ||
      middleware.includes("pathname === prefix || pathname.startsWith(prefix)");
    expect(prefixesMatch).toBe(true);
  });
});
