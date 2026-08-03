/**
 * Workspace Simulation tab: scope helpers + real Explore/Drill prompt builders.
 * Gates the redo: block vs entire-workspace scope, pure samples, API wiring.
 */
import { describe, expect, it } from "vitest";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  buildGroundedDialogueQuestion,
  buildGroundedExerciseItem,
  buildSimulationSamplesSystemPrompt,
  buildSimulationSamplesUserPrompt,
} from "@/lib/practice-item-builders";
import { buildTapOpeningQuestionTask as kernelOpeningTask } from "@/lib/prompt-kernel/surfaces/tap";
import { buildDomainExerciseAuthorSystemPrompt } from "@/lib/pow-api/tapbench-exercise-quality";
import {
  buildSimulationSamplePracticeContext,
  buildSimulationSamplePrompts,
  deriveSimulationSamples,
  isBlockSimulationScope,
  isWorkspaceSimulationScope,
  normalizeSimulationSampleResponse,
  normalizeSimulationSampleScope,
  type SimulationSampleWorkspaceContext,
} from "@/lib/workspace-simulation-samples";
import { SIMULATION_EXERCISE_COUNT, SIMULATION_QUESTION_COUNT } from "@/lib/block-simulation";

const ROOT = join(__dirname, "../..");
const SCRATCH =
  process.env.GROK_SCRATCH ||
  process.env.GOAL_SCRATCH ||
  "/var/folders/kd/98qlvkyd4mb3_9t32p9bmt_r0000gn/T/grok-goal-46f9864a291e/implementer";

function read(rel: string) {
  const path = join(ROOT, rel);
  expect(existsSync(path), `missing ${rel}`).toBe(true);
  return readFileSync(path, "utf8");
}

function writeLog(name: string, body: string) {
  mkdirSync(SCRATCH, { recursive: true });
  writeFileSync(join(SCRATCH, name), body, "utf8");
}

const fixture: SimulationSampleWorkspaceContext = {
  workspaceTitle: "Bayesian clinical reasoning",
  rootTopic: "Bayes",
  workspaceGoal: "Update clinical beliefs from test evidence correctly",
  workspaceDescription: "Diagnostic reasoning course",
  notes: "Prevalence matters more than test accuracy when base rates are low.",
  locale: "en",
  blocks: [
    {
      id: "b-ppv",
      title: "Positive predictive value",
      description:
        "Compute PPV from sensitivity, specificity, and prevalence for a diagnostic test.",
      planning_prompt: "Use medical testing examples",
      local_context: { notes: "Prevalence dominates when base rates are low." },
      is_start: true,
      position_x: 0,
      position_y: 0,
      next_block_ids: ["b-lr"],
    },
    {
      id: "b-lr",
      title: "Likelihood ratios",
      description: "Convert sensitivity/specificity into likelihood ratios.",
      is_start: false,
      lock_until_block_ids: ["b-ppv"],
    },
  ],
};

describe("normalizeSimulationSampleScope", () => {
  it("parses block scope with concrete block id", () => {
    const s = normalizeSimulationSampleScope({
      scope: "block",
      blockId: "b-ppv",
    });
    expect(s).toEqual({ kind: "block", blockId: "b-ppv" });
    expect("error" in s).toBe(false);
    if (!("error" in s)) {
      expect(isBlockSimulationScope(s)).toBe(true);
      expect(isWorkspaceSimulationScope(s)).toBe(false);
    }
  });

  it("parses entire-workspace scope distinctly (no focused block)", () => {
    const s = normalizeSimulationSampleScope({ scope: "workspace" });
    expect(s).toEqual({ kind: "workspace" });
    if (!("error" in s)) {
      expect(isWorkspaceSimulationScope(s)).toBe(true);
      expect(isBlockSimulationScope(s)).toBe(false);
    }
  });

  it("defaults empty request to workspace; rejects block without id", () => {
    expect(normalizeSimulationSampleScope({})).toEqual({ kind: "workspace" });
    expect(normalizeSimulationSampleScope({ scope: "block" })).toEqual({
      error: "blockId is required when scope is block",
    });
    // blockId alone implies block scope
    expect(normalizeSimulationSampleScope({ blockId: "x1" })).toEqual({
      kind: "block",
      blockId: "x1",
    });
  });
});

describe("deriveSimulationSamples — pure path (real builders)", () => {
  it("block scope: questions + exercises grounded in block + workspace goal", () => {
    const scope = { kind: "block" as const, blockId: "b-ppv" };
    const bundle = deriveSimulationSamples(scope, fixture);

    expect(bundle.scope).toEqual(scope);
    expect(bundle.questions.length).toBe(SIMULATION_QUESTION_COUNT);
    expect(bundle.exercises.length).toBe(SIMULATION_EXERCISE_COUNT);
    expect(bundle.probes.length).toBe(
      SIMULATION_QUESTION_COUNT + SIMULATION_EXERCISE_COUNT,
    );

    const ctx = buildSimulationSamplePracticeContext(scope, fixture);
    expect(ctx.blockTitle).toMatch(/Positive predictive value/i);
    expect(ctx.workspaceGoal).toMatch(/clinical beliefs|test evidence/i);

    // Same pure builders live Explore/Drill fallbacks use
    expect(bundle.questions[0]).toBe(buildGroundedDialogueQuestion(ctx, 0));
    expect(bundle.exercises[0]).toBe(buildGroundedExerciseItem(ctx, 0));

    // Substance from focused block
    expect(bundle.questions.join(" ")).toMatch(/Positive predictive value|PPV|prevalence/i);
    expect(bundle.userPrompt).toMatch(/Positive predictive value|Block inventory|workspace/i);
    expect(bundle.userPrompt).toMatch(/Bayesian clinical reasoning|Update clinical beliefs/i);
  });

  it("workspace scope: distinct from block — no single focused block; non-empty samples", () => {
    const scope = { kind: "workspace" as const };
    const bundle = deriveSimulationSamples(scope, fixture);

    expect(bundle.scope).toEqual(scope);
    expect(bundle.questions.length).toBe(SIMULATION_QUESTION_COUNT);
    expect(bundle.exercises.length).toBe(SIMULATION_EXERCISE_COUNT);
    expect(bundle.questions.every((q) => q.length >= 8)).toBe(true);
    expect(bundle.exercises.every((q) => q.length >= 8)).toBe(true);

    const ctx = buildSimulationSamplePracticeContext(scope, fixture);
    // Workspace subject uses workspace title, not the PPV block title as exclusive focus
    expect(ctx.blockTitle).toBe("Bayesian clinical reasoning");
    expect(ctx.workspaceGoal).toMatch(/clinical beliefs/i);

    const blockBundle = deriveSimulationSamples(
      { kind: "block", blockId: "b-ppv" },
      fixture,
    );
    // Scopes produce different grounding (workspace title vs block title in items)
    expect(bundle.questions[0]).not.toBe(blockBundle.questions[0]);
    expect(bundle.userPrompt).toMatch(/ENTIRE WORKSPACE|entire workspace/i);
    expect(bundle.userPrompt).not.toMatch(/focused block text/i);
    // Map inventory still present for workspace-wide grounding
    expect(bundle.userPrompt).toMatch(
      /Positive predictive value|Likelihood ratios|Block inventory|Map/i,
    );
  });

  it("normalizeSimulationSampleResponse pads thin LLM payloads via pure builders", () => {
    const scope = { kind: "block" as const, blockId: "b-ppv" };
    const out = normalizeSimulationSampleResponse(
      {
        questions: ["What is PPV when prevalence is 1%?"],
        exercises: [],
      },
      scope,
      fixture,
    );
    expect(out.questions.length).toBe(SIMULATION_QUESTION_COUNT);
    expect(out.exercises.length).toBe(SIMULATION_EXERCISE_COUNT);
    expect(out.questions[0]).toMatch(/PPV|prevalence/i);
    expect(out.scope).toEqual(scope);
  });
});

describe("real-prompt assembly path (live Explore/Drill symbols)", () => {
  it("system/user construction imports/calls TAP opening + domain-exercise builders", () => {
    const system = buildSimulationSamplesSystemPrompt();
    expect(system).toContain(kernelOpeningTask().slice(0, 40));
    expect(system).toContain(
      buildDomainExerciseAuthorSystemPrompt("tap_exercise").slice(0, 40),
    );
    expect(system).toMatch(/out loud|stage direction/i);
    expect(system).toMatch(/Explore|Drill|dialogue|exercise/i);

    const blockPrompts = buildSimulationSamplePrompts(
      { kind: "block", blockId: "b-ppv" },
      fixture,
    );
    expect(blockPrompts.systemPrompt).toBe(system);
    expect(blockPrompts.focusedBlockId).toBe("b-ppv");
    expect(blockPrompts.userPrompt).toMatch(
      /Bayesian clinical reasoning|Update clinical beliefs/i,
    );
    expect(blockPrompts.userPrompt).toMatch(/Positive predictive value/i);
    expect(blockPrompts.practiceContext.blockTitle).toMatch(
      /Positive predictive value/i,
    );

    const wsPrompts = buildSimulationSamplePrompts(
      { kind: "workspace" },
      fixture,
    );
    expect(wsPrompts.focusedBlockId).toBeNull();
    expect(wsPrompts.userPrompt).toMatch(/ENTIRE WORKSPACE|entire workspace/i);
    expect(wsPrompts.userPrompt).toMatch(
      /Bayesian clinical reasoning|Update clinical beliefs/i,
    );

    // Direct user prompt helper with sampleScope flag
    const userWs = buildSimulationSamplesUserPrompt({
      workspaceTitle: fixture.workspaceTitle,
      workspaceGoal: fixture.workspaceGoal,
      notes: fixture.notes,
      blockTitle: fixture.workspaceTitle,
      sampleScope: "workspace",
      focusedBlockId: null,
      blocks: fixture.blocks?.map((b) => ({
        id: b.id,
        title: String(b.title || "Block"),
        description: b.description,
        is_start: b.is_start,
      })),
    });
    expect(userWs).toMatch(/ENTIRE WORKSPACE|entire workspace/i);

    // Module + API route wire the shared builders
    const samplesLib = read("lib/workspace-simulation-samples.ts");
    expect(samplesLib).toContain("buildSimulationSamplesSystemPrompt");
    expect(samplesLib).toContain("buildSimulationSamplesUserPrompt");
    expect(samplesLib).toContain("buildGroundedDialogueQuestion");
    expect(samplesLib).toContain("buildGroundedExerciseItem");
    expect(samplesLib).toContain('from "@/lib/practice-item-builders"');

    const practiceLib = read("lib/practice-item-builders.ts");
    expect(practiceLib).toContain("buildTapOpeningQuestionTask");
    expect(practiceLib).toContain("buildDomainExerciseAuthorSystemPrompt");
    expect(practiceLib).toContain("buildTapPracticeOpeningQuestionTask");

    const route = read("app/api/workspace/simulation-samples/route.ts");
    expect(route).toContain("buildSimulationSamplePrompts");
    expect(route).toContain("normalizeSimulationSampleScope");
    expect(route).toContain("workspace-simulation-samples");
    expect(route).toMatch(/scope|blockId/);
    expect(route).toContain("callXaiJSON");
    // LLM JSON flakiness must not hard-fail the tab when pure builders can fill in
    expect(route).toContain("deriveSimulationSamples");
    expect(route).toContain("parseJsonLoose");
    expect(route).toMatch(/fallback/);
    expect(route).toMatch(/maxTokens:\s*2800|maxTokens:\s*2\d{3}/);

    writeLog(
      "simulation-real-prompts.log",
      [
        "system_has_tap_opening=" +
          system.includes(kernelOpeningTask().slice(0, 40)),
        "system_has_domain_exercise=" +
          system.includes(
            buildDomainExerciseAuthorSystemPrompt("tap_exercise").slice(0, 40),
          ),
        "block_focusedId=" + blockPrompts.focusedBlockId,
        "block_user_has_goal=" +
          /clinical beliefs|test evidence/i.test(blockPrompts.userPrompt),
        "block_user_has_block=" +
          /Positive predictive value/i.test(blockPrompts.userPrompt),
        "ws_focusedId_null=" + String(wsPrompts.focusedBlockId === null),
        "ws_user_entire=" +
          /ENTIRE WORKSPACE|entire workspace/i.test(wsPrompts.userPrompt),
        "route_uses_shared_builders=" +
          route.includes("buildSimulationSamplePrompts"),
        "lib_imports_practice_builders=" +
          samplesLib.includes("practice-item-builders"),
      ].join("\n") + "\n",
    );
  });
});

describe("scope samples evidence log", () => {
  it("writes block vs workspace sample shapes", () => {
    const block = deriveSimulationSamples(
      { kind: "block", blockId: "b-ppv" },
      fixture,
    );
    const ws = deriveSimulationSamples({ kind: "workspace" }, fixture);
    writeLog(
      "simulation-scope-samples.log",
      [
        "block_q_count=" + block.questions.length,
        "block_ex_count=" + block.exercises.length,
        "block_first_q=" + block.questions[0]?.slice(0, 80),
        "block_has_ppv=" +
          /Positive predictive value|PPV/i.test(block.questions.join(" ")),
        "ws_q_count=" + ws.questions.length,
        "ws_ex_count=" + ws.exercises.length,
        "ws_first_q=" + ws.questions[0]?.slice(0, 80),
        "scopes_differ=" + String(block.questions[0] !== ws.questions[0]),
        "ws_scope_kind=" + ws.scope.kind,
        "block_scope_kind=" + block.scope.kind,
      ].join("\n") + "\n",
    );
    expect(block.questions.length).toBeGreaterThan(0);
    expect(ws.questions.length).toBeGreaterThan(0);
    expect(block.scope.kind).toBe("block");
    expect(ws.scope.kind).toBe("workspace");
  });
});
