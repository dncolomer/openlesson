/**
 * TAP Stash/Submit white paper + science-page research link.
 * Drives shipped content module and page sources (not re-implemented prose).
 */
import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  TAP_STASH_SUBMIT_WHITEPAPER,
  TAP_WHITEPAPER_EXPERIMENT_STEPS,
  TAP_WHITEPAPER_METHOD_TERMS,
  TAP_WHITEPAPER_PATH,
  getTapWhitepaperExperimentText,
  getTapWhitepaperFullText,
} from "@/lib/science/tap-stash-submit-whitepaper";

const ROOT = join(__dirname, "../..");

function read(rel: string): string {
  return readFileSync(join(ROOT, rel), "utf8");
}

describe("TAP Stash/Submit white paper content", () => {
  it("ships method terms in structured paper body", () => {
    const full = getTapWhitepaperFullText(TAP_STASH_SUBMIT_WHITEPAPER);
    for (const term of TAP_WHITEPAPER_METHOD_TERMS) {
      expect(full.toLowerCase(), term).toContain(term.toLowerCase());
    }
    // Academic methods framing, not a product landing CTA deck
    expect(full.toLowerCase()).toMatch(/abstract|method|protocol|planned experiment/);
    expect(TAP_STASH_SUBMIT_WHITEPAPER.sections.some((s) => s.id === "protocol")).toBe(true);
    expect(TAP_STASH_SUBMIT_WHITEPAPER.sections.some((s) => s.id === "pow-data")).toBe(true);
    expect(TAP_STASH_SUBMIT_WHITEPAPER.sections.some((s) => s.id === "planned-experiment")).toBe(
      true,
    );
  });

  it("experiment outline names data gathering, embeddings, and Map of Knowledge regions", () => {
    const experiment = getTapWhitepaperExperimentText(TAP_STASH_SUBMIT_WHITEPAPER);
    expect(experiment.length).toBeGreaterThan(200);

    expect(TAP_WHITEPAPER_EXPERIMENT_STEPS).toHaveLength(3);
    expect(TAP_WHITEPAPER_EXPERIMENT_STEPS.map((s) => s.id)).toEqual([
      "data-gathering",
      "embeddings",
      "map-regions",
    ]);

    for (const step of TAP_WHITEPAPER_EXPERIMENT_STEPS) {
      expect(experiment).toContain(step.title);
      expect(experiment.toLowerCase()).toContain(step.summary.slice(0, 40).toLowerCase());
    }

    expect(experiment.toLowerCase()).toMatch(/stash/);
    expect(experiment.toLowerCase()).toMatch(/submit/);
    expect(experiment.toLowerCase()).toMatch(/proof of work|pow/);
    expect(experiment.toLowerCase()).toMatch(/embedding/);
    expect(experiment.toLowerCase()).toMatch(/map of knowledge/);
    expect(experiment.toLowerCase()).toMatch(/high-dimensional|high-dim/);
  });

  it("operational System 1 / System 2 mapping is explicit (stash vs submit)", () => {
    const protocol = TAP_STASH_SUBMIT_WHITEPAPER.sections.find((s) => s.id === "protocol");
    const background = TAP_STASH_SUBMIT_WHITEPAPER.sections.find((s) => s.id === "background");
    const text = [background, protocol]
      .flatMap((s) => s?.paragraphs ?? [])
      .join(" ")
      .toLowerCase();
    expect(text).toMatch(/system 1/);
    expect(text).toMatch(/system 2/);
    expect(text).toMatch(/stash/);
    expect(text).toMatch(/submit/);
    expect(text).toMatch(/operational/);
  });
});

describe("white paper public page and science link", () => {
  it("research page route exists and renders the white paper module", () => {
    const pagePath = join(ROOT, "app/science/think-aloud-protocol/page.tsx");
    expect(existsSync(pagePath)).toBe(true);
    const src = read("app/science/think-aloud-protocol/page.tsx");
    expect(src).toContain("TAP_STASH_SUBMIT_WHITEPAPER");
    expect(src).toContain("ScienceWhitepaperPage");
    expect(src).toContain("TAP_WHITEPAPER_PATH");

    const component = read("components/ScienceWhitepaperPage.tsx");
    expect(component).toContain("data-whitepaper-experiment-steps");
    expect(component).toContain("data-whitepaper-section");
    expect(component).toContain("TAP_WHITEPAPER_EXPERIMENT_STEPS");
  });

  it("science page links to the white paper research path", () => {
    const science = read("app/science/page.tsx");
    expect(science).toContain("TAP_WHITEPAPER_PATH");
    expect(science).toContain("data-science-research-link");
    expect(science).toContain("data-science-research");
    expect(science).toMatch(/href=\{TAP_WHITEPAPER_PATH\}/);
    expect(TAP_WHITEPAPER_PATH).toBe("/science/think-aloud-protocol");
    // Intentional Research section, not only footer
    expect(science).toMatch(/Methods|&amp; planned experiments|planned experiments/i);
  });

  it("path constant matches shipped page file location", () => {
    expect(TAP_WHITEPAPER_PATH).toBe("/science/think-aloud-protocol");
    expect(TAP_STASH_SUBMIT_WHITEPAPER.path).toBe(TAP_WHITEPAPER_PATH);
    expect(existsSync(join(ROOT, "app/science/think-aloud-protocol/page.tsx"))).toBe(true);
  });
});
