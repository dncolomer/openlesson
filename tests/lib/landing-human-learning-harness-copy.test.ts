/**
 * Landing hero + sales-path copy: knowledge acquisition, verification, and mapping.
 * Drives shipped modules and sources (page, OG standard, sales decks).
 */
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  homepageCopyText,
  PLATFORM_CORE,
  PLATFORM_HERO,
  PLATFORM_LAYER_LIST,
  PLATFORM_LAYERS,
  PLATFORM_PRODUCT_LIST,
  PLATFORM_PRODUCTS,
  PLATFORM_PROOF,
  PLATFORM_PUBLIC_MAPS,
} from "@/lib/marketing/platform";
import { LANDING_MAP_SIGNUP_HREF } from "@/lib/dashboard-home-catalog";
import {
  UNSYS_STANDARD_HTML_TITLE,
  UNSYS_STANDARD_SHARE_DESCRIPTION,
  UNSYS_STANDARD_SHARE_TITLE,
  standardShareSocialMetadata,
  unsysRootHtmlMetadata,
} from "@/lib/og/standard";
import manifest from "@/app/manifest";
import { inventoryDeck } from "@/lib/sales/pitch-content-inventory";
import { PLATFORM_PITCH_DECK } from "@/lib/sales/platform-pitch-deck";
import { VERIFICATION_PITCH_DECK } from "@/lib/sales/verification-pitch-deck";


const REPO_ROOT = path.resolve(__dirname, "../..");

const AGENTIC_VERIFICATION_CLAIMS = [
  "agentic verification",
  "Agentic skill validation",
  "Validate agentic skill",
  "agentic skill validation",
] as const;

function readRel(rel: string): string {
  return fs.readFileSync(path.join(REPO_ROOT, rel), "utf8");
}

function walkFiles(dir: string, acc: string[] = []): string[] {
  if (!fs.existsSync(dir)) return acc;
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const st = fs.statSync(full);
    if (st.isDirectory()) walkFiles(full, acc);
    else acc.push(full);
  }
  return acc;
}

describe("landing knowledge acquisition, verification, and mapping copy", () => {
  it("ships the hero lead and supporting paragraph from the copy module interpolated on the page", () => {
    const lp = `${readRel("app/page.tsx")}\n${readRel("components/marketing/landing-heroes.tsx")}`;
    const copy = homepageCopyText();

    expect(lp).toContain("LandingHeroEditorial");
    expect(lp).toContain("{copy.h1}");
    expect(lp).toContain("{copy.p1}");
    expect(lp).not.toContain("{copy.p2}");
    expect(lp).not.toContain("{PLATFORM_HERO.pill}");
    expect(lp).not.toContain("AccelerandoRun");
    expect(lp).not.toContain("PUBLIC_MAGI_GRID_CLASS");
    expect(readRel("components/marketing/landing-heroes.tsx")).toContain("PublicConsoleWash");
    expect(readRel("components/marketing/landing-heroes.tsx")).not.toContain("AccelerandoRun");
    expect(lp).not.toContain("A Human Knowledge Platform.");
    expect(lp).not.toContain("Uncertain Systems is a Human Knowledge Platform.");
    expect(lp).not.toMatch(/<h1[^>]*>[\s\S]*Human Knowledge Platform/);

    expect(copy).toMatch(/From genuine work/);
    expect(PLATFORM_HERO.h1).toMatch(/From genuine work/);
    expect(PLATFORM_HERO.h1).toMatch(/^From genuine work/);
    expect(PLATFORM_HERO.p1).toMatch(/Capture it as proof/);
    expect("p2" in PLATFORM_HERO).toBe(false);
    expect(homepageCopyText()).not.toMatch(/three uses share the geometry/);
    expect(copy).not.toMatch(/proposition/i);
    expect(copy).not.toMatch(/hard-domain learning experiences/i);
    expect(copy).not.toMatch(/where experts are scarce/);
    expect(copy).not.toMatch(/\blanded\b|\bthis lands\b/i);
    expect(lp).not.toMatch(/\blanded\b|\bthis lands\b/i);

    expect(lp).not.toContain("Beyond benchmarks for AI.");
    expect(lp).not.toContain("Beyond tests for humans.");
    expect(lp).not.toContain("three verticals for human and agentic learning");
    expect(lp).not.toContain("VERIFICATION . OPTIMIZATION . AUGMENTATION");
    expect(lp).not.toContain("LandingPublicMapsCarousel");
    expect(lp).toMatch(/data-home-hero[\s\S]*data-home-layers[\s\S]*<\/section>/);
    expect(lp).not.toContain("data-home-spine");
    expect(lp).not.toContain("data-home-delivery");
    expect(lp).not.toContain("PLATFORM_SPINE");
    expect(lp).not.toContain("PLATFORM_DELIVERY");
  });

  it("ships layers, knowledge-region core, and proof from interpolated copy", () => {
    const lp = `${readRel("app/page.tsx")}\n${readRel("components/marketing/landing-heroes.tsx")}`;
    const copy = homepageCopyText();

    expect(lp).toContain("LANDING_USES");
    expect(lp).toContain("LandingHeroEditorial");
    expect(lp).not.toContain("{PLATFORM_LAYERS.title}");
    expect(lp).not.toContain("PLATFORM_LAYERS.lead");
    expect(PLATFORM_LAYERS.title).toMatch(/Knowledge Acquisition/);
    expect(PLATFORM_LAYERS.title).toMatch(/Knowledge Verification/);
    expect(PLATFORM_LAYERS.title).toMatch(/Knowledge Mapping/);
    expect(PLATFORM_LAYERS.title).not.toMatch(/Custom Knowledge Mapping/);
    expect(PLATFORM_LAYER_LIST.map((p) => p.name)).toEqual([
      "Knowledge Acquisition",
      "Knowledge Verification",
      "Knowledge Mapping",
    ]);
    expect(PLATFORM_LAYER_LIST.map((p) => p.href)).toEqual([
      "/acquisition",
      "/knowledge-verification",
      "/knowledge-mapping",
    ]);
    expect(lp).toContain("{product.href}");
    expect(lp).toContain("{product.name}");
    expect(lp).toContain("{product.dek}");
    expect(lp).toContain("data-home-layers");
    expect(PLATFORM_HERO.h1).not.toMatch(/Learning Harness/);
    expect(PLATFORM_HERO.h1).not.toMatch(/TAPBench/);
    expect(PLATFORM_PRODUCTS.harness.body).toMatch(/photonic computing/);
    expect(PLATFORM_PRODUCTS.harness.body).toMatch(/problem-solving harness/);
    expect(PLATFORM_PRODUCTS.harness.body).toMatch(/epistemic foraging/);
    expect(PLATFORM_PRODUCTS.verification.body).toMatch(/agentic harnesses/);
    expect(PLATFORM_PRODUCTS.verification.body).toMatch(/cannot be cheated or faked/);
    expect(PLATFORM_PRODUCTS.mapping.body).toMatch(/neurological patterns/);
    expect(PLATFORM_PRODUCTS.mapping.body).toMatch(/knowledge regions/);

    expect(lp).toContain("PLATFORM_CORE");
    expect(lp).toContain("data-home-core");
    expect(lp).toContain("data-home-core-visual");
    expect(lp).toContain("{PLATFORM_CORE.title}");
    expect(lp).toContain("{PLATFORM_CORE.p1}");
    expect(lp).toContain("{PLATFORM_CORE.p2}");
    expect(lp).toContain("{PLATFORM_CORE.p3}");
    expect(lp).toContain("{PLATFORM_CORE.imageSrc}");
    expect(PLATFORM_CORE.title).toMatch(/knowledge embedding models/i);
    expect(PLATFORM_CORE.p1).toMatch(/knowledge region/);
    expect(PLATFORM_CORE.p1).toMatch(/proof of work/);
    expect(PLATFORM_CORE.p3).toMatch(/BCI/);
    expect(PLATFORM_CORE.p3).toMatch(/Audiovisual/);
    expect(PLATFORM_CORE.imageSrc).toBe("/lp-boxes/knowledge-embedding-blueprint-v1.jpg");
    expect(fs.existsSync(path.join(REPO_ROOT, "public", PLATFORM_CORE.imageSrc.replace(/^\//, "")))).toBe(
      true,
    );

    expect(lp).not.toContain("PLATFORM_WHO");
    expect(lp).not.toContain("WHO IT'S FOR");
    expect(lp).not.toContain("Institutes, workforce programs, research orgs, and frontier-tech communities.");
    expect(copy).not.toMatch(/WHO IT'S FOR/);
    expect(copy).not.toMatch(/Institutes, workforce programs/);

    expect(lp).toContain("PLATFORM_PROOF");
    expect(PLATFORM_PROOF.eyebrow).toMatch(/CASE STUDIES/i);
    expect(PLATFORM_PROOF.title).toMatch(/Case Studies, Existing Projects & Clients/);
    expect(PLATFORM_PROOF.title).not.toMatch(/Course authoring for WISER/);
    expect(copy).toMatch(/WISER/);
    expect(copy).toMatch(/thewiser\.org/);
    expect(copy).toMatch(/Extropic/);
    expect(copy).toMatch(/Thermocomputing Hackathon/);
    expect(copy).toMatch(/ETH Zürich|ETH Zurich/);
    expect(copy).toMatch(/Europe/);
    expect(copy).toMatch(/Run by us/);
    expect(lp).toContain("{item.image}");
    expect(lp).toContain("{item.imageAlt}");
    expect(PLATFORM_PROOF.items.map((item) => item.image)).toEqual([
      "/lp-boxes/wiser-blueprint.jpg",
      "/lp-boxes/eth-hackathon-blueprint.jpg",
    ]);
    expect(PLATFORM_PROOF.items[0].logo).toBe("/lp-boxes/wiser-logo.png");
    expect(fs.existsSync(path.join(REPO_ROOT, "public/lp-boxes/wiser-logo.png"))).toBe(true);
    expect(lp).toContain("item.logo");
    for (const item of PLATFORM_PROOF.items) {
      expect(item.image.startsWith("/aesthetics/")).toBe(false);
      expect(fs.existsSync(path.join(REPO_ROOT, "public", item.image.replace(/^\//, "")))).toBe(true);
    }
    expect(copy).not.toMatch(/\d+%/);
    expect(copy).not.toMatch(/\$\d+/);

    expect(lp).not.toContain("PLATFORM_CTA");
    expect(lp).not.toContain("data-home-cta");
    expect(lp).not.toContain("write to daniel@uncertain.systems");
    expect(lp).not.toContain("Scope a program");

    expect(lp).not.toContain("PLATFORM_PRODUCT_LIST");
    expect(lp).not.toContain("LandingPublicMapsCarousel");

    expect(PLATFORM_PUBLIC_MAPS.title).toBe("Explore our Learning Maps");
    expect(PLATFORM_PUBLIC_MAPS.lead).toBe("Try out any of our learning maps.");
    expect(PLATFORM_PUBLIC_MAPS.signupHref).toBe(LANDING_MAP_SIGNUP_HREF);
    expect(PLATFORM_PUBLIC_MAPS.signupHref).toBe("/register");
  });

  it("keeps Harness, Verification, and Mapping in the catalog and drops TAPBench", () => {
    expect(PLATFORM_PRODUCT_LIST).toHaveLength(3);
    expect("tapbench" in PLATFORM_PRODUCTS).toBe(false);
    expect(fs.existsSync(path.join(REPO_ROOT, "app/tapbench/page.tsx"))).toBe(false);
    expect(fs.existsSync(path.join(REPO_ROOT, "app/acquisition/page.tsx"))).toBe(true);
    expect(fs.existsSync(path.join(REPO_ROOT, "app/learning-harness/page.tsx"))).toBe(false);
    expect(fs.existsSync(path.join(REPO_ROOT, "app/knowledge-verification/page.tsx"))).toBe(true);
    expect(fs.existsSync(path.join(REPO_ROOT, "app/knowledge-mapping/page.tsx"))).toBe(true);
    const lp = readRel("app/page.tsx");
    expect(lp).not.toContain("PLATFORM_PRODUCTS.tapbench");
    expect(PLATFORM_HERO.h1).not.toBe("A Human Knowledge Platform.");
  });

  it("contracts OG title to the hero H1 and share description to the new lead, not product split", () => {
    expect(UNSYS_STANDARD_SHARE_TITLE).toBe(PLATFORM_HERO.h1);
    expect(UNSYS_STANDARD_SHARE_DESCRIPTION).not.toBe(PLATFORM_HERO.p1);
    expect(UNSYS_STANDARD_SHARE_DESCRIPTION).toMatch(/Acquire, verify, and map knowledge/);
    expect(UNSYS_STANDARD_SHARE_DESCRIPTION).toMatch(/proof of work/);
    expect(UNSYS_STANDARD_SHARE_DESCRIPTION).toMatch(/embedding models/);
    expect(UNSYS_STANDARD_SHARE_DESCRIPTION).not.toContain("Learning Harness");
    expect(UNSYS_STANDARD_SHARE_DESCRIPTION).not.toContain("Knowledge Verification");
    expect(UNSYS_STANDARD_SHARE_DESCRIPTION).not.toMatch(/Human Knowledge Platform/);
    expect(UNSYS_STANDARD_SHARE_DESCRIPTION).not.toMatch(/hard-domain learning experiences/);
    expect(UNSYS_STANDARD_SHARE_DESCRIPTION.length).toBeGreaterThanOrEqual(120);
    expect(UNSYS_STANDARD_SHARE_DESCRIPTION.length).toBeLessThanOrEqual(160);
    expect(UNSYS_STANDARD_SHARE_DESCRIPTION.length).toBeLessThanOrEqual(200);
    const lp = `${readRel("app/page.tsx")}\n${readRel("components/marketing/landing-heroes.tsx")}`;
    expect(lp).toContain("LandingHeroEditorial");
    expect(lp).toContain("{copy.h1}");
    expect(lp).toContain("{copy.p1}");
    expect(lp).not.toContain("{copy.p2}");
    const standard = readRel("lib/og/standard.ts");
    expect(standard).toContain("PLATFORM_HERO.h1");
    expect(standard).not.toContain("Beyond benchmarks for AI. Beyond tests for humans.");
    expect(standard).not.toContain("three verticals for human and agentic learning");
    expect(standard).toContain("Acquire, verify, and map knowledge");
    expect(standard).not.toContain("hard-domain learning experiences");
    expect(standard).not.toContain("Human Knowledge Platform");
  });

  it("root HTML, OG, Twitter, JSON-LD, and manifest share the LP hero (not old efficiency copy)", () => {
    const rootHtml = unsysRootHtmlMetadata();
    expect(rootHtml.title.default).toBe(UNSYS_STANDARD_HTML_TITLE);
    expect(rootHtml.title.default).toMatch(/Acquire, verify, and map knowledge/i);
    expect(rootHtml.title.default).not.toMatch(/Human Knowledge Platform/);
    expect(rootHtml.title.default).not.toMatch(/hard-domain learning experiences/i);
    expect(rootHtml.title.default.length).toBeGreaterThanOrEqual(50);
    expect(rootHtml.title.default.length).toBeLessThanOrEqual(60);
    expect(rootHtml.description).toBe(UNSYS_STANDARD_SHARE_DESCRIPTION);
    expect(rootHtml.description).not.toBe(PLATFORM_HERO.h1);
    expect(rootHtml.description).not.toBe(PLATFORM_HERO.p1);

    const social = standardShareSocialMetadata({ url: "https://uncertain.systems" });
    expect(social.openGraph?.title).toBe(PLATFORM_HERO.h1);
    expect(social.openGraph?.description).toBe(UNSYS_STANDARD_SHARE_DESCRIPTION);
    expect(social.openGraph?.description).not.toBe(PLATFORM_HERO.p1);
    expect(social.twitter?.title).toBe(PLATFORM_HERO.h1);
    expect(social.twitter?.description).toBe(UNSYS_STANDARD_SHARE_DESCRIPTION);
    expect(social.twitter?.description).not.toBe(PLATFORM_HERO.p1);
    for (const text of [
      social.openGraph?.title,
      social.openGraph?.description,
      social.twitter?.title,
      social.twitter?.description,
    ]) {
      expect(text).not.toMatch(/Learning efficiency for humans & agents/i);
      expect(text).not.toMatch(/Learning Efficiency for Humans & Agents/);
      expect(text).not.toMatch(/Optimize learning efficiency for humans and agentic systems/i);
      expect(text).not.toMatch(/Human Knowledge Platform/);
    }

    const webManifest = manifest();
    expect(webManifest.description).toBe(UNSYS_STANDARD_SHARE_DESCRIPTION);
    expect(webManifest.description).not.toBe(PLATFORM_HERO.h1);
    expect(webManifest.description).not.toBe(PLATFORM_HERO.p1);

    const layout = readRel("app/layout.tsx");
    expect(layout).toContain("unsysRootHtmlMetadata");
    expect(layout).toContain("title: rootHtml.title");
    expect(layout).toContain("description: rootHtml.description");
    expect(layout).toContain("UNSYS_STANDARD_SHARE_DESCRIPTION");
    expect(layout).toMatch(/openGraph:\s*standardSocial\.openGraph/);
    expect(layout).toMatch(/twitter:\s*standardSocial\.twitter/);
    expect(layout).not.toContain("Learning Efficiency for Humans & Agents");
    expect(layout).not.toContain("Optimize learning efficiency for humans and agentic systems");
    expect(layout).not.toContain("learning efficiency platform");
    expect(layout).toContain("knowledge acquisition");
    expect(layout).not.toContain("hard-domain learning experiences");
    expect(layout).not.toContain("Human Knowledge Platform");

    const manifestSrc = readRel("app/manifest.ts");
    expect(manifestSrc).toContain("UNSYS_STANDARD_SHARE_DESCRIPTION");
    expect(manifestSrc).not.toContain("Learning efficiency for humans and agents");

    const standard = readRel("lib/og/standard.ts");
    expect(standard).not.toContain("Learning Efficiency for Humans & Agents");
    expect(standard).not.toContain("Optimize learning efficiency for humans and agentic systems");

    const en = JSON.parse(readRel("messages/en.json")) as { footer: { seoBlurb: string } };
    expect(en.footer.seoBlurb).toMatch(/Acquire, verify, and map knowledge/i);
    expect(en.footer.seoBlurb).not.toMatch(/hard-domain learning experiences/i);
    expect(en.footer.seoBlurb).not.toMatch(/Human Knowledge Platform/);
  });
});

describe("sales-path copy has no agentic verification claims", () => {
  it("verification and live platform decks do not claim agentic skill validation", () => {
    const corpora = [
      inventoryDeck(VERIFICATION_PITCH_DECK).allTextStrings.join("\n"),
      inventoryDeck(PLATFORM_PITCH_DECK).allTextStrings.join("\n"),
    ];
    for (const corpus of corpora) {
      for (const claim of AGENTIC_VERIFICATION_CLAIMS) {
        expect(corpus.toLowerCase()).not.toContain(claim.toLowerCase());
      }
    }
  });

  it("app/sales, lib/sales, and docs/sales sources have zero agentic-verification phrases", () => {
    const roots = ["app/sales", "lib/sales", "docs/sales"].map((rel) =>
      path.join(REPO_ROOT, rel),
    );
    const hits: string[] = [];
    for (const root of roots) {
      for (const file of walkFiles(root)) {
        if (!/\.(ts|tsx|md|mjs|txt)$/i.test(file)) continue;
        const text = fs.readFileSync(file, "utf8");
        for (const claim of AGENTIC_VERIFICATION_CLAIMS) {
          if (text.toLowerCase().includes(claim.toLowerCase())) {
            hits.push(`${path.relative(REPO_ROOT, file)}: ${claim}`);
          }
        }
      }
    }
    expect(hits).toEqual([]);
  });
});
