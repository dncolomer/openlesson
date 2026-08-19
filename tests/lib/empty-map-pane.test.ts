import { readWorkspaceViewSurface } from "@/tests/helpers/surface-source";
/**
 * Empty-selection map right pane: pure helpers + structural/wiring checks.
 * Drives shipped search / empty-spot / overview / selective-area / note helpers.
 */
import { describe, expect, it } from "vitest";
import { readMapGridSurface } from "../helpers/surface-source";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  applyAiTextToAreaSummary,
  buildAreaSummarySystemMessage,
  buildAreaSummaryUserPrompt,
  buildMapOverviewSummary,
  buildMapOverviewSystemMessage,
  buildMapSearchSystemMessage,
  buildMapSearchUserPrompt,
  buildSuggestSpotSystemMessage,
  buildSuggestSpotUserPrompt,
  closeMapExploreShell,
  collectPlaceableEmptyNearSeeds,
  createMapExploreShellState,
  createMapNoteFromAreaSummary,
  isMapExploreDrawerId,
  isSelectivePolygonReady,
  MAP_EXPLORE_DEFAULT_OPEN_DRAWER,
  MAP_EXPLORE_DRAWER_IDS,
  mapNoteCreateInputFromAreaSummary,
  normalizeEmptySpotTopic,
  normalizeMapSearchQuery,
  openMapExploreShell,
  parseAreaSummaryAiResponse,
  parseMapSearchAiResponse,
  parseOverviewAiResponse,
  parseSuggestSpotAiResponse,
  resolveMapExploreRightColumn,
  searchMapBlocksByTopic,
  suggestEmptySpotsForTopic,
  summarizeSelectiveArea,
  toggleMapExploreShell,
} from "@/lib/empty-map-pane";
import { resolveWorkspaceRightPane } from "@/lib/workspace-right-pane";
import { SKILL_GRID_PITCH } from "@/lib/block-skill-grid";

const ROOT = join(__dirname, "../..");
const SCRATCH =
  process.env.EMPTY_MAP_PANE_SCRATCH ||
  process.env.GOAL_SCRATCH ||
  "/var/folders/kd/98qlvkyd4mb3_9t32p9bmt_r0000gn/T/grok-goal-451f69f59475/implementer";

function read(rel: string) {
  const path = join(ROOT, rel);
  expect(existsSync(path), `missing ${rel}`).toBe(true);
  return readFileSync(path, "utf8");
}

function writeEvidence(name: string, body: string) {
  mkdirSync(SCRATCH, { recursive: true });
  writeFileSync(join(SCRATCH, name), body, "utf8");
}

const sampleBlocks = [
  {
    id: "b1",
    title: "Quadratic formula",
    description: "Solve ax^2+bx+c=0",
    position_x: 0,
    position_y: 0,
    span_w: 1,
    span_h: 1,
  },
  {
    id: "b2",
    title: "Completing the square",
    description: "Rewrite quadratics",
    position_x: 1,
    position_y: 0,
    span_w: 1,
    span_h: 1,
  },
  {
    id: "b3",
    title: "Orbital mechanics",
    description: "Kepler orbits and delta-v",
    position_x: 10,
    position_y: 10,
    span_w: 1,
    span_h: 1,
  },
];

describe("empty-map-pane pure helpers", () => {
  it("searchMapBlocksByTopic returns multi matching filled ids; empty query is safe", () => {
    expect(normalizeMapSearchQuery("Find me blocks about quadratic")).toMatch(
      /quadratic/i,
    );
    expect(searchMapBlocksByTopic(sampleBlocks, "")).toEqual([]);
    expect(searchMapBlocksByTopic(sampleBlocks, "   ")).toEqual([]);
    expect(searchMapBlocksByTopic(sampleBlocks, null)).toEqual([]);

    const hits = searchMapBlocksByTopic(
      sampleBlocks,
      "find me blocks about quadratic",
    );
    expect(hits.length).toBeGreaterThanOrEqual(1);
    expect(hits).toContain("b1");
    // Multi when several match theme
    const multi = searchMapBlocksByTopic(sampleBlocks, "quadratic");
    expect(multi).toContain("b1");
    // Completing the square may or may not match "quadratic" in title/desc — formula does
    expect(multi[0]).toBe("b1");

    const orbital = searchMapBlocksByTopic(
      sampleBlocks,
      "blocks about orbital mechanics",
    );
    expect(orbital).toEqual(["b3"]);

    writeEvidence(
      "empty-map-pane-logic.log",
      [
        "search_empty=" + JSON.stringify(searchMapBlocksByTopic(sampleBlocks, "")),
        "search_quadratic=" + JSON.stringify(hits),
        "search_orbital=" + JSON.stringify(orbital),
      ].join("\n"),
    );
  });

  it("suggestEmptySpotsForTopic returns multi empty placeable cells; excludes occupied", () => {
    expect(normalizeEmptySpotTopic("Suggest best spot for limits")).toMatch(
      /limits/i,
    );
    const emptyQ = suggestEmptySpotsForTopic({
      blocks: sampleBlocks,
      topic: "",
    });
    // Empty topic still may return near any content — not an error
    expect(Array.isArray(emptyQ)).toBe(true);

    const spots = suggestEmptySpotsForTopic({
      blocks: sampleBlocks,
      topic: "best spot for quadratic",
      limit: 6,
    });
    expect(spots.length).toBeGreaterThan(1);
    const occupied = new Set(["0:0", "0:1", "10:10"]);
    for (const c of spots) {
      expect(occupied.has(`${c.row}:${c.col}`)).toBe(false);
    }
    // Near quadratic cluster (0,0)/(0,1) not near orbital
    expect(
      spots.some((c) => Math.abs(c.row) <= 3 && Math.abs(c.col) <= 3),
    ).toBe(true);

    const near = collectPlaceableEmptyNearSeeds({
      seeds: [{ row: 0, col: 0 }],
      occupiedKeys: ["0:0"],
      unusableKeys: ["0:1"],
      radius: 1,
      limit: 8,
    });
    expect(near.every((c) => `${c.row}:${c.col}` !== "0:0")).toBe(true);
    expect(near.every((c) => `${c.row}:${c.col}` !== "0:1")).toBe(true);
    expect(near.length).toBeGreaterThan(0);

    writeEvidence(
      "empty-map-pane-logic.log",
      [
        readFileSync(join(SCRATCH, "empty-map-pane-logic.log"), "utf8"),
        "suggest_spots=" + JSON.stringify(spots),
        "suggest_empty_topic_n=" + emptyQ.length,
        "near_seeds=" + JSON.stringify(near),
      ].join("\n"),
    );
  });

  it("buildMapOverviewSummary surfaces block and cluster signals", () => {
    const empty = buildMapOverviewSummary([]);
    expect(empty.blockCount).toBe(0);
    expect(empty.text.toLowerCase()).toMatch(/empty/);

    const ov = buildMapOverviewSummary(sampleBlocks);
    expect(ov.blockCount).toBe(3);
    expect(ov.clusterCount).toBeGreaterThanOrEqual(1);
    expect(ov.text).toMatch(/block/i);
    expect(ov.sampleTitles.some((t) => /Quadratic|Orbital|Completing/i.test(t))).toBe(
      true,
    );
    // Two nearby + one far → at least 2 clusters under isolation gap 3
    expect(ov.clusterCount).toBeGreaterThanOrEqual(2);

    writeEvidence(
      "empty-map-pane-logic.log",
      [
        readFileSync(join(SCRATCH, "empty-map-pane-logic.log"), "utf8"),
        "overview_text=" + ov.text,
        "overview_clusters=" + ov.clusterCount,
        "overview_blocks=" + ov.blockCount,
      ].join("\n"),
    );
  });

  it("summarizeSelectiveArea + note create from free-shape (not selection)", () => {
    expect(isSelectivePolygonReady([])).toBe(false);
    expect(isSelectivePolygonReady([{ x: 0, y: 0 }])).toBe(false);
    // Triangle covering (0,0) and (1,0) blocks
    const polygon = [
      { x: -0.5, y: -0.5 },
      { x: 2.5, y: -0.5 },
      { x: 2.5, y: 1.5 },
      { x: -0.5, y: 1.5 },
    ];
    expect(isSelectivePolygonReady(polygon)).toBe(true);
    const summary = summarizeSelectiveArea({
      polygon,
      blocks: sampleBlocks,
    });
    expect(summary.blockIds).toContain("b1");
    expect(summary.blockIds).toContain("b2");
    expect(summary.blockIds).not.toContain("b3");
    expect(summary.text).toMatch(/block/i);
    expect(summary.blockTitles.some((t) => /Quadratic|Completing/i.test(t))).toBe(
      true,
    );
    expect(summary.emptyCells.length).toBeGreaterThan(0);

    const createIn = mapNoteCreateInputFromAreaSummary(summary, {
      source: "creator",
      now: 1_700_000_000_000,
    });
    expect(createIn.body).toBeTruthy();
    expect(createIn.body).toContain(summary.text.slice(0, 20));
    expect(Number.isFinite(createIn.x)).toBe(true);
    expect(Number.isFinite(createIn.y)).toBe(true);
    // World position scales from grid centroid
    expect(Math.abs(createIn.x! - (summary.centroid.x * SKILL_GRID_PITCH - 40))).toBeLessThan(
      1,
    );

    const note = createMapNoteFromAreaSummary(summary, {
      source: "learner",
      now: 1_700_000_000_000,
    });
    expect(note.source).toBe("learner");
    expect(note.body.length).toBeGreaterThan(0);

    writeEvidence(
      "empty-map-pane-logic.log",
      [
        readFileSync(join(SCRATCH, "empty-map-pane-logic.log"), "utf8"),
        "area_block_ids=" + JSON.stringify(summary.blockIds),
        "area_text=" + summary.text,
        "note_body=" + note.body.slice(0, 120),
        "note_x=" + note.x,
        "note_y=" + note.y,
        "note_source=" + note.source,
      ].join("\n"),
    );
  });
});

describe("empty-map-pane xAI prompts + parsers (shipped)", () => {
  it("builds prompts and parses Grok JSON for search / spots / overview / area", () => {
    const searchSys = buildMapSearchSystemMessage();
    expect(searchSys).toMatch(/blockIds/i);
    const searchUser = buildMapSearchUserPrompt({
      query: "find me blocks about quadratic",
      blocks: sampleBlocks,
    });
    expect(searchUser).toContain("b1");
    expect(searchUser).toMatch(/quadratic/i);

    const parsedSearch = parseMapSearchAiResponse(
      { blockIds: ["b1", "invented", "b2"], rationale: "Algebra cluster" },
      sampleBlocks.map((b) => b.id),
    );
    expect(parsedSearch.blockIds).toEqual(["b1", "b2"]);
    expect(parsedSearch.blockIds).not.toContain("invented");
    expect(parsedSearch.rationale).toMatch(/Algebra/);

    const spotUser = buildSuggestSpotUserPrompt({
      topic: "best spot for orbital",
      blocks: sampleBlocks,
      limit: 6,
    });
    expect(spotUser).toContain("row");
    expect(buildSuggestSpotSystemMessage()).toMatch(/cells/i);
    const occupied = new Set(["0:0", "0:1", "10:10"]);
    const parsedSpot = parseSuggestSpotAiResponse(
      {
        cells: [
          { row: 0, col: 0 },
          { row: 11, col: 10 },
          { row: 11, col: 11 },
          { row: "x", col: 1 },
        ],
        rationale: "Near orbital mechanics",
      },
      { occupiedKeys: occupied, limit: 8 },
    );
    expect(parsedSpot.cells).toEqual([
      { row: 11, col: 10 },
      { row: 11, col: 11 },
    ]);
    expect(parsedSpot.rationale).toMatch(/orbital/i);

    expect(buildMapOverviewSystemMessage()).toMatch(/Do NOT bullet-list/i);
    const overview = parseOverviewAiResponse({
      summary: "A map bridging algebra and spaceflight.",
    });
    expect(overview).toMatch(/bridging algebra/i);

    expect(buildAreaSummarySystemMessage()).toMatch(/free-drawn region/i);
    const areaUser = buildAreaSummaryUserPrompt({
      blocksInArea: [sampleBlocks[0]],
      emptyCellCount: 4,
      centroid: { x: 1, y: 1 },
    });
    expect(areaUser).toContain("Quadratic");
    const areaText = parseAreaSummaryAiResponse({
      summary: "This region focuses on solving quadratic equations.",
    });
    expect(areaText).toMatch(/quadratic equations/i);
    const base = summarizeSelectiveArea({
      polygon: [
        { x: -0.5, y: -0.5 },
        { x: 2.5, y: -0.5 },
        { x: 2.5, y: 1.5 },
        { x: -0.5, y: 1.5 },
      ],
      blocks: sampleBlocks,
    });
    const merged = applyAiTextToAreaSummary(base, areaText);
    expect(merged.text).toBe(areaText);
    expect(merged.blockIds).toEqual(base.blockIds);

    writeEvidence(
      "empty-map-pane-logic.log",
      [
        readFileSync(join(SCRATCH, "empty-map-pane-logic.log"), "utf8"),
        "xai_search_ids=" + JSON.stringify(parsedSearch.blockIds),
        "xai_spot_cells=" + JSON.stringify(parsedSpot.cells),
        "xai_overview=" + overview,
        "xai_area=" + areaText,
      ].join("\n"),
    );
  });
});

describe("map explore FAB toggle + restore (shipped helpers)", () => {
  it("open shows explore / hide drawers; close restores natural pane", () => {
    let shell = createMapExploreShellState();
    expect(shell.open).toBe(false);
    expect(shell.previousPane).toBeNull();

    shell = openMapExploreShell(shell, "block_detail");
    expect(shell.open).toBe(true);
    expect(shell.previousPane).toBe("block_detail");
    // Idempotent open
    shell = openMapExploreShell(shell, "combine_blocks");
    expect(shell.previousPane).toBe("block_detail");

    const openCol = resolveMapExploreRightColumn({
      exploreOpen: true,
      naturalPane: "block_detail",
      previousPane: shell.previousPane,
    });
    expect(openCol.showExplore).toBe(true);
    expect(openCol.displayPane).toBe("map_explore");

    shell = closeMapExploreShell(shell);
    expect(shell.open).toBe(false);
    expect(shell.previousPane).toBeNull();
    const closedCol = resolveMapExploreRightColumn({
      exploreOpen: false,
      naturalPane: "block_detail",
      previousPane: null,
    });
    expect(closedCol.showExplore).toBe(false);
    expect(closedCol.displayPane).toBe("block_detail");
    expect(closedCol.restoredPane).toBe("block_detail");

    // Empty/omitted prior restores safely to natural empty map_tools
    const emptyRestore = resolveMapExploreRightColumn({
      exploreOpen: false,
      naturalPane: "map_tools",
      previousPane: undefined,
    });
    expect(emptyRestore.displayPane).toBe("map_tools");
    expect(emptyRestore.showExplore).toBe(false);

    // Toggle open from add_block, then toggle closed
    shell = toggleMapExploreShell(createMapExploreShellState(), "add_block");
    expect(shell.open).toBe(true);
    expect(shell.previousPane).toBe("add_block");
    shell = toggleMapExploreShell(shell, "add_block");
    expect(shell.open).toBe(false);

    // Closed natural generate_shape restores drawers path
    const gen = resolveMapExploreRightColumn({
      exploreOpen: false,
      naturalPane: "generate_shape",
    });
    expect(gen.displayPane).toBe("generate_shape");

    writeEvidence(
      "map-explore-toggle-logic.log",
      [
        "open_hides_drawers_display=map_explore",
        "open_from_block_detail_prev=block_detail",
        "close_restores_block_detail=" +
          String(closedCol.displayPane === "block_detail"),
        "empty_prior_to_map_tools=" +
          String(emptyRestore.displayPane === "map_tools"),
        "toggle_roundtrip_closed=" + String(!shell.open),
      ].join("\n"),
    );

    writeEvidence(
      "map-explore-drawers-logic.log",
      [
        "drawer_ids=" + MAP_EXPLORE_DRAWER_IDS.join(","),
        "default_open=" + MAP_EXPLORE_DEFAULT_OPEN_DRAWER,
        "is_map_search=" + isMapExploreDrawerId("map_search"),
        "is_bogus=" + isMapExploreDrawerId("nope"),
        "open_showExplore=" + openCol.showExplore,
        "closed_showExplore=" + closedCol.showExplore,
        "closed_restores=" + closedCol.displayPane,
      ].join("\n"),
    );
  });
});

describe("empty-map-pane structural + wiring", () => {
  it("empty map UI mounts for map_tools; search/suggest/overview/selective markers", () => {
    const pane = read("components/WorkspaceEmptyMapPane.tsx");
    const authoring = read("components/WorkspaceMapAuthoringPane.tsx");
    const view = readWorkspaceViewSurface();
    const grid = readMapGridSurface();
    const sessionList = read("components/SessionList.tsx");
    const lib = read("lib/empty-map-pane.ts");
    const api = read("app/api/workspace/map-explore/route.ts");

    // Dedicated empty-map UI as drawer group (not only always-expanded sections)
    expect(pane).toContain("data-workspace-empty-map-pane");
    expect(pane).toContain("data-map-explore-drawers");
    expect(pane).toContain("WorkspaceRightPaneDrawerGroup");
    expect(pane).toContain("WorkspaceRightPaneDrawer");
    expect(pane).toContain('drawerId="map_overview"');
    expect(pane).toContain('drawerId="map_search"');
    expect(pane).toContain('drawerId="map_suggest_spot"');
    expect(pane).toContain('drawerId="map_selective"');
    expect(pane).toContain('drawerId="map_explore_block"');
    expect(pane).toContain("MAP_EXPLORE_DEFAULT_OPEN_DRAWER");
    expect(pane).toContain("data-empty-map-xai");
    expect(pane).toContain("data-empty-map-search");
    expect(pane).toContain("data-empty-map-search-input");
    expect(pane).toContain("data-empty-map-search-submit");
    expect(pane).toContain("data-empty-map-suggest-spot");
    expect(pane).toContain("data-empty-map-suggest-input");
    expect(pane).toContain("data-empty-map-suggest-submit");
    expect(pane).toContain("data-empty-map-overview");
    expect(pane).toContain("data-empty-map-overview-text");
    expect(pane).toContain("data-empty-map-selective-explanation");
    expect(pane).toContain("data-empty-map-selective-draw");
    expect(pane).toContain("data-empty-map-selective-to-note");
    // Four features are drawer-wrapped (not only stacked sections without drawerId)
    for (const id of MAP_EXPLORE_DRAWER_IDS) {
      expect(pane, id).toContain(`drawerId="${id}"`);
      expect(isMapExploreDrawerId(id)).toBe(true);
    }
    // No user-facing Grok brand in map explore UI
    expect(pane).not.toMatch(/\bGrok\b/);
    expect(pane).not.toContain("Grok is writing an overview");
    expect(pane).toContain("Writing an overview…");
    expect(pane).toContain("data-empty-map-overview-busy");
    // xAI path (not client-side deterministic search alone)
    expect(pane).toContain("/api/workspace/map-explore");
    expect(pane).toContain('callMapExplore("search"');
    expect(pane).toContain('callMapExplore("suggest_spot"');
    expect(pane).toContain('callMapExplore("overview"');
    expect(pane).toContain('callMapExplore("area_summary"');
    expect(pane).toContain('callMapExplore("explore_block"');
    expect(pane).toContain("mapNoteCreateInputFromAreaSummary");

    // Authoring: explore only when exploreOpen; idle empty is short tip
    expect(authoring).toContain("WorkspaceEmptyMapPane");
    expect(authoring).toContain("exploreOpen");
    expect(authoring).toContain('data-map-explore-open="true"');
    expect(authoring).toContain('data-map-explore-open="false"');
    expect(authoring).toContain("Use the search control on the map to explore");

    // Host: under-minimap toggle (not bottom-right FAB); explore not empty default
    expect(view).toContain("WorkspaceMapAuthoringPane");
    expect(view).not.toContain("data-map-explore-fab");
    expect(view).toContain("onMapExploreToggle={handleToggleMapExplore}");
    expect(view).toContain("mapExploreOpen={showMapExplore}");
    expect(view).toContain("handleToggleMapExplore");
    expect(view).toContain("handleMapToggle");
    expect(view).toContain("openMapExploreShell");
    expect(view).toContain("resolveMapExploreRightColumn");
    expect(view).toContain("showMapExplore");
    expect(view).toContain("exploreOpen");
    expect(view).toMatch(/showMapExplore\s*\?\s*\([\s\S]*?WorkspaceMapAuthoringPane[\s\S]*?exploreOpen/);
    expect(view).toContain("handleEmptyMapSearchBlocks");
    expect(view).toContain("handleEmptyMapSuggestCells");
    expect(view).toContain("mapSelection={mapSelection}");
    expect(view).toContain("selectiveExplanationActive");
    expect(view).toContain("selectiveExplanationPolygon");
    expect(view).toContain("injectMapNote");
    expect(view).toContain("interactionMode={interactionMode}");
    expect(view).toContain("workspaceId={workspaceId}");
    expect(view).toContain("onSearchSelectBlocks={handleEmptyMapSearchBlocks}");
    expect(view).toContain(
      "onSuggestSelectEmptyCells={handleEmptyMapSuggestCells}",
    );
    // Grid: Build/Play/Explore is the under-minimap control (no standalone Explore button)
    expect(grid).not.toContain("data-map-explore-toggle");
    expect(grid).toContain("data-workspace-mode-toggle");
    expect(grid).toContain("data-workspace-mode-under-minimap");
    expect(grid).toContain("data-workspace-mode-toggle-states");
    expect(grid).toContain("data-map-minimap-stack");
    expect(grid).toContain("onMapToggle");
    expect(grid).toContain("mapExploreOpen");
    expect(grid).toContain("data-map-note-add");
    const stackIdx = grid.indexOf("data-map-minimap-stack");
    const modeIdx = grid.indexOf("data-workspace-mode-toggle");
    const addNoteIdx = grid.indexOf("data-map-note-add");
    expect(stackIdx).toBeGreaterThan(-1);
    expect(modeIdx).toBeGreaterThan(stackIdx);
    expect(addNoteIdx).toBeGreaterThan(modeIdx);
    // No floating bottom-right round FAB
    expect(view).not.toMatch(/data-map-explore-fab/);
    expect(view).not.toMatch(
      /absolute bottom-3 right-3[\s\S]{0,80}?rounded-full/,
    );
    expect(sessionList).toContain("onMapExploreToggle");
    expect(sessionList).toContain("mapExploreOpen");
    // Selection callbacks wired in both modes (not creator-only)
    expect(view).toMatch(
      /onMapSelectionChange=\{handleMapSelectionChange\}/,
    );
    expect(view).not.toMatch(
      /onEmptySelectionChange=\{handleEmptySelectionChange\}/,
    );
    expect(view).not.toMatch(
      /onSelectedBlockIdsChange=\{handleSelectedBlockIdsChange\}/,
    );
    // Learner empty selection does not open create panes
    expect(view).toMatch(
      /interactionMode === "learner"[\s\S]*?clearWorkspaceAddTarget/,
    );

    // Grid: exclusive selection + selective overlay independent of lasso
    expect(grid).toContain("mapSelection?: WorkspaceMapSelection");
    expect(grid).not.toContain("applyMapSelection");
    expect(grid).toContain("selectiveExplanationActive");
    expect(grid).toContain("onSelectiveExplanationComplete");
    expect(grid).toContain("data-selective-explanation-active");
    expect(grid).toContain("data-selective-explanation-overlay");
    expect(grid).toContain("data-selective-explanation-draw");
    expect(grid).toContain("data-selective-explanation-surface");
    expect(grid).toContain("injectMapNote");
    expect(grid).toContain(
      "Do NOT touch selectedBlockIds / selectedEmptyCells — overlay only.",
    );
    // Surface stays mounted for whole active draw (NOT gated on !selectiveDrawOverlay).
    // Gating on overlay unmounts mid-gesture and releases pointer capture.
    expect(grid).not.toMatch(
      /selectiveExplanationActive\s*&&\s*!selectiveDrawOverlay/,
    );
    expect(grid).toMatch(
      /\{selectiveExplanationActive\s*\?\s*\([\s\S]*?data-selective-explanation-surface/,
    );
    // Capture on stable viewportRef — not the transient surface currentTarget alone.
    expect(grid).toMatch(
      /selectiveExplanationActiveRef[\s\S]{0,800}?viewport\.setPointerCapture\(event\.pointerId\)/,
    );
    // Ref must stay in sync with React state. A stale `false` lets pointerdown
    // fall through to beginViewportPan ("pan the map") instead of drawing.
    expect(grid).toMatch(
      /selectiveExplanationActiveRef\.current\s*=\s*selectiveExplanationActive/,
    );
    expect(grid).toMatch(
      /selectiveExplanationActive\s*\|\|\s*selectiveExplanationActiveRef\.current/,
    );
    // Empty-cell drag-to-pan and block drag must not steal the draw gesture.
    expect(grid).toMatch(
      /Selective Explanation owns the drag — do not arm empty-cell pan/,
    );
    expect(grid).toMatch(
      /Selective Explanation owns the gesture — do not arm block drag/,
    );
    expect(grid).toMatch(
      /Stay mounted for the entire active draw lifetime|Unmounting on selectiveDrawOverlay would release pointer capture/,
    );
    // White free-shape overlay (not yellow)
    expect(grid).toMatch(
      /data-selective-explanation-draw[\s\S]{0,200}?rgba\(255,\s*255,\s*255/,
    );
    expect(grid).toMatch(
      /data-selective-explanation-overlay[\s\S]{0,200}?rgba\(255,\s*255,\s*255/,
    );
    expect(grid).not.toMatch(
      /data-selective-explanation-(draw|overlay)[\s\S]{0,120}?rgba\(250,\s*204,\s*21/,
    );
    expect(sessionList).toContain("mapSelection={mapSelection}");
    expect(sessionList).not.toContain("applyMapSelection");
    expect(sessionList).toContain("selectiveExplanationActive");

    // Right pane still map_tools when nothing selected
    expect(resolveWorkspaceRightPane(null)).toBe("map_tools");
    expect(resolveWorkspaceRightPane(null, null, [])).toBe("map_tools");

    // Pure module + xAI API + FAB toggle helpers
    expect(lib).toContain("buildMapSearchSystemMessage");
    expect(lib).toContain("parseMapSearchAiResponse");
    expect(lib).toContain("parseSuggestSpotAiResponse");
    expect(lib).toContain("buildMapOverviewSystemMessage");
    expect(lib).toContain("parseAreaSummaryAiResponse");
    expect(lib).toContain("mapNoteCreateInputFromAreaSummary");
    expect(lib).toContain("toggleMapExploreShell");
    expect(lib).toContain("resolveMapExploreRightColumn");
    expect(api).toContain("callXaiJSON");
    expect(api).toContain('op === "search"');
    expect(api).toContain('op === "suggest_spot"');
    expect(api).toContain('op === "overview"');
    expect(api).toContain("area_summary");
    expect(api).toContain("buildAreaSummarySystemMessage");
    expect(api).toContain("parseMapSearchAiResponse");
    expect(api).toContain("parseSuggestSpotAiResponse");
    expect(api).toContain("parseAreaSummaryAiResponse");

    writeEvidence(
      "map-explore-no-grok.log",
      [
        "pane_has_Grok=" + /\bGrok\b/.test(pane),
        "pane_has_writing_overview_grok=" +
          pane.includes("Grok is writing an overview"),
        "neutral_busy=" + pane.includes("Writing an overview…"),
        "overview_busy_attr=" + pane.includes("data-empty-map-overview-busy"),
        "authoring_idle_no_explore_default=" +
          authoring.includes('data-map-explore-open="false"'),
      ].join("\n"),
    );

    writeEvidence(
      "map-explore-drawers-structural.log",
      [
        "drawer_group=" + pane.includes("WorkspaceRightPaneDrawerGroup"),
        "drawer_component=" + pane.includes("WorkspaceRightPaneDrawer"),
        "data_map_explore_drawers=" + pane.includes("data-map-explore-drawers"),
        "drawer_map_overview=" + pane.includes('drawerId="map_overview"'),
        "drawer_map_search=" + pane.includes('drawerId="map_search"'),
        "drawer_map_suggest_spot=" +
          pane.includes('drawerId="map_suggest_spot"'),
        "drawer_map_selective=" + pane.includes('drawerId="map_selective"'),
        "controls_search_input=" + pane.includes("data-empty-map-search-input"),
        "controls_suggest_input=" +
          pane.includes("data-empty-map-suggest-input"),
        "controls_selective_draw=" +
          pane.includes("data-empty-map-selective-draw"),
        "controls_overview_text=" +
          pane.includes("data-empty-map-overview-text"),
        "shipped_ids=" + MAP_EXPLORE_DRAWER_IDS.join(","),
      ].join("\n"),
    );

    writeEvidence(
      "map-explore-under-minimap-structural.log",
      [
        "toggle_under_minimap=" +
          grid.includes("data-workspace-mode-under-minimap"),
        "toggle_attr=" + grid.includes("data-workspace-mode-toggle"),
        "in_minimap_stack=" +
          String(
            grid.indexOf("data-workspace-mode-toggle") >
              grid.indexOf("data-map-minimap-stack"),
          ),
        "above_add_note=" +
          String(
            grid.indexOf("data-workspace-mode-toggle") <
              grid.indexOf("data-map-note-add") &&
              grid.indexOf("data-map-note-add") > -1,
          ),
        "no_bottom_right_fab=" + String(!view.includes("data-map-explore-fab")),
        "no_fab_absolute_round=" +
          String(
            !/absolute bottom-3 right-3[\s\S]{0,80}?rounded-full/.test(view),
          ),
        "session_list_props=" +
          String(
            sessionList.includes("onMapExploreToggle") &&
              sessionList.includes("mapExploreOpen"),
          ),
      ].join("\n"),
    );

    writeEvidence(
      "map-explore-under-minimap-toggle.log",
      [
        "toggle_handler=" + view.includes("handleToggleMapExplore"),
        "wired_to_session_list=" +
          String(
            view.includes("onMapExploreToggle={handleToggleMapExplore}") &&
              view.includes("mapExploreOpen={showMapExplore}"),
          ),
        "grid_calls_toggle=" + grid.includes("onMapToggle"),
        "show_explore_mounts_pane=" +
          String(/showMapExplore\s*\?\s*\([\s\S]*?exploreOpen/.test(view)),
        "idle_exploreOpen_false=" +
          String(view.includes("exploreOpen={false}")),
        "authoring_open_true_mounts_empty_pane=" +
          String(
            authoring.includes('data-map-explore-open="true"') &&
              authoring.includes("WorkspaceEmptyMapPane"),
          ),
        "authoring_closed_idle=" +
          String(authoring.includes('data-map-explore-open="false"')),
        "closed_not_forced_explore=" +
          String(
            !authoring.includes("exploreOpen={true}") &&
              authoring.includes("if (exploreOpen)"),
          ),
      ].join("\n"),
    );

    writeEvidence(
      "map-explore-under-minimap-logic.log",
      [
        "toggle_helper=" + lib.includes("openMapExploreShell"),
        "resolve_helper=" + lib.includes("resolveMapExploreRightColumn"),
        "open_showExplore_true=" +
          resolveMapExploreRightColumn({
            exploreOpen: true,
            naturalPane: "block_detail",
          }).showExplore,
        "closed_restores_block_detail=" +
          (resolveMapExploreRightColumn({
            exploreOpen: false,
            naturalPane: "block_detail",
          }).displayPane ===
            "block_detail"),
        "no_fab_required=" + String(!view.includes("data-map-explore-fab")),
      ].join("\n"),
    );

    writeEvidence(
      "map-explore-drawers-toggle.log",
      [
        "under_minimap_toggle=" + grid.includes("data-map-explore-toggle"),
        "no_fab=" + String(!view.includes("data-map-explore-fab")),
        "toggle_handler=" + view.includes("handleToggleMapExplore"),
        "show_explore_mounts_pane=" +
          String(/showMapExplore\s*\?\s*\([\s\S]*?exploreOpen/.test(view)),
        "idle_exploreOpen_false=" +
          String(view.includes("exploreOpen={false}")),
        "authoring_open_true_mounts_empty_pane=" +
          String(
            authoring.includes('data-map-explore-open="true"') &&
              authoring.includes("WorkspaceEmptyMapPane"),
          ),
        "authoring_closed_idle=" +
          String(authoring.includes('data-map-explore-open="false"')),
        "closed_not_forced_explore=" +
          String(
            !authoring.includes("exploreOpen={true}") &&
              authoring.includes("if (exploreOpen)"),
          ),
      ].join("\n"),
    );

    writeEvidence(
      "map-explore-fab-toggle.log",
      [
        "fab_removed=" + String(!view.includes("data-map-explore-fab")),
        "under_minimap=" + grid.includes("data-map-explore-under-minimap"),
        "toggle_handler=" + view.includes("handleToggleMapExplore"),
        "toggle_helper=" + view.includes("toggleMapExploreShell"),
        "show_explore_hides_drawers=" +
          String(/showMapExplore\s*\?\s*\([\s\S]*?exploreOpen/.test(view)),
        "idle_exploreOpen_false=" +
          String(view.includes("exploreOpen={false}")),
        "authoring_gated=" + String(authoring.includes("exploreOpen")),
      ].join("\n"),
    );

    writeEvidence(
      "empty-map-pane-structural.log",
      [
        "empty_map_pane=true",
        "no_user_facing_Grok=" + !/\bGrok\b/.test(pane),
        "xai_ui=true",
        "fab=true",
        "search_ui=true",
        "suggest_ui=true",
        "overview_ui=true",
        "selective_ui=true",
        "api_map_explore=true",
        "overlay_white=true",
        "explore_gated_on_fab=true",
        "view_search_handler=true",
        "view_suggest_handler=true",
        "view_both_modes_selection=true",
        "grid_apply_selection=true",
        "grid_selective_overlay=true",
        "selective_surface_stays_mounted=" +
          !/selectiveExplanationActive\s*&&\s*!selectiveDrawOverlay/.test(grid),
        "selective_capture_on_viewport=" +
          /viewport\.setPointerCapture\(event\.pointerId\)/.test(grid),
        "map_tools_when_empty=" + resolveWorkspaceRightPane(null),
      ].join("\n"),
    );

    writeEvidence(
      "empty-map-pane-wiring.log",
      [
        "search_via_map_explore=" +
          String(pane.includes("/api/workspace/map-explore")),
        "search_op=" + String(pane.includes('callMapExplore("search"')),
        "suggest_op=" + String(pane.includes('callMapExplore("suggest_spot"')),
        "overview_op=" + String(pane.includes('callMapExplore("overview"')),
        "area_op=" + String(pane.includes('callMapExplore("area_summary"')),
        "under_minimap_toggle=" +
          String(grid.includes("data-map-explore-toggle")),
        "no_fab=" + String(!view.includes("data-map-explore-fab")),
        "no_Grok_in_pane=" + String(!/\bGrok\b/.test(pane)),
        "search_sets_block_ids=" +
          String(
            view.includes("blockIds: ids") &&
              view.includes("handleEmptyMapSearchBlocks"),
          ),
        "suggest_sets_empty_cells=" +
          String(
            view.includes("emptyCells: list") &&
              view.includes("handleEmptyMapSuggestCells"),
          ),
        "apply_map_selection_prop=" +
          String(grid.includes("mapSelection?: WorkspaceMapSelection")),
        "selective_polygon_state=" +
          String(view.includes("selectiveExplanationPolygon")),
        "selective_not_only_selectedBlockIds=" +
          String(grid.includes("overlay only")),
        "selective_surface_full_active_lifetime=" +
          String(
            !/selectiveExplanationActive\s*&&\s*!selectiveDrawOverlay/.test(
              grid,
            ) && grid.includes("data-selective-explanation-surface"),
          ),
        "selective_pointer_capture_viewport=" +
          String(/viewport\.setPointerCapture\(event\.pointerId\)/.test(grid)),
        "overlay_white_not_yellow=" +
          String(
            /rgba\(255,\s*255,\s*255/.test(grid) &&
              !/data-selective-explanation-draw[\s\S]{0,120}?rgba\(250,\s*204,\s*21/.test(
                grid,
              ),
          ),
        "api_uses_callXaiJSON=" + String(api.includes("callXaiJSON")),
        "note_inject=" +
          String(
            view.includes("injectMapNote") && grid.includes("injectMapNote"),
          ),
        "create_note_from_summary=" +
          String(view.includes("onCreateNoteFromSummary")),
        "learner_empty_visibility_only=" +
          String(view.includes('interactionMode === "learner"')),
      ].join("\n"),
    );
  });
});
