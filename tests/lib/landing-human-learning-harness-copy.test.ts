/**
 * Landing hero + sales-path copy: hard-domain learning experiences, no agentic verification.
 * Drives shipped modules and sources (page, OG standard, sales decks).
 */
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  homepageCopyText,
  PLATFORM_CTA,
  PLATFORM_DELIVERY,
  PLATFORM_HERO,
  PLATFORM_LAYER_LIST,
  PLATFORM_LAYERS,
  PLATFORM_PRODUCT_LIST,
  PLATFORM_PRODUCTS,
  PLATFORM_PROOF,
  PLATFORM_SPINE,
} from "@/lib/marketing/platform";
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
import { ENTERPRISE_SETUP_EMAIL, ENTERPRISE_SETUP_MAILTO } from "@/lib/marketing/paths";

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

describe("landing hard-domain learning experiences copy", () => {
  it("ships the hero lead and supporting paragraph from the copy module interpolated on the page", () => {
    const lp = readRel("app/page.tsx");
    const copy = homepageCopyText();

    expect(lp).toContain("{PLATFORM_HERO.h1}");
    expect(lp).toContain("{PLATFORM_HERO.p1}");
    expect(lp).toContain("{PLATFORM_HERO.p2}");
    expect(lp).toContain("{PLATFORM_HERO.pill}");
    expect(lp).not.toContain("A Human Knowledge Platform.");
    expect(lp).not.toContain("Uncertain Systems is a Human Knowledge Platform.");
    expect(lp).not.toMatch(/<h1[^>]*>[\s\S]*Human Knowledge Platform/);

    expect(copy).toMatch(/hard-domain learning experiences/);
    expect(copy).toMatch(/where experts are scarce/);
    expect(PLATFORM_HERO.h1).toMatch(/hard-domain learning experiences/);
    expect(PLATFORM_HERO.h1).toMatch(/where experts are scarce/);
    expect(PLATFORM_HERO.p1).toMatch(/won't build the course|will not build the course/);
    expect(PLATFORM_HERO.p1).not.toMatch(/fake the expertise/);
    expect(PLATFORM_HERO.p1).not.toMatch(/orgs that need the course/);
    expect(PLATFORM_HERO.p2).toMatch(/dumping slides|slides in front of an audience/);
    expect(PLATFORM_HERO.p2).toMatch(/active search/);
    expect(PLATFORM_HERO.p2).toMatch(/We author and run them that way/);
    expect(copy).not.toMatch(/proposition/i);
    expect(copy).not.toMatch(/epistemic foraging/i);
    expect(copy).not.toMatch(/\blanded\b|\bthis lands\b/i);
    expect(lp).not.toMatch(/\blanded\b|\bthis lands\b/i);

    expect(lp).not.toContain("Beyond benchmarks for AI.");
    expect(lp).not.toContain("Beyond tests for humans.");
    expect(lp).not.toContain("three verticals for human and agentic learning");
    expect(lp).not.toMatch(/\bagents?\b/i);
    expect(lp).not.toMatch(/agentic/i);
    expect(lp).not.toContain("VERIFICATION . OPTIMIZATION . AUGMENTATION");
  });

  it("ships the four-part spine, both delivery modes, layers, proof, and scoped CTA from interpolated copy", () => {
    const lp = readRel("app/page.tsx");
    const copy = homepageCopyText();

    expect(lp).toContain("PLATFORM_SPINE");
    expect(lp).toContain("{item.name}");
    expect(lp).toContain("{item.body}");
    expect(PLATFORM_SPINE.items).toHaveLength(4);
    expect(PLATFORM_SPINE.items.map((item) => item.name)).toEqual([
      "Authored curriculum",
      "Unsys workspace",
      "Optional skill validation",
      "Optional live layer",
    ]);
    expect(PLATFORM_SPINE.items[0].body).toMatch(/Expert-grade assets/);
    expect(PLATFORM_SPINE.items[0].body).toMatch(/adapt to your specific needs/);
    expect(PLATFORM_SPINE.items[1].body).toMatch(/Learning Harness/);
    expect(PLATFORM_SPINE.items[1].body).toMatch(/lifetime access/);
    expect(PLATFORM_SPINE.items[2].body).toMatch(/Knowledge Verification/);
    expect(PLATFORM_SPINE.items[2].body).toMatch(/real work/);
    expect(PLATFORM_SPINE.items[3].body).toMatch(/on-site training/);
    expect(PLATFORM_SPINE.items[3].body).toMatch(/hardware labs/);

    expect(lp).toContain("PLATFORM_DELIVERY");
    expect(PLATFORM_DELIVERY.items.map((item) => item.name)).toEqual([
      "Program embed",
      "On-site training / intensive",
    ]);
    expect(PLATFORM_DELIVERY.items[0].body).toMatch(/institutes/);
    expect(PLATFORM_DELIVERY.items[0].body).toMatch(/workforce/);
    expect(PLATFORM_DELIVERY.items[0].body).toMatch(/Unsys workspace/);
    expect(PLATFORM_DELIVERY.items[1].body).toMatch(/async and online/);
    expect(PLATFORM_DELIVERY.items[1].body).toMatch(/real world/);
    expect(PLATFORM_DELIVERY.items[1].body).not.toMatch(/hardware lab/);
    expect(PLATFORM_DELIVERY.items[1].body).not.toMatch(/Sponsor-friendly/);
    expect(copy).toMatch(/program embed/i);
    expect(copy).toMatch(/on-site training/i);
    expect(copy).not.toMatch(/school[-\s]day/i);

    expect(lp).toContain("PLATFORM_LAYER_LIST");
    expect(lp).toContain("PLATFORM_LAYERS");
    expect(lp).toContain("{PLATFORM_LAYERS.title}");
    expect(lp).not.toContain("PLATFORM_LAYERS.lead");
    expect(PLATFORM_LAYERS.title).toMatch(/Learning Harness/);
    expect(PLATFORM_LAYERS.title).toMatch(/Knowledge Verification/);
    expect(PLATFORM_LAYERS.title).toMatch(/Custom Knowledge Mapping/);
    expect(PLATFORM_LAYER_LIST.map((p) => p.name)).toEqual([
      "Learning Harness",
      "Knowledge Verification",
      "Custom Knowledge Mapping",
    ]);
    expect(PLATFORM_LAYER_LIST.map((p) => p.href)).toEqual([
      "/learning-harness",
      "/knowledge-verification",
      "/tapbench",
    ]);
    expect(PLATFORM_LAYER_LIST[2].body).toMatch(/target audience/);
    expect(PLATFORM_LAYER_LIST[2].body).toMatch(/map/i);
    expect(lp).toContain("{product.href}");
    expect(lp).toContain("{product.name}");
    expect(PLATFORM_HERO.h1).not.toMatch(/Learning Harness/);
    expect(PLATFORM_HERO.h1).not.toMatch(/Knowledge Verification/);
    expect(PLATFORM_HERO.h1).not.toMatch(/TAPBench/);

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
      "/lp-boxes/wiser.jpg",
      "/lp-boxes/eth-hackathon.jpg",
    ]);
    for (const item of PLATFORM_PROOF.items) {
      expect(item.image.startsWith("/aesthetics/")).toBe(false);
      expect(fs.existsSync(path.join(REPO_ROOT, "public", item.image.replace(/^\//, "")))).toBe(true);
    }
    expect(copy).not.toMatch(/\d+%/);
    expect(copy).not.toMatch(/\$\d+/);

    expect(lp).toContain("PLATFORM_CTA");
    expect(lp).toContain("{PLATFORM_CTA.href}");
    expect(lp).toContain("{PLATFORM_CTA.label}");
    expect(lp).toContain("{PLATFORM_CTA.email}");
    expect(lp).toContain("{PLATFORM_CTA.title}");
    expect(lp).toContain("{PLATFORM_CTA.eyebrow}");
    expect(lp).toContain("data-home-cta");
    expect(lp).not.toContain("PLATFORM_CTA.note");
    expect(lp).not.toContain("write to daniel@uncertain.systems");
    expect(PLATFORM_CTA.href).toBe(ENTERPRISE_SETUP_MAILTO);
    expect(PLATFORM_CTA.email).toBe(ENTERPRISE_SETUP_EMAIL);
    expect(PLATFORM_CTA.email).toBe("daniel@uncertain.systems");
    expect(PLATFORM_CTA.href).toBe("mailto:daniel@uncertain.systems");
    expect(PLATFORM_CTA.title.toLowerCase()).toMatch(/program embed/);
    expect(PLATFORM_CTA.title.toLowerCase()).toMatch(/on-site training/);
    expect(PLATFORM_CTA.label.toLowerCase()).toMatch(/program embed/);
    expect(PLATFORM_CTA.label.toLowerCase()).toMatch(/on-site training/);
    expect(PLATFORM_CTA.label.toLowerCase()).not.toMatch(/demo/);
    expect(copy).toContain("daniel@uncertain.systems");

    expect(lp).not.toContain("PLATFORM_PRODUCT_LIST");
  });

  it("keeps TAPBench in the product catalog and on its route, not as a hero peer headline", () => {
    expect(PLATFORM_PRODUCT_LIST).toHaveLength(3);
    expect(PLATFORM_PRODUCTS.tapbench.href).toBe("/tapbench");
    expect(PLATFORM_PRODUCTS.tapbench.name).toBe("TAPBench");
    expect(fs.existsSync(path.join(REPO_ROOT, "app/tapbench/page.tsx"))).toBe(true);
    expect(fs.existsSync(path.join(REPO_ROOT, "app/learning-harness/page.tsx"))).toBe(true);
    expect(fs.existsSync(path.join(REPO_ROOT, "app/knowledge-verification/page.tsx"))).toBe(true);
    const lp = readRel("app/page.tsx");
    expect(lp).not.toContain("PLATFORM_PRODUCTS.tapbench");
    expect(PLATFORM_HERO.h1).not.toBe("A Human Knowledge Platform.");
  });

  it("contracts OG title to the hero H1 and share description to the new lead, not product split", () => {
    expect(UNSYS_STANDARD_SHARE_TITLE).toBe(PLATFORM_HERO.h1);
    expect(UNSYS_STANDARD_SHARE_DESCRIPTION).not.toBe(PLATFORM_HERO.p1);
    expect(UNSYS_STANDARD_SHARE_DESCRIPTION).not.toBe(PLATFORM_HERO.p2);
    expect(UNSYS_STANDARD_SHARE_DESCRIPTION).toMatch(/hard-domain learning experiences/);
    expect(UNSYS_STANDARD_SHARE_DESCRIPTION).toMatch(/where experts are scarce/);
    expect(UNSYS_STANDARD_SHARE_DESCRIPTION).not.toContain("Learning Harness");
    expect(UNSYS_STANDARD_SHARE_DESCRIPTION).not.toContain("Knowledge Verification");
    expect(UNSYS_STANDARD_SHARE_DESCRIPTION).not.toMatch(/Human Knowledge Platform/);
    expect(UNSYS_STANDARD_SHARE_DESCRIPTION.length).toBeGreaterThanOrEqual(120);
    expect(UNSYS_STANDARD_SHARE_DESCRIPTION.length).toBeLessThanOrEqual(160);
    expect(UNSYS_STANDARD_SHARE_DESCRIPTION.length).toBeLessThanOrEqual(200);
    const lp = readRel("app/page.tsx");
    expect(lp).toContain("{PLATFORM_HERO.h1}");
    expect(lp).toContain("{PLATFORM_HERO.p1}");
    expect(lp).toContain("{PLATFORM_HERO.p2}");
    const standard = readRel("lib/og/standard.ts");
    expect(standard).toContain("PLATFORM_HERO.h1");
    expect(standard).not.toContain("Beyond benchmarks for AI. Beyond tests for humans.");
    expect(standard).not.toContain("three verticals for human and agentic learning");
    expect(standard).toContain("hard-domain learning experiences");
    expect(standard).not.toContain("Human Knowledge Platform");
  });

  it("root HTML, OG, Twitter, JSON-LD, and manifest share the LP hero (not old efficiency copy)", () => {
    const rootHtml = unsysRootHtmlMetadata();
    expect(rootHtml.title.default).toBe(UNSYS_STANDARD_HTML_TITLE);
    expect(rootHtml.title.default).toMatch(/hard-domain learning experiences/i);
    expect(rootHtml.title.default).not.toMatch(/Human Knowledge Platform/);
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
    expect(layout).toContain("hard-domain learning experiences");
    expect(layout).not.toContain("Human Knowledge Platform");

    const manifestSrc = readRel("app/manifest.ts");
    expect(manifestSrc).toContain("UNSYS_STANDARD_SHARE_DESCRIPTION");
    expect(manifestSrc).not.toContain("Learning efficiency for humans and agents");

    const standard = readRel("lib/og/standard.ts");
    expect(standard).not.toContain("Learning Efficiency for Humans & Agents");
    expect(standard).not.toContain("Optimize learning efficiency for humans and agentic systems");

    const en = JSON.parse(readRel("messages/en.json")) as { footer: { seoBlurb: string } };
    expect(en.footer.seoBlurb).toMatch(/hard-domain learning experiences/i);
    expect(en.footer.seoBlurb).toMatch(/where experts are scarce/);
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
