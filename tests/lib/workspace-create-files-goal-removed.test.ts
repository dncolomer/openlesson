/**
 * /workspace/new auto-creates a blank map.
 * Template / Files + Goal remain API generate paths, not create-page cards.
 */
import { describe, expect, it } from "vitest";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  UI_WORKSPACE_CREATE_MODES,
  isUiWorkspaceCreateMode,
} from "@/lib/workspace-create-modes";

const ROOT = join(__dirname, "../..");
const SCRATCH =
  process.env.GROK_GOAL_SCRATCH ||
  "/var/folders/kd/98qlvkyd4mb3_9t32p9bmt_r0000gn/T/grok-goal-d119735b7f51/implementer";

function read(rel: string) {
  const path = join(ROOT, rel);
  expect(existsSync(path), `missing ${rel}`).toBe(true);
  return readFileSync(path, "utf8");
}

function writeScratch(name: string, body: string) {
  mkdirSync(SCRATCH, { recursive: true });
  writeFileSync(join(SCRATCH, name), body, "utf8");
}

describe("workspace create UI modes", () => {
  it("shipped list is blank-only; template and files_goal are not selectable", () => {
    expect(UI_WORKSPACE_CREATE_MODES).toEqual(["blank"]);
    expect(UI_WORKSPACE_CREATE_MODES).not.toContain("template");
    expect(UI_WORKSPACE_CREATE_MODES).not.toContain("files_goal");
    expect(isUiWorkspaceCreateMode("blank")).toBe(true);
    expect(isUiWorkspaceCreateMode("template")).toBe(false);
    expect(isUiWorkspaceCreateMode("knowledge_region")).toBe(false);
    expect(isUiWorkspaceCreateMode("calibration")).toBe(false);
    expect(isUiWorkspaceCreateMode("files_goal")).toBe(false);
    expect(isUiWorkspaceCreateMode("files+goal")).toBe(false);

    writeScratch(
      "workspace-create-modes.txt",
      [
        `UI_WORKSPACE_CREATE_MODES=${JSON.stringify(UI_WORKSPACE_CREATE_MODES)}`,
        `includes_files_goal=${UI_WORKSPACE_CREATE_MODES.includes("files_goal")}`,
        `isUi_blank=${isUiWorkspaceCreateMode("blank")}`,
        `isUi_template=${isUiWorkspaceCreateMode("template")}`,
        `isUi_files_goal=${isUiWorkspaceCreateMode("files_goal")}`,
      ].join("\n"),
    );
  });

  it("create page auto-creates blank and has no template / files_goal step", () => {
    const page = read("app/workspace/new/page.tsx");
    expect(page).toContain("data-create-blank-map");
    expect(page).toContain("createBlankMap");
    expect(page).toContain('createMode: "blank"');
    expect(page).not.toContain("UI_WORKSPACE_CREATE_MODES");
    expect(page).not.toContain("MODE_CARDS");
    expect(page).not.toContain("data-create-mode-cards");
    expect(page).not.toContain("From Template");
    expect(page).not.toContain('createMode: "template"');
    expect(page).not.toContain("createMode: \"knowledge_region\"");
    expect(page).not.toContain("handleCreateBlank");
    expect(page).not.toContain("handleCreateTemplate");
    expect(page).not.toContain("handleCreateKnowledgeRegion");
    expect(page).not.toContain("Verification workspace");
    expect(page).not.toMatch(/From Files \+ Goal/);
    expect(page).not.toContain("files_goal");
    expect(page).not.toContain("handleCreateFilesGoal");
    expect(page).not.toContain("data-template-file-upload");
    expect(page).not.toContain("isUiWorkspaceCreateMode");

    writeScratch(
      "workspace-create-excerpts.txt",
      [
        "page auto-creates blank map on /workspace/new",
        "no MODE_CARDS / From Template / AYCL chooser",
        "no From Files + Goal card",
        "no files_goal form/step",
        "no handleCreateFilesGoal",
        "createMode blank only on /workspace/new",
      ].join("\n"),
    );
  });
});
