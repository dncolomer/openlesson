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

describe("deriveSimulationSamples — empty Q/E (xAI only for items)", () => {
  it("block scope: empty questions/exercises; prompts still grounded for LLM", () => {
    const scope = { kind: "block" as const, blockId: "b-ppv" };
    const bundle = deriveSimulationSamples(scope, fixture);

    expect(bundle.scope).toEqual(scope);
    expect(bundle.questions).toEqual([]);
    expect(bundle.exercises).toEqual([]);
    expect(bundle.probes).toEqual([]);

    const ctx = buildSimulationSamplePracticeContext(scope, fixture);
    expect(ctx.blockTitle).toMatch(/Positive predictive value/i);
    expect(ctx.workspaceGoal).toMatch(/clinical beliefs|test evidence/i);
    expect(bundle.userPrompt).toMatch(/Positive predictive value|Block inventory|workspace/i);
    expect(bundle.userPrompt).toMatch(/Bayesian clinical reasoning|Update clinical beliefs/i);
  });

  it("workspace scope: empty samples; user prompt is entire-workspace", () => {
    const scope = { kind: "workspace" as const };
    const bundle = deriveSimulationSamples(scope, fixture);

    expect(bundle.scope).toEqual(scope);
    expect(bundle.questions).toEqual([]);
    expect(bundle.exercises).toEqual([]);

    const ctx = buildSimulationSamplePracticeContext(scope, fixture);
    expect(ctx.blockTitle).toBe("Bayesian clinical reasoning");
    expect(ctx.workspaceGoal).toMatch(/clinical beliefs/i);
    expect(bundle.userPrompt).toMatch(/ENTIRE WORKSPACE|entire workspace/i);
    expect(bundle.userPrompt).toMatch(
      /Positive predictive value|Likelihood ratios|Block inventory|Map/i,
    );
  });

  it("normalizeSimulationSampleResponse keeps raw model strings only (no pure pad)", () => {
    const scope = { kind: "block" as const, blockId: "b-ppv" };
    const out = normalizeSimulationSampleResponse(
      {
        questions: ["What is PPV when prevalence is 1%?"],
        exercises: [],
      },
      scope,
      fixture,
    );
    // Raw model only — do not pad with pure title/material shells
    expect(out.questions).toEqual(["What is PPV when prevalence is 1%?"]);
    expect(out.exercises).toEqual([]);
    expect(out.questions[0]).toMatch(/PPV|prevalence/i);
    expect(out.scope).toEqual(scope);

    const empty = normalizeSimulationSampleResponse(null, scope, fixture);
    expect(empty.questions).toEqual([]);
    expect(empty.exercises).toEqual([]);

    const full = normalizeSimulationSampleResponse(
      {
        questions: ["Q1 raw model", "Q2 raw model", "Q3 raw model"],
        exercises: [
          "Exercise: E1 raw model with numbers 2 and 3",
          "Exercise: E2 raw model",
          "Exercise: E3 raw model",
        ],
      },
      scope,
      fixture,
    );
    expect(full.questions).toEqual(["Q1 raw model", "Q2 raw model", "Q3 raw model"]);
    expect(full.exercises[0]).toBe("Exercise: E1 raw model with numbers 2 and 3");
    // Must not inject pure shells
    expect(full.questions.join("\n")).not.toMatch(/attachments\s*:|Given parameters\s+A\s*=/i);
    expect(full.exercises.join("\n")).not.toMatch(/Work this fixed problem|on this setup/i);
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
    expect(samplesLib).toContain("normalizeSimulationSampleResponse");
    expect(samplesLib).toContain('from "@/lib/practice-item-builders"');
    // No pure grounded item *calls* for user-facing seed
    expect(samplesLib).not.toMatch(/buildGroundedDialogueQuestion\(/);
    expect(samplesLib).not.toMatch(/buildGroundedExerciseItem\(/);

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
    expect(route).toContain("parseJsonLoose");
    expect(route).toContain("normalizeSimulationSampleResponse");
    // Raw xAI only — no pure-template substitute when the model is empty
    expect(route).not.toContain("deriveSimulationSamples");
    expect(route).toMatch(/no pure-template fallback|empty simulation samples/i);
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
    expect(block.questions.length).toBe(0);
    expect(ws.questions.length).toBe(0);
    expect(block.userPrompt.length).toBeGreaterThan(40);
    expect(ws.userPrompt.length).toBeGreaterThan(40);
    expect(block.scope.kind).toBe("block");
    expect(ws.scope.kind).toBe("workspace");
  });
});
