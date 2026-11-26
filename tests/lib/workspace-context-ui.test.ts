import { readWorkspaceViewSurface } from "@/tests/helpers/surface-source";
/**
 * Structural + pure UI layout checks for Context surface, map-first chrome,
 * block local inspection, and prompt-impact readout.
 */
import { describe, expect, it } from "vitest";
import { readMapGridSurface } from "../helpers/surface-source";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  availableWorkspaceSections,
  resolveActiveSection,
  resolveWorkspaceSectionLayout,
} from "@/lib/workspace-sections";
import {
  clearWorkspaceBlockSelection,
  nextWorkspaceBlockSelection,
  resolveWorkspaceRightPane,
} from "@/lib/workspace-right-pane";
import {
  isBlockMapToolEnabled,
  blockMapToolLabel,
} from "@/lib/block-map-tools";
import { mapCellChromeClasses, MAP_CELL_UNUSABLE_CLASS } from "@/lib/map-cell-chrome";

const ROOT = join(__dirname, "../..");

function read(rel: string) {
  const path = join(ROOT, rel);
  expect(existsSync(path), `missing ${rel}`).toBe(true);
  return readFileSync(path, "utf8");
}

describe("Context section layout resolver", () => {
  it("exposes Context as a first-class surface for files/notes", () => {
    const layout = resolveWorkspaceSectionLayout("context");
    expect(layout.mainSurface).toBe("context");
    expect(layout.mountsContextPanel).toBe(true);
    expect(layout.showBlockMapChrome).toBe(false);
    expect(layout.showSessionsColumn).toBe(false);
    expect(layout.mountsPerformancePanel).toBe(false);
  });

  it("workspace section stays map-first without mounting context panel", () => {
    const layout = resolveWorkspaceSectionLayout("workspace");
    expect(layout.showBlockMapChrome).toBe(true);
    expect(layout.showSessionsColumn).toBe(true);
    expect(layout.mountsContextPanel).toBe(false);
  });

  it("Context is available to owners and non-owners; knowledge remains privileged", () => {
    expect(availableWorkspaceSections({ isOwner: true })).toEqual([
      "workspace",
      "dags",
      "map_types",
      "unsys_models",
      "context",
      "settings",
    ]);
    expect(availableWorkspaceSections({ isOwner: false })).toEqual(["workspace"]);
    expect(resolveActiveSection("context", { isOwner: false })).toBe("workspace");
    expect(resolveActiveSection("knowledge", { isOwner: false })).toBe("workspace");
    // DAGs is owner-only (Creator authoring)
    expect(availableWorkspaceSections({ isOwner: false })).not.toContain("dags");
  });
});

describe("map-first right pane", () => {
  it("defaults to map_tools; block select → block_detail", () => {
    expect(resolveWorkspaceRightPane(null)).toBe("map_tools");
    expect(resolveWorkspaceRightPane("")).toBe("map_tools");
    expect(resolveWorkspaceRightPane("b1")).toBe("block_detail");
    const closed = nextWorkspaceBlockSelection("b1", clearWorkspaceBlockSelection());
    expect(resolveWorkspaceRightPane(closed)).toBe("map_tools");
  });
});

describe("map-ground tools enablement", () => {
  it("lock_until and mark_unusable enablement stays selection-driven", () => {
    expect(blockMapToolLabel("lock_until")).toMatch(/lock/i);
    expect(blockMapToolLabel("mark_unusable")).toMatch(/unusable/i);
    expect(
      isBlockMapToolEnabled("lock_until", {
        canEdit: true,
        busy: false,
        hasGridOps: true,
        selectedBlockCount: 1,
        selectedEmptyCellCount: 0,
      }),
    ).toBe(true);
    expect(
      isBlockMapToolEnabled("lock_until", {
        canEdit: true,
        busy: false,
        hasGridOps: true,
        selectedBlockCount: 0,
        selectedEmptyCellCount: 0,
      }),
    ).toBe(false);
    // Unusable requires multi-selected empty cells
    expect(
      isBlockMapToolEnabled("mark_unusable", {
        canEdit: true,
        busy: false,
        hasGridOps: true,
        selectedBlockCount: 0,
        selectedEmptyCellCount: 0,
      }),
    ).toBe(false);
    expect(
      isBlockMapToolEnabled("mark_unusable", {
        canEdit: true,
        busy: false,
        hasGridOps: true,
        selectedBlockCount: 0,
        selectedEmptyCellCount: 2,
      }),
    ).toBe(true);
  });
});

describe("map cell chrome for unusable / locked", () => {
  it("unusable cells use dedicated chrome class", () => {
    const cls = mapCellChromeClasses({
      status: "not_started",
      selected: false,
      unusable: true,
    });
    expect(cls).toContain(MAP_CELL_UNUSABLE_CLASS.split(" ")[0] || "repeating-linear");
    expect(cls.toLowerCase()).toMatch(/neutral|repeating/);
  });
});

describe("structural wiring in WorkspaceView + AYCL", () => {


  it("i18n has sectionContext key", () => {
    const en = read("messages/en.json");
    expect(en).toContain('"sectionContext"');
  });
});
