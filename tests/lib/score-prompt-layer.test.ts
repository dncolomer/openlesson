import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  buildOpaqueScoreContextSurface,
  buildScoreContextSurface,
  SCORE_POW_CONTEXT_LAYER,
  SCORE_POW_CONTEXT_LAYER_OPAQUE,
  SCORE_VERIFICATION_SUBMIT_STASH_OVERLAY,
  scoreInstructionsRequirePowOnly,
  scoreInstructionsRequireSubmitStashAnalysis,
} from "@/lib/prompt-kernel/surfaces/score-context";
import { buildVerticalScoreInstructions } from "@/lib/pow-api/performance-report";
import { buildOpaqueVerticalScoreInstructions } from "@/lib/pow-api/opaque-evaluation";

const ROOT = join(__dirname, "../..");

describe("score-context layer (isolation)", () => {
  it("exports PoW-only and verification submit/stash fragments", () => {
    expect(scoreInstructionsRequirePowOnly(SCORE_POW_CONTEXT_LAYER)).toBe(true);
    expect(scoreInstructionsRequirePowOnly(SCORE_POW_CONTEXT_LAYER_OPAQUE)).toBe(true);
    expect(scoreInstructionsRequireSubmitStashAnalysis(SCORE_VERIFICATION_SUBMIT_STASH_OVERLAY)).toBe(
      true
    );
    expect(SCORE_POW_CONTEXT_LAYER).toMatch(/exclusively|PROOF-OF-WORK ONLY/i);
    expect(SCORE_VERIFICATION_SUBMIT_STASH_OVERLAY).toMatch(/System\s*1/i);
    expect(SCORE_VERIFICATION_SUBMIT_STASH_OVERLAY).toMatch(/System\s*2/i);
    expect(SCORE_VERIFICATION_SUBMIT_STASH_OVERLAY).toMatch(/stash|unsent/i);
  });

  it("buildScoreContextSurface includes submit/stash only for verification", () => {
    const verification = buildScoreContextSurface("verification");
    const augmentation = buildScoreContextSurface("augmentation");
    const optimization = buildScoreContextSurface("optimization");

    expect(scoreInstructionsRequirePowOnly(verification)).toBe(true);
    expect(scoreInstructionsRequirePowOnly(augmentation)).toBe(true);
    expect(scoreInstructionsRequirePowOnly(optimization)).toBe(true);

    expect(scoreInstructionsRequireSubmitStashAnalysis(verification)).toBe(true);
    expect(scoreInstructionsRequireSubmitStashAnalysis(augmentation)).toBe(false);
    expect(scoreInstructionsRequireSubmitStashAnalysis(optimization)).toBe(false);

    // Opaque surface is PoW-only structural; no semantic submit/stash mandate
    for (const vertical of ["verification", "augmentation", "optimization"] as const) {
      const opaque = buildOpaqueScoreContextSurface(vertical);
      expect(scoreInstructionsRequirePowOnly(opaque)).toBe(true);
      expect(scoreInstructionsRequireSubmitStashAnalysis(opaque)).toBe(false);
    }
  });
});

describe("buildVerticalScoreInstructions (shipped builders)", () => {
  it.each(["verification", "augmentation", "optimization"] as const)(
    "%s instructions enforce PoW-exclusive scoring context",
    (vertical) => {
      const instructions = buildVerticalScoreInstructions(vertical, null, "Ship readiness");
      expect(scoreInstructionsRequirePowOnly(instructions)).toBe(true);
      expect(instructions).toContain("WORKSPACE ONTOLOGY");
      expect(instructions).toContain(SCORE_POW_CONTEXT_LAYER.slice(0, 40));
      expect(instructions).toContain("proof-of-work");
      expect(instructions).not.toMatch(/score from any context|invent competency from marketing/i);
      // Layer appears before vertical task markers
      expect(instructions.indexOf("SCORE GENERATION CONTEXT")).toBeLessThan(
        instructions.indexOf("You produce a structured")
      );
    }
  );

  it("verification requires submit/stash System 1–2 analysis", () => {
    const instructions = buildVerticalScoreInstructions("verification", "block-1", null);
    expect(scoreInstructionsRequireSubmitStashAnalysis(instructions)).toBe(true);
    expect(instructions).toMatch(/System\s*1/i);
    expect(instructions).toMatch(/System\s*2/i);
    expect(instructions).toMatch(/stash|unsent|submit/i);
    expect(instructions).toContain(SCORE_VERIFICATION_SUBMIT_STASH_OVERLAY.slice(0, 30));
  });

  it("augmentation and optimization inherit PoW-only but not mandatory submit/stash", () => {
    for (const vertical of ["augmentation", "optimization"] as const) {
      const instructions = buildVerticalScoreInstructions(vertical, null);
      expect(scoreInstructionsRequirePowOnly(instructions)).toBe(true);
      expect(scoreInstructionsRequireSubmitStashAnalysis(instructions)).toBe(false);
      expect(instructions).not.toContain("VERIFICATION — SUBMIT / STASH");
    }
  });
});

describe("buildOpaqueVerticalScoreInstructions", () => {
  it("composes structural PoW-only layer without semantic submit/stash mandate", () => {
    for (const vertical of ["verification", "augmentation", "optimization"] as const) {
      const instructions = buildOpaqueVerticalScoreInstructions(vertical, null, "goal_ref:abc");
      expect(scoreInstructionsRequirePowOnly(instructions)).toBe(true);
      expect(instructions).toContain("opaque");
      expect(scoreInstructionsRequireSubmitStashAnalysis(instructions)).toBe(false);
    }
  });
});

describe("live generator wiring", () => {
  it("generate-performance-report calls layered score instruction builders", () => {
    const gen = readFileSync(
      join(ROOT, "lib/pow-api/generate-performance-report.ts"),
      "utf8"
    );
    expect(gen).toContain("buildVerticalScoreInstructions");
    expect(gen).toContain("buildOpaqueVerticalScoreInstructions");
    expect(gen).toMatch(/buildVerticalScoreInstructions\(vertical/);
  });

  it("performance-report builder uses buildScoreContextSurface + composePrompt", () => {
    const src = readFileSync(join(ROOT, "lib/pow-api/performance-report.ts"), "utf8");
    expect(src).toContain("buildScoreContextSurface");
    expect(src).toContain("composePrompt");
    expect(src).toMatch(/surface:\s*buildScoreContextSurface\(vertical\)/);
  });

  it("opaque builder uses buildOpaqueScoreContextSurface + composePrompt", () => {
    const src = readFileSync(join(ROOT, "lib/pow-api/opaque-evaluation.ts"), "utf8");
    expect(src).toContain("buildOpaqueScoreContextSurface");
    expect(src).toContain("composePrompt");
    expect(src).toMatch(/surface:\s*buildOpaqueScoreContextSurface/);
  });
});
