/**
 * Build / Play / Explore 3-state map toggle, quieter Explore chrome,
 * empty-cell → explore-block drawer, and XAI prompt/parser.
 */
import { describe, expect, it } from "vitest";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { readMapGridSurface, readWorkspaceViewSurface } from "../helpers/surface-source";
import {
  availableSectionsForMode,
  resolveFixedWorkspaceInteractionMode,
  workspaceIdlePaneShowsExplore,
  workspaceLearnerPaneMounted,
  workspaceSurfaceShowsAuthoring,
  workspaceSurfaceShowsPracticeMenu,
} from "@/lib/workspace-mode";
import { resolveBlockCircularMenuSurface } from "@/lib/block-circular-menu";
import { resolveEmptyCellMarker } from "@/lib/map-tile-badges";
import {
  resolveEmptySelectionSurface,
  resolveWorkspaceRightPane,
} from "@/lib/workspace-right-pane";
import { MAP_EXPLORE_DRAWER_IDS } from "@/lib/empty-map-pane";

const ROOT = join(__dirname, "../..");
const SCRATCH =
  process.env.GROK_GOAL_SCRATCH ||
  "/var/folders/kd/98qlvkyd4mb3_9t32p9bmt_r0000gn/T/grok-goal-827dc276f49f/implementer";

function read(rel: string) {
  const path = join(ROOT, rel);
  expect(existsSync(path), `missing ${rel}`).toBe(true);
  return readFileSync(path, "utf8");
}

function writeScratch(name: string, body: string) {
  mkdirSync(SCRATCH, { recursive: true });
  writeFileSync(join(SCRATCH, name), body);
}

describe("empty-cell click opens add or generate", () => {
  it("one empty cell is add_block; two or more are generate_shape", () => {
    const cell = { row: 3, col: 4 };
    const one = resolveEmptySelectionSurface({
      selectedEmptyCells: [cell],
    });
    expect(one).toEqual({ kind: "add_block", cell });
    expect(resolveWorkspaceRightPane(null, one)).toBe("add_block");

    const multi = resolveEmptySelectionSurface({
      selectedEmptyCells: [cell, { row: 3, col: 5 }],
    });
    expect(multi?.kind).toBe("generate_shape");
    expect(resolveWorkspaceRightPane(null, multi)).toBe("generate_shape");
    const paneLib = read("lib/workspace-right-pane.ts");
    expect(paneLib).not.toContain("explore_block");

    writeScratch(
      "explore-block-drawer.log",
      [
        "one_kind=" + one?.kind,
        "one_pane=" + resolveWorkspaceRightPane(null, one),
        "multi_kind=" + multi?.kind,
      ].join("\n"),
    );
  });
});
