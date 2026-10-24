/**
 * TAP Learning Work canvas chrome: prompt bar, Learn More, zoom, scroll, viewport, auto layout.
 */
import {
  ILE_WORK_CANVAS_OVERLAP_GAP,
  ileWorkCanvasNormalizedRect,
  ileWorkCanvasPositiveAreaOverlap,
  ileWorkCanvasRectsOverlap,
} from "@/lib/learn-work-canvas-geometry";
import {
  ILE_AUTO_LAYOUT_APP_STATE_KEY,
  ILE_XAI_LOADING_CUSTOM_DATA_KEY,
  asRecord,
  ileWorkCanvasContentBounds,
  ileWorkCanvasHasLiveElements,
  serializeIleWorkCanvasScene,
  type IleWorkCanvasAppState,
  type IleWorkCanvasElement,
  type IleWorkCanvasScene,
} from "@/lib/learn-work-canvas-scene";

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

export const ILE_WORK_CANVAS_SCROLL_TO_CONTENT_OPTS = { animate: false } as const;

/**
 * Scroll offsets that place `bounds` at the viewport center (same formula as
 * Excalidraw `centerScrollOn` without sidebar offsets). Null when the viewport
 * size is unknown — do not write fake scroll into a seed scene.
 */
/**
 * Largest zoom at or below 1 that keeps `bounds` inside the viewport, then
 * the scroll that centers that box. Padding stays on every edge.
 */
export function ileWorkCanvasFitScroll(
  bounds: { minX: number; minY: number; maxX: number; maxY: number } | null | undefined,
  viewport: { width?: number; height?: number } | null | undefined,
  pad = 28,
): { scrollX: number; scrollY: number; zoom: number } | null {
  if (!bounds) return null;
  const width = Number(viewport?.width);
  const height = Number(viewport?.height);
  if (!Number.isFinite(width) || width <= 0 || !Number.isFinite(height) || height <= 0) return null;
  const boardW = Math.max(1, bounds.maxX - bounds.minX);
  const boardH = Math.max(1, bounds.maxY - bounds.minY);
  const inset = Math.max(0, pad);
  const availW = Math.max(1, width - inset * 2);
  const availH = Math.max(1, height - inset * 2);
  const zoom = Math.min(1, availW / boardW, availH / boardH);
  if (!Number.isFinite(zoom) || zoom <= 0) return null;
  const centerX = (bounds.minX + bounds.maxX) / 2;
  const centerY = (bounds.minY + bounds.maxY) / 2;
  return {
    zoom,
    scrollX: width / 2 / zoom - centerX,
    scrollY: height / 2 / zoom - centerY,
  };
}

export function ileWorkCanvasCenterScroll(
  bounds: { minX: number; minY: number; maxX: number; maxY: number } | null | undefined,
  viewport: Pick<IleWorkCanvasViewportAppState, "width" | "height" | "zoom"> | null | undefined,
): { scrollX: number; scrollY: number } | null {
  if (!bounds) return null;
  const width = Number(viewport?.width);
  const height = Number(viewport?.height);
  if (!Number.isFinite(width) || width <= 0 || !Number.isFinite(height) || height <= 0) {
    return null;
  }
  const zoom = ileWorkCanvasZoomValue(viewport);
  const centerX = (bounds.minX + bounds.maxX) / 2;
  const centerY = (bounds.minY + bounds.maxY) / 2;
  return {
    scrollX: width / 2 / zoom - centerX,
    scrollY: height / 2 / zoom - centerY,
  };
}

/** Excalidraw `initialData` flag: center on live elements at first paint. */
export function ileWorkCanvasWithScrollToContent<T extends { elements?: unknown[] }>(
  scene: T,
): T & { scrollToContent?: boolean } {
  if (!ileWorkCanvasHasLiveElements(scene as unknown as IleWorkCanvasScene)) return scene;
  return { ...scene, scrollToContent: true };
}

export const ILE_LEARN_MORE_LABEL = "Commands";
export const ILE_LEARN_MORE_BOX_WIDTH = 320;
/** Handle + named command rows + prompt row, used for viewport collision. */
export const ILE_LEARN_MORE_BOX_HEIGHT = 336;
export const ILE_LEARN_MORE_GAP = 8;
export const ILE_LEARN_MORE_VIEWPORT_PAD = 8;

/** Desktop Excalidraw shape island (not the mobile bottom bar). */
export const ILE_CANVAS_PROMPT_BAR_TOOLBAR_SELECTOR =
  ".App-top-bar .App-toolbar, .shapes-section .App-toolbar";
export const ILE_CANVAS_PROMPT_BAR_GAP = 8;
/** 1rem editor pad + tool island + gap, until the toolbar is measured. */
export const ILE_CANVAS_PROMPT_BAR_FALLBACK_TOP = 72;
/** Excalidraw shape island width until the toolbar is measured. */
export const ILE_CANVAS_PROMPT_BAR_FALLBACK_WIDTH = 480;

/** Host-relative top so the board prompt floats just under Excalidraw's toolbar. */
export function ileCanvasPromptBarTop(
  toolbar: { bottom?: number } | null | undefined,
  host: { top?: number } | null | undefined,
  gap = ILE_CANVAS_PROMPT_BAR_GAP,
): number {
  const bottom = Number(toolbar?.bottom);
  const top = Number(host?.top);
  if (!Number.isFinite(bottom) || !Number.isFinite(top)) return ILE_CANVAS_PROMPT_BAR_FALLBACK_TOP;
  return Math.max(0, Math.round(bottom - top + gap));
}

/** Match the prompt cluster to the measured Excalidraw toolbox width. */
export function ileCanvasPromptBarWidth(
  toolbar: { width?: number } | null | undefined,
  fallback = ILE_CANVAS_PROMPT_BAR_FALLBACK_WIDTH,
): number {
  const width = Number(toolbar?.width);
  if (!Number.isFinite(width) || width <= 0) return fallback;
  return Math.round(width);
}

export type IleWorkCanvasViewportAppState = {
  zoom?: { value?: number } | number | null;
  scrollX?: number;
  scrollY?: number;
  offsetLeft?: number;
  offsetTop?: number;
  width?: number;
  height?: number;
};

export function ileWorkCanvasZoomValue(appState: IleWorkCanvasViewportAppState | null | undefined): number {
  const zoom = appState?.zoom;
  const value = typeof zoom === "number" ? zoom : zoom?.value;
  return Number.isFinite(Number(value)) && Number(value) > 0 ? Number(value) : 1;
}

export const ILE_WORK_CANVAS_MIN_ZOOM = 0.1;
export const ILE_WORK_CANVAS_MAX_ZOOM = 30;

export function ileWorkCanvasNormalizedZoom(zoom: number): number {
  if (!Number.isFinite(zoom) || zoom <= 0) return 1;
  return Math.min(ILE_WORK_CANVAS_MAX_ZOOM, Math.max(ILE_WORK_CANVAS_MIN_ZOOM, zoom));
}

/**
 * Zoom about a viewport point (same formula as Excalidraw `getStateForZoom`).
 * Negative deltaY zooms in.
 */
export function ileWorkCanvasZoomAtPoint(input: {
  zoom: number;
  scrollX: number;
  scrollY: number;
  offsetLeft?: number;
  offsetTop?: number;
  viewportX: number;
  viewportY: number;
  deltaY: number;
}): { zoom: number; scrollX: number; scrollY: number } {
  const current = ileWorkCanvasNormalizedZoom(input.zoom);
  const sign = Math.sign(input.deltaY) || 1;
  const absDelta = Math.abs(Number(input.deltaY) || 0);
  const maxStep = 10;
  const delta = absDelta > maxStep ? maxStep * sign : Number(input.deltaY) || 0;
  let nextZoom = current - delta / 100;
  nextZoom +=
    Math.log10(Math.max(1, current)) * -sign * Math.min(1, absDelta / 20);
  nextZoom = ileWorkCanvasNormalizedZoom(nextZoom);
  const appLayerX = Number(input.viewportX) - (Number(input.offsetLeft) || 0);
  const appLayerY = Number(input.viewportY) - (Number(input.offsetTop) || 0);
  const baseScrollX = input.scrollX + (appLayerX - appLayerX / current);
  const baseScrollY = input.scrollY + (appLayerY - appLayerY / current);
  return {
    zoom: nextZoom,
    scrollX: baseScrollX - (appLayerX - appLayerX / nextZoom),
    scrollY: baseScrollY - (appLayerY - appLayerY / nextZoom),
  };
}

function clampIleRange(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  if (max < min) return min;
  return Math.min(max, Math.max(min, value));
}

/** Excalidraw scene → container coordinates (same formula as sceneCoordsToViewportCoords). */
export function ileWorkCanvasSceneToViewport(
  scene: { x: number; y: number },
  appState: IleWorkCanvasViewportAppState | null | undefined,
): { x: number; y: number } {
  const zoom = ileWorkCanvasZoomValue(appState);
  const scrollX = Number(appState?.scrollX) || 0;
  const scrollY = Number(appState?.scrollY) || 0;
  const offsetLeft = Number(appState?.offsetLeft) || 0;
  const offsetTop = Number(appState?.offsetTop) || 0;
  return {
    x: (scene.x + scrollX) * zoom + offsetLeft,
    y: (scene.y + scrollY) * zoom + offsetTop,
  };
}

/**
 * Minimal pan that brings `elements` into view. Null when they already sit
 * inside the viewport (with padding) so a command does not yank the camera.
 * Never changes zoom. If the box is larger than the view, snap the near edge.
 */
export function ileWorkCanvasRevealScroll(
  elements: readonly Pick<IleWorkCanvasElement, "x" | "y" | "width" | "height" | "isDeleted">[],
  appState: IleWorkCanvasViewportAppState | null | undefined,
  pad = 40,
): { scrollX: number; scrollY: number } | null {
  const live = elements.filter((el) => !el.isDeleted);
  const bounds = ileWorkCanvasContentBounds(live);
  const width = Number(appState?.width) || 0;
  const height = Number(appState?.height) || 0;
  if (!bounds || width <= 0 || height <= 0) return null;
  const zoom = ileWorkCanvasZoomValue(appState);
  const inset = Math.max(0, pad);
  const viewLeft = inset;
  const viewTop = inset;
  const viewRight = Math.max(inset + 1, width - inset);
  const viewBottom = Math.max(inset + 1, height - inset);
  let scrollX = Number(appState?.scrollX) || 0;
  let scrollY = Number(appState?.scrollY) || 0;
  const offsetLeft = Number(appState?.offsetLeft) || 0;
  const offsetTop = Number(appState?.offsetTop) || 0;
  const projectX = (sceneX: number, nextScrollX: number) =>
    (sceneX + nextScrollX) * zoom + offsetLeft;
  const projectY = (sceneY: number, nextScrollY: number) =>
    (sceneY + nextScrollY) * zoom + offsetTop;
  const left = projectX(bounds.minX, scrollX);
  const right = projectX(bounds.maxX, scrollX);
  const top = projectY(bounds.minY, scrollY);
  const bottom = projectY(bounds.maxY, scrollY);
  if (left >= viewLeft && right <= viewRight && top >= viewTop && bottom <= viewBottom) {
    return null;
  }
  if (left < viewLeft) scrollX += (viewLeft - left) / zoom;
  else if (right > viewRight) scrollX -= (right - viewRight) / zoom;
  if (top < viewTop) scrollY += (viewTop - top) / zoom;
  else if (bottom > viewBottom) scrollY -= (bottom - viewBottom) / zoom;
  if (
    Math.abs(scrollX - (Number(appState?.scrollX) || 0)) < 0.5 &&
    Math.abs(scrollY - (Number(appState?.scrollY) || 0)) < 0.5
  ) {
    return null;
  }
  return { scrollX, scrollY };
}

/**
 * True when a new mark sits outside the current view. Replies that land
 * inside the thinking plate should not pan the board.
 */
export function ileWorkCanvasMarksNeedScroll(
  elements: readonly Pick<IleWorkCanvasElement, "x" | "y" | "width" | "height" | "isDeleted">[],
  appState: IleWorkCanvasViewportAppState | null | undefined,
  pad = 16,
): boolean {
  const rect = ileWorkCanvasSelectionViewportRect(
    elements.filter((el) => !el.isDeleted),
    appState,
  );
  if (!rect) return false;
  const width = Number(appState?.width) || 0;
  const height = Number(appState?.height) || 0;
  if (width <= 0 || height <= 0) return false;
  return (
    rect.left < pad ||
    rect.top < pad ||
    rect.right > width - pad ||
    rect.bottom > height - pad
  );
}

export function ileWorkCanvasSelectionViewportRect(
  elements: readonly Pick<IleWorkCanvasElement, "x" | "y" | "width" | "height" | "isDeleted">[],
  appState: IleWorkCanvasViewportAppState | null | undefined,
): { left: number; top: number; right: number; bottom: number } | null {
  const bounds = ileWorkCanvasContentBounds(elements);
  if (!bounds) return null;
  const topLeft = ileWorkCanvasSceneToViewport({ x: bounds.minX, y: bounds.minY }, appState);
  const bottomRight = ileWorkCanvasSceneToViewport({ x: bounds.maxX, y: bounds.maxY }, appState);
  return {
    left: Math.min(topLeft.x, bottomRight.x),
    top: Math.min(topLeft.y, bottomRight.y),
    right: Math.max(topLeft.x, bottomRight.x),
    bottom: Math.max(topLeft.y, bottomRight.y),
  };
}

export type IleWorkCanvasHostRect = { left?: number; top?: number };

/** Excalidraw viewport coords → overlay host (absolute child of the canvas host). */
export function ileWorkCanvasViewportToHost(
  point: { x: number; y: number },
  host?: IleWorkCanvasHostRect | null,
): { x: number; y: number } {
  return {
    x: point.x - (Number(host?.left) || 0),
    y: point.y - (Number(host?.top) || 0),
  };
}

export function ileWorkCanvasSelectionHostRect(
  elements: readonly Pick<IleWorkCanvasElement, "x" | "y" | "width" | "height" | "isDeleted">[],
  appState: IleWorkCanvasViewportAppState | null | undefined,
  host?: IleWorkCanvasHostRect | null,
): { left: number; top: number; right: number; bottom: number } | null {
  const rect = ileWorkCanvasSelectionViewportRect(elements, appState);
  if (!rect) return null;
  const originLeft = Number(host?.left) || 0;
  const originTop = Number(host?.top) || 0;
  return {
    left: rect.left - originLeft,
    top: rect.top - originTop,
    right: rect.right - originLeft,
    bottom: rect.bottom - originTop,
  };
}

export function placeIleLearnMorePrompt(input: {
  selection: { left: number; top: number; right: number; bottom: number } | null | undefined;
  viewport: { left?: number; top?: number; width: number; height: number };
  box?: { width?: number; height?: number };
}): { left: number; top: number } | null {
  if (!input.selection) return null;
  const viewLeft = Number(input.viewport.left) || 0;
  const viewTop = Number(input.viewport.top) || 0;
  const viewW = Number(input.viewport.width) || 0;
  const viewH = Number(input.viewport.height) || 0;
  if (viewW <= 0 || viewH <= 0) return null;
  const pad = ILE_LEARN_MORE_VIEWPORT_PAD;
  const boxW = Math.min(
    input.box?.width ?? ILE_LEARN_MORE_BOX_WIDTH,
    Math.max(0, viewW - pad * 2),
  );
  const boxH = Math.min(
    input.box?.height ?? ILE_LEARN_MORE_BOX_HEIGHT,
    Math.max(0, viewH - pad * 2),
  );
  if (boxW <= 0 || boxH <= 0) return null;
  const minLeft = viewLeft + pad;
  const maxLeft = viewLeft + viewW - boxW - pad;
  const minTop = viewTop + pad;
  const maxTop = viewTop + viewH - boxH - pad;
  const sel = input.selection;
  let left = (sel.left + sel.right) / 2 - boxW / 2;
  let top = sel.bottom + ILE_LEARN_MORE_GAP;
  if (top > maxTop) top = sel.top - ILE_LEARN_MORE_GAP - boxH;
  return {
    left: Math.round(clampIleRange(left, minLeft, maxLeft)),
    top: Math.round(clampIleRange(top, minTop, maxTop)),
  };
}

export function ileLearnMorePromptPlacement(input: {
  elements: readonly Pick<IleWorkCanvasElement, "id" | "x" | "y" | "width" | "height" | "isDeleted">[];
  selectedElementIds?: Record<string, unknown> | null;
  appState?: IleWorkCanvasViewportAppState | null;
  viewport?: { left?: number; top?: number; width?: number; height?: number } | null;
  /** Canvas host bounding origin; Commands is absolutely positioned inside it. */
  host?: IleWorkCanvasHostRect | null;
}): { count: number; left: number; top: number } | null {
  const ids = input.selectedElementIds ?? {};
  const selected = input.elements.filter((el) => el?.id && ids[el.id] && !el.isDeleted);
  if (!selected.length) return null;
  const appState = input.appState ?? {};
  const hasHost = input.host != null;
  const viewport = {
    left: hasHost
      ? Number(input.viewport?.left) || 0
      : (input.viewport?.left ?? Number(appState.offsetLeft)) || 0,
    top: hasHost
      ? Number(input.viewport?.top) || 0
      : (input.viewport?.top ?? Number(appState.offsetTop)) || 0,
    width: Number(input.viewport?.width) || Number(appState.width) || 0,
    height: Number(input.viewport?.height) || Number(appState.height) || 0,
  };
  const placed = placeIleLearnMorePrompt({
    selection: ileWorkCanvasSelectionHostRect(selected, appState, input.host),
    viewport,
  });
  if (!placed) return null;
  return { count: selected.length, ...placed };
}

export function ileLearnMoreSelectionKey(
  selectedElementIds?: Record<string, unknown> | null,
): string {
  return Object.keys(selectedElementIds ?? {})
    .filter((id) => Boolean(selectedElementIds?.[id]))
    .sort()
    .join(",");
}

/** "commands" means a canvas element is selected. The slash bar still waits for "/". */
export function ileCanvasPromptMode(
  selectedElementIds?: Record<string, unknown> | null,
): "commands" | "ask" {
  return ileLearnMoreSelectionKey(selectedElementIds) ? "commands" : "ask";
}

/** Input, Ask, Run, and command chips show only after "/" while a selection exists. */
export function ileCanvasSlashBarOpen(input: {
  selectionActive: boolean;
  slashIntent: boolean;
}): boolean {
  return Boolean(input.selectionActive && input.slashIntent);
}

/** "/" opens the slash bar only when a canvas element is selected. */
export function ileCanvasSlashKeyOpensBar(input: {
  key: string;
  selectionActive: boolean;
  typingInField?: boolean;
}): boolean {
  if (input.typingInField) return false;
  return input.key === "/" && Boolean(input.selectionActive);
}

/**
 * A selected element must not dismiss the craft insight form.
 * The learner closes it, or the save finishes.
 */
export function ileCanvasCraftInsightOpenAfterSelection(input: {
  open: boolean;
  selectionActive: boolean;
}): boolean {
  void input.selectionActive;
  return input.open;
}

/**
 * Commands is visible only while a selection exists. Empty ids hide it
 * even when the pointer is down (click-away must not leave it pinned).
 */
export function ileLearnMoreVisiblePlacement(input: {
  selectedElementIds?: Record<string, unknown> | null;
  pointerBusy?: boolean;
  placed?: { count: number; left: number; top: number } | null;
}): { count: number; left: number; top: number } | null {
  void input.pointerBusy;
  if (!ileLearnMoreSelectionKey(input.selectedElementIds)) return null;
  return input.placed ?? null;
}

export type IleLearnMoreFollowOffset = { dx: number; dy: number };

/** Prompt position relative to the selection's host-space top-left. */
export function ileLearnMoreFollowOffset(
  prompt: { left: number; top: number } | null | undefined,
  selection: { left: number; top: number } | null | undefined,
): IleLearnMoreFollowOffset | null {
  if (!prompt || !selection) return null;
  const left = Number(prompt.left);
  const top = Number(prompt.top);
  const selLeft = Number(selection.left);
  const selTop = Number(selection.top);
  if (![left, top, selLeft, selTop].every(Number.isFinite)) return null;
  return { dx: left - selLeft, dy: top - selTop };
}

/** Apply a stored Commands offset as the selection moves. */
export function ileLearnMoreFollowPosition(
  selection: { left: number; top: number } | null | undefined,
  offset: IleLearnMoreFollowOffset | null | undefined,
): { left: number; top: number } | null {
  if (!selection || !offset) return null;
  const selLeft = Number(selection.left);
  const selTop = Number(selection.top);
  const dx = Number(offset.dx);
  const dy = Number(offset.dy);
  if (![selLeft, selTop, dx, dy].every(Number.isFinite)) return null;
  return { left: selLeft + dx, top: selTop + dy };
}

export function ileWorkCanvasPointerBusy(
  appState:
    | {
        cursorButton?: string | null;
        isResizing?: boolean;
        isRotating?: boolean;
        draggingElement?: unknown;
      }
    | null
    | undefined,
): boolean {
  if (!appState) return false;
  if (appState.cursorButton === "down") return true;
  if (appState.isResizing || appState.isRotating) return true;
  if (appState.draggingElement) return true;
  return false;
}

export function clampIleLearnMorePosition(input: {
  left: number;
  top: number;
  viewport: { left?: number; top?: number; width: number; height: number };
  box?: { width?: number; height?: number };
}): { left: number; top: number } {
  const viewLeft = Number(input.viewport.left) || 0;
  const viewTop = Number(input.viewport.top) || 0;
  const viewW = Number(input.viewport.width) || 0;
  const viewH = Number(input.viewport.height) || 0;
  const pad = ILE_LEARN_MORE_VIEWPORT_PAD;
  const boxW = Math.min(
    input.box?.width ?? ILE_LEARN_MORE_BOX_WIDTH,
    Math.max(0, viewW - pad * 2),
  );
  const boxH = Math.min(
    input.box?.height ?? ILE_LEARN_MORE_BOX_HEIGHT,
    Math.max(0, viewH - pad * 2),
  );
  const minLeft = viewLeft + pad;
  const maxLeft = viewLeft + viewW - boxW - pad;
  const minTop = viewTop + pad;
  const maxTop = viewTop + viewH - boxH - pad;
  return {
    left: Math.round(clampIleRange(input.left, minLeft, maxLeft)),
    top: Math.round(clampIleRange(input.top, minTop, maxTop)),
  };
}
