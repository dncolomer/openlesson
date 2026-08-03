/**
 * UX grounding: Explore/Drill flavors → dialogue/exercise builders;
 * Simulation shares the same pure builders; LWM Snapshot is conscious-trigger only;
 * scores stay PoW-only / non-fluff.
 */
import { describe, expect, it } from "vitest";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  resolveProductIntent,
  allProductLaunchTargets,
} from "@/lib/product-intent";
import {
  buildGroundedDialogueQuestion,
  buildGroundedExerciseItem,
  buildSimulationSamplesSystemPrompt,
  buildSimulationSamplesUserPrompt,
  isMetaLearningFluff,
} from "@/lib/practice-item-builders";
import {
  deriveBlockSimulation,
  enforceSimulationProbeQuota,
  partitionSimulationProbes,
} from "@/lib/block-simulation";
import {
  buildTapOpeningQuestionFallback,
  buildTapScoreInstructions,
  type TapScoreBrief,
} from "@/lib/tap-score";
import { buildTapOpeningQuestionTask as kernelOpeningTask } from "@/lib/prompt-kernel/surfaces/tap";
import { buildDomainExerciseAuthorSystemPrompt } from "@/lib/pow-api/tapbench-exercise-quality";
import { WORKSPACE_ONTOLOGY, WORKSPACE_ONTOLOGY_COMPACT } from "@/lib/prompt-kernel";
import {
  buildVerticalScoreInstructions,
  PERFORMANCE_REMEDIATION_GUARDRAILS,
} from "@/lib/pow-api/performance-report";
import {
  SCORE_POW_CONTEXT_LAYER,
  scoreInstructionsRequirePowOnly,
  scoreInstructionsRequireSubmitStashAnalysis,
} from "@/lib/prompt-kernel/surfaces/score-context";
import { getPrompt } from "@/lib/prompts";

const ROOT = join(__dirname, "../..");
const SCRATCH =
  process.env.GOAL_SCRATCH ||
  "/var/folders/kd/98qlvkyd4mb3_9t32p9bmt_r0000gn/T/grok-goal-5d75896f22ab/implementer";

function writeEvidence(name: string, body: string) {
  try {
    mkdirSync(SCRATCH, { recursive: true });
    writeFileSync(join(SCRATCH, name), body, "utf8");
  } catch {
    /* optional */
  }
}

function read(rel: string) {
  const path = join(ROOT, rel);
  expect(existsSync(path), `missing ${rel}`).toBe(true);
  return readFileSync(path, "utf8");
}

const richCtx = {
  workspaceTitle: "Bayesian clinical reasoning",
  rootTopic: "Bayes",
  workspaceGoal: "Update clinical beliefs from test evidence correctly",
  blockTitle: "Positive predictive value",
  blockDescription:
    "Compute PPV from sensitivity, specificity, and prevalence for a diagnostic test.",
  planningPrompt: "Use medical testing examples",
  localNotes: "Prevalence dominates when base rates are low.",
};

const thinCtx = {
  workspaceTitle: "Number theory basics",
  rootTopic: "Number theory",
  blockTitle: "Modular arithmetic",
};

const sampleBrief: TapScoreBrief = {
  plan: {
    id: "ws-1",
    title: "Bayesian clinical reasoning",
    root_topic: "Bayes",
    description: "Update clinical beliefs from test evidence",
    workspace_goal: "Update clinical beliefs from test evidence correctly",
    notes: null,
  },
  nodes: [
    {
      id: "b1",
      title: "Positive predictive value",
      description:
        "Compute PPV from sensitivity, specificity, and prevalence for a diagnostic test.",
      status: "available",
    },
  ],
  sessions: [],
  focusSession: null,
};

describe("Explore/Drill × open/timed → dialogue vs exercise", () => {
  it("maps four product intents to ILE dialogue / ILE project / TAP conversational / TAP exercise", () => {
    const openExplore = resolveProductIntent("explore", "open_ended");
    const openDrill = resolveProductIntent("drill", "open_ended");
    const timedExplore = resolveProductIntent("explore", "timed");
    const timedDrill = resolveProductIntent("drill", "timed");

    expect(openExplore).toMatchObject({
      product: "ile",
      session_mode: "learning",
      id: "open_ended_explore",
    });
    expect(openDrill).toMatchObject({
      product: "ile",
      session_mode: "project",
      id: "open_ended_drill",
    });
    expect(timedExplore).toMatchObject({
      product: "tap",
      interaction_kind: "conversational",
      id: "timed_explore",
    });
    expect(timedDrill).toMatchObject({
      product: "tap",
      interaction_kind: "exercise",
      id: "timed_drill",
    });

    expect(allProductLaunchTargets()).toHaveLength(4);

    writeEvidence(
      "ux-generation-grounding.txt",
      [
        "open_explore=" + openExplore.id,
        "open_drill=" + openDrill.id,
        "timed_explore=" + timedExplore.id,
        "timed_drill=" + timedDrill.id,
      ].join("\n"),
    );
  });
});

describe("grounded dialogue + exercise builders (live + thin/guest)", () => {
  it("rich context yields subject-matter items with goal/substance, not meta fluff", () => {
    const q0 = buildGroundedDialogueQuestion(richCtx, 0);
    const q1 = buildGroundedDialogueQuestion(richCtx, 1);
    const ex0 = buildGroundedExerciseItem(richCtx, 0);

    expect(q0).toMatch(/Positive predictive value|PPV|sensitivity|prevalence/i);
    expect(q1).toMatch(/Positive predictive value|break|incorrectly|evidence/i);
    expect(isMetaLearningFluff(q0)).toBe(false);
    expect(isMetaLearningFluff(q1)).toBe(false);
    expect(ex0).toMatch(/Exercise:/i);
    expect(ex0).toMatch(/PPV|sensitivity|prevalence|Positive predictive|Bayes|diagnostic/i);
    expect(ex0).not.toMatch(/out loud/i);
    expect(isMetaLearningFluff(ex0)).toBe(false);

    // Live TAP opening fallback uses the same dialogue builder
    const liveOpen = buildTapOpeningQuestionFallback(sampleBrief);
    expect(liveOpen).toBe(buildGroundedDialogueQuestion({
      blockTitle: "Positive predictive value",
      blockDescription:
        "Compute PPV from sensitivity, specificity, and prevalence for a diagnostic test.",
      workspaceTitle: "Bayesian clinical reasoning",
      rootTopic: "Bayes",
      workspaceGoal: "Update clinical beliefs from test evidence correctly",
      workspaceDescription: "Update clinical beliefs from test evidence",
      notes: null,
    }, 0));

    const task = kernelOpeningTask();
    expect(task).toMatch(/workspace goal/i);
    expect(task).toMatch(/meta-learning|already know|approach learning/i);

    const runtime = buildTapScoreInstructions(sampleBrief, "curious", 15);
    expect(runtime).toContain("Bayesian clinical reasoning");
    expect(runtime).toContain("Positive predictive value");

    writeEvidence(
      "ux-generation-grounding.txt",
      [
        "q0=" + q0,
        "ex0=" + ex0.slice(0, 240),
        "liveOpen=" + liveOpen.slice(0, 200),
        "taskHasGoal=" + /workspace goal/i.test(task),
      ].join("\n"),
    );
  });

  it("thin/guest-like context still stays on subject matter (no meta icebreakers)", () => {
    for (let i = 0; i < 3; i++) {
      const q = buildGroundedDialogueQuestion(thinCtx, i);
      const ex = buildGroundedExerciseItem(thinCtx, i);
      expect(isMetaLearningFluff(q), `q${i}=${q}`).toBe(false);
      expect(q).toMatch(/Modular arithmetic|Number theory/i);
      expect(q).not.toMatch(/out loud/i);
      expect(ex).toMatch(/Exercise:|Modular arithmetic/i);
      expect(ex).not.toMatch(/out loud/i);
      expect(isMetaLearningFluff(ex)).toBe(false);
    }
  });
});

describe("Simulation shares live practice builders", () => {
  it("deriveBlockSimulation pads with grounded items and never primary out-loud fillers", () => {
    const sim = deriveBlockSimulation({
      title: richCtx.blockTitle,
      description: richCtx.blockDescription,
      planningPrompt: richCtx.planningPrompt,
      localNotes: richCtx.localNotes,
      workspaceGoal: richCtx.workspaceGoal,
      workspaceTitle: richCtx.workspaceTitle,
      rootTopic: richCtx.rootTopic,
      hasLocalContext: true,
      hasPlanningPrompt: true,
    });
    const { questions, exercises } = partitionSimulationProbes(sim.probes);
    expect(questions).toHaveLength(3);
    expect(exercises).toHaveLength(3);

    for (const p of sim.probes) {
      expect(p.question).not.toMatch(/\bout loud\b/i);
      expect(isMetaLearningFluff(p.question)).toBe(false);
    }
    expect(sim.intent).not.toMatch(/\bout loud\b/i);
    // Exercises should look like domain drills (Exercise: prefix common)
    expect(exercises.some((e) => /Exercise:|Solve|Apply|Construct|Work/i.test(e.question))).toBe(
      true,
    );

    // Shared builders appear in pad path
    const pad = enforceSimulationProbeQuota([], {
      title: "Modular arithmetic",
      description: "",
      workspaceGoal: "Prove modular identities",
    });
    expect(partitionSimulationProbes(pad).questions).toHaveLength(3);
    expect(partitionSimulationProbes(pad).exercises).toHaveLength(3);
    for (const p of pad) {
      expect(p.question).not.toMatch(/\bout loud\b/i);
      expect(isMetaLearningFluff(p.question)).toBe(false);
    }

    writeEvidence(
      "simulation-shared-prompts.txt",
      [
        "probeCount=" + sim.probes.length,
        "noOutLoud=" +
          String(sim.probes.every((p) => !/\bout loud\b/i.test(p.question))),
        "intent=" + sim.intent,
        "q0=" + questions[0]?.question,
        "e0=" + exercises[0]?.question.slice(0, 200),
      ].join("\n"),
    );
  });

  it("simulation LLM system/user reuse TAP opening + domain exercise builders", () => {
    const system = buildSimulationSamplesSystemPrompt();
    expect(system).toContain(kernelOpeningTask().slice(0, 40));
    expect(system).toContain(buildDomainExerciseAuthorSystemPrompt("tap_exercise").slice(0, 40));
    expect(system).toMatch(/out loud|stage direction/i);
    expect(system).toMatch(/meta-learning|already know/i);

    const user = buildSimulationSamplesUserPrompt({
      ...richCtx,
      blocks: [
        {
          id: "b1",
          title: "Positive predictive value",
          description: richCtx.blockDescription,
          position_x: 0,
          position_y: 0,
          is_start: true,
        },
      ],
      focusedBlockId: "b1",
    });
    expect(user).toMatch(/Bayesian clinical reasoning|Update clinical beliefs/i);
    expect(user).toMatch(/Positive predictive value|Block inventory|Map layout|workspace/i);

    const route = read("app/api/workspace/block-content-samples/route.ts");
    expect(route).toContain("buildSimulationSamplesSystemPrompt");
    expect(route).toContain("buildSimulationSamplesUserPrompt");
    expect(route).not.toMatch(/outline the steps or solution out loud/i);
    expect(route).toContain("practice-item-builders");

    const lib = read("lib/block-simulation.ts");
    expect(lib).toContain("buildGroundedDialogueQuestion");
    expect(lib).toContain("buildGroundedExerciseItem");
  });
});

describe("LWM Snapshot conscious trigger only", () => {
  it("full ontology matches compact: no auto snapshot on TAP/ILE end", () => {
    expect(WORKSPACE_ONTOLOGY).toMatch(/conscious trigger|not auto-run|never auto-run/i);
    expect(WORKSPACE_ONTOLOGY).not.toMatch(
      /Closing\/ending TAP or ILE always generates a snapshot/i,
    );
    expect(WORKSPACE_ONTOLOGY_COMPACT).toMatch(/not auto-run on TAP\/ILE end/i);

    // Session complete must not invoke score builders
    const tapComplete = read("app/api/workspace-tap-score/complete/route.ts");
    expect(tapComplete).not.toContain("buildVerticalScoreInstructions");
    expect(tapComplete).not.toContain("runVerticalScore");
    expect(tapComplete).toContain("uploadWorkspaceProofOfWork");

    const tapPerf = read("app/api/workspace-tap-score/performance/route.ts");
    expect(tapPerf).toMatch(/not invoked automatically|not auto/i);
    expect(tapPerf).toContain("runVerticalScore");

    const ilePerf = read("app/api/workspace-ile/performance/route.ts");
    expect(ilePerf).toMatch(/not invoked automatically|not auto/i);

    writeEvidence(
      "snapshot-trigger-contract.txt",
      [
        "ontologyConscious=" +
          /conscious trigger|never auto-run/i.test(WORKSPACE_ONTOLOGY),
        "noAlwaysOnEnd=" +
          String(
            !/Closing\/ending TAP or ILE always generates a snapshot/i.test(
              WORKSPACE_ONTOLOGY,
            ),
          ),
        "completeNoScore=" +
          String(!tapComplete.includes("runVerticalScore")),
        "perfOptional=" + /not invoked automatically|not auto/i.test(tapPerf),
      ].join("\n"),
    );
  });
});

describe("LWM PoW-only scoring (no fluff)", () => {
  it("score stack requires PoW evidence including text/traces; remediation guardrails", () => {
    const instructions = buildVerticalScoreInstructions(
      "verification",
      "b1",
      "Update clinical beliefs from test evidence correctly",
    );
    expect(scoreInstructionsRequirePowOnly(instructions)).toBe(true);
    expect(scoreInstructionsRequireSubmitStashAnalysis(instructions)).toBe(true);
    expect(instructions).toContain(SCORE_POW_CONTEXT_LAYER.slice(0, 40));
    expect(instructions).toMatch(/actual text content|trace\/transcript text|quoted or paraphrased/i);
    expect(instructions).toMatch(/LLM-style fluff|never fabricate|thin-signal/i);
    expect(instructions).toContain(PERFORMANCE_REMEDIATION_GUARDRAILS.slice(0, 40));
    expect(instructions).toMatch(/Never recommend Uncertain Systems platform mechanics|never recommend TAP/i);

    writeEvidence(
      "lwm-pow-scoring.txt",
      [
        "powOnly=" + scoreInstructionsRequirePowOnly(instructions),
        "submitStash=" + scoreInstructionsRequireSubmitStashAnalysis(instructions),
        "hasTextEvidence=" +
          /actual text content|trace\/transcript text/i.test(instructions),
        "hasFluffBan=" + /LLM-style fluff|never fabricate/i.test(instructions),
        "remediation=" + instructions.includes(PERFORMANCE_REMEDIATION_GUARDRAILS.slice(0, 20)),
      ].join("\n"),
    );
  });
});

describe("ILE registry opening stays subject-grounded", () => {
  it("opening_probe bans meta icebreakers and out-loud", () => {
    const opening = getPrompt("opening_probe");
    expect(opening).toMatch(/already know|meta/i);
    expect(opening).toMatch(/out loud/i);
    expect(opening).toMatch(/subject matter|workspace\/chapter goal|THIS problem/i);
  });
});

describe("opening task is the shipped live generator contract", () => {
  it("kernel opening task is non-empty and used by generateTapOpeningQuestion path", () => {
    expect(kernelOpeningTask().length).toBeGreaterThan(80);
    const tapScoreSrc = read("lib/tap-score.ts");
    expect(tapScoreSrc).toContain("buildTapOpeningQuestionTask");
    expect(tapScoreSrc).toContain("buildGroundedDialogueQuestion");
  });
});
