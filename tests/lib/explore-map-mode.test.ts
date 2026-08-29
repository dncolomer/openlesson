/**
 * Build / Play / Explore 3-state map toggle, quieter Explore chrome,
 * empty-cell → explore-block drawer, and XAI prompt/parser.
 */
import { describe, expect, it } from "vitest";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { readMapGridSurface, readWorkspaceViewSurface } from "../helpers/surface-source";
import {
  WORKSPACE_INTERACTION_MODES,
  WORKSPACE_MAP_TOGGLE_IDS,
  WORKSPACE_MODE_DISPLAY_LABELS,
  nextWorkspaceMapToggle,
  resolveWorkspaceMapToggleId,
  visibleWorkspaceMapToggleIds,
  workspaceModeDisplayLabel,
} from "@/lib/workspace-mode";
import {
  resolveEmptyCellMarker,
  resolveMapOccupiedTileBadges,
} from "@/lib/map-tile-badges";
import {
  resolveEmptySelectionSurface,
  resolveWorkspaceRightPane,
} from "@/lib/workspace-right-pane";
import {
  MAP_EXPLORE_BLOCK_DRAWER_TITLE,
  MAP_EXPLORE_DRAWER_IDS,
  buildExploreBlockSystemMessage,
  buildExploreBlockUserPrompt,
  collectNearbyFilledBlocks,
  parseExploreBlockAiResponse,
} from "@/lib/empty-map-pane";

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

const nearbyBlocks = [
  {
    id: "alpha",
    title: "Linear algebra",
    description: "Vectors and bases",
    position_x: 2,
    position_y: 2,
    span_w: 1,
    span_h: 1,
  },
  {
    id: "beta",
    title: "Probability",
    description: "Random variables",
    position_x: 8,
    position_y: 8,
    span_w: 1,
    span_h: 1,
  },
];

describe("Build / Play / Explore toggle helpers", () => {
  it("display labels and third state for the under-minimap control", () => {
    expect(workspaceModeDisplayLabel("creator")).toBe("Build");
    expect(workspaceModeDisplayLabel("learner")).toBe("Play");
    expect(workspaceModeDisplayLabel("explore")).toBe("Explore");
    expect(WORKSPACE_MODE_DISPLAY_LABELS.explore).toBe("Explore");
    expect([...WORKSPACE_MAP_TOGGLE_IDS]).toEqual([
      "creator",
      "learner",
      "explore",
    ]);
    expect(visibleWorkspaceMapToggleIds()).toEqual([
      "creator",
      "learner",
      "explore",
    ]);
    expect(
      visibleWorkspaceMapToggleIds({
        allowCreator: false,
        allowExplore: true,
      }),
    ).toEqual(["learner", "explore"]);
    expect(
      visibleWorkspaceMapToggleIds({
        allowCreator: true,
        allowExplore: true,
      }),
    ).toEqual(["creator", "learner", "explore"]);
    expect([...WORKSPACE_INTERACTION_MODES]).toEqual(["creator", "learner"]);

    expect(
      resolveWorkspaceMapToggleId({
        interactionMode: "creator",
        exploreOpen: false,
      }),
    ).toBe("creator");
    expect(
      resolveWorkspaceMapToggleId({
        interactionMode: "learner",
        exploreOpen: true,
      }),
    ).toBe("explore");

    expect(
      nextWorkspaceMapToggle({
        clicked: "explore",
        interactionMode: "creator",
        exploreOpen: false,
      }),
    ).toEqual({ interactionMode: "creator", exploreOpen: true });
    expect(
      nextWorkspaceMapToggle({
        clicked: "learner",
        interactionMode: "creator",
        exploreOpen: true,
      }),
    ).toEqual({ interactionMode: "learner", exploreOpen: false });
    expect(
      nextWorkspaceMapToggle({
        clicked: "creator",
        interactionMode: "creator",
        exploreOpen: true,
      }),
    ).toEqual({ interactionMode: "creator", exploreOpen: false });

    const occupied = resolveMapOccupiedTileBadges({
      hasDagLock: true,
      isStart: true,
      hasPractice: true,
      hasLocalContext: true,
      hasEffects: true,
      exploreActive: true,
    });
    expect(occupied).toEqual({
      showLock: false,
      showStarter: false,
      showPractice: false,
      showLocalContext: false,
      showEffects: false,
      showGeneratorBusy: false,
    });
    const occupiedBuild = resolveMapOccupiedTileBadges({
      hasDagLock: true,
      isStart: true,
      exploreActive: false,
    });
    expect(occupiedBuild.showLock).toBe(false);
    expect(occupiedBuild.showStarter).toBe(false);

    expect(
      resolveEmptyCellMarker({
        exploreActive: true,
        canEdit: true,
        learnerMode: false,
      }),
    ).toBe("search");
    expect(
      resolveEmptyCellMarker({
        exploreActive: false,
        canEdit: true,
        learnerMode: false,
      }),
    ).toBe("plus");
    expect(
      resolveEmptyCellMarker({
        exploreActive: false,
        canEdit: false,
        learnerMode: true,
      }),
    ).toBe("none");

    writeScratch(
      "explore-mode-chrome.log",
      [
        "labels=" +
          WORKSPACE_MAP_TOGGLE_IDS.map(workspaceModeDisplayLabel).join("/"),
        "toggle_ids=" + WORKSPACE_MAP_TOGGLE_IDS.join(","),
        "wire_modes=" + WORKSPACE_INTERACTION_MODES.join(","),
        "explore_active_id=" +
          resolveWorkspaceMapToggleId({
            interactionMode: "creator",
            exploreOpen: true,
          }),
        "occupied_icons_explore=" +
          JSON.stringify(occupied),
        "empty_explore=" +
          resolveEmptyCellMarker({ exploreActive: true, canEdit: true }),
        "empty_build=" +
          resolveEmptyCellMarker({
            exploreActive: false,
            canEdit: true,
            learnerMode: false,
          }),
      ].join("\n"),
    );
  });
});

describe("empty-cell click resolves to explore-block in Explore", () => {
  it("Explore empty → explore_block; Build empty → add_block", () => {
    const cell = { row: 3, col: 4 };
    const explore = resolveEmptySelectionSurface({
      selectedEmptyCells: [cell],
      exploreActive: true,
    });
    expect(explore).toEqual({ kind: "explore_block", cell });
    expect(resolveWorkspaceRightPane(null, explore)).toBe("explore_block");

    const build = resolveEmptySelectionSurface({
      selectedEmptyCells: [cell],
      exploreActive: false,
    });
    expect(build).toEqual({ kind: "add_block", cell });
    expect(resolveWorkspaceRightPane(null, build)).toBe("add_block");

    const multiExplore = resolveEmptySelectionSurface({
      selectedEmptyCells: [cell, { row: 3, col: 5 }],
      exploreActive: true,
    });
    expect(multiExplore?.kind).toBe("explore_block");
    const multiBuild = resolveEmptySelectionSurface({
      selectedEmptyCells: [cell, { row: 3, col: 5 }],
      exploreActive: false,
    });
    expect(multiBuild?.kind).toBe("generate_shape");

    writeScratch(
      "explore-block-drawer.log",
      [
        "explore_kind=" + explore?.kind,
        "explore_pane=" + resolveWorkspaceRightPane(null, explore),
        "build_kind=" + build?.kind,
        "build_pane=" + resolveWorkspaceRightPane(null, build),
        "title=" + MAP_EXPLORE_BLOCK_DRAWER_TITLE,
      ].join("\n"),
    );
  });
});

describe("explore-block XAI prompt + parser", () => {
  it("prompt includes cell, filled titles, nearby geometry, and modifier", () => {
    const nearby = collectNearbyFilledBlocks({
      cell: { row: 2, col: 3 },
      blocks: nearbyBlocks,
      radius: 3,
    });
    expect(nearby.map((b) => b.id)).toContain("alpha");
    expect(nearby.map((b) => b.id)).not.toContain("beta");

    const prompt = buildExploreBlockUserPrompt({
      cell: { row: 2, col: 3 },
      blocks: nearbyBlocks,
      nearbyBlocks: nearby,
      modifierPrompt: "Focus on visual proofs",
    });
    expect(prompt).toContain("row=2, col=3");
    expect(prompt).toContain("Linear algebra");
    expect(prompt).toContain("Probability");
    expect(prompt).toContain("Focus on visual proofs");
    expect(buildExploreBlockSystemMessage()).toMatch(/empty cell/i);

    const parsed = parseExploreBlockAiResponse({
      summary:
        "This empty cell sits next to Linear algebra and can host a visual proof of bases.",
    });
    expect(parsed).toMatch(/Linear algebra/);
    expect(parseExploreBlockAiResponse("plain text result")).toBe(
      "plain text result",
    );

    writeScratch(
      "explore-block-xai.log",
      [
        "nearby=" + nearby.map((b) => b.id).join(","),
        "prompt_has_cell=" + prompt.includes("row=2, col=3"),
        "prompt_has_filled=" + prompt.includes("Linear algebra"),
        "prompt_has_modifier=" + prompt.includes("Focus on visual proofs"),
        "parsed=" + parsed,
      ].join("\n"),
    );
  });
});

describe("Explore mode wiring", () => {
  it("3-state toggle, no standalone explore button, search marker, explore-block drawer", () => {
    const grid = readMapGridSurface();
    const view = readWorkspaceViewSurface();
    const pane = read("components/WorkspaceEmptyMapPane.tsx");
    const api = read("app/api/workspace/map-explore/route.ts");
    const stack = read("components/block-skill-grid/map-right-stack.tsx");

    expect(stack).toContain("WORKSPACE_MAP_TOGGLE_IDS");
    expect(stack).toContain("data-workspace-mode-toggle-states");
    expect(stack).toContain("WORKSPACE_MAP_TOGGLE_IDS");
    expect(stack).toContain('workspaceModeDisplayLabel');
    expect(stack).not.toContain("Explore / Expand Map");
    expect(stack).not.toContain("data-map-explore-toggle");
    expect(grid).not.toContain("data-map-explore-toggle");
    expect(grid).toContain("data-empty-cell-search");
    expect(grid).toContain("data-empty-cell-plus");
    expect(grid).toContain("resolveEmptyCellMarker");

    expect(pane).toContain(MAP_EXPLORE_BLOCK_DRAWER_TITLE);
    expect(pane).toContain('drawerId="map_explore_block"');
    expect(pane).toContain("data-explore-block-modifier");
    expect(pane).toContain("data-explore-block-submit");
    expect(pane).toContain('callMapExplore("explore_block"');
    expect(MAP_EXPLORE_DRAWER_IDS).toContain("map_explore_block");

    expect(api).toContain('op !== "explore_block"');
    expect(api).toContain("buildExploreBlockUserPrompt");
    expect(view).toContain("onMapToggle");
    expect(view).toContain("exploreTargetCell");
    expect(view).toContain("handleMapToggle");

    writeScratch(
      "explore-mode-wiring.log",
      [
        "toggle_states=" + stack.includes("build,play,explore"),
        "no_standalone_explore=" + !stack.includes("data-map-explore-toggle"),
        "search_marker=" + grid.includes("data-empty-cell-search"),
        "plus_still_in_build=" + grid.includes("data-empty-cell-plus"),
        "drawer_title=" + pane.includes(MAP_EXPLORE_BLOCK_DRAWER_TITLE),
        "modifier=" + pane.includes("data-explore-block-modifier"),
        "explore_btn=" + pane.includes("data-explore-block-submit"),
        "api_op=" + api.includes("explore_block"),
        "view_toggle=" + view.includes("onMapToggle"),
      ].join("\n"),
    );
  });
});
