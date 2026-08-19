import { readWorkspaceViewSurface } from "@/tests/helpers/surface-source";
/**
 * Exclusive map-host commit: shell keeps the committed kind.
 * open_block(null) is a full clear and must not follow blocks/empties.
 */
import { describe, expect, it } from "vitest";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  emptyWorkspaceMapSelection,
  nextWorkspaceMapSelection,
} from "@/lib/workspace-map-selection";
import { readMapGridSurface } from "../helpers/surface-source";

const ROOT = join(__dirname, "../..");
const SCRATCH =
  process.env.GROK_GOAL_SCRATCH ||
  "/var/folders/kd/98qlvkyd4mb3_9t32p9bmt_r0000gn/T/grok-goal-f71f456e9e6e/implementer";

function read(rel: string) {
  const path = join(ROOT, rel);
  expect(existsSync(path), `missing ${rel}`).toBe(true);
  return readFileSync(path, "utf8");
}

describe("exclusive map-host commit (shipped host→shell emit)", () => {
  it("exclusive multi/empty apply stays that kind; host does not emit open_block null after", () => {
    const exclusiveWrites: ReturnType<typeof nextWorkspaceMapSelection>[] = [];
    const exclusive = (next: (typeof exclusiveWrites)[number]) => {
      exclusiveWrites.push(next);
    };

    const sole = nextWorkspaceMapSelection({
      type: "set_filled_ids",
      blockIds: ["only"],
    });
    expect(sole).toEqual({ kind: "block", id: "only" });
    exclusive(sole);

    const multi = nextWorkspaceMapSelection({
      type: "set_filled_ids",
      blockIds: ["a", "b"],
    });
    exclusive(multi);
    const afterMulti = multi;
    expect(afterMulti).toEqual({ kind: "blocks", ids: ["a", "b"] });

    const empties = nextWorkspaceMapSelection({
      type: "set_empty_cells",
      cells: [
        { row: 1, col: 2 },
        { row: 1, col: 3 },
      ],
    });
    exclusive(empties);
    const afterEmpties = empties;
    expect(afterEmpties.kind).toBe("empties");
    expect(afterEmpties).toEqual(empties);

    const wipe = nextWorkspaceMapSelection({
      type: "open_block",
      blockId: null,
    });
    expect(wipe).toEqual(emptyWorkspaceMapSelection());
    expect(afterMulti.kind).not.toBe("none");
    expect(afterEmpties.kind).not.toBe("none");

    expect(exclusiveWrites).toEqual([sole, multi, empties]);

    const grid = readMapGridSurface();
    const view = readWorkspaceViewSurface();
    const list = read("components/SessionList.tsx");
    expect(grid).toContain("onMapSelectionChange(selection)");
    expect(grid).not.toContain("commitWorkspaceMapSelection");
    expect(grid).toContain("onMapSelectionChange");
    expect(grid).toContain("mapSelection?: WorkspaceMapSelection");
    expect(grid).not.toContain("notifyMapHostCommit");
    expect(grid).not.toContain("onSelectedBlockIdsChange");
    expect(grid).not.toContain("onEmptySelectionChange");
    expect(grid).not.toContain("onAddTargetChange");
    expect(grid).not.toContain("applyMapSelection");
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
    expect(view).toContain("mapSelection={mapSelection}");
    expect(view).not.toContain("applyMapSelection={");
    expect(view).not.toContain("onSelectedBlockIdsChange={handleSelectedBlockIdsChange}");
    expect(view).not.toContain("onEmptySelectionChange={handleEmptySelectionChange}");
    expect(view).not.toContain("mapSelectionToApplyPayload");
    expect(list).toContain("onMapSelectionChange={onMapSelectionChange}");
    expect(list).toContain("mapSelection={mapSelection}");
    expect(list).not.toContain("onSelectedBlockIdsChange");
    expect(list).not.toContain("onEmptySelectionChange");
    expect(list).not.toContain("onAddTargetChange");
    expect(list).not.toMatch(
      /onMapSelectionChange \? undefined : onEmptySelectionChange/,
    );

    mkdirSync(SCRATCH, { recursive: true });
    writeFileSync(
      join(SCRATCH, "selection-tests.log"),
      [
        `afterMulti=${afterMulti.kind}`,
        `afterEmpties=${afterEmpties.kind}`,
        `openBlockNull=${wipe.kind}`,
        `exclusiveWrites=${exclusiveWrites.map((w) => w.kind).join(",")}`,
        "host emits exclusive selection; open_block null is not applied after blocks/empties",
        "no apply token; no parallel filled/empty/add-target callbacks",
      ].join("\n"),
      "utf8",
    );
  });
});
