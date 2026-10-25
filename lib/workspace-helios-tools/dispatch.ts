/**
 * Pure Helios Learning Map tool dispatch. Mutates a snapshot with shipped
 * Manual authoring helpers. Distinct from executeHeliosMapToolCall persist.
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
} from "@/lib/map-ground-rules";
import {
  appendAnnotationStroke,
  buildAnnotationStrokeFromGesture,
  createAnnotationLayer,
  deleteAnnotationLayer,
  upsertAnnotationLayer,
  type AnnotationStrokeKind,
} from "@/lib/map-annotation-layers";
import {
  createLearnerMapNote,
  deleteLearnerMapNote,
  updateLearnerMapNote,
  upsertLearnerMapNote,
} from "@/lib/learner-map-notes";
import {
  buildMultiBlockDagApplyUpdates,
  type MultiBlockDagDraft,
  type MultiBlockDagEdge,
} from "@/lib/multi-block-dag";
import {
  mergeBlocksToFreeform,
  placedBlockCells,
  selectionIsFreeformLectureShape,
  splitBlocksToSingles,
} from "@/lib/skill-grid-ops";
import { isHeliosMapToolId } from "./catalog";
import {
  heliosMapOccupiedKeys,
  nextOpenHeliosCell,
  toPlaced,
  withOverlay,
  type HeliosMapBlock,
  type HeliosMapSnapshot,
  type HeliosMapToolCall,
  type HeliosMapToolResult,
} from "./snapshot";

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

function finiteCell(raw: unknown): { row: number; col: number } | null {
  if (!raw || typeof raw !== "object") return null;
  const rec = raw as Record<string, unknown>;
  const row = Number(rec.row ?? rec.r ?? rec.y ?? rec.position_y);
  const col = Number(rec.col ?? rec.c ?? rec.x ?? rec.position_x);
  if (!Number.isFinite(row) || !Number.isFinite(col)) return null;
  return { row: Math.trunc(row), col: Math.trunc(col) };
}

export function resolveAddCell(
  snapshot: HeliosMapSnapshot,
  args: Record<string, unknown>,
): { row: number; col: number } {
  return cellFromArgs(args) || nextOpenHeliosCell(snapshot);
}

export function cellFromArgs(
  args: Record<string, unknown>,
): { row: number; col: number } | null {
  const nested = finiteCell(args.cell ?? args.target ?? args.position);
  if (nested) return nested;
  return finiteCell(args);
}

export function cellsFromArgs(args: Record<string, unknown>): Array<{ row: number; col: number }> {
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

export function stringArg(args: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const v = args[key];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return "";
}

export function idList(raw: unknown): string[] {
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

export function fail(
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

export function heliosDagBlockIds(
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
