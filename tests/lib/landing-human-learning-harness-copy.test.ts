/**
 * Landing hero + sales-path copy: Human Learning Harness, no agentic verification.
 * Drives shipped modules and sources (page, pillar data, OG standard, sales decks).
 */
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  HERO_PILLAR_PAGES,
  LEARNING_AUGMENTATION_PAGE,
  LEARNING_OPTIMIZATION_PAGE,
  LEARNING_VERIFICATION_PAGE,
} from "@/lib/seo/use-case-page";
import {
  UNSYS_STANDARD_SHARE_DESCRIPTION,
  UNSYS_STANDARD_SHARE_TITLE,
} from "@/lib/og/standard";
import { inventoryDeck } from "@/lib/sales/pitch-content-inventory";
import { PLATFORM_PITCH_DECK } from "@/lib/sales/platform-pitch-deck";
import { VERIFICATION_PITCH_DECK } from "@/lib/sales/verification-pitch-deck";

const REPO_ROOT = path.resolve(__dirname, "../..");

const H1_LINE_1 = "A Human Learning Harness.";
const H1_LINE_2 = "Learn without a tutor. Verify without a test.";
const P1 =
  "Uncertain Systems is a Human Learning Harness for knowledge acquisition and knowledge verification.";
const P2 =
  "Verify knowledge without a test — uncheatable proof that it is actually held. Optimize so people learn faster without a tutor. Our system helps you optimally outsource your knowledge without giving up on your learning.";

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

describe("landing Human Learning Harness copy", () => {
  it("ships the agreed hero H1, P1, and P2 on the public landing page", () => {
    const lp = readRel("app/page.tsx");
    const lpFlat = lp.replace(/\s+/g, " ");
    expect(lp).toContain(H1_LINE_1);
    expect(lp).toContain(H1_LINE_2);
    expect(lp).toContain(P1);
    expect(lpFlat).toContain(P2);
    expect(lp).not.toContain("Beyond benchmarks for AI.");
    expect(lp).not.toContain("Beyond tests for humans.");
    expect(lp).not.toContain("three verticals for human and agentic learning");
    expect(lp).not.toMatch(/\bagents?\b/i);
    expect(lp).not.toMatch(/agentic/i);
    expect(lp).toContain("VERIFICATION . OPTIMIZATION . AUGMENTATION");
  });

  it("keeps pillar titles and ships the agreed box bullets from HERO_PILLAR_PAGES", () => {
    expect(HERO_PILLAR_PAGES).toHaveLength(3);
    expect(LEARNING_VERIFICATION_PAGE.titleLines).toEqual(["Learning", "Verification"]);
    expect(LEARNING_OPTIMIZATION_PAGE.titleLines).toEqual(["Learning", "optimization"]);
    expect(LEARNING_AUGMENTATION_PAGE.titleLines).toEqual(["Learning", "Augmentation"]);
    expect(LEARNING_VERIFICATION_PAGE.cardSummary).toEqual([
      "Human Knowledge / Skill Validation which cannot be faked with AI",
    ]);
    expect(LEARNING_OPTIMIZATION_PAGE.cardSummary).toEqual([
      "You don't need an AI tutor, you need a system, a learning harness",
    ]);
    expect(LEARNING_AUGMENTATION_PAGE.cardSummary).toEqual([
      "Outsource your knowledge but don't outsource your learning",
    ]);
    expect(HERO_PILLAR_PAGES.map((p) => p.cardSummary)).toEqual([
      LEARNING_VERIFICATION_PAGE.cardSummary,
      LEARNING_OPTIMIZATION_PAGE.cardSummary,
      LEARNING_AUGMENTATION_PAGE.cardSummary,
    ]);
  });

  it("contracts OG title to H1 and OG description to P1", () => {
    expect(UNSYS_STANDARD_SHARE_TITLE).toBe(`${H1_LINE_1} ${H1_LINE_2}`);
    expect(UNSYS_STANDARD_SHARE_DESCRIPTION).toBe(P1);
    const lp = readRel("app/page.tsx");
    expect(lp).toContain(H1_LINE_1);
    expect(lp).toContain(H1_LINE_2);
    expect(lp).toContain(UNSYS_STANDARD_SHARE_DESCRIPTION);
    const standard = readRel("lib/og/standard.ts");
    expect(standard).not.toContain("Beyond benchmarks for AI. Beyond tests for humans.");
    expect(standard).not.toContain("three verticals for human and agentic learning");
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
