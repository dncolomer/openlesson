/**
 * Workspace-scoped stacked freehand annotation layers on the continuous map plane.
 * White strokes only (circle / square / freehand). Creator draws/deletes;
 * learners see layers and may toggle visibility only.
 */

import {
  mapOverlayPersistTokenFromInput,
  type MapOverlayPersistInput,
} from "@/lib/map-overlay-persist";

/** Always-white stroke color — no picker. */
export const ANNOTATION_STROKE_COLOR = "#ffffff" as const;

/** Three thickness choices (world-plane stroke width, pre-zoom). */
export const ANNOTATION_STROKE_THICKNESSES = [1.5, 3, 6] as const;
export type AnnotationStrokeThickness =
  (typeof ANNOTATION_STROKE_THICKNESSES)[number];

export const ANNOTATION_DEFAULT_STROKE_WIDTH: AnnotationStrokeThickness = 3;
export const ANNOTATION_LAYER_NAME_MAX = 48;
export const ANNOTATION_MAX_LAYERS = 24;
export const ANNOTATION_MAX_STROKES_PER_LAYER = 500;
export const ANNOTATION_MAX_FREEHAND_POINTS = 2000;

export type AnnotationStrokeKind = "circle" | "square" | "freehand";

/** Draw tools include eraser (removes strokes under the brush path). */
export type AnnotationDrawTool = AnnotationStrokeKind | "eraser";

/** Snap arbitrary width to nearest of the three thickness choices. */
export function normalizeAnnotationStrokeThickness(
  value: unknown,
  fallback: AnnotationStrokeThickness = ANNOTATION_DEFAULT_STROKE_WIDTH,
): AnnotationStrokeThickness {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  let best: AnnotationStrokeThickness = ANNOTATION_STROKE_THICKNESSES[0];
  let bestDist = Math.abs(n - best);
  for (const t of ANNOTATION_STROKE_THICKNESSES) {
    const d = Math.abs(n - t);
    if (d < bestDist) {
      best = t;
      bestDist = d;
    }
  }
  return best;
}

export type AnnotationPoint = { x: number; y: number };

export type AnnotationStroke = {
  id: string;
  kind: AnnotationStrokeKind;
  color: typeof ANNOTATION_STROKE_COLOR;
  /** World-plane stroke width (pre-zoom). */
  strokeWidth: number;
  /** Circle */
  cx?: number;
  cy?: number;
  r?: number;
  /** Square / axis-aligned rect from drag */
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  /** Freehand polyline in world coords */
  points?: AnnotationPoint[];
  createdAt: number;
};

export type AnnotationLayer = {
  id: string;
  name: string;
  visible: boolean;
  strokes: AnnotationStroke[];
  createdAt: number;
  updatedAt: number;
};

export type AnnotationLayerCreateInput = {
  name?: string | null;
  id?: string;
  now?: number;
  visible?: boolean;
};

export type AnnotationNotesStorage = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem?(key: string): void;
};

export function annotationLayersStorageKey(input: MapOverlayPersistInput & {
  workspaceId?: string;
}): string {
  const ws = mapOverlayPersistTokenFromInput(input);
  return `openlesson.mapAnnotationLayers.v1:${ws}`;
}

export function normalizeAnnotationLayerName(
  value: unknown,
  fallback = "Layer",
): string {
  const raw =
    typeof value === "string" ? value : String(value ?? "").trim() || fallback;
  const trimmed = raw.replace(/\s+/g, " ").trim().slice(0, ANNOTATION_LAYER_NAME_MAX);
  return trimmed || fallback;
}

export function normalizeAnnotationWorld(value: unknown, fallback = 0): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(-1_000_000, Math.min(1_000_000, n));
}

export function createAnnotationLayerId(seed?: string | number): string {
  if (seed != null && String(seed).trim()) {
    return `alayer-${String(seed).trim()}`;
  }
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `alayer-${crypto.randomUUID()}`;
  }
  return `alayer-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`;
}

export function createAnnotationStrokeId(seed?: string | number): string {
  if (seed != null && String(seed).trim()) {
    return `astroke-${String(seed).trim()}`;
  }
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `astroke-${crypto.randomUUID()}`;
  }
  return `astroke-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`;
}

/** Creator may delete; learner / view-only may not. */
export function canDeleteAnnotationLayer(ctx: {
  learnerMode?: boolean;
  viewOnly?: boolean;
}): boolean {
  if (ctx.viewOnly) return false;
  return !Boolean(ctx.learnerMode);
}

/** Creator may draw; learner / view-only may not. */
export function canDrawOnAnnotationLayer(ctx: {
  learnerMode?: boolean;
  viewOnly?: boolean;
}): boolean {
  if (ctx.viewOnly) return false;
  return !Boolean(ctx.learnerMode);
}

/** Both modes may toggle visibility (including public preview). */
export function canToggleAnnotationLayerVisibility(_ctx?: {
  learnerMode?: boolean;
  viewOnly?: boolean;
}): boolean {
  return true;
}

/** Show handwriting-layer toggles only when layers already exist. */
export function shouldShowAnnotationLayerToggles(layerCount: number): boolean {
  return Math.max(0, Math.floor(Number(layerCount) || 0)) > 0;
}

export function createAnnotationLayer(
  input: AnnotationLayerCreateInput = {},
): AnnotationLayer {
  const now =
    typeof input.now === "number" && Number.isFinite(input.now)
      ? Math.floor(input.now)
      : Date.now();
  return {
    id: createAnnotationLayerId(input.id),
    name: normalizeAnnotationLayerName(input.name),
    visible: input.visible !== false,
    strokes: [],
    createdAt: now,
    updatedAt: now,
  };
}

export function renameAnnotationLayer(
  layer: AnnotationLayer,
  name: unknown,
  now?: number,
): AnnotationLayer {
  const t =
    typeof now === "number" && Number.isFinite(now) ? Math.floor(now) : Date.now();
  return {
    ...layer,
    name: normalizeAnnotationLayerName(name, layer.name),
    updatedAt: t,
  };
}

export function setAnnotationLayerVisible(
  layer: AnnotationLayer,
  visible: boolean,
  now?: number,
): AnnotationLayer {
  const t =
    typeof now === "number" && Number.isFinite(now) ? Math.floor(now) : Date.now();
  return {
    ...layer,
    visible: Boolean(visible),
    updatedAt: t,
  };
}

export function toggleAnnotationLayerVisible(
  layer: AnnotationLayer,
  now?: number,
): AnnotationLayer {
  return setAnnotationLayerVisible(layer, !layer.visible, now);
}

export function deleteAnnotationLayer(
  layers: readonly AnnotationLayer[],
  layerId: string,
  ctx: { learnerMode?: boolean; viewOnly?: boolean } = {},
): AnnotationLayer[] {
  if (!canDeleteAnnotationLayer(ctx)) {
    return layers.map((l) => ({ ...l, strokes: l.strokes.map((s) => ({ ...s })) }));
  }
  const id = String(layerId || "").trim();
  if (!id) return layers.map((l) => ({ ...l, strokes: [...l.strokes] }));
  return (layers || []).filter((l) => l.id !== id);
}

export function upsertAnnotationLayer(
  layers: readonly AnnotationLayer[],
  layer: AnnotationLayer,
): AnnotationLayer[] {
  const id = String(layer.id || "").trim();
  if (!id) return layers.map((l) => ({ ...l, strokes: [...l.strokes] }));
  let found = false;
  const out = (layers || []).map((l) => {
    if (l.id !== id) return l;
    found = true;
    return layer;
  });
  if (!found) {
    if (out.length >= ANNOTATION_MAX_LAYERS) return out;
    out.push(layer);
  }
  return out;
}

/**
 * Build a finished stroke from a draw gesture in world plane coords.
 * circle: start → end defines diameter (center mid, r half distance)
 * square: start → end axis-aligned rect
 * freehand: polyline points
 */
export function buildAnnotationStrokeFromGesture(input: {
  kind: AnnotationStrokeKind;
  start: AnnotationPoint;
  end: AnnotationPoint;
  points?: readonly AnnotationPoint[];
  id?: string;
  now?: number;
  strokeWidth?: number;
}): AnnotationStroke {
  const now =
    typeof input.now === "number" && Number.isFinite(input.now)
      ? Math.floor(input.now)
      : Date.now();
  const strokeWidth = normalizeAnnotationStrokeThickness(
    input.strokeWidth,
    ANNOTATION_DEFAULT_STROKE_WIDTH,
  );
  const base = {
    id: createAnnotationStrokeId(input.id),
    kind: input.kind,
    color: ANNOTATION_STROKE_COLOR,
    strokeWidth,
    createdAt: now,
  };

  if (input.kind === "circle") {
    const x0 = normalizeAnnotationWorld(input.start.x);
    const y0 = normalizeAnnotationWorld(input.start.y);
    const x1 = normalizeAnnotationWorld(input.end.x);
    const y1 = normalizeAnnotationWorld(input.end.y);
    const cx = (x0 + x1) / 2;
    const cy = (y0 + y1) / 2;
    const r = Math.max(
      1,
      Math.hypot(x1 - x0, y1 - y0) / 2,
    );
    return { ...base, cx, cy, r };
  }

  if (input.kind === "square") {
    const x0 = normalizeAnnotationWorld(input.start.x);
    const y0 = normalizeAnnotationWorld(input.start.y);
    const x1 = normalizeAnnotationWorld(input.end.x);
    const y1 = normalizeAnnotationWorld(input.end.y);
    const x = Math.min(x0, x1);
    const y = Math.min(y0, y1);
    const width = Math.max(1, Math.abs(x1 - x0));
    const height = Math.max(1, Math.abs(y1 - y0));
    return { ...base, x, y, width, height };
  }

  // freehand
  const rawPts =
    input.points && input.points.length > 0
      ? input.points
      : [input.start, input.end];
  const points: AnnotationPoint[] = [];
  for (const p of rawPts) {
    if (points.length >= ANNOTATION_MAX_FREEHAND_POINTS) break;
    points.push({
      x: normalizeAnnotationWorld(p.x),
      y: normalizeAnnotationWorld(p.y),
    });
  }
  if (points.length === 0) {
    points.push({
      x: normalizeAnnotationWorld(input.start.x),
      y: normalizeAnnotationWorld(input.start.y),
    });
  }
  return { ...base, points };
}

function distPointToSegment(
  px: number,
  py: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len2 = dx * dx + dy * dy;
  if (len2 <= 1e-12) return Math.hypot(px - x1, py - y1);
  let t = ((px - x1) * dx + (py - y1) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

/** Distance from point to axis-aligned rect perimeter (0 on the edge). */
function distToRectPerimeter(
  px: number,
  py: number,
  x: number,
  y: number,
  w: number,
  h: number,
): number {
  const x1 = x + w;
  const y1 = y + h;
  if (px >= x && px <= x1 && py >= y && py <= y1) {
    return Math.min(px - x, x1 - px, py - y, y1 - py);
  }
  const cx = Math.max(x, Math.min(px, x1));
  const cy = Math.max(y, Math.min(py, y1));
  return Math.hypot(px - cx, py - cy);
}

/**
 * True when eraser brush at `point` with `radius` hits the stroke outline.
 */
export function annotationStrokeHitsPoint(
  stroke: AnnotationStroke,
  point: AnnotationPoint,
  radius: number,
): boolean {
  const brush = Math.max(0.5, Number(radius) || 0);
  const pad = brush + (Number(stroke.strokeWidth) || 2) / 2;
  const px = normalizeAnnotationWorld(point.x);
  const py = normalizeAnnotationWorld(point.y);

  if (stroke.kind === "circle") {
    const cx = stroke.cx ?? 0;
    const cy = stroke.cy ?? 0;
    const sr = Math.max(1, stroke.r ?? 1);
    const d = Math.hypot(px - cx, py - cy);
    // Hit the ring band, or any brush that covers the whole small circle.
    return Math.abs(d - sr) <= pad || d + brush >= sr && d - brush <= sr;
  }

  if (stroke.kind === "square") {
    const x = stroke.x ?? 0;
    const y = stroke.y ?? 0;
    const w = Math.max(1, stroke.width ?? 1);
    const h = Math.max(1, stroke.height ?? 1);
    return distToRectPerimeter(px, py, x, y, w, h) <= pad;
  }

  const pts = stroke.points || [];
  if (pts.length === 0) return false;
  if (pts.length === 1) {
    return Math.hypot(px - pts[0].x, py - pts[0].y) <= pad;
  }
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    if (distPointToSegment(px, py, a.x, a.y, b.x, b.y) <= pad) return true;
  }
  return false;
}

/**
 * Remove strokes that the eraser path touches.
 * `radius` is world-plane brush radius (typically tied to thickness choice).
 */
export function eraseAnnotationStrokesAlongPath(
  layer: AnnotationLayer,
  points: readonly AnnotationPoint[],
  radius: number,
  now?: number,
): AnnotationLayer {
  const t =
    typeof now === "number" && Number.isFinite(now) ? Math.floor(now) : Date.now();
  const samples = (points || []).map((p) => ({
    x: normalizeAnnotationWorld(p.x),
    y: normalizeAnnotationWorld(p.y),
  }));
  if (samples.length === 0) return layer;
  const remaining = (layer.strokes || []).filter((stroke) => {
    for (const p of samples) {
      if (annotationStrokeHitsPoint(stroke, p, radius)) return false;
    }
    // Also test midpoints between consecutive eraser samples for short gaps
    for (let i = 1; i < samples.length; i++) {
      const a = samples[i - 1];
      const b = samples[i];
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      if (annotationStrokeHitsPoint(stroke, mid, radius)) return false;
    }
    return true;
  });
  if (remaining.length === layer.strokes.length) return layer;
  return {
    ...layer,
    strokes: remaining,
    updatedAt: t,
  };
}

/** Eraser brush radius from thickness choice (slightly larger than stroke). */
export function annotationEraserRadiusForThickness(
  thickness: unknown,
): number {
  const t = normalizeAnnotationStrokeThickness(thickness);
  return Math.max(4, t * 2.5);
}

export function appendAnnotationStroke(
  layer: AnnotationLayer,
  stroke: AnnotationStroke,
  now?: number,
): AnnotationLayer {
  const t =
    typeof now === "number" && Number.isFinite(now) ? Math.floor(now) : Date.now();
  const strokes = [...(layer.strokes || [])];
  if (strokes.length >= ANNOTATION_MAX_STROKES_PER_LAYER) {
    strokes.shift();
  }
  strokes.push({
    ...stroke,
    color: ANNOTATION_STROKE_COLOR,
  });
  return {
    ...layer,
    strokes,
    updatedAt: t,
  };
}

export function parseAnnotationLayers(raw: unknown): AnnotationLayer[] {
  if (!Array.isArray(raw)) return [];
  const out: AnnotationLayer[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const rec = item as Record<string, unknown>;
    const id = String(rec.id ?? "").trim();
    if (!id || seen.has(id)) continue;
    const strokesRaw = Array.isArray(rec.strokes) ? rec.strokes : [];
    const strokes: AnnotationStroke[] = [];
    for (const s of strokesRaw) {
      if (!s || typeof s !== "object") continue;
      const sr = s as Record<string, unknown>;
      const kind = sr.kind;
      if (kind !== "circle" && kind !== "square" && kind !== "freehand") continue;
      const sid = String(sr.id ?? "").trim() || createAnnotationStrokeId();
      const strokeWidth = normalizeAnnotationStrokeThickness(
        sr.strokeWidth,
        ANNOTATION_DEFAULT_STROKE_WIDTH,
      );
      const stroke: AnnotationStroke = {
        id: sid,
        kind,
        color: ANNOTATION_STROKE_COLOR,
        strokeWidth,
        createdAt:
          typeof sr.createdAt === "number" && Number.isFinite(sr.createdAt)
            ? Math.floor(sr.createdAt)
            : Date.now(),
      };
      if (kind === "circle") {
        stroke.cx = normalizeAnnotationWorld(sr.cx);
        stroke.cy = normalizeAnnotationWorld(sr.cy);
        stroke.r = Math.max(1, normalizeAnnotationWorld(sr.r, 1));
      } else if (kind === "square") {
        stroke.x = normalizeAnnotationWorld(sr.x);
        stroke.y = normalizeAnnotationWorld(sr.y);
        stroke.width = Math.max(1, normalizeAnnotationWorld(sr.width, 1));
        stroke.height = Math.max(1, normalizeAnnotationWorld(sr.height, 1));
      } else {
        const pts: AnnotationPoint[] = [];
        if (Array.isArray(sr.points)) {
          for (const p of sr.points) {
            if (!p || typeof p !== "object") continue;
            const pr = p as Record<string, unknown>;
            pts.push({
              x: normalizeAnnotationWorld(pr.x),
              y: normalizeAnnotationWorld(pr.y),
            });
            if (pts.length >= ANNOTATION_MAX_FREEHAND_POINTS) break;
          }
        }
        stroke.points = pts.length > 0 ? pts : [{ x: 0, y: 0 }];
      }
      strokes.push(stroke);
      if (strokes.length >= ANNOTATION_MAX_STROKES_PER_LAYER) break;
    }
    out.push({
      id,
      name: normalizeAnnotationLayerName(rec.name),
      visible: rec.visible !== false,
      strokes,
      createdAt:
        typeof rec.createdAt === "number" && Number.isFinite(rec.createdAt)
          ? Math.floor(rec.createdAt)
          : Date.now(),
      updatedAt:
        typeof rec.updatedAt === "number" && Number.isFinite(rec.updatedAt)
          ? Math.floor(rec.updatedAt)
          : Date.now(),
    });
    seen.add(id);
    if (out.length >= ANNOTATION_MAX_LAYERS) break;
  }
  return out;
}

function memoryStorage(): AnnotationNotesStorage {
  const map = new Map<string, string>();
  return {
    getItem: (k) => (map.has(k) ? map.get(k)! : null),
    setItem: (k, v) => {
      map.set(k, v);
    },
    removeItem: (k) => {
      map.delete(k);
    },
  };
}

export function defaultAnnotationLayersStorage(): AnnotationNotesStorage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function loadAnnotationLayers(input: MapOverlayPersistInput & {
  workspaceId?: string;
  storage?: AnnotationNotesStorage | null;
}): AnnotationLayer[] {
  const storage = input.storage ?? defaultAnnotationLayersStorage();
  if (!storage) return [];
  const key = annotationLayersStorageKey(input);
  try {
    const raw = storage.getItem(key);
    if (!raw) return [];
    return parseAnnotationLayers(JSON.parse(raw) as unknown);
  } catch {
    return [];
  }
}

export function saveAnnotationLayers(input: MapOverlayPersistInput & {
  workspaceId?: string;
  layers: readonly AnnotationLayer[];
  storage?: AnnotationNotesStorage | null;
}): void {
  const storage = input.storage ?? defaultAnnotationLayersStorage();
  if (!storage) return;
  const key = annotationLayersStorageKey(input);
  try {
    const payload = (input.layers || []).map((l) => ({
      id: l.id,
      name: l.name,
      visible: l.visible,
      strokes: l.strokes.map((s) => ({
        id: s.id,
        kind: s.kind,
        color: ANNOTATION_STROKE_COLOR,
        strokeWidth: s.strokeWidth,
        cx: s.cx,
        cy: s.cy,
        r: s.r,
        x: s.x,
        y: s.y,
        width: s.width,
        height: s.height,
        points: s.points,
        createdAt: s.createdAt,
      })),
      createdAt: l.createdAt,
      updatedAt: l.updatedAt,
    }));
    storage.setItem(key, JSON.stringify(payload));
  } catch {
    /* quota */
  }
}

export function annotationLayersStoreOps(input: MapOverlayPersistInput & {
  workspaceId?: string;
  storage?: AnnotationNotesStorage | null;
  learnerMode?: boolean;
}) {
  const storage =
    input.storage ?? defaultAnnotationLayersStorage() ?? memoryStorage();
  const scope = {
    workspaceId: input.workspaceId,
    sessionId: input.sessionId,
    mapKind: input.mapKind,
    storage,
  };
  const learnerMode = Boolean(input.learnerMode);

  return {
    list(): AnnotationLayer[] {
      return loadAnnotationLayers(scope);
    },
    create(createInput?: AnnotationLayerCreateInput): AnnotationLayer | null {
      if (learnerMode) return null;
      const list = loadAnnotationLayers(scope);
      if (list.length >= ANNOTATION_MAX_LAYERS) return null;
      const layer = createAnnotationLayer(createInput);
      saveAnnotationLayers({
        ...scope,
        layers: upsertAnnotationLayer(list, layer),
      });
      return layer;
    },
    rename(layerId: string, name: string): AnnotationLayer | null {
      if (learnerMode) return null;
      const list = loadAnnotationLayers(scope);
      const existing = list.find((l) => l.id === layerId);
      if (!existing) return null;
      const updated = renameAnnotationLayer(existing, name);
      saveAnnotationLayers({
        ...scope,
        layers: upsertAnnotationLayer(list, updated),
      });
      return updated;
    },
    toggleVisible(layerId: string): AnnotationLayer | null {
      const list = loadAnnotationLayers(scope);
      const existing = list.find((l) => l.id === layerId);
      if (!existing) return null;
      const updated = toggleAnnotationLayerVisible(existing);
      saveAnnotationLayers({
        ...scope,
        layers: upsertAnnotationLayer(list, updated),
      });
      return updated;
    },
    remove(layerId: string): AnnotationLayer[] {
      const next = deleteAnnotationLayer(
        loadAnnotationLayers(scope),
        layerId,
        { learnerMode },
      );
      if (!learnerMode) {
        saveAnnotationLayers({ ...scope, layers: next });
      }
      return next;
    },
    appendStroke(
      layerId: string,
      stroke: AnnotationStroke,
    ): AnnotationLayer | null {
      if (learnerMode) return null;
      const list = loadAnnotationLayers(scope);
      const existing = list.find((l) => l.id === layerId);
      if (!existing) return null;
      const updated = appendAnnotationStroke(existing, stroke);
      saveAnnotationLayers({
        ...scope,
        layers: upsertAnnotationLayer(list, updated),
      });
      return updated;
    },
  };
}

/**
 * Screen (viewport-local) point → world plane — same transform as blocks/notes.
 * world = (local - pan) / zoom
 */
export function annotationScreenToWorld(input: {
  localX: number;
  localY: number;
  panX: number;
  panY: number;
  zoom: number;
}): AnnotationPoint {
  const zoom =
    Number.isFinite(input.zoom) && input.zoom > 0 ? input.zoom : 1;
  return {
    x: normalizeAnnotationWorld((input.localX - input.panX) / zoom),
    y: normalizeAnnotationWorld((input.localY - input.panY) / zoom),
  };
}

/** World → screen (for tests; render uses CSS transform on parent). */
export function annotationWorldToScreen(input: {
  x: number;
  y: number;
  panX: number;
  panY: number;
  zoom: number;
}): { left: number; top: number } {
  const zoom =
    Number.isFinite(input.zoom) && input.zoom > 0 ? input.zoom : 1;
  return {
    left: normalizeAnnotationWorld(input.x) * zoom + input.panX,
    top: normalizeAnnotationWorld(input.y) * zoom + input.panY,
  };
}

/** SVG path `d` for a freehand stroke in world coords. */
export function annotationFreehandPathD(
  points: readonly AnnotationPoint[] | undefined,
): string {
  if (!points || points.length === 0) return "";
  const [first, ...rest] = points;
  let d = `M ${first.x} ${first.y}`;
  for (const p of rest) {
    d += ` L ${p.x} ${p.y}`;
  }
  return d;
}

export function isAnnotationDrawTool(value: unknown): value is AnnotationDrawTool {
  return (
    value === "circle" ||
    value === "square" ||
    value === "freehand" ||
    value === "eraser"
  );
}

export function isAnnotationStrokeKind(
  value: unknown,
): value is AnnotationStrokeKind {
  return value === "circle" || value === "square" || value === "freehand";
}
