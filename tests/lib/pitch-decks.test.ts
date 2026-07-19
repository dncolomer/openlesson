import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { PLATFORM_PITCH_DECK } from "@/lib/sales/platform-pitch-deck";
import { VERIFICATION_PITCH_DECK } from "@/lib/sales/verification-pitch-deck";
import { OPTIMIZATION_PITCH_DECK } from "@/lib/sales/optimization-pitch-deck";
import { AUGMENTATION_PITCH_DECK } from "@/lib/sales/augmentation-pitch-deck";
import { PRODUCT_PITCH_DECK } from "@/lib/sales/product-pitch-deck";
import { buildFounderSlides } from "@/lib/sales/founder-slides";
import { PITCH_INDEX, PITCH_PATHS } from "@/lib/sales/pitch-index";
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
import { buildPrivacyDataSlide } from "@/lib/sales/privacy-data-slide";
import {
  THESIS_SCIENCE_POW_ANCHORS,
  THESIS_SCIENCE_POW_BULLETS,
  thesisScienceHighlights,
  withThesisScienceBullets,
} from "@/lib/sales/thesis-science-snippet";

const REPO_ROOT = path.resolve(__dirname, "../..");

/** Long-form vertical decks (founder block, privacy, multi use-case depth). */
const ALL_DECKS: SolutionSlideDeck[] = [
  PLATFORM_PITCH_DECK,
  VERIFICATION_PITCH_DECK,
  OPTIMIZATION_PITCH_DECK,
  AUGMENTATION_PITCH_DECK,
];

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

describe("pitch deck content (shipped modules)", () => {
  it("platform deck centers three verticals and current product/world-model language", () => {
    const text = slideCorpus(PLATFORM_PITCH_DECK).toLowerCase();

    expect(PLATFORM_PITCH_DECK.vertical).toBe("pitch");
    expect(text).toContain("verification");
    expect(text).toContain("optimization");
    expect(text).toContain("augmentation");
    expect(text).toContain("learning world model");
    expect(text).toContain("trace interruption model");
    expect(text).toContain("workspace");
    expect(text).toContain("proof-of-work");
    expect(text).toContain("think aloud");
    expect(text).toMatch(/ile|integrated learning environment/);
    expect(text).toMatch(/ale|agentic learning environment/);
    // Not the old primary frame as the only thesis
    expect(PLATFORM_PITCH_DECK.slides.some((s) => /three verticals/i.test(s.title + (s.kicker ?? "")))).toBe(
      true,
    );

    // Title slide frames the three verticals as cards
    const title = PLATFORM_PITCH_DECK.slides[0];
    expect(title.layout).toBe("title");
    expect(title.cards?.length).toBe(3);
    expect(title.cards?.map((c) => c.label.toLowerCase())).toEqual([
      "verification",
      "optimization",
      "augmentation",
    ]);
    for (const card of title.cards ?? []) {
      expect(card.body?.trim().length).toBeGreaterThan(20);
    }

    const deckUi = fs.readFileSync(path.join(REPO_ROOT, "components/SalesSlideDeck.tsx"), "utf8");
    expect(deckUi).toContain("data-pitch-card-grid");
    expect(deckUi).toContain("CardGrid");
    expect(deckUi).toMatch(/md:grid-cols-3/);
  });

  it("verification deck has identity and multi use-case depth", () => {
    const text = slideCorpus(VERIFICATION_PITCH_DECK).toLowerCase();
    expect(VERIFICATION_PITCH_DECK.vertical).toBe("verification");
    expect(VERIFICATION_PITCH_DECK.label.toLowerCase()).toContain("verification");
    expect(text).toContain("tap-cha");
    expect(text).toContain("hire");
    expect(text).toContain("deploy");
    expect(text).toMatch(/recruit|hiring|applicant|screening/);
    // Multiple use-case slides
    const useCaseSlides = VERIFICATION_PITCH_DECK.slides.filter((s) =>
      /use case/i.test(s.kicker ?? ""),
    );
    expect(useCaseSlides.length).toBeGreaterThanOrEqual(3);
  });

  it("optimization deck has identity and multi use-case depth", () => {
    const text = slideCorpus(OPTIMIZATION_PITCH_DECK).toLowerCase();
    expect(OPTIMIZATION_PITCH_DECK.vertical).toBe("optimization");
    expect(text).toMatch(/adoption|convert/);
    expect(text).toMatch(/coach|onboarding/);
    expect(text).toMatch(/score movement|ale|agentic/);
    const useCaseSlides = OPTIMIZATION_PITCH_DECK.slides.filter((s) =>
      /use case/i.test(s.kicker ?? ""),
    );
    expect(useCaseSlides.length).toBeGreaterThanOrEqual(3);
  });

  it("augmentation deck has identity and multi use-case depth", () => {
    const text = slideCorpus(AUGMENTATION_PITCH_DECK).toLowerCase();
    expect(AUGMENTATION_PITCH_DECK.vertical).toBe("augmentation");
    expect(text).toMatch(/onboarding|course|prep|certif/);
    expect(text).toMatch(/check your knowledge|quiz|edtech/);
    const useCaseSlides = AUGMENTATION_PITCH_DECK.slides.filter((s) =>
      /use case/i.test(s.kicker ?? ""),
    );
    expect(useCaseSlides.length).toBeGreaterThanOrEqual(3);
  });

  it("every deck includes founder facts and required public image paths", () => {
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

  it("buildFounderSlides is the shared source used by decks (founder + media layouts)", () => {
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

    const focusByVertical: Record<string, "platform" | "verification" | "optimization" | "augmentation"> = {
      pitch: "platform",
      verification: "verification",
      optimization: "optimization",
      augmentation: "augmentation",
    };

    for (const deck of ALL_DECKS) {
      expect(deck.slides.some((s) => s.layout === "founder")).toBe(true);
      expect(deck.slides.some((s) => s.image === PITCH_ASSETS.founder)).toBe(true);
      expect(deck.slides.some((s) => s.image === PITCH_ASSETS.andrej)).toBe(true);

      // Founder block sits at the beginning: right after the title open
      expect(deck.slides[0]?.layout).toBe("title");
      expect(deck.slides[1]?.layout).toBe("founder");
      const focus = focusByVertical[deck.vertical] ?? "platform";
      const expectedFounder = buildFounderSlides(focus);
      const founderStart = 1;
      const founderCount = expectedFounder.length;
      const block = deck.slides.slice(founderStart, founderStart + founderCount);
      expect(block.map((s) => s.title)).toEqual(expectedFounder.map((s) => s.title));

      const trajectory = block.find((s) => s.kicker === "Trajectory");
      expect(trajectory?.title).toMatch(/From modeling goals using i\*/);
      if (focus === "platform") {
        expect(trajectory?.title).toMatch(/verification, optimization, and augmentation tech/);
      } else {
        expect(trajectory?.title).toBe(
          `From modeling goals using i* to building learning ${focus} tech`,
        );
      }

      // Not near the end: last non-close slides are product narrative, not founder
      const lastContent = deck.slides[deck.slides.length - 2];
      expect(lastContent?.layout).not.toBe("founder");
      expect(lastContent?.image).not.toBe(PITCH_ASSETS.founder);
    }
  });

  it("pitch index and sales page wire all pitch paths including product", () => {
    expect(PITCH_PATHS).toEqual([
      "/pitch",
      "/pitch-product",
      "/pitch-verification",
      "/pitch-optimization",
      "/pitch-augmentation",
    ]);
    expect(PITCH_INDEX).toHaveLength(5);
    expect(PITCH_INDEX.map((e) => e.deck)).toEqual([
      PLATFORM_PITCH_DECK,
      PRODUCT_PITCH_DECK,
      VERIFICATION_PITCH_DECK,
      OPTIMIZATION_PITCH_DECK,
      AUGMENTATION_PITCH_DECK,
    ]);

    const salesPage = fs.readFileSync(path.join(REPO_ROOT, "app/sales/page.tsx"), "utf8");
    expect(salesPage).toContain("PITCH_INDEX");
    expect(salesPage).toContain("data-sales-index");
    for (const route of PITCH_PATHS) {
      // Linked via PITCH_INDEX map — source imports the index module
      expect(PITCH_INDEX.some((e) => e.path === route)).toBe(true);
    }
  });

  it("route page modules mount the correct shipped decks", () => {
    const routes: { file: string; importNeedle: string; title: string }[] = [
      {
        file: "app/pitch/page.tsx",
        importNeedle: "PLATFORM_PITCH_DECK",
        title: "Platform Pitch",
      },
      {
        file: "app/pitch-product/page.tsx",
        importNeedle: "PRODUCT_PITCH_DECK",
        title: "Product Pitch",
      },
      {
        file: "app/pitch-verification/page.tsx",
        importNeedle: "VERIFICATION_PITCH_DECK",
        title: "Verification Pitch",
      },
      {
        file: "app/pitch-optimization/page.tsx",
        importNeedle: "OPTIMIZATION_PITCH_DECK",
        title: "Optimization Pitch",
      },
      {
        file: "app/pitch-augmentation/page.tsx",
        importNeedle: "AUGMENTATION_PITCH_DECK",
        title: "Augmentation Pitch",
      },
    ];

    for (const route of routes) {
      const source = fs.readFileSync(path.join(REPO_ROOT, route.file), "utf8");
      expect(source).toContain(route.importNeedle);
      expect(source).toContain("SalesSlideDeck");
      expect(source).toContain(route.title);
      expect(source).toMatch(/robots:\s*\{[\s\S]*index:\s*false/);
    }
  });

  it("product pitch deck: thesis + fullImage + 2 media video + productized + 3 use-case slides, schema anchors", () => {
    expect(PRODUCT_PITCH_DECK.vertical).toBe("product");
    expect(PRODUCT_PITCH_DECK.label.toLowerCase()).toContain("product");
    expect(PRODUCT_PITCH_DECK.slides).toHaveLength(8);
    assertNonEmptyTitles(PRODUCT_PITCH_DECK);

    const inv = inventoryDeck(PRODUCT_PITCH_DECK);
    expect(inv.slideCount).toBe(8);

    const corpus = slideCorpus(PRODUCT_PITCH_DECK).toLowerCase();
    // Schema anchors across thesis → TAP method ×2 → productize → use
    expect(corpus).toMatch(/thesis|ratio of correct answers/);
    expect(corpus).toMatch(/brain config|proximity/);
    expect(corpus).toMatch(/think aloud protocol/);
    expect(corpus).toMatch(/submit.stash|submit\/stash|submit–stash/);
    expect(corpus).toMatch(/system 1/);
    expect(corpus).toMatch(/system 2/);
    expect(corpus).toMatch(/embedding/);
    expect(corpus).toMatch(/tool agnostic|silence ratio|protocol purity/);
    expect(corpus).toMatch(/selective thought|tap|ile/);
    // Use cases clustered under PoW · TAP · ILE (business-value phrasing)
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

    // Ordered narrative kickers (method split across two slides; fullImage has no kicker)
    expect(PRODUCT_PITCH_DECK.slides[0]?.kicker?.toLowerCase()).toMatch(/thesis/);
    expect(PRODUCT_PITCH_DECK.slides[1]?.layout).toBe("fullImage");
    expect(PRODUCT_PITCH_DECK.slides[2]?.kicker?.toLowerCase()).toMatch(/test|implement/);
    expect(PRODUCT_PITCH_DECK.slides[2]?.title.toLowerCase()).toMatch(/think aloud/);
    expect(PRODUCT_PITCH_DECK.slides[3]?.kicker?.toLowerCase()).toMatch(/test|implement/);
    expect(PRODUCT_PITCH_DECK.slides[3]?.title.toLowerCase()).toMatch(/ai|game|tool|purity/);
    expect(PRODUCT_PITCH_DECK.slides[4]?.kicker?.toLowerCase()).toMatch(/product/);
    expect(PRODUCT_PITCH_DECK.slides[5]?.kicker?.toLowerCase()).toMatch(/used|use/);
    expect(PRODUCT_PITCH_DECK.slides[5]?.kicker?.toLowerCase()).toMatch(/pow/);
    expect(PRODUCT_PITCH_DECK.slides[6]?.kicker?.toLowerCase()).toMatch(/tap/);
    expect(PRODUCT_PITCH_DECK.slides[7]?.kicker?.toLowerCase()).toMatch(/ile/);

    // Slide 1: text-only thesis (no image)
    const thesisSlide = PRODUCT_PITCH_DECK.slides[0];
    expect(thesisSlide?.layout).toBe("statement");
    expect(thesisSlide?.image).toBeUndefined();
    expect(thesisSlide?.video).toBeUndefined();
    expect(thesisSlide?.imagePlaceholder).toBeUndefined();
    expect(
      publicAssetExists(thesisSlide?.backgroundImage ?? PRODUCT_PITCH_DECK.backgroundImage ?? ""),
    ).toBe(true);

    // Slide 2: full-stage config-space art
    const configSlide = PRODUCT_PITCH_DECK.slides[1];
    expect(configSlide?.layout).toBe("fullImage");
    expect(configSlide?.image).toBe("/config space.png");
    expect(publicAssetExists(configSlide?.image ?? "")).toBe(true);
    expect(configSlide?.imageCaption?.trim().length).toBeGreaterThan(0);
    expect(
      publicAssetExists(configSlide?.backgroundImage ?? PRODUCT_PITCH_DECK.backgroundImage ?? ""),
    ).toBe(true);

    // Slides 3–4: TAP method media share the same autoplay video treatment
    const tapSlide = PRODUCT_PITCH_DECK.slides[2];
    expect(tapSlide?.layout).toBe("media");
    expect(tapSlide?.video).toBe("/animations/selective_interface.mp4");
    expect(publicAssetExists(tapSlide?.video ?? "")).toBe(true);
    expect(tapSlide?.imagePlaceholder).toBeUndefined();
    expect(tapSlide?.cards?.map((c) => c.label.toLowerCase())).toEqual([
      "system 1",
      "system 2",
    ]);
    expect(tapSlide?.cards?.some((c) => /metacognition|final answer/i.test(c.label))).toBe(false);

    const puritySlide = PRODUCT_PITCH_DECK.slides[3];
    expect(puritySlide?.layout).toBe("media");
    expect(puritySlide?.video).toBe("/animations/selective_interface.mp4");
    expect(publicAssetExists(puritySlide?.video ?? "")).toBe(true);
    expect(puritySlide?.imagePlaceholder).toBeUndefined();
    expect(puritySlide?.image).toBeUndefined();
    expect(puritySlide?.title.toLowerCase()).toMatch(/ai|game|tool|purity/);

    // Slide 5: productized full-width statement (no image column)
    const productizedSlide = PRODUCT_PITCH_DECK.slides[4];
    expect(productizedSlide?.layout).toBe("statement");
    expect(productizedSlide?.imagePlaceholder).toBeUndefined();
    expect(productizedSlide?.image).toBeUndefined();
    expect(productizedSlide?.video).toBeUndefined();
    expect(productizedSlide?.imageCaption).toBeUndefined();
    expect(productizedSlide?.cards?.length).toBeGreaterThanOrEqual(2);
    expect(
      publicAssetExists(
        productizedSlide?.backgroundImage ?? PRODUCT_PITCH_DECK.backgroundImage ?? "",
      ),
    ).toBe(true);

    // Slides 6–8: one product per use-case slide (no scroll from cramming three tools)
    const useCaseSlides = PRODUCT_PITCH_DECK.slides.slice(5, 8);
    expect(useCaseSlides.map((s) => s.cards?.[0]?.label.toLowerCase())).toEqual([
      "pow",
      "tap",
      "ile",
    ]);
    for (const slide of useCaseSlides) {
      expect(slide.layout).toBe("statement");
      expect(slide.imagePlaceholder).toBeUndefined();
      expect(slide.image).toBeUndefined();
      expect(slide.video).toBeUndefined();
      expect(slide.cards?.length).toBe(1);
      expect(slide.cards?.[0]?.ideas?.length).toBeGreaterThanOrEqual(2);
      for (const idea of slide.cards?.[0]?.ideas ?? []) {
        expect(idea.title.trim().length).toBeGreaterThan(0);
        expect(idea.body.trim().length).toBeGreaterThan(40);
      }
      expect(
        publicAssetExists(slide.backgroundImage ?? PRODUCT_PITCH_DECK.backgroundImage ?? ""),
      ).toBe(true);
    }
    const useCaseCorpus = useCaseSlides
      .flatMap((s) =>
        (s.cards ?? []).flatMap((c) =>
          (c.ideas ?? []).flatMap((idea) => [idea.title, idea.body]),
        ),
      )
      .join("\n")
      .toLowerCase();
    expect(useCaseCorpus).toMatch(/dynamic saas onboarding|dynamic onboarding/);
    expect(useCaseCorpus).toMatch(/learning-to-conversion|learning to conversion/);
    expect(useCaseCorpus).toMatch(/tap-cha/);

    // Inventory: thesis + fullImage + two TAP videos + productized + three use-case statements
    expect(inv.slides[0]?.layout).toBe("statement");
    expect(inv.slides[0]?.image).toBeUndefined();
    expect(inv.slides[1]?.layout).toBe("fullImage");
    expect(inv.slides[1]?.image).toBe("/config space.png");
    expect(inv.slides[2]?.layout).toBe("media");
    expect(inv.slides[3]?.layout).toBe("media");
    expect(inv.slides[4]?.layout).toBe("statement");
    expect(inv.slides[4]?.imagePlaceholder).toBeUndefined();
    expect(inv.slides[5]?.layout).toBe("statement");
    expect(inv.slides[6]?.layout).toBe("statement");
    expect(inv.slides[7]?.layout).toBe("statement");
    // Nested idea copy is inventory-visible across the product trio
    expect(inv.slides[5]?.allTextStrings.join(" ").toLowerCase()).toMatch(
      /dynamic saas onboarding|learning-to-conversion/,
    );
    expect(inv.slides[6]?.allTextStrings.join(" ").toLowerCase()).toMatch(/tap-cha/);
    expect(inv.slides[7]?.allTextStrings.join(" ").toLowerCase()).toMatch(
      /onboarding repair|coached take-home|role ramp/,
    );

    // Renderer: idea boxes + media video/placeholder + fullImage contract
    const deckUi = fs.readFileSync(path.join(REPO_ROOT, "components/SalesSlideDeck.tsx"), "utf8");
    expect(deckUi).toContain("data-pitch-idea");
    expect(deckUi).toContain("data-pitch-idea-icon");
    expect(deckUi).toContain("data-pitch-media-video");
    expect(deckUi).toContain("data-pitch-full-image");
    expect(deckUi).toContain('slide.layout === "fullImage"');
    expect(deckUi).toMatch(/autoPlay/);
    expect(deckUi).toMatch(/muted/);
    expect(deckUi).toContain("data-pitch-image-placeholder");
    expect(deckUi).toContain("data-pitch-image-placeholder-slot");
    expect(deckUi).toContain("Image placeholder");
    const mediaBranch = deckUi.slice(deckUi.indexOf('slide.layout === "media"'));
    expect(mediaBranch).toContain("data-pitch-media-figure");
    expect(mediaBranch).toMatch(/slide\.cards/);
    expect(mediaBranch).toMatch(/HighlightCallouts|slide\.highlights/);
  });

  it("SalesSlideDeck uses marketing aesthetics (zinc + aesthetics backgrounds, not emerald-only)", () => {
    const deckUi = fs.readFileSync(path.join(REPO_ROOT, "components/SalesSlideDeck.tsx"), "utf8");
    expect(deckUi).toContain("bg-[#0a0a0a]");
    expect(deckUi).toContain("zinc");
    expect(deckUi).toContain("backgroundImage");
    expect(deckUi).toContain("font-mono");
    // Must not be emerald-only chrome as the sole look
    expect(deckUi).not.toMatch(/bg-emerald-500\/80/);
    expect(deckUi).not.toMatch(/text-emerald-400\/90/);
  });

  it("SalesSlideDeck wraps main copy in dark content panels while keeping aesthetic full-bleed BGs", () => {
    const deckUi = fs.readFileSync(path.join(REPO_ROOT, "components/SalesSlideDeck.tsx"), "utf8");

    // Shared panel treatment
    expect(deckUi).toContain("data-pitch-content-panel");
    expect(deckUi).toContain("ContentPanel");
    expect(deckUi).toMatch(/bg-black\/50/);
    // Full-bleed aesthetic BG wiring preserved
    expect(deckUi).toContain("data-pitch-aesthetic-bg");
    expect(deckUi).toMatch(/backgroundImage:\s*`url\(\$\{backgroundImage\}\)`/);
    expect(deckUi).toContain("bg-cover bg-center");
    // Global dim must not obliterate art (lighter overlay than prior /82 blanket)
    expect(deckUi).toMatch(/bg-\[#0a0a0a\]\/30/);
    expect(deckUi).not.toMatch(/bg-\[#0a0a0a\]\/82/);
    // Slide stage fills available height; copy is top-left aligned
    expect(deckUi).toMatch(/h-full min-h-0 w-full max-w-none flex-col items-stretch justify-start/);
    expect(deckUi).toContain("text-left");
    expect(deckUi).toMatch(/clamp\(/);

    // Full-width presentation shell
    expect(deckUi).toContain("h-dvh");
    expect(deckUi).toContain("max-h-dvh");
    expect(deckUi).toContain("data-pitch-no-scroll");
    expect(deckUi).toMatch(/w-full max-w-none/);
    // Panels may scroll if dense — never hard-clip narrative with overflow-hidden alone
    expect(deckUi).toContain("overflow-y-auto");

    // All pitch layouts are handled (fullImage is full-stage image; others use ContentPanel)
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

    // BulletList no longer multi-column (media may float image right — not a 2-col text grid)
    expect(deckUi).toMatch(/data-pitch-bullet-list[\s\S]*?flex w-full flex-col/);
    expect(deckUi).not.toMatch(/xl:grid-cols-3/);
    expect(deckUi).not.toMatch(/columns\s*=\s*["']auto["']/);
    expect(deckUi).not.toMatch(/BulletList[^>]*columns=\{2\}/);
    // Karpathy / media layout: explicit side-by-side grid (not float-only stack)
    expect(deckUi).toContain("data-pitch-media-stage");
    expect(deckUi).toContain("data-pitch-media-float");
    expect(deckUi).toMatch(/md:grid-cols-\[minmax\(0,1fr\)_minmax\(0,min\(42%,26rem\)\)\]/);
    expect(deckUi).not.toMatch(/md:float-right/);

    // Larger type minima than prior compact scale (~0.85 body / ~1.25–1.5 title)
    expect(deckUi).toMatch(/clamp\(1\.85rem/); // TITLE_H1 min
    expect(deckUi).toMatch(/clamp\(1\.5rem/); // TITLE_H2 min
    expect(deckUi).toMatch(/clamp\(1\.05rem/); // SUBTITLE min
    expect(deckUi).toMatch(/clamp\(1rem/); // BODY min
    expect(deckUi).toMatch(/3\.5rem/); // TITLE_H1 max raised
    expect(deckUi).toMatch(/2\.75rem/); // TITLE_H2 max raised
    expect(deckUi).toMatch(/1\.25rem/); // BODY max raised
  });

  it("inventory: every deck keeps non-empty titles and preserves all list items", () => {
    for (const deck of ALL_DECKS) {
      assertNonEmptyTitles(deck);
      const inv = inventoryDeck(deck);
      expect(inv.slideCount).toBe(deck.slides.length);
      expect(inv.slideCount).toBeGreaterThanOrEqual(10);

      const preserved = collectPreservedItemStrings(deck);
      expect(preserved.length).toBeGreaterThan(0);
      for (const item of preserved) {
        expect(item.trim().length).toBeGreaterThan(0);
      }

      // Split slides: both left and right item arrays preserved in inventory
      for (const slide of inv.slides) {
        if (slide.layout === "split") {
          expect(slide.leftItems.length).toBeGreaterThan(0);
          expect(slide.rightItems.length).toBeGreaterThan(0);
          expect(slide.leftLabel?.trim()).toBeTruthy();
          expect(slide.rightLabel?.trim()).toBeTruthy();
        }
        // Defined bullet arrays are non-empty
        const raw = deck.slides[slide.index];
        if (raw.bullets !== undefined) {
          expect(raw.bullets.length).toBeGreaterThan(0);
          expect(slide.bulletCount).toBe(raw.bullets.length);
        }
      }
    }

    // Platform narrative anchors
    const platformText = inventoryDeck(PLATFORM_PITCH_DECK).allTextStrings.join("\n").toLowerCase();
    for (const anchor of [
      "verification",
      "optimization",
      "augmentation",
      "learning world model",
      "trace interruption",
      "workspace",
      "proof-of-work",
      "think aloud",
    ]) {
      expect(platformText).toContain(anchor);
    }

    // Vertical use-case depth
    for (const deck of [VERIFICATION_PITCH_DECK, OPTIMIZATION_PITCH_DECK, AUGMENTATION_PITCH_DECK]) {
      const useCases = deck.slides.filter((s) => /use case/i.test(s.kicker ?? ""));
      expect(useCases.length).toBeGreaterThanOrEqual(3);
      expect(deck.slides.some((s) => s.layout === "close")).toBe(true);
      expect(deck.slides.some((s) => /problem/i.test(s.kicker ?? ""))).toBe(true);
    }

    // Founder anchors
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

  it("each deck’s Our thesis slide highlights science + PoW (vertical-adapted) and keeps thesis bullets", () => {
    const merged = withThesisScienceBullets(["existing point A", "existing point B"]);
    expect(merged.slice(0, THESIS_SCIENCE_POW_BULLETS.length)).toEqual([...THESIS_SCIENCE_POW_BULLETS]);
    expect(merged).toContain("existing point A");

    const focusByVertical: Record<string, "platform" | "verification" | "optimization" | "augmentation"> = {
      pitch: "platform",
      verification: "verification",
      optimization: "optimization",
      augmentation: "augmentation",
    };

    const residualByVertical: Record<string, RegExp[]> = {
      pitch: [/learning world model/i, /three verticals|verification/i, /optimization/i, /augmentation/i],
      verification: [/human/i, /agent/i, /skill|probe|trace/i],
      optimization: [/practice|onboarding|adoption|ale/i, /gap|score|proof-of-work/i],
      augmentation: [/probe|fluency|workspace|course|onboarding/i],
    };

    const deckUi = fs.readFileSync(path.join(REPO_ROOT, "components/SalesSlideDeck.tsx"), "utf8");
    expect(deckUi).toContain("data-pitch-highlights");
    expect(deckUi).toContain("HighlightCallouts");

    for (const deck of ALL_DECKS) {
      const thesis = deck.slides.find((s) => /our thesis/i.test(s.kicker ?? ""));
      expect(thesis, `${deck.vertical} missing Our thesis slide`).toBeTruthy();
      expect(thesis!.highlights?.length).toBe(2);
      expect(thesis!.highlightLabels?.length).toBe(2);

      const focus = focusByVertical[deck.vertical] ?? "platform";
      const expectedHighlights = thesisScienceHighlights(focus);
      expect(thesis!.highlights).toEqual(expectedHighlights);
      expect(thesis!.highlights![0]).toContain("brain configuration");
      expect(thesis!.highlights![1]).toMatch(/Proof of Work|proof of work/i);

      // Vertical adaptation: non-platform decks mention their motion in PoW highlight
      if (focus === "verification") {
        expect(thesis!.highlights![1].toLowerCase()).toMatch(/hire|deploy|certify/);
      }
      if (focus === "optimization") {
        expect(thesis!.highlights![1].toLowerCase()).toMatch(/practice|adoption|gap/);
      }
      if (focus === "augmentation") {
        expect(thesis!.highlights![1].toLowerCase()).toMatch(/probe|fluency|quiz|check your knowledge/);
      }

      const corpus = [
        thesis!.title,
        thesis!.subtitle,
        ...(thesis!.highlights ?? []),
        ...(thesis!.bullets ?? []),
      ]
        .filter(Boolean)
        .join("\n");

      for (const anchor of THESIS_SCIENCE_POW_ANCHORS) {
        expect(corpus.toLowerCase(), `${deck.vertical} thesis missing: ${anchor}`).toContain(
          anchor.toLowerCase(),
        );
      }

      const residuals = residualByVertical[deck.vertical] ?? [];
      for (const re of residuals) {
        expect(corpus, `${deck.vertical} lost residual thesis content ${re}`).toMatch(re);
      }

      // Vertical thesis bullets remain separate (not only the 2 highlights)
      expect((thesis!.bullets ?? []).length).toBeGreaterThanOrEqual(3);
    }
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

    // Shipped decks still carry non-mocking contrast language
    for (const deck of ALL_DECKS) {
      const corpus = slideCorpus(deck).toLowerCase();
      expect(corpus).toMatch(/proof of work|proof-of-work/);
      expect(corpus).not.toMatch(/theat(?:er|re)/);
    }
  });

  it("labeled highlight callouts appear on multiple slides per deck (not only thesis)", () => {
    const deckUi = fs.readFileSync(path.join(REPO_ROOT, "components/SalesSlideDeck.tsx"), "utf8");
    expect(deckUi).toContain("data-pitch-highlight");
    expect(deckUi).toContain("HighlightCallouts");

    for (const deck of ALL_DECKS) {
      const withHighlights = deck.slides.filter(
        (s) => (s.highlights?.length ?? 0) > 0 && (s.highlightLabels?.length ?? 0) > 0,
      );
      // Platform denser; verticals at least problem + thesis + privacy + one more
      expect(
        withHighlights.length,
        `${deck.vertical} expected multiple highlight slides, got ${withHighlights.length}`,
      ).toBeGreaterThanOrEqual(deck.vertical === "pitch" ? 5 : 4);

      const thesis = withHighlights.find((s) => /our thesis/i.test(s.kicker ?? ""));
      expect(thesis).toBeTruthy();
      expect(thesis!.highlights).toHaveLength(2);
      expect(thesis!.highlightLabels?.join(" ")).toMatch(/Science hypothesis|Proof of Work/i);

      // Non-thesis examples still exist
      const nonThesis = withHighlights.filter((s) => !/our thesis/i.test(s.kicker ?? ""));
      expect(nonThesis.length).toBeGreaterThanOrEqual(2);
      expect(
        nonThesis.some((s) => /problem|data posture|why it works|loop|science|use case/i.test(s.kicker ?? "")),
      ).toBe(true);

      for (const slide of withHighlights) {
        expect(slide.highlights!.every((h) => h.trim().length > 0)).toBe(true);
        expect(slide.highlightLabels!.length).toBe(slide.highlights!.length);
        // Narrative retained
        expect(slide.title.trim().length).toBeGreaterThan(0);
      }
    }
  });

  it("platform Science slide keeps core principles without overloading the stage", () => {
    const science = PLATFORM_PITCH_DECK.slides.find((s) => /^science$/i.test(s.kicker ?? ""));
    expect(science).toBeTruthy();
    expect(science!.title.toLowerCase()).toMatch(/holistic|knowledge/);

    const bullets = science!.bullets ?? [];
    const corpus = [
      science!.subtitle,
      ...(science!.highlights ?? []),
      ...bullets,
    ]
      .filter(Boolean)
      .join("\n");
    const lower = corpus.toLowerCase();

    expect(science!.subtitle?.trim().length).toBeGreaterThan(40);
    expect(science!.subtitle!.length).toBeLessThan(280);
    expect(bullets.length).toBeGreaterThanOrEqual(3);
    expect(bullets.length).toBeLessThanOrEqual(4);
    expect(science!.highlights?.length).toBe(2);

    // Core principle anchors retained (highlights + bullets)
    expect(lower).toMatch(/brain configuration|configuration/);
    expect(lower).toContain("proximity");
    expect(lower).toMatch(/transformation|configuration space/);
    expect(lower).toMatch(/non-invasive/);

    // Measurement / proof of work cue
    expect(lower).toMatch(/proof of work|proof-of-work|pow|think-aloud|artifact/);
  });

  it("platform The loop slide is vertical synergy with verification→optimization→augmentation example", () => {
    const loop = PLATFORM_PITCH_DECK.slides.find((s) => /the loop/i.test(s.kicker ?? ""));
    expect(loop).toBeTruthy();
    const cardText = (loop!.cards ?? [])
      .flatMap((c) => [c.label, c.body, ...((c.ideas ?? []).flatMap((i) => [i.title, i.body]))])
      .filter(Boolean)
      .join("\n");
    const corpus = [loop!.title, loop!.subtitle, cardText, ...(loop!.bullets ?? [])]
      .join("\n")
      .toLowerCase();

    expect(corpus).toContain("verification");
    expect(corpus).toContain("optimization");
    expect(corpus).toContain("augmentation");
    expect(corpus).toMatch(/synergy|same (business )?context|foundation|reuse that same proof/);

    // Not only the old linear workspace checklist as the whole story
    expect(loop!.title).not.toMatch(/^Workspace → Verify → Optimize → Augment$/);
    expect(corpus).toMatch(/synergy/);

    // Framed synergy boxes (visual card grid)
    expect(loop!.cards?.length).toBeGreaterThanOrEqual(3);
    expect(loop!.cards?.some((c) => /synergy/i.test(c.label))).toBe(true);
    expect(loop!.cards?.some((c) => /verification/i.test(c.label + (c.body ?? "")))).toBe(true);
    expect(loop!.cards?.some((c) => /optimization/i.test(c.label + (c.body ?? "")))).toBe(true);
    expect(loop!.cards?.some((c) => /augmentation/i.test(c.label + (c.body ?? "")))).toBe(true);

    const deckUi = fs.readFileSync(path.join(REPO_ROOT, "components/SalesSlideDeck.tsx"), "utf8");
    expect(deckUi).toContain("data-pitch-card-grid");
    // statement layout renders cards (not title-only)
    const statementBranch = deckUi.slice(deckUi.indexOf('slide.layout === "statement"'));
    expect(statementBranch).toMatch(/slide\.cards[\s\S]*CardGrid|CardGrid[\s\S]*slide\.cards/);

    // Concrete example path: start verification, then opt + aug in same context
    expect(corpus).toMatch(/example|talent|hiring|hire|deploy|gate/);
    expect(corpus).toMatch(/onboarding|ramp|ale|practice|gap/);
    expect(corpus).toMatch(/probe|course|academy|certif|check your knowledge|l&d|product/);
  });

  it("media layout is side-by-side grid and Karpathy slide keeps andrej asset", () => {
    const deckUi = fs.readFileSync(path.join(REPO_ROOT, "components/SalesSlideDeck.tsx"), "utf8");
    const mediaBranch = deckUi.slice(deckUi.indexOf('slide.layout === "media"'));
    expect(mediaBranch).toContain("data-pitch-media-stage");
    expect(mediaBranch).toMatch(/grid-cols-1/);
    expect(mediaBranch).toMatch(/md:grid-cols-/);
    expect(mediaBranch).not.toMatch(/md:float-right/);
    // Bullet lists elsewhere stay single-column flex (not multi-col grids)
    expect(deckUi).toMatch(/data-pitch-bullet-list[\s\S]*?flex w-full flex-col/);

    for (const deck of ALL_DECKS) {
      const media = deck.slides.find((s) => s.layout === "media");
      expect(media, `${deck.vertical} missing media slide`).toBeTruthy();
      expect(media!.image).toMatch(/andrej/);
      const text = [media!.title, media!.subtitle, media!.imageCaption, ...(media!.bullets ?? [])]
        .join("\n")
        .toLowerCase();
      expect(text).toMatch(/karpathy|omega quest/);
    }
  });

  it("verification tiers mark TAP+ILE as hosted; every deck includes anonymized PoW data slide", () => {
    const tiers = VERIFICATION_PITCH_DECK.slides.find((s) =>
      /integration depth/i.test(s.kicker ?? ""),
    );
    expect(tiers).toBeTruthy();
    const cardText = (tiers!.cards ?? []).flatMap((c) => [c.label, c.body]).join("\n");
    const tiersText = [tiers!.title, tiers!.subtitle, cardText, ...(tiers!.bullets ?? [])]
      .join("\n")
      .toLowerCase();
    expect(tiers!.title.toLowerCase()).toMatch(/three flavou?rs/);
    expect(tiers!.cards?.length).toBe(3);
    expect(tiersText).toMatch(/hosted process/);
    expect(tiersText).toContain("tap");
    expect(tiersText).toContain("ile");
    expect(tiersText).toMatch(/proof-of-work api|pow/);
    expect(tiers!.cards?.map((c) => c.label.toLowerCase()).join(" ")).toMatch(
      /think aloud|integrated learning|proof-of-work|pow/i,
    );

    const privacy = buildPrivacyDataSlide();
    expect(privacy.kicker?.toLowerCase()).toContain("data");
    const privacyCorpus = [privacy.title, privacy.subtitle, ...(privacy.bullets ?? [])]
      .join("\n")
      .toLowerCase();
    expect(privacyCorpus).toMatch(/anonymiz/);
    expect(privacyCorpus).toMatch(/proof.of.work|pow/);
    expect(privacyCorpus).toMatch(/secret|proprietary|pii|leak/);

    for (const deck of ALL_DECKS) {
      const hasPrivacy = deck.slides.some(
        (s) =>
          s.title === privacy.title ||
          (/data posture/i.test(s.kicker ?? "") && /anonymiz/i.test(s.title + (s.subtitle ?? ""))),
      );
      expect(hasPrivacy, `${deck.vertical} missing privacy/anonymized data slide`).toBe(true);
      const deckText = deck.slides
        .flatMap((s) => [s.title, s.subtitle, ...(s.bullets ?? [])])
        .join("\n")
        .toLowerCase();
      expect(deckText).toMatch(/anonymiz/);
      expect(deckText).toMatch(/enterprise secrets|proprietary|pii/);
    }
  });

  it("middleware exempts /sales and pitch prefix covers verticals", () => {
    const middleware = fs.readFileSync(path.join(REPO_ROOT, "middleware.ts"), "utf8");
    expect(middleware).toContain('"/pitch"');
    expect(middleware).toContain('"/sales"');

    // Prefix semantics: /pitch covers /pitch-verification etc.
    const prefixesMatch =
      middleware.includes("pathname.startsWith(prefix)") ||
      middleware.includes("pathname === prefix || pathname.startsWith(prefix)");
    expect(prefixesMatch).toBe(true);
  });
});
