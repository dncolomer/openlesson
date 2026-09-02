import { describe, expect, it } from "vitest";
import {
  buildChapterFollowUpContext,
  buildFollowUpChapterDescription,
  findAdjacentFreeChapterSlot,
  findClosestEmptyChapterSlot,
  normalizeChapterFollowUpSuggestions,
} from "@/lib/ile-chapter-follow-ups";
import type { SessionPlan } from "@/lib/storage";

function planWithSteps(
  steps: Array<{ id: string; description: string; position_x: number; position_y: number }>,
): SessionPlan {
  return {
    id: "plan",
    sessionId: "s",
    goal: "g",
    steps: steps.map((s, order) => ({
      ...s,
      status: "pending" as const,
      type: "task" as const,
      order,
    })),
    currentStepIndex: 0,
  } as SessionPlan;
}

describe("findClosestEmptyChapterSlot", () => {
  it("always returns the free cell at distance 1 to the right when empty", () => {
    const plan = planWithSteps([
      { id: "a", description: "Done chapter", position_x: 0, position_y: 0 },
    ]);
    expect(findClosestEmptyChapterSlot(plan, { position_x: 0, position_y: 0 })).toEqual({
      row: 0,
      col: 1,
    });
    expect(findAdjacentFreeChapterSlot(plan, { position_x: 0, position_y: 0 })).toEqual({
      row: 0,
      col: 1,
    });
  });

  it("picks the closest free square when nearer neighbors are full", () => {
    const plan = planWithSteps([
      { id: "a", description: "Done", position_x: 0, position_y: 0 },
      { id: "b", description: "Right", position_x: 1, position_y: 0 },
      { id: "c", description: "Down", position_x: 0, position_y: 1 },
    ]);
    const slot = findClosestEmptyChapterSlot(plan, { position_x: 0, position_y: 0 });
    // Distance-1 free cells: left, up, diagonals — left is preferred tie-break among remaining
    expect(Math.max(Math.abs(slot.row - 0), Math.abs(slot.col - 0))).toBe(1);
    expect(slot).toEqual({ row: 0, col: -1 });
  });

  it("never returns null — falls back past occupied columns", () => {
    // Pack a dense 5×5 block around origin
    const steps: Array<{
      id: string;
      description: string;
      position_x: number;
      position_y: number;
    }> = [];
    let n = 0;
    for (let r = -2; r <= 2; r += 1) {
      for (let c = -2; c <= 2; c += 1) {
        steps.push({
          id: `s${n++}`,
          description: `${r},${c}`,
          position_x: c,
          position_y: r,
        });
      }
    }
    const plan = planWithSteps(steps);
    const slot = findClosestEmptyChapterSlot(plan, { position_x: 0, position_y: 0 });
    expect(slot).toBeTruthy();
    expect(
      plan.steps.some((s) => s.position_x === slot.col && s.position_y === slot.row),
    ).toBe(false);
    expect(Math.max(Math.abs(slot.row), Math.abs(slot.col))).toBe(3);
  });
});

describe("normalizeChapterFollowUpSuggestions", () => {
  it("accepts object and string shapes and caps at 3", () => {
    const list = normalizeChapterFollowUpSuggestions({
      suggestions: [
        { title: "Hash tables", description: "Practice open addressing." },
        "Graphs BFS",
        { title: "Heaps", description: "Build a priority queue." },
        { title: "Extra", description: "Should drop" },
      ],
    });
    expect(list).toHaveLength(3);
    expect(list[0].title).toBe("Hash tables");
    expect(list[1].title).toBe("Graphs BFS");
  });

  it("keeps a generated 1–2 word keyword instead of truncating the title", () => {
    const list = normalizeChapterFollowUpSuggestions({
      suggestions: [
        {
          title: "Open addressing collision drills",
          description: "Practice open addressing.",
          keyword: "Open Address",
        },
      ],
    });
    expect(list[0].keyword).toBe("Open Address");
  });
});

describe("buildChapterFollowUpContext / description", () => {
  it("builds summaries and chapter description", () => {
    const ctx = buildChapterFollowUpContext({
      chapterDescription: "Binary search",
      solutionTexts: ["mid = lo + (hi-lo)/2"],
      stashTexts: ["maybe off-by-one"],
      existingChapterDescriptions: ["Sorting"],
    });
    expect(ctx.chapter).toContain("Binary search");
    expect(ctx.solutionSummary).toContain("mid");
    expect(ctx.stashSummary).toContain("off-by-one");
    expect(ctx.existingChapters).toContain("Sorting");

    expect(
      buildFollowUpChapterDescription({
        title: "Two pointers",
        description: "Apply two pointers on sorted arrays.",
      }),
    ).toMatch(/Two pointers/);
  });
});
