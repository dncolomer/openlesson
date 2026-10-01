/**
 * ILE path overlay follows the stored chapter DAG.
 * The spine is the longest chain. Other links are detours. Order is not a path.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { sessionStepsToSkillGridNodes } from "@/lib/chapter-skill-grid";
import type { IleAltitudeChapter } from "@/lib/ile-altitude-map";
import {
  ilePathCellCenter,
  ilePathMapFrame,
  ilePathOverlay,
  ilePathRouteD,
} from "@/lib/ile-path-overlay";
import { SKILL_GRID_CELL_SIZE, SKILL_GRID_PITCH } from "@/lib/block-skill-grid";
import type { SessionPlanStep } from "@/lib/domain/types";

const ROOT = join(__dirname, "../..");

function read(rel: string) {
  return readFileSync(join(ROOT, rel), "utf8");
}

function chapter(
  partial: Partial<IleAltitudeChapter> & Pick<IleAltitudeChapter, "id">,
): IleAltitudeChapter {
  return { row: 0, col: 0, ...partial };
}

function step(
  partial: Partial<SessionPlanStep> & Pick<SessionPlanStep, "id" | "order" | "description">,
): SessionPlanStep {
  return { status: "pending", type: "task", ...partial };
}

describe("ile path overlay", () => {
  it("draws nothing when the chapters have no stored links", () => {
    expect(
      ilePathOverlay([
        chapter({ id: "a", row: 0, col: 0 }),
        chapter({ id: "b", row: 0, col: 1 }),
      ]),
    ).toEqual({ spine: null, detours: [] });

    const nodes = sessionStepsToSkillGridNodes([
      step({ id: "s1", order: 2, description: "Later", position_x: 1, position_y: 0 }),
      step({ id: "s2", order: 0, description: "First", position_x: 0, position_y: 0 }),
    ]);
    expect(
      ilePathOverlay(
        nodes.map((node) => ({
          id: node.id,
          row: node.position_y,
          col: node.position_x,
          lockUntilIds: node.lock_until_block_ids,
          nextIds: node.next_block_ids,
        })),
      ).spine,
    ).toBeNull();
  });

  it("follows the longest chain from a root and keeps the side rung as a detour", () => {
    const overlay = ilePathOverlay([
      chapter({ id: "a", row: 0, col: 0, nextIds: ["b"] }),
      chapter({ id: "b", row: 1, col: 0, lockUntilIds: ["a"], nextIds: ["c", "d"] }),
      chapter({ id: "c", row: 2, col: 0, lockUntilIds: ["b"], nextIds: ["e"] }),
      chapter({ id: "d", row: 1, col: 1, lockUntilIds: ["b"] }),
      chapter({ id: "e", row: 3, col: 0, lockUntilIds: ["c"] }),
    ]);
    expect(overlay.spine?.chapterIds).toEqual(["a", "b", "c", "e"]);
    expect(overlay.detours.map((route) => route.chapterIds)).toEqual([["b", "d"]]);
    expect(overlay.spine?.kind).toBe("spine");
    expect(overlay.detours[0]?.kind).toBe("detour");

    const origin = ilePathCellCenter(0, 0);
    expect(origin).toEqual({
      x: SKILL_GRID_CELL_SIZE / 2,
      y: SKILL_GRID_CELL_SIZE / 2,
    });
    expect(overlay.spine?.points[0]).toMatchObject({ chapterId: "a", ...origin });
    expect(overlay.spine?.points[1]?.x).toBe(origin.x);
    expect(overlay.spine?.points[1]?.y).toBe(SKILL_GRID_PITCH + SKILL_GRID_CELL_SIZE / 2);
    expect(ilePathRouteD(overlay.spine?.points ?? [])).toMatch(/^M\d/);

    const frame = ilePathMapFrame(overlay);
    expect(frame).not.toBeNull();
    expect(frame!.minX).toBeLessThan(origin.x);
    expect(frame!.width).toBeGreaterThan(SKILL_GRID_PITCH);
  });

  it("treats the other branch of a diamond as a variant that rejoins", () => {
    const overlay = ilePathOverlay([
      chapter({ id: "a", row: 0, col: 0, nextIds: ["b", "c"] }),
      chapter({ id: "b", row: 1, col: 0, lockUntilIds: ["a"], nextIds: ["d"] }),
      chapter({ id: "c", row: 1, col: 1, lockUntilIds: ["a"], nextIds: ["d"] }),
      chapter({ id: "d", row: 2, col: 0, lockUntilIds: ["b", "c"] }),
    ]);
    expect(overlay.spine?.chapterIds).toEqual(["a", "b", "d"]);
    expect(overlay.detours.map((route) => route.chapterIds)).toEqual([["a", "c", "d"]]);
  });

  it("drops chapters that are not on the grid and stays finite on a cycle", () => {
    expect(
      ilePathOverlay([
        chapter({ id: "a", row: 0, col: 0, nextIds: ["missing"] }),
        chapter({ id: "missing", row: null, col: null, lockUntilIds: ["a"] }),
      ]).spine,
    ).toBeNull();

    const cycled = ilePathOverlay([
      chapter({ id: "a", row: 0, col: 0, nextIds: ["b"] }),
      chapter({ id: "b", row: 0, col: 1, nextIds: ["a"] }),
    ]);
    expect(cycled.spine?.chapterIds.length).toBe(2);
    expect(new Set(cycled.spine?.chapterIds)).toEqual(new Set(["a", "b"]));
  });

  it("mounts the overlay on the ILE chapter map and toggles it under the minimap", () => {
    const world = read("components/block-skill-grid/map-world-layer.tsx");
    const stack = read("components/block-skill-grid/map-right-stack.tsx");
    const grid = read("components/BlockSkillGrid.tsx");
    expect(world).toContain("data-ile-path-overlay");
    expect(world).toContain("data-ile-path-spine");
    expect(world).toContain("data-ile-path-detour");
    expect(world).toContain('suggestMode === "chapter" && showPathOverlay');
    expect(world).not.toMatch(/rounded-(sm|md|lg|xl)\b/);
    expect(stack).toContain("data-ile-path-overlay-toggle");
    const pathButton = stack.slice(
      stack.indexOf("data-ile-path-overlay-toggle"),
      stack.indexOf("data-workspace-mode-toggle"),
    );
    expect(pathButton).toContain("Path");
    expect(pathButton.indexOf("data-ile-path-overlay-toggle")).toBeLessThan(
      pathButton.indexOf("Path"),
    );
    expect(stack).toContain("rounded-none");
    expect(stack).not.toMatch(/rounded-(sm|md|lg|xl)\b/);
    expect(grid).toContain("useState(true)");
    expect(grid).toContain('showPathOverlay: suggestMode === "chapter" && pathOverlayVisible');
    expect(grid).toContain('suggestMode === "chapter"');
    const preview = read("components/session-view/ile-continue-map-preview.tsx");
    expect(preview).not.toContain('suggestMode="chapter"');
  });
});
