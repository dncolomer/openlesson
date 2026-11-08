/**
 * Extended /science copy: enhancement approaches, symbiosis, software vs horizon.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  SCIENCE_HUB_COPY,
  SCIENCE_HUB_DIRECTORY,
  scienceHubLeadText,
} from "@/lib/science/hub";
import { getScienceFepFullText } from "@/lib/science/free-energy-principle-copy";
import {
  SCIENCE_EPISTEMIC_FORAGING_COPY,
  SCIENCE_PAGE_READINGS,
  getScienceEpistemicForagingFullText,
} from "@/lib/science/epistemic-foraging-copy";
import { getVisionTomographyInductionFullText } from "@/lib/vision/knowledge-tomography-induction-copy";
import {
  SCIENCE_ENHANCEMENT_COPY,
  getScienceEnhancementFullText,
} from "@/lib/science/cognitive-enhancement-copy";
import {
  SCIENCE_HORIZON_COPY,
  SCIENCE_SYMBIOSIS_COPY,
  getScienceHorizonFullText,
  getScienceSymbiosisFullText,
} from "@/lib/science/symbiosis-and-horizon-copy";

const ROOT = join(__dirname, "../..");

function read(rel: string): string {
  return readFileSync(join(ROOT, rel), "utf8");
}

function scienceVisitorText(): string {
  return [
    scienceHubLeadText(),
    SCIENCE_HUB_COPY.description,
    SCIENCE_HUB_COPY.whyTitle,
    SCIENCE_HUB_COPY.whyP1,
    SCIENCE_HUB_COPY.whyP2,
    SCIENCE_HUB_COPY.whyP3,
    SCIENCE_HUB_COPY.whyProof,
    SCIENCE_HUB_COPY.whyContexts,
    getScienceFepFullText(),
    getScienceEpistemicForagingFullText(),
    getVisionTomographyInductionFullText(),
    getScienceEnhancementFullText(),
    getScienceSymbiosisFullText(),
    getScienceHorizonFullText(),
  ].join("\n");
}

describe("science hub opening and why", () => {
  it("distinguishes vision from current software and drops the rejected slogan", () => {
    const lead = scienceHubLeadText();
    expect(lead).toMatch(/autopilot for knowledge building/);
    expect(lead).toMatch(/Today's software is narrower/);
    expect(lead).toMatch(/research horizon/);
    expect(lead).not.toMatch(/thinking stays yours/i);
    expect(lead).not.toMatch(/exploration is guided/i);
    expect(SCIENCE_HUB_COPY.description).toMatch(/epistemic foraging/);
    expect(SCIENCE_HUB_COPY.whyTitle.toLowerCase()).toBe("why human understanding matters");
    expect(SCIENCE_HUB_COPY.whyP2.toLowerCase()).toMatch(/understanding gap/);
    expect(SCIENCE_HUB_COPY.whyP2).not.toMatch(/nearly flat line/);
    expect(SCIENCE_HUB_COPY.whyProof.toLowerCase()).toMatch(/human interpretability/);
    expect(SCIENCE_HUB_COPY.whyProof.toLowerCase()).toMatch(/question and use the work/);
    expect(SCIENCE_HUB_COPY.whyProof.toLowerCase()).toMatch(
      /distinct from mechanistic interpretability/,
    );
  });
});

describe("science FEP and tomography caveats", () => {
  it("treats variational free energy as a modelling quantity", () => {
    const fep = getScienceFepFullText().toLowerCase();
    expect(fep).toMatch(/formal modelling quantity/);
    expect(fep).toMatch(/reveal unknowns/);
    expect(fep).not.toMatch(/thinking stays yours/);
    expect(getVisionTomographyInductionFullText().toLowerCase()).not.toMatch(
      /burn proportionally more energy/,
    );
    expect(getVisionTomographyInductionFullText().toLowerCase()).not.toMatch(
      /thinking stays yours/,
    );
    expect(SCIENCE_EPISTEMIC_FORAGING_COPY.platform).not.toMatch(/thinking stays yours/);
  });
});

describe("cognitive enhancement headings and taxonomy", () => {
  it("ships the three approved headings and Dresler taxonomy attribution", () => {
    const full = getScienceEnhancementFullText();
    expect(SCIENCE_ENHANCEMENT_COPY.behavioral.title).toBe("Behavioral cognitive enhancement");
    expect(SCIENCE_ENHANCEMENT_COPY.biochemical.title).toBe("Biochemical cognitive enhancement");
    expect(SCIENCE_ENHANCEMENT_COPY.neural.title).toBe("Neural interfaces and neuromodulation");
    expect(full).toContain("Hacking the Brain: Dimensions of Cognitive Enhancement");
    expect(full).toMatch(/Dresler/);
    expect(full).toMatch(/2019/);
    expect(full.toLowerCase()).toMatch(/biochemical, physical, and behavioral/);
    expect(full.toLowerCase()).toMatch(/narrower, product-relevant adaptation/);
    expect(full.toLowerCase()).toMatch(/physical approaches in the paper are broader/);
    expect(full.toLowerCase()).toMatch(/these three headings are ours/);
    expect(full.toLowerCase()).toMatch(/not a ladder, an intelligence scale, a cost ranking/);
    expect(full.toLowerCase()).toMatch(/possible research direction/);
    expect(full.toLowerCase()).toMatch(/not an uncertain systems service/);
    expect(full.toLowerCase()).not.toMatch(/brain priming/);
  });
});

describe("science page renders the extension", () => {
  it("mounts enhancement, symbiosis, horizon, and references after tomography", () => {
    const src = read("app/science/page.tsx");
    const whyAt = src.indexOf("data-science-why");
    const tomographyAt = src.indexOf("data-vision-tomography-induction");
    const enhancementAt = src.indexOf("data-science-enhancement");
    const symbiosisAt = src.indexOf("data-science-symbiosis");
    const horizonAt = src.indexOf("data-science-horizon");
    const referencesAt = src.indexOf("data-science-references");
    expect(whyAt).toBeGreaterThan(-1);
    expect(tomographyAt).toBeGreaterThan(whyAt);
    expect(enhancementAt).toBeGreaterThan(tomographyAt);
    expect(symbiosisAt).toBeGreaterThan(enhancementAt);
    expect(horizonAt).toBeGreaterThan(symbiosisAt);
    expect(referencesAt).toBeGreaterThan(horizonAt);
    expect(src).toContain("data-science-dresler-link");
    expect(src).toContain("data-science-cinel-link");
    expect(src).toContain("data-science-licklider-link");
    expect(src).not.toContain("/brain-priming");
    expect(src).toContain("SCIENCE_PAGE_READINGS");
    expect(SCIENCE_HUB_DIRECTORY.some((row) => row.href === "#cognitive-enhancement")).toBe(true);
  });

  it("science visitor copy omits em dashes and the rejected slogan", () => {
    const text = scienceVisitorText();
    expect(text).not.toMatch(/\u2014/);
    expect(text).not.toMatch(/thinking stays yours/i);
    expect(text).not.toMatch(/\blanded\b/i);
    expect(SCIENCE_PAGE_READINGS.map((row) => row.id)).toContain("dresler-hacking-the-brain-2019");
    expect(SCIENCE_SYMBIOSIS_COPY.loopLead.toLowerCase()).toMatch(/observe work/);
    expect(SCIENCE_HORIZON_COPY.current.toLowerCase()).toMatch(/solve flow/);
    expect(SCIENCE_HORIZON_COPY.progress.toLowerCase()).toMatch(/subjective workload/);
  });
});
