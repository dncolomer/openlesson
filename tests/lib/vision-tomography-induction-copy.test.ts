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
import { SCIENCE_HUB_COPY, scienceHubLeadText } from "@/lib/science/hub";

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
  it("combined hub no longer mounts the tomography chapter", () => {
    const pagePath = join(ROOT, "app/science/page.tsx");
    expect(existsSync(pagePath)).toBe(true);
    const src = read("app/science/page.tsx");

    expect(src).not.toContain("VISION_TOMOGRAPHY_INDUCTION_COPY");
    expect(src).not.toContain("data-vision-tomography-induction");
    expect(src).not.toContain("knowledge-tomography-induction-copy");

    expect(src).toContain("SCIENCE_HUB_COPY.title");
    expect(SCIENCE_HUB_COPY.title).toBe("Science");
    expect(scienceHubLeadText()).toMatch(/can't trust answers anymore because AI writes them/);
    expect(scienceHubLeadText()).not.toMatch(/thinking stays yours/);
    expect(SCIENCE_HUB_COPY.workspaceCta).toBe("Open dashboard");
    expect(read("app/vision/page.tsx")).toContain('redirect("/science")');
  });

  it("copy paths still point at /science hashes, not retired paper pages", () => {
    const src = read("app/science/page.tsx");
    expect(src).not.toContain("knowledgeTomographyPaper");
    expect(src).not.toContain("data-vision-knowledge-tomography-paper-link");
    expect(src).toContain("data-science-learning-model-link");

    expect(VISION_TOMOGRAPHY_INDUCTION_PATHS.science).toBe("/science");
    expect(VISION_TOMOGRAPHY_INDUCTION_PATHS.epistemicForaging).toBe(
      "/science#science-epistemic-foraging",
    );
    expect("knowledgeTomographyPaper" in VISION_TOMOGRAPHY_INDUCTION_PATHS).toBe(false);
  });

  it("copy module remains and paper pages are gone", () => {
    expect(existsSync(join(ROOT, "app/science/knowledge-tomography/page.tsx"))).toBe(false);
    expect(existsSync(join(ROOT, "lib/vision/knowledge-tomography-induction-copy.ts"))).toBe(
      true,
    );
  });
});
