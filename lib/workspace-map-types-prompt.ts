/**
 * Generator prompt fill for workspace map types. Spawn / blocked / order
 * text is topology context, not a 1:1 template. Session-plan create and
 * Generate Map consume formatMapTypeGeneratorContext.
 */

import { SPATIAL_MAP_LAYOUT_RULES } from "@/lib/initial-chapters";
import { getCellKey } from "@/lib/block-skill-grid";
import { nextFreeChapterCell } from "@/lib/learn-chapter-blocked";
import {
  cellsWithMark,
  normalizeMapTypeOrderSteps,
  type MapTypeBand,
  type WorkspaceMapTypeRecord,
  type WorkspaceMapTypeSource,
} from "@/lib/workspace-map-types-persist";

export type MapTypeGeneratorContext = {
  id: string;
  label: string;
  source: WorkspaceMapTypeSource;
  band: MapTypeBand;
  layoutInstruction: string;
  spawnInstruction: string;
  noSpawnInstruction: string;
  blockedInstruction: string;
  dagHintInstruction: string;
  orderInstruction: string;
  topologyInstruction: string;
  spatialInstruction: string;
  /** Joined prompt fill for `{initial_chapters_instruction}`. */
  countInstruction: string;
};

function formatCellList(cells: Array<{ row: number; col: number }>): string {
  return cells
    .map((cell) => `(position_x=${cell.col}, position_y=${cell.row})`)
    .join(", ");
}

export function chebyshevDist(
  a: { row: number; col: number },
  b: { row: number; col: number },
): number {
  return Math.max(Math.abs(a.row - b.row), Math.abs(a.col - b.col));
}

export function mapTypeUsesShapedTopology(
  record: Pick<WorkspaceMapTypeRecord, "topologyMode" | "source" | "cells">,
): boolean {
  if (record.topologyMode === "scatter") return false;
  return cellsWithMark(record, "spawn").length > 0;
}

export function schematicStartCell(
  spawn: Array<{ row: number; col: number }>,
): { row: number; col: number } {
  if (spawn.length === 0) return { row: 0, col: 0 };
  const origin = spawn.find((c) => c.row === 0 && c.col === 0);
  if (origin) return origin;
  const cr = spawn.reduce((s, c) => s + c.row, 0) / spawn.length;
  const cc = spawn.reduce((s, c) => s + c.col, 0) / spawn.length;
  let best = spawn[0]!;
  let bestD = Infinity;
  for (const cell of spawn) {
    const d = (cell.row - cr) ** 2 + (cell.col - cc) ** 2;
    if (d < bestD) {
      bestD = d;
      best = cell;
    }
  }
  return best;
}

export function mapTypeSkeletonFrame(
  record: Pick<WorkspaceMapTypeRecord, "cells" | "orderSteps">,
  pad = 2,
): { minRow: number; maxRow: number; minCol: number; maxCol: number } | null {
  const skeleton = [
    ...cellsWithMark(record, "spawn"),
    ...cellsWithMark(record, "blocked"),
    ...(record.orderSteps || []).flatMap((s) => s.cells),
  ];
  if (skeleton.length === 0) return null;
  let minRow = skeleton[0]!.row;
  let maxRow = skeleton[0]!.row;
  let minCol = skeleton[0]!.col;
  let maxCol = skeleton[0]!.col;
  for (const cell of skeleton) {
    if (cell.row < minRow) minRow = cell.row;
    if (cell.row > maxRow) maxRow = cell.row;
    if (cell.col < minCol) minCol = cell.col;
    if (cell.col > maxCol) maxCol = cell.col;
  }
  return {
    minRow: minRow - pad,
    maxRow: maxRow + pad,
    minCol: minCol - pad,
    maxCol: maxCol + pad,
  };
}

export type MapTypeResemblance = {
  total: number;
  nearSkeleton: number;
  /** 0–1 fraction of generated cells within Chebyshev 1 of a spawn cell. */
  score: number;
};

/** How closely generated occupancy matches the painted spawn skeleton. */
export function mapTypeTopologyResemblance(
  generated: Array<{ row: number; col: number }>,
  record: Pick<WorkspaceMapTypeRecord, "cells">,
): MapTypeResemblance {
  const spawn = cellsWithMark(record, "spawn");
  const points = generated.filter(
    (c) => Number.isFinite(c.row) && Number.isFinite(c.col),
  );
  if (points.length === 0) return { total: 0, nearSkeleton: 0, score: 0 };
  if (spawn.length === 0) return { total: points.length, nearSkeleton: 0, score: 0 };
  let near = 0;
  for (const p of points) {
    if (spawn.some((s) => chebyshevDist(p, s) <= 1)) near += 1;
  }
  return {
    total: points.length,
    nearSkeleton: near,
    score: near / points.length,
  };
}

type GridPos = { position_x?: number | null; position_y?: number | null };

/**
 * Pull far-away generated tiles back into the schematic frame (pad 2 around
 * spawn/blocked). Does not snap onto spawn cells 1:1 — only stops distant scatter.
 */
export function clampPositionsToMapTypeFrame<T extends GridPos>(
  items: readonly T[],
  record: WorkspaceMapTypeRecord,
): T[] {
  if (!mapTypeUsesShapedTopology(record)) return [...items];
  const frame = mapTypeSkeletonFrame(record, 2);
  const spawn = cellsWithMark(record, "spawn");
  const blocked = cellsWithMark(record, "blocked");
  if (!frame || spawn.length === 0) return [...items];
  const occupied = new Set<string>();
  const next = items.map((item) => ({ ...item }));
  for (let i = 0; i < next.length; i += 1) {
    const item = next[i];
    if (typeof item.position_x !== "number" || typeof item.position_y !== "number") {
      continue;
    }
    let col = Math.min(frame.maxCol, Math.max(frame.minCol, item.position_x));
    let row = Math.min(frame.maxRow, Math.max(frame.minRow, item.position_y));
    const key = getCellKey(row, col);
    const blockedHit = blocked.some((b) => b.row === row && b.col === col);
    if (occupied.has(key) || blockedHit) {
      const free = nextFreeChapterCell({
        occupied,
        blocked,
        from: { row, col },
      });
      row = Math.min(frame.maxRow, Math.max(frame.minRow, free.row));
      col = Math.min(frame.maxCol, Math.max(frame.minCol, free.col));
    }
    next[i] = { ...item, position_x: col, position_y: row };
    occupied.add(getCellKey(row, col));
  }
  return next;
}

export const MAP_TYPE_SHAPED_SPATIAL_RULES = `MAP TYPE TOPOLOGY (critical — this SUPERSEDES generic four-quadrant scatter / "start at (0,0)" rules when they conflict):
- Follow the painted skeleton of this map type. The generated occupancy must be recognizable as this shape (~80% resemblance): hub stays a hub, islands stay clusters, a ring stays a ring.
- Use the schematic coordinates as given (do not translate the whole pattern so the hub sits at the origin unless the schematic hub IS the origin).
- At least 80% of chapters MUST occupy a SPAWN cell or a cell within Chebyshev distance 1 of a SPAWN cell.
- No chapter may sit more than Chebyshev distance 2 from the nearest SPAWN cell. Do not send arms into distant quadrants or large negative coordinates.
- Stay inside the schematic bounding box expanded by 1 cell.
- Unique integer (position_x, position_y). Never two chapters on the same cell.
- Adjacent cells (Chebyshev 1) should be related or natural progressions.
- Branching is allowed only along the skeleton (spokes of a hub, rungs of a ladder, island clusters, ring arcs).`;

/**
 * Single generator-context formatter for built-in and custom map types.
 * Spawn / no-spawn / blocked / DAG-hint text is topology context, not a
 * tile-for-tile template. Used by session-plan create.
 */
export function formatMapTypeGeneratorContext(
  record: WorkspaceMapTypeRecord,
): MapTypeGeneratorContext {
  const spawn = cellsWithMark(record, "spawn");
  const blocked = cellsWithMark(record, "blocked");
  const orderSteps = normalizeMapTypeOrderSteps(
    record.orderSteps,
    record.orderStepCount ?? 0,
  );
  const layoutInstruction = String(record.layoutInstruction || "").trim();
  const shaped = mapTypeUsesShapedTopology(record);
  const start = schematicStartCell(spawn);
  const frame = mapTypeSkeletonFrame(record, 1);
  const topologyInstruction = shaped
    ? [
        `TOPOLOGY FIDELITY (~80% resemblance, not a 1:1 copy): the generated map MUST look like "${record.label}".`,
        `FOUNDATION CELL: place the start / foundation chapter at (position_x=${start.col}, position_y=${start.row}). Do not use (0, 0) unless that is this cell.`,
        frame
          ? `KEEP INSIDE FRAME: all chapters must stay within position_x=${frame.minCol}..${frame.maxCol}, position_y=${frame.minRow}..${frame.maxRow}.`
          : "",
        "Do not scatter far from the skeleton even if generic spatial rules mention four quadrants or negative coordinates.",
      ]
        .filter(Boolean)
        .join(" ")
    : "";
  const spawnInstruction =
    spawn.length > 0
      ? shaped
        ? `SPAWN SKELETON (intended occupancy — place ~80% of chapters on or Chebyshev-adjacent to these cells): ${formatCellList(spawn)}.`
        : `SPAWN CELLS (preferred chapter locations — hints, not a 1:1 template): ${formatCellList(spawn)}.`
      : "";
  const noSpawnInstruction = "";
  const blockedInstruction =
    blocked.length > 0
      ? `BLOCKED CHAPTER SLOTS (non-placeable ground): do not place any chapter or block on these cells: ${formatCellList(blocked)}. Persist them as blocked/unusable so corridors stay empty for later bridges.`
      : "";
  const paintedOrder = orderSteps.filter((s) => s.cells.length > 0);
  const orderInstruction =
    paintedOrder.length > 0
      ? [
          "ORDER STEPS (recommended DAG / practice sequence — loose follow, not a 1:1 copy):",
          "Earlier numbered areas should generally precede later ones. Chapters in area k should lock until work in area k-1 is done when they sit downstream.",
          "Emit lock_until_orders (prerequisite chapter `order` numbers) and next_orders on each chapter so the map has DAG-like requirements.",
          ...paintedOrder.map(
            (s) => `Area ${s.step}: ${formatCellList(s.cells)}.`,
          ),
        ].join(" ")
      : "";
  const dagHintInstruction = orderInstruction;
  const spatialInstruction = shaped
    ? MAP_TYPE_SHAPED_SPATIAL_RULES
    : SPATIAL_MAP_LAYOUT_RULES;
  const countInstruction = [
    `Generate about ${record.band.target} initial chapters/blocks (acceptable range ${record.band.min}-${record.band.max}). Initial chapters level is "${record.id}" — ${record.label} (${record.band.audience}).`,
    layoutInstruction,
    topologyInstruction,
    spawnInstruction,
    noSpawnInstruction,
    blockedInstruction,
    orderInstruction,
  ]
    .filter(Boolean)
    .join("\n");
  return {
    id: record.id,
    label: record.label,
    source: record.source,
    band: record.band,
    layoutInstruction,
    spawnInstruction,
    noSpawnInstruction,
    blockedInstruction,
    dagHintInstruction,
    orderInstruction,
    topologyInstruction,
    spatialInstruction,
    countInstruction,
  };
}
