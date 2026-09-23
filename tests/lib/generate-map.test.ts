import { describe, expect, it } from "vitest";
import {
  mapWorkspaceNodes,
  type WorkspaceBlockApiNode,
} from "@/components/workspace-view/types";
import { buildGenerateMap, generateMapHighlightCells } from "@/lib/generate-map";
import { chebyshevDist } from "@/lib/workspace-map-types";
import {
  blockedCellsFromMapType,
  cellsWithMark,
  formatMapTypeGeneratorContext,
  resolveMapTypeRecord,
  schematicStartCell,
} from "@/lib/workspace-map-types";

function cellKey(row: number, col: number) {
  return `${row}:${col}`;
}

describe("Generate Map builder", () => {
  it("translates a shaped skeleton onto the anchor and keeps the modifier in the prompt", () => {
    const mapTypeId = "hub";
    const modifier = "Emphasize schema-building spokes";
    const anchor = { row: 8, col: -3 };
    const record = resolveMapTypeRecord(mapTypeId);
    const ctx = formatMapTypeGeneratorContext(record);
    const spawn = cellsWithMark(record, "spawn");
    const start = schematicStartCell(spawn);
    const built = buildGenerateMap({
      anchor,
      modifier,
      mapTypeId,
      goal: "Build a schema",
      fileNames: ["schema-notes.md"],
    });

    expect(built.prompt).toContain(modifier);
    expect(built.prompt).toContain(`position_x=${anchor.col}`);
    expect(built.prompt).toContain(`position_y=${anchor.row}`);
    expect(built.prompt).toContain(ctx.countInstruction);
    expect(built.prompt).toContain(ctx.spatialInstruction);
    expect(built.prompt).toContain("schema-notes.md");

    const dRow = anchor.row - start.row;
    const dCol = anchor.col - start.col;
    const expected = spawn.map((cell) => ({
      row: cell.row + dRow,
      col: cell.col + dCol,
    }));
    const actualKeys = built.placements.map((cell) => cellKey(cell.position_y, cell.position_x)).sort();
    const expectedKeys = expected.map((cell) => cellKey(cell.row, cell.col)).sort();
    expect(actualKeys).toEqual(expectedKeys);
    expect(built.placements.length).toBe(spawn.length);

    const placedSpawn = spawn;
    const placementByKey = new Map(
      built.placements.map((cell) => [cellKey(cell.position_y, cell.position_x), cell]),
    );
    for (let i = 0; i < placedSpawn.length; i += 1) {
      for (let j = i + 1; j < placedSpawn.length; j += 1) {
        const a = placedSpawn[i]!;
        const b = placedSpawn[j]!;
        const pa = placementByKey.get(cellKey(a.row + dRow, a.col + dCol));
        const pb = placementByKey.get(cellKey(b.row + dRow, b.col + dCol));
        expect(pa && pb).toBeTruthy();
        expect(
          chebyshevDist(
            { row: pa!.position_y, col: pa!.position_x },
            { row: pb!.position_y, col: pb!.position_x },
          ),
        ).toBe(chebyshevDist(a, b));
      }
    }

    const keys = new Set(actualKeys);
    expect(keys.size).toBe(actualKeys.length);
    expect(keys.has(cellKey(anchor.row, anchor.col))).toBe(true);
    const highlight = generateMapHighlightCells({ anchor, mapTypeId });
    expect(highlight.map((cell) => cellKey(cell.row, cell.col)).sort()).toEqual(actualKeys);

    const translatedBlocked = blockedCellsFromMapType(record).map((cell) =>
      cellKey(cell.row + dRow, cell.col + dCol),
    );
    for (const key of translatedBlocked) {
      expect(keys.has(key)).toBe(false);
    }
    expect(
      built.placements.some(
        (cell) => cell.position_x === anchor.col && cell.position_y === anchor.row,
      ),
    ).toBe(true);

    const neighbor = spawn.find(
      (cell) => !(cell.row === start.row && cell.col === start.col),
    );
    expect(neighbor).toBeTruthy();
    const occupied = {
      row: neighbor!.row + dRow,
      col: neighbor!.col + dCol,
    };
    const skipped = buildGenerateMap({
      anchor,
      modifier: "",
      mapTypeId,
      occupied: [occupied],
    });
    expect(
      skipped.placements.some(
        (cell) => cell.position_x === anchor.col && cell.position_y === anchor.row,
      ),
    ).toBe(true);
    expect(
      skipped.placements.some(
        (cell) => cell.position_x === occupied.col && cell.position_y === occupied.row,
      ),
    ).toBe(false);
    expect(skipped.prompt).not.toContain("Modifier prompt:");
  });

  it("refreshes an AYCL clone with Explore forced on while drill and scout stay as stored", () => {
    const [node] = mapWorkspaceNodes(
      [
        {
          id: "spoke-1",
          title: "Spoke",
          description: "",
          is_start: false,
          next_block_ids: [],
          status: "available",
          practice_options: {
            allow_explore: false,
            allow_drill: true,
            allow_scout: true,
          },
          creator_effects: null,
        } as unknown as WorkspaceBlockApiNode,
      ],
      { ayclClone: true },
    );
    expect(node.practice_options?.allowExplore).toBe(true);
    expect(node.practice_options?.allowDrill).toBe(true);
    expect(node.practice_options?.allowScout).toBe(true);
    expect(node.creator_effects).toBeTruthy();
  });
});
