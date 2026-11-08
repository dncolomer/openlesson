/**
 * Science-page Free Energy Principle + reducing-uncertainty copy.
 * Drives the shipped content module and /science page source (not re-implemented prose).
 */
import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  SCIENCE_FEP_COPY,
  SCIENCE_FEP_TERMS,
  getScienceFepFullText,
} from "@/lib/science/free-energy-principle-copy";

const ROOT = join(__dirname, "../..");

function read(rel: string): string {
  return readFileSync(join(ROOT, rel), "utf8");
}

describe("science FEP copy content", () => {
  it("ships Free Energy Principle, reducing uncertainty, and the Uncertain Systems name", () => {
    const full = getScienceFepFullText(SCIENCE_FEP_COPY);
    for (const term of SCIENCE_FEP_TERMS) {
      expect(full.toLowerCase(), term).toContain(term.toLowerCase());
    }
    expect(full).toContain("Free Energy Principle");
    expect(full.toLowerCase()).toMatch(/reducing uncertainty/);
    expect(full).toContain("Uncertain Systems");
    expect(SCIENCE_FEP_COPY.title.toLowerCase()).toBe("learning is reducing uncertainty.");
    expect(SCIENCE_FEP_COPY.name).toMatch(/named Uncertain Systems/);
    expect(SCIENCE_FEP_COPY.influence.toLowerCase()).toMatch(/heavily influenced/);
  });

  it("frames FEP as influence, not identity or completed experiments", () => {
    const full = getScienceFepFullText().toLowerCase();
    expect(full).toMatch(/influence/);
    expect(full).toMatch(/variational free energy/);
    expect(full).toMatch(/upper bound on surprise/);
    expect(full).toMatch(/prediction error/);
    expect(SCIENCE_FEP_COPY.caveat.toLowerCase()).toMatch(/do not claim/);
    expect(SCIENCE_FEP_COPY.caveat.toLowerCase()).toMatch(/full formal theory/);
    expect(SCIENCE_FEP_COPY.caveat.toLowerCase()).toMatch(/completed fep empirical results/);
    expect(full).not.toMatch(/uncertain systems is the free energy principle/);
    expect(full).not.toMatch(/we have (completed|validated) fep experiments/);
  });
});

describe("science page renders FEP copy", () => {
  it("imports and renders the shipped FEP module on /science", () => {
    const pagePath = join(ROOT, "app/science/page.tsx");
    expect(existsSync(pagePath)).toBe(true);
    const src = read("app/science/page.tsx");

    expect(src).toContain("SCIENCE_FEP_COPY");
    expect(src).toContain("free-energy-principle-copy");
    expect(src).toContain("data-science-free-energy");
    expect(src).toContain("SCIENCE_FEP_COPY.title");
    expect(src).toContain("SCIENCE_FEP_COPY.influence");
    expect(src).toContain("SCIENCE_FEP_COPY.name");
    expect(src).toContain("SCIENCE_FEP_COPY.caveat");

    const whyAt = src.indexOf("data-science-why");
    const fepAt = src.indexOf("data-science-free-energy");
    const tomographyAt = src.indexOf("data-vision-tomography-induction");
    expect(whyAt).toBeGreaterThan(-1);
    expect(fepAt).toBeGreaterThan(-1);
    expect(tomographyAt).toBeGreaterThan(-1);
    expect(whyAt).toBeLessThan(fepAt);
    expect(fepAt).toBeLessThan(tomographyAt);
    expect(src).not.toContain("science-thesis-slide");
  });

  it("does not ship Methods, planned experiments, or paper pages", () => {
    const src = read("app/science/page.tsx");
    expect(src).not.toContain("KNOWLEDGE_TOMOGRAPHY_WHITEPAPER_PATH");
    expect(src).not.toContain("TAP_WHITEPAPER_PATH");
    expect(src).not.toContain("data-science-research");
    expect(src).not.toContain("data-science-research-link");
    expect(src).not.toMatch(/Methods|&amp; planned experiments|planned experiments/i);
  });
});
