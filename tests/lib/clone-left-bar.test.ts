import { readWorkspaceViewSurface } from "@/tests/helpers/surface-source";
/**
 * Clone drawer enablement + arm → paste wiring.
 */
import { describe, expect, it } from "vitest";
import { readMapGridSurface } from "../helpers/surface-source";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  blockMapToolKind,
  blockMapToolLabel,
  isBlockMapToolEnabled,
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

describe("clone drawer enablement", () => {
  it("enabled only for creator canEdit + sole filled block; disabled otherwise", () => {
    expect(blockMapToolKind("clone")).toBe("action");
    expect(blockMapToolLabel("clone").toLowerCase()).toMatch(/clone/);

    // Sole filled selection
    expect(
      isBlockMapToolEnabled("clone", state({ selectedBlockCount: 1 })),
    ).toBe(true);

    // Zero / multi / empty-only / no edit / no ops / busy
    expect(isBlockMapToolEnabled("clone", state({ selectedBlockCount: 0 }))).toBe(
      false,
    );
    expect(isBlockMapToolEnabled("clone", state({ selectedBlockCount: 2 }))).toBe(
      false,
    );
    expect(
      isBlockMapToolEnabled(
        "clone",
        state({ selectedBlockCount: 0, selectedEmptyCellCount: 3 }),
      ),
    ).toBe(false);
    expect(
      isBlockMapToolEnabled("clone", state({ canEdit: false, selectedBlockCount: 1 })),
    ).toBe(false);
    expect(
      isBlockMapToolEnabled("clone", state({ hasGridOps: false, selectedBlockCount: 1 })),
    ).toBe(false);
    expect(
      isBlockMapToolEnabled("clone", state({ busy: true, selectedBlockCount: 1 })),
    ).toBe(false);

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
        "sole_enabled=" +
          isBlockMapToolEnabled("clone", state({ selectedBlockCount: 1 })),
        "zero_enabled=" +
          isBlockMapToolEnabled("clone", state({ selectedBlockCount: 0 })),
        "multi_enabled=" +
          isBlockMapToolEnabled("clone", state({ selectedBlockCount: 2 })),
        "no_edit=" +
          isBlockMapToolEnabled("clone", state({ canEdit: false, selectedBlockCount: 1 })),
        "arm=" + JSON.stringify(armClone("sole-1")),
      ].join("\n"),
    );
  });
});
