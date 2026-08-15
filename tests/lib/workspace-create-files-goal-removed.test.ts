/**
 * /workspace/new no longer offers From Files + Goal.
 * Drives the shipped UI mode list and a static read of the create page.
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
  it("shipped list is blank + template; files_goal is not selectable", () => {
    expect(UI_WORKSPACE_CREATE_MODES).toEqual(["blank", "template"]);
    expect(UI_WORKSPACE_CREATE_MODES).not.toContain("files_goal");
    expect(isUiWorkspaceCreateMode("blank")).toBe(true);
    expect(isUiWorkspaceCreateMode("template")).toBe(true);
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

  it("create page has no From Files + Goal card or files_goal step", () => {
    const page = read("app/workspace/new/page.tsx");
    expect(page).toContain("UI_WORKSPACE_CREATE_MODES");
    expect(page).toContain("MODE_CARDS");
    expect(page).toContain("data-create-mode-cards");
    expect(page).toContain("Blank");
    expect(page).toContain("From Template");
    expect(page).toContain("createMode: \"blank\"");
    expect(page).toContain("createMode: \"template\"");
    expect(page).toContain("handleCreateBlank");
    expect(page).toContain("handleCreateTemplate");
    expect(page).not.toMatch(/From Files \+ Goal/);
    expect(page).not.toContain("files_goal");
    expect(page).not.toContain("handleCreateFilesGoal");
    expect(page).not.toContain("FileDropZone");
    expect(page).toContain("isUiWorkspaceCreateMode");

    writeScratch(
      "workspace-create-excerpts.txt",
      [
        "page uses UI_WORKSPACE_CREATE_MODES for MODE_CARDS",
        "cards: Blank, From Template",
        "no From Files + Goal card",
        "no files_goal form/step",
        "no handleCreateFilesGoal",
        "createMode blank + template remain",
      ].join("\n"),
    );
  });
});
