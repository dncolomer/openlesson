/**
 * Helios Learning Map builder tools: catalog + dispatch through shipped
 * Manual authoring helpers (grid geometry, unusable ground, creator effects,
 * DAG apply, cluster, bridge, clone, expand).
 */

import {
  getCellKey,
  SKILL_GRID_CELL_SIZE,
  SKILL_GRID_PITCH,
} from "@/lib/block-skill-grid";
import {
  normalizeBlockCreatorEffects,
  parseBlockCreatorEffects,
  validateBlockCreatorEffects,
  type BlockCreatorEffects,
} from "@/lib/block-creator-effects";
import {
  BRIDGE_WIDTH_MIN,
  bridgeAnchorsFromPlacedBlocks,
  clampBridgeWidth,
  resolveBridgeSelection,
} from "@/lib/bridge-blocks";
import { clusterBlocks } from "@/lib/cluster-blocks";
import { buildCloneInsertPayload } from "@/lib/clone-block";
import { resolveExpandFromSourceSelection } from "@/lib/expand-block-from-source";
import {
  applyUnusableSelection,
  canPlaceOnMapGround,
  type UnusableCell,
} from "@/lib/map-ground-rules";
import {
  appendAnnotationStroke,
  buildAnnotationStrokeFromGesture,
  createAnnotationLayer,
  deleteAnnotationLayer,
  parseAnnotationLayers,
  upsertAnnotationLayer,
  type AnnotationLayer,
  type AnnotationStrokeKind,
} from "@/lib/map-annotation-layers";
import {
  createLearnerMapNote,
  deleteLearnerMapNote,
  parseLearnerMapNotes,
  updateLearnerMapNote,
  upsertLearnerMapNote,
  type LearnerMapNote,
} from "@/lib/learner-map-notes";
import {
  buildMultiBlockDagApplyUpdates,
  draftMultiBlockDag,
  type MultiBlockDagDraft,
  type MultiBlockDagEdge,
} from "@/lib/multi-block-dag";
import {
  mergeBlocksToFreeform,
  placedBlockCells,
  selectionIsFreeformLectureShape,
  splitBlocksToSingles,
  type PlacedBlockRef,
} from "@/lib/skill-grid-ops";

export const HELIOS_MAP_TOOL_IDS = [
  "add_block",
  "generate_shape",
  "split_block",
  "clone_block",
  "edit_block",
  "expand_block",
  "combine_blocks",
  "bridge_blocks",
  "cluster_blocks",
  "apply_dag",
  "mark_unusable",
  "set_dynamic_effect",
  "set_generator_effect",
  "delete_block",
  "add_note",
  "edit_note",
  "delete_note",
  "add_drawing_layer",
  "draw_on_layer",
  "delete_drawing_layer",
] as const;

export type HeliosMapToolId = (typeof HELIOS_MAP_TOOL_IDS)[number];

export type HeliosMapToolFamily =
  | "topologies"
  | "unusable"
  | "generative"
  | "dag"
  | "edit"
  | "overlay";

export type HeliosMapToolSpec = {
  id: HeliosMapToolId;
  family: HeliosMapToolFamily;
  title: string;
  description: string;
};

export const HELIOS_MAP_TOOL_CATALOG: readonly HeliosMapToolSpec[] = [
  {
    id: "add_block",
    family: "topologies",
    title: "Add block",
    description:
      "Place a new 1×1 block. Arguments: title, optional row and col (next open cell if omitted).",
  },
  {
    id: "generate_shape",
    family: "topologies",
    title: "Generate in shape",
    description:
      "Create one freeform block covering a contiguous empty-cell selection (Generate-in-shape drawer).",
  },
  {
    id: "split_block",
    family: "topologies",
    title: "Split block",
    description: "Split a multi-cell block into 1×1 cells (Split drawer).",
  },
  {
    id: "clone_block",
    family: "topologies",
    title: "Clone block",
    description: "Copy a block onto an open cell (Clone drawer).",
  },
  {
    id: "expand_block",
    family: "topologies",
    title: "Expand block",
    description:
      "Grow neighbor 1×1 blocks around a source block (Expand block drawer).",
  },
  {
    id: "combine_blocks",
    family: "topologies",
    title: "Combine blocks",
    description:
      "Merge selected blocks into one freeform footprint (Combine drawer).",
  },
  {
    id: "bridge_blocks",
    family: "topologies",
    title: "Bridge blocks",
    description:
      "Fill a 1-cell corridor of new blocks between selected anchors (Bridge drawer). Default thickness is 1 cell (width 0). width is half-width: 0 = 1 cell, 1 = 3 cells, 2 = 5 cells.",
  },
  {
    id: "cluster_blocks",
    family: "topologies",
    title: "Cluster blocks",
    description:
      "Relocate selected blocks into separated clusters (Cluster drawer).",
  },
  {
    id: "mark_unusable",
    family: "unusable",
    title: "Unusable ground",
    description:
      "Mark or clear empty cells as unusable ground (Unusable ground drawer).",
  },
  {
    id: "set_dynamic_effect",
    family: "generative",
    title: "Dynamic effect",
    description:
      "Enable Dynamic generative unlock-after on a block (Dynamic drawer).",
  },
  {
    id: "set_generator_effect",
    family: "generative",
    title: "Generator effect",
    description:
      "Enable Generator spawn targets on empty cells (Generator drawer).",
  },
  {
    id: "apply_dag",
    family: "dag",
    title: "Apply DAG",
    description:
      "Apply leads-to edges among selected blocks (DAG drawer).",
  },
  {
    id: "edit_block",
    family: "edit",
    title: "Edit block",
    description: "Update a block title and description (Edit drawer).",
  },
  {
    id: "delete_block",
    family: "edit",
    title: "Delete block",
    description: "Remove a block (Danger zone drawer).",
  },
  {
    id: "add_note",
    family: "overlay",
    title: "Add note",
    description:
      "Place a creator map post-it on the plane (same as Manual notes).",
  },
  {
    id: "edit_note",
    family: "overlay",
    title: "Edit note",
    description: "Update a map note body or position.",
  },
  {
    id: "delete_note",
    family: "overlay",
    title: "Delete note",
    description: "Remove a creator map note.",
  },
  {
    id: "add_drawing_layer",
    family: "overlay",
    title: "Add drawing layer",
    description:
      "Create a named white-stroke annotation layer (same as Manual drawing layers).",
  },
  {
    id: "draw_on_layer",
    family: "overlay",
    title: "Draw on layer",
    description:
      "Add a circle, square, or freehand stroke on a drawing layer.",
  },
  {
    id: "delete_drawing_layer",
    family: "overlay",
    title: "Delete drawing layer",
    description: "Remove a drawing layer.",
  },
] as const;

export function isHeliosMapToolId(value: unknown): value is HeliosMapToolId {
  return (
    typeof value === "string" &&
    (HELIOS_MAP_TOOL_IDS as readonly string[]).includes(value)
  );
}

export function heliosMapToolAwarenessText(
  catalog: readonly HeliosMapToolSpec[] = HELIOS_MAP_TOOL_CATALOG,
): string {
  const lines = catalog.map(
    (tool) => `- ${tool.id} [${tool.family}] ${tool.title}: ${tool.description}`,
  );
  return [
    "HELIOS LEARNING MAP BUILDER TOOLS",
    "Helios is the Learning Map builder helper. These tools match Manual Mode drawers:",
    "topologies (add/place, generate-in-shape, split, clone, expand, combine, bridge, cluster),",
    "unusable ground, generative blocks (dynamic and generator), DAGs, remaining edit/delete ops,",
    "and overlay (map notes and drawing layers).",
    "add_block arguments: { \"title\": \"...\", \"row\": 0, \"col\": 0 }. Default origin is row 0, col 0. Omit row/col only when that default (or the next open cell) is correct. Read CURRENT MAP occupied cells before placing.",
    "bridge_blocks arguments: { \"blockIds\": [\"id1\",\"id2\"], \"width\": 0 }. Default thickness is 1 cell (width 0). Omit width unless the author asks for a thicker corridor.",
    "apply_dag arguments: { \"blockIds\": [\"id1\",\"id2\"], \"edges\": [{ \"from\": \"id1\", \"to\": \"id2\", \"kind\": \"next\" }] }.",
    "If blockIds/edges are omitted, apply_dag uses current blocks in reading order.",
    ...lines,
  ].join("\n");
}

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

function withOverlay(snapshot: HeliosMapSnapshot): HeliosMapSnapshot {
  return {
    ...snapshot,
    notes: snapshot.notes || [],
    annotationLayers: snapshot.annotationLayers || [],
  };
}

function heliosWorldFromCell(cell: { row: number; col: number }): {
  x: number;
  y: number;
} {
  return {
    x: cell.col * SKILL_GRID_PITCH,
    y: cell.row * SKILL_GRID_PITCH,
  };
}

function heliosCellCenter(cell: { row: number; col: number }): {
  x: number;
  y: number;
} {
  return {
    x: cell.col * SKILL_GRID_PITCH + SKILL_GRID_CELL_SIZE / 2,
    y: cell.row * SKILL_GRID_PITCH + SKILL_GRID_CELL_SIZE / 2,
  };
}

function worldPointFromArgs(
  args: Record<string, unknown>,
): { x: number; y: number } | null {
  const x = Number(args.x);
  const y = Number(args.y);
  if (Number.isFinite(x) && Number.isFinite(y)) return { x, y };
  const cell = cellFromArgs(args);
  if (!cell) return null;
  return heliosWorldFromCell(cell);
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

function toPlaced(block: HeliosMapBlock): PlacedBlockRef {
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

function finiteCell(raw: unknown): { row: number; col: number } | null {
  if (!raw || typeof raw !== "object") return null;
  const rec = raw as Record<string, unknown>;
  const row = Number(rec.row ?? rec.r ?? rec.y ?? rec.position_y);
  const col = Number(rec.col ?? rec.c ?? rec.x ?? rec.position_x);
  if (!Number.isFinite(row) || !Number.isFinite(col)) return null;
  return { row: Math.trunc(row), col: Math.trunc(col) };
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

function resolveAddCell(
  snapshot: HeliosMapSnapshot,
  args: Record<string, unknown>,
): { row: number; col: number } {
  return cellFromArgs(args) || nextOpenHeliosCell(snapshot);
}

function cellFromArgs(
  args: Record<string, unknown>,
): { row: number; col: number } | null {
  const nested = finiteCell(args.cell ?? args.target ?? args.position);
  if (nested) return nested;
  return finiteCell(args);
}

function cellsFromArgs(args: Record<string, unknown>): Array<{ row: number; col: number }> {
  const raw = args.cells ?? args.selected ?? args.unusableCells;
  if (!Array.isArray(raw)) {
    const one = cellFromArgs(args);
    return one ? [one] : [];
  }
  const out: Array<{ row: number; col: number }> = [];
  const seen = new Set<string>();
  for (const item of raw) {
    const cell = finiteCell(item);
    if (!cell) continue;
    const key = getCellKey(cell.row, cell.col);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(cell);
  }
  return out;
}

function stringArg(args: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const v = args[key];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return "";
}

function idList(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    const id = String(item ?? "").trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

function allocateBlockId(
  snapshot: HeliosMapSnapshot,
  preferred?: string,
): string {
  const used = new Set(snapshot.blocks.map((b) => b.id));
  const want = String(preferred || "").trim();
  if (want && !used.has(want)) return want;
  let i = 1;
  while (used.has(`helios-${i}`)) i += 1;
  return `helios-${i}`;
}

function fail(
  snapshot: HeliosMapSnapshot,
  error: string,
): HeliosMapToolResult {
  return { ok: false, error, snapshot };
}

function ok(
  snapshot: HeliosMapSnapshot,
  message: string,
): HeliosMapToolResult {
  return { ok: true, snapshot, message };
}

function placeBlock(
  snapshot: HeliosMapSnapshot,
  input: {
    id?: string;
    title?: string;
    description?: string;
    row: number;
    col: number;
    span_w?: number;
    span_h?: number;
    shape_cells?: Array<{ dr: number; dc: number }> | null;
  },
): HeliosMapToolResult {
  const cells = placedBlockCells({
    id: input.id || "place",
    position_x: input.col,
    position_y: input.row,
    span_w: input.span_w ?? 1,
    span_h: input.span_h ?? 1,
    shape_cells: input.shape_cells ?? null,
  });
  const ground = canPlaceOnMapGround(
    cells,
    snapshot.unusableCells,
    heliosMapOccupiedKeys(snapshot),
  );
  if (!ground.ok) {
    return fail(snapshot, ground.reason);
  }
  const id = allocateBlockId(snapshot, input.id);
  const block: HeliosMapBlock = {
    id,
    title: input.title || "Untitled",
    description: input.description || "",
    position_x: input.col,
    position_y: input.row,
    span_w: input.span_w ?? 1,
    span_h: input.span_h ?? 1,
    shape_cells: input.shape_cells ?? null,
    next_block_ids: [],
    lock_until_block_ids: [],
  };
  return ok(
    { ...snapshot, blocks: [...snapshot.blocks, block] },
    `placed:${id}`,
  );
}

function dispatchAdd(
  snapshot: HeliosMapSnapshot,
  args: Record<string, unknown>,
): HeliosMapToolResult {
  const cell = resolveAddCell(snapshot, args);
  return placeBlock(snapshot, {
    id: stringArg(args, "id"),
    title: stringArg(args, "title", "prompt") || "Untitled",
    description: stringArg(args, "description"),
    row: cell.row,
    col: cell.col,
  });
}

function dispatchGenerateShape(
  snapshot: HeliosMapSnapshot,
  args: Record<string, unknown>,
): HeliosMapToolResult {
  const cells = cellsFromArgs(args);
  const shape = selectionIsFreeformLectureShape(cells);
  if (!shape.ok || !shape.footprint) {
    return fail(snapshot, shape.reason || "shape_required");
  }
  const ground = canPlaceOnMapGround(
    cells,
    snapshot.unusableCells,
    heliosMapOccupiedKeys(snapshot),
  );
  if (!ground.ok) return fail(snapshot, ground.reason);
  const fp = shape.footprint;
  return placeBlock(snapshot, {
    id: stringArg(args, "id"),
    title: stringArg(args, "title", "prompt") || "Untitled",
    description: stringArg(args, "description"),
    row: fp.position_y,
    col: fp.position_x,
    span_w: fp.span_w,
    span_h: fp.span_h,
    shape_cells: shape.shape_cells,
  });
}

function dispatchSplit(
  snapshot: HeliosMapSnapshot,
  args: Record<string, unknown>,
): HeliosMapToolResult {
  const blockId = stringArg(args, "blockId", "id");
  const block = snapshot.blocks.find((b) => b.id === blockId);
  if (!block) return fail(snapshot, "block_not_found");
  const singles = splitBlocksToSingles([toPlaced(block)]);
  if (singles.length <= 1) return fail(snapshot, "not_splittable");
  const rest = snapshot.blocks.filter((b) => b.id !== blockId);
  const first = singles[0];
  const kept: HeliosMapBlock = {
    ...block,
    position_x: first.position_x,
    position_y: first.position_y,
    span_w: 1,
    span_h: 1,
    shape_cells: null,
  };
  let next: HeliosMapSnapshot = { ...snapshot, blocks: [...rest, kept] };
  for (let i = 1; i < singles.length; i += 1) {
    const part = singles[i];
    const placed = placeBlock(next, {
      title: `${block.title || "Untitled"} ${i + 1}`,
      description: block.description || "",
      row: part.position_y,
      col: part.position_x,
    });
    if (!placed.ok) return placed;
    next = placed.snapshot;
  }
  return ok(next, `split:${blockId}:${singles.length}`);
}

function dispatchClone(
  snapshot: HeliosMapSnapshot,
  args: Record<string, unknown>,
): HeliosMapToolResult {
  const blockId = stringArg(args, "blockId", "sourceBlockId", "id");
  const source = snapshot.blocks.find((b) => b.id === blockId);
  const cell = cellFromArgs(args);
  if (!source) return fail(snapshot, "block_not_found");
  if (!cell) return fail(snapshot, "cell_required");
  const payload = buildCloneInsertPayload({
    source: {
      title: source.title,
      description: source.description,
      planning_prompt: source.planning_prompt,
    },
    target: cell,
  });
  return placeBlock(snapshot, {
    title: payload.title,
    description: payload.description,
    row: payload.position_y,
    col: payload.position_x,
    span_w: payload.span_w,
    span_h: payload.span_h,
    shape_cells: payload.shape_cells,
  });
}

function dispatchEdit(
  snapshot: HeliosMapSnapshot,
  args: Record<string, unknown>,
): HeliosMapToolResult {
  const blockId = stringArg(args, "blockId", "id");
  const block = snapshot.blocks.find((b) => b.id === blockId);
  if (!block) return fail(snapshot, "block_not_found");
  const title = stringArg(args, "title") || block.title || "Untitled";
  const description =
    typeof args.description === "string"
      ? args.description
      : block.description || "";
  return ok(
    {
      ...snapshot,
      blocks: snapshot.blocks.map((b) =>
        b.id === blockId ? { ...b, title, description } : b,
      ),
    },
    `edited:${blockId}`,
  );
}

function dispatchExpand(
  snapshot: HeliosMapSnapshot,
  args: Record<string, unknown>,
): HeliosMapToolResult {
  const blockId = stringArg(args, "blockId", "id");
  const source = snapshot.blocks.find((b) => b.id === blockId);
  if (!source) return fail(snapshot, "block_not_found");
  const range = Number.isFinite(Number(args.range)) ? Number(args.range) : 2;
  const density = Number.isFinite(Number(args.density))
    ? Number(args.density)
    : 50;
  const seed = Number.isFinite(Number(args.seed)) ? Number(args.seed) : 1;
  const resolved = resolveExpandFromSourceSelection({
    sourceBlock: toPlaced(source),
    range,
    density,
    seed,
    occupiedKeys: heliosMapOccupiedKeys(snapshot),
    unusableKeys: new Set(
      snapshot.unusableCells.map((c) => getCellKey(c.row, c.col)),
    ),
  });
  if (resolved.frozenSlots.length === 0) {
    return fail(snapshot, "no_expand_slots");
  }
  let next = snapshot;
  const prompt = stringArg(args, "prompt", "title") || source.title || "Untitled";
  for (const slot of resolved.frozenSlots) {
    const placed = placeBlock(next, {
      title: prompt,
      description: source.description || "",
      row: slot.row,
      col: slot.col,
    });
    if (!placed.ok) return placed;
    next = placed.snapshot;
  }
  return ok(next, `expanded:${blockId}:${resolved.frozenSlots.length}`);
}

function dispatchCombine(
  snapshot: HeliosMapSnapshot,
  args: Record<string, unknown>,
): HeliosMapToolResult {
  const ids = idList(args.blockIds ?? args.ids);
  if (ids.length < 2) return fail(snapshot, "need_two_blocks");
  const targets = snapshot.blocks.filter((b) => ids.includes(b.id));
  if (targets.length < 2) return fail(snapshot, "blocks_not_found");
  const freeform = mergeBlocksToFreeform(targets.map(toPlaced));
  if (!freeform) return fail(snapshot, "merge_failed");
  const keep = targets[0];
  const drop = new Set(targets.slice(1).map((b) => b.id));
  const merged: HeliosMapBlock = {
    ...keep,
    title: stringArg(args, "title", "prompt") || keep.title,
    position_x: freeform.footprint.position_x,
    position_y: freeform.footprint.position_y,
    span_w: freeform.footprint.span_w,
    span_h: freeform.footprint.span_h,
    shape_cells: freeform.shape_cells,
  };
  return ok(
    {
      ...snapshot,
      blocks: snapshot.blocks
        .filter((b) => !drop.has(b.id))
        .map((b) => (b.id === keep.id ? merged : b)),
    },
    `combined:${keep.id}`,
  );
}

/** Corridor half-width. Default 0 → 1-cell thickness (Manual Mode default). */
export function heliosBridgeWidthFromArgs(
  args: Record<string, unknown>,
): number {
  if (args.thickness !== undefined && args.thickness !== null) {
    const thickness = Number(args.thickness);
    if (Number.isFinite(thickness)) {
      return clampBridgeWidth(Math.max(0, Math.round((thickness - 1) / 2)));
    }
  }
  if (args.width !== undefined && args.width !== null) {
    const width = Number(args.width);
    if (Number.isFinite(width)) return clampBridgeWidth(width);
  }
  return BRIDGE_WIDTH_MIN;
}

function dispatchBridge(
  snapshot: HeliosMapSnapshot,
  args: Record<string, unknown>,
): HeliosMapToolResult {
  const ids = idList(args.blockIds ?? args.ids);
  const targets = snapshot.blocks.filter((b) => ids.includes(b.id));
  if (targets.length < 2) return fail(snapshot, "need_two_blocks");
  const density = Number.isFinite(Number(args.density))
    ? Number(args.density)
    : 100;
  const width = heliosBridgeWidthFromArgs(args);
  const resolved = resolveBridgeSelection({
    anchors: bridgeAnchorsFromPlacedBlocks(targets.map(toPlaced)),
    density,
    width,
    occupiedKeys: heliosMapOccupiedKeys(snapshot),
    unusableKeys: snapshot.unusableCells.map((c) => getCellKey(c.row, c.col)),
  });
  if (resolved.selected.length === 0) return fail(snapshot, "no_bridge_cells");
  let next = snapshot;
  const title = stringArg(args, "title", "prompt") || "Bridge";
  for (const cell of resolved.selected) {
    const placed = placeBlock(next, {
      title,
      row: cell.row,
      col: cell.col,
    });
    if (!placed.ok) return placed;
    next = placed.snapshot;
  }
  return ok(next, `bridged:${resolved.selected.length}`);
}

function dispatchCluster(
  snapshot: HeliosMapSnapshot,
  args: Record<string, unknown>,
): HeliosMapToolResult {
  const ids = idList(args.blockIds ?? args.ids);
  const selected = snapshot.blocks.filter((b) => ids.includes(b.id));
  if (selected.length < 2) return fail(snapshot, "need_two_blocks");
  const result = clusterBlocks({
    selected: selected.map((b) => ({
      id: b.id,
      title: b.title,
      description: b.description,
      position_x: b.position_x,
      position_y: b.position_y,
      span_w: b.span_w ?? 1,
      span_h: b.span_h ?? 1,
      shape_cells: b.shape_cells ?? null,
    })),
    allPlaced: snapshot.blocks.map(toPlaced),
    unusableCells: snapshot.unusableCells,
    clusterCount:
      args.clusterCount === undefined ? "auto" : (args.clusterCount as number),
    separation:
      args.separation === undefined ? null : Number(args.separation),
    prompt: stringArg(args, "prompt") || null,
  });
  if (!result.ok) return fail(snapshot, result.error);
  const byId = new Map(result.placements.map((p) => [p.id, p]));
  return ok(
    {
      ...snapshot,
      blocks: snapshot.blocks.map((b) => {
        const p = byId.get(b.id);
        if (!p) return b;
        return {
          ...b,
          position_x: p.position_x,
          position_y: p.position_y,
          span_w: p.span_w,
          span_h: p.span_h,
          shape_cells: p.shape_cells ?? b.shape_cells,
        };
      }),
    },
    `clustered:${result.clusterCount}`,
  );
}

function heliosDagBlockIds(
  snapshot: HeliosMapSnapshot,
  args: Record<string, unknown>,
): string[] {
  const draftRaw =
    (args.dagDraft as Record<string, unknown> | undefined) || args;
  let blockIds = idList(draftRaw.blockIds ?? args.blockIds ?? args.ids);
  if (blockIds.length < 2) {
    blockIds = snapshot.blocks.map((block) => block.id);
  }
  return blockIds;
}

function dispatchDag(
  snapshot: HeliosMapSnapshot,
  args: Record<string, unknown>,
): HeliosMapToolResult {
  const draftRaw = (args.dagDraft as Record<string, unknown> | undefined) || args;
  const blockIds = heliosDagBlockIds(snapshot, args);
  if (blockIds.length < 2) return fail(snapshot, "need_two_blocks");
  const edgesRaw = Array.isArray(draftRaw.edges) ? draftRaw.edges : [];
  const edges: MultiBlockDagEdge[] = [];
  for (const item of edgesRaw) {
    if (!item || typeof item !== "object") continue;
    const e = item as Record<string, unknown>;
    const from = String(e.from ?? "").trim();
    const to = String(e.to ?? "").trim();
    if (!from || !to) continue;
    edges.push({ from, to, kind: e.kind === "lock" ? "lock" : "next" });
  }
  if (edges.length === 0) {
    const ordered = snapshot.blocks
      .filter((block) => blockIds.includes(block.id))
      .sort(
        (a, b) =>
          a.position_y - b.position_y || a.position_x - b.position_x,
      );
    for (let i = 0; i < ordered.length - 1; i += 1) {
      edges.push({
        from: ordered[i].id,
        to: ordered[i + 1].id,
        kind: "next",
      });
    }
  }
  const draft: MultiBlockDagDraft = { blockIds, edges };
  const updates = buildMultiBlockDagApplyUpdates(draft, snapshot.blocks);
  if (updates.length === 0) return fail(snapshot, "dag_empty");
  const byId = new Map(updates.map((u) => [u.blockId, u]));
  return ok(
    {
      ...snapshot,
      blocks: snapshot.blocks.map((b) => {
        const u = byId.get(b.id);
        if (!u) return b;
        return {
          ...b,
          next_block_ids: u.next_block_ids,
          lock_until_block_ids: u.lock_until_block_ids,
        };
      }),
    },
    `dag:${updates.length}`,
  );
}

function dispatchUnusable(
  snapshot: HeliosMapSnapshot,
  args: Record<string, unknown>,
): HeliosMapToolResult {
  const selected = cellsFromArgs(args);
  if (selected.length === 0) return fail(snapshot, "cells_required");
  const next = applyUnusableSelection(selected, snapshot.unusableCells);
  return ok(
    { ...snapshot, unusableCells: next },
    `unusable:${next.length}`,
  );
}

function patchEffects(
  snapshot: HeliosMapSnapshot,
  blockId: string,
  patch: Partial<BlockCreatorEffects>,
): HeliosMapToolResult {
  const block = snapshot.blocks.find((b) => b.id === blockId);
  if (!block) return fail(snapshot, "block_not_found");
  const current = parseBlockCreatorEffects(block.creator_effects, {
    selfBlockId: blockId,
  });
  const merged = normalizeBlockCreatorEffects(
    {
      dynamic: patch.dynamic ?? current.dynamic,
      generator: patch.generator ?? current.generator,
    },
    { selfBlockId: blockId },
  );
  const validated = validateBlockCreatorEffects({
    blockId,
    effects: merged,
    blocks: snapshot.blocks,
    occupiedOrUnusableKeys: new Set([
      ...heliosMapOccupiedKeys(snapshot, [blockId]),
      ...snapshot.unusableCells.map((c) => getCellKey(c.row, c.col)),
    ]),
  });
  if (!validated.ok) return fail(snapshot, validated.error);
  return ok(
    {
      ...snapshot,
      blocks: snapshot.blocks.map((b) =>
        b.id === blockId ? { ...b, creator_effects: validated.effects } : b,
      ),
    },
    `effects:${blockId}`,
  );
}

function dispatchDynamic(
  snapshot: HeliosMapSnapshot,
  args: Record<string, unknown>,
): HeliosMapToolResult {
  const blockId = stringArg(args, "blockId", "id");
  if (!blockId) return fail(snapshot, "block_not_found");
  const enabled = args.enabled !== false;
  const unlockAfterBlockIds = idList(
    args.unlockAfterBlockIds ?? args.unlock_after_block_ids,
  );
  return patchEffects(snapshot, blockId, {
    dynamic: { enabled, unlockAfterBlockIds },
  });
}

function dispatchGenerator(
  snapshot: HeliosMapSnapshot,
  args: Record<string, unknown>,
): HeliosMapToolResult {
  const blockId = stringArg(args, "blockId", "id");
  if (!blockId) return fail(snapshot, "block_not_found");
  const enabled = args.enabled !== false;
  const targetCells = cellsFromArgs({
    cells: args.targetCells ?? args.target_cells ?? args.cells,
  });
  return patchEffects(snapshot, blockId, {
    generator: { enabled, targetCells },
  });
}

function dispatchDelete(
  snapshot: HeliosMapSnapshot,
  args: Record<string, unknown>,
): HeliosMapToolResult {
  const blockId = stringArg(args, "blockId", "id");
  if (!snapshot.blocks.some((b) => b.id === blockId)) {
    return fail(snapshot, "block_not_found");
  }
  return ok(
    {
      ...snapshot,
      blocks: snapshot.blocks.filter((b) => b.id !== blockId),
    },
    `deleted:${blockId}`,
  );
}

function dispatchAddNote(
  snapshot: HeliosMapSnapshot,
  args: Record<string, unknown>,
): HeliosMapToolResult {
  const body = stringArg(args, "body", "text", "note", "title");
  if (!body) return fail(snapshot, "body_required");
  const point = worldPointFromArgs(args) || { x: 0, y: 0 };
  const preferred = stringArg(args, "id", "noteId") || undefined;
  const note = createLearnerMapNote({
    id: preferred,
    body,
    x: point.x,
    y: point.y,
    width: args.width === undefined ? undefined : Number(args.width),
    height: args.height === undefined ? undefined : Number(args.height),
    source: "creator",
  });
  if (snapshot.notes.some((n) => n.id === note.id)) {
    return fail(snapshot, "note_id_taken");
  }
  return ok(
    {
      ...snapshot,
      notes: upsertLearnerMapNote(snapshot.notes, note),
    },
    `note:${note.id}`,
  );
}

function dispatchEditNote(
  snapshot: HeliosMapSnapshot,
  args: Record<string, unknown>,
): HeliosMapToolResult {
  const noteId = stringArg(args, "noteId", "id");
  const note = snapshot.notes.find((n) => n.id === noteId);
  if (!note) return fail(snapshot, "note_not_found");
  const point = worldPointFromArgs(args);
  const patched = updateLearnerMapNote(note, {
    body: args.body !== undefined || args.text !== undefined
      ? stringArg(args, "body", "text")
      : undefined,
    x: point?.x,
    y: point?.y,
    width: args.width === undefined ? undefined : Number(args.width),
    height: args.height === undefined ? undefined : Number(args.height),
  });
  return ok(
    {
      ...snapshot,
      notes: upsertLearnerMapNote(snapshot.notes, patched),
    },
    `note-edited:${noteId}`,
  );
}

function dispatchDeleteNote(
  snapshot: HeliosMapSnapshot,
  args: Record<string, unknown>,
): HeliosMapToolResult {
  const noteId = stringArg(args, "noteId", "id");
  if (!snapshot.notes.some((n) => n.id === noteId)) {
    return fail(snapshot, "note_not_found");
  }
  return ok(
    {
      ...snapshot,
      notes: deleteLearnerMapNote(snapshot.notes, noteId),
    },
    `note-deleted:${noteId}`,
  );
}

function dispatchAddDrawingLayer(
  snapshot: HeliosMapSnapshot,
  args: Record<string, unknown>,
): HeliosMapToolResult {
  const name =
    stringArg(args, "name", "title") ||
    `Layer ${snapshot.annotationLayers.length + 1}`;
  const preferred = stringArg(args, "id", "layerId");
  const layer = createAnnotationLayer({
    id: preferred || undefined,
    name,
  });
  if (snapshot.annotationLayers.some((l) => l.id === layer.id)) {
    return fail(snapshot, "layer_id_taken");
  }
  const next = upsertAnnotationLayer(snapshot.annotationLayers, layer);
  if (next.length === snapshot.annotationLayers.length) {
    return fail(snapshot, "layer_limit");
  }
  return ok(
    { ...snapshot, annotationLayers: next },
    `layer:${layer.id}`,
  );
}

function annotationKindFromArgs(
  args: Record<string, unknown>,
): AnnotationStrokeKind {
  const kind = stringArg(args, "kind", "tool", "shape");
  if (kind === "circle" || kind === "square" || kind === "freehand") return kind;
  return "freehand";
}

function dispatchDrawOnLayer(
  snapshot: HeliosMapSnapshot,
  args: Record<string, unknown>,
): HeliosMapToolResult {
  const layerId = stringArg(args, "layerId", "id");
  const layer = snapshot.annotationLayers.find((l) => l.id === layerId);
  if (!layer) return fail(snapshot, "layer_not_found");
  const kind = annotationKindFromArgs(args);
  const cells = cellsFromArgs(args);
  const startArg =
    args.start && typeof args.start === "object"
      ? worldPointFromArgs(args.start as Record<string, unknown>)
      : null;
  const endArg =
    args.end && typeof args.end === "object"
      ? worldPointFromArgs(args.end as Record<string, unknown>)
      : null;
  let start = startArg;
  let end = endArg;
  let points: Array<{ x: number; y: number }> | undefined;

  if (kind === "freehand") {
    if (Array.isArray(args.points)) {
      points = [];
      for (const item of args.points) {
        if (!item || typeof item !== "object") continue;
        const pt = worldPointFromArgs(item as Record<string, unknown>);
        if (pt) points.push(heliosCellCenterFromPoint(pt, item as Record<string, unknown>));
      }
    }
    if ((!points || points.length === 0) && cells.length > 0) {
      points = cells.map(heliosCellCenter);
    }
    if (!points || points.length === 0) {
      const one = worldPointFromArgs(args);
      if (!one) return fail(snapshot, "points_required");
      points = [one];
    }
    start = points[0];
    end = points[points.length - 1];
  } else if (kind === "circle") {
    const center =
      worldPointFromArgs(args) ||
      (cells[0] ? heliosCellCenter(cells[0]) : null);
    if (!center) return fail(snapshot, "cell_required");
    const radiusCells = Number(args.radiusCells);
    const radiusWorld = Number(args.radius);
    const r = Number.isFinite(radiusWorld)
      ? radiusWorld
      : Number.isFinite(radiusCells)
        ? radiusCells * SKILL_GRID_PITCH
        : SKILL_GRID_CELL_SIZE / 2;
    start = { x: center.x - r, y: center.y };
    end = { x: center.x + r, y: center.y };
  } else {
    if (cells.length >= 1) {
      const rows = cells.map((c) => c.row);
      const cols = cells.map((c) => c.col);
      const minR = Math.min(...rows);
      const maxR = Math.max(...rows);
      const minC = Math.min(...cols);
      const maxC = Math.max(...cols);
      start = heliosWorldFromCell({ row: minR, col: minC });
      end = {
        x: heliosWorldFromCell({ row: maxR, col: maxC }).x + SKILL_GRID_CELL_SIZE,
        y: heliosWorldFromCell({ row: maxR, col: maxC }).y + SKILL_GRID_CELL_SIZE,
      };
    } else if (start && end) {
      // already set
    } else {
      const origin = worldPointFromArgs(args);
      if (!origin) return fail(snapshot, "cell_required");
      const w = Number.isFinite(Number(args.width))
        ? Number(args.width)
        : SKILL_GRID_CELL_SIZE;
      const h = Number.isFinite(Number(args.height))
        ? Number(args.height)
        : SKILL_GRID_CELL_SIZE;
      start = origin;
      end = { x: origin.x + w, y: origin.y + h };
    }
  }

  const stroke = buildAnnotationStrokeFromGesture({
    kind,
    start: start || { x: 0, y: 0 },
    end: end || start || { x: 0, y: 0 },
    points,
    id: stringArg(args, "strokeId") || undefined,
  });
  const updated = appendAnnotationStroke(layer, stroke);
  return ok(
    {
      ...snapshot,
      annotationLayers: upsertAnnotationLayer(
        snapshot.annotationLayers,
        updated,
      ),
    },
    `drew:${layer.id}:${kind}`,
  );
}

function heliosCellCenterFromPoint(
  point: { x: number; y: number },
  raw: Record<string, unknown>,
): { x: number; y: number } {
  if (Number.isFinite(Number(raw.x)) && Number.isFinite(Number(raw.y))) {
    return point;
  }
  return {
    x: point.x + SKILL_GRID_CELL_SIZE / 2,
    y: point.y + SKILL_GRID_CELL_SIZE / 2,
  };
}

function dispatchDeleteDrawingLayer(
  snapshot: HeliosMapSnapshot,
  args: Record<string, unknown>,
): HeliosMapToolResult {
  const layerId = stringArg(args, "layerId", "id");
  if (!snapshot.annotationLayers.some((l) => l.id === layerId)) {
    return fail(snapshot, "layer_not_found");
  }
  return ok(
    {
      ...snapshot,
      annotationLayers: deleteAnnotationLayer(
        snapshot.annotationLayers,
        layerId,
        { learnerMode: false, viewOnly: false },
      ),
    },
    `layer-deleted:${layerId}`,
  );
}

/**
 * Apply one Helios tool to a map snapshot using shipped Manual authoring
 * helpers. This is the mutate path tests and Helios Chat share.
 */
export function dispatchHeliosMapTool(
  snapshot: HeliosMapSnapshot,
  call: HeliosMapToolCall | { name: string; args?: Record<string, unknown> },
): HeliosMapToolResult {
  snapshot = withOverlay(snapshot);
  const name = call.name;
  const args = call.args && typeof call.args === "object" ? call.args : {};
  if (!isHeliosMapToolId(name)) return fail(snapshot, "unknown_tool");
  switch (name) {
    case "add_block":
      return dispatchAdd(snapshot, args);
    case "generate_shape":
      return dispatchGenerateShape(snapshot, args);
    case "split_block":
      return dispatchSplit(snapshot, args);
    case "clone_block":
      return dispatchClone(snapshot, args);
    case "edit_block":
      return dispatchEdit(snapshot, args);
    case "expand_block":
      return dispatchExpand(snapshot, args);
    case "combine_blocks":
      return dispatchCombine(snapshot, args);
    case "bridge_blocks":
      return dispatchBridge(snapshot, args);
    case "cluster_blocks":
      return dispatchCluster(snapshot, args);
    case "apply_dag":
      return dispatchDag(snapshot, args);
    case "mark_unusable":
      return dispatchUnusable(snapshot, args);
    case "set_dynamic_effect":
      return dispatchDynamic(snapshot, args);
    case "set_generator_effect":
      return dispatchGenerator(snapshot, args);
    case "delete_block":
      return dispatchDelete(snapshot, args);
    case "add_note":
      return dispatchAddNote(snapshot, args);
    case "edit_note":
      return dispatchEditNote(snapshot, args);
    case "delete_note":
      return dispatchDeleteNote(snapshot, args);
    case "add_drawing_layer":
      return dispatchAddDrawingLayer(snapshot, args);
    case "draw_on_layer":
      return dispatchDrawOnLayer(snapshot, args);
    case "delete_drawing_layer":
      return dispatchDeleteDrawingLayer(snapshot, args);
    default:
      return fail(snapshot, "unknown_tool");
  }
}

export type HeliosMapToolHost = {
  /**
   * Paint the dispatched snapshot on the Learning Map immediately, before
   * Manual persist APIs finish. This is how Helios work shows up atomically.
   */
  applySnapshot?: (snapshot: HeliosMapSnapshot) => void;
  saveNotes?: (notes: LearnerMapNote[]) => void | Promise<void>;
  saveAnnotationLayers?: (
    layers: AnnotationLayer[],
  ) => void | Promise<void>;
  addBlock?: (input: {
    prompt: string;
    cell: { row: number; col: number };
  }) => Promise<void>;
  generateShape?: (input: {
    prompt: string;
    cells: Array<{ row: number; col: number }>;
  }) => Promise<void>;
  splitBlock?: (input: { blockId: string; prompt?: string }) => Promise<void>;
  cloneBlock?: (input: {
    blockId: string;
    cell: { row: number; col: number };
  }) => Promise<void>;
  editBlock?: (input: {
    blockId: string;
    title: string;
    description: string;
  }) => Promise<void>;
  expandBlock?: (input: {
    blockId: string;
    prompt?: string;
    range: number;
    density: number;
    frozenSlots: Array<{ row: number; col: number }>;
  }) => Promise<void>;
  combineBlocks?: (input: {
    blockIds: string[];
    prompt?: string;
  }) => Promise<void>;
  generateBridge?: (input: {
    blockIds: string[];
    density: number;
    width?: number;
    userPrompt?: string;
    frozenSlots: Array<{ row: number; col: number }>;
    blockTitles: string[];
  }) => Promise<void>;
  clusterBlocks?: (input: {
    blockIds: string[];
    placements: Array<{ id: string; position_x: number; position_y: number }>;
    clusterCount: number;
    separation?: number;
    prompt?: string;
  }) => Promise<void>;
  applyDag?: (input: {
    blockIds: string[];
    dagDraft: MultiBlockDagDraft;
  }) => Promise<void>;
  setUnusableCells?: (
    cells: Array<{ row: number; col: number }>,
  ) => Promise<void>;
  saveCreatorEffects?: (input: {
    blockId: string;
    effects: BlockCreatorEffects;
  }) => Promise<void>;
  deleteBlock?: (blockId: string) => Promise<void>;
};

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

export type HeliosMapAtomicStep = {
  index: number;
  call: HeliosMapToolCall;
  result: HeliosMapToolResult;
  snapshot: HeliosMapSnapshot;
};

/**
 * Apply each tool as its own map mutation: paint the snapshot, then persist.
 * The Learning Map updates per tool instead of waiting for a full chat turn.
 */
export async function applyHeliosMapToolsAtomically(input: {
  snapshot: HeliosMapSnapshot;
  calls: readonly HeliosMapToolCall[];
  host?: HeliosMapToolHost | null;
  onStep?: (step: HeliosMapAtomicStep) => void | Promise<void>;
}): Promise<{ snapshot: HeliosMapSnapshot; steps: HeliosMapAtomicStep[] }> {
  let next = input.snapshot;
  const steps: HeliosMapAtomicStep[] = [];
  for (let index = 0; index < input.calls.length; index += 1) {
    const call = input.calls[index];
    const previous = next;
    const result = input.host
      ? await executeHeliosMapToolCall({
          snapshot: previous,
          call,
          host: input.host,
        })
      : dispatchHeliosMapTool(previous, call);
    if (result.ok) next = result.snapshot;
    const step: HeliosMapAtomicStep = {
      index,
      call,
      result,
      snapshot: next,
    };
    steps.push(step);
    await input.onStep?.(step);
  }
  return { snapshot: next, steps };
}

function addedCellsFromPreview(
  before: HeliosMapSnapshot,
  after: HeliosMapSnapshot,
): Array<{ row: number; col: number }> {
  const prevIds = new Set(before.blocks.map((b) => b.id));
  return after.blocks
    .filter((b) => !prevIds.has(b.id))
    .map((b) => ({ row: b.position_y, col: b.position_x }));
}

/**
 * Validate via dispatch, paint the map immediately, then persist through
 * the same Manual drawer APIs from the dispatched snapshot.
 */
export async function executeHeliosMapToolCall(input: {
  snapshot: HeliosMapSnapshot;
  call: HeliosMapToolCall;
  host?: HeliosMapToolHost | null;
}): Promise<HeliosMapToolResult> {
  const preview = dispatchHeliosMapTool(input.snapshot, input.call);
  if (!preview.ok) return preview;
  const host = input.host;
  if (!host) return preview;
  host.applySnapshot?.(preview.snapshot);
  const { name, args } = input.call;
  try {
    if (name === "add_block" && host.addBlock) {
      const cell = resolveAddCell(input.snapshot, args);
      await host.addBlock({
        prompt: stringArg(args, "prompt", "title") || "Untitled",
        cell,
      });
    } else if (name === "generate_shape" && host.generateShape) {
      await host.generateShape({
        prompt: stringArg(args, "prompt", "title") || "Untitled",
        cells: cellsFromArgs(args),
      });
    } else if (name === "split_block" && host.splitBlock) {
      await host.splitBlock({
        blockId: stringArg(args, "blockId", "id"),
        prompt: stringArg(args, "prompt") || undefined,
      });
    } else if (name === "clone_block" && host.cloneBlock) {
      const cell = cellFromArgs(args);
      if (cell) {
        await host.cloneBlock({
          blockId: stringArg(args, "blockId", "sourceBlockId", "id"),
          cell,
        });
      }
    } else if (name === "edit_block" && host.editBlock) {
      const blockId = stringArg(args, "blockId", "id");
      const prev = input.snapshot.blocks.find((b) => b.id === blockId);
      await host.editBlock({
        blockId,
        title: stringArg(args, "title") || prev?.title || "Untitled",
        description:
          typeof args.description === "string"
            ? args.description
            : prev?.description || "",
      });
    } else if (name === "expand_block" && host.expandBlock) {
      const range = Number.isFinite(Number(args.range))
        ? Number(args.range)
        : 2;
      const density = Number.isFinite(Number(args.density))
        ? Number(args.density)
        : 50;
      await host.expandBlock({
        blockId: stringArg(args, "blockId", "id"),
        prompt: stringArg(args, "prompt") || undefined,
        range,
        density,
        frozenSlots: addedCellsFromPreview(input.snapshot, preview.snapshot),
      });
    } else if (name === "combine_blocks" && host.combineBlocks) {
      await host.combineBlocks({
        blockIds: idList(args.blockIds ?? args.ids),
        prompt: stringArg(args, "prompt") || undefined,
      });
    } else if (name === "bridge_blocks" && host.generateBridge) {
      const ids = idList(args.blockIds ?? args.ids);
      const targets = input.snapshot.blocks.filter((b) => ids.includes(b.id));
      const density = Number.isFinite(Number(args.density))
        ? Number(args.density)
        : 100;
      const width = heliosBridgeWidthFromArgs(args);
      await host.generateBridge({
        blockIds: ids,
        density,
        width,
        userPrompt: stringArg(args, "prompt") || undefined,
        frozenSlots: addedCellsFromPreview(input.snapshot, preview.snapshot),
        blockTitles: targets.map((b) => String(b.title || b.id)),
      });
    } else if (name === "cluster_blocks" && host.clusterBlocks) {
      const ids = idList(args.blockIds ?? args.ids);
      await host.clusterBlocks({
        blockIds: ids,
        placements: preview.snapshot.blocks
          .filter((b) => ids.includes(b.id))
          .map((b) => ({
            id: b.id,
            position_x: b.position_x,
            position_y: b.position_y,
          })),
        clusterCount: Number(args.clusterCount) || ids.length,
        separation:
          args.separation === undefined ? undefined : Number(args.separation),
        prompt: stringArg(args, "prompt") || undefined,
      });
    } else if (name === "apply_dag" && host.applyDag) {
      const blockIds = heliosDagBlockIds(input.snapshot, args);
      const dagDraft = draftMultiBlockDag(blockIds, preview.snapshot.blocks);
      await host.applyDag({
        blockIds: dagDraft.blockIds,
        dagDraft,
      });
    } else if (name === "mark_unusable" && host.setUnusableCells) {
      await host.setUnusableCells(preview.snapshot.unusableCells);
    } else if (
      (name === "set_dynamic_effect" || name === "set_generator_effect") &&
      host.saveCreatorEffects
    ) {
      const blockId = stringArg(args, "blockId", "id");
      const updated = preview.snapshot.blocks.find((b) => b.id === blockId);
      if (updated) {
        await host.saveCreatorEffects({
          blockId,
          effects: parseBlockCreatorEffects(updated.creator_effects, {
            selfBlockId: blockId,
          }),
        });
      }
    } else if (name === "delete_block" && host.deleteBlock) {
      await host.deleteBlock(stringArg(args, "blockId", "id"));
    } else if (
      (name === "add_note" ||
        name === "edit_note" ||
        name === "delete_note") &&
      host.saveNotes
    ) {
      await host.saveNotes(preview.snapshot.notes);
    } else if (
      (name === "add_drawing_layer" ||
        name === "draw_on_layer" ||
        name === "delete_drawing_layer") &&
      host.saveAnnotationLayers
    ) {
      await host.saveAnnotationLayers(preview.snapshot.annotationLayers);
    }
  } catch (err) {
    host.applySnapshot?.(input.snapshot);
    return fail(
      input.snapshot,
      err instanceof Error ? err.message : "host_failed",
    );
  }
  return preview;
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
