import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { findClosestEmptyChapterSlot } from "@/lib/learn-chapter-follow-ups";
import type { SessionPlan } from "@/lib/storage";

const ROOT = join(__dirname, "../..");

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
  });

  it("skips blocked chapter slots when placing the next cell", () => {
    const plan = planWithSteps([
      { id: "a", description: "Done chapter", position_x: 0, position_y: 0 },
    ]);
    plan.unusable_cells = [{ row: 0, col: 1 }];
    expect(findClosestEmptyChapterSlot(plan, { position_x: 0, position_y: 0 })).toEqual({
      row: 1,
      col: 0,
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

describe("chapter follow-up route is gone", () => {
  it("does not ship suggest-chapter-follow-ups", () => {
    expect(
      existsSync(join(ROOT, "app/api/workspace/suggest-chapter-follow-ups/route.ts")),
    ).toBe(false);
    const src = readFileSync(join(ROOT, "lib/learn-chapter-follow-ups.ts"), "utf8");
    expect(src).toContain("export function findClosestEmptyChapterSlot");
    expect(src).not.toContain("normalizeChapterFollowUpSuggestions");
    expect(src).not.toContain("buildFollowUpChapterDescription");
    expect(src).not.toContain("findAdjacentFreeChapterSlot");
  });
});
