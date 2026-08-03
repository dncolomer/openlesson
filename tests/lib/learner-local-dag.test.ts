import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
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

const SCRATCH =
  process.env.GROK_SCRATCH ||
  "/var/folders/kd/98qlvkyd4mb3_9t32p9bmt_r0000gn/T/grok-goal-0f749429c9fc/implementer";

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

describe("learner Locked + DAG drawer structural", () => {
  it("map chrome + learner drawer mini canvas; creator does not mount learner pane", () => {
    const grid = read("components/BlockSkillGrid.tsx");
    const chrome = read("lib/workspace-learner-chrome.ts");
    const learner = read("components/WorkspaceLearnerBlockPane.tsx");
    const view = read("components/WorkspaceView.tsx");
    const canvas = read("components/MultiBlockDagCanvas.tsx");
    const mod = read("lib/learner-local-dag.ts");

    expect(mod).toContain("export function isLearnerMapBlockLocked");
    expect(mod).toContain("export function learnerMapDependencyHighlightIds");
    expect(mod).toContain("export function seedLearnerLocalDagDraft");

    expect(chrome).toContain("LEARNER_MAP_CELL_LOCKED_CLASS");
    expect(chrome).toMatch(/rose|rose-500/);
    expect(chrome).toContain("LEARNER_MAP_CELL_DEP_HIGHLIGHT_CLASS");
    expect(chrome).toContain("depHighlight");

    expect(grid).toContain("data-learner-locked-label");
    expect(grid).toContain("data-learner-locked-icon");
    expect(grid).toContain("learnerDepHighlightIds");
    expect(grid).toContain("data-learner-dep-highlight");
    expect(grid).toContain("learnerSpottable");
    expect(grid).toContain("learnerMapDependencyHighlightIds");

    expect(learner).toContain('drawerId="dependencies"');
    expect(learner).toContain("data-learner-dag-drawer");
    expect(learner).toContain("data-learner-local-dag");
    expect(learner).toContain("MultiBlockDagCanvas");
    expect(learner).toContain("readOnly");
    expect(learner).toContain("seedLearnerLocalDagDraft");
    // No create/edit apply on learner path
    expect(learner).not.toContain("onToggleEdge");
    expect(learner).not.toContain("apply_dag");

    expect(canvas).toContain("readOnly");
    expect(canvas).toContain("data-dag-read-only");

    expect(view).toContain("showLearnerDrawer");
    expect(view).toMatch(
      /showLearnerDrawer[\s\S]*WorkspaceLearnerBlockPane/,
    );
    expect(view).toMatch(
      /showCreatorDrawers[\s\S]*WorkspaceBlockDetailPane/,
    );
    expect(view).not.toMatch(
      /showCreatorDrawers[\s\S]{0,200}WorkspaceLearnerBlockPane/,
    );

    mkdirSync(SCRATCH, { recursive: true });
    writeFileSync(
      join(SCRATCH, "learner-dag-spot.log"),
      [
        "learner-dag-spot",
        "locked_label=" + grid.includes("data-learner-locked-label"),
        "red_lock_icon=" + grid.includes("data-learner-locked-icon"),
        "dep_highlight=" + grid.includes("data-learner-dep-highlight"),
        "drawer=" + learner.includes("data-learner-dag-drawer"),
        "mini_canvas=" + learner.includes("MultiBlockDagCanvas"),
        "read_only=" + learner.includes("readOnly"),
        "learner_only_pane=" + view.includes("showLearnerDrawer"),
        "locked_helper=" + mod.includes("isLearnerMapBlockLocked"),
      ].join("\n") + "\n",
    );

    const before = learnerPrereqCompletionSnapshot("b", blocks);
    const afterBlocks = blocks.map((b) =>
      b.id === "a" ? { ...b, status: "completed" } : b,
    );
    const after = learnerPrereqCompletionSnapshot("b", afterBlocks);
    writeFileSync(
      join(SCRATCH, "learner-dag-ops.log"),
      [
        "learner-dag-ops",
        "before_locked=" + before.locked,
        "before_incomplete=" + before.incompleteIds.join(","),
        "after_locked=" + after.locked,
        "after_complete=" + after.completeIds.join(","),
        "draft_edges_b=" +
          seedLearnerLocalDagDraft("b", blocks).edges.length,
        "highlight_b=" +
          learnerMapDependencyHighlightIds("b", blocks).join(","),
      ].join("\n") + "\n",
    );
  });
});
