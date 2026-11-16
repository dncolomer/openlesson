/**
 * Laser-pointer gestures on the Learn work canvas.
 * Only the laser tool feeds this. A question mark runs Simplify, a line from a
 * mark into empty space runs Concepts, and two quick lines run Subdivide.
 */
import {
  ileWorkCanvasNormalizedRect,
  type IleWorkCanvasRect,
} from "@/lib/learn-work-canvas-geometry";
import { BOARD_INSTRUCTION_NOTE_KEY, type IleWorkCanvasElement } from "@/lib/learn-work-canvas-scene";
import type { IleWorkCanvasCommandId } from "@/lib/learn-work-canvas-commands";

export type LaserPoint = { x: number; y: number; t?: number };
export type LaserStroke = LaserPoint[];
export type LaserStrokeKind = "question-mark" | "line" | "unknown";
export type LaserGestureCommand = Extract<IleWorkCanvasCommandId, "simplify" | "concepts" | "breakdown">;

export const LASER_DOUBLE_LINE_MS = 650;
export const LASER_TARGET_PAD = 36;
export const ILE_CANVAS_POINTER_LABEL = "pointer";
export const ILE_CANVAS_POINTER_SHORTCUT = "k";
export const ILE_CANVAS_POINTER_TOOLTIP =
  "Laser pointer. Click again to put it away. Shortcut K. Gestures: ? Simplify, line Concepts, two lines Subdivide.";

export function ileWorkCanvasPointerToolActive(activeTool: unknown): boolean {
  if (typeof activeTool === "string") return activeTool.trim().toLowerCase() === "laser";
  if (activeTool && typeof activeTool === "object" && !Array.isArray(activeTool)) {
    return String((activeTool as { type?: unknown }).type || "")
      .trim()
      .toLowerCase() === "laser";
  }
  return false;
}

/** Laser on → selection. Laser off → laser. */
export function ileWorkCanvasPointerNextTool(active: boolean): { type: "laser" | "selection" } {
  return { type: active ? "selection" : "laser" };
}
const MIN_PATH = 48;
const LINE_STRAIGHTNESS = 0.82;
const QUESTION_STRAIGHTNESS = 0.74;

const SKIP_TYPES = new Set(["arrow", "line", "freedraw", "image"]);

export type LaserGestureSession = {
  pending: {
    targetId: string;
    at: number;
  } | null;
};

export type LaserGestureFire = {
  command: LaserGestureCommand;
  targetId: string;
};

export function emptyLaserGestureSession(): LaserGestureSession {
  return { pending: null };
}

function pathLength(points: LaserStroke): number {
  let sum = 0;
  for (let i = 1; i < points.length; i += 1) {
    const a = points[i - 1]!;
    const b = points[i]!;
    sum += Math.hypot(b.x - a.x, b.y - a.y);
  }
  return sum;
}

function bbox(points: LaserStroke): IleWorkCanvasRect | null {
  if (!points.length) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of points) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  if (!Number.isFinite(minX)) return null;
  return { minX, minY, maxX, maxY };
}

function turning(points: LaserStroke): number {
  if (points.length < 3) return 0;
  let total = 0;
  let prev = Math.atan2(points[1]!.y - points[0]!.y, points[1]!.x - points[0]!.x);
  for (let i = 2; i < points.length; i += 1) {
    const next = Math.atan2(points[i]!.y - points[i - 1]!.y, points[i]!.x - points[i - 1]!.x);
    let delta = next - prev;
    while (delta > Math.PI) delta -= Math.PI * 2;
    while (delta < -Math.PI) delta += Math.PI * 2;
    total += Math.abs(delta);
    prev = next;
  }
  return total;
}

function resample(points: LaserStroke, count: number): LaserStroke {
  const live = points.filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y));
  if (live.length < 2) return live;
  const total = pathLength(live);
  if (!(total > 0)) return live.slice(0, 1);
  const out: LaserStroke = [live[0]!];
  const step = total / (count - 1);
  let walked = 0;
  let i = 1;
  let acc = 0;
  while (out.length < count && i < live.length) {
    const a = live[i - 1]!;
    const b = live[i]!;
    const seg = Math.hypot(b.x - a.x, b.y - a.y);
    if (seg < 1e-6) {
      i += 1;
      continue;
    }
    if (acc + seg >= walked + step) {
      const t = (walked + step - acc) / seg;
      out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
      walked += step;
    } else {
      acc += seg;
      i += 1;
    }
  }
  if (out.length < count) out.push(live[live.length - 1]!);
  return out;
}

/** Classify one laser trail. Pointing and scribbles stay unknown. */
export function classifyLaserStroke(points: LaserStroke): LaserStrokeKind {
  const samples = resample(points, 24);
  if (samples.length < 6) return "unknown";
  const box = bbox(samples);
  const length = pathLength(samples);
  if (!box || length < MIN_PATH) return "unknown";
  const start = samples[0]!;
  const end = samples[samples.length - 1]!;
  const span = Math.hypot(end.x - start.x, end.y - start.y);
  const straightness = span / length;
  const width = Math.max(1, box.maxX - box.minX);
  const height = Math.max(1, box.maxY - box.minY);
  if (straightness >= LINE_STRAIGHTNESS && span >= MIN_PATH) return "line";

  const turns = turning(samples);
  const startY = (start.y - box.minY) / height;
  const endY = (end.y - box.minY) / height;
  const aspect = height / width;
  const first = samples.slice(0, Math.max(4, Math.floor(samples.length * 0.45)));
  const last = samples.slice(Math.floor(samples.length * 0.65));
  const meanX = (pts: LaserStroke) => pts.reduce((s, p) => s + p.x, 0) / Math.max(1, pts.length);
  const hookOffset = Math.abs(meanX(first) - meanX(last)) / width;
  const hookPeak = first.reduce((best, p) => (p.x > best.x ? p : best), first[0]!);
  const hookY = (hookPeak.y - box.minY) / height;
  const question =
    straightness < QUESTION_STRAIGHTNESS &&
    aspect >= 0.65 &&
    aspect <= 3.8 &&
    height >= 36 &&
    startY <= 0.58 &&
    endY >= 0.52 &&
    turns >= 1.35 &&
    hookOffset >= 0.08 &&
    hookY <= 0.72;
  return question ? "question-mark" : "unknown";
}

function pointInRect(point: LaserPoint, rect: IleWorkCanvasRect, pad = 0): boolean {
  return (
    point.x >= rect.minX - pad &&
    point.x <= rect.maxX + pad &&
    point.y >= rect.minY - pad &&
    point.y <= rect.maxY + pad
  );
}

function distToRect(point: LaserPoint, rect: IleWorkCanvasRect): number {
  if (pointInRect(point, rect, 0)) return 0;
  const dx = point.x < rect.minX ? rect.minX - point.x : point.x > rect.maxX ? point.x - rect.maxX : 0;
  const dy = point.y < rect.minY ? rect.minY - point.y : point.y > rect.maxY ? point.y - rect.maxY : 0;
  return Math.hypot(dx, dy);
}

function isSolidMark(el: IleWorkCanvasElement): boolean {
  if (!el || el.isDeleted) return false;
  if (SKIP_TYPES.has(el.type)) return false;
  if (el.customData?.[BOARD_INSTRUCTION_NOTE_KEY] === "label") return false;
  return Boolean(ileWorkCanvasNormalizedRect(el));
}

function noteBodyFor(elements: readonly IleWorkCanvasElement[], el: IleWorkCanvasElement): IleWorkCanvasElement {
  const groupId = Array.isArray(el.groupIds) ? String(el.groupIds[0] || "") : "";
  if (!groupId) return el;
  const body = elements.find(
    (item) =>
      !item.isDeleted &&
      item.customData?.[BOARD_INSTRUCTION_NOTE_KEY] === "body" &&
      Array.isArray(item.groupIds) &&
      item.groupIds.includes(groupId),
  );
  return body ?? el;
}

/** Closest work mark under or beside a scene point. Connectors are ignored. */
export function laserGestureTargetAt(
  elements: readonly IleWorkCanvasElement[],
  point: LaserPoint,
  pad = LASER_TARGET_PAD,
): IleWorkCanvasElement | null {
  let best: { el: IleWorkCanvasElement; dist: number } | null = null;
  for (const el of elements) {
    if (!isSolidMark(el)) continue;
    const rect = ileWorkCanvasNormalizedRect(el);
    if (!rect) continue;
    const dist = distToRect(point, rect);
    if (dist > pad) continue;
    if (!best || dist < best.dist) best = { el, dist };
  }
  return best ? noteBodyFor(elements, best.el) : null;
}

function strokeCentroid(points: LaserStroke): LaserPoint {
  const n = Math.max(1, points.length);
  return {
    x: points.reduce((s, p) => s + p.x, 0) / n,
    y: points.reduce((s, p) => s + p.y, 0) / n,
  };
}

function targetForQuestion(elements: readonly IleWorkCanvasElement[], stroke: LaserStroke): IleWorkCanvasElement | null {
  const hits = new Map<string, number>();
  for (const point of resample(stroke, 16)) {
    const hit = laserGestureTargetAt(elements, point, 8);
    if (!hit) continue;
    hits.set(hit.id, (hits.get(hit.id) ?? 0) + 1);
  }
  let topId: string | null = null;
  let top = 0;
  for (const [id, n] of hits) {
    if (n > top) {
      top = n;
      topId = id;
    }
  }
  if (topId) return elements.find((el) => el.id === topId && !el.isDeleted) ?? null;
  return laserGestureTargetAt(elements, strokeCentroid(stroke));
}

function lineGoesToEmpty(
  elements: readonly IleWorkCanvasElement[],
  stroke: LaserStroke,
  start: IleWorkCanvasElement,
): boolean {
  const end = stroke[stroke.length - 1];
  if (!end) return false;
  const startRect = ileWorkCanvasNormalizedRect(start);
  if (startRect && pointInRect(end, startRect, 8)) return false;
  const endHit = laserGestureTargetAt(elements, end, LASER_TARGET_PAD);
  if (endHit && endHit.id !== start.id) {
    const endGroup = Array.isArray(endHit.groupIds) ? endHit.groupIds[0] : "";
    const startGroup = Array.isArray(start.groupIds) ? start.groupIds[0] : "";
    if (endGroup && endGroup === startGroup) return false;
    return false;
  }
  return true;
}

export function flushPendingLaserGesture(
  session: LaserGestureSession,
  now: number,
): { session: LaserGestureSession; fire: LaserGestureFire | null } {
  const pending = session.pending;
  if (!pending) return { session, fire: null };
  if (now < pending.at + LASER_DOUBLE_LINE_MS) return { session, fire: null };
  return {
    session: { pending: null },
    fire: { command: "concepts", targetId: pending.targetId },
  };
}

/**
 * Fold one finished laser stroke into the session. A second line inside
 * `LASER_DOUBLE_LINE_MS` upgrades a pending Concepts into Subdivide.
 */
export function finishLaserStroke(input: {
  session: LaserGestureSession;
  stroke: LaserStroke;
  elements: readonly IleWorkCanvasElement[];
  now: number;
}): {
  session: LaserGestureSession;
  fire: LaserGestureFire | null;
  waitMs: number | null;
} {
  const kind = classifyLaserStroke(input.stroke);
  const pendingDue = flushPendingLaserGesture(input.session, input.now);
  if (kind === "unknown") {
    return { session: pendingDue.session, fire: pendingDue.fire, waitMs: null };
  }
  if (kind === "question-mark") {
    const target = targetForQuestion(input.elements, input.stroke);
    if (!target) return { session: pendingDue.session, fire: pendingDue.fire, waitMs: null };
    return {
      session: { pending: null },
      fire: { command: "simplify", targetId: target.id },
      waitMs: null,
    };
  }
  const start = input.stroke[0];
  if (!start) return { session: pendingDue.session, fire: pendingDue.fire, waitMs: null };
  const target = laserGestureTargetAt(input.elements, start);
  if (!target || !lineGoesToEmpty(input.elements, input.stroke, target)) {
    return { session: pendingDue.session, fire: pendingDue.fire, waitMs: null };
  }
  const pending = pendingDue.session.pending ?? input.session.pending;
  if (pending && input.now - pending.at <= LASER_DOUBLE_LINE_MS) {
    return {
      session: { pending: null },
      fire: { command: "breakdown", targetId: pending.targetId },
      waitMs: null,
    };
  }
  return {
    session: { pending: { targetId: target.id, at: input.now } },
    fire: null,
    waitMs: LASER_DOUBLE_LINE_MS,
  };
}
