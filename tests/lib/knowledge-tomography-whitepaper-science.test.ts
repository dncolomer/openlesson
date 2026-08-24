/**
 * Knowledge tomography white paper + science-page research link.
 * Drives shipped content module and page sources (not re-implemented prose).
 */
import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  KNOWLEDGE_TOMOGRAPHY_METHOD_TERMS,
  KNOWLEDGE_TOMOGRAPHY_STUDY_STEPS,
  KNOWLEDGE_TOMOGRAPHY_WHITEPAPER,
  KNOWLEDGE_TOMOGRAPHY_WHITEPAPER_PATH,
  getKnowledgeTomographyFullText,
  getKnowledgeTomographyStudyText,
} from "@/lib/science/knowledge-tomography-whitepaper";

const ROOT = join(__dirname, "../..");

function read(rel: string): string {
  return readFileSync(join(ROOT, rel), "utf8");
}

describe("Knowledge tomography white paper content", () => {
  it("ships definitional terms in structured paper body", () => {
    const full = getKnowledgeTomographyFullText(KNOWLEDGE_TOMOGRAPHY_WHITEPAPER);
    for (const term of KNOWLEDGE_TOMOGRAPHY_METHOD_TERMS) {
      expect(full.toLowerCase(), term).toContain(term.toLowerCase());
    }
    // Core framing: reproduce state of knowledge; human + agentic; induction goal
    expect(full.toLowerCase()).toMatch(/reproduce.*state of knowledge|state of knowledge.*reproduce/);
    expect(full.toLowerCase()).toMatch(/human/);
    expect(full.toLowerCase()).toMatch(/agentic/);
    expect(full.toLowerCase()).toMatch(/knowledge induction/);
    expect(full.toLowerCase()).toMatch(/knowledge tomography/);
    expect(full.toLowerCase()).toMatch(/abstract|method|planned study|planned experiment/);
    expect(full.toLowerCase()).toMatch(/epistemic actions/);
    expect(full).toMatch(/Friston/);

    expect(KNOWLEDGE_TOMOGRAPHY_WHITEPAPER.sections.some((s) => s.id === "definition")).toBe(true);
    expect(KNOWLEDGE_TOMOGRAPHY_WHITEPAPER.sections.some((s) => s.id === "induction-framing")).toBe(
      true,
    );
    expect(KNOWLEDGE_TOMOGRAPHY_WHITEPAPER.sections.some((s) => s.id === "planned-study")).toBe(
      true,
    );
  });

  it("frames tomography against knowledge induction as the long-horizon aim", () => {
    const induction = KNOWLEDGE_TOMOGRAPHY_WHITEPAPER.sections.find(
      (s) => s.id === "induction-framing",
    );
    expect(induction).toBeTruthy();
    const text = [induction?.heading, ...(induction?.paragraphs ?? []), ...(induction?.bullets ?? [])]
      .join(" ")
      .toLowerCase();
    expect(text).toMatch(/knowledge induction/);
    expect(text).toMatch(/tomograph/);
    expect(text).toMatch(/transform|configuration/);
    expect(text.length).toBeGreaterThan(200);
  });

  it("planned study validates TAP as an initial tomography tool with non-trivial outline", () => {
    const study = getKnowledgeTomographyStudyText(KNOWLEDGE_TOMOGRAPHY_WHITEPAPER);
    expect(study.length).toBeGreaterThan(400);

    expect(study.toLowerCase()).toMatch(/think aloud protocol|tap/);
    expect(study.toLowerCase()).toMatch(/initial tomography tool|tomography tool/);
    expect(study.toLowerCase()).toMatch(/validat/);
    expect(study.toLowerCase()).toMatch(/human/);
    expect(study.toLowerCase()).toMatch(/agentic/);
    expect(study.toLowerCase()).toMatch(/reconstruct/);
    expect(study.toLowerCase()).toMatch(/proof of work|pow|stash|submit/);

    expect(KNOWLEDGE_TOMOGRAPHY_STUDY_STEPS).toHaveLength(3);
    expect(KNOWLEDGE_TOMOGRAPHY_STUDY_STEPS.map((s) => s.id)).toEqual([
      "protocol-instrumentation",
      "reconstruction-validity",
      "agentic-extension",
    ]);

    for (const step of KNOWLEDGE_TOMOGRAPHY_STUDY_STEPS) {
      expect(study).toContain(step.title);
      expect(study.toLowerCase()).toContain(step.summary.slice(0, 40).toLowerCase());
    }

    const planned = KNOWLEDGE_TOMOGRAPHY_WHITEPAPER.sections.find((s) => s.id === "planned-study");
    expect(planned?.subsections?.length ?? 0).toBeGreaterThanOrEqual(3);
  });

  it("definition section states human and agentic reproduce-your-knowledge framing", () => {
    const definition = KNOWLEDGE_TOMOGRAPHY_WHITEPAPER.sections.find((s) => s.id === "definition");
    const text = [definition?.heading, ...(definition?.paragraphs ?? []), ...(definition?.bullets ?? [])]
      .join(" ")
      .toLowerCase();
    expect(text).toMatch(/knowledge tomography/);
    expect(text).toMatch(/reproduce/);
    expect(text).toMatch(/state of knowledge/);
    expect(text).toMatch(/human/);
    expect(text).toMatch(/agentic/);
  });
});

describe("knowledge tomography public page and science link", () => {
  it("research page route exists and renders the white paper module", () => {
    const pagePath = join(ROOT, "app/science/knowledge-tomography/page.tsx");
    expect(existsSync(pagePath)).toBe(true);
    const src = read("app/science/knowledge-tomography/page.tsx");
    expect(src).toContain("KNOWLEDGE_TOMOGRAPHY_WHITEPAPER");
    expect(src).toContain("ScienceWhitepaperPage");
    expect(src).toContain("KNOWLEDGE_TOMOGRAPHY_WHITEPAPER_PATH");

    const component = read("components/ScienceWhitepaperPage.tsx");
    expect(component).toContain("data-whitepaper-experiment-steps");
    expect(component).toContain("data-whitepaper-section");
    expect(component).toContain("experimentSteps");
    expect(component).toContain("planned-study");
  });

  it("science page links to knowledge tomography and keeps TAP white paper link", () => {
    const science = read("app/science/page.tsx");
    expect(science).toContain("KNOWLEDGE_TOMOGRAPHY_WHITEPAPER_PATH");
    expect(science).toContain("TAP_WHITEPAPER_PATH");
    expect(science).toContain("data-science-research-link");
    expect(science).toContain("data-science-research");
    expect(science).toMatch(/href=\{KNOWLEDGE_TOMOGRAPHY_WHITEPAPER_PATH\}/);
    expect(science).toMatch(/href=\{TAP_WHITEPAPER_PATH\}/);
    expect(KNOWLEDGE_TOMOGRAPHY_WHITEPAPER_PATH).toBe("/science/knowledge-tomography");
    expect(science).toMatch(/Methods|&amp; planned experiments|planned experiments/i);
  });

  it("path constant matches shipped page file location", () => {
    expect(KNOWLEDGE_TOMOGRAPHY_WHITEPAPER_PATH).toBe("/science/knowledge-tomography");
    expect(KNOWLEDGE_TOMOGRAPHY_WHITEPAPER.path).toBe(KNOWLEDGE_TOMOGRAPHY_WHITEPAPER_PATH);
    expect(existsSync(join(ROOT, "app/science/knowledge-tomography/page.tsx"))).toBe(true);
  });

  it("sitemap lists the knowledge tomography URL", () => {
    const sitemap = read("app/sitemap.ts");
    expect(sitemap).toContain("/science/knowledge-tomography");
    expect(sitemap).toContain("/science/think-aloud-protocol");
  });
});
