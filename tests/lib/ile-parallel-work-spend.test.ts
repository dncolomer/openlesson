/**
 * Unified ILE PoW spend: first Work free; extra Work gated by slider-scaled pool.
 * Drives shipped helpers — not a copy.
 */
import { describe, expect, it } from "vitest";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  addIleOpenWork,
  applyIleOpenWorkIdsToMetadata,
  applyIlePowSpend,
  clampIlePowExpense,
  consumeIlePowUnits,
  decideIleWorkStart,
  ileOpenWorkHas,
  ilePowAdditionalWorkRemaining,
  ilePowGatherMinTotal,
  ilePowParallelWorkCapacity,
  ilePowUnifiedPool,
  ilePowWorkStartCost,
  ILE_OPEN_WORK_IDS_META_KEY,
  ILE_POW_EXPENSE_DEFAULT,
  ILE_WORK_INSUFFICIENT_POW_WARNING,
  parseIleOpenWorkIdsFromMetadata,
  restoreIleOpenWorkIds,
} from "@/lib/ile-pow-spend";
import {
  availableIlePowCounts,
  decideIleGatherResources,
} from "@/lib/ile-gather-resources";
import { emptyIlePowTypeCounts } from "@/lib/ile-pow-counters";

const SCRATCH =
  process.env.GROK_GOAL_SCRATCH ||
  "/var/folders/kd/98qlvkyd4mb3_9t32p9bmt_r0000gn/T/grok-goal-b5fb51e17c96/implementer";

function writeScratch(name: string, body: string) {
  mkdirSync(SCRATCH, { recursive: true });
  writeFileSync(join(SCRATCH, name), body, "utf8");
}

const poolSix: typeof emptyIlePowTypeCounts extends () => infer T ? T : never = {
  tool: 6,
  screen: 0,
  video: 0,
  eeg: 0,
};

describe("decideIleWorkStart (shipped)", () => {
  it("allows first Work, gates a second on slider-scaled pool, and cheaper affords more parallel Works", () => {
    const first = decideIleWorkStart({
      chapterId: "ch-a",
      openWorkIds: [],
      available: emptyIlePowTypeCounts(),
      expense: ILE_POW_EXPENSE_DEFAULT,
    });
    expect(first.allowed).toBe(true);
    expect(first.reason).toBe("ok");
    expect(first.consumeUnits).toBe(0);
    expect(first.openWorkIds).toEqual(["ch-a"]);
    expect(ileOpenWorkHas(first.openWorkIds, "ch-a")).toBe(true);

    const already = decideIleWorkStart({
      chapterId: "ch-a",
      openWorkIds: first.openWorkIds,
      available: poolSix,
      expense: ILE_POW_EXPENSE_DEFAULT,
    });
    expect(already.allowed).toBe(true);
    expect(already.reason).toBe("already_open");
    expect(already.consumeUnits).toBe(0);

    const defaultCost = ilePowWorkStartCost(ILE_POW_EXPENSE_DEFAULT);
    expect(defaultCost).toBe(3);
    const secondOk = decideIleWorkStart({
      chapterId: "ch-b",
      openWorkIds: first.openWorkIds,
      available: poolSix,
      expense: ILE_POW_EXPENSE_DEFAULT,
    });
    expect(secondOk.allowed).toBe(true);
    expect(secondOk.reason).toBe("ok");
    expect(secondOk.consumeUnits).toBe(defaultCost);
    expect(secondOk.consume.tool).toBe(defaultCost);
    expect(secondOk.openWorkIds).toEqual(["ch-a", "ch-b"]);

    const spent = applyIlePowSpend(emptyIlePowTypeCounts(), secondOk.consume);
    const leftover = availableIlePowCounts(poolSix, spent);
    expect(ilePowUnifiedPool({ available: leftover })).toBe(3);

    const third = decideIleWorkStart({
      chapterId: "ch-c",
      openWorkIds: secondOk.openWorkIds,
      available: leftover,
      expense: ILE_POW_EXPENSE_DEFAULT,
    });
    expect(third.allowed).toBe(true);
    expect(third.consumeUnits).toBe(3);

    const spentTwo = applyIlePowSpend(spent, third.consume);
    const emptyAvail = availableIlePowCounts(poolSix, spentTwo);
    const refused = decideIleWorkStart({
      chapterId: "ch-d",
      openWorkIds: third.openWorkIds,
      available: emptyAvail,
      expense: ILE_POW_EXPENSE_DEFAULT,
    });
    expect(refused.allowed).toBe(false);
    expect(refused.reason).toBe("insufficient_pow");
    expect(refused.openWorkIds).toEqual(["ch-a", "ch-b", "ch-c"]);
    expect(refused.warning).toBe(ILE_WORK_INSUFFICIENT_POW_WARNING);
    expect(addIleOpenWork(refused.openWorkIds, "ch-d")).toEqual([
      "ch-a",
      "ch-b",
      "ch-c",
      "ch-d",
    ]);

    const tiny = { tool: 1, screen: 0, video: 0, eeg: 0 };
    const secondRefused = decideIleWorkStart({
      chapterId: "ch-b",
      openWorkIds: ["ch-a"],
      available: tiny,
      expense: ILE_POW_EXPENSE_DEFAULT,
    });
    expect(secondRefused.allowed).toBe(false);
    expect(secondRefused.reason).toBe("insufficient_pow");
    expect(secondRefused.openWorkIds).toEqual(["ch-a"]);

    const samePool = ilePowUnifiedPool({ available: poolSix });
    expect(samePool).toBe(6);
    const cheapCap = ilePowParallelWorkCapacity({ pool: samePool, expense: 1 });
    const dearCap = ilePowParallelWorkCapacity({ pool: samePool, expense: 5 });
    expect(cheapCap).toBeGreaterThan(dearCap);
    expect(cheapCap).toBe(1 + Math.floor(6 / ilePowWorkStartCost(1)));
    expect(dearCap).toBe(1 + Math.floor(6 / ilePowWorkStartCost(5)));

    const cheapSecond = decideIleWorkStart({
      chapterId: "ch-b",
      openWorkIds: ["ch-a"],
      available: poolSix,
      expense: 1,
    });
    const dearSecond = decideIleWorkStart({
      chapterId: "ch-b",
      openWorkIds: ["ch-a"],
      available: poolSix,
      expense: 5,
    });
    expect(cheapSecond.allowed).toBe(true);
    expect(dearSecond.allowed).toBe(false);
    expect(ilePowWorkStartCost(5)).toBeGreaterThan(samePool);

    expect(clampIlePowExpense(0)).toBe(1);
    expect(clampIlePowExpense(9)).toBe(5);
    expect(ilePowGatherMinTotal(3)).toBe(3);
    expect(ilePowGatherMinTotal(1)).toBeLessThan(ilePowGatherMinTotal(5));

    const gatherCheap = decideIleGatherResources({
      artifacts: [{ type: "tool" }, { type: "tool" }, { type: "screen" }],
      expense: 1,
    });
    const gatherDear = decideIleGatherResources({
      artifacts: [{ type: "tool" }, { type: "tool" }, { type: "screen" }],
      expense: 5,
    });
    expect(gatherCheap.allowed).toBe(true);
    expect(gatherDear.allowed).toBe(false);

    expect(consumeIlePowUnits(poolSix, 3).tool).toBe(3);

    const leftoverAfterOnePaid = availableIlePowCounts(poolSix, spent);
    expect(ilePowUnifiedPool({ available: leftoverAfterOnePaid })).toBe(3);
    const brokenLeft =
      ilePowParallelWorkCapacity({
        pool: ilePowUnifiedPool({ available: leftoverAfterOnePaid }),
        expense: ILE_POW_EXPENSE_DEFAULT,
      }) - 2;
    const leftAfterOnePaid = ilePowAdditionalWorkRemaining({
      pool: ilePowUnifiedPool({ available: leftoverAfterOnePaid }),
      expense: ILE_POW_EXPENSE_DEFAULT,
      openWorkCount: 2,
    });
    expect(brokenLeft).toBe(0);
    expect(leftAfterOnePaid).toBe(1);
    expect(
      decideIleWorkStart({
        chapterId: "ch-c",
        openWorkIds: ["ch-a", "ch-b"],
        available: leftoverAfterOnePaid,
        expense: ILE_POW_EXPENSE_DEFAULT,
      }).allowed,
    ).toBe(true);

    const thoughtPool = ilePowUnifiedPool({
      available: emptyIlePowTypeCounts(),
      thoughts: 6,
      spentUnits: 3,
      spentTyped: emptyIlePowTypeCounts(),
    });
    expect(thoughtPool).toBe(3);
    const thoughtLeft = ilePowAdditionalWorkRemaining({
      pool: thoughtPool,
      expense: ILE_POW_EXPENSE_DEFAULT,
      openWorkCount: 2,
    });
    expect(thoughtLeft).toBe(1);
    const thoughtIgnored = ilePowUnifiedPool({
      available: emptyIlePowTypeCounts(),
      thoughts: 6,
    });
    expect(thoughtIgnored).toBe(6);
    expect(thoughtIgnored).toBeGreaterThan(thoughtPool);

    writeScratch(
      "ile-parallel-work-spend.txt",
      [
        `firstAllowed=${first.allowed} consume=${first.consumeUnits} open=${first.openWorkIds.join(",")}`,
        `secondDefault=${secondOk.allowed} cost=${secondOk.consumeUnits} open=${secondOk.openWorkIds.join(",")}`,
        `secondTinyRefused=${secondRefused.allowed} reason=${secondRefused.reason}`,
        `cheapCap=${cheapCap} dearCap=${dearCap} pool=${samePool}`,
        `cheapSecond=${cheapSecond.allowed} dearSecond=${dearSecond.allowed} dearCost=${ilePowWorkStartCost(5)}`,
        `gatherCheap=${gatherCheap.allowed} gatherDear=${gatherDear.allowed}`,
        `leftAfterOnePaid=${leftAfterOnePaid} brokenLeft=${brokenLeft}`,
        `thoughtPool=${thoughtPool} thoughtLeft=${thoughtLeft} thoughtIgnored=${thoughtIgnored}`,
      ].join("\n"),
    );
  });

  it("persists open Work ids in session metadata and drops closed chapters on restore", () => {
    const saved = applyIleOpenWorkIdsToMetadata(
      { session_name: "Mars" } as Record<string, unknown>,
      ["ch-a", " ch-b ", "ch-a", ""],
    );
    expect(saved[ILE_OPEN_WORK_IDS_META_KEY]).toEqual(["ch-a", "ch-b"]);
    expect(parseIleOpenWorkIdsFromMetadata(saved)).toEqual(["ch-a", "ch-b"]);

    const cleared = applyIleOpenWorkIdsToMetadata(saved, []);
    expect(cleared[ILE_OPEN_WORK_IDS_META_KEY]).toBeUndefined();
    expect(parseIleOpenWorkIdsFromMetadata(cleared)).toEqual([]);

    expect(
      restoreIleOpenWorkIds({
        stored: ["ch-a", "ch-b", "ch-gone", "ch-done"],
        steps: [
          { id: "ch-a", status: "in_progress" },
          { id: "ch-b", status: "pending" },
          { id: "ch-done", status: "completed" },
        ],
      }),
    ).toEqual(["ch-a", "ch-b"]);
    expect(
      restoreIleOpenWorkIds({
        stored: ["ch-a"],
        steps: [
          { id: "ch-a", status: "pending" },
          { id: "ch-progress", status: "in_progress" },
          { id: "ch-done", status: "completed" },
        ],
      }),
    ).toEqual(["ch-a", "ch-progress"]);
    expect(
      restoreIleOpenWorkIds({
        stored: [],
        steps: [{ id: "ch-p", status: "in_progress" }],
      }),
    ).toEqual(["ch-p"]);
  });
});
