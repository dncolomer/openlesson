import {
  readCombineBlocksSurface,
  readGridOpsSurface,
  readWorkspaceViewSurface,
} from "@/tests/helpers/surface-source";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildMultiBlockDagApplyUpdates,
  draftMultiBlockDag,
  hasMultiBlockDagEdge,
  layoutMultiBlockDagNodes,
  MULTI_BLOCK_DAG_MAX_BLOCKS,
  multiBlockDagEdgeEndpoints,
  multiBlockDagHasCycle,
  multiBlockDagSelectionTooLarge,
  resolveMultiBlockDagConnect,
  setMultiBlockDagEdge,
  type DagBlockRef,
} from "@/lib/multi-block-dag";
import { tmpdir } from "node:os";

const SCRATCH =
  process.env.GROK_SCRATCH ||
  join(tmpdir(), "openlesson-scratch", "grok-goal-d5c6027932ea/implementer");

function read(rel: string) {
  return readFileSync(join(process.cwd(), rel), "utf8");
}

const blocks: DagBlockRef[] = [
  {
    id: "a",
    title: "A",
    next_block_ids: ["b", "outside"],
    lock_until_block_ids: [],
  },
  {
    id: "b",
    title: "B",
    next_block_ids: [],
    lock_until_block_ids: ["a"],
  },
  {
    id: "c",
    title: "C",
    next_block_ids: [],
    lock_until_block_ids: [],
  },
];

describe("multi-block DAG pure helpers", () => {
  it("drafts leads-to; mirrors next as lock_until; preserves external next/lock", () => {
    const draft = draftMultiBlockDag(["a", "b", "c"], blocks);
    expect(draft.blockIds).toEqual(["a", "b", "c"]);
    expect(hasMultiBlockDagEdge(draft, "a", "b", "next")).toBe(true);
    // lock edges are not drafted (leads-to only)
    expect(hasMultiBlockDagEdge(draft, "b", "a", "lock")).toBe(false);
    expect(draft.edges.every((e) => e.kind === "next")).toBe(true);
    // outside not in draft
    expect(draft.edges.some((e) => e.to === "outside")).toBe(false);

    // Add c leads to b
    let next = setMultiBlockDagEdge(
      draft,
      { from: "c", to: "b", kind: "next" },
      true,
    );
    expect(hasMultiBlockDagEdge(next, "c", "b", "next")).toBe(true);
    // Remove a→b next
    next = setMultiBlockDagEdge(next, { from: "a", to: "b", kind: "next" }, false);
    expect(hasMultiBlockDagEdge(next, "a", "b", "next")).toBe(false);

    const updates = buildMultiBlockDagApplyUpdates(next, blocks);
    const a = updates.find((u) => u.blockId === "a")!;
    // external next preserved
    expect(a.next_block_ids).toContain("outside");
    expect(a.next_block_ids).not.toContain("b");
    const b = updates.find((u) => u.blockId === "b")!;
    // c→b next mirrors to lock_until on b (learner Locked)
    expect(b.lock_until_block_ids).toContain("c");
    // a→b removed — a no longer a within-selection lock of b
    expect(b.lock_until_block_ids).not.toContain("a");
    const c = updates.find((u) => u.blockId === "c")!;
    expect(c.next_block_ids).toContain("b");
  });

  it("detects cycles in draft", () => {
    let draft = draftMultiBlockDag(["a", "b"], blocks);
    draft = setMultiBlockDagEdge(draft, { from: "a", to: "b", kind: "next" }, true);
    draft = setMultiBlockDagEdge(draft, { from: "b", to: "a", kind: "next" }, true);
    expect(multiBlockDagHasCycle(draft, "next")).toBe(true);
  });

  it("rejects self-loops and edges outside selection", () => {
    const draft = draftMultiBlockDag(["a", "b"], blocks);
    const same = setMultiBlockDagEdge(
      draft,
      { from: "a", to: "a", kind: "next" },
      true,
    );
    expect(same.edges).toEqual(draft.edges);
    const out = setMultiBlockDagEdge(
      draft,
      { from: "a", to: "zzz", kind: "next" },
      true,
    );
    expect(out.edges).toEqual(draft.edges);
  });

  it("layoutMultiBlockDagNodes uses map positions when present", () => {
    const laid = layoutMultiBlockDagNodes(
      [
        { id: "a", title: "A", position_x: 0, position_y: 0 },
        { id: "b", title: "B", position_x: 4, position_y: 0 },
        { id: "c", title: "C", position_x: 0, position_y: 3 },
      ],
      { width: 300, height: 200, padding: 40 },
    );
    expect(laid).toHaveLength(3);
    const a = laid.find((n) => n.id === "a")!;
    const b = laid.find((n) => n.id === "b")!;
    // B is to the right of A
    expect(b.x).toBeGreaterThan(a.x);
    // endpoints shortens line away from centers
    const pts = multiBlockDagEdgeEndpoints(a, b, 20);
    expect(pts.x1).toBeGreaterThan(a.x);
    expect(pts.x2).toBeLessThan(b.x);
  });

  it("caps visual DAG at MULTI_BLOCK_DAG_MAX_BLOCKS (9)", () => {
    expect(MULTI_BLOCK_DAG_MAX_BLOCKS).toBe(9);
    expect(multiBlockDagSelectionTooLarge(9)).toBe(false);
    expect(multiBlockDagSelectionTooLarge(10)).toBe(true);
  });

  it("resolveMultiBlockDagConnect toggles leads-to edge on/off", () => {
    let draft = draftMultiBlockDag(["a", "b"], blocks);
    draft = setMultiBlockDagEdge(draft, { from: "a", to: "b", kind: "next" }, false);
    const on = resolveMultiBlockDagConnect(draft, "a", "b");
    expect(on.action).toBe("toggle");
    if (on.action !== "toggle") throw new Error("expected toggle");
    expect(on.enabled).toBe(true);
    expect(on.edge).toEqual({ from: "a", to: "b", kind: "next" });
    draft = setMultiBlockDagEdge(draft, on.edge, true);
    const off = resolveMultiBlockDagConnect(draft, "a", "b");
    expect(off.action).toBe("toggle");
    if (off.action === "toggle") expect(off.enabled).toBe(false);
    expect(resolveMultiBlockDagConnect(draft, "a", "a").action).toBe("none");
  });
});
