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
  collectPlaceableEmptyNearSeeds,
  createMapNoteFromAreaSummary,
  isMapExploreDrawerId,
  isSelectivePolygonReady,
  MAP_EXPLORE_DEFAULT_OPEN_DRAWER,
  MAP_EXPLORE_DRAWER_IDS,
  mapNoteCreateInputFromAreaSummary,
  normalizeEmptySpotTopic,
  normalizeMapSearchQuery,
  parseAreaSummaryAiResponse,
  parseMapSearchAiResponse,
  parseOverviewAiResponse,
  parseSuggestSpotAiResponse,
  searchMapBlocksByTopic,
  suggestEmptySpotsForTopic,
  summarizeSelectiveArea,
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

describe("map explore drawers", () => {
  it("keeps overview, search, suggest, and selective; the explore shell is gone", () => {
    expect([...MAP_EXPLORE_DRAWER_IDS]).toEqual([
      "map_overview",
      "map_search",
      "map_suggest_spot",
      "map_selective",
    ]);
    expect(MAP_EXPLORE_DEFAULT_OPEN_DRAWER).toBe("map_search");
    expect(isMapExploreDrawerId("map_search")).toBe(true);
    expect(isMapExploreDrawerId("map_explore_block")).toBe(false);
    expect(isMapExploreDrawerId("nope")).toBe(false);
    const lib = read("lib/empty-map-pane.ts");
    expect(lib).not.toContain("createMapExploreShellState");
    expect(lib).not.toContain("openMapExploreShell");
    expect(lib).not.toContain("toggleMapExploreShell");
    expect(lib).not.toContain("resolveMapExploreRightColumn");
    expect(resolveWorkspaceRightPane(null)).toBe("map_tools");
  });
});
