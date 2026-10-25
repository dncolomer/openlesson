/**
 * Helios Learning Map snapshot types, parse, occupied cells, and prompt
 * serialization. Live board state Helios Chat and dispatch share.
 */

import { getCellKey } from "@/lib/block-skill-grid";
import {
  parseAnnotationLayers,
  type AnnotationLayer,
} from "@/lib/map-annotation-layers";
import {
  parseLearnerMapNotes,
  type LearnerMapNote,
} from "@/lib/learner-map-notes";
import type { UnusableCell } from "@/lib/map-ground-rules";
import {
  placedBlockCells,
  type PlacedBlockRef,
} from "@/lib/skill-grid-ops";
import { isHeliosMapToolId, type HeliosMapToolId } from "./catalog";

export type HeliosMapBlock = {
  id: string;
  title?: string | null;
  description?: string | null;
  position_x: number;
  position_y: number;
  span_w?: number | null;
  span_h?: number | null;
  shape_cells?: Array<{ dr: number; dc: number }> | null;
  next_block_ids?: string[] | null;
  lock_until_block_ids?: string[] | null;
  creator_effects?: unknown;
  planning_prompt?: string | null;
};

export type HeliosMapSnapshot = {
  blocks: HeliosMapBlock[];
  unusableCells: UnusableCell[];
  notes: LearnerMapNote[];
  annotationLayers: AnnotationLayer[];
};

export type HeliosMapToolCall = {
  name: HeliosMapToolId;
  args: Record<string, unknown>;
};

export type HeliosMapToolResult =
  | { ok: true; snapshot: HeliosMapSnapshot; message: string }
  | { ok: false; error: string; snapshot: HeliosMapSnapshot };

function cloneHeliosNotes(
  notes: readonly LearnerMapNote[] | null | undefined,
): LearnerMapNote[] {
  return parseLearnerMapNotes(notes || []);
}

function cloneHeliosLayers(
  layers: readonly AnnotationLayer[] | null | undefined,
): AnnotationLayer[] {
  return parseAnnotationLayers(layers || []);
}

function asHeliosMapBlock(raw: unknown): HeliosMapBlock | null {
  if (!raw || typeof raw !== "object") return null;
  const rec = raw as Record<string, unknown>;
  const id = String(rec.id ?? "").trim();
  const col = Number(rec.position_x ?? rec.col);
  const row = Number(rec.position_y ?? rec.row);
  if (!id || !Number.isFinite(col) || !Number.isFinite(row)) return null;
  return {
    id,
    title: typeof rec.title === "string" ? rec.title : null,
    description: typeof rec.description === "string" ? rec.description : "",
    position_x: Math.trunc(col),
    position_y: Math.trunc(row),
    span_w: Number.isFinite(Number(rec.span_w)) ? Number(rec.span_w) : 1,
    span_h: Number.isFinite(Number(rec.span_h)) ? Number(rec.span_h) : 1,
    shape_cells: Array.isArray(rec.shape_cells)
      ? (rec.shape_cells as HeliosMapBlock["shape_cells"])
      : null,
    next_block_ids: Array.isArray(rec.next_block_ids)
      ? rec.next_block_ids.map((item) => String(item))
      : [],
    lock_until_block_ids: Array.isArray(rec.lock_until_block_ids)
      ? rec.lock_until_block_ids.map((item) => String(item))
      : [],
    creator_effects: rec.creator_effects,
    planning_prompt:
      typeof rec.planning_prompt === "string" ? rec.planning_prompt : null,
  };
}

/** Live authoring snapshot from the Helios column (preferred over a DB reload). */
export function heliosMapSnapshotFromUnknown(
  raw: unknown,
): HeliosMapSnapshot | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const rec = raw as Record<string, unknown>;
  if (
    !("blocks" in rec) &&
    rec.unusableCells == null &&
    rec.unusable_cells == null
  ) {
    return null;
  }
  const blocks = Array.isArray(rec.blocks)
    ? rec.blocks
        .map(asHeliosMapBlock)
        .filter((block): block is HeliosMapBlock => Boolean(block))
    : [];
  const unusableRaw = rec.unusableCells ?? rec.unusable_cells;
  return heliosMapSnapshotFromBlocks({
    blocks,
    unusableCells: Array.isArray(unusableRaw)
      ? (unusableRaw as Array<{ row?: unknown; col?: unknown }>)
          .map((cell) => ({
            row: Number(cell?.row),
            col: Number(cell?.col),
          }))
          .filter(
            (cell) => Number.isFinite(cell.row) && Number.isFinite(cell.col),
          )
      : [],
    notes: rec.notes as HeliosMapSnapshot["notes"],
    annotationLayers: rec.annotationLayers as HeliosMapSnapshot["annotationLayers"],
  });
}

export function heliosMapSnapshotFromBlocks(input: {
  blocks: readonly HeliosMapBlock[];
  unusableCells?: readonly UnusableCell[] | null;
  notes?: readonly LearnerMapNote[] | null;
  annotationLayers?: readonly AnnotationLayer[] | null;
}): HeliosMapSnapshot {
  return {
    blocks: input.blocks.map((b) => ({ ...b })),
    unusableCells: (input.unusableCells || []).map((c) => ({
      row: c.row,
      col: c.col,
    })),
    notes: cloneHeliosNotes(input.notes),
    annotationLayers: cloneHeliosLayers(input.annotationLayers),
  };
}

export function withOverlay(snapshot: HeliosMapSnapshot): HeliosMapSnapshot {
  return {
    ...snapshot,
    notes: snapshot.notes || [],
    annotationLayers: snapshot.annotationLayers || [],
  };
}

function recordFromUnknown(raw: unknown): Record<string, unknown> | null {
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (!trimmed) return null;
    try {
      return recordFromUnknown(JSON.parse(trimmed));
    } catch {
      return null;
    }
  }
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  return raw as Record<string, unknown>;
}

export function parseHeliosMapToolCall(raw: unknown): HeliosMapToolCall | null {
  if (!raw || typeof raw !== "object") return null;
  const rec = raw as Record<string, unknown>;
  const nestedFn =
    rec.function && typeof rec.function === "object"
      ? (rec.function as Record<string, unknown>)
      : null;
  const name = rec.name ?? rec.id ?? rec.tool ?? nestedFn?.name;
  if (!isHeliosMapToolId(name)) return null;
  const argsRaw = rec.arguments ?? rec.args ?? rec.payload ?? nestedFn?.arguments;
  const args = { ...(recordFromUnknown(argsRaw) || {}) };
  for (const [key, value] of Object.entries(rec)) {
    if (
      key === "name" ||
      key === "id" ||
      key === "tool" ||
      key === "arguments" ||
      key === "args" ||
      key === "payload" ||
      key === "function"
    ) {
      continue;
    }
    if (!(key in args)) args[key] = value;
  }
  return { name, args };
}

export type HeliosMapChatModelTurn = {
  reply: string;
  toolCalls: HeliosMapToolCall[];
};

export function parseHeliosMapChatModelTurn(raw: unknown): HeliosMapChatModelTurn {
  if (!raw || typeof raw !== "object") {
    return { reply: "", toolCalls: [] };
  }
  const rec = raw as Record<string, unknown>;
  const reply = String(rec.reply ?? rec.explanation ?? rec.text ?? "").trim();
  const list = rec.toolCalls ?? rec.tool_calls ?? rec.tools;
  const toolCalls: HeliosMapToolCall[] = [];
  if (Array.isArray(list)) {
    for (const item of list) {
      const parsed = parseHeliosMapToolCall(item);
      if (parsed) toolCalls.push(parsed);
    }
  }
  return { reply, toolCalls };
}

export function toPlaced(block: HeliosMapBlock): PlacedBlockRef {
  return {
    id: block.id,
    position_x: Number(block.position_x) || 0,
    position_y: Number(block.position_y) || 0,
    span_w: block.span_w ?? 1,
    span_h: block.span_h ?? 1,
    shape_cells: block.shape_cells ?? null,
  };
}

export function heliosMapOccupiedKeys(
  snapshot: HeliosMapSnapshot,
  ignoreIds: Iterable<string> = [],
): Set<string> {
  const ignore = new Set(
    [...ignoreIds].map((id) => String(id || "").trim()).filter(Boolean),
  );
  const keys = new Set<string>();
  for (const block of snapshot.blocks) {
    if (ignore.has(block.id)) continue;
    for (const cell of placedBlockCells(toPlaced(block))) {
      keys.add(getCellKey(cell.row, cell.col));
    }
  }
  return keys;
}

export function nextOpenHeliosCell(
  snapshot: HeliosMapSnapshot,
): { row: number; col: number } {
  const occupied = heliosMapOccupiedKeys(snapshot);
  const unusable = new Set(
    snapshot.unusableCells.map((c) => getCellKey(c.row, c.col)),
  );
  const isFree = (row: number, col: number) => {
    const key = getCellKey(row, col);
    return !occupied.has(key) && !unusable.has(key);
  };
  if (isFree(0, 0)) return { row: 0, col: 0 };
  for (let row = 0; row <= 24; row += 1) {
    for (let col = 0; col <= 24; col += 1) {
      if (isFree(row, col)) return { row, col };
    }
  }
  for (let radius = 1; radius <= 32; radius += 1) {
    for (let row = -radius; row <= radius; row += 1) {
      for (let col = -radius; col <= radius; col += 1) {
        if (isFree(row, col)) return { row, col };
      }
    }
  }
  return { row: 0, col: 0 };
}

export function heliosMapSnapshotToAuthoringNodes(
  snapshot: HeliosMapSnapshot,
  previous: readonly object[] = [],
): Record<string, unknown>[] {
  const prevById = new Map(
    previous.map((n) => {
      const rec = n as Record<string, unknown>;
      return [String(rec.id || ""), rec] as const;
    }),
  );
  return snapshot.blocks.map((block) => {
    const prev = prevById.get(block.id) || {};
    return {
      ...prev,
      id: block.id,
      title: block.title || "Untitled",
      description: block.description || "",
      position_x: block.position_x,
      position_y: block.position_y,
      span_w: block.span_w ?? 1,
      span_h: block.span_h ?? 1,
      shape_cells: block.shape_cells ?? null,
      next_block_ids: block.next_block_ids || [],
      lock_until_block_ids: block.lock_until_block_ids || [],
      creator_effects: block.creator_effects ?? prev.creator_effects,
      planning_prompt: block.planning_prompt ?? prev.planning_prompt,
      is_start: prev.is_start ?? false,
      status: prev.status ?? "pending",
    };
  });
}

export function formatHeliosMapSnapshotForPrompt(
  snapshot: HeliosMapSnapshot,
): string {
  const occupied: string[] = [];
  const seen = new Set<string>();
  const blocks = snapshot.blocks
    .map((b) => {
      const cells = placedBlockCells(toPlaced(b));
      const cellText = cells
        .map((cell) => {
          const key = `${cell.row}:${cell.col}`;
          if (!seen.has(key)) {
            seen.add(key);
            occupied.push(key);
          }
          return key;
        })
        .join(",");
      const shape =
        (b.shape_cells || [])
          .map((cell) => `${cell.dr}:${cell.dc}`)
          .join(",") || "-";
      const next = (b.next_block_ids || []).join(",") || "-";
      const lock = (b.lock_until_block_ids || []).join(",") || "-";
      return `${b.id} "${b.title || ""}" origin=(${b.position_y},${b.position_x}) span=${b.span_w || 1}x${b.span_h || 1} cells=${cellText || "-"} shape=${shape} next:${next} lock:${lock}`;
    })
    .join("\n");
  const nextOpen = nextOpenHeliosCell(snapshot);
  const unusable = snapshot.unusableCells
    .map((c) => `${c.row}:${c.col}`)
    .join(", ");
  const notes = (snapshot.notes || [])
    .map((n) => `${n.id} "${n.body.replace(/\s+/g, " ").slice(0, 80)}" @(${n.x},${n.y})`)
    .join("\n");
  const layers = (snapshot.annotationLayers || [])
    .map(
      (l) =>
        `${l.id} "${l.name}" visible:${l.visible ? "yes" : "no"} strokes:${l.strokes.length}`,
    )
    .join("\n");
  return [
    "CURRENT MAP (live board — read occupied cells and existing blocks before placing)",
    "ORIGIN: row 0, col 0. The first new block goes here unless that cell is occupied or you choose a better origin.",
    `OCCUPIED CELLS: ${occupied.join(", ") || "(none)"}`,
    `NEXT OPEN CELL: ${nextOpen.row}:${nextOpen.col}`,
    `MAP BLOCKS:\n${blocks || "(none)"}`,
    `UNUSABLE GROUND: ${unusable || "(none)"}`,
    `MAP NOTES:\n${notes || "(none)"}`,
    `DRAWING LAYERS:\n${layers || "(none)"}`,
  ].join("\n");
}
