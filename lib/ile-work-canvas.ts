/**
 * ILE Work canvas: per-chapter Excalidraw scene serialize / apply / PoW.
 * Pure over scene JSON so tests can drive it without mounting Excalidraw.
 *
 * Element conversion follows Excalidraw's skeleton API
 * (`convertToExcalidrawElements`): skeletons in, real scene elements out.
 */
import {
  createIleSessionContextStore,
  ileChapterCanvasInitialScene,
  readIleFocusedChapterWorkspace,
  resolveIleChapterContextKey,
} from "@/lib/ile-session-global-context";
import {
  assemblePromptWorkspaceContext,
  type PromptWorkspaceContext,
  type PromptWorkspaceContextInput,
} from "@/lib/prompt-workspace-context";

export const ILE_XAI_CANVAS_CUSTOM_DATA_KEY = "ileXaiTurn" as const;
export const ILE_XAI_LOADING_CUSTOM_DATA_KEY = "ileXaiLoading" as const;
export const ILE_CHAPTER_SEED_CUSTOM_DATA_KEY = "ileChapterSeed" as const;
export const ILE_COMPRESS_WORK_CUSTOM_DATA_KEY = "ileCompressWork" as const;
export const ILE_XAI_LOADING_TEXT = "Thinking ...";

/** Excalidraw drawing tools that map to ILE Work PoW. */
export const ILE_EXCALIDRAW_POW_TOOLS = [
  "text",
  "freedraw",
  "rectangle",
  "diamond",
  "ellipse",
  "arrow",
  "line",
  "image",
  "eraser",
  "frame",
  "selection",
] as const;

export type IleExcalidrawPowTool = (typeof ILE_EXCALIDRAW_POW_TOOLS)[number];

/** Scene primitives XAI may emit in JSON "elements" (eraser/selection are learner-only). */
export const ILE_XAI_CANVAS_SHAPE_TYPES = [
  "text",
  "freedraw",
  "rectangle",
  "diamond",
  "ellipse",
  "arrow",
  "line",
  "frame",
  "image",
] as const;

export type IleXaiCanvasShapeType = (typeof ILE_XAI_CANVAS_SHAPE_TYPES)[number];

const ILE_XAI_CANVAS_SHAPE_SET = new Set<string>(ILE_XAI_CANVAS_SHAPE_TYPES);

const ILE_XAI_CANVAS_SHAPE_ALIASES: Record<string, IleXaiCanvasShapeType> = {
  text: "text",
  rectangle: "rectangle",
  rect: "rectangle",
  box: "rectangle",
  square: "rectangle",
  diamond: "diamond",
  rhombus: "diamond",
  ellipse: "ellipse",
  circle: "ellipse",
  oval: "ellipse",
  arrow: "arrow",
  line: "line",
  freedraw: "freedraw",
  scribble: "freedraw",
  draw: "freedraw",
  frame: "frame",
  image: "image",
};

export function ileWorkCanvasXaiShapeType(raw: unknown): IleXaiCanvasShapeType | null {
  const key = String(raw || "")
    .trim()
    .toLowerCase();
  if (!key) return null;
  const aliased = ILE_XAI_CANVAS_SHAPE_ALIASES[key];
  if (aliased) return aliased;
  return ILE_XAI_CANVAS_SHAPE_SET.has(key) ? (key as IleXaiCanvasShapeType) : null;
}

/** Turn + system instruction: tools on the board and how to draw them in JSON. */
export function ileWorkCanvasXaiToolsInstruction(): string {
  const tools = ILE_EXCALIDRAW_POW_TOOLS.join(", ");
  const shapes = ILE_XAI_CANVAS_SHAPE_TYPES.filter((type) => type !== "image").join(", ");
  return [
    `EXCALIDRAW DRAWING TOOLS on this board (name these when routing work): ${tools}.`,
    `You can CREATE the same marks in your reply via JSON "elements" (types: ${shapes}).`,
    "Skip eraser and selection — those are learner tools only. Skip image unless you already have a fileId.",
    `Reply as JSON: {"text":"<coaching reply, also placed as a text block>","origin":{"x":number,"y":number},"elements":[{"type":"rectangle","x":120,"y":240,"width":160,"height":80,"label":{"text":"optional caption"}}]}.`,
    `"elements" may include ${shapes}. Arrows/lines/freedraw may include "points":[[x,y],...]. Labeled shapes use "label":{"text":"..."}. Place marks near related existing elements. Always include "text". Never mention this JSON format to the learner.`,
  ].join(" ");
}

const RETIRED_ILE_WORK_TOOLS = new Set(["notebook", "grokipedia", "dantes"]);

export type IleWorkCanvasAppState = Record<string, unknown>;
export type IleWorkCanvasFiles = Record<string, unknown>;

export type IleWorkCanvasElement = {
  id: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  angle: number;
  strokeColor: string;
  backgroundColor: string;
  fillStyle: string;
  strokeWidth: number;
  strokeStyle: string;
  roughness: number;
  opacity: number;
  groupIds: string[];
  frameId: string | null;
  roundness: { type: number; value?: number } | null;
  seed: number;
  version: number;
  versionNonce: number;
  isDeleted: boolean;
  boundElements: unknown[] | null;
  updated: number;
  link: string | null;
  locked: boolean;
  customData?: Record<string, unknown> | null;
  text?: string;
  originalText?: string;
  fontSize?: number;
  fontFamily?: number;
  textAlign?: string;
  verticalAlign?: string;
  containerId?: string | null;
  autoResize?: boolean;
  lineHeight?: number;
  points?: number[][];
  fileId?: string;
  scale?: [number, number];
  [key: string]: unknown;
};

export type IleWorkCanvasScene = {
  elements: IleWorkCanvasElement[];
  appState: IleWorkCanvasAppState;
  files: IleWorkCanvasFiles;
};

/** Skeleton accepted by convertIleWorkCanvasSkeletons (Excalidraw skeleton shape). */
export type IleWorkCanvasSkeleton = {
  type: string;
  id?: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  text?: string;
  fileId?: string;
  strokeColor?: string;
  backgroundColor?: string;
  label?: { text?: string };
  customData?: Record<string, unknown> | null;
  [key: string]: unknown;
};

export type IleXaiCanvasTurnPayload = {
  text?: string | null;
  elements?: IleWorkCanvasSkeleton[] | null;
  turnId?: string | null;
  origin?: { x?: number; y?: number } | null;
};

/** Finite scene origin from XAI JSON (or apply payload). Invalid → null (fallback). */
export function ileWorkCanvasFiniteOrigin(
  raw: { x?: unknown; y?: unknown } | null | undefined,
): { x: number; y: number } | null {
  if (!raw || typeof raw !== "object") return null;
  if (raw.x == null || raw.y == null) return null;
  const x = Number(raw.x);
  const y = Number(raw.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return { x, y };
}

const DEFAULT_FONT_SIZE = 20;
const DEFAULT_LINE_HEIGHT = 1.25;
const DEFAULT_DIMENSION = 100;
const TEXT_GAP_Y = 48;
const TEXT_ORIGIN_X = 80;
const TEXT_ORIGIN_Y = 80;
/** Narrow column so chapter seed / XAI replies stay on-screen. */
export const ILE_WORK_CANVAS_TEXT_BOX_WIDTH = 320;

let skeletonSeq = 0;

function nextElementId(prefix = "ile"): string {
  skeletonSeq += 1;
  return `${prefix}${Date.now().toString(36)}${skeletonSeq.toString(36)}`;
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return { ...(value as Record<string, unknown>) };
}

function cloneJson<T>(value: T): T {
  try {
    return JSON.parse(JSON.stringify(value)) as T;
  } catch {
    return value;
  }
}

export const ILE_WORK_CANVAS_DEFAULT_GRID_SIZE = 20;
/** Excalidraw FONT_FAMILY.Nunito */
export const ILE_WORK_CANVAS_FONT_FAMILY = 6;
/** Excalidraw dark theme inverts the canvas: stored black renders as white. */
export const ILE_WORK_CANVAS_STROKE_COLOR = "#1e1e1e";

/** Excalidraw grid on + white stroke default for ILE Work canvases. */
export function withIleWorkCanvasGridAppState(
  appState: IleWorkCanvasAppState | null | undefined,
): IleWorkCanvasAppState {
  const next = asRecord(appState);
  next.gridModeEnabled = true;
  if (typeof next.gridSize !== "number" || next.gridSize <= 0) {
    next.gridSize = ILE_WORK_CANVAS_DEFAULT_GRID_SIZE;
  }
  if (typeof next.currentItemStrokeColor !== "string" || !String(next.currentItemStrokeColor).trim()) {
    next.currentItemStrokeColor = ILE_WORK_CANVAS_STROKE_COLOR;
  }
  next.currentItemFontFamily = ILE_WORK_CANVAS_FONT_FAMILY;
  return next;
}

export function emptyIleWorkCanvasScene(): IleWorkCanvasScene {
  return { elements: [], appState: withIleWorkCanvasGridAppState({}), files: {} };
}

/** Difficulty: Work-canvas countdown before the board resets (insights stay). */
export const ILE_CANVAS_TIMER_SECONDS_MIN = 10 * 60;
export const ILE_CANVAS_TIMER_SECONDS_DEFAULT = 15 * 60;
export const ILE_CANVAS_TIMER_SECONDS_CEILING = 60 * 60;
export const ILE_CANVAS_TIMER_SECONDS_STEP = 60;

export function clampIleCanvasTimerSeconds(value: unknown): number {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n) || n <= 0) return ILE_CANVAS_TIMER_SECONDS_DEFAULT;
  if (n < ILE_CANVAS_TIMER_SECONDS_MIN) return ILE_CANVAS_TIMER_SECONDS_MIN;
  if (n > ILE_CANVAS_TIMER_SECONDS_CEILING) return ILE_CANVAS_TIMER_SECONDS_CEILING;
  return n;
}

export function ileWorkCanvasTimerRemainingSeconds(input: {
  durationSeconds: unknown;
  startedAtMs: unknown;
  nowMs: unknown;
}): number {
  const duration = clampIleCanvasTimerSeconds(input.durationSeconds);
  const started = Number(input.startedAtMs);
  const now = Number(input.nowMs);
  if (!Number.isFinite(started) || !Number.isFinite(now)) return duration;
  const elapsed = Math.max(0, (now - started) / 1000);
  return Math.max(0, Math.ceil(duration - elapsed));
}

export function ileWorkCanvasTimerExpired(input: {
  durationSeconds: unknown;
  startedAtMs: unknown;
  nowMs: unknown;
}): boolean {
  return ileWorkCanvasTimerRemainingSeconds(input) <= 0;
}

export function formatIleWorkCanvasTimer(remainingSeconds: unknown): string {
  const s = Math.max(0, Math.floor(Number(remainingSeconds) || 0));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, "0")}`;
}

/** Overlay duration so timer reset is visible before the seed returns. */
export const ILE_CANVAS_TIMER_RESET_LOADING_MS = 700;

/**
 * Timer hit zero: clear learner work, then re-seed the original chapter
 * prompt as a single text element. Insights stay off-canvas.
 */
export const ILE_WORK_CANVAS_DEFAULT_APP_STATE_KEYS = [
  "gridModeEnabled",
  "gridSize",
  "currentItemStrokeColor",
  "currentItemFontFamily",
] as const;

/** What survives an Excalidraw restoreAppState / updateScene round-trip. */
export function ileWorkCanvasAppStateKeepingDefaultKeys(
  appState: IleWorkCanvasAppState | null | undefined,
): IleWorkCanvasAppState {
  const rec = asRecord(appState);
  const kept: Record<string, unknown> = {};
  for (const key of ILE_WORK_CANVAS_DEFAULT_APP_STATE_KEYS) {
    if (key in rec) kept[key] = rec[key];
  }
  return withIleWorkCanvasGridAppState(kept);
}

export function recordIleWorkCanvasTimerResetChapter(
  resetChapterIds: readonly string[] | ReadonlySet<string> | null | undefined,
  chapterId: unknown,
): string[] {
  const id = String(chapterId ?? "").trim();
  const next: string[] = [];
  const seen = new Set<string>();
  const source =
    resetChapterIds instanceof Set
      ? resetChapterIds
      : (resetChapterIds ?? []);
  for (const row of source) {
    const key = String(row || "").trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    next.push(key);
  }
  if (id && !seen.has(id)) next.push(id);
  return next;
}

export function ileWorkCanvasTimerResetBlocksSeed(input: {
  chapterId?: unknown;
  resetChapterIds?: readonly string[] | ReadonlySet<string> | null;
  canvasTimerReset?: boolean | null;
}): boolean {
  if (input.canvasTimerReset === true) return true;
  const id = String(input.chapterId ?? "").trim();
  if (!id) return false;
  const ids = input.resetChapterIds
    ? Array.from(input.resetChapterIds)
    : [];
  return ids.some((row) => String(row || "").trim() === id);
}

export function ileWorkCanvasInitialSeedText(
  scene: IleWorkCanvasScene | null | undefined,
): string {
  const live = serializeIleWorkCanvasScene(scene).elements.filter((el) => !el.isDeleted);
  const seed = live.find(
    (el) => el.customData?.[ILE_CHAPTER_SEED_CUSTOM_DATA_KEY] === true,
  );
  return String(seed?.originalText || seed?.text || "").trim();
}

export function resetIleWorkCanvasSceneOnTimerExpiry<T>(input: {
  scene?: IleWorkCanvasScene | null;
  insights?: readonly T[] | null;
  chapterId?: unknown;
  seedText?: unknown;
  resetChapterIds?: readonly string[] | ReadonlySet<string> | null;
}): { scene: IleWorkCanvasScene; insights: T[]; resetChapterIds: string[] } {
  const seedText =
    ileWorkCanvasInitialSeedText(input.scene) || String(input.seedText ?? "").trim();
  const empty = emptyIleWorkCanvasScene();
  const seeded = seedIleChapterWorkCanvas(empty, {
    text: seedText || null,
    chapterId: String(input.chapterId ?? "").trim() || null,
  });
  return {
    scene: seeded.scene,
    insights: [...(input.insights ?? [])],
    resetChapterIds: recordIleWorkCanvasTimerResetChapter(
      input.resetChapterIds,
      input.chapterId,
    ),
  };
}

function coerceElement(raw: unknown): IleWorkCanvasElement | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const rec = raw as Record<string, unknown>;
  const type = typeof rec.type === "string" ? rec.type : "";
  if (!type) return null;
  const id = typeof rec.id === "string" && rec.id.trim() ? rec.id : nextElementId("el");
  return {
    ...rec,
    id,
    type,
    x: Number(rec.x) || 0,
    y: Number(rec.y) || 0,
    width: Number(rec.width) || 0,
    height: Number(rec.height) || 0,
    angle: Number(rec.angle) || 0,
    strokeColor: typeof rec.strokeColor === "string" ? rec.strokeColor : "#ffffff",
    backgroundColor: typeof rec.backgroundColor === "string" ? rec.backgroundColor : "transparent",
    fillStyle: typeof rec.fillStyle === "string" ? rec.fillStyle : "solid",
    strokeWidth: Number(rec.strokeWidth) || 2,
    strokeStyle: typeof rec.strokeStyle === "string" ? rec.strokeStyle : "solid",
    roughness: rec.roughness == null ? 1 : Number(rec.roughness) || 0,
    opacity: rec.opacity == null ? 100 : Number(rec.opacity) || 0,
    groupIds: Array.isArray(rec.groupIds) ? (rec.groupIds as string[]) : [],
    frameId: typeof rec.frameId === "string" ? rec.frameId : null,
    roundness: (rec.roundness as IleWorkCanvasElement["roundness"]) ?? null,
    seed: Number(rec.seed) || 1,
    version: Number(rec.version) || 1,
    versionNonce: Number(rec.versionNonce) || 1,
    isDeleted: Boolean(rec.isDeleted),
    boundElements: Array.isArray(rec.boundElements) ? rec.boundElements : null,
    updated: Number(rec.updated) || Date.now(),
    link: typeof rec.link === "string" ? rec.link : null,
    locked: Boolean(rec.locked),
  };
}

/**
 * Restorable board snapshot for an XAI turn: elements + appState + files,
 * collaborators stripped (they do not survive JSON).
 */
export function serializeIleWorkCanvasScene(
  scene: { elements?: unknown; appState?: unknown; files?: unknown } | null | undefined,
): IleWorkCanvasScene {
  if (!scene || typeof scene !== "object") return emptyIleWorkCanvasScene();
  const appState = asRecord(scene.appState);
  const { collaborators: _collaborators, ...restorableAppState } = appState;
  const elements = Array.isArray(scene.elements)
    ? scene.elements.map(coerceElement).filter((el): el is IleWorkCanvasElement => Boolean(el))
    : [];
  return {
    elements: cloneJson(elements),
    appState: cloneJson(withIleWorkCanvasGridAppState(restorableAppState)),
    files: cloneJson(asRecord(scene.files)),
  };
}

function measureText(text: string, fontSize: number, lineHeight: number): { width: number; height: number } {
  const wrapped = wrapIleWorkCanvasText(text, ILE_WORK_CANVAS_TEXT_BOX_WIDTH, fontSize);
  return { width: wrapped.width, height: wrapped.height };
}

/** Word-wrap into a narrow text box so long replies are visible without a single long line. */
export function wrapIleWorkCanvasText(
  text: string,
  maxWidth = ILE_WORK_CANVAS_TEXT_BOX_WIDTH,
  fontSize = DEFAULT_FONT_SIZE,
): { text: string; originalText: string; width: number; height: number; lineCount: number } {
  const originalText = String(text || "");
  const charW = Math.max(6, fontSize * 0.55);
  const maxChars = Math.max(12, Math.floor(maxWidth / charW));
  const paragraphs = originalText.replace(/\r\n/g, "\n").split("\n");
  const lines: string[] = [];
  for (const para of paragraphs) {
    const words = para.split(/\s+/).filter(Boolean);
    if (!words.length) {
      lines.push("");
      continue;
    }
    let current = "";
    const pushWord = (word: string) => {
      if (word.length <= maxChars) {
        current = current ? `${current} ${word}` : word;
        return;
      }
      if (current) {
        lines.push(current);
        current = "";
      }
      for (let i = 0; i < word.length; i += maxChars) {
        const chunk = word.slice(i, i + maxChars);
        if (i + maxChars < word.length) lines.push(chunk);
        else current = chunk;
      }
    };
    for (const word of words) {
      if (!current) {
        pushWord(word);
        continue;
      }
      if (`${current} ${word}`.length <= maxChars) {
        current = `${current} ${word}`;
        continue;
      }
      lines.push(current);
      current = "";
      pushWord(word);
    }
    if (current) lines.push(current);
  }
  const wrapped = lines.join("\n");
  const lineCount = Math.max(1, lines.length);
  return {
    text: wrapped,
    originalText,
    width: maxWidth,
    height: Math.max(fontSize, Math.ceil(lineCount * fontSize * DEFAULT_LINE_HEIGHT)),
    lineCount,
  };
}

function baseElement(
  type: string,
  skeleton: IleWorkCanvasSkeleton,
  opts?: { regenerateIds?: boolean },
): IleWorkCanvasElement {
  const regenerate = opts?.regenerateIds !== false;
  const id =
    !regenerate && typeof skeleton.id === "string" && skeleton.id.trim()
      ? skeleton.id
      : nextElementId(type.slice(0, 3));
  const now = Date.now();
  return {
    id,
    type,
    x: Number(skeleton.x) || 0,
    y: Number(skeleton.y) || 0,
    width: Number(skeleton.width) || DEFAULT_DIMENSION,
    height: Number(skeleton.height) || DEFAULT_DIMENSION,
    angle: Number(skeleton.angle) || 0,
    strokeColor:
      typeof skeleton.strokeColor === "string" ? skeleton.strokeColor : ILE_WORK_CANVAS_STROKE_COLOR,
    backgroundColor:
      typeof skeleton.backgroundColor === "string" ? skeleton.backgroundColor : "transparent",
    fillStyle: typeof skeleton.fillStyle === "string" ? skeleton.fillStyle : "solid",
    strokeWidth: Number(skeleton.strokeWidth) || 2,
    strokeStyle: typeof skeleton.strokeStyle === "string" ? skeleton.strokeStyle : "solid",
    roughness: skeleton.roughness == null ? 1 : Number(skeleton.roughness) || 0,
    opacity: skeleton.opacity == null ? 100 : Number(skeleton.opacity) || 0,
    groupIds: Array.isArray(skeleton.groupIds) ? (skeleton.groupIds as string[]) : [],
    frameId: typeof skeleton.frameId === "string" ? skeleton.frameId : null,
    roundness: (skeleton.roundness as IleWorkCanvasElement["roundness"]) ?? null,
    seed: Number(skeleton.seed) || Math.floor(Math.random() * 2 ** 31),
    version: 1,
    versionNonce: Math.floor(Math.random() * 2 ** 31),
    isDeleted: false,
    boundElements: null,
    updated: now,
    link: typeof skeleton.link === "string" ? skeleton.link : null,
    locked: Boolean(skeleton.locked),
    customData: skeleton.customData ?? null,
  };
}

/**
 * Shipped wrapper around Excalidraw `convertToExcalidrawElements`.
 * Turns skeletons into user-editable scene elements (`type: "text"` etc.).
 */
export function convertIleWorkCanvasSkeletons(
  skeletons: IleWorkCanvasSkeleton[] | null | undefined,
  opts?: { regenerateIds?: boolean },
): IleWorkCanvasElement[] {
  if (!skeletons?.length) return [];
  const out: IleWorkCanvasElement[] = [];
  for (const skeleton of skeletons) {
    if (!skeleton || typeof skeleton !== "object") continue;
    const type = ileWorkCanvasXaiShapeType(skeleton.type);
    if (!type) continue;
    if (type === "text") {
      const text = String(skeleton.text ?? skeleton.label?.text ?? "");
      const fontSize = Number(skeleton.fontSize) || DEFAULT_FONT_SIZE;
      const lineHeight = Number(skeleton.lineHeight) || DEFAULT_LINE_HEIGHT;
      const autoResize = skeleton.autoResize === true;
      const boxWidth = Number(skeleton.width) || ILE_WORK_CANVAS_TEXT_BOX_WIDTH;
      const wrapped = wrapIleWorkCanvasText(text, boxWidth, fontSize);
      const el = baseElement("text", skeleton, opts);
      el.width = autoResize ? Number(skeleton.width) || wrapped.width : wrapped.width;
      el.height = Number(skeleton.height) || wrapped.height;
      el.text = autoResize ? text : wrapped.text;
      el.originalText = text;
      el.fontSize = fontSize;
      el.fontFamily = Number(skeleton.fontFamily) || ILE_WORK_CANVAS_FONT_FAMILY;
      el.textAlign = typeof skeleton.textAlign === "string" ? skeleton.textAlign : "left";
      el.verticalAlign = typeof skeleton.verticalAlign === "string" ? skeleton.verticalAlign : "top";
      el.containerId = null;
      el.autoResize = autoResize;
      el.lineHeight = lineHeight;
      out.push(el);
      continue;
    }
    if (type === "arrow" || type === "line") {
      const el = baseElement(type, skeleton, opts);
      const width = Number(skeleton.width) || DEFAULT_DIMENSION;
      const height = Number(skeleton.height) || 0;
      el.width = width;
      el.height = height;
      el.points = Array.isArray(skeleton.points)
        ? (skeleton.points as number[][])
        : [
            [0, 0],
            [width, height],
          ];
      out.push(el);
      continue;
    }
    if (type === "image") {
      const el = baseElement("image", skeleton, opts);
      el.fileId = typeof skeleton.fileId === "string" ? skeleton.fileId : "";
      el.scale = [1, 1];
      out.push(el);
      continue;
    }
    if (type === "freedraw") {
      const el = baseElement("freedraw", skeleton, opts);
      el.points = Array.isArray(skeleton.points) ? (skeleton.points as number[][]) : [[0, 0]];
      out.push(el);
      continue;
    }
    const el = baseElement(type, skeleton, opts);
    if (skeleton.label?.text) {
      const labelText = String(skeleton.label.text);
      const fontSize = DEFAULT_FONT_SIZE;
      const metrics = measureText(labelText, fontSize, DEFAULT_LINE_HEIGHT);
      const label = baseElement(
        "text",
        {
          type: "text",
          text: labelText,
          x: el.x + 8,
          y: el.y + 8,
        },
        opts,
      );
      label.width = metrics.width;
      label.height = metrics.height;
      label.text = labelText;
      label.originalText = labelText;
      label.fontSize = fontSize;
      label.fontFamily = ILE_WORK_CANVAS_FONT_FAMILY;
      label.containerId = el.id;
      label.autoResize = true;
      label.lineHeight = DEFAULT_LINE_HEIGHT;
      el.boundElements = [{ type: "text", id: label.id }];
      out.push(el, label);
      continue;
    }
    out.push(el);
  }
  return out;
}

/** Alias matching Excalidraw's public skeleton converter name. */
export const convertToExcalidrawElements = convertIleWorkCanvasSkeletons;

export function ileWorkCanvasContentBounds(
  elements: readonly Pick<IleWorkCanvasElement, "x" | "y" | "width" | "height" | "isDeleted">[],
): { minX: number; minY: number; maxX: number; maxY: number } | null {
  const live = elements.filter((el) => !el.isDeleted);
  if (!live.length) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const el of live) {
    minX = Math.min(minX, el.x);
    minY = Math.min(minY, el.y);
    maxX = Math.max(maxX, el.x + (el.width || 0));
    maxY = Math.max(maxY, el.y + (el.height || 0));
  }
  return { minX, minY, maxX, maxY };
}

/**
 * Excalidraw `scrollToContent` options for opening a Work board: pan so
 * content is centered, keep the current zoom, no animation.
 */
export const ILE_WORK_CANVAS_SCROLL_TO_CONTENT_OPTS = { animate: false } as const;

/**
 * Scroll offsets that place `bounds` at the viewport center (same formula as
 * Excalidraw `centerScrollOn` without sidebar offsets). Null when the viewport
 * size is unknown — do not write fake scroll into a seed scene.
 */
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

function nextXaiTextOrigin(elements: readonly IleWorkCanvasElement[]): { x: number; y: number } {
  const bounds = ileWorkCanvasContentBounds(elements);
  if (!bounds) return { x: TEXT_ORIGIN_X, y: TEXT_ORIGIN_Y };
  return { x: bounds.minX, y: bounds.maxY + TEXT_GAP_Y };
}

function normalizeExtraSkeletons(raw: unknown): IleWorkCanvasSkeleton[] {
  if (!Array.isArray(raw)) return [];
  const out: IleWorkCanvasSkeleton[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const rec = item as IleWorkCanvasSkeleton;
    const type = ileWorkCanvasXaiShapeType(rec.type);
    if (!type) continue;
    if (type === "image" && typeof rec.fileId !== "string") continue;
    out.push({ ...rec, type });
  }
  return out;
}

export function ileWorkCanvasHasLiveElements(
  scene: IleWorkCanvasScene | null | undefined,
): boolean {
  return serializeIleWorkCanvasScene(scene).elements.some((el) => !el.isDeleted);
}

/**
 * Mount-only empty recovery. After the learner has cleared a live board,
 * do not paste the previous scene back.
 */
export function ileWorkCanvasShouldRestoreEmptyBoard(input: {
  liveNonDeletedCount: number;
  initialHasLive: boolean;
  userCleared?: boolean;
}): boolean {
  if (input.liveNonDeletedCount > 0) return false;
  if (!input.initialHasLive) return false;
  if (input.userCleared) return false;
  return true;
}

/** True when incoming is a user delete of a previously live board (not a mount wipe). */
export function ileWorkCanvasIncomingClearsLiveScene(
  current: IleWorkCanvasScene | null | undefined,
  incoming: IleWorkCanvasScene | null | undefined,
): boolean {
  if (!ileWorkCanvasHasLiveElements(current)) return false;
  if (ileWorkCanvasHasLiveElements(incoming)) return false;
  return serializeIleWorkCanvasScene(incoming).elements.some((el) => el.isDeleted);
}

/** Excalidraw `initialData` flag: center on live elements at first paint. */
export function ileWorkCanvasWithScrollToContent<T extends { elements?: unknown[] }>(
  scene: T,
): T & { scrollToContent?: boolean } {
  if (!ileWorkCanvasHasLiveElements(scene as unknown as IleWorkCanvasScene)) return scene;
  return { ...scene, scrollToContent: true };
}

/**
 * First open of a chapter board: place the chapter's initial text as a
 * manipulable Excalidraw text element. No-op when the board already has work.
 */
export function seedIleChapterWorkCanvas(
  scene: IleWorkCanvasScene | null | undefined,
  input: {
    text?: string | null;
    chapterId?: string | null;
    resetChapterIds?: readonly string[] | ReadonlySet<string> | null;
    canvasTimerReset?: boolean | null;
  },
): { scene: IleWorkCanvasScene; seeded: boolean } {
  const current = serializeIleWorkCanvasScene(scene);
  const text = String(input.text || "").trim();
  if (!text) return { scene: current, seeded: false };
  if (ileWorkCanvasHasLiveElements(current)) return { scene: current, seeded: false };
  if (
    ileWorkCanvasTimerResetBlocksSeed({
      chapterId: input.chapterId,
      resetChapterIds: input.resetChapterIds,
      canvasTimerReset: input.canvasTimerReset,
    })
  ) {
    return { scene: current, seeded: false };
  }
  const origin = nextXaiTextOrigin(current.elements);
  const converted = convertToExcalidrawElements([
    {
      type: "text",
      text,
      x: origin.x,
      y: origin.y,
      width: ILE_WORK_CANVAS_TEXT_BOX_WIDTH,
      autoResize: false,
      customData: {
        [ILE_CHAPTER_SEED_CUSTOM_DATA_KEY]: true,
        chapterId: resolveIleChapterContextKey(input.chapterId),
        author: "chapter",
      },
    },
  ]);
  if (!converted.length) return { scene: current, seeded: false };
  return {
    scene: {
      elements: [...current.elements, ...converted],
      appState: current.appState,
      files: current.files,
    },
    seeded: true,
  };
}

/**
 * Merge an XAI turn onto the chapter board: response text becomes a real
 * `type: "text"` element (plus optional extra skeletons), via the skeleton converter.
 */
export function applyIleXaiTurnToWorkCanvas(
  scene: IleWorkCanvasScene | null | undefined,
  payload: IleXaiCanvasTurnPayload,
): IleWorkCanvasScene {
  const current = serializeIleWorkCanvasScene(scene);
  const text = String(payload.text || "").trim();
  const extra = normalizeExtraSkeletons(payload.elements);
  if (!text && extra.length === 0) return current;

  const origin = ileWorkCanvasFiniteOrigin(payload.origin) ?? nextXaiTextOrigin(current.elements);
  const turnId = String(payload.turnId || `turn-${Date.now()}`);
  const customData = {
    [ILE_XAI_CANVAS_CUSTOM_DATA_KEY]: true,
    turnId,
    author: "xai",
  };
  const skeletons: IleWorkCanvasSkeleton[] = [];
  let extraY = origin.y;
  if (text) {
    const wrapped = wrapIleWorkCanvasText(text);
    skeletons.push({
      type: "text",
      text,
      x: origin.x,
      y: origin.y,
      width: wrapped.width,
      autoResize: false,
      customData,
    });
    extraY = origin.y + wrapped.height + 16;
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
  const converted = convertToExcalidrawElements(skeletons);
  return {
    elements: [...current.elements, ...converted],
    appState: current.appState,
    files: current.files,
  };
}

export function isIleXaiLoadingElement(el: IleWorkCanvasElement | null | undefined): boolean {
  return Boolean(el?.customData?.[ILE_XAI_LOADING_CUSTOM_DATA_KEY]);
}

/** Fixed thinking overlay / empty-nearby occupancy — square, not a shrink-to-copy chip. */
export const ILE_XAI_LOADING_BOX_SIZE = 128;
export const ILE_XAI_LOADING_BOX_WIDTH = ILE_XAI_LOADING_BOX_SIZE;
export const ILE_XAI_LOADING_BOX_HEIGHT = ILE_XAI_LOADING_BOX_SIZE;
export const ILE_XAI_LOADING_GAP = 28;
export const ILE_XAI_LOADING_CLEARANCE = 16;

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
    width: ILE_XAI_LOADING_BOX_WIDTH,
    height: ILE_XAI_LOADING_BOX_HEIGHT,
    minWidth: ILE_XAI_LOADING_BOX_WIDTH,
    minHeight: ILE_XAI_LOADING_BOX_HEIGHT,
    maxWidth: ILE_XAI_LOADING_BOX_WIDTH,
    maxHeight: ILE_XAI_LOADING_BOX_HEIGHT,
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

export function ileWorkCanvasElementRect(
  el: Pick<IleWorkCanvasElement, "x" | "y" | "width" | "height">,
): { minX: number; minY: number; maxX: number; maxY: number } {
  return {
    minX: el.x,
    minY: el.y,
    maxX: el.x + (el.width || 0),
    maxY: el.y + (el.height || 0),
  };
}

export function ileWorkCanvasRectsOverlap(
  a: { minX: number; minY: number; maxX: number; maxY: number },
  b: { minX: number; minY: number; maxX: number; maxY: number },
  pad = 0,
): boolean {
  return !(
    a.maxX + pad <= b.minX ||
    b.maxX + pad <= a.minX ||
    a.maxY + pad <= b.minY ||
    b.maxY + pad <= a.minY
  );
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
    .map(ileWorkCanvasElementRect);
  const clearance = ILE_XAI_LOADING_CLEARANCE;
  for (let ring = 1; ring <= 6; ring += 1) {
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
  return {
    x: Math.round(nearBounds.maxX + gap * 6),
    y: Math.round(nearBounds.minY),
  };
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
  const origin =
    ileWorkCanvasFiniteOrigin(payload.origin) ??
    ileWorkCanvasFiniteOrigin(input?.fallbackOrigin) ??
    ileWorkCanvasEmptyNearbyOriginWithReserved({
      elements: current.elements,
      reserved: input?.reserved,
    });
  return applyIleXaiTurnToWorkCanvas(current, { ...payload, origin });
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

export const ILE_LEARN_MORE_LABEL = "Expand More";
export const ILE_LEARN_MORE_BOX_WIDTH = 288;
/** Handle + quick-action icons + prompt row, used for viewport collision. */
export const ILE_LEARN_MORE_BOX_HEIGHT = 116;
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
  /** Canvas host bounding origin; Expand More is absolutely positioned inside it. */
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

/**
 * Expand More is visible only while a selection exists. Empty ids hide it
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

/** Apply a stored Expand More offset as the selection moves. */
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
    {
      ...payload,
      turnId,
      origin: loading
        ? { x: loading.x, y: loading.y }
        : payload.origin,
    },
  );
}

export function ileWorkCanvasSelectionSummary(
  elements: readonly IleWorkCanvasElement[] | null | undefined,
): string {
  const live = (elements ?? []).filter((el) => !el.isDeleted);
  if (!live.length) return "(none)";
  return live
    .map((el) => {
      if (el.type === "text" && el.text) {
        const text = String(el.text).replace(/\s+/g, " ").trim().slice(0, 280);
        return `[text] ${text}`;
      }
      return `[${el.type}] at (${Math.round(el.x)}, ${Math.round(el.y)})`;
    })
    .join("\n");
}

export type IleWorkCanvasWorkspaceInput = PromptWorkspaceContextInput;

/** Stay-on-domain line attached to seed/ask/turn prompts so XAI does not drift. */
export const ILE_WORK_CANVAS_STAY_ON_DOMAIN =
  "Stay on this workspace and focused-block domain. Do not invent unrelated topics.";

export function ileWorkCanvasWorkspaceFromChatBody(body: {
  workspaceContext?: unknown;
  workspaceTitle?: unknown;
  workspaceGoal?: unknown;
  workspaceDescription?: unknown;
  blockTitle?: unknown;
  blockDescription?: unknown;
  chapterDescription?: unknown;
  activeStepDescription?: unknown;
  problem?: unknown;
  notes?: unknown;
  focusedBlockId?: unknown;
  rootTopic?: unknown;
} | null | undefined): PromptWorkspaceContextInput {
  const rec = asRecord(body);
  const nested = asRecord(rec.workspaceContext);
  const str = (value: unknown): string | null => {
    if (typeof value !== "string") return null;
    const t = value.replace(/\s+/g, " ").trim();
    return t || null;
  };
  const pick = (key: string, fallback?: unknown): string | null =>
    str(nested[key]) || str(rec[key]) || str(fallback);
  const files = Array.isArray(nested.files)
    ? nested.files
    : Array.isArray(rec.files)
      ? rec.files
      : undefined;
  const blocks = Array.isArray(nested.blocks)
    ? nested.blocks
    : Array.isArray(rec.blocks)
      ? rec.blocks
      : undefined;
  const unusableCells = Array.isArray(nested.unusableCells)
    ? nested.unusableCells
    : Array.isArray(rec.unusableCells)
      ? rec.unusableCells
      : undefined;
  const blockLocalContext = nested.blockLocalContext ?? rec.blockLocalContext ?? undefined;
  return {
    workspaceTitle: pick("workspaceTitle", rec.problem),
    rootTopic: pick("rootTopic"),
    workspaceGoal: pick("workspaceGoal"),
    workspaceDescription: pick("workspaceDescription"),
    notes: pick("notes"),
    blockTitle: pick("blockTitle"),
    blockDescription: pick("blockDescription"),
    chapterDescription: pick("chapterDescription", rec.activeStepDescription),
    focusedBlockId: pick("focusedBlockId"),
    files: files as PromptWorkspaceContextInput["files"],
    blocks: blocks as PromptWorkspaceContextInput["blocks"],
    blockLocalContext: blockLocalContext as PromptWorkspaceContextInput["blockLocalContext"],
    unusableCells: unusableCells as PromptWorkspaceContextInput["unusableCells"],
  };
}

export function ileWorkCanvasDomainContextBlock(
  workspace?: PromptWorkspaceContextInput | PromptWorkspaceContext | null,
): string {
  if (!workspace) return "";
  const assembled =
    "contextBlock" in workspace && typeof workspace.contextBlock === "string"
      ? workspace
      : assemblePromptWorkspaceContext(workspace);
  const trimmed = String(assembled.contextBlock || "").trim();
  if (!trimmed) return "";
  if (trimmed.includes(ILE_WORK_CANVAS_STAY_ON_DOMAIN)) return trimmed;
  return `${trimmed}\n${ILE_WORK_CANVAS_STAY_ON_DOMAIN}`;
}

function ileWorkCanvasWithDomainPrefix(
  body: string,
  workspace?: PromptWorkspaceContextInput | PromptWorkspaceContext | null,
): string {
  const domain = ileWorkCanvasDomainContextBlock(workspace);
  if (!domain) return body;
  return `${domain}\n\n${body}`;
}

export function buildIleWorkCanvasAskUserMessage(input: {
  prompt: string;
  selectedElements?: readonly IleWorkCanvasElement[] | null;
  workspace?: PromptWorkspaceContextInput | PromptWorkspaceContext | null;
}): string {
  const prompt = String(input.prompt || "").trim();
  const live = (input.selectedElements ?? []).filter((el) => !el.isDeleted);
  const body = !live.length
    ? `Ask about the Work canvas.\n\nQuestion:\n${prompt}`
    : `Ask about the selected Work canvas elements.\n\nQuestion:\n${prompt}\n\nSelected elements:\n${ileWorkCanvasSelectionSummary(live)}`;
  return ileWorkCanvasWithDomainPrefix(body, input.workspace);
}

export const ILE_COMPRESS_WORK_LABEL = "Compress work";
export const ILE_COMPRESS_WORK_PROMPT =
  "Compress this Work canvas into one concise knowledge summary. Distill every mark, note, and relation into a single dense takeaway. Stay on the workspace/block domain. Do not invent unrelated topics.";

export function ileWorkCanvasLiveElements(
  scene: IleWorkCanvasScene | null | undefined,
): IleWorkCanvasElement[] {
  return serializeIleWorkCanvasScene(scene).elements.filter((el) => !el.isDeleted);
}

export function ileWorkCanvasCanCompress(
  scene: IleWorkCanvasScene | null | undefined,
): boolean {
  return ileWorkCanvasHasLiveElements(scene);
}

/** LLM user message: compress the whole board into one knowledge summary. */
export function buildIleWorkCanvasCompressUserMessage(input: {
  scene?: IleWorkCanvasScene | null;
  workspace?: PromptWorkspaceContextInput | PromptWorkspaceContext | null;
}): string {
  const live = ileWorkCanvasLiveElements(input.scene);
  const body = [
    "Compress the current Work canvas the way an expert compresses knowledge: one dense summary that preserves the essential structure, claims, and relations.",
    "The board will be replaced with that single summary. Do not add new topics.",
    "",
    "Board contents:",
    ileWorkCanvasSelectionSummary(live),
  ].join("\n");
  return ileWorkCanvasWithDomainPrefix(body, input.workspace);
}

/**
 * Replace the board with one text element — the compressed summary.
 * Empty summary leaves the current scene unchanged.
 */
export function compressIleWorkCanvasScene(
  scene: IleWorkCanvasScene | null | undefined,
  summary: unknown,
): IleWorkCanvasScene {
  const current = serializeIleWorkCanvasScene(scene);
  const text = String(summary ?? "").trim();
  if (!text) return current;
  const converted = convertToExcalidrawElements([
    {
      type: "text",
      text,
      x: TEXT_ORIGIN_X,
      y: TEXT_ORIGIN_Y,
      width: ILE_WORK_CANVAS_TEXT_BOX_WIDTH,
      autoResize: false,
      customData: {
        [ILE_COMPRESS_WORK_CUSTOM_DATA_KEY]: true,
        author: "xai",
      },
    },
  ]);
  if (!converted.length) return current;
  return {
    elements: converted,
    appState: withIleWorkCanvasGridAppState({
      ...asRecord(current.appState),
      selectedElementIds: {},
    }),
    files: {},
  };
}

function extractJsonObject(raw: string): Record<string, unknown> | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fence?.[1]?.trim() || trimmed;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    const parsed = JSON.parse(candidate.slice(start, end + 1)) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

function originFromParsedCanvasJson(parsed: Record<string, unknown>): { x: number; y: number } | null {
  return (
    ileWorkCanvasFiniteOrigin(asRecord(parsed.origin)) ??
    ileWorkCanvasFiniteOrigin(asRecord(parsed.position)) ??
    ileWorkCanvasFiniteOrigin({ x: parsed.x, y: parsed.y })
  );
}

/** Parse an XAI reply into text + optional extra canvas skeletons + suggested origin. */
export function parseIleXaiCanvasTurn(raw: string | null | undefined): IleXaiCanvasTurnPayload {
  const source = String(raw || "").trim();
  if (!source) return { text: "", elements: [] };
  const parsed = extractJsonObject(source);
  if (!parsed) return { text: source, elements: [] };
  const text =
    typeof parsed.text === "string"
      ? parsed.text
      : typeof parsed.message === "string"
        ? parsed.message
        : source;
  const elements = normalizeExtraSkeletons(parsed.elements ?? parsed.canvas_elements);
  const origin = originFromParsedCanvasJson(parsed);
  return {
    text: String(text || "").trim() || source,
    elements,
    turnId: typeof parsed.turnId === "string" ? parsed.turnId : null,
    origin,
  };
}

export function applyIleXaiReplyToWorkCanvas(
  scene: IleWorkCanvasScene | null | undefined,
  rawReply: string | null | undefined,
  extras?: IleWorkCanvasSkeleton[] | null,
): IleWorkCanvasScene {
  const parsed = parseIleXaiCanvasTurn(rawReply);
  const extra = [...(parsed.elements ?? []), ...normalizeExtraSkeletons(extras)];
  return applyIleXaiTurnToWorkCanvas(scene, { ...parsed, elements: extra });
}

export function writeIleChapterWorkCanvas(
  store: {
    write: (chapterId: string | null | undefined, update: { whiteboardSceneData: IleWorkCanvasScene }) => unknown;
  },
  chapterId: string,
  scene: IleWorkCanvasScene | null | undefined,
): void {
  store.write(chapterId, { whiteboardSceneData: serializeIleWorkCanvasScene(scene) });
}

export function readIleChapterWorkCanvas(
  store: {
    read: (chapterId?: string | null) => { whiteboardSceneData?: IleWorkCanvasScene | null };
  },
  chapterId: string,
): IleWorkCanvasScene {
  return serializeIleWorkCanvasScene(store.read(chapterId).whiteboardSceneData);
}

/** Restore a stored scene after the chapter is no longer the live focus (chapter done). */
export function restoreIleChapterWorkCanvas(
  live: Record<string, { whiteboardSceneData?: IleWorkCanvasScene | null } | undefined>,
  cold: Record<string, { whiteboardSceneData?: IleWorkCanvasScene | null } | undefined>,
  chapterId: string,
): IleWorkCanvasScene {
  const focused = readIleFocusedChapterWorkspace(
    live as Parameters<typeof readIleFocusedChapterWorkspace>[0],
    cold as Parameters<typeof readIleFocusedChapterWorkspace>[1],
    chapterId,
  );
  return serializeIleWorkCanvasScene(ileChapterCanvasInitialScene(focused));
}

export function createIleWorkCanvasChapterStore() {
  return createIleSessionContextStore();
}

export type IleWorkCanvasSceneByChapter = Record<
  string,
  IleWorkCanvasScene | null | undefined
>;

export type IleWorkCanvasTurnScenePickInput = {
  targetChapterId: string | null | undefined;
  focusedChapterId: string | null | undefined;
  liveSceneByChapter?: IleWorkCanvasSceneByChapter | null;
  coldSceneByChapter?: IleWorkCanvasSceneByChapter | null;
  focusedSceneRef?: { current: IleWorkCanvasScene | null | undefined } | null;
};

export type IleWorkCanvasTurnScenePick = {
  chapterId: string;
  sceneToSend: IleWorkCanvasScene;
  applyLive: boolean;
};

function sceneAt(
  map: IleWorkCanvasSceneByChapter | null | undefined,
  chapterId: string,
): IleWorkCanvasScene | null | undefined {
  if (!map) return null;
  if (Object.prototype.hasOwnProperty.call(map, chapterId)) return map[chapterId];
  return undefined;
}

/**
 * Pick the board for one session-chat turn. Never substitutes another
 * chapter's scene (including the focused ref) when the target is unfocused.
 * `applyLive` is true only when the target is the focused chapter.
 */
export function pickIleWorkCanvasTurnScene(
  input: IleWorkCanvasTurnScenePickInput,
): IleWorkCanvasTurnScenePick {
  const chapterId = resolveIleChapterContextKey(input.targetChapterId);
  const focusedId = resolveIleChapterContextKey(input.focusedChapterId);
  const applyLive = chapterId === focusedId;
  const live = sceneAt(input.liveSceneByChapter, chapterId);
  const cold = sceneAt(input.coldSceneByChapter, chapterId);
  let raw: IleWorkCanvasScene | null | undefined;
  if (applyLive) {
    raw = input.focusedSceneRef?.current ?? live ?? cold;
  } else {
    raw = live ?? cold;
  }
  return {
    chapterId,
    applyLive,
    sceneToSend: serializeIleWorkCanvasScene(raw),
  };
}

export function ileWorkCanvasScenesFromWorkspaces(
  map:
    | Record<string, { whiteboardSceneData?: IleWorkCanvasScene | null } | undefined>
    | null
    | undefined,
): IleWorkCanvasSceneByChapter {
  const out: IleWorkCanvasSceneByChapter = {};
  if (!map) return out;
  for (const [id, row] of Object.entries(map)) {
    out[id] = row?.whiteboardSceneData ?? null;
  }
  return out;
}

function normalizeExcalidrawToolName(value: string | null | undefined): string {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/^tool_/, "")
    .replace(/\s+/g, "_");
}

const ELEMENT_TYPE_TO_CANVAS_ACTION: Record<string, string> = {
  text: "draw_text",
  freedraw: "draw_freedraw",
  rectangle: "draw_rectangle",
  diamond: "draw_diamond",
  ellipse: "draw_ellipse",
  arrow: "draw_arrow",
  line: "draw_line",
  image: "draw_image",
  frame: "draw_frame",
  eraser: "erase",
};

const CANVAS_POW_ACTIONS = new Set([
  "draw_text",
  "draw_freedraw",
  "draw_rectangle",
  "draw_diamond",
  "draw_ellipse",
  "draw_arrow",
  "draw_line",
  "draw_image",
  "draw_frame",
  "erase",
  "delete",
  "move",
  "rotate",
  "multi_select",
  "expand_more",
  "board_prompt",
  "compress_work",
]);

/**
 * Map Excalidraw's internal active tool / element kind onto shared canvas PoW
 * `tool_name` / `tool_action` (`canvas` + draw_text / move / …). Never emits
 * retired ILE tools. Selecting the selection tool is not work.
 */
export function mapExcalidrawToolToIlePow(input: {
  activeTool?: string | null;
  elementType?: string | null;
  action?: string | null;
}): { toolName: "canvas"; toolAction: string } | null {
  const toolRaw = normalizeExcalidrawToolName(input.activeTool);
  const elementRaw = normalizeExcalidrawToolName(input.elementType);
  const actionRaw = normalizeExcalidrawToolName(input.action);
  if (
    RETIRED_ILE_WORK_TOOLS.has(toolRaw) ||
    RETIRED_ILE_WORK_TOOLS.has(elementRaw) ||
    RETIRED_ILE_WORK_TOOLS.has(actionRaw)
  ) {
    return null;
  }
  if (actionRaw && CANVAS_POW_ACTIONS.has(actionRaw)) {
    return { toolName: "canvas", toolAction: actionRaw };
  }
  const mapped = ELEMENT_TYPE_TO_CANVAS_ACTION[toolRaw] ?? ELEMENT_TYPE_TO_CANVAS_ACTION[elementRaw];
  if (!mapped) return null;
  return { toolName: "canvas", toolAction: mapped };
}

export function isRetiredIleWorkToolName(name: string | null | undefined): boolean {
  return RETIRED_ILE_WORK_TOOLS.has(normalizeExcalidrawToolName(name));
}

export function ileWorkCanvasSceneForTurn(
  scene: IleWorkCanvasScene | null | undefined,
): IleWorkCanvasScene {
  return serializeIleWorkCanvasScene(scene);
}

/** Instruct XAI to suggest a scene origin alongside the restorable board. */
export const ILE_WORK_CANVAS_TURN_ORIGIN_INSTRUCTION =
  'Suggest a scene origin for that reply as JSON "origin": {"x": number, "y": number} so it lands in empty space near related marks.';

/** User-message payload: the focused chapter's full restorable board. */
export function ileWorkCanvasTurnContextMessage(
  scene: IleWorkCanvasScene | null | undefined,
  input?: {
    boardLabel?: string;
    workspace?: PromptWorkspaceContextInput | PromptWorkspaceContext | null;
  },
): string {
  const restorable = serializeIleWorkCanvasScene(scene);
  const board = String(input?.boardLabel || "CHAPTER").trim() || "CHAPTER";
  const body = `CURRENT ${board} WORK CANVAS (full restorable Excalidraw scene JSON; collaborators stripped). Co-author this board: your reply is placed on it as a text block the learner can move and edit. ${ILE_WORK_CANVAS_TURN_ORIGIN_INSTRUCTION} ${ileWorkCanvasXaiToolsInstruction()}\n${JSON.stringify(restorable)}`;
  return ileWorkCanvasWithDomainPrefix(body, input?.workspace);
}

export const ILE_WORK_CANVAS_QUICK_ACTION_REPHRASE = "rephrase" as const;
export const ILE_WORK_CANVAS_QUICK_ACTION_SPLIT = "split" as const;
export const ILE_WORK_CANVAS_QUICK_ACTION_ELABORATE = "elaborate more pls" as const;

export type IleWorkCanvasQuickActionId =
  | typeof ILE_WORK_CANVAS_QUICK_ACTION_REPHRASE
  | typeof ILE_WORK_CANVAS_QUICK_ACTION_SPLIT
  | typeof ILE_WORK_CANVAS_QUICK_ACTION_ELABORATE;

/** Canned Expand More intents. Rephrase / elaborate go through the ask path. */
export function ileWorkCanvasQuickActionPrompt(
  action: typeof ILE_WORK_CANVAS_QUICK_ACTION_REPHRASE | typeof ILE_WORK_CANVAS_QUICK_ACTION_ELABORATE,
): string {
  if (action === ILE_WORK_CANVAS_QUICK_ACTION_REPHRASE) {
    return "Rephrase this selection. Keep the same meaning, stay on the workspace/block domain, and do not invent unrelated topics.";
  }
  return "Elaborate more pls. Expand this selection with more concrete detail, stay on the workspace/block domain, and do not invent unrelated topics.";
}

function groupIleWorkCanvasSplitParts(parts: string[], joiner: string): string[] {
  if (parts.length <= 3) return parts;
  const groups: string[][] = [[], [], []];
  parts.forEach((part, index) => {
    groups[Math.min(2, Math.floor((index * 3) / parts.length))].push(part);
  });
  return groups.map((group) => group.join(joiner)).filter((chunk) => chunk.trim());
}

/** Split source text into 2 or 3 chunks. Empty / single-token text cannot split. */
export function ileWorkCanvasSplitTextChunks(text: string | null | undefined): string[] {
  const original = String(text || "").replace(/\r\n/g, "\n").trim();
  if (!original) return [];
  const paragraphs = original.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  if (paragraphs.length >= 2) return groupIleWorkCanvasSplitParts(paragraphs, "\n\n");
  const lines = original.split("\n").map((line) => line.trim()).filter(Boolean);
  if (lines.length >= 2) return groupIleWorkCanvasSplitParts(lines, "\n");
  const sentences = original.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean);
  if (sentences.length >= 2) return groupIleWorkCanvasSplitParts(sentences, " ");
  const words = original.split(/\s+/).filter(Boolean);
  if (words.length < 2) return [];
  const n = words.length >= 9 ? 3 : 2;
  const groups: string[][] = Array.from({ length: n }, () => []);
  words.forEach((word, index) => {
    groups[Math.min(n - 1, Math.floor((index * n) / words.length))].push(word);
  });
  return groups.map((group) => group.join(" ")).filter(Boolean);
}

/**
 * Replace one text element with 2 or 3 live text blocks. Non-text is a no-op.
 * Concatenated chunks preserve the source modulo whitespace.
 */
export function splitIleWorkCanvasTextElement(
  scene: IleWorkCanvasScene | null | undefined,
  element: Pick<IleWorkCanvasElement, "id" | "type" | "text" | "originalText" | "x" | "y" | "width" | "height" | "isDeleted"> | null | undefined,
): { scene: IleWorkCanvasScene; split: boolean; parts: IleWorkCanvasElement[] } {
  const current = serializeIleWorkCanvasScene(scene);
  if (!element || element.isDeleted || element.type !== "text") {
    return { scene: current, split: false, parts: [] };
  }
  const source = String(element.originalText || element.text || "");
  const chunks = ileWorkCanvasSplitTextChunks(source);
  if (chunks.length < 2) return { scene: current, split: false, parts: [] };
  const boxWidth = Number(element.width) > 0 ? Number(element.width) : ILE_WORK_CANVAS_TEXT_BOX_WIDTH;
  const skeletons: IleWorkCanvasSkeleton[] = [];
  let y = Number(element.y) || 0;
  const x = Number(element.x) || 0;
  for (const chunk of chunks) {
    const wrapped = wrapIleWorkCanvasText(chunk, boxWidth);
    skeletons.push({
      type: "text",
      text: chunk,
      x,
      y,
      width: wrapped.width,
      autoResize: false,
    });
    y += wrapped.height + 16;
  }
  const parts = convertToExcalidrawElements(skeletons);
  if (parts.length < 2) return { scene: current, split: false, parts: [] };
  return {
    scene: {
      ...current,
      elements: [...current.elements.filter((el) => el.id !== element.id), ...parts],
    },
    split: true,
    parts,
  };
}

export function splitIleWorkCanvasSelectedText(
  scene: IleWorkCanvasScene | null | undefined,
  selectedElements: readonly IleWorkCanvasElement[] | null | undefined,
): { scene: IleWorkCanvasScene; split: boolean; parts: IleWorkCanvasElement[] } {
  const current = serializeIleWorkCanvasScene(scene);
  const target = (selectedElements ?? []).find(
    (el) => el && !el.isDeleted && el.type === "text" && String(el.originalText || el.text || "").trim(),
  );
  if (!target) return { scene: current, split: false, parts: [] };
  const live = current.elements.find((el) => el.id === target.id) ?? target;
  return splitIleWorkCanvasTextElement(current, live);
}
