/**
 * Map-ground pure rules: lock-until prerequisites + unusable cells.
 */
import { describe, expect, it } from "vitest";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  blockHasLockDependencies,
  canPlaceOnMapGround,
  incompleteLockPrerequisites,
  isBlockLockedUntilCompleted,
  isUnusableCell,
  loadMapGroundRules,
  normalizeLockUntilBlockIds,
  normalizeUnusableCells,
  resolveBlockLockStates,
  resolveMapGroundCellKind,
  serializeMapGroundRules,
  setBlockLockUntil,
  toggleUnusableCell,
} from "@/lib/map-ground-rules";

const SCRATCH =
  process.env.MAP_GROUND_SCRATCH ||
  "/var/folders/kd/98qlvkyd4mb3_9t32p9bmt_r0000gn/T/grok-goal-0b9bfff9cca4/implementer";

function log(lines: string[]) {
  try {
    mkdirSync(SCRATCH, { recursive: true });
    writeFileSync(join(SCRATCH, "map-ground-rules.log"), lines.join("\n"), "utf8");
  } catch {
    /* optional */
  }
}

describe("lock-until completed prerequisites", () => {
  const blocks = [
    { id: "a", title: "Start", status: "completed" },
    {
      id: "b",
      title: "Middle",
      status: "not_started",
      lock_until_block_ids: ["a"],
    },
    {
      id: "c",
      title: "End",
      status: "not_started",
      lock_until_block_ids: ["a", "b"],
    },
  ];
  const byId = new Map(blocks.map((b) => [b.id, b]));

  it("locks when any prerequisite is incomplete", () => {
    expect(isBlockLockedUntilCompleted(blocks[1], byId)).toBe(false); // a completed
    expect(isBlockLockedUntilCompleted(blocks[2], byId)).toBe(true); // b incomplete
    expect(incompleteLockPrerequisites(blocks[2], byId).map((p) => p.id)).toEqual(["b"]);
  });

  it("unlocks when all required blocks are completed", () => {
    const done = [
      { id: "a", title: "Start", status: "completed" },
      { id: "b", title: "Middle", status: "completed", lock_until_block_ids: ["a"] },
      { id: "c", title: "End", status: "not_started", lock_until_block_ids: ["a", "b"] },
    ];
    const map = new Map(done.map((b) => [b.id, b]));
    expect(isBlockLockedUntilCompleted(done[2], map)).toBe(false);
    expect(incompleteLockPrerequisites(done[2], map)).toEqual([]);
  });

  it("no lock ids ⇒ unlocked", () => {
    expect(
      isBlockLockedUntilCompleted({ id: "x", status: "not_started" }, byId),
    ).toBe(false);
  });

  it("blockHasLockDependencies is true when lock-until ids exist (even if unlocked)", () => {
    // a completed → b unlocked but still has dependencies declared
    expect(blockHasLockDependencies(blocks[0])).toBe(false);
    expect(blockHasLockDependencies(blocks[1])).toBe(true);
    expect(isBlockLockedUntilCompleted(blocks[1], byId)).toBe(false);
    expect(blockHasLockDependencies(blocks[2])).toBe(true);
  });

  it("resolveBlockLockStates + setBlockLockUntil", () => {
    const states = resolveBlockLockStates(blocks);
    expect(states.get("b")?.locked).toBe(false);
    expect(states.get("c")?.locked).toBe(true);
    expect(setBlockLockUntil("c", ["a", "c", "b"]).lock_until_block_ids).toEqual([
      "a",
      "b",
    ]);
  });
});

describe("unusable cells occupancy", () => {
  it("normalizes and toggles cells; unusable is not open ground", () => {
    const cells = normalizeUnusableCells([
      { row: 1, col: 2 },
      { row: 1, col: 2 },
      { r: 0, c: 0 },
      { junk: true },
    ]);
    expect(cells).toEqual([
      { row: 1, col: 2 },
      { row: 0, col: 0 },
    ]);
    expect(isUnusableCell(cells, 1, 2)).toBe(true);
    expect(isUnusableCell(cells, 9, 9)).toBe(false);
    expect(resolveMapGroundCellKind({ row: 1, col: 2, unusableCells: cells })).toBe(
      "unusable",
    );
    expect(resolveMapGroundCellKind({ row: 5, col: 5, unusableCells: cells })).toBe("open");

    const toggled = toggleUnusableCell(cells, 1, 2);
    expect(isUnusableCell(toggled, 1, 2)).toBe(false);
    const retoggled = toggleUnusableCell(toggled, 1, 2);
    expect(isUnusableCell(retoggled, 1, 2)).toBe(true);
  });

  it("canPlaceOnMapGround rejects unusable and occupied cells", () => {
    const unusable = [{ row: 0, col: 1 }];
    const occupied = new Set(["0:2"]);
    expect(
      canPlaceOnMapGround(
        [
          { row: 0, col: 0 },
          { row: 0, col: 1 },
        ],
        unusable,
        occupied,
      ),
    ).toMatchObject({ ok: false, reason: "unusable" });
    expect(
      canPlaceOnMapGround([{ row: 0, col: 2 }], unusable, occupied),
    ).toMatchObject({ ok: false, reason: "occupied" });
    expect(
      canPlaceOnMapGround([{ row: 0, col: 0 }], unusable, occupied),
    ).toMatchObject({ ok: true, reason: "ok" });
  });
});

describe("persistence normalize / load helpers", () => {
  it("round-trips through loadMapGroundRules + serializeMapGroundRules", () => {
    const loaded = loadMapGroundRules({
      unusable_cells: [{ row: 2, col: 3 }],
      blocks: [
        {
          id: "b1",
          title: "A",
          status: "not_started",
          lock_until_block_ids: ["b0", "b1"],
        },
      ],
    });
    expect(loaded.unusableCells).toEqual([{ row: 2, col: 3 }]);
    expect(loaded.blocks[0].lock_until_block_ids).toEqual(["b0"]);
    const serialized = serializeMapGroundRules(loaded);
    expect(serialized.unusable_cells).toEqual([{ row: 2, col: 3 }]);
    expect(serialized.blocks[0].lock_until_block_ids).toEqual(["b0"]);
    expect(normalizeLockUntilBlockIds("x,y x", "y")).toEqual(["x"]);

    log([
      "lock c while b incomplete: locked=true",
      "lock c when a+b completed: locked=false",
      "unusable (1,2) not placeable",
      "place on open (0,0): ok",
      JSON.stringify(serialized),
    ]);
  });
});
