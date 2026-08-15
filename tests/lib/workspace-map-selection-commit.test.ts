/**
 * Exclusive map-host commit: shell keeps the committed kind.
 * open_block(null) is a full clear and must not follow blocks/empties.
 */
import { describe, expect, it } from "vitest";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  nextWorkspaceMapSelection,
  notifyMapHostCommit,
} from "@/lib/workspace-map-selection";

const ROOT = join(__dirname, "../..");
const SCRATCH =
  process.env.GROK_GOAL_SCRATCH ||
  "/var/folders/kd/98qlvkyd4mb3_9t32p9bmt_r0000gn/T/grok-goal-605d3ab12c6a/implementer";

function read(rel: string) {
  const path = join(ROOT, rel);
  expect(existsSync(path), `missing ${rel}`).toBe(true);
  return readFileSync(path, "utf8");
}

describe("notifyMapHostCommit (shipped host→shell emit)", () => {
  it("exclusive multi/empty apply stays that kind; host does not emit open_block null after", () => {
    const exclusiveWrites: ReturnType<typeof nextWorkspaceMapSelection>[] = [];
    const legacyCalls: Array<string | null> = [];
    const exclusive = (next: (typeof exclusiveWrites)[number]) => {
      exclusiveWrites.push(next);
    };
    const legacySelect = (id: string | null) => {
      legacyCalls.push(id);
    };

    const multi = nextWorkspaceMapSelection({
      type: "set_filled_ids",
      blockIds: ["a", "b"],
    });
    const afterMulti = notifyMapHostCommit(multi, exclusive, legacySelect);
    expect(afterMulti).toEqual({ kind: "blocks", ids: ["a", "b"] });
    expect(exclusiveWrites).toEqual([{ kind: "blocks", ids: ["a", "b"] }]);
    expect(legacyCalls).toEqual([]);

    const empties = nextWorkspaceMapSelection({
      type: "set_empty_cells",
      cells: [
        { row: 1, col: 2 },
        { row: 1, col: 3 },
      ],
    });
    const afterEmpties = notifyMapHostCommit(empties, exclusive, legacySelect);
    expect(afterEmpties.kind).toBe("empties");
    expect(afterEmpties).toEqual(empties);
    expect(legacyCalls).toEqual([]);

    const wipe = nextWorkspaceMapSelection({
      type: "open_block",
      blockId: null,
    });
    expect(wipe).toEqual({ kind: "none" });
    expect(afterMulti.kind).not.toBe("none");
    expect(afterEmpties.kind).not.toBe("none");

    const sole = nextWorkspaceMapSelection({
      type: "set_filled_ids",
      blockIds: ["only"],
    });
    notifyMapHostCommit(sole, undefined, legacySelect);
    expect(legacyCalls).toEqual(["only"]);

    const grid = read("components/BlockSkillGrid.tsx");
    const view = read("components/WorkspaceView.tsx");
    const list = read("components/SessionList.tsx");
    expect(grid).toContain("notifyMapHostCommit(selection, onMapSelectionChange, onSelectNode)");
    expect(grid).toContain("onMapSelectionChange");
    expect(grid).toContain(
      'nextWorkspaceMapSelection({ type: "set_empty_cells", cells: next })',
    );
    expect(grid).not.toMatch(
      /applyBlockSelection\([\s\S]*?onSelectNode\(null\)/,
    );
    expect(grid).not.toMatch(
      /applyEmptyCellSelection\([\s\S]*?onSelectNode\(null\)/,
    );
    expect(view).toContain("onMapSelectionChange={handleMapSelectionChange}");
    expect(view).not.toContain("onSelectedBlockIdsChange={handleSelectedBlockIdsChange}");
    expect(view).not.toContain("onEmptySelectionChange={handleEmptySelectionChange}");
    expect(list).toContain("onMapSelectionChange={onMapSelectionChange}");

    mkdirSync(SCRATCH, { recursive: true });
    writeFileSync(
      join(SCRATCH, "selection-tests.log"),
      [
        `afterMulti=${afterMulti.kind}`,
        `afterEmpties=${afterEmpties.kind}`,
        `openBlockNull=${wipe.kind}`,
        `exclusiveWrites=${exclusiveWrites.map((w) => w.kind).join(",")}`,
        `legacyAfterExclusive=${legacyCalls.filter((_, i) => i === 0).length}`,
        "host emits exclusive selection; open_block null is not applied after blocks/empties",
      ].join("\n"),
      "utf8",
    );
  });
});
