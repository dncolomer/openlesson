/**
 * Simulation: model-only probes (no pure Q/E seed); normalize keeps model text.
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
  "/var/folders/kd/98qlvkyd4mb3_9t32p9bmt_r0000gn/T/grok-goal-b9f3cd91f3ba/implementer";

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
  it("does not seed pure Q/E templates (empty probes until xAI regenerate)", () => {
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
    expect(questions).toHaveLength(0);
    expect(exercises).toHaveLength(0);
    expect(sim.probes).toHaveLength(0);
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

    const score = simulationReadinessScore(sim.readiness);
    expect(score.total).toBeGreaterThan(0);

    writeEvidence(
      "simulation-no-pure-seed.log",
      [
        "qCount=" + questions.length,
        "eCount=" + exercises.length,
        "totalProbes=" + sim.probes.length,
        "labels=" + labels.join("|"),
      ].join("\n"),
    );
  });

  it("sparse block still has empty probes without crashing", () => {
    const sim = deriveBlockSimulation({ title: "X" });
    expect(sim.probes).toHaveLength(0);
  });

  it("normalizeSimulationPayload keeps model probes only (no pure pad to 3+3)", () => {
    const fromProbes = normalizeSimulationPayload(
      {
        intent: "Practice Bayes",
        outcome: "Update beliefs correctly",
        probes: [
          {
            question: "What is the prior in this setup?",
            kind: "question",
            difficulty: "warmup",
          },
          {
            question: "Exercise: Compute PPV for sens 0.9, spec 0.9, prev 0.01.",
            kind: "exercise",
            difficulty: "stretch",
          },
        ],
      },
      {
        title: "Bayes rule",
        description: "Update beliefs with evidence.",
      },
    );
    const { questions, exercises } = partitionSimulationProbes(fromProbes.probes);
    expect(questions.length).toBe(1);
    expect(exercises.length).toBe(1);
    expect(questions[0].question).toMatch(/prior/i);
    expect(exercises[0].question).toMatch(/PPV|sens/i);
    // Must not inject pure grounded shells
    expect(fromProbes.probes.map((p) => p.question).join("\n")).not.toMatch(
      /attachments\s*:|Given parameters\s+A\s*=|Work this fixed problem/i,
    );

    const empty = normalizeSimulationPayload(null, { title: "X" });
    expect(empty.probes).toHaveLength(0);

    writeEvidence(
      "simulation-normalize-model-only.log",
      "q=" + questions[0].question + "\ne=" + exercises[0].question,
    );
  });

  it("enforceSimulationProbeQuota caps without padding pure synth", () => {
    const out = enforceSimulationProbeQuota(
      [
        { id: "a", question: "Model Q1?", coachCue: "", difficulty: "warmup", kind: "question" },
        { id: "b", question: "Model Q2?", coachCue: "", difficulty: "core", kind: "question" },
        { id: "c", question: "Model Q3?", coachCue: "", difficulty: "core", kind: "question" },
        { id: "d", question: "Model Q4?", coachCue: "", difficulty: "core", kind: "question" },
        {
          id: "e",
          question: "Exercise: Model E1",
          coachCue: "",
          difficulty: "stretch",
          kind: "exercise",
        },
      ],
      { title: "T" },
    );
    const { questions, exercises } = partitionSimulationProbes(out);
    expect(questions.length).toBeLessThanOrEqual(SIMULATION_QUESTION_COUNT);
    expect(exercises.length).toBeLessThanOrEqual(SIMULATION_EXERCISE_COUNT);
    expect(questions).toHaveLength(3);
    expect(exercises).toHaveLength(1);
  });

  it("panel does not show pure seed as default Q/E list", () => {
    const panel = read("components/WorkspaceBlockSimulationPanel.tsx");
    expect(panel).toContain("deriveBlockSimulation");
    expect(panel).toContain("normalizeSimulationPayload");
    expect(panel).toMatch(/click Regenerate for xAI|No sample questions yet/i);
  });
});
