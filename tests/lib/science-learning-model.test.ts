import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  SCIENCE_LEARNING_MODEL_COPY,
  SCIENCE_LEARNING_MODEL_PATH,
  SCIENCE_LEARNING_MODEL_TERMS,
  getScienceLearningModelFullText,
} from "@/lib/science/learning-model-copy";

const ROOT = join(__dirname, "../..");

function read(rel: string): string {
  return readFileSync(join(ROOT, rel), "utf8");
}

describe("science learning model page", () => {
  it("explains the generative model, actions, projection, and three sessions", () => {
    const full = getScienceLearningModelFullText();
    for (const term of SCIENCE_LEARNING_MODEL_TERMS) {
      expect(full.toLowerCase(), term).toContain(term.toLowerCase());
    }
    expect(SCIENCE_LEARNING_MODEL_COPY.title).toBe("A generative model you can walk.");
    expect(full.toLowerCase()).toMatch(/forage/);
    expect(full.toLowerCase()).toMatch(/calibrate/);
    expect(full.toLowerCase()).toMatch(/projection/);
    expect(SCIENCE_LEARNING_MODEL_COPY.caveat.toLowerCase()).toMatch(/influence/);
  });

  it("ships an interactive 4-action explorer on /science/learning-model", () => {
    expect(SCIENCE_LEARNING_MODEL_PATH).toBe("/science/learning-model");
    expect(existsSync(join(ROOT, "app/science/learning-model/page.tsx"))).toBe(true);
    const page = read("app/science/learning-model/page.tsx");
    expect(page).toContain("LearningModelExplorer");
    expect(page).toContain("LearningModelSchematic");
    expect(page).toContain("LearningModelPipelines");
    expect(page).toContain("data-science-learning-model");
    expect(page).toContain("data-learning-model-catalog={catalog.size}");
    expect(read("components/science/LearningModelExplorer.tsx")).toContain("data-explorer-action");
    expect(read("components/science/LearningModelExplorer.tsx")).toContain("LEARNING_MODEL_CATALOG_4");
    expect(read("components/science/LearningModelExplorer.tsx")).toContain('actionId === "forage"');
    expect(read("components/science/LearningModelSchematic.tsx")).toContain("data-learning-model-schematic");
    expect(read("components/science/LearningModelPipelines.tsx")).toContain("data-learning-model-mode");
    expect(read("app/science/page.tsx")).toContain("SCIENCE_LEARNING_MODEL_PATH");
    expect(read("app/sitemap.ts")).toContain("/science/learning-model");
  });
});
