import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { readMapGridSurface } from "../helpers/surface-source";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  isLearnerMapBlockLocked,
  learnerLocalDagBlockIds,
  learnerLocalDagDrawerRelevant,
  learnerMapDependencyHighlightIds,
  learnerMapShowsLockedChrome,
  learnerPrereqCompletionSnapshot,
  seedLearnerLocalDagDraft,
  type LearnerLocalDagBlock,
} from "@/lib/learner-local-dag";
import { layoutMultiBlockDagNodes } from "@/lib/multi-block-dag";
import { readWorkspaceViewSurface } from "@/tests/helpers/surface-source";
import { tmpdir } from "node:os";

const SCRATCH =
  process.env.GROK_SCRATCH ||
  join(tmpdir(), "openlesson-scratch", "grok-goal-0f749429c9fc/implementer");

function read(rel: string) {
  return readFileSync(join(process.cwd(), rel), "utf8");
}

const blocks: LearnerLocalDagBlock[] = [
  {
    id: "a",
    title: "Intro",
    status: "available",
    next_block_ids: ["b"],
    lock_until_block_ids: [],
    position_x: 0,
    position_y: 0,
  },
  {
    id: "b",
    title: "Core",
    status: "available",
    next_block_ids: ["c"],
    lock_until_block_ids: ["a"],
    position_x: 2,
    position_y: 0,
  },
  {
    id: "c",
    title: "Outro",
    status: "available",
    next_block_ids: [],
    lock_until_block_ids: ["b"],
    position_x: 4,
    position_y: 0,
  },
];

describe("learner local DAG pure helpers", () => {
  it("classifies Locked when lock_until OR incomplete inbound next", () => {
    expect(isLearnerMapBlockLocked(blocks[1]!, blocks)).toBe(true);
    expect(isLearnerMapBlockLocked(blocks[0]!, blocks)).toBe(false);
    expect(learnerMapShowsLockedChrome(true, blocks[1]!, blocks)).toBe(true);
    expect(learnerMapShowsLockedChrome(false, blocks[1]!, blocks)).toBe(false);

    // Next-only DAG (no lock_until): B still locked while A incomplete
    const nextOnly: LearnerLocalDagBlock[] = [
      {
        id: "x",
        title: "X",
        status: "available",
        next_block_ids: ["y"],
        lock_until_block_ids: [],
      },
      {
        id: "y",
        title: "Y",
        status: "available",
        next_block_ids: [],
        lock_until_block_ids: [],
      },
    ];
    expect(isLearnerMapBlockLocked(nextOnly[1]!, nextOnly)).toBe(true);
    expect(isLearnerMapBlockLocked(nextOnly[0]!, nextOnly)).toBe(false);
    const xDone = nextOnly.map((b) =>
      b.id === "x" ? { ...b, status: "completed" } : b,
    );
    expect(isLearnerMapBlockLocked(xDone[1]!, xDone)).toBe(false);

    const doneA = blocks.map((b) =>
      b.id === "a" ? { ...b, status: "completed" } : b,
    );
    // b still has next→c and lock on a done; if only a was lock and complete, b unlocks for lock_until
    // but c still incomplete inbound? b is unlocked when a done
    expect(isLearnerMapBlockLocked(doneA[1]!, doneA)).toBe(false);
    expect(learnerPrereqCompletionSnapshot("b", doneA).locked).toBe(false);
    expect(learnerPrereqCompletionSnapshot("b", blocks).incompleteIds).toEqual([
      "a",
    ]);
  });

  it("highlight set is local-DAG peers without focus; seed has edges into locked block", () => {
    const hi = learnerMapDependencyHighlightIds("b", blocks);
    expect(hi).toContain("a");
    expect(hi).toContain("c");
    expect(hi).not.toContain("b");

    const draft = seedLearnerLocalDagDraft("b", blocks);
    expect(draft.blockIds).toEqual(
      expect.arrayContaining(["a", "b", "c"]),
    );
    // lock a→b and next a→b / b→c
    expect(
      draft.edges.some((e) => e.from === "a" && e.to === "b" && e.kind === "next"),
    ).toBe(true);
    expect(
      draft.edges.some((e) => e.from === "b" && e.to === "c" && e.kind === "next"),
    ).toBe(true);

    const laid = layoutMultiBlockDagNodes(
      draft.blockIds.map((id) => {
        const b = blocks.find((x) => x.id === id)!;
        return {
          id,
          title: b.title,
          position_x: b.position_x,
          position_y: b.position_y,
        };
      }),
      { width: 420, height: 360, padding: 48 },
    );
    expect(laid.length).toBeGreaterThanOrEqual(2);
    expect(learnerLocalDagDrawerRelevant("b", blocks)).toBe(true);
    expect(learnerLocalDagBlockIds("a", blocks).length).toBeGreaterThanOrEqual(2);
  });

  it("after all prereqs Done, Locked false; highlight still works if participates", () => {
    const allDone = blocks.map((b) =>
      b.id === "a" || b.id === "b"
        ? { ...b, status: "completed" }
        : b,
    );
    // c still locked on b until b done — mark b completed
    expect(isLearnerMapBlockLocked(allDone[2]!, allDone)).toBe(false);
    const snap = learnerPrereqCompletionSnapshot("c", allDone);
    expect(snap.locked).toBe(false);
    expect(snap.completeIds).toContain("b");
  });
});
