import { readGridOpsSurface, readWorkspaceViewSurface } from "@/tests/helpers/surface-source";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildMultiBlockDagApplyUpdates,
  draftMultiBlockDag,
  hasMultiBlockDagEdge,
  setMultiBlockDagEdge,
  type DagBlockRef,
} from "@/lib/multi-block-dag";
import {
  buildWorkspaceDagDeleteUpdates,
  buildWorkspaceDagEditUpdates,
  discoverWorkspaceDagsFromBlocks,
  listWorkspaceDagsForTab,
  normalizeWorkspaceDags,
  registerWorkspaceDagOnApply,
  removeWorkspaceDag,
  resolveWorkspaceDagForMutation,
  seedWorkspaceDagEditDraft,
  workspaceDagDisplayTitle,
} from "@/lib/workspace-dags";
import {
  availableWorkspaceSections,
  resolveWorkspaceSectionLayout,
} from "@/lib/workspace-sections";
import { availableSectionsForMode } from "@/lib/workspace-mode";

const SCRATCH =
  process.env.GROK_SCRATCH ||
  "/var/folders/kd/98qlvkyd4mb3_9t32p9bmt_r0000gn/T/grok-goal-93aed6281775/implementer";

function read(rel: string) {
  return readFileSync(join(process.cwd(), rel), "utf8");
}

const blocks: DagBlockRef[] = [
  {
    id: "a",
    title: "Intro",
    next_block_ids: ["b", "outside"],
    lock_until_block_ids: [],
  },
  {
    id: "b",
    title: "Core",
    next_block_ids: [],
    lock_until_block_ids: ["a"],
  },
  {
    id: "c",
    title: "Outro",
    next_block_ids: [],
    lock_until_block_ids: [],
  },
];

describe("workspace-dags pure helpers", () => {
  it("register on apply creates listable DAG; edit updates; delete clears within next", () => {
    // Create (map multi-select Apply path)
    const created = registerWorkspaceDagOnApply([], {
      blockIds: ["a", "b", "c"],
      now: "2026-08-03T00:00:00.000Z",
    });
    expect(created.created).toBe(true);
    expect(created.record.blockIds).toEqual(["a", "b", "c"]);
    expect(created.dags).toHaveLength(1);

    const listed = listWorkspaceDagsForTab(created.dags, blocks);
    expect(listed).toHaveLength(1);
    expect(listed[0]!.displayTitle).toMatch(/Intro|Core|Outro/);

    // Edit: change edges via same apply updates + re-register with dagId
    let draft = seedWorkspaceDagEditDraft(created.record, blocks);
    expect(hasMultiBlockDagEdge(draft, "a", "b", "next")).toBe(true);
    draft = setMultiBlockDagEdge(draft, { from: "a", to: "b", kind: "next" }, false);
    draft = setMultiBlockDagEdge(draft, { from: "b", to: "c", kind: "next" }, true);

    const editUpdates = buildWorkspaceDagEditUpdates(draft, blocks);
    const aUp = editUpdates.find((u) => u.blockId === "a")!;
    expect(aUp.next_block_ids).toContain("outside");
    expect(aUp.next_block_ids).not.toContain("b");
    const bUp = editUpdates.find((u) => u.blockId === "b")!;
    expect(bUp.next_block_ids).toContain("c");
    // next b→c mirrors to lock on c; b no longer locked by a via within-selection next
    const cUp = editUpdates.find((u) => u.blockId === "c")!;
    expect(cUp.lock_until_block_ids).toContain("b");
    expect(bUp.lock_until_block_ids).not.toContain("a");

    const afterEdit = registerWorkspaceDagOnApply(created.dags, {
      dagId: created.record.id,
      blockIds: ["a", "b", "c"],
      now: "2026-08-03T01:00:00.000Z",
    });
    expect(afterEdit.created).toBe(false);
    expect(afterEdit.dags).toHaveLength(1);
    expect(afterEdit.record.updatedAt).toBe("2026-08-03T01:00:00.000Z");

    // Delete: clear within-DAG next, remove record
    const delUpdates = buildWorkspaceDagDeleteUpdates(
      created.record.blockIds,
      // Simulate post-edit block state for membership checks
      blocks.map((b) => {
        if (b.id === "a") {
          return { ...b, next_block_ids: ["outside"] };
        }
        if (b.id === "b") {
          return { ...b, next_block_ids: ["c"] };
        }
        return b;
      }),
    );
    const aDel = delUpdates.find((u) => u.blockId === "a")!;
    expect(aDel.next_block_ids).toContain("outside");
    expect(aDel.next_block_ids).not.toContain("b");
    const bDel = delUpdates.find((u) => u.blockId === "b")!;
    expect(bDel.next_block_ids).not.toContain("c");
    // within-selection locks cleared when next graph deleted (external only kept)
    expect(bDel.lock_until_block_ids).not.toContain("a");

    const afterDelete = removeWorkspaceDag(afterEdit.dags, created.record.id);
    expect(afterDelete).toHaveLength(0);
    expect(normalizeWorkspaceDags(afterDelete)).toEqual([]);
  });

  it("lists DAGs discovered from next_block_ids when registry is empty", () => {
    // No first-class records — only live next edges on blocks
    const listed = listWorkspaceDagsForTab([], blocks);
    expect(listed.length).toBeGreaterThanOrEqual(1);
    const allIds = new Set(listed.flatMap((d) => d.blockIds));
    expect(allIds.has("a")).toBe(true);
    expect(allIds.has("b")).toBe(true);
    // a→b next forms a component; c alone has no next edge out/in within draft seed
    const discovered = discoverWorkspaceDagsFromBlocks(blocks);
    expect(discovered.some((d) => d.blockIds.includes("a") && d.blockIds.includes("b"))).toBe(
      true,
    );
    // Mutation resolve finds discovered id
    const row = listed[0]!;
    const resolved = resolveWorkspaceDagForMutation([], row.id, blocks);
    expect(resolved?.blockIds.length).toBeGreaterThanOrEqual(2);
  });

  it("display title falls back to block titles", () => {
    expect(
      workspaceDagDisplayTitle(
        { title: "", blockIds: ["a", "b"] },
        blocks,
      ),
    ).toBe("Intro → Core");
    expect(
      workspaceDagDisplayTitle(
        { title: "My path", blockIds: ["a", "b"] },
        blocks,
      ),
    ).toBe("My path");
  });

  it("buildWorkspaceDagEditUpdates matches multi-block apply helper", () => {
    const draft = draftMultiBlockDag(["a", "b"], blocks);
    const viaEdit = buildWorkspaceDagEditUpdates(draft, blocks);
    const viaApply = buildMultiBlockDagApplyUpdates(draft, blocks);
    expect(viaEdit).toEqual(viaApply);
  });
});

describe("Creator-only DAGs section visibility", () => {
  it("owners get dags in Creator lists; Learner/org-admin-only never; layout mounts panel", () => {
    const owner = availableWorkspaceSections({ isOwner: true });
    expect(owner).toContain("dags");
    // Second tab after Workspace
    expect(owner.indexOf("dags")).toBe(owner.indexOf("workspace") + 1);

    expect(availableWorkspaceSections({ isOwner: false })).not.toContain("dags");
    expect(availableWorkspaceSections({ isOrgAdmin: true })).not.toContain("dags");

    expect(
      availableSectionsForMode({
        mode: "learner",
        isOwner: true,
        isLoggedIn: true,
      }),
    ).toContain("dags");

    expect(
      availableSectionsForMode({
        mode: "creator",
        isOwner: true,
      }),
    ).toContain("dags");

    expect(
      availableSectionsForMode({
        mode: "creator",
        isOrgAdmin: true,
        isOwner: false,
      }),
    ).not.toContain("dags");

    const layout = resolveWorkspaceSectionLayout("dags");
    expect(layout.mountsDagsPanel).toBe(true);
    expect(layout.showBlockMapChrome).toBe(false);
    expect(layout.mainSurface).toBe("dags");
  });
});
