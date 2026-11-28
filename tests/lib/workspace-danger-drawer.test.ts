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
import { tmpdir } from "node:os";

const ROOT = join(__dirname, "../..");
const SCRATCH =
  process.env.GROK_GOAL_SCRATCH ||
  join(tmpdir(), "openlesson-scratch", "grok-goal-30f4e82c73ac/implementer");

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

    const typed = workspaceBlockDetailDrawerIds({
      canEdit: true,
      blockKind: "calibration",
      showExpand: true,
      showSplit: true,
    });
    expect(typed).toContain("clone");
    expect(typed).toContain("edit");
    expect(typed).toContain("expand_block");
    expect(typed).toContain("split");
    expect(typed).toContain("effect_dynamic");
    expect(typed).toContain(WORKSPACE_EDITOR_DANGER_DRAWER_ID);
    expect(typed).not.toContain("unsys_model");
    expect(typed).not.toContain("open_flow");
    expect(
      workspaceBlockDetailDrawerIds({
        canEdit: true,
        blockKind: "solve",
      }),
    ).toContain("unsys_model");
    expect(
      workspaceBlockDetailDrawerIds({
        canEdit: true,
        blockKind: "verification",
      }),
    ).toContain("unsys_model");
    expect(
      workspaceBlockDetailDrawerIds({
        canEdit: false,
        blockKind: "verification",
      }),
    ).toEqual(["open_flow"]);
    expect(
      workspaceBlockDetailDrawerIds({ canEdit: true, blockKind: "content" }),
    ).not.toContain("content");

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
