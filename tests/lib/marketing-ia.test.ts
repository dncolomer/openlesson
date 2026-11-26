/**
 * Human Knowledge Platform IA: landing split, product pages, footer-only Support,
 * split pricing, public harness checkout amounts.
 * Drives shipped sources and modules — no re-implemented copy.
 */
import { describe, expect, it } from "vitest";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { COMMUNITY_LINKS, MAIN_NAV_PRODUCT_LINKS, PRICING_NAV_LINKS } from "@/lib/marketing/nav";
import {
  PLATFORM_HERO,
  PLATFORM_LAYER_LIST,
  PLATFORM_PRODUCTS,
} from "@/lib/marketing/platform";
import { HARNESS_PRODUCT_COPY } from "@/lib/marketing/harness-product";
import {
  VERIFICATION_APPROACH_COPY,
  VERIFICATION_PLATFORM_COPY,
  VERIFICATION_PRODUCT_COPY,
  VERIFICATION_SCALE_COPY,
} from "@/lib/marketing/verification-product";
import {
  MAPPING_PLATFORM_COPY,
  MAPPING_PRODUCT_COPY,
} from "@/lib/marketing/mapping-product";
import { SUPPORT_COPY, SUPPORT_PAGE_TITLE } from "@/lib/marketing/support";
import { HARNESS_PRICING_COPY } from "@/lib/pricing/harness-copy";
import { VERIFICATION_PRICING_COPY } from "@/lib/pricing/verification-copy";
import { AUTHORING_PRICING_COPY } from "@/lib/pricing/authoring-copy";
import { MAPPING_PRICING_COPY } from "@/lib/pricing/mapping-copy";
import {
  harnessMonthlyCheckoutPriceData,
  harnessTrialCheckoutPriceData,
  PUBLIC_HARNESS_CHECKOUT_PRICE_TYPES,
} from "@/lib/pricing/harness-checkout";

import { isGuestCheckoutPriceType } from "@/lib/stripe-checkout";

const ROOT = join(__dirname, "../..");

function read(rel: string): string {
  return readFileSync(join(ROOT, rel), "utf8");
}

const DROPPED_LEADS = [
  "instrument for measuring",
  "measuring knowledge",
  "configuration space",
  "without ground truth",
  "fact check",
  "hallucination",
  "recruitment",
  "team building",
  "team-building",
];

const COSTUME = [
  "final frontier",
  "boldly go",
  "mission control",
  "astronaut",
  "starship",
  "cosmos",
  "odyssey",
  "uncharted",
];

function expectExplorationFrame(text: string) {
  const lower = text.toLowerCase();
  expect(lower).toMatch(/explor/);
  expect(lower).toMatch(/physical place/);
  expect(lower).toMatch(/knowledge/);
  expect(lower).toMatch(/agent/);
  expect(lower).toMatch(/pick/);
  expect(lower).toMatch(/best/);
}

function expectNoDroppedLeadOrCostume(text: string) {
  const lower = text.toLowerCase();
  for (const phrase of DROPPED_LEADS) expect(lower).not.toContain(phrase);
  for (const phrase of COSTUME) expect(lower).not.toContain(phrase);
  expect(text).not.toMatch(/\u2014/);
}

describe("landing: knowledge acquisition, verification, and mapping", () => {
  it("ships the new hero lead and keeps acquisition / verification / mapping as layers", () => {
    const landing = `${read("app/page.tsx")}\n${read("components/marketing/landing-heroes.tsx")}`;
    const platform = read("lib/marketing/platform.ts");
    const corpus = `${landing}\n${platform}`;

    expect(corpus).toMatch(/Embeddable Knowledge Verification Protocols/);
    expect(PLATFORM_HERO.p1).toMatch(/genuine work traces/);
    expect(landing).toContain("LandingHeroEditorial");
    expect(landing).toContain("{copy.h1}");
    expect(landing).not.toContain("A Human Knowledge Platform.");
    expect(landing).not.toContain("Two products. One to learn. One to verify.");
    expect(landing).not.toContain("{PLATFORM_HERO.pill}");
    expect(landing).not.toContain("AccelerandoRun");
    expect(landing).toContain("PublicConsoleWash");
    expect(landing).not.toContain("PUBLIC_MAGI_GRID_CLASS");
    expect(PLATFORM_HERO.h1).toBe("Embeddable Knowledge Verification Protocols.");
    expect(PLATFORM_HERO.p1).not.toMatch(/thinking stays yours/);
    expect("p2" in PLATFORM_HERO).toBe(true);
    expect(landing).not.toMatch(/three uses share the geometry/);
    expect(landing).toContain("LANDING_USES");
    expect(landing).toContain("{product.name}");
    expect(landing).not.toContain("The Unsys workspace is a course-seeded Learning Harness.");
    expect(corpus.toLowerCase()).not.toMatch(/cannot be cheated|cannot be faked/);
    expect(landing).not.toContain("PLATFORM_PRODUCT_LIST");
    expect(PLATFORM_PRODUCTS.verification.name).toBe("Protocols");
    expect(PLATFORM_PRODUCTS.verification.title).toBe("Embeddable Knowledge Verification Protocols");
    expect(PLATFORM_PRODUCTS.verification.body).toMatch(/Embeddable Knowledge Verification Protocols/);
    expect(PLATFORM_PRODUCTS.verification.image).toBe("/lp-boxes/verification-bottles-blueprint.jpg");
    expect("harness" in PLATFORM_PRODUCTS).toBe(false);
    expect("mapping" in PLATFORM_PRODUCTS).toBe(false);
    expect("tapbench" in PLATFORM_PRODUCTS).toBe(false);
    expect(existsSync(join(ROOT, "public/lp-boxes/harness-books-blueprint.jpg"))).toBe(true);
    expect(existsSync(join(ROOT, "public/lp-boxes/verification-bottles-blueprint.jpg"))).toBe(true);
    expect(existsSync(join(ROOT, "public/lp-boxes/tapbench-maps-blueprint.jpg"))).toBe(true);
    expect(existsSync(join(ROOT, "public/lp-boxes/knowledge-embedding-blueprint-v1.jpg"))).toBe(true);
    expect(landing).not.toContain("grayscale");
  });

  it("does not ship TAPBench as a product, landing page, or homepage layer", () => {
    expect(existsSync(join(ROOT, "components/TapbenchLanding.tsx"))).toBe(false);
    expect(existsSync(join(ROOT, "components/TapbenchResultsIntro.tsx"))).toBe(false);
    expect(existsSync(join(ROOT, "components/TapbenchExperimentTutorial.tsx"))).toBe(false);
    expect(existsSync(join(ROOT, "app/tapbench/page.tsx"))).toBe(false);
    expect("tapbench" in PLATFORM_PRODUCTS).toBe(false);
    expect(PLATFORM_LAYER_LIST).toHaveLength(1);
    expect(PLATFORM_LAYER_LIST.map((p) => p.name)).toEqual(["Protocols"]);
  });

  it("keeps landing and Harness stills out of the TAP Learning aesthetics library", () => {
    const aestheticDirs = readdirSync(join(ROOT, "public/aesthetics"), { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name);
    expect(aestheticDirs).not.toContain("harness-blocks");
    expect(aestheticDirs).not.toContain("lp-boxes");
    expect(existsSync(join(ROOT, "public/aesthetics/harness-blocks"))).toBe(false);
    expect(existsSync(join(ROOT, "public/aesthetics/lp-boxes"))).toBe(false);

    expect(PLATFORM_PRODUCTS.verification.image.startsWith("/aesthetics/")).toBe(false);
    for (const point of HARNESS_PRODUCT_COPY.points) {
      expect(point.image.startsWith("/aesthetics/")).toBe(false);
      expect(existsSync(join(ROOT, "public", point.image.replace(/^\//, "")))).toBe(true);
    }

    const aestheticsApi = read("app/api/aesthetics/route.ts");
    expect(aestheticsApi).toContain('path.join(process.cwd(), "public", "aesthetics")');
    expect(aestheticsApi).not.toContain("harness-blocks");
    expect(aestheticsApi).not.toContain("lp-boxes");
  });

  it("drops optimization and augmentation pillars from the landing", () => {
    const landing = read("app/page.tsx");
    expect(landing).not.toContain("VERIFICATION . OPTIMIZATION . AUGMENTATION");
    expect(landing).not.toContain("Learning optimization");
    expect(landing).not.toContain("Learning Augmentation");
    expect(landing).not.toContain("HERO_PILLAR_PAGES");
    expect(landing).not.toContain("LEARNING_OPTIMIZATION");
    expect(landing).not.toContain("LEARNING_AUGMENTATION");
    expect(landing).not.toContain('id="platform"');
    expect(landing).not.toContain('id="approach"');
    expect(landing).not.toContain('id="scale"');
  });
});

describe("product pages: verification owns platform/approach; harness owns AYCL", () => {
  it("verification product page carries platform and approach claims", () => {
    expect(existsSync(join(ROOT, "app/verify-protocols/page.tsx"))).toBe(true);
    const page = read("app/verify-protocols/page.tsx");
    expect(page).toContain("VERIFICATION_PLATFORM_COPY.p1");
    expect(page).toContain("VERIFICATION_FLOW_COPY");
    expect(VERIFICATION_APPROACH_COPY.p2).toMatch(/Free Energy Principle/);
    expect(page).toContain("data-landing-epistemic-foraging");
    expect(VERIFICATION_APPROACH_COPY.foragingLabel).toBe("epistemic foraging");
    expect(page).not.toContain("TIM — Trace Interruption Model");
    expect(page).not.toContain("Trace Interruption Model");
    expect(page).not.toContain("TAP Learning");
    expect(page).not.toMatch(/\bTAP\b/);
    expect(page).not.toContain("data-landing-tapbench");
    expect(page).not.toContain("data-landing-tapbench-copy");
    expect(page).not.toContain("tapbenchHref");
    expect(page).not.toContain("TAPBench");
    expect("tapbenchHref" in VERIFICATION_PRODUCT_COPY).toBe(false);
    expect("tapbenchHref" in VERIFICATION_SCALE_COPY).toBe(false);
    expect(page).toContain("VERIFICATION_PLATFORM_COPY.imageSrc");
    expect(page).toContain("MARKETING_MEDIA_FILL_CLASS");
    expect(page).toContain("MARKETING_MEDIA_STAGE_CLASS");
    expect(page).not.toContain("VERIFICATION_SCALE_COPY.imageSrc");
    expect(VERIFICATION_PLATFORM_COPY.imageSrc).toBe("/regions1.png");
    expect(existsSync(join(ROOT, "public/regions1.png"))).toBe(true);
    expect(page).toContain("data-landing-knowledge-visual");
    expect(page).not.toContain("data-landing-ranking-visual");
    expect(page).not.toContain('id="scale"');
    expect(page).not.toContain("data-landing-scale-section");
    expect(page).not.toMatch(/cannot be cheated or faked/);
    expect(VERIFICATION_PLATFORM_COPY.title).toMatch(/knowledge region/i);
    expect(VERIFICATION_APPROACH_COPY.title).toMatch(/model informs verification/i);
    expect(VERIFICATION_PRODUCT_COPY.lead.toLowerCase()).toMatch(/look beyond the final answer/);
    expect(VERIFICATION_APPROACH_COPY.p2).toMatch(/Free Energy Principle/);
    expect(VERIFICATION_APPROACH_COPY.p2).toMatch(/epistemic foraging/);
  });

  it("retired mapping and solve protocol pages redirect onto verification", () => {
    expect(existsSync(join(ROOT, "app/mapping-protocols/page.tsx"))).toBe(false);
    expect(existsSync(join(ROOT, "app/solve-protocols/page.tsx"))).toBe(false);
    expect(existsSync(join(ROOT, "app/learning-harness/page.tsx"))).toBe(false);
    expect(MAPPING_PRODUCT_COPY.title).toBe(VERIFICATION_PRODUCT_COPY.title);
    expect(MAPPING_PLATFORM_COPY.title).toMatch(/knowledge region/i);
    expect(HARNESS_PRODUCT_COPY.productName).toBe("Embeddable Knowledge Verification Protocols");
    expect(JSON.stringify(HARNESS_PRODUCT_COPY)).not.toMatch(/Problem Solving Harness/);
    expect(JSON.stringify(HARNESS_PRODUCT_COPY)).not.toMatch(/Learning Harness/);
    expect("ayclHref" in HARNESS_PRODUCT_COPY).toBe(false);
    const config = read("next.config.ts");
    expect(config).toMatch(
      /source:\s*["']\/solve-protocols["']\s*,\s*destination:\s*["']\/verify-protocols["']/,
    );
    expect(config).toMatch(
      /source:\s*["']\/mapping-protocols["']\s*,\s*destination:\s*["']\/verify-protocols["']/,
    );
  });

  it("AYCL is not in the Community nav group", () => {
    const communityHrefs: string[] = COMMUNITY_LINKS.map((l) => l.href);
    expect(communityHrefs).not.toContain("/all-you-can-learn");
    expect(COMMUNITY_LINKS.map((l) => l.label).join(" ")).not.toMatch(/All-You-Can-Learn/);
    const nav = read("components/LandingNav.tsx");
    expect(nav).toContain("COMMUNITY_LINKS");
    expect(nav).not.toContain("/all-you-can-learn");
  });
});

describe("Support this Project is footer-only", () => {
  it("retires the Support this Project page", () => {
    expect(existsSync(join(ROOT, "app/support/page.tsx"))).toBe(true);
    const page = read("app/support/page.tsx");
    expect(page).toContain("RetiredProductPage");
    expect(page).not.toContain("Support this Project");
    expect(page).not.toContain("$UNSYS");
    expect(SUPPORT_PAGE_TITLE).toBe("Support this Project");
    expect(SUPPORT_COPY.buyCta).toBe("Buy $UNSYS");
  });

  it("footer and main nav do not present Support as live product", () => {
    const footer = read("components/Footer.tsx");
    const nav = read("components/LandingNav.tsx");
    const navModule = read("lib/marketing/nav.ts");
    expect(footer).not.toContain('href: "/support"');
    expect(footer).not.toContain("footer.supportThisProject");
    expect(nav).not.toContain("/support");
    expect(nav).not.toContain("Support this Project");
    expect(navModule).not.toContain("/support");
    const productHrefs: string[] = MAIN_NAV_PRODUCT_LINKS.map((l) => l.href);
    const pricingHrefs: string[] = PRICING_NAV_LINKS.map((l) => l.href);
    expect(productHrefs).not.toContain("/support");
    expect(pricingHrefs).not.toContain("/support");
  });

  it("Vision no longer carries $UNSYS / Buy $UNSYS / staking CTAs", () => {
    const vision = read("app/vision/page.tsx");
    expect(vision).not.toContain("$UNSYS");
    expect(vision).not.toContain("Buy $UNSYS");
    expect(vision).not.toContain("staking program");
    expect(vision).not.toContain("Tokenomics");
    expect(vision).not.toContain("UNSYS_TOKEN_CA");
  });
});

describe("unified pricing + public module checkout", () => {
  it("pricing page shows free signup and credit packs", () => {
    const page = read("app/pricing/page.tsx");
    expect(page).toContain("PRICING_PAGE_SKUS");
    expect(page).not.toContain("data-testid=\"pricing-aycl-link\"");
    expect(page).not.toContain("UNIFIED_PRICING_COPY.ayclHref");
    expect("ayclHref" in HARNESS_PRICING_COPY).toBe(false);
    expect(HARNESS_PRICING_COPY.monthlyCadence).toMatch(/one-time/);
    expect(HARNESS_PRICING_COPY.trialPrice).toBe("$0");
    expect(page).toContain("data-testid={`checkout-${sku}`}");
    expect(page).not.toContain("API Metered");
    expect(page).not.toContain("$19.99");
    expect(page).not.toContain("$14.99");
  });

  it("legacy verification and mapping routes redirect onto the unified page; authoring redirects to Academy-k", () => {
    expect(read("app/pricing/verification/page.tsx")).toContain("/pricing#verification");
    expect(read("app/pricing/mapping/page.tsx")).toContain("/pricing#mapping");
    expect(read("app/pricing/authoring/page.tsx")).toContain("redirect(");
    expect(read("app/pricing/authoring/page.tsx")).toContain("ACADEMY_K_HREF");
    expect(VERIFICATION_PRICING_COPY.deepProject.price).toBe("$10 per assessment");
    expect(MAPPING_PRICING_COPY.quote.price).toBe("$1 per data point");
    expect(AUTHORING_PRICING_COPY.package.priceAmount).toBe("$15,000");
  });

  it("public checkout price_data is one-time credit packs", () => {
    expect(harnessMonthlyCheckoutPriceData().unit_amount).toBeGreaterThan(0);
    expect(harnessTrialCheckoutPriceData().unit_amount).toBeGreaterThan(0);
    expect(harnessMonthlyCheckoutPriceData()).not.toHaveProperty("recurring");
    expect(harnessTrialCheckoutPriceData()).not.toHaveProperty("recurring");

    const route = read("app/api/stripe/create-checkout/route.ts");
    expect(route).toContain("creditPackCheckoutPriceData");
    expect(route).toContain("API_METERED_PLATFORM_FEE_CENTS");

    expect([...PUBLIC_HARNESS_CHECKOUT_PRICE_TYPES]).toEqual([
      "credits_100",
      "credits_500",
      "credits_2000",
    ]);
    expect(isGuestCheckoutPriceType("api_metered")).toBe(false);
    expect(isGuestCheckoutPriceType("credits_100")).toBe(true);
    expect(isGuestCheckoutPriceType("credits_500")).toBe(true);
  });
});

describe("sitemap lists new public pages", () => {
  it("includes product, support, unified pricing, and community events listing", () => {
    const sitemap = read("app/sitemap.ts");
    expect(sitemap).not.toContain("/solve-protocols");
    expect(sitemap).not.toContain("/learning-harness");
    expect(sitemap).not.toContain("/acquisition");
    expect(sitemap).toContain("/verify-protocols");
    expect(sitemap).not.toContain("/mapping-protocols");
    expect(sitemap).toContain("/pricing");
    expect(sitemap).not.toContain("/pricing/authoring");
    expect(sitemap).not.toContain("/pricing/verification");
    expect(sitemap).not.toContain("/pricing/mapping");
    expect(sitemap).not.toContain("/support");
    expect(sitemap).not.toContain("/all-you-can-learn");
    expect(sitemap).not.toContain("/docs/learning-map-api");
    expect(sitemap).toContain("/community-events");
    expect(sitemap).toContain("/community-events/ground-state");
    expect(sitemap).not.toContain("/brain-priming");
    expect(sitemap).not.toContain("/kardashev");
    expect(sitemap).toContain("/use-cases");
    expect(sitemap).not.toContain("/use-cases/");
    expect(sitemap).not.toContain("/products/");
  });
});

function collectQuotedHrefs(src: string): string[] {
  const found = new Set<string>();
  const re = /href:\s*["']([^"']+)["']/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) found.add(m[1]);
  return [...found];
}

function shippedInternalPathExists(path: string): boolean {
  const clean = path.split("?")[0].split("#")[0];
  if (!clean.startsWith("/")) return true;
  if (clean.includes(".")) {
    return existsSync(join(ROOT, "public", clean.replace(/^\//, "")));
  }
  const rel = clean.replace(/^\//, "");
  return (
    existsSync(join(ROOT, "app", rel, "page.tsx")) ||
    existsSync(join(ROOT, "app", rel, "page.ts"))
  );
}

describe("nav and footer hrefs resolve to shipped pages", () => {
  it("LandingNav + footer in-app hrefs have page.tsx or a public file", () => {
    const hrefs = [
      ...MAIN_NAV_PRODUCT_LINKS.map((l) => l.href),
      ...PRICING_NAV_LINKS.map((l) => l.href),
      ...COMMUNITY_LINKS.map((l) => l.href),
      ...collectQuotedHrefs(read("lib/marketing/nav.ts")),
      ...collectQuotedHrefs(read("components/Footer.tsx")),
    ].filter((h) => h.startsWith("/"));
    expect(new Set(hrefs).size).toBeGreaterThan(8);
    const misses = [...new Set(hrefs)].filter((h) => !shippedInternalPathExists(h));
    expect(misses, `dead hrefs:\n${misses.join("\n")}`).toEqual([]);
  });

  it("Community nav labels and Navbar match the current IA", () => {
    expect(COMMUNITY_LINKS.map((l) => l.label)).toEqual([
      "Community Events",
      "Academy-k",
    ]);
    expect(COMMUNITY_LINKS.map((l) => l.href)).not.toContain("/brain-priming");
    expect(COMMUNITY_LINKS.map((l) => l.href)).not.toContain("/kardashev");
    expect(COMMUNITY_LINKS.map((l) => l.href)).toContain("https://academy-k.com/");
    const navbar = read("components/Navbar.tsx");
    expect(navbar).toContain("COMMUNITY_LINKS");
    expect(navbar).not.toContain('label: "The Map of Knowledge"');
    expect(navbar).not.toMatch(
      /communityLinks[\s\S]*href: "\/all-you-can-learn"/,
    );
    const events = read("lib/aycl-landing.ts");
    expect(events).toContain('title: "Thermosynthesis"');
    expect(events).not.toContain("Ground State");
    const verification = read("app/verify-protocols/page.tsx");
    expect(verification).not.toContain("Verify Human Knowledge without tests.");
    const vision = read("app/vision/page.tsx");
    expect(vision).not.toContain("$UNSYS");
    expect(read("app/kardashev/page.tsx")).toContain("RetiredProductPage");
    const eventsPage = read("app/community-events/page.tsx");
    expect(eventsPage).toContain("MarketingDirectoryHero");
    expect(eventsPage).toContain("console-copy");
    expect(read("app/community-events/ground-state/page.tsx")).toContain("MarketingDirectoryHero");
    expect(read("app/community-events/probabilistic-computing/page.tsx")).toContain(
      "MarketingDirectoryHero",
    );
    expect(read("app/brain-priming/page.tsx")).toContain("RetiredProductPage");
  });
});
