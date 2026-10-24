/**
 * TAP Learning Work canvas placement: apply, merge, settle, overlap, origins.
 */
import { stripLearnerFacingWrappers } from "@/lib/session-format-wrapper";
import { ILE_WORK_CANVAS_OVERLAP_GAP } from "@/lib/learn-work-canvas-commands";
import {
  ileWorkCanvasNormalizedRect,
  ileWorkCanvasPositiveAreaOverlap,
  ileWorkCanvasRectsOverlap,
} from "@/lib/learn-work-canvas-geometry";
import {
  DEFAULT_DIMENSION,
  ILE_AUTO_LAYOUT_APP_STATE_KEY,
  ILE_XAI_CANVAS_CUSTOM_DATA_KEY,
  ILE_XAI_LOADING_CUSTOM_DATA_KEY,
  ILE_XAI_LOADING_TEXT,
  ILE_WORK_CANVAS_TEXT_BOX_WIDTH,
  TEXT_ORIGIN_X,
  TEXT_ORIGIN_Y,
  asRecord,
  convertToExcalidrawElements,
  ileWorkCanvasContentBounds,
  ileWorkCanvasFiniteOrigin,
  ileWorkCanvasXaiNoteSkeletons,
  nextXaiTextOrigin,
  normalizeExtraSkeletons,
  serializeIleWorkCanvasScene,
  type IleWorkCanvasAppState,
  type IleWorkCanvasElement,
  type IleWorkCanvasScene,
  type IleWorkCanvasSkeleton,
  type IleXaiCanvasTurnPayload,
} from "@/lib/learn-work-canvas-scene";
import {
  ileXaiReplyIsCanvasJson,
  parseIleXaiCanvasTurn,
} from "@/lib/learn-work-canvas-xai";

export function ileWorkCanvasAutoLayoutEnabled(
  appState: IleWorkCanvasAppState | null | undefined,
): boolean {
  return asRecord(appState)[ILE_AUTO_LAYOUT_APP_STATE_KEY] === true;
}

type IleLayoutUnit = {
  members: IleWorkCanvasElement[];
  minX: number;
  minY: number;
  width: number;
  height: number;
};

const ILE_LAYOUT_DRAWING_GAP = 32;
const ILE_LAYOUT_SCHEMA_SNAP = 28;

function ileWorkCanvasBindingTargetId(raw: unknown): string | null {
  if (!raw || typeof raw !== "object") return null;
  const id = (raw as { elementId?: unknown }).elementId;
  return typeof id === "string" && id.trim() ? id : null;
}

function ileWorkCanvasBoundEntryId(raw: unknown): string | null {
  if (!raw || typeof raw !== "object") return null;
  const id = (raw as { id?: unknown }).id;
  return typeof id === "string" && id.trim() ? id : null;
}

function ileWorkCanvasLayoutRect(el: IleWorkCanvasElement): {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
} {
  const rect = ileWorkCanvasNormalizedRect(el);
  if (rect) return rect;
  const x = Number(el.x) || 0;
  const y = Number(el.y) || 0;
  const w = Math.max(1, Math.abs(Number(el.width) || 0));
  const h = Math.max(1, Math.abs(Number(el.height) || 0));
  return { minX: x, minY: y, maxX: x + w, maxY: y + h };
}

function ileWorkCanvasConnectorEnds(el: IleWorkCanvasElement): { x: number; y: number }[] {
  const x = Number(el.x) || 0;
  const y = Number(el.y) || 0;
  const pts = Array.isArray(el.points)
    ? el.points.filter((point) => Array.isArray(point) && point.length >= 2)
    : [];
  if (pts.length >= 2) {
    const first = pts[0]!;
    const last = pts[pts.length - 1]!;
    return [
      { x: x + (Number(first[0]) || 0), y: y + (Number(first[1]) || 0) },
      { x: x + (Number(last[0]) || 0), y: y + (Number(last[1]) || 0) },
    ];
  }
  return [
    { x, y },
    { x: x + (Number(el.width) || 0), y: y + (Number(el.height) || 0) },
  ];
}

function ileWorkCanvasPointInRect(
  point: { x: number; y: number },
  box: { minX: number; minY: number; maxX: number; maxY: number },
  pad: number,
): boolean {
  return (
    point.x >= box.minX - pad &&
    point.x <= box.maxX + pad &&
    point.y >= box.minY - pad &&
    point.y <= box.maxY + pad
  );
}

/**
 * One layout unit is a whole composition: a labeled note, a group, a frame,
 * an arrow-linked schema, or a nearby freedraw. Loose notes stay separate so
 * masonry can un-overlap them without tearing drawings apart.
 */
function ileWorkCanvasLayoutUnits(elements: readonly IleWorkCanvasElement[]): IleLayoutUnit[] {
  const live = elements.filter((el) => !el.isDeleted);
  if (!live.length) return [];
  const parent = new Map<string, string>();
  for (const el of live) parent.set(el.id, el.id);
  const find = (id: string): string => {
    const next = parent.get(id) ?? id;
    if (next === id) return id;
    const root = find(next);
    parent.set(id, root);
    return root;
  };
  const union = (a: string | null | undefined, b: string | null | undefined) => {
    const left = String(a || "");
    const right = String(b || "");
    if (!parent.has(left) || !parent.has(right)) return;
    const pa = find(left);
    const pb = find(right);
    if (pa !== pb) parent.set(pa, pb);
  };

  for (const el of live) {
    if (typeof el.containerId === "string" && el.containerId) union(el.id, el.containerId);
    if (typeof el.frameId === "string" && el.frameId) union(el.id, el.frameId);
    union(el.id, ileWorkCanvasBindingTargetId(el.startBinding));
    union(el.id, ileWorkCanvasBindingTargetId(el.endBinding));
    const bound = Array.isArray(el.boundElements) ? el.boundElements : [];
    for (const entry of bound) union(el.id, ileWorkCanvasBoundEntryId(entry));
  }

  const byGroup = new Map<string, string[]>();
  for (const el of live) {
    for (const groupId of el.groupIds ?? []) {
      const key = String(groupId || "").trim();
      if (!key) continue;
      const list = byGroup.get(key) ?? [];
      list.push(el.id);
      byGroup.set(key, list);
    }
  }
  for (const ids of byGroup.values()) {
    for (let i = 1; i < ids.length; i += 1) union(ids[0], ids[i]);
  }

  const strokes = live.filter((el) => el.type === "freedraw");
  for (let i = 0; i < strokes.length; i += 1) {
    const a = ileWorkCanvasLayoutRect(strokes[i]!);
    for (let j = i + 1; j < strokes.length; j += 1) {
      if (ileWorkCanvasRectsOverlap(a, ileWorkCanvasLayoutRect(strokes[j]!), ILE_LAYOUT_DRAWING_GAP)) {
        union(strokes[i]!.id, strokes[j]!.id);
      }
    }
    for (const other of live) {
      if (other.id === strokes[i]!.id || other.type === "text" || other.type === "freedraw") continue;
      const b = ileWorkCanvasNormalizedRect(other);
      if (!b) continue;
      if (
        ileWorkCanvasPositiveAreaOverlap(a, b) ||
        ileWorkCanvasRectsOverlap(a, b, 8)
      ) {
        union(strokes[i]!.id, other.id);
      }
    }
  }

  for (const el of live) {
    if (el.type !== "arrow" && el.type !== "line") continue;
    const ends = ileWorkCanvasConnectorEnds(el);
    for (const other of live) {
      if (other.id === el.id) continue;
      if (other.type === "text" && typeof other.containerId === "string" && other.containerId) continue;
      const box = ileWorkCanvasLayoutRect(other);
      if (ends.some((point) => ileWorkCanvasPointInRect(point, box, ILE_LAYOUT_SCHEMA_SNAP))) {
        union(el.id, other.id);
      }
    }
  }

  const clusters = new Map<string, IleWorkCanvasElement[]>();
  for (const el of live) {
    const root = find(el.id);
    const members = clusters.get(root) ?? [];
    members.push(el);
    clusters.set(root, members);
  }
  const units: IleLayoutUnit[] = [];
  for (const members of clusters.values()) {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const el of members) {
      const rect = ileWorkCanvasLayoutRect(el);
      minX = Math.min(minX, rect.minX);
      minY = Math.min(minY, rect.minY);
      maxX = Math.max(maxX, rect.maxX);
      maxY = Math.max(maxY, rect.maxY);
    }
    if (!Number.isFinite(minX)) continue;
    units.push({
      members,
      minX,
      minY,
      width: Math.max(1, maxX - minX),
      height: Math.max(1, maxY - minY),
    });
  }
  return units;
}

/**
 * Masonry pack of whole compositions (notes, drawings, linked schemas).
 * Members of a unit keep their relative geometry. Origin stays put so the
 * board does not jump.
 */
export function layoutIleWorkCanvasBoard(
  scene: IleWorkCanvasScene | null | undefined,
  gap = ILE_WORK_CANVAS_OVERLAP_GAP + 8,
): IleWorkCanvasScene {
  const current = serializeIleWorkCanvasScene(scene);
  const units = ileWorkCanvasLayoutUnits(current.elements);
  if (units.length < 2) return current;
  const originX = Math.min(...units.map((unit) => unit.minX));
  const originY = Math.min(...units.map((unit) => unit.minY));
  const ordered = [...units].sort((a, b) => a.minY - b.minY || a.minX - b.minX);
  const totalArea = ordered.reduce((sum, unit) => sum + unit.width * unit.height, 0);
  const maxColH = Math.max(
    420,
    Math.round(Math.sqrt(Math.max(1, totalArea)) * 1.35),
    Math.max(...ordered.map((unit) => unit.height)),
  );
  type Col = { x: number; y: number; height: number; width: number };
  const columns: Col[] = [{ x: originX, y: originY, height: 0, width: 0 }];
  const placed = new Map<string, { x: number; y: number }>();
  for (const unit of ordered) {
    let col = columns.reduce((shortest, item) => (item.height < shortest.height ? item : shortest));
    if (col.height > 0 && col.height + unit.height + gap > maxColH) {
      const right = Math.max(...columns.map((item) => item.x + item.width));
      col = { x: right + gap, y: originY, height: 0, width: 0 };
      columns.push(col);
    }
    placed.set(unit.members[0]!.id, { x: col.x, y: originY + col.height });
    col.height += unit.height + gap;
    col.width = Math.max(col.width, unit.width);
  }
  const movedById = new Map<string, IleWorkCanvasElement>();
  for (const unit of ordered) {
    const target = placed.get(unit.members[0]!.id);
    if (!target) continue;
    const dx = target.x - unit.minX;
    const dy = target.y - unit.minY;
    if (dx === 0 && dy === 0) continue;
    for (const el of unit.members) {
      movedById.set(el.id, {
        ...el,
        x: el.x + dx,
        y: el.y + dy,
        version: (Number(el.version) || 1) + 1,
      });
    }
  }
  if (!movedById.size) return current;
  return {
    ...current,
    elements: current.elements.map((el) => movedById.get(el.id) ?? el),
  };
}

export function withIleWorkCanvasAutoLayout(
  scene: IleWorkCanvasScene | null | undefined,
): IleWorkCanvasScene {
  const current = serializeIleWorkCanvasScene(scene);
  if (!ileWorkCanvasAutoLayoutEnabled(current.appState)) return current;
  return layoutIleWorkCanvasBoard(current);
}

/**
 * Merge an XAI turn onto the chapter board: response text becomes a real
 * `type: "text"` element (plus optional extra skeletons), via the skeleton converter.
 */
export type IleWorkCanvasPlacementOptions = {
  /** Tried when the model origin is missing or its real footprint overlaps. */
  fallbackOrigin?: { x?: number; y?: number } | null;
  /** In-flight drops that are not scene elements yet (loading-square slots). */
  reserved?: readonly { x: number; y: number }[] | null;
};

export function applyIleXaiTurnToWorkCanvas(
  scene: IleWorkCanvasScene | null | undefined,
  payload: IleXaiCanvasTurnPayload,
  options?: IleWorkCanvasPlacementOptions | null,
): IleWorkCanvasScene {
  const current = serializeIleWorkCanvasScene(scene);
  let text = stripLearnerFacingWrappers(String(payload.text || "").trim());
  let extra = normalizeExtraSkeletons(payload.elements);
  let originInput = payload.origin;
  if (ileXaiReplyIsCanvasJson(text)) {
    const parsed = parseIleXaiCanvasTurn(text);
    text = stripLearnerFacingWrappers(String(parsed.text || "").trim());
    if (extra.length === 0) extra = normalizeExtraSkeletons(parsed.elements);
    if (!ileWorkCanvasFiniteOrigin(originInput)) originInput = parsed.origin ?? originInput;
  }
  if (!text && extra.length === 0) return current;

  const modelOrigin = ileWorkCanvasFiniteOrigin(originInput);
  const fallbackOrigin = ileWorkCanvasFiniteOrigin(options?.fallbackOrigin);
  const candidates: { x: number; y: number }[] = [];
  if (modelOrigin) candidates.push(modelOrigin);
  if (
    fallbackOrigin &&
    (!modelOrigin || fallbackOrigin.x !== modelOrigin.x || fallbackOrigin.y !== modelOrigin.y)
  ) {
    candidates.push(fallbackOrigin);
  }
  if (!candidates.length) candidates.push(nextXaiTextOrigin(current.elements));

  const turnId = String(payload.turnId || `turn-${Date.now()}`);
  const customData = {
    [ILE_XAI_CANVAS_CUSTOM_DATA_KEY]: true,
    turnId,
    author: "xai",
  };
  const materialize = (origin: { x: number; y: number }): IleWorkCanvasElement[] => {
    const skeletons: IleWorkCanvasSkeleton[] = [];
    let extraY = origin.y;
    if (text) {
      const notes = ileWorkCanvasXaiNoteSkeletons({
        text,
        x: origin.x,
        y: origin.y,
        width: payload.textWidth,
        customData,
      });
      skeletons.push(...notes);
      extraY = origin.y + (Number(notes[0]?.height) || 0) + 16;
    }
    for (const item of extra) {
      const x = item.x == null ? origin.x : Number(item.x);
      const y = item.y == null ? extraY : Number(item.y);
      extraY = y + (Number(item.height) || DEFAULT_DIMENSION) + 16;
      skeletons.push({
        ...item,
        x,
        y,
        customData: { ...customData, ...(item.customData ?? {}) },
      });
    }
    return convertToExcalidrawElements(skeletons);
  };

  const obstacles = ileWorkCanvasPlacementObstacles(current.elements, options?.reserved);
  let incoming: IleWorkCanvasElement[] | null = null;
  for (const origin of candidates) {
    const built = separateIleWorkCanvasGroupOverlaps(materialize(origin));
    if (!ileWorkCanvasIncomingOverlapsObstacles(built, obstacles)) {
      incoming = built;
      break;
    }
  }
  if (!incoming) {
    incoming = settleIleWorkCanvasIncoming(materialize(candidates[0]!), obstacles);
  }
  return withIleWorkCanvasAutoLayout({
    elements: [...current.elements, ...incoming],
    appState: current.appState,
    files: current.files,
  });
}

/**
 * Chat commit. The snapshot is what the model saw. When the reply lands on
 * the focused board, place it on the live scene so marks drawn during the
 * request are obstacles, not something the reply overwrites.
 */
export function applyIleXaiTurnAtCommit(input: {
  snapshot: IleWorkCanvasScene | null | undefined;
  live?: IleWorkCanvasScene | null;
  applyLive: boolean;
  payload: IleXaiCanvasTurnPayload;
}): { scene: IleWorkCanvasScene; appended: IleWorkCanvasElement[] } {
  const base = serializeIleWorkCanvasScene(
    input.applyLive ? (input.live ?? input.snapshot) : input.snapshot,
  );
  const scene = applyIleXaiTurnToWorkCanvas(base, input.payload);
  const baseIds = new Set(base.elements.map((el) => el.id));
  return {
    scene,
    appended: scene.elements.filter((el) => !baseIds.has(el.id)),
  };
}

export function isIleXaiLoadingElement(el: IleWorkCanvasElement | null | undefined): boolean {
  return Boolean(el?.customData?.[ILE_XAI_LOADING_CUSTOM_DATA_KEY]);
}

/**
 * Portrait thinking plate. Occupancy matches the overlay so rotating copy
 * cannot resize it. Legacy square fixtures still use ILE_XAI_LOADING_BOX_*.
 */
export const ILE_XAI_THINKING_OVERLAY_WIDTH = 156;
export const ILE_XAI_THINKING_OVERLAY_HEIGHT = 220;
export const ILE_XAI_REPLY_RESERVE_HEIGHT = ILE_XAI_THINKING_OVERLAY_HEIGHT;
/** Legacy square used by placement fixtures. */
export const ILE_XAI_LOADING_BOX_SIZE = 128;
export const ILE_XAI_LOADING_BOX_WIDTH = ILE_XAI_LOADING_BOX_SIZE;
export const ILE_XAI_LOADING_BOX_HEIGHT = ILE_XAI_LOADING_BOX_SIZE;
export const ILE_XAI_LOADING_GAP = 28;
export const ILE_XAI_LOADING_CLEARANCE = 16;

/** Scene origin after dragging the thinking plate. Screen pixels divide by zoom. */
export function ileWorkCanvasDragThinkingOrigin(input: {
  origin: { x: number; y: number };
  startClientX: number;
  startClientY: number;
  clientX: number;
  clientY: number;
  zoom?: number;
}): { x: number; y: number } {
  const zoom = Number(input.zoom);
  const scale = Number.isFinite(zoom) && zoom > 0 ? zoom : 1;
  return {
    x: input.origin.x + (input.clientX - input.startClientX) / scale,
    y: input.origin.y + (input.clientY - input.startClientY) / scale,
  };
}

/** Same box occupancy and overlay markup share so rotating copy cannot resize it. */
export function ileWorkCanvasThinkingOverlayStyle(): {
  width: number;
  height: number;
  minWidth: number;
  minHeight: number;
  maxWidth: number;
  maxHeight: number;
} {
  return {
    width: ILE_XAI_THINKING_OVERLAY_WIDTH,
    height: ILE_XAI_THINKING_OVERLAY_HEIGHT,
    minWidth: ILE_XAI_THINKING_OVERLAY_WIDTH,
    minHeight: ILE_XAI_THINKING_OVERLAY_HEIGHT,
    maxWidth: ILE_XAI_THINKING_OVERLAY_WIDTH,
    maxHeight: ILE_XAI_THINKING_OVERLAY_HEIGHT,
  };
}

/**
 * One overlay id per in-flight prompt. A canvas ask occupies that prompt so
 * `heliosBusy` does not add a second "helios" chip for the same wait.
 */
export function ileWorkCanvasThinkingOccupancy(input: {
  heliosBusy?: boolean;
  canvasAskTurnIds?: readonly string[] | null;
}): string[] {
  const askIds: string[] = [];
  const seen = new Set<string>();
  for (const raw of input.canvasAskTurnIds ?? []) {
    const id = String(raw || "").trim();
    if (!id || id === "helios" || seen.has(id)) continue;
    seen.add(id);
    askIds.push(id);
  }
  if (askIds.length > 0) return askIds;
  if (input.heliosBusy) return ["helios"];
  return [];
}

function ileWorkCanvasCollisionMembers(
  incoming: readonly IleWorkCanvasElement[],
): IleWorkCanvasElement[] {
  return incoming.filter((el) => !el.isDeleted);
}

type IleWorkCanvasMark = Pick<IleWorkCanvasElement, "x" | "y" | "width" | "height"> & {
  isDeleted?: boolean;
  points?: readonly (readonly number[])[] | null;
};

/** Axis-aligned mark, including stroke points. A zero-area line still reserves a thin strip. */
function ileWorkCanvasMarkRect(
  el: IleWorkCanvasMark | null | undefined,
): { minX: number; minY: number; maxX: number; maxY: number } | null {
  if (!el || el.isDeleted) return null;
  const base = ileWorkCanvasNormalizedRect(el);
  let minX = base?.minX ?? Infinity;
  let minY = base?.minY ?? Infinity;
  let maxX = base?.maxX ?? -Infinity;
  let maxY = base?.maxY ?? -Infinity;
  const points = Array.isArray(el.points) ? el.points : [];
  for (const point of points) {
    if (!Array.isArray(point)) continue;
    const px = (Number(el.x) || 0) + (Number(point[0]) || 0);
    const py = (Number(el.y) || 0) + (Number(point[1]) || 0);
    if (!Number.isFinite(px) || !Number.isFinite(py)) continue;
    minX = Math.min(minX, px);
    minY = Math.min(minY, py);
    maxX = Math.max(maxX, px);
    maxY = Math.max(maxY, py);
  }
  if (!Number.isFinite(minX) || !Number.isFinite(minY)) return null;
  const thickness = 8;
  if (!(maxX > minX)) {
    minX -= thickness / 2;
    maxX += thickness / 2;
  }
  if (!(maxY > minY)) {
    minY -= thickness / 2;
    maxY += thickness / 2;
  }
  return { minX, minY, maxX, maxY };
}

function ileWorkCanvasObstacleRects(
  elements: readonly IleWorkCanvasMark[],
): { minX: number; minY: number; maxX: number; maxY: number }[] {
  const rects: { minX: number; minY: number; maxX: number; maxY: number }[] = [];
  for (const el of elements) {
    if (el?.isDeleted) continue;
    const rect = ileWorkCanvasMarkRect(el);
    if (rect) rects.push(rect);
  }
  return rects;
}

function ileWorkCanvasCollisionFootprint(
  incoming: readonly IleWorkCanvasElement[],
): { minX: number; minY: number; maxX: number; maxY: number } | null {
  let footprint: { minX: number; minY: number; maxX: number; maxY: number } | null = null;
  for (const el of ileWorkCanvasCollisionMembers(incoming)) {
    const rect = ileWorkCanvasMarkRect(el);
    if (!rect) continue;
    if (!footprint) {
      footprint = { ...rect };
      continue;
    }
    footprint.minX = Math.min(footprint.minX, rect.minX);
    footprint.minY = Math.min(footprint.minY, rect.minY);
    footprint.maxX = Math.max(footprint.maxX, rect.maxX);
    footprint.maxY = Math.max(footprint.maxY, rect.maxY);
  }
  return footprint;
}

export function ileWorkCanvasIncomingOverlapsObstacles(
  incoming: readonly IleWorkCanvasElement[],
  obstacles: readonly IleWorkCanvasMark[],
): boolean {
  const obstacleRects = ileWorkCanvasObstacleRects(obstacles);
  if (!obstacleRects.length) return false;
  const members = ileWorkCanvasCollisionMembers(incoming);
  for (const el of members) {
    const rect = ileWorkCanvasMarkRect(el);
    if (!rect) continue;
    for (const other of obstacleRects) {
      if (ileWorkCanvasPositiveAreaOverlap(rect, other)) return true;
    }
  }
  return false;
}

const ILE_WORK_CANVAS_CONNECTOR_TYPES = new Set(["arrow", "line", "freedraw"]);

type IleWorkCanvasRect = { minX: number; minY: number; maxX: number; maxY: number };

function ileWorkCanvasUnionRects(
  rects: readonly (IleWorkCanvasRect | null | undefined)[],
): IleWorkCanvasRect | null {
  let bounds: IleWorkCanvasRect | null = null;
  for (const rect of rects) {
    if (!rect) continue;
    if (!bounds) {
      bounds = { ...rect };
      continue;
    }
    bounds.minX = Math.min(bounds.minX, rect.minX);
    bounds.minY = Math.min(bounds.minY, rect.minY);
    bounds.maxX = Math.max(bounds.maxX, rect.maxX);
    bounds.maxY = Math.max(bounds.maxY, rect.maxY);
  }
  return bounds;
}

function ileWorkCanvasPointInsideRect(
  point: { x: number; y: number },
  rect: IleWorkCanvasRect,
): boolean {
  return point.x >= rect.minX && point.x <= rect.maxX && point.y >= rect.minY && point.y <= rect.maxY;
}

function ileWorkCanvasShiftMark(
  el: IleWorkCanvasElement,
  labels: readonly IleWorkCanvasElement[],
  dx: number,
  dy: number,
): void {
  if (dx === 0 && dy === 0) return;
  el.x += dx;
  el.y += dy;
  for (const label of labels) {
    label.x += dx;
    label.y += dy;
  }
}

/**
 * Pull boxes, text, and other solids in one XAI reply off each other.
 * A caption stays inside its own shape and moves with that shape.
 * The shape's footprint includes the caption, so the next mark clears both.
 * A frame keeps the marks that started inside it and grows if they move out.
 * Arrows, lines, and freedraw may cross marks; an arrow that started on a
 * moved shape shifts with that shape.
 */
export function separateIleWorkCanvasGroupOverlaps(
  incoming: readonly IleWorkCanvasElement[],
): IleWorkCanvasElement[] {
  const list = incoming.map((el) => ({ ...el }));
  const ids = new Set(list.map((el) => el.id));
  const labelsByContainer = new Map<string, IleWorkCanvasElement[]>();
  const frames: IleWorkCanvasElement[] = [];
  const connectors: IleWorkCanvasElement[] = [];
  const solids: IleWorkCanvasElement[] = [];
  for (const el of list) {
    if (el.isDeleted) continue;
    if (el.type === "frame") {
      frames.push(el);
      continue;
    }
    if (ILE_WORK_CANVAS_CONNECTOR_TYPES.has(el.type)) {
      connectors.push(el);
      continue;
    }
    const containerId = String(el.containerId || "");
    if (containerId && ids.has(containerId)) {
      const bucket = labelsByContainer.get(containerId) ?? [];
      bucket.push(el);
      labelsByContainer.set(containerId, bucket);
      continue;
    }
    solids.push(el);
  }

  const labelsFor = (el: IleWorkCanvasElement): IleWorkCanvasElement[] =>
    labelsByContainer.get(el.id) ?? [];
  const unitRect = (el: IleWorkCanvasElement): IleWorkCanvasRect | null =>
    ileWorkCanvasUnionRects([
      ileWorkCanvasMarkRect(el),
      ...labelsFor(el).map((label) => ileWorkCanvasMarkRect(label)),
    ]);

  const originXY = new Map(list.map((el) => [el.id, { x: el.x, y: el.y }]));
  const originalUnit = new Map<string, IleWorkCanvasRect>();
  for (const el of solids) {
    const rect = unitRect(el);
    if (rect) originalUnit.set(el.id, rect);
  }
  const originalFrame = new Map<string, IleWorkCanvasRect>();
  for (const frame of frames) {
    const rect = ileWorkCanvasMarkRect(frame);
    if (rect) originalFrame.set(frame.id, rect);
  }

  const childOf = new Map<string, string>();
  for (const el of solids) {
    const rect = originalUnit.get(el.id);
    if (!rect) continue;
    const center = { x: (rect.minX + rect.maxX) / 2, y: (rect.minY + rect.maxY) / 2 };
    const host = frames.find((frame) => {
      const bounds = originalFrame.get(frame.id);
      return bounds ? ileWorkCanvasPointInsideRect(center, bounds) : false;
    });
    if (host) childOf.set(el.id, host.id);
  }
  const parentFrameIds = new Set(childOf.values());
  for (const frame of frames) {
    if (parentFrameIds.has(frame.id)) continue;
    solids.push(frame);
    const rect = unitRect(frame);
    if (rect) originalUnit.set(frame.id, rect);
  }

  const gap = ILE_WORK_CANVAS_OVERLAP_GAP;
  const pack = (
    items: readonly IleWorkCanvasElement[],
    extra: readonly IleWorkCanvasRect[],
  ) => {
    const placed: IleWorkCanvasRect[] = extra.map((rect) => ({ ...rect }));
    const ordered = [...items].sort((a, b) => a.y - b.y || a.x - b.x || a.id.localeCompare(b.id));
    for (const el of ordered) {
      const labels = labelsFor(el);
      for (let guard = 0; guard < 64; guard += 1) {
        const rect = unitRect(el);
        if (!rect) break;
        const hit = placed.find((other) => ileWorkCanvasRectsOverlap(rect, other, gap));
        if (!hit) {
          placed.push(rect);
          break;
        }
        const dy = Math.max(gap, hit.maxY + gap - rect.minY);
        ileWorkCanvasShiftMark(el, labels, 0, dy);
      }
    }
  };

  pack(solids, []);

  for (const frame of frames) {
    if (!parentFrameIds.has(frame.id)) continue;
    const kids = solids.filter((el) => childOf.get(el.id) === frame.id);
    const union = ileWorkCanvasUnionRects(kids.map((kid) => unitRect(kid)));
    const current = ileWorkCanvasMarkRect(frame);
    if (!union || !current) continue;
    const minX = Math.min(current.minX, union.minX - gap);
    const minY = Math.min(current.minY, union.minY - gap);
    const maxX = Math.max(current.maxX, union.maxX + gap);
    const maxY = Math.max(current.maxY, union.maxY + gap);
    frame.x = minX;
    frame.y = minY;
    frame.width = maxX - minX;
    frame.height = maxY - minY;
  }

  const childRects = solids
    .filter((el) => childOf.has(el.id))
    .map((el) => unitRect(el))
    .filter((rect): rect is IleWorkCanvasRect => Boolean(rect));
  const frameRects = frames
    .filter((frame) => parentFrameIds.has(frame.id))
    .map((frame) => unitRect(frame))
    .filter((rect): rect is IleWorkCanvasRect => Boolean(rect));
  pack(
    solids.filter((el) => !childOf.has(el.id)),
    [...childRects, ...frameRects],
  );

  for (const el of connectors) {
    const start = originXY.get(el.id);
    if (!start) continue;
    const host = solids.find((solid) => {
      const rect = originalUnit.get(solid.id);
      return rect ? ileWorkCanvasPointInsideRect(start, rect) : false;
    });
    const origin = host ? originXY.get(host.id) : null;
    if (!host || !origin) continue;
    ileWorkCanvasShiftMark(el, [], host.x - origin.x, host.y - origin.y);
  }

  return list;
}

function translateIleWorkCanvasElements(
  elements: readonly IleWorkCanvasElement[],
  dx: number,
  dy: number,
): IleWorkCanvasElement[] {
  if (dx === 0 && dy === 0) return elements.slice();
  return elements.map((el) => ({ ...el, x: el.x + dx, y: el.y + dy }));
}

type IleWorkCanvasBox = { x: number; y: number; width: number; height: number; isDeleted?: boolean };

/** How far placement will walk before it drops a mark off the current cluster. */
const ILE_WORK_CANVAS_PLACEMENT_RINGS = 28;
const ILE_WORK_CANVAS_PLACEMENT_STEPS = 64;

function ileWorkCanvasUnionRect(
  rects: readonly { minX: number; minY: number; maxX: number; maxY: number }[],
): { minX: number; minY: number; maxX: number; maxY: number } | null {
  let bounds: { minX: number; minY: number; maxX: number; maxY: number } | null = null;
  for (const rect of rects) {
    if (!bounds) {
      bounds = { ...rect };
      continue;
    }
    bounds.minX = Math.min(bounds.minX, rect.minX);
    bounds.minY = Math.min(bounds.minY, rect.minY);
    bounds.maxX = Math.max(bounds.maxX, rect.maxX);
    bounds.maxY = Math.max(bounds.maxY, rect.maxY);
  }
  return bounds;
}

function ileWorkCanvasBoxMisses(
  slot: { x: number; y: number },
  boxW: number,
  boxH: number,
  obstacles: readonly { minX: number; minY: number; maxX: number; maxY: number }[],
): boolean {
  const box = {
    minX: slot.x,
    minY: slot.y,
    maxX: slot.x + boxW,
    maxY: slot.y + boxH,
  };
  return !obstacles.some((rect) => ileWorkCanvasPositiveAreaOverlap(box, rect));
}

/**
 * A free top-left even when it sits outside the visible board.
 * Walks below, then to the right, then left, then above the obstacle union.
 */
function ileWorkCanvasFirstClearSlot(input: {
  obstacles: readonly { minX: number; minY: number; maxX: number; maxY: number }[];
  boxW: number;
  boxH: number;
  gap: number;
}): { x: number; y: number } {
  const bounds = ileWorkCanvasUnionRect(input.obstacles);
  const boxW = Math.max(1, input.boxW);
  const boxH = Math.max(1, input.boxH);
  const gap = input.gap > 0 ? input.gap : ILE_XAI_LOADING_GAP;
  if (!bounds) return { x: TEXT_ORIGIN_X, y: TEXT_ORIGIN_Y };
  for (let step = 0; step < ILE_WORK_CANVAS_PLACEMENT_STEPS; step += 1) {
    const slots = [
      { x: bounds.minX, y: bounds.maxY + gap + step * (boxH + gap) },
      { x: bounds.maxX + gap + step * (boxW + gap), y: bounds.minY },
      { x: bounds.minX - boxW - gap - step * (boxW + gap), y: bounds.minY },
      { x: bounds.minX, y: bounds.minY - boxH - gap - step * (boxH + gap) },
    ];
    for (const slot of slots) {
      if (ileWorkCanvasBoxMisses(slot, boxW, boxH, input.obstacles)) {
        return { x: Math.round(slot.x), y: Math.round(slot.y) };
      }
    }
  }
  return {
    x: Math.round(bounds.minX),
    y: Math.round(bounds.maxY + gap + ILE_WORK_CANVAS_PLACEMENT_STEPS * (boxH + gap)),
  };
}

/**
 * Free top-left for a new group. Prefers a spot tucked against the cluster
 * (usually just underneath) over a jump a full box-width to the right.
 * If the nearby rings are full, the spot may sit off the visible board.
 */
export function ileWorkCanvasClusteredOrigin(input: {
  elements?: readonly IleWorkCanvasBox[] | null;
  box: { width: number; height: number };
  gap?: number;
}): { x: number; y: number } {
  const boxW = Math.max(1, Number(input.box.width) || ILE_XAI_LOADING_BOX_WIDTH);
  const boxH = Math.max(1, Number(input.box.height) || ILE_XAI_LOADING_BOX_HEIGHT);
  const gap = Number(input.gap) > 0 ? Number(input.gap) : ILE_XAI_LOADING_GAP;
  const live = (input.elements ?? []).filter((el) => !el.isDeleted);
  const obstacles = ileWorkCanvasObstacleRects(live);
  const bounds = ileWorkCanvasUnionRect(obstacles);
  if (!bounds) return { x: TEXT_ORIGIN_X, y: TEXT_ORIGIN_Y };
  const clusterMidX = (bounds.minX + bounds.maxX) / 2;
  const clusterMidY = (bounds.minY + bounds.maxY) / 2;
  const step = Math.max(gap, 36);
  const candidates: { x: number; y: number }[] = [];
  for (let ring = 0; ring < ILE_WORK_CANVAS_PLACEMENT_RINGS; ring += 1) {
    const yBelow = bounds.maxY + gap + ring * step;
    const yAbove = bounds.minY - boxH - gap - ring * step;
    const xRight = bounds.maxX + gap + ring * step;
    const xLeft = bounds.minX - boxW - gap - ring * step;
    const xAligned = bounds.minX;
    const xCentered = clusterMidX - boxW / 2;
    candidates.push(
      { x: xAligned, y: yBelow },
      { x: xCentered, y: yBelow },
      { x: xRight, y: bounds.minY },
      { x: xRight, y: bounds.maxY - boxH },
      { x: xLeft, y: bounds.minY },
      { x: xAligned, y: yAbove },
      { x: xCentered, y: yAbove },
    );
  }
  let best: { x: number; y: number; score: number } | null = null;
  for (const slot of candidates) {
    const box = {
      minX: slot.x,
      minY: slot.y,
      maxX: slot.x + boxW,
      maxY: slot.y + boxH,
    };
    if (obstacles.some((rect) => ileWorkCanvasPositiveAreaOverlap(box, rect))) continue;
    const growX =
      Math.max(0, box.maxX - bounds.maxX) + Math.max(0, bounds.minX - box.minX);
    const growY =
      Math.max(0, box.maxY - bounds.maxY) + Math.max(0, bounds.minY - box.minY);
    const dist = Math.hypot(slot.x + boxW / 2 - clusterMidX, slot.y + boxH / 2 - clusterMidY);
    const score = growX * 4 + growY + dist * 0.05;
    if (!best || score < best.score) best = { x: slot.x, y: slot.y, score };
  }
  if (best) return { x: Math.round(best.x), y: Math.round(best.y) };
  return ileWorkCanvasFirstClearSlot({
    obstacles,
    boxW,
    boxH,
    gap,
  });
}

/** Ids to select when a generated group should take the canvas focus. */
export function ileWorkCanvasSelectionIds(
  elements: readonly { id?: string | null; isDeleted?: boolean }[] | null | undefined,
): Record<string, true> {
  const ids: Record<string, true> = {};
  for (const el of elements ?? []) {
    const id = String(el?.id || "").trim();
    if (!id || el?.isDeleted) continue;
    ids[id] = true;
  }
  return ids;
}

/**
 * One placement step for every mode. Keeps a group whose real bounds miss
 * live obstacles. Otherwise slides the whole group, bound text included,
 * so internal offsets stay put. The new spot stays against the cluster.
 */
export function settleIleWorkCanvasIncoming(
  incoming: readonly IleWorkCanvasElement[],
  obstacles: readonly IleWorkCanvasMark[],
): IleWorkCanvasElement[] {
  const list = separateIleWorkCanvasGroupOverlaps(incoming);
  if (!list.length) return list;
  if (!ileWorkCanvasIncomingOverlapsObstacles(list, obstacles)) return list;
  const footprint = ileWorkCanvasCollisionFootprint(list);
  if (!footprint) return list;
  const width = footprint.maxX - footprint.minX;
  const height = footprint.maxY - footprint.minY;
  const clustered = ileWorkCanvasClusteredOrigin({
    elements: obstacles,
    box: { width, height },
  });
  const tucked = translateIleWorkCanvasElements(
    list,
    clustered.x - footprint.minX,
    clustered.y - footprint.minY,
  );
  if (!ileWorkCanvasIncomingOverlapsObstacles(tucked, obstacles)) return tucked;
  const slot = ileWorkCanvasFirstClearSlot({
    obstacles: ileWorkCanvasObstacleRects(obstacles),
    boxW: width,
    boxH: height,
    gap: ILE_XAI_LOADING_GAP,
  });
  return translateIleWorkCanvasElements(
    list,
    slot.x - footprint.minX,
    slot.y - footprint.minY,
  );
}

/**
 * Paste host commit: drop ids, then slide the new group off whatever is
 * already on the live board. Marks that appeared after a snapshot stay put.
 */
export function pasteIleWorkCanvasElements(input: {
  existing?: readonly IleWorkCanvasElement[] | null;
  incoming?: readonly IleWorkCanvasElement[] | null;
  removeIds?: readonly string[] | null;
}): IleWorkCanvasElement[] {
  const remove = new Set((input.removeIds ?? []).map((id) => String(id || "")).filter(Boolean));
  const kept = (input.existing ?? []).filter((el) => el && (!el.id || !remove.has(el.id)));
  const keptIds = new Set(kept.map((el) => el.id));
  const toAdd = (input.incoming ?? []).filter(
    (el) => el && typeof el === "object" && (!el.id || !keptIds.has(el.id)),
  );
  if (!toAdd.length) return kept.slice();
  const settled = settleIleWorkCanvasIncoming(
    toAdd,
    kept.filter((el) => !el.isDeleted),
  );
  return [...kept, ...settled];
}

function ileWorkCanvasPlacementObstacles(
  existing: readonly IleWorkCanvasElement[],
  reserved?: readonly { x: number; y: number }[] | null,
): Array<Pick<IleWorkCanvasElement, "x" | "y" | "width" | "height" | "isDeleted">> {
  return [
    ...existing.filter((el) => !el.isDeleted),
    ...ileWorkCanvasOriginOccupants(reserved),
  ];
}

function ileWorkCanvasLoadingSlots(
  near: { minX: number; minY: number; maxX: number; maxY: number },
  boxW: number,
  boxH: number,
  gap: number,
): { x: number; y: number }[] {
  return [
    { x: near.maxX + gap, y: near.minY },
    { x: near.minX, y: near.maxY + gap },
    { x: near.minX - boxW - gap, y: near.minY },
    { x: near.minX, y: near.minY - boxH - gap },
    { x: near.maxX + gap, y: near.maxY + gap },
    { x: near.minX - boxW - gap, y: near.maxY + gap },
    { x: near.maxX + gap, y: near.minY - boxH - gap },
    { x: near.minX - boxW - gap, y: near.minY - boxH - gap },
  ];
}

/** Place a box in empty space beside the closest cluster, skipping overlaps. */
export function ileWorkCanvasEmptyNearbyOrigin(input: {
  elements?: readonly Pick<IleWorkCanvasElement, "x" | "y" | "width" | "height" | "isDeleted">[] | null;
  near?: readonly Pick<IleWorkCanvasElement, "x" | "y" | "width" | "height" | "isDeleted">[] | null;
  box?: { width?: number; height?: number };
  gap?: number;
}): { x: number; y: number } {
  const boxW = Number(input.box?.width) || ILE_XAI_LOADING_BOX_WIDTH;
  const boxH = Number(input.box?.height) || ILE_XAI_LOADING_BOX_HEIGHT;
  const gap = Number(input.gap) > 0 ? Number(input.gap) : ILE_XAI_LOADING_GAP;
  const nearBounds =
    ileWorkCanvasContentBounds(input.near ?? []) ??
    ileWorkCanvasContentBounds(input.elements ?? []);
  if (!nearBounds) return { x: TEXT_ORIGIN_X, y: TEXT_ORIGIN_Y };
  const obstacles = (input.elements ?? input.near ?? [])
    .filter((el) => !el.isDeleted)
    .map((el) => ileWorkCanvasMarkRect(el))
    .filter((rect): rect is NonNullable<typeof rect> => Boolean(rect));
  const clearance = ILE_XAI_LOADING_CLEARANCE;
  for (let ring = 1; ring <= ILE_WORK_CANVAS_PLACEMENT_RINGS; ring += 1) {
    for (const slot of ileWorkCanvasLoadingSlots(nearBounds, boxW, boxH, gap * ring)) {
      const box = {
        minX: slot.x,
        minY: slot.y,
        maxX: slot.x + boxW,
        maxY: slot.y + boxH,
      };
      if (obstacles.some((rect) => ileWorkCanvasRectsOverlap(box, rect, clearance))) continue;
      return { x: Math.round(slot.x), y: Math.round(slot.y) };
    }
  }
  const obstacleRects = (input.elements ?? input.near ?? [])
    .filter((el) => !el.isDeleted)
    .map((el) => ileWorkCanvasMarkRect(el))
    .filter((rect): rect is NonNullable<typeof rect> => Boolean(rect));
  return ileWorkCanvasFirstClearSlot({
    obstacles: obstacleRects,
    boxW,
    boxH,
    gap,
  });
}

/** Treat in-flight wait boxes as occupied so parallel asks do not share an origin. */
export function ileWorkCanvasOriginOccupants(
  origins: readonly { x: number; y: number }[] | null | undefined,
  box?: { width?: number; height?: number },
): Array<Pick<IleWorkCanvasElement, "id" | "x" | "y" | "width" | "height" | "isDeleted">> {
  const width = Number(box?.width) || ILE_XAI_LOADING_BOX_WIDTH;
  const height = Number(box?.height) || ILE_XAI_LOADING_BOX_HEIGHT;
  return (origins ?? []).map((origin, index) => ({
    id: `ile-origin-slot-${index}`,
    x: origin.x,
    y: origin.y,
    width,
    height,
    isDeleted: false,
  }));
}

export function ileWorkCanvasEmptyNearbyOriginWithReserved(input: {
  elements?: readonly Pick<IleWorkCanvasElement, "x" | "y" | "width" | "height" | "isDeleted">[] | null;
  reserved?: readonly { x: number; y: number }[] | null;
  near?: readonly Pick<IleWorkCanvasElement, "x" | "y" | "width" | "height" | "isDeleted">[] | null;
  box?: { width?: number; height?: number };
  gap?: number;
}): { x: number; y: number } {
  return ileWorkCanvasEmptyNearbyOrigin({
    ...input,
    elements: [...(input.elements ?? []), ...ileWorkCanvasOriginOccupants(input.reserved, input.box)],
  });
}

/**
 * Append an XAI turn onto the live board. Parallel asks must pass the current
 * scene (not the snapshot from when the prompt was sent) or later replies
 * replace earlier ones.
 */
export function mergeIleXaiTurnOntoLiveWorkCanvas(
  liveScene: IleWorkCanvasScene | null | undefined,
  payload: IleXaiCanvasTurnPayload,
  input?: {
    fallbackOrigin?: { x?: number; y?: number } | null;
    reserved?: readonly { x: number; y: number }[] | null;
  },
): IleWorkCanvasScene {
  const current = serializeIleWorkCanvasScene(liveScene);
  const fallbackOrigin =
    ileWorkCanvasFiniteOrigin(input?.fallbackOrigin) ??
    ileWorkCanvasEmptyNearbyOriginWithReserved({
      elements: current.elements,
      reserved: input?.reserved,
    });
  return applyIleXaiTurnToWorkCanvas(current, payload, {
    fallbackOrigin,
    reserved: input?.reserved,
  });
}

export function ileWorkCanvasReplyOriginFromSelection(
  elements: readonly Pick<IleWorkCanvasElement, "x" | "y" | "width" | "height" | "isDeleted">[],
  sceneElements?: readonly Pick<IleWorkCanvasElement, "x" | "y" | "width" | "height" | "isDeleted">[] | null,
): { x: number; y: number } {
  return ileWorkCanvasEmptyNearbyOrigin({
    elements: sceneElements ?? elements,
    near: elements,
  });
}

export function createIleXaiLoadingPlaceholder(input: {
  x: number;
  y: number;
  turnId: string;
}): IleWorkCanvasElement {
  const converted = convertToExcalidrawElements([
    {
      type: "text",
      text: ILE_XAI_LOADING_TEXT,
      x: input.x,
      y: input.y,
      width: ILE_WORK_CANVAS_TEXT_BOX_WIDTH,
      autoResize: false,
      customData: {
        [ILE_XAI_LOADING_CUSTOM_DATA_KEY]: true,
        [ILE_XAI_CANVAS_CUSTOM_DATA_KEY]: true,
        turnId: input.turnId,
        author: "xai",
        pending: true,
      },
    },
  ]);
  return converted[0]!;
}

export function replaceIleXaiLoadingPlaceholder(
  scene: IleWorkCanvasScene | null | undefined,
  turnId: string,
  payload: IleXaiCanvasTurnPayload,
): IleWorkCanvasScene {
  const current = serializeIleWorkCanvasScene(scene);
  const loading = current.elements.find(
    (el) => isIleXaiLoadingElement(el) && el.customData?.turnId === turnId,
  );
  const rest = loading
    ? current.elements.filter((el) => el.id !== loading.id)
    : current.elements;
  return applyIleXaiTurnToWorkCanvas(
    { ...current, elements: rest },
    { ...payload, turnId },
    { fallbackOrigin: loading ? { x: loading.x, y: loading.y } : null },
  );
}
