/**
 * TAP Learning path overlay follows the stored chapter DAG.
 * The spine is the longest chain. Other links are detours. Order is not a path.
 */
import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { sessionStepsToSkillGridNodes } from "@/lib/chapter-skill-grid";
import type { IleAltitudeChapter } from "@/lib/ile-altitude-map";
import {
  ILE_CHAPTER_BLOCK_ALPHA,
  ILE_PATH_DETOUR_WIDTH,
  ILE_PATH_SPINE_CASING_WIDTH,
  ILE_PATH_SPINE_WIDTH,
  ILE_PATH_YELLOW,
  ilePathCellCenter,
  ilePathMapFrame,
  ilePathOverlay,
  ilePathRouteD,
} from "@/lib/ile-path-overlay";
import { ILE_BOARD_CELL_SIZE, ILE_BOARD_PITCH } from "@/lib/block-skill-grid";
import { resolveEmptyCellMarker } from "@/lib/map-tile-badges";
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
  it("no stored links yields no spine", () => {
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

  it("the longest chain is the spine and a side rung is a detour", () => {
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
      x: ILE_BOARD_CELL_SIZE / 2,
      y: ILE_BOARD_CELL_SIZE / 2,
    });
    expect(overlay.spine?.points[0]).toMatchObject({ chapterId: "a", ...origin });
    expect(overlay.spine?.points[1]?.x).toBe(origin.x);
    expect(overlay.spine?.points[1]?.y).toBe(ILE_BOARD_PITCH + ILE_BOARD_CELL_SIZE / 2);
    expect(ilePathRouteD(overlay.spine?.points ?? [])).toMatch(/^M\d/);

    const frame = ilePathMapFrame(overlay);
    expect(frame).not.toBeNull();
    expect(frame!.minX).toBeLessThan(origin.x);
    expect(frame!.width).toBeGreaterThan(ILE_BOARD_PITCH);
  });

  it("the other branch of a diamond is a detour that rejoins", () => {
    const overlay = ilePathOverlay([
      chapter({ id: "a", row: 0, col: 0, nextIds: ["b", "c"] }),
      chapter({ id: "b", row: 1, col: 0, lockUntilIds: ["a"], nextIds: ["d"] }),
      chapter({ id: "c", row: 1, col: 1, lockUntilIds: ["a"], nextIds: ["d"] }),
      chapter({ id: "d", row: 2, col: 0, lockUntilIds: ["b", "c"] }),
    ]);
    expect(overlay.spine?.chapterIds).toEqual(["a", "b", "d"]);
    expect(overlay.detours.map((route) => route.chapterIds)).toEqual([["a", "c", "d"]]);
  });

  it("a cycle stays finite and chapters that are not on the grid are dropped", () => {
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

  it("path widths stay on the library, and the shared grid does not draw the chapter path", () => {
    const world = read("components/block-skill-grid/map-world-layer.tsx");
    expect(world).not.toContain("data-ile-path-detour");
    expect(world).not.toContain("data-ile-path-spine");
    expect(world).not.toContain("data-ile-path-overlay");
    expect(ILE_PATH_SPINE_WIDTH).toBe(6);
    expect(ILE_PATH_SPINE_CASING_WIDTH).toBe(10);
    expect(ILE_PATH_DETOUR_WIDTH).toBe(3);
    expect(ILE_PATH_SPINE_CASING_WIDTH).toBeGreaterThan(ILE_PATH_SPINE_WIDTH);
    expect(ILE_PATH_DETOUR_WIDTH).toBeLessThan(ILE_PATH_SPINE_WIDTH);
    expect(ILE_PATH_YELLOW.startsWith("#")).toBe(true);
  });

  it("the shared grid does not mount a chapter path overlay or a chapter suggest mode, and an editable empty cell still shows a plus", () => {
    const world = read("components/block-skill-grid/map-world-layer.tsx");
    const stack = read("components/block-skill-grid/map-right-stack.tsx");
    const grid = read("components/BlockSkillGrid.tsx");
    expect(world).not.toContain("data-ile-path-overlay");
    expect(world).not.toContain("data-ile-path-spine");
    expect(world).not.toContain("suggestMode");
    expect(world).not.toContain("showPathOverlay");
    expect(world).not.toMatch(/rounded-(sm|md|lg|xl)\b/);
    expect(stack).not.toContain("data-ile-path-overlay-toggle");
    expect(stack).toContain("rounded-none");
    expect(stack).not.toMatch(/rounded-(sm|md|lg|xl)\b/);
    expect(grid).not.toContain("pathOverlayVisible");
    expect(grid).not.toContain("suggestMode");
    expect(grid).toContain('mapKind: "workspace"');
    expect(
      existsSync(join(ROOT, "components/session-view/ile-continue-map-preview.tsx")),
    ).toBe(false);
    expect(stack).not.toContain("data-workspace-mode-toggle");
    expect(stack).toContain("data-map-notes-visibility-row");
    expect(ILE_CHAPTER_BLOCK_ALPHA).toBe(0.94);
    expect(world).toContain("data-empty-cell-plus");
    expect(world).not.toContain("ILE_CHAPTER_BLOCK_ALPHA");
    expect(world).not.toContain("zIndex: 3");
    expect(world).not.toContain("data-ile-altitude-map");
    expect(world).not.toContain("ILE_ALTITUDE_TILE_CLASS");
    expect(
      resolveEmptyCellMarker({
        canEdit: true,
        learnerMode: false,
      }),
    ).toBe("plus");
  });
});
