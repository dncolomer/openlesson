/**
 * Science-page epistemic foraging copy + further reading.
 * Drives the shipped content module and /science page source (not re-implemented prose).
 */
import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  FRISTON_EPISTEMIC_VALUE_CITATION,
  SCIENCE_EPISTEMIC_FORAGING_COPY,
  SCIENCE_EPISTEMIC_FORAGING_PATH,
  SCIENCE_EPISTEMIC_FORAGING_READINGS,
  SCIENCE_EPISTEMIC_FORAGING_TERMS,
  getScienceEpistemicForagingFullText,
} from "@/lib/science/epistemic-foraging-copy";
import { getVisionTomographyInductionFullText } from "@/lib/vision/knowledge-tomography-induction-copy";
import { THESIS_EPISTEMIC_POLICY } from "@/lib/sales/thesis-science-snippet";
import { getPlatformPitchSlide, PLATFORM_THESIS_SLIDE_INDEX } from "@/lib/sales/platform-pitch-deck";

const ROOT = join(__dirname, "../..");

function read(rel: string): string {
  return readFileSync(join(ROOT, rel), "utf8");
}

describe("science epistemic foraging copy content", () => {
  it("ships epistemic foraging, uncertainty, rewards, Friston, and product mapping terms", () => {
    const full = getScienceEpistemicForagingFullText(SCIENCE_EPISTEMIC_FORAGING_COPY);
    for (const term of SCIENCE_EPISTEMIC_FORAGING_TERMS) {
      expect(full.toLowerCase(), term).toContain(term.toLowerCase());
    }
    expect(full).toContain("Epistemic foraging");
    expect(full.toLowerCase()).toMatch(/uncertainty/);
    expect(full.toLowerCase()).toMatch(/rewards/);
    expect(full).toMatch(/Friston/);
    expect(full).toContain("Think Aloud Protocol");
    expect(full).toContain("Proof of Work");
    expect(SCIENCE_EPISTEMIC_FORAGING_COPY.title.toLowerCase()).toBe(
      "foraging for information, not chasing scores.",
    );
    expect(SCIENCE_EPISTEMIC_FORAGING_COPY.definition.toLowerCase()).toMatch(
      /active search for information/,
    );
    expect(SCIENCE_EPISTEMIC_FORAGING_COPY.definition.toLowerCase()).toMatch(
      /rather than immediately chasing rewards/,
    );
  });

  it("frames foraging as influence, not identity or completed experiments", () => {
    const full = getScienceEpistemicForagingFullText().toLowerCase();
    expect(full).toMatch(/influence/);
    expect(full).toMatch(/active inference|active-inference/);
    expect(SCIENCE_EPISTEMIC_FORAGING_COPY.caveat.toLowerCase()).toMatch(/do not claim/);
    expect(SCIENCE_EPISTEMIC_FORAGING_COPY.caveat.toLowerCase()).toMatch(/full formal theory/);
    expect(SCIENCE_EPISTEMIC_FORAGING_COPY.caveat.toLowerCase()).toMatch(
      /completed active-inference empirical results/,
    );
    expect(full).not.toMatch(/uncertain systems is (the )?free energy principle/);
    expect(full).not.toMatch(/we have (completed|validated) (fep|active-inference) experiments/);
  });

  it("states the policy affirmatively, without literature disclaimers", () => {
    const full = getScienceEpistemicForagingFullText();
    expect(full.toLowerCase()).toMatch(/active search for information/);
    expect(full.toLowerCase()).toMatch(/think aloud protocol/);
    expect(full.toLowerCase()).toMatch(/proof of work/);
    expect(full).not.toMatch(/Pirolli/);
    expect(full).not.toMatch(/Information Foraging/);
    expect(full).not.toMatch(/This is not/);
    expect(full).not.toMatch(/we refuse/);
    expect(SCIENCE_EPISTEMIC_FORAGING_COPY).not.toHaveProperty("distinction");
  });

  it("ships a short Friston / active-inference reading list", () => {
    expect(SCIENCE_EPISTEMIC_FORAGING_READINGS).toHaveLength(5);
    const corpus = SCIENCE_EPISTEMIC_FORAGING_READINGS.map((r) =>
      [r.authors, r.year, r.title, r.venue, r.href, r.why].join(" "),
    )
      .join("\n")
      .toLowerCase();
    expect(corpus).toMatch(/friston/);
    expect(corpus).toMatch(/epistemic/);
    expect(corpus).toMatch(/active inference/);
    expect(corpus).toContain("2015");
    expect(corpus).toContain("2017");
    expect(corpus).toContain("2010");
    expect(SCIENCE_EPISTEMIC_FORAGING_READINGS[0]?.title.toLowerCase()).toMatch(
      /active inference and epistemic value/,
    );
    for (const reading of SCIENCE_EPISTEMIC_FORAGING_READINGS) {
      expect(reading.href).toMatch(/^https:\/\//);
      expect(reading.why.trim().length).toBeGreaterThan(20);
    }
    expect(FRISTON_EPISTEMIC_VALUE_CITATION).toMatch(/Friston/);
    expect(FRISTON_EPISTEMIC_VALUE_CITATION).toMatch(/2015/);
    expect(FRISTON_EPISTEMIC_VALUE_CITATION).toMatch(/epistemic value/);
  });
});

describe("science page renders epistemic foraging copy", () => {
  it("imports and renders the shipped foraging module on /science after FEP", () => {
    const pagePath = join(ROOT, "app/science/page.tsx");
    expect(existsSync(pagePath)).toBe(true);
    const src = read("app/science/page.tsx");

    expect(src).toContain("SCIENCE_EPISTEMIC_FORAGING_COPY");
    expect(src).toContain("SCIENCE_EPISTEMIC_FORAGING_READINGS");
    expect(src).toContain("epistemic-foraging-copy");
    expect(src).toContain("data-science-epistemic-foraging");
    expect(src).toContain("SCIENCE_EPISTEMIC_FORAGING_COPY.title");
    expect(src).toContain("SCIENCE_EPISTEMIC_FORAGING_COPY.definition");
    expect(src).toContain("SCIENCE_EPISTEMIC_FORAGING_COPY.platform");
    expect(src).toContain("SCIENCE_EPISTEMIC_FORAGING_COPY.caveat");
    expect(src).not.toContain("SCIENCE_EPISTEMIC_FORAGING_COPY.distinction");
    expect(src).toContain("data-science-epistemic-foraging-readings");

    const thesisAt = src.indexOf("science-thesis-slide");
    const fepAt = src.indexOf("data-science-free-energy");
    const foragingAt = src.indexOf("data-science-epistemic-foraging");
    const principlesAt = src.indexOf("PRINCIPLES.map");
    expect(thesisAt).toBeGreaterThan(-1);
    expect(fepAt).toBeGreaterThan(-1);
    expect(foragingAt).toBeGreaterThan(-1);
    expect(principlesAt).toBeGreaterThan(-1);
    expect(thesisAt).toBeLessThan(fepAt);
    expect(fepAt).toBeLessThan(foragingAt);
    expect(foragingAt).toBeLessThan(principlesAt);

    expect(src.toLowerCase()).toMatch(/epistemic foraging/);
    expect(SCIENCE_EPISTEMIC_FORAGING_PATH).toBe("/science#science-epistemic-foraging");
  });

  it("science metadata names epistemic foraging", () => {
    const src = read("app/science/page.tsx");
    expect(src).toMatch(/description:\s*"A holistic model of knowledge: epistemic foraging/);
  });
});

describe("landing approach names foraging without rewriting the hero", () => {
  it("verification product approach section names epistemic foraging and links to /science", () => {
    const page = read("app/knowledge-verification/page.tsx");
    expect(page).toContain('id="approach"');
    expect(page).toContain("data-landing-epistemic-foraging");
    expect(page).toMatch(/epistemic foraging/i);
    expect(page).toContain("foragingHref");
    expect(page).not.toContain("Epistemic Foraging Platform");
    const landing = read("app/page.tsx");
    expect(landing).toContain("A Human Knowledge Platform.");
    expect(landing).not.toContain('id="approach"');
  });
});

describe("foraging visitor strings stay affirmative", () => {
  it("science, vision, landing, pitch, and README foraging copy omit Pirolli disclaimers and we-refuse closers", () => {
    const thesis = getPlatformPitchSlide(PLATFORM_THESIS_SLIDE_INDEX);
    const verification = read("app/knowledge-verification/page.tsx");
    const landingForageAt = verification.indexOf("data-landing-epistemic-foraging");
    const landingForage = verification.slice(landingForageAt, landingForageAt + 800);
    const corpus = [
      getScienceEpistemicForagingFullText(),
      getVisionTomographyInductionFullText(),
      landingForage,
      thesis?.highlights?.[1] ?? "",
      THESIS_EPISTEMIC_POLICY,
      read("README.md"),
    ].join("\n");

    expect(corpus).toMatch(/Epistemic foraging/);
    expect(corpus.toLowerCase()).toMatch(/active search for information/);
    expect(corpus).not.toMatch(/Pirolli/);
    expect(corpus).not.toMatch(/Information Foraging/);
    expect(corpus).not.toMatch(/This is not/);
    expect(corpus).not.toMatch(/we refuse/);
  });
});
