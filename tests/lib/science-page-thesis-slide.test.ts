import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import {
  getPlatformPitchSlide,
  PLATFORM_PITCH_DECK,
  PLATFORM_THESIS_SLIDE_INDEX,
} from "@/lib/sales/platform-pitch-deck";

const root = join(__dirname, "../..");

describe("science page embeds platform pitch slide 10", () => {
  it("getPlatformPitchSlide(10) returns the thesis statement slide", () => {
    const slide = getPlatformPitchSlide(PLATFORM_THESIS_SLIDE_INDEX);
    expect(slide).not.toBeNull();
    expect(slide!.layout).toBe("statement");
    expect(slide!.kicker).toMatch(/thesis/i);
    expect(slide!.title).toMatch(/measurement system/i);
    expect(slide!.highlights?.[0]).toMatch(/mathematical space|configuration|proxy/i);
    expect(slide!.highlightImages?.[0]).toBe("/flywire.png");
    expect(slide!.cards?.map((c) => c.label)).toEqual([
      "Proof of Work proxy",
      "Configuration space",
      "Distance to “knowing X”",
    ]);
    // Same object as deck index 9 (1-based 10)
    expect(slide).toBe(PLATFORM_PITCH_DECK.slides[9]);
  });

  it("getPlatformPitchSlide rejects out-of-range indexes", () => {
    expect(getPlatformPitchSlide(0)).toBeNull();
    expect(getPlatformPitchSlide(-1)).toBeNull();
    expect(getPlatformPitchSlide(PLATFORM_PITCH_DECK.slides.length + 1)).toBeNull();
  });

  it("science page source renders slide 10 at the top of content", () => {
    const pagePath = join(root, "app/science/page.tsx");
    expect(existsSync(pagePath)).toBe(true);
    const src = readFileSync(pagePath, "utf8");
    expect(src).toContain("getPlatformPitchSlide");
    expect(src).toContain("PLATFORM_THESIS_SLIDE_INDEX");
    expect(src).toContain("data-science-pitch-slide");
    expect(src).toContain("science-thesis-slide");

    // Thesis block appears before principles 01–04 body section
    const thesisAt = src.indexOf("science-thesis-slide");
    const principlesAt = src.indexOf("PRINCIPLES.map");
    expect(thesisAt).toBeGreaterThan(-1);
    expect(principlesAt).toBeGreaterThan(-1);
    expect(thesisAt).toBeLessThan(principlesAt);

    // Drives real slide data — not a hard-coded reimplementation of title
    const slide = getPlatformPitchSlide(10)!;
    expect(src).toContain("thesisSlide.title");
    expect(src).toContain("thesisSlide.highlights");
    expect(src).toContain("thesisSlide.cards");
    expect(slide.title.length).toBeGreaterThan(20);
  });

  it("thesis slide public assets exist", () => {
    const slide = getPlatformPitchSlide(10)!;
    for (const asset of [
      ...(slide.highlightImages ?? []),
      ...(slide.cards ?? []).map((c) => c.image).filter(Boolean),
    ] as string[]) {
      const abs = join(root, "public", asset.replace(/^\//, ""));
      expect(existsSync(abs), `missing ${asset}`).toBe(true);
    }
  });
});
