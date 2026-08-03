/**
 * Simulation: 3 questions + 3 exercises + compact context influence labels.
 */
import { describe, expect, it } from "vitest";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  collectBlockContextInfluenceLabels,
  deriveBlockSimulation,
  enforceSimulationProbeQuota,
  normalizeSimulationPayload,
  partitionSimulationProbes,
  SIMULATION_EXERCISE_COUNT,
  SIMULATION_QUESTION_COUNT,
  simulationReadinessScore,
} from "@/lib/block-simulation";

const ROOT = join(__dirname, "../..");
const SCRATCH =
  process.env.SIMULATION_SCRATCH ||
  process.env.GOAL_SCRATCH ||
  "/var/folders/kd/98qlvkyd4mb3_9t32p9bmt_r0000gn/T/grok-goal-6f69e1cd52d7/implementer";

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

describe("deriveBlockSimulation", () => {
  it("always yields 3 questions + 3 exercises with influence labels when context present", () => {
    const sim = deriveBlockSimulation({
      title: "Bayes rule",
      description: "Update beliefs with evidence. How do priors work?",
      planningPrompt: "Use medical testing examples",
      localNotes: "Sensitivity vs specificity matters.",
      hasLocalContext: true,
      hasPlanningPrompt: true,
      localFileNames: ["lab-notes.md"],
      externalLabels: ["Khan Academy"],
    });
    const { questions, exercises } = partitionSimulationProbes(sim.probes);
    expect(questions).toHaveLength(SIMULATION_QUESTION_COUNT);
    expect(exercises).toHaveLength(SIMULATION_EXERCISE_COUNT);
    expect(sim.probes).toHaveLength(
      SIMULATION_QUESTION_COUNT + SIMULATION_EXERCISE_COUNT,
    );
    expect(sim.intent).toMatch(/beliefs|Bayes|evidence/i);
    expect(sim.readiness.find((r) => r.id === "local_context")?.met).toBe(true);

    const labels = collectBlockContextInfluenceLabels({
      title: "Bayes rule",
      description: "Update beliefs with evidence.",
      planningPrompt: "Use medical testing examples",
      localNotes: "Sensitivity vs specificity matters.",
      hasLocalContext: true,
      localFileNames: ["lab-notes.md"],
      externalLabels: ["Khan Academy"],
    });
    expect(labels).toEqual(
      expect.arrayContaining([
        "Title",
        "Description",
        "Planning prompt",
        "Local notes",
        "lab-notes.md",
      ]),
    );

    // Every seed probe should carry at least one influence chip when context is rich
    const withInfluence = sim.probes.filter(
      (p) => p.contextSources && p.contextSources.length > 0,
    );
    expect(withInfluence.length).toBe(sim.probes.length);
    expect(sim.probes.some((p) => p.contextSources?.includes("Title"))).toBe(
      true,
    );

    const score = simulationReadinessScore(sim.readiness);
    expect(score.met).toBeGreaterThanOrEqual(3);

    writeEvidence(
      "simulation-3q3e.log",
      [
        "qCount=" + questions.length,
        "eCount=" + exercises.length,
        "totalProbes=" + sim.probes.length,
        "influenceCovered=" + withInfluence.length,
        "hasTitleInfluence=" +
          String(sim.probes.some((p) => p.contextSources?.includes("Title"))),
        "labels=" + labels.join("|"),
      ].join("\n"),
    );
  });

  it("sparse block still returns 3+3 without inventing fake influence crashes", () => {
    const sim = deriveBlockSimulation({ title: "X" });
    const { questions, exercises } = partitionSimulationProbes(sim.probes);
    expect(questions).toHaveLength(3);
    expect(exercises).toHaveLength(3);
    // Title-only influence is fine; no crash when empty arrays
    for (const p of sim.probes) {
      expect(Array.isArray(p.contextSources) || p.contextSources == null).toBe(
        true,
      );
    }
  });

  it("normalizeSimulationPayload enforces 3+3 and keeps valid contextSources", () => {
    const fromProbes = normalizeSimulationPayload(
      {
        intent: "Practice Bayesian updates",
        outcome: "Explain a prior/posterior shift",
        topics: ["Priors", "Likelihood"],
        probes: [
          {
            question: "What changes when you get a positive test?",
            coachCue: "Name prior, likelihood, posterior.",
            difficulty: "core",
            kind: "question",
            contextSources: ["Description", "Local notes", ""],
          },
          {
            question: "Outline a short drill applying Bayes to a medical test.",
            kind: "exercise",
            contextSources: ["Planning prompt"],
          },
        ],
        exercises: [
          "Work a second medical-test Bayes problem out loud.",
          "Compare two priors for the same test result.",
        ],
        questions: [
          "How does the prior affect the posterior?",
          "When is a test result most informative?",
        ],
      },
      {
        title: "Bayes rule",
        description: "Update beliefs with evidence.",
        localNotes: "Sensitivity matters.",
        hasLocalContext: true,
      },
    );
    const parts = partitionSimulationProbes(fromProbes.probes);
    expect(parts.questions).toHaveLength(3);
    expect(parts.exercises).toHaveLength(3);
    // First question keeps probe contextSources (empty strings dropped)
    const q0 = parts.questions[0];
    expect(q0.contextSources).toEqual(["Description", "Local notes"]);
    // Exercise from probes keeps Planning prompt even when string exercises[] present
    expect(
      parts.exercises.some((e) =>
        e.contextSources?.includes("Planning prompt"),
      ),
    ).toBe(true);

    // Dual full 3q+3e probes + string exercises[] must not clobber probe exercise CS
    const dual = normalizeSimulationPayload(
      {
        probes: [
          {
            question: "Q1 what is the prior in this setup?",
            kind: "question",
            contextSources: ["Title"],
          },
          {
            question: "Q2 how does likelihood enter the update?",
            kind: "question",
            contextSources: ["Description"],
          },
          {
            question: "Q3 when is the posterior most shifted?",
            kind: "question",
            contextSources: ["Local notes"],
          },
          {
            question: "E1 work a medical Bayes problem out loud.",
            kind: "exercise",
            contextSources: ["Planning prompt", "Local notes"],
          },
          {
            question: "E2 compare two priors for one test result.",
            kind: "exercise",
            contextSources: ["Description"],
          },
          {
            question: "E3 invent a mini Bayes case and solve steps.",
            kind: "exercise",
            contextSources: ["Title", "Local context"],
          },
        ],
        // Common LLM path: also returns string exercises without CS
        exercises: [
          "String exercise A without influence labels.",
          "String exercise B without influence labels.",
          "String exercise C without influence labels.",
        ],
        questions: [
          "String question A without influence labels?",
          "String question B without influence labels?",
        ],
      },
      {
        title: "Bayes rule",
        description: "Update beliefs with evidence.",
        planningPrompt: "Medical testing",
        localNotes: "Sensitivity",
        hasLocalContext: true,
      },
    );
    const dualParts = partitionSimulationProbes(dual.probes);
    expect(dualParts.questions).toHaveLength(3);
    expect(dualParts.exercises).toHaveLength(3);
    // Probe exercise CS must survive string exercises[] (no clobber)
    expect(dualParts.exercises[0].contextSources).toEqual([
      "Planning prompt",
      "Local notes",
    ]);
    expect(dualParts.exercises[1].contextSources).toEqual(["Description"]);
    expect(dualParts.exercises[2].contextSources).toEqual([
      "Title",
      "Local context",
    ]);
    // Probe question CS also preserved
    expect(dualParts.questions[0].contextSources).toEqual(["Title"]);
    expect(dualParts.questions.map((q) => q.question).join(" ")).not.toMatch(
      /String exercise/,
    );

    // Legacy questions-only still pads to 3+3
    const fromQuestions = normalizeSimulationPayload(
      {
        topics: ["A"],
        questions: ["What is the core idea of Bayes rule?"],
      },
      { title: "Bayes rule" },
    );
    expect(partitionSimulationProbes(fromQuestions.probes).questions).toHaveLength(
      3,
    );
    expect(partitionSimulationProbes(fromQuestions.probes).exercises).toHaveLength(
      3,
    );

    // enforce helper trims excess
    const many = enforceSimulationProbeQuota(
      Array.from({ length: 10 }, (_, i) => ({
        id: `p-${i}`,
        question: `Question number ${i} about the topic in detail?`,
        coachCue: "ok",
        difficulty: "core" as const,
        kind: "question" as const,
      })),
      { title: "T" },
    );
    expect(partitionSimulationProbes(many).questions).toHaveLength(3);
    expect(partitionSimulationProbes(many).exercises).toHaveLength(3);

    writeEvidence(
      "simulation-3q3e.log",
      [
        "qCount=" + parts.questions.length,
        "eCount=" + parts.exercises.length,
        "probeQ0cs=" + (q0.contextSources || []).join("|"),
        "dualEx0cs=" + (dualParts.exercises[0].contextSources || []).join("|"),
        "dualExPreserved=" +
          String(
            dualParts.exercises[0].contextSources?.includes("Planning prompt") ===
              true,
          ),
        "stringExNotClobber=" +
          String(
            !dualParts.exercises.some((e) =>
              /String exercise/.test(e.question),
            ),
          ),
      ].join("\n"),
    );
  });
});

describe("structural: Simulation panel 3+3 + compact influence", () => {
  it("panel shows question/exercise groups and context chips", () => {
    const panel = read("components/WorkspaceBlockSimulationPanel.tsx");
    expect(panel).toContain("data-simulation-questions");
    expect(panel).toContain("data-simulation-exercises");
    expect(panel).toContain("data-simulation-context-sources");
    expect(panel).toContain("data-context-source-chip");
    expect(panel).toContain("partitionSimulationProbes");
    expect(panel).toContain("SIMULATION_QUESTION_COUNT");
    expect(panel).toContain("SIMULATION_EXERCISE_COUNT");
    expect(panel).toContain("contextSources");
    // Compact chips, not a large secondary panel
    expect(panel).toContain("text-[9px]");
    expect(panel).not.toMatch(/provenance graph|full panel wizard/i);

    const lib = read("lib/block-simulation.ts");
    expect(lib).toContain("export function enforceSimulationProbeQuota");
    expect(lib).toContain("contextSources");
    expect(lib).toContain("collectBlockContextInfluenceLabels");

    const api = read("app/api/workspace/block-content-samples/route.ts");
    // Simulation LLM path reuses shared practice-item builders (not ad-hoc out-loud fillers).
    expect(api).toContain("buildSimulationSamplesSystemPrompt");
    expect(api).toContain("buildSimulationSamplesUserPrompt");
    expect(api).toContain("practice-item-builders");
    const practiceBuilders = read("lib/practice-item-builders.ts");
    expect(practiceBuilders).toMatch(/Exactly 3 questions and 3 exercises/i);
    expect(practiceBuilders).toContain("contextSources");

    writeEvidence(
      "simulation-context-influence-ui.log",
      [
        "hasQuestionsGroup=" + panel.includes("data-simulation-questions"),
        "hasExercisesGroup=" + panel.includes("data-simulation-exercises"),
        "hasChips=" + panel.includes("data-context-source-chip"),
        "hasSourcesWrap=" + panel.includes("data-simulation-context-sources"),
        "usesPartition=" + panel.includes("partitionSimulationProbes"),
        "apiAsks3=" + /EXACTLY 3/i.test(api),
        "libEnforcesQuota=" + lib.includes("enforceSimulationProbeQuota"),
      ].join("\n"),
    );
  });
});
