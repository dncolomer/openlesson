/**
 * Human Knowledge Platform IA: landing split, product pages, footer-only Support,
 * split pricing, public harness checkout amounts.
 * Drives shipped sources and modules — no re-implemented copy.
 */
import { describe, expect, it } from "vitest";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { COMMUNITY_LINKS, MAIN_NAV_PRODUCT_LINKS, PRICING_NAV_LINKS } from "@/lib/marketing/nav";
import { PLATFORM_HERO, PLATFORM_PRODUCTS, PLATFORM_PHRASE } from "@/lib/marketing/platform";
import { HARNESS_PRODUCT_COPY } from "@/lib/marketing/harness-product";
import {
  VERIFICATION_APPROACH_COPY,
  VERIFICATION_PLATFORM_COPY,
  VERIFICATION_PRODUCT_COPY,
  VERIFICATION_SCALE_COPY,
} from "@/lib/marketing/verification-product";
import { SUPPORT_COPY, SUPPORT_PAGE_TITLE } from "@/lib/marketing/support";
import { HARNESS_PRICING_COPY } from "@/lib/pricing/harness-copy";
import { VERIFICATION_PRICING_COPY } from "@/lib/pricing/verification-copy";
import {
  harnessMonthlyCheckoutPriceData,
  harnessTrialCheckoutPriceData,
  PUBLIC_HARNESS_CHECKOUT_PRICE_TYPES,
} from "@/lib/pricing/harness-checkout";
import {
  HARNESS_MONTHLY_PRICE_CENTS,
  TRIAL_PRICE_CENTS,
} from "@/lib/plans";
import { isGuestCheckoutPriceType } from "@/lib/stripe-checkout";

const ROOT = join(__dirname, "../..");

function read(rel: string): string {
  return readFileSync(join(ROOT, rel), "utf8");
}

describe("landing: Human Knowledge Platform two-product split", () => {
  it("ships Human Knowledge Platform in the hero and the two-product split", () => {
    const landing = read("app/page.tsx");
    const platform = read("lib/marketing/platform.ts");
    const corpus = `${landing}\n${platform}`;

    expect(corpus).toContain("Human Knowledge Platform");
    expect(landing).toContain("A Human Knowledge Platform.");
    expect(landing).not.toContain("Two products. One to learn. One to verify.");
    expect(landing).toContain("HUMAN KNOWLEDGE PLATFORM");
    expect(PLATFORM_HERO.h1).toContain(PLATFORM_PHRASE);
    expect(PLATFORM_HERO.p1).toContain(PLATFORM_PHRASE);
    expect(landing).toContain("Learning Harness");
    expect(landing).toContain("Knowledge Verification");
    expect(corpus.toLowerCase()).toMatch(/cannot be cheated|cannot be faked/);
    expect(corpus.toLowerCase()).toMatch(/without traditional tests/);
    expect(landing).toContain("PLATFORM_PRODUCT_LIST");
    expect(PLATFORM_PRODUCTS.harness.name).toBe("Learning Harness");
    expect(PLATFORM_PRODUCTS.harness.body).toBe(HARNESS_PRODUCT_COPY.lead);
    expect(PLATFORM_PRODUCTS.verification.name).toBe("Knowledge Verification");
    expect(PLATFORM_PRODUCTS.harness.image).toBe("/lp-boxes/harness-study-table.jpg");
    expect(PLATFORM_PRODUCTS.verification.image).toBe("/lp-boxes/verification-region-map.jpg");
    expect(existsSync(join(ROOT, "public/lp-boxes/harness-study-table.jpg"))).toBe(true);
    expect(existsSync(join(ROOT, "public/lp-boxes/verification-region-map.jpg"))).toBe(true);
    expect(landing).toContain("grayscale");
  });

  it("keeps landing and Harness stills out of the ILE aesthetics library", () => {
    const aestheticDirs = readdirSync(join(ROOT, "public/aesthetics"), { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name);
    expect(aestheticDirs).not.toContain("harness-blocks");
    expect(aestheticDirs).not.toContain("lp-boxes");
    expect(existsSync(join(ROOT, "public/aesthetics/harness-blocks"))).toBe(false);
    expect(existsSync(join(ROOT, "public/aesthetics/lp-boxes"))).toBe(false);

    expect(PLATFORM_PRODUCTS.harness.image.startsWith("/aesthetics/")).toBe(false);
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

describe("product pages: verification owns platform/approach/scale; harness owns AYCL", () => {
  it("verification product page carries moved platform, approach, and scale claims", () => {
    expect(existsSync(join(ROOT, "app/knowledge-verification/page.tsx"))).toBe(true);
    const page = read("app/knowledge-verification/page.tsx");
    expect(page).toContain("knowledge regions");
    expect(page).toContain("distance to knowledge");
    expect(page).toContain("learning world model");
    expect(page).toContain("TIM — Trace Interruption Model");
    expect(page).toContain("Think Aloud Protocol (TAP)");
    expect(page).toContain("Integrated Learning Environment (ILE)");
    expect(page).toContain("/knowledgeg2.png");
    expect(page).toContain("/ranking_app.png");
    expect(page).toContain("data-landing-knowledge-visual");
    expect(page).toContain("data-landing-ranking-visual");
    expect(page).toMatch(/cannot be cheated or faked/);
    expect(VERIFICATION_PLATFORM_COPY.title).toMatch(/knowledge space/i);
    expect(VERIFICATION_APPROACH_COPY.title).toMatch(/learning world model/i);
    expect(VERIFICATION_SCALE_COPY.title).toMatch(/at scale/i);
    expect(VERIFICATION_PRODUCT_COPY.lead.toLowerCase()).toMatch(/without traditional tests/);
  });

  it("harness product path includes All-You-Can-Learn", () => {
    expect(existsSync(join(ROOT, "app/learning-harness/page.tsx"))).toBe(true);
    const page = read("app/learning-harness/page.tsx");
    expect(page).toContain("A Learning Harness for humans");
    expect(HARNESS_PRODUCT_COPY.lead.toLowerCase()).toMatch(/age of ai/);
    expect(HARNESS_PRODUCT_COPY.body.toLowerCase()).toMatch(/does not build content or a course/);
    expect(HARNESS_PRODUCT_COPY.foraging.toLowerCase()).toMatch(/epistemic foraging/);
    expect(HARNESS_PRODUCT_COPY.foraging.toLowerCase()).toMatch(/reducing uncertainty/);
    expect(page).toContain("data-harness-epistemic-foraging");
    expect(page).toContain("epistemic foraging");
    expect(page).toContain("HARNESS_PRODUCT_COPY.screenshots");
    expect(page).toContain("data-harness-screenshots");
    expect(page).toContain("HarnessScreenshotCarousel");
    const carousel = read("components/marketing/HarnessScreenshotCarousel.tsx");
    expect(carousel).toContain("data-harness-screenshot-carousel");
    expect(carousel).toContain('aria-roledescription="carousel"');
    expect(HARNESS_PRODUCT_COPY.screenshots.map((s) => s.src)).toEqual([
      "/harness.png",
      "/harness-2.png",
    ]);
    expect(existsSync(join(ROOT, "public/harness.png"))).toBe(true);
    expect(existsSync(join(ROOT, "public/harness-2.png"))).toBe(true);
    expect(page).toContain("All-You-Can-Learn");
    expect(page).toContain("data-harness-points");
    expect(HARNESS_PRODUCT_COPY.points.map((p) => p.title)).toEqual([
      "Epistemic Foraging Policy",
      "Easy to fool yourself",
      "Open source by design",
    ]);
    expect(HARNESS_PRODUCT_COPY.points[0].href).toBeNull();
    expect(page).not.toContain("grokipedia.com");
    expect(HARNESS_PRODUCT_COPY.points[2].href).toBe("https://github.com/dncolomer/openlesson");
    expect(page).toContain("target=\"_blank\"");
    expect(page).not.toContain("point.external");
    for (const point of HARNESS_PRODUCT_COPY.points) {
      expect(existsSync(join(ROOT, "public", point.image.replace(/^\//, "")))).toBe(true);
    }
    expect(page).toContain("HARNESS_PRODUCT_COPY.ayclHref");
    expect(page).toContain("data-harness-aycl");
    expect(HARNESS_PRODUCT_COPY.ayclHref).toBe("/all-you-can-learn");
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
  it("ships the Support this Project page with relocated $UNSYS copy", () => {
    expect(existsSync(join(ROOT, "app/support/page.tsx"))).toBe(true);
    const page = read("app/support/page.tsx");
    expect(page).toContain("Support this Project");
    expect(page).toContain("$UNSYS");
    expect(page).toContain("Buy $UNSYS");
    expect(page).toContain("staking");
    expect(page).toContain("Tokenomics");
    expect(SUPPORT_PAGE_TITLE).toBe("Support this Project");
    expect(SUPPORT_COPY.buyCta).toBe("Buy $UNSYS");
  });

  it("footer links Support this Project; main nav does not", () => {
    const footer = read("components/Footer.tsx");
    const nav = read("components/LandingNav.tsx");
    const navModule = read("lib/marketing/nav.ts");
    expect(footer).toContain('href: "/support"');
    expect(footer).toContain("footer.supportThisProject");
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

describe("split pricing + public harness checkout", () => {
  it("harness pricing page shows $24.99, $14.99, 3-day unlimited, and AYCL lifetime-buy link", () => {
    const page = read("app/pricing/page.tsx");
    expect(page).toContain("$24.99");
    expect(page).toContain("$14.99");
    expect(page).toContain("Try unlimited for 3 days for $14.99");
    expect(page).toContain("data-testid=\"pricing-aycl-link\"");
    expect(page).toContain("HARNESS_PRICING_COPY.ayclHref");
    expect(HARNESS_PRICING_COPY.ayclHref).toBe("/all-you-can-learn");
    expect(HARNESS_PRICING_COPY.monthlyPrice).toBe("$24.99");
    expect(HARNESS_PRICING_COPY.trialPrice).toBe("$14.99");
    expect(page).toContain('handleCheckout("api_metered")');
    expect(page).toContain('handleCheckout("trial_3day")');
    expect(page).not.toContain("API Metered");
    expect(page).not.toContain("$19.99");
  });

  it("verification pricing describes Deep Project $10 vs light weight $1 and contact-only setup", () => {
    const page = read("app/pricing/verification/page.tsx");
    expect(existsSync(join(ROOT, "app/pricing/verification/page.tsx"))).toBe(true);
    expect(page).toContain("$10 per assessment");
    expect(page).toContain("$1 per run");
    expect(page).toContain("Deep Project style assessment");
    expect(page).toContain("Light weight verification");
    expect(page).toContain("daniel@uncertain.systems");
    expect(page).toContain("to get set-up");
    expect(page).not.toContain("create-checkout");
    expect(page).not.toContain("handleCheckout");
    expect(page).not.toContain("api_metered");
    expect(page).not.toContain("trial_3day");
    expect(VERIFICATION_PRICING_COPY.deepProject.difference.toLowerCase()).toMatch(
      /open-ended|project|assignment/,
    );
    expect(VERIFICATION_PRICING_COPY.lightWeight.difference.toLowerCase()).toMatch(
      /live|time-framed|think aloud/,
    );
    expect(VERIFICATION_PRICING_COPY.contactEmail).toBe("daniel@uncertain.systems");
    expect(VERIFICATION_PRICING_COPY.deepProject.image).toBe("/deep-verification.png");
    expect(VERIFICATION_PRICING_COPY.lightWeight.image).toBe("/shallow_verification.png");
    expect(existsSync(join(ROOT, "public/deep-verification.png"))).toBe(true);
    expect(existsSync(join(ROOT, "public/shallow_verification.png"))).toBe(true);
    expect(page).toContain("grayscale");
    expect(page).not.toContain("/aesthetics/");
  });

  it("public checkout price_data is 2499 monthly and 1499 trial — not $99 / $19.99", () => {
    expect(HARNESS_MONTHLY_PRICE_CENTS).toBe(2499);
    expect(TRIAL_PRICE_CENTS).toBe(1499);
    expect(harnessMonthlyCheckoutPriceData().unit_amount).toBe(2499);
    expect(harnessTrialCheckoutPriceData().unit_amount).toBe(1499);
    expect(harnessMonthlyCheckoutPriceData().unit_amount).not.toBe(9900);
    expect(harnessTrialCheckoutPriceData().unit_amount).not.toBe(1999);

    const route = read("app/api/stripe/create-checkout/route.ts");
    expect(route).toContain("harnessMonthlyCheckoutPriceData");
    expect(route).toContain("harnessTrialCheckoutPriceData");
    expect(route).not.toContain("API_METERED_PLATFORM_FEE_CENTS");

    expect([...PUBLIC_HARNESS_CHECKOUT_PRICE_TYPES]).toEqual(["api_metered", "trial_3day"]);
    expect(isGuestCheckoutPriceType("api_metered")).toBe(true);
    expect(isGuestCheckoutPriceType("trial_3day")).toBe(true);
  });
});

describe("sitemap lists new public pages", () => {
  it("includes product, support, both pricing routes, and community events listing", () => {
    const sitemap = read("app/sitemap.ts");
    expect(sitemap).toContain("/learning-harness");
    expect(sitemap).toContain("/knowledge-verification");
    expect(sitemap).toContain("/pricing/verification");
    expect(sitemap).toContain("/support");
    expect(sitemap).toContain("/all-you-can-learn");
    expect(sitemap).toContain("/community-events");
    expect(sitemap).toContain("/community-events/ground-state");
    expect(sitemap).not.toContain("/use-cases");
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
      "The Map of Knowledge",
      "TAPBench",
    ]);
    const navbar = read("components/Navbar.tsx");
    expect(navbar).toContain('label: "Community Events"');
    expect(navbar).toContain('label: "The Map of Knowledge"');
    expect(navbar).not.toMatch(
      /communityLinks[\s\S]*href: "\/all-you-can-learn"/,
    );
    const events = read("lib/aycl-landing.ts");
    expect(events).toContain('title: "Thermosynthesis"');
    expect(events).not.toContain("Ground State");
    const verification = read("app/knowledge-verification/page.tsx");
    expect(verification).not.toContain("Verify Human Knowledge without tests.");
    const vision = read("app/vision/page.tsx");
    expect(vision).not.toContain("$UNSYS");
  });
});
