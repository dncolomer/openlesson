import { describe, expect, it } from "vitest";
import { buildTapStartingTopicsFallback } from "@/lib/tap-score";

const baseBrief = {
  plan: {
    id: "plan-1",
    title: "Quantum Error Correction",
    root_topic: "Quantum computing",
    description: "Intro block",
    notes: null,
  },
  nodes: [],
  sessions: [],
  focusSession: null,
};

describe("buildTapStartingTopicsFallback", () => {
  it("returns three workspace angles when no blocks are available", () => {
    const topics = buildTapStartingTopicsFallback(baseBrief);
    expect(topics).toHaveLength(3);
    expect(topics.every((topic) => topic.openingQuestion.length > 0)).toBe(true);
  });

  it("returns three angles for a single focused block", () => {
    const topics = buildTapStartingTopicsFallback({
      ...baseBrief,
      nodes: [
        {
          id: "block-1",
          title: "Stabilizer codes",
          description: "Detect and correct qubit errors",
          status: "active",
        },
      ],
    });

    expect(topics).toHaveLength(3);
    expect(topics[0].title).toContain("Stabilizer codes");
  });

  it("maps up to three block titles when multiple blocks exist", () => {
    const topics = buildTapStartingTopicsFallback({
      ...baseBrief,
      nodes: [
        { id: "b1", title: "Noise models", description: null, status: null },
        { id: "b2", title: "Syndrome extraction", description: null, status: null },
        { id: "b3", title: "Logical qubits", description: null, status: null },
      ],
    });

    expect(topics.map((topic) => topic.title)).toEqual([
      "Noise models",
      "Syndrome extraction",
      "Logical qubits",
    ]);
  });
});