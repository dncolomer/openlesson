/**
 * Fog of war on workspace / ILE maps: drive the shipped visibility transform,
 * build-gate, extra-reveal, live-drag occupancy, and suggest-best-spot bypass.
 */
import { describe, expect, it } from "vitest";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { getCellKey, getVisibleGridCells } from "@/lib/block-skill-grid";
import { suggestEmptySpotsForTopic } from "@/lib/empty-map-pane";
import {
  canBuildOnFogVisibleEmpty,
  createMapFogLookup,
  MAP_FOG_EMPTY_ORIGIN,
  occupiedConcentrationAt,
  occupiedFogRadius,
  resolveFogOccupiedKeys,
  type MapFogLookup,
} from "@/lib/map-fog-of-war";
import {
  readMapGridSurface,
  readWorkspaceViewSurface,
} from "../helpers/surface-source";

const ROOT = join(__dirname, "../..");
const SCRATCH =
  process.env.GROK_GOAL_SCRATCH ||
  "/var/folders/kd/98qlvkyd4mb3_9t32p9bmt_r0000gn/T/grok-goal-f09ec4435deb/implementer";

function read(rel: string) {
  const path = join(ROOT, rel);
  expect(existsSync(path), `missing ${rel}`).toBe(true);
  return readFileSync(path, "utf8");
}

function writeScratch(name: string, body: string) {
  mkdirSync(SCRATCH, { recursive: true });
  writeFileSync(join(SCRATCH, name), body, "utf8");
}

function occupancyFromCells(
  cells: Array<{ row: number; col: number; id?: string }>,
): Map<string, string> {
  const occupancy = new Map<string, string>();
  for (const c of cells) {
    occupancy.set(getCellKey(c.row, c.col), c.id || `b-${c.row}-${c.col}`);
  }
  return occupancy;
}

function countFullyVisibleEmpties(
  lookup: MapFogLookup,
  occupied: ReadonlySet<string>,
  min: number,
  max: number,
): number {
  let n = 0;
  for (let row = min; row <= max; row++) {
    for (let col = min; col <= max; col++) {
      if (occupied.has(getCellKey(row, col))) continue;
      if (lookup(row, col).fullyVisible) n += 1;
    }
  }
  return n;
}

function sampleRow(
  label: string,
  lookup: MapFogLookup,
  row: number,
  col: number,
) {
  const v = lookup(row, col);
  return `${label}\t(${row},${col})\topacity=${v.opacity}\tfullyVisible=${v.fullyVisible}\tbuild=${canBuildOnFogVisibleEmpty(v)}`;
}

describe("map fog-of-war visibility transform", () => {
  it("isolates vs cluster: far hidden, adjacent shown, fade in between, cluster larger", () => {
    const isolatedOcc = occupancyFromCells([{ row: 0, col: 0, id: "solo" }]);
    const clusterCells: Array<{ row: number; col: number }> = [];
    for (let r = -1; r <= 1; r++) {
      for (let c = -1; c <= 1; c++) {
        clusterCells.push({ row: r, col: c });
      }
    }
    const clusterOcc = occupancyFromCells(clusterCells);

    const isolated = createMapFogLookup({ occupancy: isolatedOcc });
    const clustered = createMapFogLookup({ occupancy: clusterOcc });

    const isolatedOccupied = new Set(isolatedOcc.keys());
    const clusterOccupied = new Set(clusterOcc.keys());

    expect(isolated(0, 0).fullyVisible).toBe(true);
    expect(isolated(0, 0).opacity).toBe(1);
    expect(clustered(0, 0).fullyVisible).toBe(true);

    const adjacent = isolated(0, 1);
    expect(adjacent.fullyVisible).toBe(true);
    expect(adjacent.opacity).toBe(1);

    const far = isolated(0, 20);
    expect(far.fullyVisible).toBe(false);
    expect(far.opacity).toBe(0);

    let fade:
      | { row: number; col: number; opacity: number }
      | null = null;
    for (let col = 1; col <= 12; col++) {
      const v = isolated(0, col);
      if (v.opacity > 0 && v.opacity < 1 && !v.fullyVisible) {
        fade = { row: 0, col, opacity: v.opacity };
        break;
      }
    }
    expect(fade).not.toBeNull();
    expect(fade!.opacity).toBeGreaterThan(0);
    expect(fade!.opacity).toBeLessThan(1);

    const isolatedCount = countFullyVisibleEmpties(
      isolated,
      isolatedOccupied,
      -12,
      12,
    );
    const clusterCount = countFullyVisibleEmpties(
      clustered,
      clusterOccupied,
      -12,
      12,
    );
    expect(clusterCount).toBeGreaterThan(isolatedCount);

    const isolatedConc = occupiedConcentrationAt(0, 0, isolatedOccupied);
    const clusterConc = occupiedConcentrationAt(0, 0, clusterOccupied);
    expect(occupiedFogRadius(clusterConc)).toBeGreaterThan(
      occupiedFogRadius(isolatedConc),
    );

    const lines = [
      "isolated_occupied=" + isolated(0, 0).opacity,
      "isolated_adjacent=" + adjacent.opacity,
      "isolated_far=" + far.opacity,
      "isolated_fade_cell=" + `${fade!.row},${fade!.col}`,
      "isolated_fade_opacity=" + fade!.opacity,
      "isolated_fully_visible_empties=" + isolatedCount,
      "cluster_fully_visible_empties=" + clusterCount,
      "isolated_radius=" + occupiedFogRadius(isolatedConc),
      "cluster_radius=" + occupiedFogRadius(clusterConc),
      sampleRow("occupied", isolated, 0, 0),
      sampleRow("adjacent", isolated, 0, 1),
      sampleRow("fade", isolated, fade!.row, fade!.col),
      sampleRow("far", isolated, 0, 20),
      sampleRow("cluster_adjacent", clustered, -1, 2),
    ];
    writeScratch("fog-visibility-sample.log", lines.join("\n") + "\n");
  });

  it("blank map pretends (0,0) is occupied for fog only; cell stays empty/placeable", () => {
    const emptyOcc = new Map<string, string>();
    const lookup = createMapFogLookup({ occupancy: emptyOcc });
    const fromKeys = createMapFogLookup({ occupiedKeys: [] });

    expect(resolveFogOccupiedKeys({ occupancy: emptyOcc }).size).toBe(0);
    expect(emptyOcc.has("0:0")).toBe(false);

    const origin = lookup(
      MAP_FOG_EMPTY_ORIGIN.row,
      MAP_FOG_EMPTY_ORIGIN.col,
    );
    expect(origin.fullyVisible).toBe(true);
    expect(origin.opacity).toBe(1);
    expect(canBuildOnFogVisibleEmpty(origin)).toBe(true);

    const adjacent = lookup(0, 1);
    expect(adjacent.fullyVisible).toBe(true);
    expect(canBuildOnFogVisibleEmpty(adjacent)).toBe(true);

    const far = lookup(0, 20);
    expect(far.fullyVisible).toBe(false);
    expect(far.opacity).toBe(0);
    expect(canBuildOnFogVisibleEmpty(far)).toBe(false);

    expect(fromKeys(0, 0).fullyVisible).toBe(true);
    expect(fromKeys(0, 20).opacity).toBe(0);

    let fade: { opacity: number } | null = null;
    for (let col = 1; col <= 12; col++) {
      const v = lookup(0, col);
      if (v.opacity > 0 && v.opacity < 1 && !v.fullyVisible) {
        fade = { opacity: v.opacity };
        break;
      }
    }
    expect(fade).not.toBeNull();

    writeScratch(
      "fog-empty-origin.log",
      [
        "real_occupancy_has_origin=" + emptyOcc.has("0:0"),
        "resolved_keys=" + resolveFogOccupiedKeys({ occupancy: emptyOcc }).size,
        "origin_fullyVisible=" + origin.fullyVisible,
        "origin_build=" + canBuildOnFogVisibleEmpty(origin),
        "adjacent_fullyVisible=" + adjacent.fullyVisible,
        "far_opacity=" + far.opacity,
        "far_build=" + canBuildOnFogVisibleEmpty(far),
        "fade_opacity=" + fade!.opacity,
      ].join("\n") + "\n",
    );
  });
});

describe("map fog-of-war build gate", () => {
  it("allows build only on fully visible empties", () => {
    const occupancy = occupancyFromCells([{ row: 0, col: 0, id: "a" }]);
    const lookup = createMapFogLookup({ occupancy });

    const full = lookup(0, 1);
    const far = lookup(8, 8);
    let fadeVis = lookup(0, 1);
    for (let col = 1; col <= 12; col++) {
      const v = lookup(0, col);
      if (v.opacity > 0 && v.opacity < 1) {
        fadeVis = v;
        break;
      }
    }

    expect(canBuildOnFogVisibleEmpty(full)).toBe(true);
    expect(canBuildOnFogVisibleEmpty(fadeVis)).toBe(false);
    expect(canBuildOnFogVisibleEmpty(far)).toBe(false);
    expect(canBuildOnFogVisibleEmpty(null)).toBe(false);

    writeScratch(
      "fog-build-gate.log",
      [
        "full_visible_build=" + canBuildOnFogVisibleEmpty(full),
        "fade_build=" + canBuildOnFogVisibleEmpty(fadeVis),
        "far_build=" + canBuildOnFogVisibleEmpty(far),
        "full_opacity=" + full.opacity,
        "fade_opacity=" + fadeVis.opacity,
        "far_opacity=" + far.opacity,
      ].join("\n") + "\n",
    );
  });
});

describe("map fog-of-war extra-reveal and live drag", () => {
  it("suggest hits extra-reveal far empties; drag illuminates destination not origin-only", () => {
    const occupancy = occupancyFromCells([{ row: 0, col: 0, id: "a" }]);
    const occupancyOnly = createMapFogLookup({ occupancy });
    const hidden = occupancyOnly(12, 0);
    expect(hidden.fullyVisible).toBe(false);
    expect(hidden.opacity).toBe(0);

    const revealed = createMapFogLookup({
      occupancy,
      extraRevealCells: [{ row: 12, col: 0 }],
    });
    expect(revealed(12, 0).fullyVisible).toBe(true);
    expect(revealed(12, 0).opacity).toBe(1);
    expect(revealed(12, 1).fullyVisible).toBe(false);

    const originNeighbor = occupancyOnly(0, 1);
    expect(originNeighbor.fullyVisible).toBe(true);

    const dragged = createMapFogLookup({
      occupancy,
      dragBlockIds: ["a"],
      dragOffset: { dRow: 0, dCol: 10 },
    });
    expect(dragged(0, 1).fullyVisible).toBe(false);
    expect(dragged(0, 11).fullyVisible).toBe(true);
    expect(dragged(0, 10).fullyVisible).toBe(true);

    const liveKeys = resolveFogOccupiedKeys({
      occupancy,
      dragBlockIds: ["a"],
      dragOffset: { dRow: 0, dCol: 10 },
    });
    expect(liveKeys.has("0:0")).toBe(false);
    expect(liveKeys.has("0:10")).toBe(true);

    const spots = suggestEmptySpotsForTopic({
      blocks: [
        {
          id: "a",
          title: "Quadratic formula",
          description: "Solve ax^2+bx+c=0",
          position_x: 0,
          position_y: 0,
          span_w: 1,
          span_h: 1,
        },
      ],
      topic: "best spot for quadratic",
      occupiedKeys: [...occupancy.keys()],
      limit: 8,
    });
    expect(spots.length).toBeGreaterThan(0);
    const foggedHit = spots.find((c) => !occupancyOnly(c.row, c.col).fullyVisible);
    expect(foggedHit).toBeTruthy();
    const bypass = createMapFogLookup({
      occupancy,
      extraRevealCells: spots,
    });
    expect(bypass(foggedHit!.row, foggedHit!.col).fullyVisible).toBe(true);

    writeScratch(
      "fog-bypass.log",
      [
        "occupancy_only_far_opacity=" + hidden.opacity,
        "extra_reveal_far_fullyVisible=" + revealed(12, 0).fullyVisible,
        "origin_neighbor_before_drag=" + originNeighbor.fullyVisible,
        "origin_neighbor_after_drag=" + dragged(0, 1).fullyVisible,
        "dest_neighbor_after_drag=" + dragged(0, 11).fullyVisible,
        "live_keys=" + [...liveKeys].sort().join(","),
        "suggest_count=" + spots.length,
        "suggest_fogged_hit=" +
          (foggedHit ? `${foggedHit.row},${foggedHit.col}` : "none"),
        "suggest_hit_occupancy_only=" +
          (foggedHit
            ? occupancyOnly(foggedHit.row, foggedHit.col).fullyVisible
            : "n/a"),
        "suggest_hit_extra_reveal=" +
          (foggedHit
            ? bypass(foggedHit.row, foggedHit.col).fullyVisible
            : "n/a"),
      ].join("\n") + "\n",
    );
  });
});

describe("map fog-of-war wiring (workspace + ILE, overlay only)", () => {
  it("empty-cell chrome, build-gate, extra-reveal, drag, and hosts share the grid", () => {
    const world = read("components/block-skill-grid/map-world-layer.tsx");
    const grid = readMapGridSurface();
    const authoring = read("components/block-skill-grid/use-map-authoring.ts");
    const viewport = read("components/block-skill-grid/use-map-viewport.ts");
    const chapter = read("components/ChapterMapPanel.tsx");
    const sessionList = read("components/SessionList.tsx");
    const workspace = readWorkspaceViewSurface();
    const emptyPane = read("lib/empty-map-pane.ts");
    const host = read("components/BlockSkillGrid.tsx");
    const fogLib = read("lib/map-fog-of-war.ts");

    expect(fogLib).toContain("MAP_FOG_EMPTY_ORIGIN");
    expect(fogLib).toContain("occupied.size === 0");
    expect(host).toContain("createMapFogLookup");
    expect(host).toContain("extraRevealCells");
    expect(host).toContain("dragBlockIds: blockDragIds");
    expect(host).toContain("dragOffset: blockDragOffset");
    expect(host).toContain("selectedEmptyCells");
    expect(world).toContain("fogLookup");
    expect(world).toContain("data-map-fog-fully-visible");
    expect(world).toContain("data-map-fog-veil");
    expect(world).toContain("data-map-fog-opacity");
    expect(world).toContain("style={{ opacity: fog.opacity }}");
    expect(authoring).toContain("canBuildOnFogVisibleEmpty");
    expect(authoring).toContain("mapExploreOpen");
    expect(grid).toContain("handleEmptyCellPointerDown");
    expect(emptyPane).toContain("createMapFogLookup");
    expect(emptyPane).toContain("suggestEmptySpotsForTopic");

    expect(viewport).toContain("getVisibleGridCells(");
    expect(grid).toContain("buildSkillGridLayout");
    expect(chapter).toContain("BlockSkillGrid");
    expect(chapter).toContain('suggestMode="chapter"');
    expect(sessionList).toContain("BlockSkillGrid");
    expect(sessionList).toContain("learnerMode={learnerMode}");
    expect(sessionList).toContain("mapExploreOpen={mapExploreOpen}");
    expect(workspace).toContain("<SessionList");

    const exploreIdx = authoring.indexOf("if (mapExploreOpen) {");
    const fogGateIdx = authoring.indexOf(
      "!canBuildOnFogVisibleEmpty(fogLookup(cell.row, cell.col))",
    );
    expect(exploreIdx).toBeGreaterThan(0);
    expect(fogGateIdx).toBeGreaterThan(exploreIdx);

    const cells = getVisibleGridCells(400, 300, 0, 0, 1, 1);
    expect(cells.length).toBeGreaterThan(10);

    writeScratch(
      "fog-wiring-structural.log",
      [
        "world_fogLookup=" + world.includes("fogLookup"),
        "world_opacity=" + world.includes("fog.opacity"),
        "authoring_gate=" + authoring.includes("canBuildOnFogVisibleEmpty"),
        "host_drag=" + host.includes("dragOffset: blockDragOffset"),
        "host_extra=" + host.includes("extraRevealCells"),
        "chapter_grid=" + chapter.includes("BlockSkillGrid"),
        "session_explore=" + sessionList.includes("mapExploreOpen={mapExploreOpen}"),
        "session_play=" + sessionList.includes("learnerMode={learnerMode}"),
        "viewport_cells=" + viewport.includes("getVisibleGridCells("),
        "visible_cell_count=" + cells.length,
      ].join("\n") + "\n",
    );
  });
});
