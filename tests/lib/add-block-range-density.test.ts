import { readWorkspaceViewSurface } from "@/tests/helpers/surface-source";
/**
 * Pure Range/Density multi-create selection for Add-block cold-start.
 * Drives shipped helpers — no re-implementation of circle/sample logic.
 */
import { describe, expect, it } from "vitest";
import { readMapGridSurface } from "../helpers/surface-source";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  ADD_DENSITY_MAX,
  ADD_RANGE_MAX,
  abortAddExpandJob,
  abortIsJobLocal,
  activeAddExpandJobs,
  activeExpandJobLockedCellKeys,
  addExpandProgressFraction,
  advanceAddExpandProgress,
  applyAddExpandJobProgress,
  cellsInRangeCircle,
  countForDensity,
  createAddExpandJob,
  createAddExpandJobId,
  gridEuclideanDistance,
  isBlockGenerationLocked,
  isOccupiedCellsGenerationLocked,
  mergeActiveExpandJobPreviews,
  nextRandomizeSeed,
  remainingAddExpandPreview,
  resolveAddExpandSelection,
  runAddExpandCreateLoop,
  sampleCellsByDensity,
  seedShuffleCells,
  shouldCreateNextAddExpandSlot,
  snapshotAddExpandSlots,
  upsertAddExpandJob,
} from "@/lib/add-block-range-density";
import { tmpdir } from "node:os";

const ROOT = join(__dirname, "../..");
const SCRATCH =
  process.env.ADD_RANGE_DENSITY_SCRATCH ||
  process.env.GOAL_SCRATCH ||
  join(tmpdir(), "openlesson-scratch", "grok-goal-a1ef41157336/implementer");

function read(rel: string) {
  const path = join(ROOT, rel);
  expect(existsSync(path), `missing ${rel}`).toBe(true);
  return readFileSync(path, "utf8");
}

function writeEvidence(name: string, body: string) {
  try {
    mkdirSync(SCRATCH, { recursive: true });
    writeFileSync(join(SCRATCH, name), body, "utf8");
  } catch {
    /* optional */
  }
}

const center = { row: 5, col: 5 };

describe("cellsInRangeCircle", () => {
  it("range 0 → only center when placeable", () => {
    const cells = cellsInRangeCircle({ center, range: 0 });
    expect(cells).toEqual([center]);
  });

  it("larger range is a superset of smaller range candidates", () => {
    const r0 = cellsInRangeCircle({ center, range: 0 });
    const r1 = cellsInRangeCircle({ center, range: 1 });
    const r2 = cellsInRangeCircle({ center, range: 2 });
    const keys = (cs: { row: number; col: number }[]) =>
      new Set(cs.map((c) => `${c.row}:${c.col}`));
    const k0 = keys(r0);
    const k1 = keys(r1);
    const k2 = keys(r2);
    for (const k of k0) expect(k1.has(k)).toBe(true);
    for (const k of k1) expect(k2.has(k)).toBe(true);
    expect(r2.length).toBeGreaterThanOrEqual(r1.length);
    expect(r1.length).toBeGreaterThanOrEqual(r0.length);
    // Circle: corners of a 2×2 square may be outside radius 1
    for (const c of r1) {
      expect(gridEuclideanDistance(center, c)).toBeLessThanOrEqual(1 + 1e-9);
    }
  });

  it("excludes occupied and unusable cells", () => {
    const occupied = new Set(["5:6", "4:5"]);
    const unusable = new Set(["5:4"]);
    const cells = cellsInRangeCircle({
      center,
      range: 1,
      occupiedKeys: occupied,
      unusableKeys: unusable,
    });
    const keys = cells.map((c) => `${c.row}:${c.col}`);
    expect(keys).toContain("5:5");
    expect(keys).not.toContain("5:6");
    expect(keys).not.toContain("4:5");
    expect(keys).not.toContain("5:4");
  });
});

describe("sampleCellsByDensity + seed", () => {
  it("density max selects all candidates; low density selects fewer", () => {
    const candidates = cellsInRangeCircle({ center, range: 2 });
    expect(candidates.length).toBeGreaterThan(3);
    const all = sampleCellsByDensity({
      candidates,
      density: ADD_DENSITY_MAX,
      seed: 1,
    });
    expect(all).toEqual(candidates);
    expect(countForDensity(candidates.length, ADD_DENSITY_MAX)).toBe(
      candidates.length,
    );

    const few = sampleCellsByDensity({
      candidates,
      density: 20,
      seed: 1,
    });
    expect(few.length).toBeLessThan(candidates.length);
    expect(few.length).toBeGreaterThanOrEqual(1);
    expect(few[0]).toEqual(center);
  });

  it("same seed is deterministic; different seed re-samples when density < max", () => {
    const candidates = cellsInRangeCircle({ center, range: 3 });
    const a = sampleCellsByDensity({
      candidates,
      density: 40,
      seed: 42,
    });
    const b = sampleCellsByDensity({
      candidates,
      density: 40,
      seed: 42,
    });
    expect(a).toEqual(b);

    const c = sampleCellsByDensity({
      candidates,
      density: 40,
      seed: nextRandomizeSeed(42),
    });
    // Same length, center fixed; rest may differ for large enough candidate sets
    expect(c.length).toBe(a.length);
    expect(c[0]).toEqual(center);
    const restA = a
      .slice(1)
      .map((x) => `${x.row}:${x.col}`)
      .join(",");
    const restC = c
      .slice(1)
      .map((x) => `${x.row}:${x.col}`)
      .join(",");
    // With range 3 and density 40 there should be multiple samples to shuffle
    if (a.length > 2) {
      expect(restA === restC).toBe(false);
    }
  });

  it("seedShuffle is a permutation of input", () => {
    const cells = [
      { row: 0, col: 0 },
      { row: 0, col: 1 },
      { row: 1, col: 0 },
      { row: 1, col: 1 },
    ];
    const shuffled = seedShuffleCells(cells, 99);
    expect(shuffled).toHaveLength(cells.length);
    const keys = new Set(shuffled.map((c) => `${c.row}:${c.col}`));
    expect(keys.size).toBe(4);
  });
});

describe("resolveAddExpandSelection pipeline", () => {
  it("wires range + density end-to-end with occupied holes", () => {
    const occupied = new Set(["5:5"]); // center occupied → empty candidates only neighbors
    const r1 = resolveAddExpandSelection({
      center,
      range: 1,
      density: 100,
      seed: 1,
      occupiedKeys: occupied,
    });
    // Center excluded; neighbors remain
    expect(r1.candidates.some((c) => c.row === 5 && c.col === 5)).toBe(false);
    expect(r1.selected.length).toBe(r1.candidates.length);

    const free = resolveAddExpandSelection({
      center,
      range: 2,
      density: 50,
      seed: 7,
      occupiedKeys: new Set(),
    });
    expect(free.candidates[0]).toEqual(center);
    expect(free.selected[0]).toEqual(center);
    expect(free.selected.length).toBeLessThanOrEqual(free.candidates.length);
    expect(free.selected.length).toBe(
      countForDensity(free.candidates.length, 50),
    );

    writeEvidence(
      "range-density-select-tests.log",
      [
        "rangeMax=" + ADD_RANGE_MAX,
        "r0count=" + cellsInRangeCircle({ center, range: 0 }).length,
        "r2count=" + cellsInRangeCircle({ center, range: 2 }).length,
        "density50n=" + free.selected.length,
        "density100n=" + free.candidates.length,
        "centerFirst=" + (free.selected[0]?.row === 5 && free.selected[0]?.col === 5),
      ].join("\n"),
    );
  });
});

describe("multi-create freeze + progress + stop (shipped helpers)", () => {
  it("snapshot freezes membership when occupancy grows mid-run", () => {
    const free = resolveAddExpandSelection({
      center,
      range: 2,
      density: 50,
      seed: 11,
    });
    expect(free.selected.length).toBeGreaterThan(1);
    const frozen = snapshotAddExpandSlots({
      center,
      selected: free.selected,
    });
    expect(frozen[0]).toEqual(center);
    expect(frozen.length).toBe(free.selected.length);

    // After "creating" center, live re-sample would drop center and reshuffle.
    const midRunOccupied = new Set(frozen.slice(0, 2).map((c) => `${c.row}:${c.col}`));
    const liveAfter = resolveAddExpandSelection({
      center,
      range: 2,
      density: 50,
      seed: 11,
      occupiedKeys: midRunOccupied,
    });
    // Live path excludes occupied slots — membership differs from freeze.
    const liveKeys = liveAfter.selected.map((c) => `${c.row}:${c.col}`).sort();
    const frozenKeys = frozen.map((c) => `${c.row}:${c.col}`).sort();
    expect(liveKeys).not.toEqual(frozenKeys);
    // Frozen list still has the original membership (including created cells).
    for (const c of frozen.slice(0, 2)) {
      expect(frozen.some((x) => x.row === c.row && x.col === c.col)).toBe(true);
    }

    // Progress + remaining preview use frozen membership only
    expect(addExpandProgressFraction({ completed: 0, total: frozen.length })).toBe(0);
    expect(addExpandProgressFraction({ completed: frozen.length, total: frozen.length })).toBe(
      1,
    );
    expect(
      addExpandProgressFraction({ completed: 1, total: 4 }),
    ).toBeCloseTo(0.25);

    const afterOne = advanceAddExpandProgress({
      completed: 0,
      total: frozen.length,
    });
    expect(afterOne).toEqual({ completed: 1, total: frozen.length });
    const remaining = remainingAddExpandPreview(frozen, afterOne.completed);
    expect(remaining).toEqual(frozen.slice(1));
    expect(remaining[0]).toEqual(frozen[1]);

    writeEvidence(
      "async-expand-progress.log",
      [
        "frozenN=" + frozen.length,
        "liveAfterN=" + liveAfter.selected.length,
        "membershipStable=" +
          String(
            frozen.map((c) => `${c.row}:${c.col}`).join("|") ===
              snapshotAddExpandSlots({ center, selected: free.selected })
                .map((c) => `${c.row}:${c.col}`)
                .join("|"),
          ),
        "fraction1of4=" + addExpandProgressFraction({ completed: 1, total: 4 }),
        "remainingAfter1=" + remaining.length,
        "liveDiffersFromFrozen=" + String(liveKeys.join() !== frozenKeys.join()),
      ].join("\n"),
    );
    // Keep legacy name too for older harnesses.
    writeEvidence(
      "range-density-progress.log",
      [
        "frozenN=" + frozen.length,
        "fraction1of4=" + addExpandProgressFraction({ completed: 1, total: 4 }),
      ].join("\n"),
    );
  });

  it("runAddExpandCreateLoop reports progress and stops remaining on abort", async () => {
    const slots = [
      { row: 0, col: 0 },
      { row: 0, col: 1 },
      { row: 0, col: 2 },
      { row: 1, col: 0 },
    ];
    const created: string[] = [];
    let aborted = false;
    const progressLog: Array<{ completed: number; total: number }> = [];

    const result = await runAddExpandCreateLoop({
      frozenSlots: slots,
      isAborted: () => aborted,
      onProgress: (p) => progressLog.push({ ...p }),
      createSlot: async (slot, index) => {
        created.push(`${slot.row}:${slot.col}`);
        // Abort after the second slot finishes its create body — next check stops.
        if (index === 1) aborted = true;
      },
    });

    expect(result.stopped).toBe(true);
    expect(result.total).toBe(4);
    // Slots 0 and 1 created; 2 and 3 skipped
    expect(created).toEqual(["0:0", "0:1"]);
    expect(result.completed).toBe(2);
    expect(progressLog[0]).toEqual({ completed: 0, total: 4 });
    expect(progressLog.some((p) => p.completed === 2 && p.total === 4)).toBe(
      true,
    );
    expect(
      shouldCreateNextAddExpandSlot({
        nextIndex: 2,
        total: 4,
        aborted: true,
      }),
    ).toBe(false);
    expect(
      shouldCreateNextAddExpandSlot({
        nextIndex: 2,
        total: 4,
        aborted: false,
      }),
    ).toBe(true);

    // Full run without abort
    const all: string[] = [];
    const full = await runAddExpandCreateLoop({
      frozenSlots: slots,
      isAborted: () => false,
      createSlot: async (slot) => {
        all.push(`${slot.row}:${slot.col}`);
      },
    });
    expect(full.stopped).toBe(false);
    expect(full.completed).toBe(4);
    expect(all).toHaveLength(4);

    writeEvidence(
      "range-density-stop.log",
      [
        "stopped=" + result.stopped,
        "completed=" + result.completed,
        "created=" + created.join(","),
        "skipped=" + slots.slice(2).map((c) => `${c.row}:${c.col}`).join(","),
        "fullCompleted=" + full.completed,
        "progressSteps=" + progressLog.map((p) => `${p.completed}/${p.total}`).join(";"),
      ].join("\n"),
    );
  });
});

describe("structural: Add pane Range/Density/Randomize + multi 1×1 create", () => {

  it("generation click-lock: running job freezes full membership; finished unlocks", () => {
    const job = createAddExpandJob({
      id: createAddExpandJobId("lock"),
      frozenSlots: [
        { row: 1, col: 1 },
        { row: 1, col: 2 },
        { row: 2, col: 1 },
      ],
      label: "gen",
    });
    // After first slot "created", completed advances but full frozen list still locks.
    let jobs = [
      applyAddExpandJobProgress([job], job.id, { completed: 1, total: 3 })[0],
    ];
    expect(jobs[0].status).toBe("running");
    const locked = activeExpandJobLockedCellKeys(jobs);
    expect(locked.has("1:1")).toBe(true); // already placed for this job
    expect(locked.has("1:2")).toBe(true); // still pending
    expect(locked.has("2:1")).toBe(true);
    expect(locked.has("9:9")).toBe(false);

    expect(
      isOccupiedCellsGenerationLocked([{ row: 1, col: 1 }], locked),
    ).toBe(true);
    expect(
      isOccupiedCellsGenerationLocked([{ row: 5, col: 5 }], locked),
    ).toBe(false);
    expect(
      isBlockGenerationLocked({
        occupiedCells: [{ row: 1, col: 2 }],
        jobs,
      }),
    ).toBe(true);

    // Completed job no longer locks
    jobs = applyAddExpandJobProgress(jobs, job.id, {
      completed: 3,
      total: 3,
    });
    expect(jobs[0].status).toBe("completed");
    expect(activeExpandJobLockedCellKeys(jobs).size).toBe(0);
    expect(
      isBlockGenerationLocked({
        occupiedCells: [{ row: 1, col: 1 }],
        jobs,
      }),
    ).toBe(false);

    writeEvidence(
      "expand-job-click-lock.log",
      [
        "runningLocksPlacedAndPending=" +
          String(locked.has("1:1") && locked.has("1:2")),
        "unrelatedUnlocked=" + String(!locked.has("9:9")),
        "completedUnlocks=" +
          String(activeExpandJobLockedCellKeys(jobs).size === 0),
      ].join("\n"),
    );
  });

  it("async jobs: concurrent accounting; abort one leaves the other", () => {
    const a = createAddExpandJob({
      id: createAddExpandJobId("a"),
      frozenSlots: [
        { row: 0, col: 0 },
        { row: 0, col: 1 },
      ],
      label: "job-a",
    });
    const b = createAddExpandJob({
      id: createAddExpandJobId("b"),
      frozenSlots: [
        { row: 2, col: 2 },
        { row: 2, col: 3 },
        { row: 2, col: 4 },
      ],
      label: "job-b",
    });
    let jobs = upsertAddExpandJob([], a);
    jobs = upsertAddExpandJob(jobs, b);
    expect(activeAddExpandJobs(jobs)).toHaveLength(2);
    expect(abortIsJobLocal(jobs, a.id, b.id)).toBe(true);

    jobs = abortAddExpandJob(jobs, a.id);
    expect(jobs.find((j) => j.id === a.id)?.aborted).toBe(true);
    expect(jobs.find((j) => j.id === b.id)?.aborted).toBe(false);

    jobs = applyAddExpandJobProgress(jobs, b.id, { completed: 1, total: 3 });
    expect(jobs.find((j) => j.id === b.id)?.completed).toBe(1);
    expect(jobs.find((j) => j.id === b.id)?.status).toBe("running");

    const preview = mergeActiveExpandJobPreviews(jobs);
    // a still running until status changes; both running with abort flag on a
    expect(preview.length).toBeGreaterThan(0);

    writeEvidence(
      "async-expand-concurrent.log",
      [
        "jobCount=" + jobs.length,
        "abortALocal=" + abortIsJobLocal([a, b], a.id, b.id),
        "bStillRunning=" +
          String(jobs.find((j) => j.id === b.id)?.status === "running"),
        "aAborted=" + String(jobs.find((j) => j.id === a.id)?.aborted),
        "previewN=" + preview.length,
      ].join("\n"),
    );
  });


});
