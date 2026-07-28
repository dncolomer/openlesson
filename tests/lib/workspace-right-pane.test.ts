/**
 * Workspace right pane: block detail replaces notes/files; X clears selection.
 * Drives shipped pure helpers + structural wiring in WorkspaceView / AYCL / SessionList.
 */
import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  clearWorkspaceBlockSelection,
  nextWorkspaceBlockSelection,
  resolveWorkspaceRightPane,
} from "@/lib/workspace-right-pane";

const ROOT = join(__dirname, "../..");

function read(rel: string) {
  const path = join(ROOT, rel);
  expect(existsSync(path), `missing ${rel}`).toBe(true);
  return readFileSync(path, "utf8");
}

describe("resolveWorkspaceRightPane", () => {
  it("defaults to notes_files when nothing is selected", () => {
    expect(resolveWorkspaceRightPane(null)).toBe("notes_files");
    expect(resolveWorkspaceRightPane(undefined)).toBe("notes_files");
    expect(resolveWorkspaceRightPane("")).toBe("notes_files");
    expect(resolveWorkspaceRightPane("   ")).toBe("notes_files");
  });

  it("selected block id → block_detail", () => {
    expect(resolveWorkspaceRightPane("block-abc")).toBe("block_detail");
    expect(resolveWorkspaceRightPane("  block-abc  ")).toBe("block_detail");
  });
});

describe("clear / next selection (X close path)", () => {
  it("clearWorkspaceBlockSelection always returns null", () => {
    expect(clearWorkspaceBlockSelection()).toBeNull();
  });

  it("nextWorkspaceBlockSelection opens, replaces, and closes via null", () => {
    expect(nextWorkspaceBlockSelection(null, "b1")).toBe("b1");
    expect(nextWorkspaceBlockSelection("b1", "b2")).toBe("b2");
    expect(nextWorkspaceBlockSelection("b1", null)).toBeNull();
    expect(nextWorkspaceBlockSelection("b1", "")).toBeNull();
    // Same path as X: clear then resolve pane back to notes/files
    const closed = nextWorkspaceBlockSelection("b1", clearWorkspaceBlockSelection());
    expect(closed).toBeNull();
    expect(resolveWorkspaceRightPane(closed)).toBe("notes_files");
  });
});

describe("structural: right pane not map modal", () => {
  it("SessionList no longer mounts BlockDetailDrawer modal overlay", () => {
    const list = read("components/SessionList.tsx");
    expect(list).not.toContain("BlockDetailDrawer");
    expect(list).not.toContain("aria-modal");
    expect(list).toContain("onExpandedNodeIdChange");
    expect(list).toContain("nextWorkspaceBlockSelection");
    expect(list).toContain("data-session-list");
  });

  it("mobile non-owner auto-expand is one-shot so X close stays closed", () => {
    const list = read("components/SessionList.tsx");
    expect(list).toContain("mobileAutoExpandAttemptedRef");
    expect(list).toMatch(/mobileAutoExpandAttemptedRef\.current\s*=\s*true/);
    // Must not re-open solely because expandedNodeId became null after clear
    expect(list).toMatch(
      /if\s*\(\s*mobileAutoExpandAttemptedRef\.current\s*\)\s*return/,
    );
  });

  it("WorkspaceView swaps right column between notes/files and block detail with X", () => {
    const view = read("components/WorkspaceView.tsx");
    expect(view).toContain("resolveWorkspaceRightPane");
    expect(view).toContain("WorkspaceBlockDetailPane");
    expect(view).toContain("WorkspaceNotesFilesPanel");
    expect(view).toContain("expandedBlockId");
    expect(view).toContain("handleCloseBlockDetail");
    expect(view).toContain("clearWorkspaceBlockSelection");
    expect(view).toContain('data-workspace-right-pane={rightPane}');
    expect(view).toContain("onExpandedNodeIdChange");
    // No map-covering drawer from SessionList path
    expect(view).not.toContain("BlockDetailDrawer");
  });

  it("AyclWorkspaceView shares the same right-pane open/close path", () => {
    const aycl = read("components/AyclWorkspaceView.tsx");
    expect(aycl).toContain("resolveWorkspaceRightPane");
    expect(aycl).toContain("WorkspaceBlockDetailPane");
    expect(aycl).toContain("handleCloseBlockDetail");
    expect(aycl).toContain("clearWorkspaceBlockSelection");
    expect(aycl).toContain("onExpandedNodeIdChange");
    expect(aycl).not.toContain("BlockDetailDrawer");
  });

  it("WorkspaceBlockDetailPane exposes clear X close control", () => {
    const pane = read("components/WorkspaceBlockDetailPane.tsx");
    expect(pane).toContain("data-block-detail-close");
    expect(pane).toContain("data-workspace-block-detail-pane");
    expect(pane).toContain("data-workspace-right-pane");
    expect(pane).toContain("onClose");
    expect(pane).toContain("common.close");
  });
});
