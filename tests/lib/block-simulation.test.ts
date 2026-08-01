import { describe, expect, it } from "vitest";
import {
  deriveBlockSimulation,
  normalizeSimulationPayload,
  simulationReadinessScore,
} from "@/lib/block-simulation";

describe("deriveBlockSimulation", () => {
  it("builds intent, probes, and readiness from block text", () => {
    const sim = deriveBlockSimulation({
      title: "Bayes rule",
      description: "Update beliefs with evidence. How do priors work?",
      planningPrompt: "Use medical testing examples",
      localNotes: "Sensitivity vs specificity matters.",
      hasLocalContext: true,
      hasPlanningPrompt: true,
    });
    expect(sim.intent).toMatch(/beliefs|Bayes|evidence/i);
    expect(sim.outcome.length).toBeGreaterThan(10);
    expect(sim.topics.some((t) => /Bayes/i.test(t))).toBe(true);
    expect(sim.probes.length).toBeGreaterThan(0);
    expect(sim.probes[0].coachCue.length).toBeGreaterThan(10);
    expect(sim.readiness.find((r) => r.id === "local_context")?.met).toBe(true);
    const score = simulationReadinessScore(sim.readiness);
    expect(score.met).toBeGreaterThanOrEqual(3);
  });

  it("normalizeSimulationPayload accepts LLM probes + legacy questions", () => {
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
          },
        ],
      },
      { title: "Bayes rule" },
    );
    expect(fromProbes.intent).toMatch(/Bayesian/i);
    expect(fromProbes.probes).toHaveLength(1);
    expect(fromProbes.probes[0].difficulty).toBe("core");

    const fromQuestions = normalizeSimulationPayload(
      {
        topics: ["A"],
        questions: ["What is the core idea of Bayes rule?"],
      },
      { title: "Bayes rule" },
    );
    expect(fromQuestions.probes.length).toBeGreaterThan(0);
  });
});
