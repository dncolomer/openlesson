/**
 * Structural + wiring checks: Expand block drawer + left-bar Clone paste path.
 * Clone is a map tool strip control (not a block-detail drawer).
 */
import { describe, expect, it } from "vitest";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  armClone,
  afterClonePaste,
  buildCloneInsertPayload,
  resolveClonePasteTarget,
  shouldInterceptEmptyClickForClone,
} from "@/lib/clone-block";
import {
  buildExpandFromSourceSlotPrompt,
  resolveExpandFromSourceSelection,
} from "@/lib/expand-block-from-source";
import {
  BLOCK_MAP_TOOL_STRIP,
  isCloneMapToolEnabled,
} from "@/lib/block-map-tools";

const ROOT = join(__dirname, "../..");
const SCRATCH =
  process.env.CLONE_EXPAND_UI_SCRATCH ||
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

describe("Clone left-bar + Expand block UI wiring", () => {
  it("left strip has Clone; detail mounts Expand only (no Clone drawer)", () => {
    const detail = read("components/WorkspaceBlockDetailPane.tsx");
    const expandPane = read("components/WorkspaceExpandBlockPane.tsx");
    const view = read("components/WorkspaceView.tsx");
    const grid = read("components/BlockSkillGrid.tsx");
    const gridOps = read("app/api/workspace/grid-ops/route.ts");

    // Clone is left-bar, not detail drawer
    expect(BLOCK_MAP_TOOL_STRIP).toContain("clone");
    expect(grid).toContain('case "clone"');
    expect(grid).toContain("onCloneArm");
    expect(detail).not.toContain('drawerId="clone"');
    expect(detail).not.toContain("WorkspaceCloneBlockPane");
    expect(detail).not.toContain("showCloneDrawer");

    // Expand block drawer remains on detail
    expect(detail).toContain("WorkspaceExpandBlockPane");
    expect(detail).toContain('drawerId="expand_block"');
    expect(detail).toContain("title=\"Expand block\"");
    expect(detail).toContain("data-expand-block-drawer");
    expect(detail).toContain("onExpandBlock");
    expect(expandPane).toContain("data-workspace-expand-block-pane");
    expect(expandPane).toContain("data-expand-block-controls");
    expect(expandPane).toContain("data-expand-block-range");
    expect(expandPane).toContain("data-expand-block-density");
    expect(expandPane).toContain("resolveExpandFromSourceSelection");
    expect(expandPane).toContain("data-expand-block-submit");

    // Host wiring: arm → empty click paste; expand → multi-create job
    expect(view).toContain("handleCloneArm");
    expect(view).toContain("handleClonePaste");
    expect(view).toContain("shouldInterceptEmptyClickForClone");
    expect(view).toContain("resolveClonePasteTarget");
    expect(view).toContain('op: "clone_block"');
    expect(view).toContain("handleExpandFromSourceBlock");
    expect(view).toContain("buildExpandFromSourceSlotPrompt");
    expect(view).toContain("runAddExpandCreateLoop");
    expect(view).toContain("/api/workspace/add-block-at-slot");
    expect(view).toContain("onCloneArm");
    expect(view).toContain("onExpandBlock");
    expect(view).toMatch(
      /handleExpandFromSourceBlock[\s\S]*?buildExpandFromSourceSlotPrompt[\s\S]*?add-block-at-slot/,
    );
    const expandFn = view.slice(
      view.indexOf("handleExpandFromSourceBlock"),
      view.indexOf("handleExpandFromSourceBlock") + 3500,
    );
    expect(expandFn).toContain("add-block-at-slot");
    expect(expandFn).toContain("runAddExpandCreateLoop");
    expect(expandFn).not.toContain('op: "generate_shape"');

    expect(gridOps).toContain('"clone_block"');
    expect(gridOps).toContain("buildCloneInsertPayload");
    expect(gridOps).toContain("op === \"clone_block\"");

    writeEvidence(
      "clone-expand-ui.log",
      [
        "clone_left_bar=true",
        "detail_no_clone_drawer=true",
        "detail_has_expand_drawer=true",
        "view_clone_paste=true",
        "view_expand_job=true",
        "grid_ops_clone_block=true",
        "clone_arm=" + JSON.stringify(armClone("b1")),
        "paste=" +
          JSON.stringify(
            resolveClonePasteTarget({
              state: armClone("b1"),
              target: { row: 2, col: 3 },
              occupiedKeys: [],
            }),
          ),
        "payload=" +
          JSON.stringify(
            buildCloneInsertPayload({
              source: { title: "T", description: "D" },
              target: { row: 2, col: 3 },
            }),
          ),
        "expand_prompt=" +
          buildExpandFromSourceSlotPrompt({
            source: { title: "T", description: "D" },
            slot: { row: 1, col: 1 },
            slotIndex: 0,
            totalSlots: 2,
          }).slice(0, 200),
        "expand_sel_n=" +
          resolveExpandFromSourceSelection({
            sourceBlock: {
              id: "b1",
              position_x: 0,
              position_y: 0,
              span_w: 1,
              span_h: 1,
            },
            range: 1,
            density: 100,
            seed: 1,
            occupiedKeys: ["0:0"],
          }).selected.length,
        "after_paste=" + JSON.stringify(afterClonePaste()),
        "intercept=" + shouldInterceptEmptyClickForClone(armClone("b1")),
        "clone_sole_enabled=" +
          isCloneMapToolEnabled({
            canEdit: true,
            busy: false,
            hasGridOps: true,
            selectedBlockCount: 1,
            selectedEmptyCellCount: 0,
          }),
      ].join("\n"),
    );
  });

  it("clone + expand only on creator canEdit path (not learner-only)", () => {
    const detail = read("components/WorkspaceBlockDetailPane.tsx");
    expect(detail).toMatch(/showExpandDrawer\s*=\s*\s*canEdit/);
    expect(detail).not.toContain("showCloneDrawer");
    const learner = read("components/WorkspaceLearnerBlockPane.tsx");
    expect(learner).not.toContain("WorkspaceCloneBlockPane");
    expect(learner).not.toContain("WorkspaceExpandBlockPane");
    expect(learner).not.toContain("Expand block");
    const grid = read("components/BlockSkillGrid.tsx");
    // Clone strip hidden in learner (no canEdit strip)
    expect(grid).toContain("!learnerMode");
  });
});
