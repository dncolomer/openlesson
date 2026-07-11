import { describe, expect, it } from "vitest";
import {
  buildSkillGridLayout,
  chebyshevDistance,
  formatGridCoordinate,
  getWeightedNeighborhood,
  isCellOccupied,
  type SkillGridNode,
} from "@/lib/block-skill-grid";
import { isChapterSlotAvailable } from "@/lib/chapter-skill-grid";
import type { SessionPlan } from "@/lib/storage";

function makeNode(
  id: string,
  title: string,
  position?: { row: number; col: number },
): SkillGridNode {
  return {
    id,
    title,
    status: "available",
    is_start: id === "a",
    next_block_ids: [],
    position_x: position?.col,
    position_y: position?.row,
  };
}

describe("block-skill-grid space helpers", () => {
  it("formats grid coordinates", () => {
    expect(formatGridCoordinate(0, 1)).toBe("0,1");
    expect(formatGridCoordinate(-2, 3)).toBe("-2,3");
  });

  it("detects occupied cells from layout", () => {
    const nodes = [makeNode("a", "Start", { row: 0, col: 0 }), makeNode("b", "Next", { row: 0, col: 1 })];
    const { occupancy } = buildSkillGridLayout(nodes);
    expect(isCellOccupied(occupancy, 0, 0)).toBe(true);
    expect(isCellOccupied(occupancy, 1, 1)).toBe(false);
  });

  it("weights closer neighbors more strongly", () => {
    const nodes = [
      makeNode("a", "Start", { row: 0, col: 0 }),
      makeNode("b", "Near", { row: 0, col: 1 }),
      makeNode("c", "Far", { row: 2, col: 0 }),
    ];
    const nodesById = new Map(nodes.map((node) => [node.id, node]));
    const { placements } = buildSkillGridLayout(nodes);
    const neighbors = getWeightedNeighborhood({ row: 0, col: 2 }, placements, nodesById);

    expect(neighbors[0]?.title).toBe("Near");
    expect(neighbors[0]?.distance).toBe(1);
    expect(neighbors[0]?.weight).toBeGreaterThan(neighbors[1]?.weight ?? 0);
    expect(chebyshevDistance({ row: 0, col: 2 }, { row: 2, col: 0 })).toBe(2);
  });

  it("backfills legacy nodes without saved coordinates", () => {
    const nodes = [makeNode("a", "Legacy A"), makeNode("b", "Legacy B")];
    const { placements, occupancy } = buildSkillGridLayout(nodes);
    expect(placements.size).toBe(2);
    expect(occupancy.size).toBe(2);
  });
});

describe("chapter slot availability", () => {
  it("rejects occupied chapter slots", () => {
    const plan: SessionPlan = {
      id: "plan-1",
      sessionId: "session-1",
      userId: "user-1",
      goal: "Test",
      strategy: "Test",
      steps: [
        {
          id: "s1",
          description: "Intro",
          status: "pending",
          type: "task",
          order: 0,
          position_x: 0,
          position_y: 0,
        },
      ],
      currentStepIndex: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    expect(isChapterSlotAvailable(plan, 0, 0)).toBe(false);
    expect(isChapterSlotAvailable(plan, 1, 0)).toBe(true);
  });
});