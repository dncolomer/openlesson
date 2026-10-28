import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  PITCH_WEB_PATH,
  PITCH_WEB_SECTIONS,
  PITCH_WEB_STAGE,
  parsePitchWebHash,
  pitchWebHash,
} from "@/lib/sales/pitch-web-deck";

const REPO_ROOT = path.resolve(__dirname, "../..");

function read(rel: string): string {
  return fs.readFileSync(path.join(REPO_ROOT, rel), "utf8");
}

describe("pitch-web HTML presenter", () => {
  it("has seven sections matching the live PDF pitch", () => {
    expect(PITCH_WEB_PATH).toBe("/pitch-web");
    expect(PITCH_WEB_SECTIONS).toHaveLength(7);
    expect(PITCH_WEB_SECTIONS.map((s) => s.id)).toEqual([
      "problem",
      "autopilot",
      "free-energy",
      "engine",
      "artifact",
      "gtm",
      "traction",
    ]);
    expect(PITCH_WEB_STAGE).toEqual({ width: 1920, height: 1080 });
  });

  it("parses hash deep-links 1–7", () => {
    expect(parsePitchWebHash("#1")).toBe(0);
    expect(parsePitchWebHash("#7")).toBe(6);
    expect(parsePitchWebHash("#0")).toBeNull();
    expect(parsePitchWebHash("#8")).toBeNull();
    expect(parsePitchWebHash("")).toBeNull();
    expect(pitchWebHash(2)).toBe("#3");
  });

  it("keeps the PDF copy on the HTML slides", () => {
    const slides = read("components/pitch-web/pitch-web-slides.tsx");
    const figures = read("components/pitch-web/pitch-web-figures.tsx");
    const chrome = read("components/pitch-web/pitch-web-chrome.tsx");
    const corpus = `${slides}\n${figures}\n${chrome}\n${PITCH_WEB_SECTIONS.map((s) => s.footer).join("\n")}`;
    expect(corpus).toContain("Frontier fields");
    expect(corpus).toContain("We are building the autopilot.");
    expect(corpus).toContain("map of hidden states");
    expect(corpus).toContain("knowledge embedding space");
    expect(corpus).toContain("knowledge region built from your experts");
    expect(corpus).toContain("communities they already belong");
    expect(corpus).toMatch(/The WISER/);
    expect(corpus).toContain("ASML");
    expect(corpus).toContain("HARD SKILLS ARE SCARCE AND HARD TO VERIFY.");
    expect(corpus).toContain("CHEAPEST EDGE = THE POLICY");
    expect(slides).toContain("items-stretch");
    expect(slides).toContain("h-full min-h-0");
  });

  it("ships a noindex /pitch-web page with presenter controls", () => {
    expect(fs.existsSync(path.join(REPO_ROOT, "app/pitch-web/page.tsx"))).toBe(true);
    const page = read("app/pitch-web/page.tsx");
    expect(page).toContain("index: false");
    expect(page).toContain("PitchWebDeck");
    const deck = read("components/pitch-web/pitch-web-deck.tsx");
    expect(deck).toContain("ArrowRight");
    expect(deck).toContain("requestFullscreen");
    expect(deck).toContain("data-pitch-web");
    expect(deck).toContain("PitchWebProblemSlide");
    expect(deck).toContain("PitchWebTractionSlide");
    const slidesBlock = deck.slice(deck.indexOf("const SLIDES"), deck.indexOf("] as const"));
    const order = [
      "PitchWebProblemSlide",
      "PitchWebAutopilotSlide",
      "PitchWebFreeEnergySlide",
      "PitchWebEngineSlide",
      "PitchWebArtifactSlide",
      "PitchWebGtmSlide",
      "PitchWebTractionSlide",
    ];
    const indexes = order.map((name) => slidesBlock.indexOf(name));
    expect(indexes.every((i) => i >= 0)).toBe(true);
    expect([...indexes].sort((a, b) => a - b)).toEqual(indexes);
  });

  it("stays subscription-exempt via the /pitch prefix", () => {
    const middleware = read("middleware.ts");
    expect(middleware).toContain('"/pitch"');
    expect(PITCH_WEB_PATH.startsWith("/pitch")).toBe(true);
  });
});
