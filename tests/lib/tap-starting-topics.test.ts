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

  it("returns three generic angles for a single focused block (no title shells)", () => {
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
    // Offline fallback: generic card titles — not block-title shells
    expect(topics[0].title).toBe("Core idea");
    expect(topics.map((t) => t.title)).toEqual([
      "Core idea",
      "Why it matters",
      "Apply and transfer",
    ]);
    for (const t of topics) {
      expect(t.openingQuestion.length).toBeGreaterThan(20);
      expect(t.openingQuestion).not.toMatch(
        /Stabilizer codes|attachments\s*:|Given parameters\s+A\s*=|on this setup/i,
      );
    }
  });

  it("returns three generic openings when multiple blocks exist (no block-title shells)", () => {
    const topics = buildTapStartingTopicsFallback({
      ...baseBrief,
      nodes: [
        { id: "b1", title: "Noise models", description: null, status: null },
        { id: "b2", title: "Syndrome extraction", description: null, status: null },
        { id: "b3", title: "Logical qubits", description: null, status: null },
      ],
    });

    expect(topics).toHaveLength(3);
    // Prefer raw xAI topics when available; offline fallback stays generic
    expect(topics.every((t) => t.openingQuestion.length > 20)).toBe(true);
    for (const t of topics) {
      expect(t.title + t.openingQuestion).not.toMatch(
        /Noise models|Syndrome extraction|Logical qubits/i,
      );
      expect(t.openingQuestion).not.toMatch(
        /attachments\s*:|Given parameters\s+A\s*=|on this setup/i,
      );
    }
  });
});