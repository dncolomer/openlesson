/**
 * ILE altitude groups come from the stored chapter DAG, not from step order.
 * Adjacent squares at one elevation share one outline. Manual empty-cell add is off.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { sessionStepsToSkillGridNodes } from "@/lib/chapter-skill-grid";
import {
  ILE_BLOCKED_ELEVATION,
  ILE_MAP_BOARD_CORNER_PX,
  ILE_MAP_BOARD_FRAME_INNER_PX,
  ILE_MAP_BOARD_FRAME_INSET_PX,
  ILE_MAP_BOARD_FRAME_OUTER_PX,
  ILE_MAP_BOARD_EXTRA_COLS,
  ILE_MAP_BOARD_EXTRA_ROWS,
  ILE_MAP_BOARD_MARGIN_PX,
  ILE_OPEN_ELEVATION,
  ileAltitudeContourLoops,
  ileAltitudeGroups,
  ileAltitudeMapFrame,
  ileAltitudePaint,
  ileAltitudeSurface,
  ileCellElevations,
  ileGroundGroups,
  ileMapBoardBounds,
  type IleAltitudeChapter,
} from "@/lib/ile-altitude-map";
import {
  blockCircularMenuActions,
  blockCircularMenuOpensOnEmpty,
  ileVoicePadSpec,
} from "@/lib/block-circular-menu";
import { resolveEmptyCellMarker } from "@/lib/map-tile-badges";
import {
  fitWorldRectCamera,
  getDefaultSkillGridZoom,
  skillGridZoomFloor,
  ILE_BOARD_CELL_SIZE,
  ILE_BOARD_PITCH,
  SKILL_GRID_CELL_SIZE,
  SKILL_GRID_DEFAULT_ZOOM_AT_REFERENCE,
  SKILL_GRID_DEFAULT_ZOOM_REFERENCE_SCALE,
  SKILL_GRID_GAP,
  SKILL_GRID_ILE_DEFAULT_ZOOM_AT_REFERENCE,
  SKILL_GRID_MIN_ZOOM,
  SKILL_GRID_PITCH,
} from "@/lib/block-skill-grid";
import { ILE_BOARD_FIT_INSETS, ILE_MAP_VOICE_BAR_CLEARANCE_PX } from "@/lib/ile-map-chrome";
import { MINIMAP_FRAME_WIDTH } from "@/lib/map-minimap-frame";
import type { SessionPlanStep } from "@/lib/domain/types";

const ROOT = join(__dirname, "../..");

function read(rel: string) {
  return readFileSync(join(ROOT, rel), "utf8");
}

function surfaceGray(color: string): number {
  return Number(color.match(/\d+/)?.[0] ?? 0);
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

describe("ile altitude groups", () => {
  it("keeps chapters with no DAG on one elevation and merges only edge-adjacent squares, so corner-only neighbors stay separate", () => {
    const groups = ileAltitudeGroups([
      chapter({ id: "a", row: 0, col: 0 }),
      chapter({ id: "b", row: 0, col: 1 }),
      chapter({ id: "c", row: 1, col: 2 }),
    ]);
    expect(groups.map((group) => group.altitude)).toEqual([0, 0]);
    const merged = groups.find((group) => group.chapterIds.includes("a"));
    const alone = groups.find((group) => group.chapterIds.includes("c"));
    expect(merged?.chapterIds.sort()).toEqual(["a", "b"]);
    expect(merged?.cells).toEqual([
      { row: 0, col: 0 },
      { row: 0, col: 1 },
    ]);
    expect(merged?.loops).toHaveLength(1);
    expect(alone?.chapterIds).toEqual(["c"]);
    expect(alone?.loops).toHaveLength(1);

    const pad = SKILL_GRID_GAP / 2;
    expect(merged?.loops[0]?.minX).toBeCloseTo(-pad);
    expect(merged?.loops[0]?.maxX).toBeCloseTo(2 * SKILL_GRID_PITCH - pad);
    expect(merged?.loops[0]?.maxY).toBeCloseTo(SKILL_GRID_PITCH - pad);
    expect(merged?.loops[0]?.d.startsWith("M ")).toBe(true);
    expect(merged?.loops[0]?.d.endsWith("Z")).toBe(true);

    const frame = ileAltitudeMapFrame(groups);
    expect(frame.minX).toBeLessThanOrEqual(0);
    expect(frame.width).toBeGreaterThan(SKILL_GRID_PITCH);
  });

  it("drops elevation along lock-until and leads-to, and ignores step order", () => {
    const fromEdges = ileAltitudeGroups([
      chapter({ id: "high", row: 0, col: 0, nextIds: ["mid"] }),
      chapter({ id: "mid", row: 1, col: 0, lockUntilIds: ["high"], nextIds: ["low"] }),
      chapter({ id: "low", row: 2, col: 0, lockUntilIds: ["mid"] }),
    ]);
    const altitude = Object.fromEntries(fromEdges.map((group) => [group.chapterIds[0], group.altitude]));
    expect(altitude.high).toBeGreaterThan(altitude.mid);
    expect(altitude.mid).toBeGreaterThan(altitude.low);
    expect(fromEdges).toHaveLength(3);

    const highPaint = ileAltitudePaint(altitude.high, altitude.high);
    const lowPaint = ileAltitudePaint(altitude.low, altitude.high);
    expect(highPaint.shadowDy).toBeGreaterThan(lowPaint.shadowDy);
    expect(highPaint.shadowBlur).toBeGreaterThan(lowPaint.shadowBlur);
    expect(highPaint.shadowOpacity).toBeGreaterThan(lowPaint.shadowOpacity);
    expect(highPaint.strokeWidth).toBeGreaterThan(lowPaint.strokeWidth);
    expect(lowPaint.strokeWidth).toBeGreaterThanOrEqual(2);
    expect(highPaint.casingWidth).toBeGreaterThan(highPaint.strokeWidth);
    expect(highPaint.fill).toBe("none");
    expect(parseFloat(highPaint.stroke.split(",")[3] ?? "0")).toBeGreaterThan(0.9);
    expect(parseFloat(highPaint.stroke.split(",")[3] ?? "0")).toBeGreaterThan(
      parseFloat(lowPaint.stroke.split(",")[3] ?? "1"),
    );
    expect(lowPaint.shadowOpacity).toBeGreaterThanOrEqual(0.35);
    expect(lowPaint.shadowBlur).toBeGreaterThanOrEqual(2);
    const highSurface = ileAltitudeSurface(altitude.high, altitude.high);
    const lowSurface = ileAltitudeSurface(altitude.low, altitude.high);
    expect(highSurface.startsWith("rgb(")).toBe(true);
    expect(surfaceGray(highSurface)).toBeGreaterThanOrEqual(160);
    expect(surfaceGray(highSurface)).toBeGreaterThan(surfaceGray(lowSurface));

    const orderedOnly = ileAltitudeGroups([
      chapter({ id: "first", row: 0, col: 0 }),
      chapter({ id: "second", row: 0, col: 1 }),
    ]);
    expect(new Set(orderedOnly.map((group) => group.altitude))).toEqual(new Set([0]));

    const nodes = sessionStepsToSkillGridNodes([
      step({
        id: "s1",
        order: 0,
        description: "Summit",
        position_x: 0,
        position_y: 0,
        next_step_ids: ["s2"],
      }),
      step({
        id: "s2",
        order: 1,
        description: "Valley",
        position_x: 0,
        position_y: 1,
        lock_until_step_ids: ["s1"],
      }),
      step({
        id: "s3",
        order: 2,
        description: "Beside the summit",
        position_x: 1,
        position_y: 0,
      }),
    ]);
    expect(nodes.find((node) => node.id === "s1")?.next_block_ids).toEqual(["s2"]);
    expect(nodes.find((node) => node.id === "s2")?.lock_until_block_ids).toEqual(["s1"]);
    expect(nodes.find((node) => node.id === "s3")?.lock_until_block_ids).toEqual([]);
    expect(nodes.find((node) => node.id === "s3")?.next_block_ids).toEqual([]);
    const mapped = ileAltitudeGroups(
      nodes.map((node) => ({
        id: node.id,
        row: node.position_y,
        col: node.position_x,
        lockUntilIds: node.lock_until_block_ids,
        nextIds: node.next_block_ids,
      })),
    );
    const byId = new Map(mapped.flatMap((group) => group.chapterIds.map((id) => [id, group.altitude])));
    expect(byId.get("s1")).toBeGreaterThan(byId.get("s2") ?? 0);
    expect(byId.get("s3")).toBe(byId.get("s1"));
    const summit = mapped.find((group) => group.chapterIds.includes("s1"));
    expect(summit?.chapterIds.sort()).toEqual(["s1", "s3"]);
  });

  it("a cycle finishes finite and a chapter with no square is dropped", () => {
    const groups = ileAltitudeGroups([
      chapter({ id: "a", row: 0, col: 0, nextIds: ["b"] }),
      chapter({ id: "b", row: 1, col: 0, nextIds: ["a"] }),
      chapter({ id: "missing", row: null, col: null, nextIds: ["a"] }),
    ]);
    expect(groups.flatMap((group) => group.chapterIds).sort()).toEqual(["a", "b"]);
    expect(groups.every((group) => Number.isFinite(group.altitude))).toBe(true);
  });

  it("a same-altitude gap stays out of the chapter border so the chapter does not grow", () => {
    const groups = ileAltitudeGroups([
      chapter({ id: "left", row: 2, col: 1 }),
      chapter({ id: "right", row: 2, col: 3 }),
    ]);
    expect(groups).toHaveLength(2);
    expect(groups.every((group) => group.cells.length === 1)).toBe(true);
    expect(groups.flatMap((group) => group.cells)).not.toContainEqual({ row: 2, col: 2 });
    const left = groups.find((group) => group.chapterIds.includes("left"));
    const pad = SKILL_GRID_GAP / 2;
    expect(left?.loops[0]?.minX).toBeCloseTo(1 * SKILL_GRID_PITCH - pad);
    expect(left?.loops[0]?.maxX).toBeCloseTo(2 * SKILL_GRID_PITCH - pad);
  });

  it("different-altitude gap stays two regions and the unoccupied cell does not merge them", () => {
    const groups = ileAltitudeGroups([
      chapter({ id: "high", row: 0, col: 0, nextIds: ["low"] }),
      chapter({ id: "low", row: 0, col: 2, lockUntilIds: ["high"] }),
    ]);
    expect(groups).toHaveLength(2);
    expect(new Set(groups.map((group) => group.altitude)).size).toBe(2);
    const cells = groups.flatMap((group) => group.cells);
    expect(cells).not.toContainEqual({ row: 0, col: 1 });
    expect(groups.every((group) => group.chapterIds.length === 1)).toBe(true);
  });

  it("order-only chapters share one altitude and the connecting cell stays ground", () => {
    const groups = ileAltitudeGroups([
      chapter({ id: "first", row: 1, col: 0 }),
      chapter({ id: "second", row: 1, col: 2 }),
    ]);
    expect(groups).toHaveLength(2);
    expect(new Set(groups.map((group) => group.altitude))).toEqual(new Set([0]));
    expect(groups.flatMap((group) => group.cells)).not.toContainEqual({ row: 1, col: 1 });
  });

  it("adjacent open cells and adjacent blocked cells are each one region, and corner-only ground stays separate", () => {
    const cells = [
      { row: 0, col: 0, blocked: false },
      { row: 0, col: 1, blocked: false },
      { row: 1, col: 1, blocked: false },
      { row: 3, col: 3, blocked: false },
      { row: 0, col: 4, blocked: true },
      { row: 1, col: 4, blocked: true },
      { row: 2, col: 0, blocked: true },
    ];
    const known = [
      ...cells.map((cell) => ({ row: cell.row, col: cell.col })),
      { row: 0, col: 2 },
      { row: 1, col: 0 },
    ];
    const groups = ileGroundGroups(cells, known);
    const open = groups.filter((group) => group.kind === "open");
    const blocked = groups.filter((group) => group.kind === "blocked");
    expect(open.map((group) => group.cells.length).sort((a, b) => b - a)).toEqual([3, 1]);
    expect(blocked.map((group) => group.cells.length).sort((a, b) => b - a)).toEqual([2, 1]);
    const cluster = open.find((group) => group.cells.length === 3);
    expect(cluster?.cells).toEqual([
      { row: 0, col: 0 },
      { row: 0, col: 1 },
      { row: 1, col: 1 },
    ]);
    expect(cluster?.loops.length).toBeGreaterThan(0);
    const blockedPair = blocked.find((group) => group.cells.length === 2);
    expect(blockedPair?.loops).toHaveLength(1);
    expect(blockedPair?.loops[0]?.d.endsWith("Z")).toBe(true);
    const pad = SKILL_GRID_GAP / 2;
    expect(blockedPair?.loops[0]?.minX).toBeCloseTo(4 * SKILL_GRID_PITCH - pad);
    expect(blockedPair?.loops[0]?.maxX).toBeCloseTo(5 * SKILL_GRID_PITCH - pad);

    const fringe = ileAltitudeContourLoops(
      [
        { row: 0, col: 0 },
        { row: 0, col: 1 },
      ],
      [
        { row: 0, col: 0 },
        { row: 0, col: 1 },
      ],
    );
    expect(fringe).toEqual([]);
    const facing = ileAltitudeContourLoops(
      [
        { row: 0, col: 0 },
        { row: 0, col: 1 },
      ],
      [
        { row: 0, col: 0 },
        { row: 0, col: 1 },
        { row: 0, col: 2 },
      ],
    );
    expect(facing.length).toBeGreaterThan(0);
    expect(facing.every((loop) => loop.minX > 0)).toBe(true);
  });

  it("strokes the shared edge on the higher region only", () => {
    const elevation = new Map<string, number>([
      ["0:0", 1],
      ["0:1", 0],
    ]);
    const high = ileAltitudeContourLoops([{ row: 0, col: 0 }], undefined, {
      elevation,
      level: 1,
    });
    const low = ileAltitudeContourLoops([{ row: 0, col: 1 }], undefined, {
      elevation,
      level: 0,
    });
    const pad = SKILL_GRID_GAP / 2;
    const seam = SKILL_GRID_PITCH - pad;
    const far = 2 * SKILL_GRID_PITCH - pad;
    const top = -pad;
    const bottom = SKILL_GRID_PITCH - pad;
    expect(high).toHaveLength(1);
    expect(high[0]?.d).toBe(
      `M ${top} ${top} L ${seam} ${top} L ${seam} ${bottom} L ${top} ${bottom} L ${top} ${top} Z`,
    );

    expect(low).toHaveLength(1);
    expect(low[0]?.d).toBe(`M ${seam} ${top} L ${far} ${top} L ${far} ${bottom} L ${seam} ${bottom}`);
    expect(low[0]?.d).not.toContain(`L ${seam} ${top}`);

    const ground = new Map<string, number>([
      ["0:0", ILE_OPEN_ELEVATION],
      ["0:1", ILE_BLOCKED_ELEVATION],
    ]);
    const open = ileAltitudeContourLoops([{ row: 0, col: 0 }], undefined, {
      elevation: ground,
      level: ILE_OPEN_ELEVATION,
    });
    const blocked = ileAltitudeContourLoops([{ row: 0, col: 1 }], undefined, {
      elevation: ground,
      level: ILE_BLOCKED_ELEVATION,
    });
    expect(open[0]?.d.endsWith("Z")).toBe(true);
    expect(blocked[0]?.d.startsWith(`M ${seam} ${top}`));
    expect(blocked[0]?.d).not.toContain(`L ${seam} ${top}`);

    const unmarkedNeighbor = ileAltitudeContourLoops([{ row: 0, col: 0 }], undefined, {
      elevation: new Map([["0:0", 0]]),
      level: 0,
    });
    expect(unmarkedNeighbor[0]?.d.endsWith("Z")).toBe(true);

    const surrounded = new Map<string, number>([
      ["1:1", ILE_BLOCKED_ELEVATION],
      ["0:1", ILE_OPEN_ELEVATION],
      ["2:1", ILE_OPEN_ELEVATION],
      ["1:0", ILE_OPEN_ELEVATION],
      ["1:2", ILE_OPEN_ELEVATION],
    ]);
    expect(
      ileAltitudeContourLoops([{ row: 1, col: 1 }], undefined, {
        elevation: surrounded,
        level: ILE_BLOCKED_ELEVATION,
      }),
    ).toEqual([]);

    const chapters = ileAltitudeGroups([
      chapter({ id: "high", row: 0, col: 0, nextIds: ["low"] }),
      chapter({ id: "low", row: 1, col: 0, lockUntilIds: ["high"] }),
    ]);
    const grounds = ileGroundGroups([
      { row: 2, col: 0, blocked: false },
      { row: 3, col: 0, blocked: true },
    ]);
    const levels = ileCellElevations(chapters, grounds);
    const highLevel = levels.get("0:0") ?? 0;
    const lowLevel = levels.get("1:0") ?? 0;
    expect(highLevel).toBeGreaterThan(lowLevel);
    expect(lowLevel).toBeGreaterThan(ILE_OPEN_ELEVATION);
    expect(levels.get("2:0")).toBe(ILE_OPEN_ELEVATION);
    expect(levels.get("3:0")).toBe(ILE_BLOCKED_ELEVATION);
    expect(ILE_OPEN_ELEVATION).toBeGreaterThan(ILE_BLOCKED_ELEVATION);
    const openPaint = ileAltitudePaint(ILE_OPEN_ELEVATION, highLevel);
    const blockedPaint = ileAltitudePaint(ILE_BLOCKED_ELEVATION, highLevel);
    expect(ileAltitudePaint(lowLevel, highLevel).shadowDy).toBeGreaterThan(openPaint.shadowDy);
    expect(openPaint.shadowDy).toBeGreaterThan(blockedPaint.shadowDy);
    expect(openPaint.shadowOpacity).toBeGreaterThan(blockedPaint.shadowOpacity);
    expect(surfaceGray(ileAltitudeSurface(ILE_OPEN_ELEVATION, highLevel))).toBeGreaterThan(
      surfaceGray(ileAltitudeSurface(ILE_BLOCKED_ELEVATION, highLevel)),
    );
  });

  it("grouping does not take fog or the viewport cell list as an input and a fogged or off-screen member is still included", () => {
    const source = read("lib/ile-altitude-map.ts");
    const fn = source.slice(source.indexOf("export function ileAltitudeGroups"));
    expect(fn.startsWith("export function ileAltitudeGroups(\n  chapters:")).toBe(true);
    expect(fn).not.toContain("visibleCells");
    expect(fn).not.toMatch(/\bfog\b/);
    const world = read("components/block-skill-grid/map-world-layer.tsx");
    expect(world).not.toContain("ileAltitudeGroups");

    const groups = ileAltitudeGroups([
      chapter({ id: "here", row: 0, col: 0 }),
      chapter({ id: "fogged", row: 0, col: 4 }),
    ]);
    expect(groups.flatMap((group) => group.chapterIds).sort()).toEqual(["fogged", "here"]);
    expect(groups.flatMap((group) => group.cells)).not.toContainEqual({ row: 0, col: 1 });
  });

  it("frames occupied and blocked squares as a board and leaves the outside empty", () => {
    expect(ileMapBoardBounds([])).toBeNull();
    const board = ileMapBoardBounds([
      { row: 1, col: -2 },
      { row: 4, col: 3 },
    ]);
    expect(ILE_MAP_BOARD_EXTRA_ROWS).toBe(2);
    expect(ILE_MAP_BOARD_EXTRA_COLS).toBe(2);
    expect(board?.minRow).toBe(1 - 1);
    expect(board?.maxRow).toBe(4 + 1);
    expect(board?.minCol).toBe(-2 - 1);
    expect(board?.maxCol).toBe(3 + 1);
    expect(ILE_BOARD_CELL_SIZE).toBeGreaterThan(SKILL_GRID_CELL_SIZE);
    expect(board?.minX).toBeCloseTo(-3 * ILE_BOARD_PITCH - ILE_MAP_BOARD_MARGIN_PX);
    expect(board?.minY).toBeCloseTo(-ILE_MAP_BOARD_MARGIN_PX);
    expect(board?.width).toBeCloseTo(
      7 * ILE_BOARD_PITCH + ILE_BOARD_CELL_SIZE + ILE_MAP_BOARD_MARGIN_PX * 2,
    );
    expect(board?.height).toBeCloseTo(
      5 * ILE_BOARD_PITCH + ILE_BOARD_CELL_SIZE + ILE_MAP_BOARD_MARGIN_PX * 2,
    );

    const world = read("components/block-skill-grid/map-world-layer.tsx");
    expect(world).toContain("ileMapBoardBounds");
    expect(world).toContain("data-ile-map-board");
    expect(world).toContain("data-ile-map-board-frame");
    expect(world).toContain("data-ile-map-board-frame-outer");
    expect(world).toContain("data-ile-map-board-frame-inner");
    expect(world).toContain("data-ile-map-board-corner");
    expect(ILE_MAP_BOARD_FRAME_INSET_PX).toBeGreaterThan(ILE_MAP_BOARD_FRAME_OUTER_PX);
    expect(ILE_MAP_BOARD_CORNER_PX / 2).toBe(
      ILE_MAP_BOARD_FRAME_INSET_PX + ILE_MAP_BOARD_FRAME_INNER_PX,
    );
    expect(ILE_MAP_BOARD_MARGIN_PX).toBeGreaterThan(ILE_MAP_BOARD_CORNER_PX / 2);
    expect(world).toContain("onChapterBoard(cell.row, cell.col)");
    expect(world).toContain("{ opacity: 1, fullyVisible: true }");
    const shell = read("components/block-skill-grid/map-grid-shell.tsx");
    expect(shell).toContain('world.suggestMode === "chapter"');
    expect(shell).toContain("bg-black");
    expect(shell).toContain("data-ile-board-backdrop");
    expect(shell).toContain("bg-cover bg-center");
    expect(shell).toContain("grayscale(1)");
    expect(shell).toContain("data-ile-board-backdrop-veil");
    expect(shell).toContain("bg-black/65");
    const mini = read("components/block-skill-grid/map-minimap-chrome.tsx");
    expect(mini).toContain("data-ile-minimap-board");
    expect(mini).toContain("data-minimap-fog-base");
    const grid = read("components/BlockSkillGrid.tsx");
    expect(grid).toContain(
      'hidden: showMinimap === false || suggestMode === "chapter"',
    );
    expect(grid).toContain(
      'minimapHidden: showMinimap === false || suggestMode === "chapter"',
    );
    expect(grid).not.toContain('hidden: suggestMode === "chapter"');
    expect(grid).toContain("pathOverlay");
    expect(grid).toContain("annotationLayers");
    expect(grid).toContain("handleMapNoteAddAtCenter");
    expect(grid).toContain(
      'aestheticImageForId(sessionId || "ile-chapter-board", resolvedAestheticImages)',
    );
    expect(grid).toContain("backdropSrc={chapterBoardBackdrop}");
    expect(grid).toContain('suggestMode === "chapter" &&');
    const stack = read("components/block-skill-grid/map-right-stack.tsx");
    expect(stack).toContain("data-ile-path-overlay-toggle");
    expect(stack).toContain("data-annotation-layers-stack");
    expect(stack).toContain("data-learner-note-add");
    expect(stack).toContain("minimapHidden ? 8 :");
  });

  it("the chapter map is a board of squares without altitude contours or cast shadows, and the workspace map does not receive the chapter path overlay", () => {
    const world = read("components/block-skill-grid/map-world-layer.tsx");
    expect(world).not.toContain("data-ile-altitude-map");
    expect(world).not.toContain("data-ile-altitude-shadow");
    expect(world).not.toContain("data-ile-altitude-cast");
    expect(world).not.toContain("ileAltitudeSurface");
    expect(world).not.toContain("ILE_ALTITUDE_TILE_CLASS");
    expect(world).not.toContain("bg-black/50");
    expect(world).toContain(
      'labelPlate={suggestMode === "chapter" && Boolean(tileAesthetic)}',
    );
    const badges = read("components/block-skill-grid/map-tile-badges.tsx");
    expect(badges).toContain("bg-black px-1.5 py-0.5 text-white");
    expect(badges).toContain("data-map-cell-keyword-plate");
    expect(world).toContain("ILE_MAP_BOARD_FILL");
    expect(world).toContain("skillGridMetrics");
    expect(world).toContain('fill="none"');
    expect(world).toContain("border border-dashed");
    expect(world).not.toContain("border border-solid");
    expect(world).not.toContain("!border-transparent bg-transparent");
    expect(world).not.toContain("!border-neutral-500");
    expect(world).toContain('suggestMode !== "chapter" &&');
    expect(world).toContain('glyphVariant="solid"');
    expect(world).toContain('glyphScale={suggestMode === "chapter" ? "chapter" : "block"}');
    expect(world).toContain("ILE_CHAPTER_BLOCK_ALPHA");
    expect(world).toContain("`rgb(0 0 0 / ${ILE_CHAPTER_BLOCK_ALPHA})`");
    expect(world).not.toContain('"!bg-black"');
    expect(world).not.toContain("border-white/20");
    expect(world).toContain('suggestMode === "chapter"');
    expect(world).toContain('suggestMode === "chapter" && showPathOverlay');
    expect(world).toContain("ILE_PATH_YELLOW");
    expect(
      resolveEmptyCellMarker({
        surface: "chapter",
        canEdit: true,
        learnerMode: false,
      }),
    ).toBe("plus");
    expect(world).toContain("data-empty-cell-plus");
    expect(world).toContain("Click to add a chapter");
    expect(world).toContain('surface: suggestMode === "chapter" ? "chapter" : "block"');
    expect(world).toContain('isUnusable && suggestMode !== "chapter"');
    expect(world).toContain("data-map-cell-unusable-mark");
    expect(blockCircularMenuOpensOnEmpty("ile")).toBe(true);
    expect(blockCircularMenuOpensOnEmpty("ile", { unusable: true })).toBe(false);
    expect(blockCircularMenuActions("ile", { empty: true }).map((action) => action.id)).toEqual([
      "add_chapter",
    ]);
    expect(ileVoicePadSpec({ selection: "empty" }).actions.map((action) => action.id)).toEqual([
      "add_chapter",
    ]);
    expect(blockCircularMenuActions("ile").map((action) => action.id)).toEqual(["work", "edit"]);
    const chapter = read("components/ChapterMapPanel.tsx");
    expect(chapter).toContain('suggestMode="chapter"');
    expect(read("lib/ile-tim-chapter-complete.ts")).toContain("chapter_map_expand");
  });
});

describe("ILE board opening camera", () => {
  function screenPoint(
    cam: { zoom: number; pan: { x: number; y: number } },
    x: number,
    y: number,
  ) {
    return { x: cam.pan.x + x * cam.zoom, y: cam.pan.y + y * cam.zoom };
  }

  it("fits the whole board inside the viewport, as large as the clear area allows", () => {
    expect(ILE_BOARD_FIT_INSETS.bottom).toBe(ILE_MAP_VOICE_BAR_CLEARANCE_PX);
    expect(ILE_BOARD_FIT_INSETS.bottom).toBe(140);
    expect(ILE_BOARD_FIT_INSETS.right).toBe(8 + MINIMAP_FRAME_WIDTH + ILE_BOARD_FIT_INSETS.left);
    const board = ileMapBoardBounds([
      { row: 1, col: -2 },
      { row: 4, col: 3 },
    ]);
    expect(board).not.toBeNull();
    const vw = 1280;
    const vh = 720;
    const cam = fitWorldRectCamera({
      viewportWidth: vw,
      viewportHeight: vh,
      minX: board!.minX,
      minY: board!.minY,
      width: board!.width,
      height: board!.height,
      insets: ILE_BOARD_FIT_INSETS,
    });
    expect(cam).not.toBeNull();
    const topLeft = screenPoint(cam!, board!.minX, board!.minY);
    const bottomRight = screenPoint(
      cam!,
      board!.minX + board!.width,
      board!.minY + board!.height,
    );
    expect(topLeft.x).toBeGreaterThanOrEqual(ILE_BOARD_FIT_INSETS.left - 0.01);
    expect(topLeft.y).toBeGreaterThanOrEqual(ILE_BOARD_FIT_INSETS.top - 0.01);
    expect(bottomRight.x).toBeLessThanOrEqual(vw - ILE_BOARD_FIT_INSETS.right + 0.01);
    expect(bottomRight.y).toBeLessThanOrEqual(vh - ILE_BOARD_FIT_INSETS.bottom + 0.01);
    const flushX =
      Math.abs(topLeft.x - ILE_BOARD_FIT_INSETS.left) < 0.01 &&
      Math.abs(bottomRight.x - (vw - ILE_BOARD_FIT_INSETS.right)) < 0.01;
    const flushY =
      Math.abs(topLeft.y - ILE_BOARD_FIT_INSETS.top) < 0.01 &&
      Math.abs(bottomRight.y - (vh - ILE_BOARD_FIT_INSETS.bottom)) < 0.01;
    expect(flushX || flushY).toBe(true);
    const availW = vw - ILE_BOARD_FIT_INSETS.left - ILE_BOARD_FIT_INSETS.right;
    const availH = vh - ILE_BOARD_FIT_INSETS.top - ILE_BOARD_FIT_INSETS.bottom;
    expect(cam!.zoom).toBeCloseTo(Math.min(availW / board!.width, availH / board!.height), 5);
  });

  it("shrinks a board that is larger than the old minimum zoom so the frame still fits", () => {
    const cam = fitWorldRectCamera({
      viewportWidth: 800,
      viewportHeight: 600,
      minX: 0,
      minY: 0,
      width: 10000,
      height: 10000,
    });
    expect(cam).not.toBeNull();
    expect(cam!.zoom).toBeLessThan(SKILL_GRID_MIN_ZOOM);
    expect(skillGridZoomFloor(cam!.zoom)).toBeCloseTo(cam!.zoom, 5);
    expect(skillGridZoomFloor(1)).toBe(SKILL_GRID_MIN_ZOOM);
    expect(cam!.zoom).toBeCloseTo(600 / 10000, 5);
    expect(screenPoint(cam!, 0, 0).y).toBeCloseTo(0, 5);
    expect(screenPoint(cam!, 10000, 10000).y).toBeCloseTo(600, 5);
  });

  it("keeps the workspace reference zoom at 0.70", () => {
    expect(SKILL_GRID_DEFAULT_ZOOM_AT_REFERENCE).toBe(0.7);
    expect(SKILL_GRID_ILE_DEFAULT_ZOOM_AT_REFERENCE).toBe(0.7);
    const width = 500;
    const height =
      (SKILL_GRID_DEFAULT_ZOOM_REFERENCE_SCALE * SKILL_GRID_DEFAULT_ZOOM_REFERENCE_SCALE) / width;
    expect(getDefaultSkillGridZoom(width, height)).toBeCloseTo(0.7, 5);
    const grid = read("components/BlockSkillGrid.tsx");
    const viewport = read("components/block-skill-grid/use-map-viewport.ts");
    expect(grid).toContain("ILE_BOARD_FIT_INSETS");
    expect(grid).toContain("ileMapBoardBounds");
    expect(grid).toContain('fitBoard: suggestMode === "chapter"');
    expect(viewport).toContain("fitWorldRectCamera");
    expect(viewport).toContain("getDefaultSkillGridZoom");
    expect(read("components/ChapterMapPanel.tsx")).toContain(
      "SKILL_GRID_ILE_DEFAULT_ZOOM_AT_REFERENCE",
    );
  });
});
