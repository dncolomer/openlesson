/**
 * Pure Generate Map planner. Translates a default map type's spawn skeleton
 * so its foundation cell sits on the selected empty cell. Placements are the
 * highlight and the cells a later Generate click will fill. Does not call a
 * model or write blocks.
 */

import { composeBlockGenerationContext } from "@/lib/workspace-create-modes";
import { getCellKey } from "@/lib/block-skill-grid";
import {
  blockedCellsFromMapType,
  cellsWithMark,
  clampPositionsToMapTypeFrame,
  formatMapTypeGeneratorContext,
  resolveMapTypeRecord,
  schematicStartCell,
} from "@/lib/workspace-map-types";

export interface GenerateMapAnchor {
  /** Grid row (position_y). */
  row: number;
  /** Grid column (position_x). */
  col: number;
}

export interface GenerateMapPlacement {
  position_x: number;
  position_y: number;
}

export interface GenerateMapPlan {
  prompt: string;
  placements: GenerateMapPlacement[];
  /** Blocked cells of the map type, translated with the same offset as spawn. */
  translatedBlocked: Array<{ row: number; col: number }>;
  mapTypeId: string;
}

export function buildGenerateMap(input: {
  anchor: GenerateMapAnchor;
  modifier: string;
  mapTypeId: string;
  /** Cells already taken (existing blocks, unusable ground). The empty anchor is filled. */
  occupied?: Array<{ row: number; col: number }>;
  goal?: string | null;
  notes?: string | null;
  fileNames?: string[];
}): GenerateMapPlan {
  const record = resolveMapTypeRecord(input.mapTypeId);
  const ctx = formatMapTypeGeneratorContext(record);
  const anchorRow = Math.trunc(input.anchor.row);
  const anchorCol = Math.trunc(input.anchor.col);
  const spawn = cellsWithMark(record, "spawn");
  const blocked = blockedCellsFromMapType(record);
  const start = schematicStartCell(spawn);
  const dRow = anchorRow - start.row;
  const dCol = anchorCol - start.col;

  const schematic = spawn.map((cell) => ({
    position_x: cell.col,
    position_y: cell.row,
  }));
  const framed = clampPositionsToMapTypeFrame(schematic, record);

  const translatedBlocked = blocked.map((cell) => ({
    row: cell.row + dRow,
    col: cell.col + dCol,
  }));

  const taken = new Set<string>();
  for (const cell of input.occupied || []) {
    if (!Number.isFinite(cell.row) || !Number.isFinite(cell.col)) continue;
    taken.add(getCellKey(Math.trunc(cell.row), Math.trunc(cell.col)));
  }
  for (const cell of translatedBlocked) {
    taken.add(getCellKey(cell.row, cell.col));
  }

  const placements: GenerateMapPlacement[] = [];
  for (const cell of framed) {
    if (typeof cell.position_x !== "number" || typeof cell.position_y !== "number") continue;
    const row = cell.position_y + dRow;
    const col = cell.position_x + dCol;
    const key = getCellKey(row, col);
    if (taken.has(key)) continue;
    taken.add(key);
    placements.push({ position_x: col, position_y: row });
  }

  const modifier = typeof input.modifier === "string" ? input.modifier.trim() : "";
  const workspaceContext = composeBlockGenerationContext({
    goal: input.goal,
    notes: input.notes,
    fileNames: input.fileNames,
  });
  const prompt = [
    "Generate new workspace blocks that follow the chosen map type.",
    modifier ? `Modifier prompt: ${modifier}` : "",
    `Anchor empty cell: position_x=${anchorCol}, position_y=${anchorRow}.`,
    "Place the foundation block on that empty anchor cell. The other new blocks use the spawn skeleton translated around it.",
    "Do not place a block on an already occupied cell or on a translated blocked cell.",
    ctx.countInstruction,
    ctx.spatialInstruction,
    workspaceContext,
  ]
    .filter(Boolean)
    .join("\n\n");

  return {
    prompt,
    placements,
    translatedBlocked,
    mapTypeId: record.id,
  };
}

/** Cells to highlight for the chosen map type. Same geometry Generate will fill. */
export function generateMapHighlightCells(input: {
  anchor: GenerateMapAnchor;
  mapTypeId: string;
  occupied?: Array<{ row: number; col: number }>;
}): Array<{ row: number; col: number }> {
  return buildGenerateMap({
    anchor: input.anchor,
    mapTypeId: input.mapTypeId,
    modifier: "",
    occupied: input.occupied,
  }).placements.map((cell) => ({
    row: cell.position_y,
    col: cell.position_x,
  }));
}
