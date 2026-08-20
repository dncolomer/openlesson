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
    ).not.toContain("dags");

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

describe("DAGs tab UI / API structural", () => {
  it("nav + panel list/edit/delete; apply_dag registers; no create on tab", () => {
    const view = readWorkspaceViewSurface();
    const panel = read("components/WorkspaceDagsPanel.tsx");
    const gridOps = readGridOpsSurface();
    const sections = read("lib/workspace-sections.ts");
    const en = read("messages/en.json");
    const mod = read("lib/workspace-dags.ts");
    const migration = read(
      "supabase/migrations/20260803120000_workspace_dags.sql",
    );

    expect(sections).toContain('"dags"');
    expect(sections).toContain("mountsDagsPanel");
    expect(en).toContain("sectionDags");
    expect(en).toContain('"DAGs"');

    expect(view).toContain('key: "dags"');
    expect(view).toContain("sectionDags");
    // DAGs tab immediately after Workspace in sectionConfig
    expect(view).toMatch(
      /key: "workspace"[\s\S]*?key: "dags"[\s\S]*?key: "context"/,
    );
    expect(view).toContain("WorkspaceDagsPanel");
    expect(view).toContain("data-workspace-dags-host");
    expect(view).toContain("handleDeleteDag");
    expect(view).toContain('op: "delete_dag"');
    // Owner-gated (not silent success for org-admin-only)
    expect(view).toMatch(/isOwner && visibleSections\.includes\("dags"\)/);
    expect(view).toContain("Only the workspace owner can apply or edit DAGs");
    expect(view).toContain("Only the workspace owner can delete DAGs");

    expect(panel).toContain("data-workspace-dags-panel");
    expect(panel).toContain("data-workspace-dag-list");
    expect(panel).toContain("data-workspace-dag-grid");
    expect(panel).toContain("data-workspace-dag-card");
    expect(panel).toContain("MultiBlockDagPreview");
    expect(panel).toContain("data-workspace-dag-edit");
    expect(panel).toContain("data-workspace-dag-edit-save");
    expect(panel).toContain("data-workspace-dag-delete");
    expect(panel).toContain("MultiBlockDagCanvas");
    const preview = read("components/MultiBlockDagPreview.tsx");
    expect(preview).toContain("data-multi-block-dag-preview");
    expect(preview).toContain("data-dag-preview-svg");
    expect(preview).toContain("layoutMultiBlockDagNodes");
    // Must not offer invent-from-scratch create
    expect(panel).not.toMatch(/Create new DAG|New DAG|data-workspace-dag-create/i);

    expect(mod).toContain("export function registerWorkspaceDagOnApply");
    expect(mod).toContain("export function buildWorkspaceDagDeleteUpdates");
    expect(mod).toContain("export function listWorkspaceDagsForTab");
    expect(mod).toContain("export function discoverWorkspaceDagsFromBlocks");
    expect(mod).toContain("export function resolveWorkspaceDagForMutation");
    expect(gridOps).toContain("resolveWorkspaceDagForMutation");

    expect(gridOps).toContain('op === "apply_dag"');
    expect(gridOps).toContain("registerWorkspaceDagOnApply");
    expect(gridOps).toContain('op === "delete_dag"');
    expect(gridOps).toContain("buildWorkspaceDagDeleteUpdates");
    expect(gridOps).toContain("workspace_dags");

    expect(migration).toContain("workspace_dags");

    mkdirSync(SCRATCH, { recursive: true });
    writeFileSync(
      join(SCRATCH, "dags-tab.log"),
      [
        "dags-tab",
        "section_key=dags",
        "label=DAGs",
        "learner_excludes=" +
          String(
            !availableSectionsForMode({
              mode: "learner",
              isOwner: true,
              isLoggedIn: true,
            }).includes("dags"),
          ),
        "creator_owner_has=" +
          String(
            availableSectionsForMode({
              mode: "creator",
              isOwner: true,
            }).includes("dags"),
          ),
        "list=" + panel.includes("data-workspace-dag-list"),
        "edit=" + panel.includes("data-workspace-dag-edit-save"),
        "delete=" + panel.includes("data-workspace-dag-delete"),
        "create_absent=" +
          String(!/data-workspace-dag-create|Create new DAG/i.test(panel)),
        "register_on_apply=" + gridOps.includes("registerWorkspaceDagOnApply"),
        "delete_op=" + gridOps.includes('op === "delete_dag"'),
      ].join("\n") + "\n",
    );

    // Ops evidence: register + edit + delete on representative 3-block set
    const created = registerWorkspaceDagOnApply([], {
      blockIds: ["a", "b", "c"],
      now: "2026-08-03T12:00:00.000Z",
    });
    let draft = seedWorkspaceDagEditDraft(created.record, blocks);
    draft = setMultiBlockDagEdge(
      draft,
      { from: "a", to: "c", kind: "next" },
      true,
    );
    const edited = buildWorkspaceDagEditUpdates(draft, blocks);
    const deleted = buildWorkspaceDagDeleteUpdates(["a", "b", "c"], blocks);
    writeFileSync(
      join(SCRATCH, "dags-tab-ops.log"),
      [
        "dags-tab-ops",
        "created_id=" + created.record.id,
        "created_blocks=" + created.record.blockIds.join(","),
        "edit_a_next=" +
          (edited.find((u) => u.blockId === "a")?.next_block_ids || []).join(","),
        "edit_b_lock=" +
          (edited.find((u) => u.blockId === "b")?.lock_until_block_ids || []).join(
            ",",
          ),
        "delete_a_next=" +
          (deleted.find((u) => u.blockId === "a")?.next_block_ids || []).join(
            ",",
          ),
        "delete_clears_ab=" +
          String(
            !(deleted.find((u) => u.blockId === "a")?.next_block_ids || []).includes(
              "b",
            ),
          ),
        "list_after_create=" +
          listWorkspaceDagsForTab(created.dags, blocks).length,
        "list_after_remove=" +
          listWorkspaceDagsForTab(
            removeWorkspaceDag(created.dags, created.record.id),
            blocks,
          ).length,
      ].join("\n") + "\n",
    );
  });
});
