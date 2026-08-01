import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import {
  buildTapbenchExerciseAuthorSystemPrompt,
  buildTapbenchExerciseAuthorUserPrompt,
  buildTapbenchExerciseFallback,
  generateTapbenchExercise,
  isLowQualityTapbenchExercise,
  looksLikeTopicOverview,
} from "@/lib/pow-api/tapbench-exercise-generate";
import { buildExercisePromptText } from "@/lib/exercise-tap";
import { buildTapbenchExercise } from "@/lib/pow-api/tapbench";

const ROOT = join(__dirname, "../..");

function read(rel: string) {
  return readFileSync(join(ROOT, rel), "utf8");
}

const mathBlock = {
  workspaceTitle: "Mathematics",
  rootTopic: "Mathematics",
  blockTitle: "Number Theory & Discrete Math",
  blockDescription: "Integers, modular arithmetic, combinatorics, and graph theory.",
  durationSeconds: 900,
};

describe("looksLikeTopicOverview", () => {
  it("detects syllabus-style topic catalogs", () => {
    expect(
      looksLikeTopicOverview(
        "Integers, modular arithmetic, combinatorics, and graph theory.",
      ),
    ).toBe(true);
    expect(
      looksLikeTopicOverview("Real and complex analysis, limits, measure, and functional analysis."),
    ).toBe(true);
  });

  it("does not flag real tasks", () => {
    expect(
      looksLikeTopicOverview(
        "Prove that if n is composite then there exists a prime p ≤ √n dividing n.",
      ),
    ).toBe(false);
    expect(
      looksLikeTopicOverview("Design an auth flow with short-lived access tokens."),
    ).toBe(false);
  });
});

describe("isLowQualityTapbenchExercise", () => {
  it("rejects the old topic-list wrap template", () => {
    const bad =
      'Exercise: Using what you know about "Number Theory & Discrete Math", complete this task: Integers, modular arithmetic, combinatorics, and graph theory. State assumptions, work the solution, and note where you are uncertain.';
    expect(isLowQualityTapbenchExercise(bad, mathBlock)).toBe(true);
  });

  it("accepts a concrete problem", () => {
    const good =
      "Exercise: Let n = 221. Factor n by trial division up to √n, then compute φ(n) and find the modular inverse of 17 mod n if it exists. Show each step and box the final results.";
    expect(isLowQualityTapbenchExercise(good, mathBlock)).toBe(false);
  });
});

describe("buildTapbenchExerciseFallback", () => {
  it("does not paste topic catalog as the task body", () => {
    const text = buildTapbenchExerciseFallback(mathBlock);
    expect(text.startsWith("Exercise:")).toBe(true);
    expect(text.toLowerCase()).not.toMatch(/using what you know about/);
    expect(text.toLowerCase()).not.toMatch(
      /complete this task:\s*integers, modular arithmetic/i,
    );
    expect(text).toMatch(/solve|problem|steps|answer/i);
  });
});

describe("generateTapbenchExercise", () => {
  it("uses LLM output when it is a real problem", async () => {
    const { exercise, source } = await generateTapbenchExercise({
      ...mathBlock,
      generateText: async () =>
        "Exercise: Prove that for every integer n > 1 there is a prime p with n < p < 2n (a weak form of Bertrand). If you cannot prove the full theorem, prove it for n ≤ 20 by explicit primes and explain the gap to the general case.",
    });
    expect(source).toBe("llm");
    expect(isLowQualityTapbenchExercise(exercise, mathBlock)).toBe(false);
    expect(exercise).toMatch(/Prove|prime|Bertrand/i);
  });

  it("falls back when LLM returns the banned wrap", async () => {
    const { exercise, source } = await generateTapbenchExercise({
      ...mathBlock,
      generateText: async () =>
        'Using what you know about "Number Theory & Discrete Math", complete this task: Integers, modular arithmetic, combinatorics, and graph theory.',
    });
    expect(source).toBe("fallback");
    expect(exercise.toLowerCase()).not.toMatch(/using what you know about/);
  });

  it("author prompts ban topic restatement and require a real problem", () => {
    const sys = buildTapbenchExerciseAuthorSystemPrompt();
    const user = buildTapbenchExerciseAuthorUserPrompt(mathBlock);
    expect(sys).toMatch(/concrete problem|success criteria/i);
    expect(sys).toMatch(/Using what you know/i);
    expect(user).toMatch(/NOT the exercise|topic scope/i);
    expect(user).toContain("Number Theory");
  });
});

describe("pure framer no longer wraps topic catalogs as tasks", () => {
  it("buildExercisePromptText for math catalog does not use complete-this-task wrap", () => {
    const text = buildExercisePromptText(mathBlock);
    expect(text.toLowerCase()).not.toMatch(/using what you know about/);
    expect(text.toLowerCase()).not.toMatch(
      /complete this task:\s*integers, modular arithmetic/i,
    );
  });

  it("buildTapbenchExercise for math catalog is not the banned template", () => {
    const text = buildTapbenchExercise(mathBlock);
    expect(isLowQualityTapbenchExercise(text, mathBlock)).toBe(false);
  });
});

describe("mint route wires LLM exercise generation", () => {
  it("POST handler imports and calls generateTapbenchExercise with full context layers", () => {
    const route = read("app/api/workspace/tapbench-links/route.ts");
    expect(route).toContain("generateTapbenchExercise");
    expect(route).toContain("exercise_source");
    expect(route).toContain("loadWorkspacePromptContext");
    expect(route).toContain("blocks: promptCtx.blocks");
    expect(route).toContain("blockLocalContext: promptCtx.blockLocalContext");
    expect(route).toContain("unusableCells: promptCtx.unusableCells");
    expect(route).toContain("focusedBlockId: promptCtx.focusedBlockId");
    expect(existsSync(join(ROOT, "lib/pow-api/tapbench-exercise-generate.ts"))).toBe(
      true,
    );
    expect(existsSync(join(ROOT, "lib/pow-api/load-workspace-prompt-context.ts"))).toBe(
      true,
    );
  });
});

describe("human TAP + ILE also use LLM domain exercise author", () => {
  it("TAP start uses generateTapExercisePrompt for exercise kind", () => {
    const start = read("app/api/workspace-tap-score/start/route.ts");
    expect(start).toContain("generateTapExercisePrompt");
    expect(start).toContain("generateTapOpeningQuestion");
  });

  it("ships generate-exercise API for ILE Project Mode", () => {
    expect(existsSync(join(ROOT, "app/api/generate-exercise/route.ts"))).toBe(true);
    const route = read("app/api/generate-exercise/route.ts");
    expect(route).toContain("generateDomainExercise");
    expect(route).toContain("ile_project");
  });

  it("SessionView calls generate-exercise for Project Mode chapters with context layers", () => {
    const view = read("components/SessionView.tsx");
    expect(view).toContain("/api/generate-exercise");
    expect(view).toContain("ile_project");
    expect(view).toContain("buildIleProjectChapterExercisePrompt");
    expect(view).toContain("blocks: ilePromptMaterials?.blocks");
    expect(view).toContain("blockLocalContext: ilePromptMaterials?.blockLocalContext");
    expect(view).toContain("unusableCells: ilePromptMaterials?.unusableCells");
    expect(view).toContain("notes: ilePromptMaterials?.notes");
  });

  it("generateDomainExercise supports tap_exercise and ile_project surfaces", async () => {
    const { generateDomainExercise, generateTapExercisePrompt, generateIleProjectExercise } =
      await import("@/lib/pow-api/tapbench-exercise-generate");
    const stub = async () =>
      "Exercise: Prove that the sum of the first n positive integers is n(n+1)/2 by induction. Write base case, inductive hypothesis, and inductive step with algebra.";
    const a = await generateTapExercisePrompt({
      ...mathBlock,
      generateText: stub,
    });
    expect(a.source).toBe("llm");
    expect(a.exercise).toMatch(/induction|n\(n\+1\)/i);
    const b = await generateIleProjectExercise({
      ...mathBlock,
      chapterDescription: mathBlock.blockDescription,
      generateText: stub,
    });
    expect(b.source).toBe("llm");
    const c = await generateDomainExercise({
      ...mathBlock,
      surface: "tap_exercise",
      generateText: stub,
    });
    expect(c.source).toBe("llm");
  });
});
