/**
 * TAP Learning path overlay follows the stored chapter DAG.
 * The spine is the longest chain. Other links are detours. Order is not a path.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
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

  it('the spine is a yellow path, wider than the dashed detours, and intermediate spine stops are not marked data-ile-path-role="spine"', () => {
    const world = read("components/block-skill-grid/map-world-layer.tsx");
    const detourAt = world.indexOf("data-ile-path-detour");
    const spineAt = world.indexOf("data-ile-path-spine");
    const detourBlock = world.slice(detourAt, spineAt);
    const spineBlock = world.slice(spineAt, world.indexOf("</svg>", spineAt));
    expect(detourAt).toBeGreaterThan(0);
    expect(spineAt).toBeGreaterThan(detourAt);
    expect(ILE_PATH_SPINE_WIDTH).toBe(6);
    expect(ILE_PATH_SPINE_CASING_WIDTH).toBe(10);
    expect(ILE_PATH_DETOUR_WIDTH).toBe(3);
    expect(ILE_PATH_SPINE_CASING_WIDTH).toBeGreaterThan(ILE_PATH_SPINE_WIDTH);
    expect(ILE_PATH_DETOUR_WIDTH).toBeLessThan(ILE_PATH_SPINE_WIDTH);
    expect(ILE_PATH_YELLOW.startsWith("#")).toBe(true);
    expect(world).not.toMatch(/data-ile-path-role=(?:"spine"|\{[^}]*"spine"[^}]*\})/);
    expect(spineBlock).toContain("index !== 0 && !last");
    expect(spineBlock).toContain("return null");
    expect(spineBlock).toContain("ILE_PATH_YELLOW");
    expect(spineBlock).toContain("ILE_PATH_SPINE_WIDTH");
    expect(spineBlock).toContain("ILE_PATH_SPINE_CASING_WIDTH");
    expect(detourBlock).toContain("strokeDasharray=");
    expect(detourBlock).toContain("ILE_PATH_YELLOW");
    expect(detourBlock).toContain("ILE_PATH_DETOUR_WIDTH");
    expect(detourBlock).toContain('strokeLinecap="round"');
    expect(spineBlock).toContain('strokeLinecap="round"');
  });

  it('the Path control (data-ile-path-overlay-toggle, label Path) is the first control under the minimap and the overlay starts hidden, the path overlay renders only for the chapter map so the workspace map does not receive it, the chapter tile class stays transparent with no rounded-sm rounded-md rounded-lg or rounded-xl, and TAP Learning empty cells show the add plus', () => {
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
      stack.indexOf("data-map-notes-visibility-row"),
    );
    expect(pathButton).toContain("Path");
    expect(pathButton).toContain('data-ile-path-eye="open"');
    expect(pathButton).toContain('data-ile-path-eye="closed"');
    expect(pathButton.indexOf("data-ile-path-overlay-toggle")).toBeLessThan(
      pathButton.indexOf("Path"),
    );
    expect(stack).toContain("rounded-none");
    expect(stack).not.toMatch(/rounded-(sm|md|lg|xl)\b/);
    expect(grid).toContain(
      "const [pathOverlayVisible, setPathOverlayVisible] = useState(false)",
    );
    expect(grid).toContain('showPathOverlay: suggestMode === "chapter" && pathOverlayVisible');
    expect(grid).toContain('suggestMode === "chapter"');
    const preview = read("components/session-view/ile-continue-map-preview.tsx");
    expect(preview).not.toContain('suggestMode="chapter"');
    const stackBody = stack.slice(stack.indexOf("data-map-minimap-stack"));
    expect(stackBody.indexOf("data-ile-path-overlay-toggle")).toBeGreaterThan(0);
    expect(stack).not.toContain("data-workspace-mode-toggle");
    expect(stackBody.indexOf("data-ile-path-overlay-toggle")).toBeLessThan(
      stackBody.indexOf("data-map-notes-visibility-row"),
    );
    expect(world).toContain("ILE_PATH_YELLOW");
    expect(ILE_CHAPTER_BLOCK_ALPHA).toBe(0.94);
    const pathAt = world.indexOf('data-ile-path-overlay=""');
    const blocksAt = world.indexOf("Occupied blocks: solid rect");
    expect(pathAt).toBeGreaterThan(0);
    expect(blocksAt).toBeGreaterThan(pathAt);
    const pathTag = world.slice(pathAt, pathAt + 420);
    expect(pathTag).toContain("zIndex: 0");
    expect(world).toMatch(/suggestMode === "chapter"\s*\?\s*2/);
    expect(world).toContain("ILE_CHAPTER_BLOCK_ALPHA");
    expect(world).not.toContain("zIndex: 3");
    expect(world).not.toContain("data-ile-altitude-map");
    expect(world).not.toContain("ILE_ALTITUDE_TILE_CLASS");
    expect(
      resolveEmptyCellMarker({
        surface: "chapter",
        canEdit: true,
        learnerMode: false,
      }),
    ).toBe("plus");
  });
});
