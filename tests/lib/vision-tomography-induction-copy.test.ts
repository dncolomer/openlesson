/**
 * Vision page knowledge tomography + induction copy.
 * Drives shipped content module and page source (not re-implemented prose).
 */
import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  VISION_TOMOGRAPHY_INDUCTION_COPY,
  VISION_TOMOGRAPHY_INDUCTION_PATHS,
  VISION_TOMOGRAPHY_INDUCTION_TERMS,
  getVisionTomographyInductionFullText,
} from "@/lib/vision/knowledge-tomography-induction-copy";
import { KNOWLEDGE_TOMOGRAPHY_WHITEPAPER_PATH } from "@/lib/science/knowledge-tomography-whitepaper";

const ROOT = join(__dirname, "../..");

function read(rel: string): string {
  return readFileSync(join(ROOT, rel), "utf8");
}

describe("vision tomography + induction copy content", () => {
  it("ships required definitional terms in structured vision copy", () => {
    const full = getVisionTomographyInductionFullText(VISION_TOMOGRAPHY_INDUCTION_COPY);
    for (const term of VISION_TOMOGRAPHY_INDUCTION_TERMS) {
      expect(full.toLowerCase(), term).toContain(term.toLowerCase());
    }
    expect(full.toLowerCase()).toMatch(/knowledge tomography/);
    expect(full.toLowerCase()).toMatch(/reproduce/);
    expect(full.toLowerCase()).toMatch(/state of knowledge/);
    expect(full.toLowerCase()).toMatch(/human/);
    expect(full.toLowerCase()).toMatch(/agentic/);
    expect(full.toLowerCase()).toMatch(/knowledge induction/);
    expect(full.toLowerCase()).toMatch(/epistemic foraging/);
  });

  it("distinguishes tomography (measure) from induction (transform / long-horizon aim)", () => {
    const full = getVisionTomographyInductionFullText().toLowerCase();
    expect(full).toMatch(/measur/);
    expect(full).toMatch(/transform|long-horizon|longer-horizon/);
    expect(VISION_TOMOGRAPHY_INDUCTION_COPY.tomography.body.toLowerCase()).toMatch(
      /reproduce.*state of knowledge|state of knowledge/,
    );
    expect(VISION_TOMOGRAPHY_INDUCTION_COPY.tomography.body.toLowerCase()).toMatch(/human/);
    expect(VISION_TOMOGRAPHY_INDUCTION_COPY.tomography.body.toLowerCase()).toMatch(/agentic/);
    expect(VISION_TOMOGRAPHY_INDUCTION_COPY.induction.body.toLowerCase()).toMatch(
      /knowledge induction/,
    );
    expect(VISION_TOMOGRAPHY_INDUCTION_COPY.distinction.toLowerCase()).toMatch(
      /tomography.*induction|induction.*tomography/,
    );
    // Not synonyms: measurement vs transformation framing both present as separate cards
    expect(VISION_TOMOGRAPHY_INDUCTION_COPY.tomography.title.toLowerCase()).toContain(
      "knowledge tomography",
    );
    expect(VISION_TOMOGRAPHY_INDUCTION_COPY.induction.title.toLowerCase()).toMatch(
      /knowledge induction/,
    );
    expect(VISION_TOMOGRAPHY_INDUCTION_COPY.tomography.title).not.toEqual(
      VISION_TOMOGRAPHY_INDUCTION_COPY.induction.title,
    );
    expect(VISION_TOMOGRAPHY_INDUCTION_COPY.policy.title.toLowerCase()).toBe("epistemic foraging");
    expect(VISION_TOMOGRAPHY_INDUCTION_COPY.policy.body.toLowerCase()).toMatch(/friston/);
    expect(VISION_TOMOGRAPHY_INDUCTION_COPY.lead.toLowerCase()).toMatch(/epistemic foraging/);
  });
});

describe("vision page renders tomography + induction block", () => {
  it("vision page imports and renders the shipped copy module", () => {
    const pagePath = join(ROOT, "app/vision/page.tsx");
    expect(existsSync(pagePath)).toBe(true);
    const src = read("app/vision/page.tsx");

    expect(src).toContain("VISION_TOMOGRAPHY_INDUCTION_COPY");
    expect(src).toContain("VISION_TOMOGRAPHY_INDUCTION_PATHS");
    expect(src).toContain("data-vision-tomography-induction");
    expect(src).toContain("data-vision-epistemic-foraging");
    expect(src).toContain("knowledge-tomography-induction-copy");

    // Existing vision entry surface remains
    expect(src).toContain("Automating Human Learning");
    expect(src).toContain("Create your Workspace");
    expect(src).toContain('href="/science"');
  });

  it("links to science and knowledge tomography paper paths", () => {
    const src = read("app/vision/page.tsx");
    expect(src).toContain("VISION_TOMOGRAPHY_INDUCTION_PATHS.science");
    expect(src).toContain("VISION_TOMOGRAPHY_INDUCTION_PATHS.epistemicForaging");
    expect(src).toContain("VISION_TOMOGRAPHY_INDUCTION_PATHS.knowledgeTomographyPaper");
    expect(src).toContain("data-vision-science-link");
    expect(src).toContain("data-vision-epistemic-foraging-link");
    expect(src).toContain("data-vision-knowledge-tomography-paper-link");

    expect(VISION_TOMOGRAPHY_INDUCTION_PATHS.science).toBe("/science");
    expect(VISION_TOMOGRAPHY_INDUCTION_PATHS.epistemicForaging).toBe(
      "/science#science-epistemic-foraging",
    );
    expect(VISION_TOMOGRAPHY_INDUCTION_PATHS.knowledgeTomographyPaper).toBe(
      KNOWLEDGE_TOMOGRAPHY_WHITEPAPER_PATH,
    );
    expect(KNOWLEDGE_TOMOGRAPHY_WHITEPAPER_PATH).toBe("/science/knowledge-tomography");
  });

  it("copy module path constants match paper route source", () => {
    expect(existsSync(join(ROOT, "app/science/knowledge-tomography/page.tsx"))).toBe(true);
    expect(existsSync(join(ROOT, "lib/vision/knowledge-tomography-induction-copy.ts"))).toBe(
      true,
    );
  });
});
