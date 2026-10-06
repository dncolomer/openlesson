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
  workspaceEmptyCellOpensAuthoring,
  workspaceExpandMapTitle,
  workspaceIdlePaneShowsExplore,
  workspaceLearnerPaneMounted,
  workspaceSurfaceShowsAuthoring,
  workspaceSurfaceShowsPracticeMenu,
} from "@/lib/workspace-mode";
import { resolveBlockCircularMenuSurface } from "@/lib/block-circular-menu";
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

describe("one workspace surface", () => {
  it("does not present Play, Build, or Explore and still reaches map, authoring, and explore", () => {
    const modeLib = read("lib/workspace-mode.ts");
    expect(modeLib).not.toContain("workspacePresentsModeChoice");
    expect(modeLib).not.toContain("workspaceModeControlMounted");
    expect(modeLib).not.toContain("visibleWorkspaceMapToggleIds");
    expect(modeLib).not.toContain("workspaceModeDisplayLabel");
    expect(modeLib).not.toContain("WORKSPACE_MAP_TOGGLE_IDS");
    expect(resolveFixedWorkspaceInteractionMode({})).toBe("learner");
    expect(
      resolveFixedWorkspaceInteractionMode({ workspaceKind: "knowledge_region" }),
    ).toBe("creator");
    expect(
      resolveFixedWorkspaceInteractionMode({
        workspaceKind: "knowledge_region",
        practiceOnly: true,
      }),
    ).toBe("learner");

    const owner = availableSectionsForMode({
      mode: "learner",
      isOwner: true,
      isLoggedIn: true,
    });
    expect(owner).toEqual([
      "workspace",
      "dags",
      "map_types",
      "context",
      "settings",
    ]);
    expect(workspaceSurfaceShowsAuthoring({ isOwner: true })).toBe(true);
    expect(workspaceSurfaceShowsPracticeMenu()).toBe(true);
    expect(workspaceIdlePaneShowsExplore({ allowExplore: true })).toBe(true);
    expect(
      availableSectionsForMode({
        mode: "learner",
        isOwner: true,
        allowAuthoring: false,
      }),
    ).toEqual(["workspace"]);
    expect(
      workspaceSurfaceShowsAuthoring({ isOwner: true, allowAuthoring: false }),
    ).toBe(false);
    expect(workspaceEmptyCellOpensAuthoring({ authoring: true })).toBe(true);
    expect(workspaceEmptyCellOpensAuthoring({ authoring: false })).toBe(false);
    expect(
      workspaceLearnerPaneMounted({
        authoring: true,
        practiceDrawer: true,
        learnerActionRequested: false,
      }),
    ).toBe(false);
    expect(
      workspaceLearnerPaneMounted({
        authoring: true,
        practiceDrawer: true,
        learnerActionRequested: true,
      }),
    ).toBe(true);
    expect(
      workspaceLearnerPaneMounted({
        authoring: false,
        practiceDrawer: true,
        learnerActionRequested: false,
      }),
    ).toBe(true);
    expect(
      workspaceLearnerPaneMounted({
        authoring: true,
        practiceDrawer: false,
        learnerActionRequested: true,
      }),
    ).toBe(false);
    expect(workspaceExpandMapTitle()).toBe("Expand Map");
    expect(workspaceExpandMapTitle()).not.toMatch(/Play|Build|Explore/);
    const selection = read("components/workspace-view/use-workspace-map-selection.ts");
    expect(selection).toContain("workspaceEmptyCellOpensAuthoring({ authoring })");
    expect(selection).not.toContain(
      'if (interactionMode === "learner") return clearWorkspaceAddTarget()',
    );
    const shell = read("components/WorkspaceView.tsx");
    expect(shell).toContain("authoring: authoringOnMap");
    expect(shell).toContain("workspaceLearnerPaneMounted");
    expect(shell).toContain("learnerActionRequested: learnerDrawerRequest != null");
    const explorePane = read("components/WorkspaceEmptyMapPane.tsx");
    expect(explorePane).toContain("{workspaceExpandMapTitle()}");
    expect(explorePane).not.toContain("Expand Map ·");
    expect(explorePane).not.toContain('? "Play"');
    expect(workspaceIdlePaneShowsExplore({ allowExplore: false })).toBe(false);
    expect(
      resolveBlockCircularMenuSurface({
        learnerMode: false,
        practiceMenu: true,
      }),
    ).toBe("workspace-learner");
    expect(
      resolveBlockCircularMenuSurface({ learnerMode: false }),
    ).toBe("none");

    const world = read("components/block-skill-grid/map-world-layer.tsx");
    const grid = read("components/BlockSkillGrid.tsx");
    expect(world).not.toContain("mapExploreOpen");
    expect(world).not.toContain("data-empty-cell-search");
    expect(grid).toContain("blockCircularMenuOpensOnSelect(circularMenuSurface)");
    expect(grid).not.toContain("exploreOpen: mapExploreOpen");

    const occupied = resolveMapOccupiedTileBadges({
      hasDagLock: true,
      isStart: true,
      hasPractice: true,
      hasLocalContext: true,
      hasEffects: true,
    });
    expect(occupied).toEqual({
      showLock: false,
      showStarter: false,
      showPractice: false,
      showLocalContext: false,
      showEffects: false,
      showGeneratorBusy: false,
    });

    expect(
      resolveEmptyCellMarker({
        canEdit: true,
        learnerMode: false,
      }),
    ).toBe("plus");
    expect(
      resolveEmptyCellMarker({
        canEdit: false,
        learnerMode: true,
      }),
    ).toBe("none");
    expect(
      resolveEmptyCellMarker({
        canEdit: true,
        learnerMode: false,
        isUnusable: true,
      }),
    ).toBe("none");

    writeScratch(
      "explore-mode-chrome.log",
      [
        "fixed_learner=" + resolveFixedWorkspaceInteractionMode({}),
        "fixed_verification=" +
          resolveFixedWorkspaceInteractionMode({
            workspaceKind: "knowledge_region",
          }),
        "owner_sections=" +
          availableSectionsForMode({
            mode: "learner",
            isOwner: true,
          }).join(","),
        "occupied_icons=" + JSON.stringify(occupied),
        "empty_authoring=" +
          resolveEmptyCellMarker({
            canEdit: true,
            learnerMode: false,
          }),
      ].join("\n"),
    );
  });
});

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
  it("idle Expand Map pane, no mode toggle, no explore-block drawer", () => {
    const grid = readMapGridSurface();
    const view = readWorkspaceViewSurface();
    const pane = read("components/WorkspaceEmptyMapPane.tsx");
    const api = read("app/api/workspace/map-explore/route.ts");
    const stack = read("components/block-skill-grid/map-right-stack.tsx");
    const nav = read("components/WorkspaceSectionNav.tsx");

    expect(nav).not.toContain("workspaceModeControlMounted");
    expect(nav).not.toContain("workspacePresentsModeChoice");
    expect(nav).not.toContain("WORKSPACE_MAP_TOGGLE_IDS");
    expect(nav).toContain("data-workspace-interaction-mode");
    expect(view).toContain("workspaceSurfaceShowsAuthoring");
    expect(view).toContain("workspaceIdlePaneShowsExplore");
    expect(view).toContain("resolveFixedWorkspaceInteractionMode");
    expect(view).toContain("idleExplore={idleExplore}");
    expect(read("components/SessionList.tsx")).toContain(
      "resolveBlockCircularMenuSurface",
    );
    expect(stack).not.toContain("data-workspace-mode-under-minimap");
    expect(stack).not.toContain("Explore / Expand Map");
    expect(stack).not.toContain("data-map-explore-toggle");
    expect(grid).not.toContain("data-map-explore-toggle");
    expect(grid).not.toContain("data-empty-cell-search");
    expect(grid).toContain("data-empty-cell-plus");
    expect(grid).toContain("resolveEmptyCellMarker");

    expect(pane).not.toContain('drawerId="map_explore_block"');
    expect(pane).not.toContain("data-explore-block-modifier");
    expect(pane).not.toContain("data-explore-block-submit");
    expect(pane).not.toContain('callMapExplore("explore_block"');
    expect(pane).toContain("workspaceExpandMapTitle()");
    expect(MAP_EXPLORE_DRAWER_IDS).not.toContain("map_explore_block");

    expect(api).toContain('op !== "explore_block"');
    expect(api).toContain("buildExploreBlockUserPrompt");
    expect(view).not.toContain("onMapToggle");
    expect(view).not.toContain("exploreTargetCell");
    expect(view).not.toContain("handleMapToggle");

    writeScratch(
      "explore-mode-wiring.log",
      [
        "interaction_mode=" + nav.includes("data-workspace-interaction-mode"),
        "no_standalone_explore=" + !stack.includes("data-map-explore-toggle"),
        "plus_still_in_build=" + grid.includes("data-empty-cell-plus"),
        "no_explore_block_drawer=" + !pane.includes('drawerId="map_explore_block"'),
        "api_op=" + api.includes("explore_block"),
        "view_toggle=" + view.includes("onMapToggle"),
      ].join("\n"),
    );
  });
});
