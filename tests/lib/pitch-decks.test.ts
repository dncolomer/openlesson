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
  it("platform deck opens with founder slides, then thesis and product narrative", () => {
    expect(PLATFORM_PITCH_DECK.vertical).toBe("pitch");
    expect(PLATFORM_PITCH_DECK.label.toLowerCase()).toContain("platform");
    assertNonEmptyTitles(PLATFORM_PITCH_DECK);

    const founderSlides = buildFounderSlides("platform");
    // founders + body (6: title + thesis + config + embeddings + TAP×2) + close (4)
    expect(PLATFORM_PITCH_DECK.slides).toHaveLength(founderSlides.length + 6 + 4);

    const founderBlock = PLATFORM_PITCH_DECK.slides.slice(0, founderSlides.length);
    const body = PLATFORM_PITCH_DECK.slides.slice(
      founderSlides.length,
      founderSlides.length + 6,
    );
    const close = PLATFORM_PITCH_DECK.slides.slice(founderSlides.length + 6);

    // Founder first
    expect(founderBlock.map((s) => s.title)).toEqual(founderSlides.map((s) => s.title));
    expect(founderBlock[0]?.layout).toBe("founder");
    expect(PLATFORM_PITCH_DECK.slides[0]?.layout).toBe("founder");

    // Body = title → thesis → config → embeddings → TAP ×2
    expect(body[0]?.layout).toBe("title");
    expect(body[0]?.title).toMatch(/What is Uncertain Systems\?/);
    expect(body[0]?.image).toBe(PITCH_ASSETS.logo);
    expect(body[1]?.kicker?.toLowerCase()).toMatch(/thesis/);
    expect(body[1]?.layout).toBe("statement");
    expect(body[2]?.layout).toBe("fullImage");
    expect(body[2]?.image).toBe("/config space.png");
    expect(body[3]?.layout).toBe("fullImage");
    expect(body[3]?.image).toBe("/embeddings.png");
    expect(body[4]?.layout).toBe("media");
    expect(body[4]?.title.toLowerCase()).toMatch(/think aloud/);
    expect(body[5]?.layout).toBe("media");
    expect(body[5]?.title.toLowerCase()).toMatch(/ai|game|tool|purity|grounded/);

    // Close = productized → data posture ×2 → Our products
    expect(close[0]?.kicker?.toLowerCase()).toMatch(/productized/);
    expect(close[1]?.kicker?.toLowerCase()).toMatch(/data/);
    expect(close[2]?.kicker?.toLowerCase()).toMatch(/data/);
    expect(close[3]?.kicker?.toLowerCase()).toMatch(/our products/);
    expect(close[3]?.cards?.map((c) => c.label.toLowerCase())).toEqual([
      "pow api",
      "tap",
      "ile",
    ]);
  });

  it("platform deck: thesis + fullImage + 2 media video + productized + privacy×2 + 3 use-case slides, schema anchors", () => {
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

    // Title beat after founders (logo + question)
    const titleSlide = PLATFORM_PITCH_DECK.slides[founderCount];
    expect(titleSlide?.layout).toBe("title");
    expect(titleSlide?.title).toBe("What is Uncertain Systems?");
    expect(titleSlide?.image).toBe(PITCH_ASSETS.logo);
    expect(publicAssetExists(titleSlide?.image ?? "")).toBe(true);

    // Thesis after title
    const thesisSlide = PLATFORM_PITCH_DECK.slides[founderCount + 1];
    expect(thesisSlide?.layout).toBe("statement");
    expect(thesisSlide?.kicker?.toLowerCase()).toMatch(/thesis/);
    expect(thesisSlide?.video).toBeUndefined();
    expect(
      publicAssetExists(thesisSlide?.backgroundImage ?? PLATFORM_PITCH_DECK.backgroundImage ?? ""),
    ).toBe(true);

    // full-stage config-space art
    const configSlide = PLATFORM_PITCH_DECK.slides[founderCount + 2];
    expect(configSlide?.layout).toBe("fullImage");
    expect(configSlide?.image).toBe("/config space.png");
    expect(publicAssetExists(configSlide?.image ?? "")).toBe(true);
    expect(configSlide?.imageCaption?.trim().length).toBeGreaterThan(0);

    // embeddings full-stage art (right after config space)
    const embeddingsSlide = PLATFORM_PITCH_DECK.slides[founderCount + 3];
    expect(embeddingsSlide?.layout).toBe("fullImage");
    expect(embeddingsSlide?.image).toBe("/embeddings.png");
    expect(publicAssetExists(embeddingsSlide?.image ?? "")).toBe(true);
    expect(embeddingsSlide?.imageCaption?.trim().length).toBeGreaterThan(0);

    // TAP method media
    const tapSlide = PLATFORM_PITCH_DECK.slides[founderCount + 4];
    expect(tapSlide?.layout).toBe("media");
    expect(tapSlide?.video).toBe("/animations/selective_interface.mp4");
    expect(publicAssetExists(tapSlide?.video ?? "")).toBe(true);
    expect(tapSlide?.cards?.map((c) => c.label.toLowerCase())).toEqual([
      "system 1",
      "system 2",
    ]);

    const puritySlide = PLATFORM_PITCH_DECK.slides[founderCount + 5];
    expect(puritySlide?.layout).toBe("media");
    expect(puritySlide?.video).toBe("/animations/selective_interface.mp4");
    expect(publicAssetExists(puritySlide?.video ?? "")).toBe(true);

    const productizedSlide = PLATFORM_PITCH_DECK.slides[founderCount + 6];
    expect(productizedSlide?.layout).toBe("statement");
    expect(productizedSlide?.kicker?.toLowerCase()).toMatch(/productized/);
    expect(productizedSlide?.cards?.length).toBeGreaterThanOrEqual(2);

    const privacySlides = PLATFORM_PITCH_DECK.slides.slice(
      founderCount + 7,
      founderCount + 9,
    );
    expect(privacySlides).toHaveLength(2);
    expect(privacySlides.every((s) => /data/i.test(s.kicker ?? ""))).toBe(true);
    // Privacy beats are text-only statement slides (no image placeholders).
    expect(privacySlides.every((s) => s.layout === "statement")).toBe(true);
    expect(privacySlides.every((s) => !s.imagePlaceholder && !s.image && !s.video)).toBe(true);
    expect(
      privacySlides
        .flatMap((s) => [s.title, s.subtitle, ...(s.highlights ?? [])])
        .join(" ")
        .toLowerCase(),
    ).toMatch(/custom verification model|knowledge config|proprietary/);

    const productsSlide = PLATFORM_PITCH_DECK.slides[founderCount + 9];
    expect(productsSlide?.layout).toBe("statement");
    expect(productsSlide?.kicker?.toLowerCase()).toMatch(/our products/);
    expect(productsSlide?.cards?.map((c) => c.label.toLowerCase())).toEqual([
      "pow api",
      "tap",
      "ile",
    ]);
    expect(productsSlide?.cards).toHaveLength(3);
    for (const card of productsSlide?.cards ?? []) {
      expect(card.body?.trim().length).toBeGreaterThan(20);
      expect(card.ideas).toBeUndefined();
    }
    const productsCorpus = (productsSlide?.cards ?? [])
      .flatMap((c) => [c.label, c.body])
      .join("\n")
      .toLowerCase();
    expect(productsCorpus).toMatch(/pow api/);
    expect(productsCorpus).toMatch(/dynamic saas onboarding|dynamic onboarding/);
    expect(productsCorpus).toMatch(/tap-cha/);
    expect(productsCorpus).toMatch(/onboarding repair|repair loop/);

    const deckUi = fs.readFileSync(path.join(REPO_ROOT, "components/SalesSlideDeck.tsx"), "utf8");
    expect(deckUi).toContain("data-pitch-idea");
    expect(deckUi).toContain("data-pitch-idea-icon");
    expect(deckUi).toContain("data-pitch-media-video");
    expect(deckUi).toContain("data-pitch-full-image");
    expect(deckUi).toContain("data-pitch-title-logo");
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

  it("buildFounderSlides is the shared source; platform places founders first", () => {
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

    // Platform: founder block first, then title, then thesis
    expect(PLATFORM_PITCH_DECK.slides[0]?.layout).toBe("founder");
    const platformFounder = PLATFORM_PITCH_DECK.slides.slice(0, founderSlides.length);
    expect(platformFounder.map((s) => s.title)).toEqual(founderSlides.map((s) => s.title));
    const platformTrajectory = platformFounder.find((s) => s.kicker === "Trajectory");
    expect(platformTrajectory?.title).toMatch(
      /From modeling goals using i\* to building learning verification, optimization, and augmentation tech/,
    );
    expect(PLATFORM_PITCH_DECK.slides[founderSlides.length]?.layout).toBe("title");
    expect(PLATFORM_PITCH_DECK.slides[founderSlides.length]?.title).toMatch(
      /What is Uncertain Systems\?/,
    );
    expect(PLATFORM_PITCH_DECK.slides[founderSlides.length + 1]?.kicker?.toLowerCase()).toMatch(
      /thesis/,
    );
  });

  it("pitch index: platform only; no vertical decks listed", () => {
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

    const salesPage = fs.readFileSync(path.join(REPO_ROOT, "app/sales/page.tsx"), "utf8");
    expect(salesPage).toContain("PITCH_INDEX");
    expect(salesPage).toContain("data-sales-index");
    expect(salesPage).not.toMatch(/Vertical deep-dives are coming soon/);
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
      "tap-cha",
      "ile",
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

  it("platform Our thesis slide: short concept cards then supporting bullets", () => {
    const deckUi = fs.readFileSync(path.join(REPO_ROOT, "components/SalesSlideDeck.tsx"), "utf8");
    expect(deckUi).toContain("CardGrid");
    expect(deckUi).toContain("data-pitch-card-grid");
    expect(deckUi).toContain("data-pitch-bullet-list");

    const platformThesis = PLATFORM_PITCH_DECK.slides.find((s) => /our thesis/i.test(s.kicker ?? ""));
    expect(platformThesis).toBeTruthy();
    expect(platformThesis!.title.toLowerCase()).toMatch(/ratio of correct|correct (test )?answers/);
    expect(platformThesis!.subtitle?.toLowerCase()).toMatch(/knowledge configuration space/);
    expect(platformThesis!.cards).toHaveLength(3);
    expect(platformThesis!.cards?.map((c) => c.label.toLowerCase())).toEqual([
      "configuration space",
      "proof of work proxy",
      "distance to “knowing x”",
    ]);
    // Cards stay scannable; depth lives in bullets underneath.
    for (const card of platformThesis!.cards ?? []) {
      expect(card.body?.trim().length).toBeGreaterThan(10);
      expect(card.body!.trim().length).toBeLessThan(90);
    }
    expect(platformThesis!.bullets?.length).toBeGreaterThanOrEqual(3);
    const thesisCorpus = [
      platformThesis!.title,
      platformThesis!.subtitle,
      ...(platformThesis!.cards ?? []).flatMap((c) => [c.label, c.body]),
      ...(platformThesis!.bullets ?? []),
    ]
      .join("\n")
      .toLowerCase();
    expect(thesisCorpus).toMatch(/configuration space/);
    expect(thesisCorpus).toMatch(/proof of work|pow/);
    expect(thesisCorpus).toMatch(/embedding|distance/);
    expect(thesisCorpus).toMatch(/tools/);
    expect(thesisCorpus).toMatch(/intractable|proxy|ways of thinking/);

    // Thesis comes after founder block + title beat
    const founderCount = buildFounderSlides("platform").length;
    expect(PLATFORM_PITCH_DECK.slides[founderCount]?.layout).toBe("title");
    expect(PLATFORM_PITCH_DECK.slides[founderCount + 1]).toBe(platformThesis);
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
    // Thesis uses three cards; method / productized / privacy still use highlights.
    expect(platformHighlights.length).toBeGreaterThanOrEqual(3);
    expect(platformHighlights.every((s) => !/our thesis/i.test(s.kicker ?? ""))).toBe(true);
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
      /data posture/i.test(s.kicker ?? ""),
    );
    expect(platformPrivacy.length, "platform deck should include two privacy slides").toBe(2);
    const platformText = PLATFORM_PITCH_DECK.slides
      .flatMap((s) => [s.title, s.subtitle, ...(s.bullets ?? []), ...(s.highlights ?? [])])
      .join("\n")
      .toLowerCase();
    expect(platformText).toMatch(/custom verification model/);
    expect(platformText).toMatch(/proprietary|confidential|anonymiz|hash/);
  });

  it("middleware exempts /sales and pitch prefix", () => {
    const middleware = fs.readFileSync(path.join(REPO_ROOT, "middleware.ts"), "utf8");
    expect(middleware).toContain('"/pitch"');
    expect(middleware).toContain('"/sales"');

    const prefixesMatch =
      middleware.includes("pathname.startsWith(prefix)") ||
      middleware.includes("pathname === prefix || pathname.startsWith(prefix)");
    expect(prefixesMatch).toBe(true);
  });
});
