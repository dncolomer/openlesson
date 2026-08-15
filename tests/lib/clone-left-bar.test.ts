/**
 * Clone as left map tool-strip control (not block-detail drawer).
 * Pure enablement + structural wiring for strip → arm → paste path.
 */
import { describe, expect, it } from "vitest";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  BLOCK_MAP_TOOL_STRIP,
  blockMapToolKind,
  blockMapToolLabel,
  isBlockMapToolEnabled,
  isCloneMapToolEnabled,
  visibleBlockMapTools,
  type BlockMapToolEnablementInput,
} from "@/lib/block-map-tools";
import {
  armClone,
  createDisarmedCloneState,
  resolveClonePasteTarget,
} from "@/lib/clone-block";

const ROOT = join(__dirname, "../..");
const SCRATCH =
  process.env.CLONE_LEFT_BAR_SCRATCH ||
  process.env.GOAL_SCRATCH ||
  "/var/folders/kd/98qlvkyd4mb3_9t32p9bmt_r0000gn/T/grok-goal-00e5ee38097b/implementer";

function read(rel: string) {
  const path = join(ROOT, rel);
  expect(existsSync(path), `missing ${rel}`).toBe(true);
  return readFileSync(path, "utf8");
}

function writeEvidence(name: string, body: string) {
  try {
    mkdirSync(SCRATCH, { recursive: true });
    writeFileSync(join(SCRATCH, name), body, "utf8");
  } catch {
    /* optional */
  }
}

function state(
  partial: Partial<BlockMapToolEnablementInput> = {},
): BlockMapToolEnablementInput {
  return {
    canEdit: true,
    busy: false,
    hasGridOps: true,
    selectedBlockCount: 0,
    selectedEmptyCellCount: 0,
    selectedMultiCellBlockCount: 0,
    selectedBlocksContiguous: false,
    ...partial,
  };
}

describe("clone left-bar enablement", () => {
  it("enabled only for creator canEdit + sole filled block; disabled otherwise", () => {
    expect(BLOCK_MAP_TOOL_STRIP).toContain("clone");
    expect(blockMapToolKind("clone")).toBe("action");
    expect(blockMapToolLabel("clone").toLowerCase()).toMatch(/clone/);

    // Sole filled selection
    expect(
      isCloneMapToolEnabled(state({ selectedBlockCount: 1 })),
    ).toBe(true);
    expect(
      isBlockMapToolEnabled("clone", state({ selectedBlockCount: 1 })),
    ).toBe(true);

    // Zero / multi / empty-only / no edit / no ops / busy
    expect(isCloneMapToolEnabled(state({ selectedBlockCount: 0 }))).toBe(false);
    expect(isCloneMapToolEnabled(state({ selectedBlockCount: 2 }))).toBe(false);
    expect(
      isCloneMapToolEnabled(
        state({ selectedBlockCount: 0, selectedEmptyCellCount: 3 }),
      ),
    ).toBe(false);
    expect(
      isCloneMapToolEnabled(state({ canEdit: false, selectedBlockCount: 1 })),
    ).toBe(false);
    expect(
      isCloneMapToolEnabled(state({ hasGridOps: false, selectedBlockCount: 1 })),
    ).toBe(false);
    expect(
      isCloneMapToolEnabled(state({ busy: true, selectedBlockCount: 1 })),
    ).toBe(false);

    // Visible on strip when canEdit + grid ops
    const tools = visibleBlockMapTools({ canEdit: true, hasGridOps: true });
    expect(tools).toContain("clone");
    expect(
      visibleBlockMapTools({ canEdit: false, hasGridOps: true }),
    ).not.toContain("clone");

    // Arm still requires a source id (empty multi cannot arm as source)
    expect(armClone("")).toEqual(createDisarmedCloneState());
    expect(armClone("sole-1").armed).toBe(true);
    expect(
      resolveClonePasteTarget({
        state: armClone("sole-1"),
        target: { row: 1, col: 2 },
        occupiedKeys: [],
      }).ok,
    ).toBe(true);

    writeEvidence(
      "clone-left-bar-enable.log",
      [
        "strip_has_clone=" + BLOCK_MAP_TOOL_STRIP.includes("clone"),
        "sole_enabled=" + isCloneMapToolEnabled(state({ selectedBlockCount: 1 })),
        "zero_enabled=" + isCloneMapToolEnabled(state({ selectedBlockCount: 0 })),
        "multi_enabled=" + isCloneMapToolEnabled(state({ selectedBlockCount: 2 })),
        "no_edit=" +
          isCloneMapToolEnabled(state({ canEdit: false, selectedBlockCount: 1 })),
        "visible=" + tools.includes("clone"),
        "arm=" + JSON.stringify(armClone("sole-1")),
      ].join("\n"),
    );
  });
});

describe("clone left-bar UI wiring", () => {
  it("strip mounts Clone; detail has no Clone drawer; host keeps paste path", () => {
    const tools = read("lib/block-map-tools.ts");
    const grid = read("components/BlockSkillGrid.tsx");
    const detail = read("components/WorkspaceBlockDetailPane.tsx");
    const view = read("components/WorkspaceView.tsx");
    const sessions = read("components/SessionList.tsx");

    expect(tools).toContain('"clone"');
    expect(tools).toContain("isCloneMapToolEnabled");
    expect(tools).toMatch(/case "clone"/);

    // Left strip
    expect(grid).toContain('case "clone"');
    expect(grid).toContain("ToolIcon");
    const icons = read("components/block-skill-grid/map-tool-icons.tsx");
    expect(icons).toContain("data-tool-icon=\"clone\"");
    expect(grid).toContain("onCloneArm");
    expect(grid).toContain("cloneArmed");
    expect(grid).toContain("data-clone-armed");
    expect(grid).toContain("MapToolStripButton");
    const strip = read("components/block-skill-grid/map-tool-strip-button.tsx");
    expect(strip).toContain("data-block-map-tool={tool}");
    // Activate arms sole selection
    expect(grid).toMatch(/case "clone"[\s\S]*?onCloneArm/);

    // No drawer on detail
    expect(detail).not.toContain('drawerId="clone"');
    expect(detail).not.toContain("WorkspaceCloneBlockPane");
    expect(detail).not.toContain("showCloneDrawer");
    expect(detail).not.toContain("onCloneArm");

    // Host: strip props + paste
    expect(view).toContain("onCloneArm=");
    expect(view).toContain("handleCloneArm");
    expect(view).toContain("handleClonePaste");
    expect(view).toContain('op: "clone_block"');
    expect(sessions).toContain("onCloneArm");
    expect(sessions).toContain("cloneArmed");

    writeEvidence(
      "clone-left-bar-ui.log",
      [
        "strip_clone=true",
        "detail_no_clone_drawer=true",
        "view_arm_paste=true",
        "sessions_props=true",
      ].join("\n"),
    );
  });
});
