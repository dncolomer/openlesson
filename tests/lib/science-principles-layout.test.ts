/**
 * /science no longer ships the numbered 01–04 principle cells.
 * Reads the shipped page source.
 */
import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(__dirname, "../..");

describe("science principles layout", () => {
  it("does not render numbered principle cells or their stills", () => {
    const src = readFileSync(join(ROOT, "app/science/page.tsx"), "utf8");
    expect(src).not.toContain("const PRINCIPLES");
    expect(src).not.toContain("PRINCIPLES.map");
    expect(src).not.toContain("Knowledge Configuration");
    expect(src).not.toContain("Non-Invasive Path");
    expect(src).not.toContain("principle-configuration-blueprint.jpg");
    expect(src).not.toContain("principle-proximity-blueprint.jpg");
    expect(src).not.toContain("principle-transformation-blueprint.jpg");
    expect(src).not.toContain("principle-noninvasive-blueprint.jpg");
    expect(src).toContain("data-vision-tomography-induction");
    expect(src).not.toContain("data-science-research");

    for (const still of [
      "principle-configuration-blueprint.jpg",
      "principle-proximity-blueprint.jpg",
      "principle-transformation-blueprint.jpg",
      "principle-noninvasive-blueprint.jpg",
    ]) {
      expect(existsSync(join(ROOT, "public/lp-boxes", still)), still).toBe(false);
    }
  });
});
