/**
 * Landing hero + sales-path copy: Human Knowledge Platform, no agentic verification.
 * Drives shipped modules and sources (page, OG standard, sales decks).
 */
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { PLATFORM_HERO, PLATFORM_PRODUCT_LIST } from "@/lib/marketing/platform";
import {
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

const H1 = "A Human Knowledge Platform.";
const P1 = "Uncertain Systems is a Human Knowledge Platform.";

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

describe("landing Human Knowledge Platform copy", () => {
  it("ships the agreed hero H1 and P1 on the public landing page", () => {
    const lp = readRel("app/page.tsx");
    expect(lp).toContain(H1);
    expect(lp).toContain(P1);
    expect(lp).toContain("Learning Harness");
    expect(lp).toContain("Knowledge Verification");
    expect(lp).toMatch(/cannot be cheated or faked/);
    expect(lp).not.toContain("Beyond benchmarks for AI.");
    expect(lp).not.toContain("Beyond tests for humans.");
    expect(lp).not.toContain("three verticals for human and agentic learning");
    expect(lp).not.toMatch(/\bagents?\b/i);
    expect(lp).not.toMatch(/agentic/i);
    expect(lp).not.toContain("VERIFICATION . OPTIMIZATION . AUGMENTATION");
    expect(PLATFORM_HERO.h1).toBe(H1);
    expect(PLATFORM_HERO.p1).toBe(P1);
    expect(PLATFORM_PRODUCT_LIST).toHaveLength(2);
  });

  it("contracts OG title to H1 and OG description to P1", () => {
    expect(UNSYS_STANDARD_SHARE_TITLE).toBe(H1);
    expect(UNSYS_STANDARD_SHARE_DESCRIPTION).toBe(P1);
    const lp = readRel("app/page.tsx");
    expect(lp).toContain(H1);
    expect(lp).toContain(UNSYS_STANDARD_SHARE_DESCRIPTION);
    const standard = readRel("lib/og/standard.ts");
    expect(standard).not.toContain("Beyond benchmarks for AI. Beyond tests for humans.");
    expect(standard).not.toContain("three verticals for human and agentic learning");
    expect(standard).toContain("Human Knowledge Platform");
  });

  it("root HTML, OG, Twitter, JSON-LD, and manifest share the LP hero (not old efficiency copy)", () => {
    const rootHtml = unsysRootHtmlMetadata();
    expect(rootHtml.title.default).toBe(H1);
    expect(rootHtml.title.default).toBe(UNSYS_STANDARD_SHARE_TITLE);
    expect(rootHtml.description).toBe(P1);
    expect(rootHtml.description).toBe(UNSYS_STANDARD_SHARE_DESCRIPTION);

    const social = standardShareSocialMetadata({ url: "https://uncertain.systems" });
    expect(social.openGraph?.title).toBe(H1);
    expect(social.openGraph?.description).toBe(P1);
    expect(social.twitter?.title).toBe(H1);
    expect(social.twitter?.description).toBe(P1);

    const webManifest = manifest();
    expect(webManifest.description).toBe(P1);

    const layout = readRel("app/layout.tsx");
    expect(layout).toContain("unsysRootHtmlMetadata");
    expect(layout).toContain("title: rootHtml.title");
    expect(layout).toContain("description: rootHtml.description");
    expect(layout).toContain("UNSYS_STANDARD_SHARE_DESCRIPTION");
    expect(layout).toMatch(/openGraph:\s*standardSocial\.openGraph/);
    expect(layout).toMatch(/twitter:\s*standardSocial\.twitter/);
    expect(layout).not.toContain("Learning Efficiency for Humans & Agents");
    expect(layout).not.toContain("Optimize learning efficiency for humans and agentic systems");

    const manifestSrc = readRel("app/manifest.ts");
    expect(manifestSrc).toContain("UNSYS_STANDARD_SHARE_DESCRIPTION");
    expect(manifestSrc).not.toContain("Learning efficiency for humans and agents");

    const standard = readRel("lib/og/standard.ts");
    expect(standard).not.toContain("Learning Efficiency for Humans & Agents");
    expect(standard).not.toContain("Optimize learning efficiency for humans and agentic systems");
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
