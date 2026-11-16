/**
 * Slim /science hub: dropped tomography, enhancement, symbiosis, horizon, references.
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
    SCIENCE_HUB_COPY.unsysP1,
    SCIENCE_HUB_COPY.unsysP2,
    SCIENCE_HUB_COPY.unsysCallout,
    SCIENCE_HUB_COPY.unsysP3,
    SCIENCE_HUB_COPY.embeddingP1,
    SCIENCE_HUB_COPY.embeddingP2,
    SCIENCE_HUB_COPY.embeddingCallout,
    getScienceFepFullText(),
  ].join("\n");
}

describe("science hub opening and why", () => {
  it("uses the pitch scripture for why answers are no longer enough", () => {
    const lead = scienceHubLeadText();
    expect(lead).toMatch(/can't trust answers anymore because AI writes them/);
    expect(lead).toMatch(/with or without AI in the loop/);
    expect(lead).not.toMatch(/thinking stays yours/i);
    expect(SCIENCE_HUB_COPY.whyTitle.toLowerCase()).toBe("why this matters");
    expect(SCIENCE_HUB_COPY.whyP1).toMatch(/can't trust answers anymore because AI writes them/);
    expect(SCIENCE_HUB_COPY.whyP2.toLowerCase()).toMatch(/understanding has to be shown as work/);
  });
});

describe("science page drops the long vision chapters", () => {
  it("does not mount tomography, enhancement, symbiosis, horizon, or references", () => {
    const src = read("app/science/page.tsx");
    expect(src).toContain("data-science-why");
    expect(src).toContain("data-science-free-energy");
    expect(src).toContain("data-science-unsys-model");
    expect(src).not.toContain("data-vision-tomography-induction");
    expect(src).not.toContain("data-science-enhancement");
    expect(src).not.toContain("data-science-symbiosis");
    expect(src).not.toContain("data-science-horizon");
    expect(src).not.toContain("data-science-references");
    expect(src).not.toContain("/brain-priming");
    expect(src).not.toContain("SCIENCE_PAGE_READINGS");
    expect(SCIENCE_HUB_DIRECTORY.some((row) => row.href === "#cognitive-enhancement")).toBe(
      false,
    );
  });

  it("science visitor copy omits em dashes and the rejected slogan", () => {
    const text = scienceVisitorText();
    expect(text).not.toMatch(/\u2014/);
    expect(text).not.toMatch(/thinking stays yours/i);
    expect(text).not.toMatch(/\blanded\b/i);
  });
});
