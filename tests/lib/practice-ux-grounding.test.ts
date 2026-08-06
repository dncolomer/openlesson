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
  partitionSimulationProbes,
} from "@/lib/block-simulation";
import { deriveWorkspaceSimulationOverview } from "@/lib/workspace-simulation-overview";
import { deriveSimulationSamples } from "@/lib/workspace-simulation-samples";
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
    expect(q1).toMatch(/Positive predictive value|mistake|wrong|catch|signal|break/i);
    // Never the banned meta wrapper the product was still shipping
    for (const q of [q0, q1, buildGroundedDialogueQuestion(richCtx, 2)]) {
      expect(q).not.toMatch(/core mechanism/i);
      expect(q).not.toMatch(/explain it precisely/i);
      expect(q).not.toMatch(/central claim/i);
      expect(isMetaLearningFluff(q)).toBe(false);
    }
    expect(ex0).toMatch(/Exercise:/i);
    expect(ex0).toMatch(/PPV|sensitivity|prevalence|Positive predictive|Bayes|diagnostic/i);
    expect(ex0).toMatch(/\d/); // concrete numbers, not invent-your-own
    expect(ex0).not.toMatch(/out loud/i);
    expect(ex0).not.toMatch(/state the problem you chose|non-trivial problem in|stay within this scope/i);
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
    expect(liveOpen).not.toMatch(/core mechanism|explain it precisely/i);

    const task = kernelOpeningTask();
    expect(task).toMatch(/workspace goal/i);
    expect(task).toMatch(/meta-learning|already know|approach learning/i);
    expect(task).toMatch(/core mechanism|explain it precisely/i);

    const simSys = buildSimulationSamplesSystemPrompt();
    expect(simSys).toMatch(/core mechanism|explain it precisely/i);
    expect(simSys).toMatch(/FORBIDDEN/i);

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
        "noCoreMechanism=" + !/core mechanism/i.test(q0),
      ].join("\n"),
    );
  });

  it("rejects the quantum-style generic meta wrapper and rewrites via builders", () => {
    const bad =
      'What is the core mechanism in "Bridging Quantum Optimization and Linear Algebra Techniques" — specifically: Explore how quantum optimization methods intersect with linear algebra primitives such as HHL and quantum singular value estimation. This b… — and how would you explain it precisely?';
    expect(isMetaLearningFluff(bad)).toBe(true);

    // Same block fields would have produced the old meta template; new builder is concrete.
    const fixed = buildGroundedDialogueQuestion(
      {
        blockTitle: "Bridging Quantum Optimization and Linear Algebra Techniques",
        blockDescription:
          "Explore how quantum optimization methods intersect with linear algebra primitives such as HHL and quantum singular value estimation.",
        workspaceTitle: "Quantum computing",
        workspaceGoal: "Connect optimization algorithms to linear-algebra primitives",
      },
      0,
    );
    expect(isMetaLearningFluff(fixed)).toBe(false);
    expect(fixed).not.toMatch(/core mechanism/i);
    expect(fixed).not.toMatch(/explain it precisely/i);
    // Description is an Explore-how blurb → treated as overview; still subject-grounded
    expect(fixed).toMatch(
      /Quantum|HHL|optimization|Linear Algebra|Bridging/i,
    );

    // Simulation sanitize path replaces LLM meta questions
    const sim = deriveBlockSimulation({
      title: "Bridging Quantum Optimization and Linear Algebra Techniques",
      description:
        "Explore how quantum optimization methods intersect with linear algebra primitives such as HHL and quantum singular value estimation.",
      workspaceGoal: "Connect optimization algorithms to linear-algebra primitives",
      workspaceTitle: "Quantum computing",
    });
    for (const p of partitionSimulationProbes(sim.probes).questions) {
      expect(isMetaLearningFluff(p.question), p.question).toBe(false);
      expect(p.question).not.toMatch(/core mechanism|explain it precisely/i);
    }

    writeEvidence(
      "ux-meta-question-ban.txt",
      [
        "bad_is_meta=" + isMetaLearningFluff(bad),
        "fixed=" + fixed,
        "sim_q0=" + partitionSimulationProbes(sim.probes).questions[0]?.question,
      ].join("\n"),
    );
  });

  it("thin/guest-like context still stays on subject matter (no meta icebreakers)", () => {
    for (let i = 0; i < 3; i++) {
      const q = buildGroundedDialogueQuestion(thinCtx, i);
      const ex = buildGroundedExerciseItem(thinCtx, i);
      expect(isMetaLearningFluff(q), `q${i}=${q}`).toBe(false);
      expect(q).toMatch(/Modular arithmetic|Number theory/i);
      expect(q).not.toMatch(/out loud|core mechanism|explain it precisely|central claim/i);
      expect(ex).toMatch(/Exercise:|Modular arithmetic|mod /i);
      expect(ex).not.toMatch(/out loud/i);
      expect(ex).not.toMatch(
        /state the problem you chose|non-trivial problem in|stay within this scope/i,
      );
      expect(isMetaLearningFluff(ex)).toBe(false);
    }
  });

  it("quadratic simulation-style fallback is a fixed equation problem", () => {
    const ex = buildGroundedExerciseItem(
      {
        blockTitle: "Quadratic Formula Setup and Exact Solutions",
        blockDescription:
          "Identify a, b, and c in standard form, substitute carefully into the quadratic formula, and simplify radical answers. Extends factoring and completing-the-square work by handling equations that do not factor cleanly while linking to discriminant checks on root type.",
        workspaceTitle: "HS Algebra",
        workspaceGoal: "Solve quadratic equations exactly",
      },
      0,
    );
    expect(ex).toMatch(/Exercise:/i);
    expect(ex).toMatch(/x²|x\^2|discriminant|quadratic formula/i);
    expect(ex).toMatch(/\d/);
    expect(ex).not.toMatch(/state the problem you chose/i);
    expect(ex).not.toMatch(/solve a non-trivial problem in/i);
    expect(ex).not.toMatch(/stay within this scope/i);
    expect(isMetaLearningFluff(ex)).toBe(false);
  });

  it("materials-rich non-STEM (Scrum) seed/fallback has no attachment dump or A/B/C shell", () => {
    const scrumCtx = {
      workspaceTitle: "Scrum Methodology Fundamentals from the Official Guide",
      rootTopic: "Scrum",
      workspaceGoal: "Validate SCRUM related Skills and Knowledge",
      blockTitle: "Scrum Methodology Fundamentals from the Official Guide",
      blockDescription:
        "Roles, events, and artifacts from the Scrum Guide for validating practitioner skill.",
      files: [
        { name: "[external] Scrum Guide (Official)" },
        { name: "[external] Atlassian Agile Coach — Scrum" },
        { name: "[external] Scrum Alliance — What is Scrum?" },
      ],
      externalLinks: [
        {
          title: "Scrum Guide (Official)",
          url: "https://scrumguides.org/",
          description: "The official Scrum Guide definition of roles, events, and artifacts.",
        },
        {
          title: "Atlassian Agile Coach — Scrum",
          url: "https://www.atlassian.com/agile/scrum",
        },
      ],
    };

    const forbidden = [
      /attachments\s*:/i,
      /\[external\]/i,
      /Given parameters\s+A\s*=/i,
      /Work this fixed problem in/i,
      /do not invent a different problem/i,
      /Context skill:/i,
      /Using “.+” on this setup\s*—/i,
      /Using attached materials\s*\(/i,
    ];

    const questions = [0, 1, 2].map((i) => buildGroundedDialogueQuestion(scrumCtx, i));
    const exercises = [0, 1, 2].map((i) => buildGroundedExerciseItem(scrumCtx, i));

    for (const q of questions) {
      expect(q.length, q).toBeGreaterThan(40);
      expect(isMetaLearningFluff(q), q).toBe(false);
      for (const re of forbidden) {
        expect(q, `q forbidden ${re}: ${q}`).not.toMatch(re);
      }
      // Domain-grounded: Scrum/goal substance, not empty scaffold
      expect(q).toMatch(/Scrum|SCRUM|sprint|Increment|artifact|verification|outcome|practitioner/i);
    }

    for (const ex of exercises) {
      expect(ex.length, ex).toBeGreaterThan(60);
      expect(ex).toMatch(/Exercise:/i);
      expect(isMetaLearningFluff(ex), ex).toBe(false);
      for (const re of forbidden) {
        expect(ex, `ex forbidden ${re}: ${ex}`).not.toMatch(re);
      }
      // Checkable multi-part domain judgment, not invent-your-own
      expect(ex).toMatch(/\(\s*a\s*\)|\bpass\/fail\b|\bbox\b/i);
      expect(ex).toMatch(/Scrum|SCRUM|practice|verification|outcome|definition|artifact/i);
    }

    // Simulation seed path shares the same builders
    const seed = deriveSimulationSamples(
      { kind: "block", blockId: "b-scrum" },
      {
        workspaceTitle: scrumCtx.workspaceTitle,
        rootTopic: scrumCtx.rootTopic,
        workspaceGoal: scrumCtx.workspaceGoal,
        blocks: [
          {
            id: "b-scrum",
            title: scrumCtx.blockTitle,
            description: scrumCtx.blockDescription,
          },
        ],
        externalResources: scrumCtx.externalLinks,
        files: scrumCtx.files,
      },
    );
    for (const q of seed.questions) {
      for (const re of forbidden) {
        expect(q, `seed q: ${q}`).not.toMatch(re);
      }
    }
    for (const ex of seed.exercises) {
      for (const re of forbidden) {
        expect(ex, `seed ex: ${ex}`).not.toMatch(re);
      }
    }

    writeEvidence(
      "genuine-practice-scrum.txt",
      [
        "q0=" + questions[0],
        "q1=" + questions[1],
        "ex0=" + exercises[0].slice(0, 280),
        "seed_q0=" + seed.questions[0],
        "seed_ex0=" + (seed.exercises[0] || "").slice(0, 200),
      ].join("\n"),
    );
  });
});

describe("Simulation shares live practice builders", () => {
  it("deriveBlockSimulation questions equal buildGroundedDialogueQuestion (rich + thin)", () => {
    const groundRich = {
      title: richCtx.blockTitle,
      description: richCtx.blockDescription,
      planningPrompt: richCtx.planningPrompt,
      localNotes: richCtx.localNotes,
      workspaceGoal: richCtx.workspaceGoal,
      workspaceTitle: richCtx.workspaceTitle,
      rootTopic: richCtx.rootTopic,
      hasLocalContext: true,
      hasPlanningPrompt: true,
    };
    const simRich = deriveBlockSimulation(groundRich);
    const { questions: qRich, exercises: eRich } =
      partitionSimulationProbes(simRich.probes);
    expect(qRich).toHaveLength(3);
    expect(eRich).toHaveLength(3);

    const liveCtx = {
      blockTitle: richCtx.blockTitle,
      blockDescription: richCtx.blockDescription,
      workspaceGoal: richCtx.workspaceGoal,
      workspaceTitle: richCtx.workspaceTitle,
      rootTopic: richCtx.rootTopic,
      planningPrompt: richCtx.planningPrompt,
      localNotes: richCtx.localNotes,
    };
    for (let i = 0; i < 3; i++) {
      expect(qRich[i].question).toBe(buildGroundedDialogueQuestion(liveCtx, i));
      expect(eRich[i].question).toBe(buildGroundedExerciseItem(liveCtx, i));
    }

    // Live TAP opening fallback is the same dialogue builder index 0
    expect(qRich[0].question).toBe(
      buildTapOpeningQuestionFallback({
        plan: {
          id: "ws",
          title: richCtx.workspaceTitle!,
          root_topic: richCtx.rootTopic!,
          description: null,
          workspace_goal: richCtx.workspaceGoal,
          notes: null,
        },
        nodes: [
          {
            id: "b1",
            title: richCtx.blockTitle!,
            description: richCtx.blockDescription!,
            status: "available",
          },
        ],
        sessions: [],
        focusSession: null,
      }),
    );

    // Thin context equality
    const simThin = deriveBlockSimulation({
      title: thinCtx.blockTitle,
      workspaceTitle: thinCtx.workspaceTitle,
      rootTopic: thinCtx.rootTopic,
    });
    const { questions: qThin, exercises: eThin } =
      partitionSimulationProbes(simThin.probes);
    for (let i = 0; i < 3; i++) {
      expect(qThin[i].question).toBe(buildGroundedDialogueQuestion(thinCtx, i));
      expect(eThin[i].question).toBe(buildGroundedExerciseItem(thinCtx, i));
      expect(isMetaLearningFluff(qThin[i].question)).toBe(false);
    }

    for (const p of simRich.probes) {
      expect(p.question).not.toMatch(/\bout loud\b/i);
      expect(isMetaLearningFluff(p.question)).toBe(false);
    }
    expect(simRich.intent).not.toMatch(/\bout loud\b/i);

    writeEvidence(
      "simulation-shared-prompts.txt",
      [
        "probeCount=" + simRich.probes.length,
        "simQ0_eq_live=" +
          String(qRich[0].question === buildGroundedDialogueQuestion(liveCtx, 0)),
        "simE0_eq_live=" +
          String(eRich[0].question === buildGroundedExerciseItem(liveCtx, 0)),
        "thinQ0_eq_live=" +
          String(qThin[0].question === buildGroundedDialogueQuestion(thinCtx, 0)),
        "noOutLoud=" +
          String(simRich.probes.every((p) => !/\bout loud\b/i.test(p.question))),
        "q0=" + qRich[0]?.question,
        "e0=" + eRich[0]?.question.slice(0, 200),
      ].join("\n"),
    );
  });

  it("drawer + overview UI wire workspaceGoal into deriveBlockSimulation", () => {
    const panel = read("components/WorkspaceBlockSimulationPanel.tsx");
    expect(panel).toMatch(/workspaceGoal:\s*workspaceGoal/);
    expect(panel).toMatch(/workspaceTitle:\s*workspaceTitle/);
    expect(panel).toContain("notes: workspaceNotes");

    const detail = read("components/WorkspaceBlockDetailPane.tsx");
    expect(detail).toContain("workspaceGoal={workspaceGoal}");
    expect(detail).toContain("workspaceTitle={workspaceTitle}");

    const view = read("components/WorkspaceView.tsx");
    expect(view).toMatch(/workspaceGoal=\{plan\.workspace_goal\}/);

    const overview = deriveWorkspaceSimulationOverview(
      [
        {
          id: "b1",
          title: richCtx.blockTitle,
          description: richCtx.blockDescription,
          is_start: true,
        },
      ],
      {
        workspaceTitle: richCtx.workspaceTitle,
        workspaceGoal: richCtx.workspaceGoal,
        rootTopic: richCtx.rootTopic,
      },
    );
    expect(overview.sampleProbes.length).toBeGreaterThan(0);
    const firstQ = overview.sampleProbes[0].questions[0]?.question;
    expect(firstQ).toBe(
      buildGroundedDialogueQuestion(
        {
          blockTitle: richCtx.blockTitle,
          blockDescription: richCtx.blockDescription,
          workspaceGoal: richCtx.workspaceGoal,
          workspaceTitle: richCtx.workspaceTitle,
          rootTopic: richCtx.rootTopic,
        },
        0,
      ),
    );

    const tab = read("components/WorkspaceSimulationPanel.tsx");
    // Tab redo: scope + generate samples via real builders (not overview-only)
    expect(tab).toContain("deriveSimulationSamples");
    expect(tab).toContain("workspaceGoal");
    expect(tab).toContain("data-simulation-generate");
    expect(tab).toContain("/api/workspace/simulation-samples");
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

    // Workspace Simulation tab API also uses shared real-prompt path
    const tabRoute = read("app/api/workspace/simulation-samples/route.ts");
    expect(tabRoute).toContain("buildSimulationSamplePrompts");
    expect(tabRoute).toContain("workspace-simulation-samples");
    expect(tabRoute).toMatch(/scope|blockId/);

    const lib = read("lib/block-simulation.ts");
    expect(lib).toContain("buildGroundedDialogueQuestion");
    expect(lib).toContain("buildGroundedExerciseItem");

    const samplesLib = read("lib/workspace-simulation-samples.ts");
    expect(samplesLib).toContain("buildGroundedDialogueQuestion");
    expect(samplesLib).toContain("buildGroundedExerciseItem");
    expect(samplesLib).toContain("buildSimulationSamplesSystemPrompt");
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
