/**
 * ILE chapter-create + in-chapter coach: opinionated, topic-aware learning harness.
 * Drives the shipped composers the live session fills — no model call.
 */
import { describe, expect, it } from "vitest";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { DEFAULT_PROMPTS } from "@/lib/prompts";
import { composeSessionPlanCreatePrompt } from "@/lib/session-plan-create";
import { composeSessionPlanUpdatePrompt } from "@/lib/session-plan-update";
import { ileLearningHarnessRules } from "@/lib/ile-chapter-depth";
import {
  buildIleHeliosChatSystemPrompt,
  ILE_CONTEXT_BODY,
  ILE_SURFACE,
} from "@/lib/prompt-kernel";

const ROOT = join(__dirname, "../..");
const SCRATCH =
  process.env.GROK_GOAL_SCRATCH ||
  "/var/folders/kd/98qlvkyd4mb3_9t32p9bmt_r0000gn/T/grok-goal-6e83b7914842/implementer";

function writeScratch(name: string, body: string) {
  mkdirSync(SCRATCH, { recursive: true });
  writeFileSync(join(SCRATCH, name), body, "utf8");
}

function read(rel: string) {
  const path = join(ROOT, rel);
  expect(existsSync(path), `missing ${rel}`).toBe(true);
  return readFileSync(path, "utf8");
}

const harness = ileLearningHarnessRules();

function expectHarness(text: string) {
  expect(text).toContain("LEARNING HARNESS");
  expect(text).toMatch(/topic-aware/i);
  expect(text).toMatch(/question \| task \| suggestion \| checkpoint|mix diagnostic questions with tasks/i);
  expect(text).toMatch(/not a quiz/i);
  expect(text).toMatch(/Do not always draw|never as a default|Do NOT default|never default to draw|do not send them to the Canvas/i);
  expect(text).toMatch(/Canvas \/ sketch \/ draw ONLY when|Canvas only|only when the topic is spatial/i);
  expect(text).toMatch(/worked example|comparison|case judgment/i);
}

describe("chapter-create harness (shipped compose)", () => {
  it("filled session_plan_create is a guided task+question path and forbids always-draw", () => {
    const filled = composeSessionPlanCreatePrompt(DEFAULT_PROMPTS.session_plan_create, {
      problem: "Just-war theory in international law",
      objectives: ["Judge a case", "Name the criteria"],
      sessionMode: "learning",
    });
    expect(filled).toContain("Just-war theory");
    expect(filled).toMatch(/question \| task \| suggestion \| checkpoint/);
    expect(filled).toMatch(/not a pure question-only|not a quiz/i);
    expectHarness(filled);
    expect(DEFAULT_PROMPTS.session_plan_create).toContain("{learning_harness_rules}");
    expect(filled).toContain(harness.split("\n")[0]);

    writeScratch("ile-harness-chapter-create.txt", filled);
  });
});

describe("in-chapter harness (shipped compose + Helios)", () => {
  it("session_plan_update and live Helios share topic-aware / no-forced-draw guidance", () => {
    const update = composeSessionPlanUpdatePrompt(DEFAULT_PROMPTS.session_plan_update, {
      goal: "Judge a just-war case",
      strategy: "Criteria then apply",
      steps: [
        {
          type: "task",
          description: "Walk a case through just-war criteria",
          status: "in_progress",
        },
      ],
      currentStepIndex: 0,
      previousProbes: [],
      sessionMode: "learning",
    });
    const helios = buildIleHeliosChatSystemPrompt("learning");

    expectHarness(update);
    expectHarness(helios);
    expect(update).toMatch(/deeper|apply|checkpoint|question/i);
    expect(helios).toMatch(/Do not always send them to Canvas|Never default to "sketch it on the Canvas"/i);
    expect(DEFAULT_PROMPTS.session_plan_update).toContain("{learning_harness_rules}");
    expect(ILE_SURFACE).toMatch(/Sketch\/Canvas only when|Do not always draw/i);
    expect(ILE_CONTEXT_BODY).toMatch(/Do not always say "Sketch this on the Canvas"/i);

    writeScratch("ile-harness-in-chapter.txt", `${update}\n\n=== HELIOS ===\n${helios}`);
  });
});

describe("live surfaces share the harness", () => {
  it("create + live-coach sources insert the same no-forced-draw rule", () => {
    const depth = read("lib/ile-chapter-depth.ts");
    const ile = read("lib/prompt-kernel/surfaces/ile.ts");
    const prompts = read("lib/prompts.ts");
    expect(depth).toContain("export function ileLearningHarnessRules");
    expect(depth).toContain("{learning_harness_rules}");
    expect(ile).toContain("{learning_harness_rules}");
    expect(prompts).toContain("{learning_harness_rules}");
    expect(ileLearningHarnessRules()).toBe(harness);

    const statusQuo = [
      "HOW IMPROVED",
      "- Chapter-create and in-chapter Helios now share one LEARNING HARNESS block: opinionated mix of questions and tasks, topic-shaped chapters (worked example, comparison, case, implement, derive) — not a quiz and not a draw/list factory.",
      "- Canvas/sketch is allowed only when the topic is spatial/structural/visual. Verbal, ethical, historical, legal, conversational, and definition-only work must not be sent to the Canvas by default.",
      "- Live coach must pick the next move from the topic (apply, contrast, debug, extend, checkpoint) instead of a fixed elicit → draw → list loop.",
      "",
      "STATUS QUO AFTER CHANGE",
      "- Required: topic-aware chapter sequence + in-chapter moves; tasks and questions both exist; tool fit is earned.",
      "- No longer forced: always-on 'Sketch this on the Canvas', always-draw chapters, or the same workshop structure for every subject.",
      "- Unchanged: Dialog vs Project grain, Mark-as-Done multi-turn policy, chapter-map expansion/PoW, TAP surfaces.",
    ].join("\n");

    writeScratch("ile-harness-excerpts.txt", [
      "ileLearningHarnessRules inserted via {learning_harness_rules}",
      "composeSessionPlanCreatePrompt + composeSessionPlanUpdatePrompt + buildIleHeliosChatSystemPrompt",
      "ILE_SURFACE + ILE_CONTEXT_BODY: no always-draw",
    ].join("\n"));
    writeScratch("ile-harness-status-quo.txt", statusQuo);
  });
});
