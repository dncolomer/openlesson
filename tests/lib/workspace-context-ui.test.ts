/**
 * Structural + pure UI layout checks for Context surface, map-first chrome,
 * block local inspection, and prompt-impact readout.
 */
import { describe, expect, it } from "vitest";
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
  visibleBlockMapTools,
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
      "context",
      "knowledge",
      "settings",
    ]);
    expect(availableWorkspaceSections({ isOwner: false })).toEqual([
      "workspace",
      "context",
    ]);
    expect(resolveActiveSection("context", { isOwner: false })).toBe("context");
    expect(resolveActiveSection("knowledge", { isOwner: false })).toBe("workspace");
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
  it("exposes lock_until and mark_unusable on left strip; selection-driven enablement", () => {
    const tools = visibleBlockMapTools({ canEdit: true, hasGridOps: true });
    expect(tools).toContain("lock_until");
    expect(tools).toContain("mark_unusable");
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
  it("WorkspaceView mounts Context section and map authoring / local inspection", () => {
    const view = read("components/WorkspaceView.tsx");
    expect(view).toContain('from "@/lib/workspace-sections"');
    expect(view).toContain("mountsContextPanel");
    expect(view).toContain("data-workspace-context-section");
    expect(view).toContain("WorkspaceContextPanel");
    expect(view).toContain("WorkspaceMapAuthoringPane");
    expect(view).toContain("WorkspaceBlockLocalContextPanel");
    expect(view).toContain('t("planView.sectionContext")');
    // Prompt-impact is not Workspace map primary chrome
    expect(view).not.toContain("WorkspacePromptImpactPanel");
    expect(view).not.toContain("How context shapes practice");
    // Notes/files no longer default right-pane on map section
    expect(view).toContain('rightPane === "block_detail"');
    expect(view).toContain("WorkspaceMapAuthoringPane");

    const local = read("components/WorkspaceBlockLocalContextPanel.tsx");
    expect(local).toContain("data-workspace-block-local-context");
    expect(local).toContain("assembleFocusedBlockPromptContext");
    expect(local).toContain("data-block-local-authoring");
    expect(local).toContain("data-block-local-readonly");
    // Saved create-time local_context is visible as already attached on select.
    expect(local).toContain("data-block-local-attached");
    expect(local).toContain("Already attached");
    expect(local).toContain("external_resource_ids");
    // Draft must reset when switching blocks (no stale Save onto wrong block).
    expect(local).toMatch(/useEffect\([\s\S]*blockId[\s\S]*localContext/);
    expect(view).toContain("key={detailBlock.id}");
    // After create, local_context is parsed into node state (not dropped).
    expect(view).toContain("parseBlockLocalContext(n.local_context)");

    // Map tiles show a document icon when local context is attached.
    const mapGrid = read("components/BlockSkillGrid.tsx");
    expect(mapGrid).toContain("blockHasAttachedLocalContext");
    expect(mapGrid).toContain("data-block-local-context-badge");
    expect(mapGrid).toContain("data-block-has-local-context");
    expect(mapGrid).toContain("BlockLocalContextDocBadge");
    const skillGrid = read("lib/block-skill-grid.ts");
    expect(skillGrid).toContain("export function blockHasAttachedLocalContext");
    expect(skillGrid).toContain("local_context?");

    const detail = read("components/WorkspaceBlockDetailPane.tsx");
    expect(detail).toContain("hasLocalMaterials");
    expect(detail).toContain("defaultExpanded={hasLocalMaterials}");
    expect(detail).toContain("data-block-has-local-context");
    expect(detail).toContain('drawerId="edit"');
    expect(detail).toContain("WorkspaceBlockEditPanel");
    expect(view).toContain("handleUpdateBlock");
    expect(view).toContain("handleDeleteBlock");
    expect(view).toContain("delete_block");

    const mapAuth = read("components/WorkspaceMapAuthoringPane.tsx");
    expect(mapAuth).toContain("data-workspace-map-authoring-pane");
    expect(mapAuth).not.toContain("WorkspacePromptImpactPanel");
    expect(mapAuth).not.toContain("How context shapes practice");
    expect(mapAuth).not.toContain("data-map-ground-toolbar-hint");
    expect(mapAuth).not.toContain("data-unusable-row");
    expect(mapAuth).not.toContain("data-lock-target-select");

    const context = read("components/WorkspaceContextPanel.tsx");
    expect(context).toContain("WorkspaceDantesSearch");
    expect(context).toContain("WorkspaceExternalAddLinkForm");
    expect(context).toContain("data-workspace-context-panel");

    // Map host wires selection → ground tools (prereq-edit mode)
    const grid = read("components/BlockSkillGrid.tsx");
    expect(grid).toContain("enterPrereqEditMode");
    expect(grid).toContain("confirmPrereqEdit");
    expect(grid).toContain("toggleStagedPrereq");
    expect(grid).toContain("resolveUnusableFromSelection");
    expect(grid).toContain("onMapGround");
    expect(grid).toContain('case "lock_until"');
    expect(grid).toContain('case "mark_unusable"');
    expect(view).toContain("onMapGround");
    expect(view).toContain("handleMapGround");
  });

  it("AyclWorkspaceView shares Context + map authoring path", () => {
    const aycl = read("components/AyclWorkspaceView.tsx");
    expect(aycl).toContain("mountsContextPanel");
    expect(aycl).toContain("WorkspaceMapAuthoringPane");
    expect(aycl).toContain("WorkspaceBlockLocalContextPanel");
    expect(aycl).toContain('t("planView.sectionContext")');
    expect(aycl).toContain("data-workspace-context-section");
  });

  it("i18n has sectionContext key", () => {
    const en = read("messages/en.json");
    expect(en).toContain('"sectionContext"');
  });
});
