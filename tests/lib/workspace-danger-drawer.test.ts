/**
 * Workspace editor Danger zone is a peer drawer for 1-block and 2+-block selection.
 */
import { describe, expect, it } from "vitest";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { readCombineBlocksSurface } from "@/tests/helpers/surface-source";
import {
  WORKSPACE_EDITOR_DANGER_DRAWER_ID,
  WORKSPACE_EDITOR_DANGER_DRAWER_TITLE,
  isWorkspaceEditorDangerDrawer,
  workspaceBlockDetailDrawerIds,
  workspaceMultiSelectDrawerIds,
} from "@/lib/workspace-right-pane";

const ROOT = join(__dirname, "../..");
const SCRATCH =
  process.env.GROK_GOAL_SCRATCH ||
  "/var/folders/kd/98qlvkyd4mb3_9t32p9bmt_r0000gn/T/grok-goal-30f4e82c73ac/implementer";

function read(rel: string) {
  const path = join(ROOT, rel);
  expect(existsSync(path), `missing ${rel}`).toBe(true);
  return readFileSync(path, "utf8");
}

function writeScratch(name: string, body: string) {
  mkdirSync(SCRATCH, { recursive: true });
  writeFileSync(join(SCRATCH, name), body, "utf8");
}

describe("shipped editor drawer-id helpers", () => {
  it("1-block and 2+-block surfaces list a dedicated Danger zone drawer", () => {
    const single = workspaceBlockDetailDrawerIds({ canEdit: true });
    expect(single).not.toContain("goals");
    const multi = workspaceMultiSelectDrawerIds();

    expect(WORKSPACE_EDITOR_DANGER_DRAWER_ID).toBe("danger");
    expect(WORKSPACE_EDITOR_DANGER_DRAWER_TITLE).toBe("Danger zone");
    expect(isWorkspaceEditorDangerDrawer("danger")).toBe(true);
    expect(isWorkspaceEditorDangerDrawer("edit")).toBe(false);
    expect(isWorkspaceEditorDangerDrawer("delete")).toBe(false);
    expect(isWorkspaceEditorDangerDrawer("combine")).toBe(false);

    expect(single).toContain("edit");
    expect(single).toContain(WORKSPACE_EDITOR_DANGER_DRAWER_ID);
    expect(single).not.toContain("combine");
    expect(single.indexOf("edit")).toBeLessThan(
      single.indexOf(WORKSPACE_EDITOR_DANGER_DRAWER_ID),
    );
    expect(single[single.length - 1]).toBe(WORKSPACE_EDITOR_DANGER_DRAWER_ID);
    expect(multi[multi.length - 1]).toBe(WORKSPACE_EDITOR_DANGER_DRAWER_ID);

    expect(multi).toContain("combine");
    expect(multi).toContain("bridge");
    expect(multi).toContain(WORKSPACE_EDITOR_DANGER_DRAWER_ID);
    expect(multi).not.toContain("edit");
    expect(multi).not.toContain("delete");

    const noEdit = workspaceBlockDetailDrawerIds({ canEdit: false });
    expect(noEdit).not.toContain(WORKSPACE_EDITOR_DANGER_DRAWER_ID);
    expect(noEdit).not.toContain("edit");

    writeScratch(
      "workspace-danger-drawer.txt",
      [
        `dangerId=${WORKSPACE_EDITOR_DANGER_DRAWER_ID}`,
        `dangerTitle=${WORKSPACE_EDITOR_DANGER_DRAWER_TITLE}`,
        `single=${single.join(",")}`,
        `multi=${multi.join(",")}`,
        `singleHasDanger=${single.includes(WORKSPACE_EDITOR_DANGER_DRAWER_ID)}`,
        `multiHasDanger=${multi.includes(WORKSPACE_EDITOR_DANGER_DRAWER_ID)}`,
        `singleHasEdit=${single.includes("edit")}`,
        `multiHasCombine=${multi.includes("combine")}`,
        `dangerDistinctFromEdit=${String(WORKSPACE_EDITOR_DANGER_DRAWER_ID) !== "edit"}`,
        `dangerDistinctFromCombine=${String(WORKSPACE_EDITOR_DANGER_DRAWER_ID) !== "combine"}`,
      ].join("\n"),
    );
  });
});

describe("single and multi editor panes", () => {
  it("Edit no longer hosts Danger zone; both panes mount a peer Danger zone drawer with delete", () => {
    const detail = read("components/WorkspaceBlockDetailPane.tsx");
    const host = read("components/workspace-view/workspace-right-drawers.tsx");
    const edit = read("components/WorkspaceBlockEditPanel.tsx");
    const danger = read("components/WorkspaceBlockDangerPanel.tsx");
    const combine = readCombineBlocksSurface();

    expect(detail).not.toContain("WORKSPACE_EDITOR_DANGER_DRAWER_ID");
    expect(detail).not.toContain("WorkspaceBlockDangerPanel");
    expect(detail).not.toContain("WorkspaceBlockDangerDrawer");
    expect(detail).toContain('drawerId="edit"');
    expect(detail).toContain("WorkspaceBlockEditPanel");
    expect(host).toContain("WorkspaceBlockDangerDrawer");
    expect(host).toContain("data-workspace-block-danger-host");
    expect(host).toContain("onDelete={onDeleteBlock}");
    expect(host).not.toContain("WorkspaceLearnerBlockPane");
    expect(host.lastIndexOf("WorkspaceBlockDetailPane")).toBeLessThan(
      host.lastIndexOf("WorkspaceBlockDangerDrawer"),
    );
    expect(danger).toContain("WORKSPACE_EDITOR_DANGER_DRAWER_ID");
    expect(danger).toContain("WORKSPACE_EDITOR_DANGER_DRAWER_TITLE");
    expect(danger).toContain("data-block-danger-drawer");
    expect(danger).toContain('tone="danger"');
    const drawer = read("components/WorkspaceRightPaneDrawer.tsx");
    expect(drawer).toContain("text-red-300");
    expect(drawer).toContain("border-red-800/70");

    expect(edit).not.toContain("Danger zone");
    expect(edit).not.toContain("data-block-edit-delete");
    expect(edit).not.toContain("onDelete");
    expect(edit).toContain("data-block-edit-save");

    expect(danger).toContain("data-block-danger-pane");
    expect(danger).toContain("data-block-edit-delete");
    expect(danger).toContain("Delete block");

    expect(combine).toContain("WORKSPACE_EDITOR_DANGER_DRAWER_ID");
    expect(combine).toContain("WORKSPACE_EDITOR_DANGER_DRAWER_TITLE");
    expect(combine).toContain("data-multi-block-delete");
    expect(combine).toContain("data-block-danger-drawer");
    expect(combine).toContain('tone="danger"');
    expect(combine).not.toContain('drawerId="simulation"');
    expect(combine.lastIndexOf("WORKSPACE_EDITOR_DANGER_DRAWER_ID")).toBeGreaterThan(
      combine.lastIndexOf('drawerId="dag"'),
    );
    expect(combine).not.toContain('drawerId="delete"');
    expect(combine).not.toContain('title="Delete"');

    writeScratch(
      "workspace-danger-drawer-excerpts.txt",
      [
        "WorkspaceBlockDetailPane: no Danger zone (hosted last in right drawers)",
        "WorkspaceBlockDangerDrawer: last after authoring drawers",
        "WorkspaceBlockEditPanel: no Danger zone / no delete",
        "WorkspaceBlockDangerPanel: delete for one block",
        "WorkspaceCombineBlocksPane: Danger zone drawer + batch delete",
      ].join("\n"),
    );
  });
});
