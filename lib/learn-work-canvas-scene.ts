/**
 * TAP Learning Work canvas scene: types, serialize, seed, chapter store, timer-reset seed.
 * Pure over scene JSON so tests can drive it without mounting Excalidraw.
 *
 * Element conversion follows Excalidraw's skeleton API
 * (`convertToExcalidrawElements`): skeletons in, real scene elements out.
 */
import {
  createIleSessionContextStore,
  ILE_SESSION_GLOBAL_CONTEXT_KEY,
  ileChapterCanvasInitialScene,
  readIleFocusedChapterWorkspace,
  resolveIleChapterContextKey,
} from "@/lib/learn-session-global-context";
import {
  ILE_XAI_CANVAS_SHAPE_TYPES,
  type IleXaiCanvasShapeType,
} from "@/lib/learn-work-canvas-prompts";

export const ILE_XAI_CANVAS_CUSTOM_DATA_KEY = "ileXaiTurn" as const;
export const ILE_XAI_LOADING_CUSTOM_DATA_KEY = "ileXaiLoading" as const;
export const ILE_XAI_NOTE_CUSTOM_DATA_KEY = "ileXaiNote" as const;
export const ILE_CHAPTER_SEED_CUSTOM_DATA_KEY = "ileChapterSeed" as const;
export const ILE_COMPRESS_WORK_CUSTOM_DATA_KEY = "ileCompressWork" as const;
export const ILE_XAI_LOADING_TEXT = "Thinking ...";

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

/** XAI may choose the coaching text box. Outside this range we clamp. */
export const ILE_XAI_TEXT_BOX_MIN_WIDTH = 96;
export const ILE_XAI_TEXT_BOX_MAX_WIDTH = 640;

export type IleXaiCanvasTurnPayload = {
  text?: string | null;
  /** Width of the coaching text box, when XAI sets one. */
  textWidth?: number | null;
  elements?: IleWorkCanvasSkeleton[] | null;
  turnId?: string | null;
  origin?: { x?: number; y?: number } | null;
};

/** Finite text-box width from an XAI reply. Missing or invalid → null (default box). */
export function ileWorkCanvasXaiTextWidth(raw: unknown): number | null {
  if (raw == null || raw === "") return null;
  const width = Number(raw);
  if (!Number.isFinite(width) || width <= 0) return null;
  return Math.min(
    ILE_XAI_TEXT_BOX_MAX_WIDTH,
    Math.max(ILE_XAI_TEXT_BOX_MIN_WIDTH, Math.round(width)),
  );
}

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

export const DEFAULT_FONT_SIZE = 20;
export const DEFAULT_LINE_HEIGHT = 1.25;
export const DEFAULT_DIMENSION = 100;
export const TEXT_GAP_Y = 48;
export const TEXT_ORIGIN_X = 80;
export const TEXT_ORIGIN_Y = 80;
/** Wide column so chapter seed and replies stay readable on the board. */
export const ILE_WORK_CANVAS_TEXT_BOX_WIDTH = 520;

let skeletonSeq = 0;

export function nextElementId(prefix = "ile"): string {
  skeletonSeq += 1;
  return `${prefix}${Date.now().toString(36)}${skeletonSeq.toString(36)}`;
}

export function asRecord(value: unknown): Record<string, unknown> {
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

/** Grid on and zen mode on, unless this scene already stored a choice. */
export const ILE_AUTO_LAYOUT_APP_STATE_KEY = "ileAutoLayoutEnabled";

export function withIleWorkCanvasGridAppState(
  appState: IleWorkCanvasAppState | null | undefined,
): IleWorkCanvasAppState {
  const next = asRecord(appState);
  if (typeof next.gridModeEnabled !== "boolean") next.gridModeEnabled = true;
  if (typeof next.zenModeEnabled !== "boolean") next.zenModeEnabled = true;
  if (typeof next[ILE_AUTO_LAYOUT_APP_STATE_KEY] !== "boolean") {
    next[ILE_AUTO_LAYOUT_APP_STATE_KEY] = false;
  }
  if (typeof next.gridSize !== "number" || next.gridSize <= 0) {
    next.gridSize = ILE_WORK_CANVAS_DEFAULT_GRID_SIZE;
  }
  if (typeof next.currentItemStrokeColor !== "string" || !String(next.currentItemStrokeColor).trim()) {
    next.currentItemStrokeColor = ILE_WORK_CANVAS_STROKE_COLOR;
  }
  next.currentItemFontFamily = ILE_WORK_CANVAS_FONT_FAMILY;
  if (!ileWorkCanvasStoredToolType(next.activeTool)) {
    next.activeTool = { type: "text" };
  }
  return next;
}

function ileWorkCanvasStoredToolType(activeTool: unknown): string {
  if (typeof activeTool === "string") return activeTool.trim();
  if (activeTool && typeof activeTool === "object" && !Array.isArray(activeTool)) {
    const type = (activeTool as { type?: unknown }).type;
    if (typeof type === "string") return type.trim();
  }
  return "";
}

export function emptyIleWorkCanvasScene(): IleWorkCanvasScene {
  return { elements: [], appState: withIleWorkCanvasGridAppState({}), files: {} };
}

/**
 * Timer hit zero: clear learner work, then re-seed the original chapter
 * prompt as a single text element. Insights stay off-canvas.
 */
export const ILE_WORK_CANVAS_DEFAULT_APP_STATE_KEYS = [
  "gridModeEnabled",
  "zenModeEnabled",
  ILE_AUTO_LAYOUT_APP_STATE_KEY,
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
  const charW = Math.max(6, fontSize * 0.55);
  const longest = wrapped.text.split("\n").reduce((max, line) => Math.max(max, line.length), 0);
  const contentWidth = Math.max(96, Math.ceil(longest * charW));
  void lineHeight;
  return {
    width: Math.min(wrapped.width, contentWidth),
    height: wrapped.height,
  };
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
      const isNote = Boolean(el.customData?.[ILE_XAI_NOTE_CUSTOM_DATA_KEY]);
      const padX = isNote ? ILE_XAI_NOTE_PAD_X : 8;
      const padY = isNote ? ILE_XAI_NOTE_PAD_Y : 8;
      const innerWidth = Math.max(40, Number(el.width) - padX * 2);
      const wrapped = isNote ? wrapIleWorkCanvasText(labelText, innerWidth, fontSize) : null;
      const metrics = wrapped ?? measureText(labelText, fontSize, DEFAULT_LINE_HEIGHT);
      const label = baseElement(
        "text",
        {
          type: "text",
          text: labelText,
          x: el.x + padX,
          y: el.y + padY,
        },
        opts,
      );
      label.width = metrics.width;
      label.height = metrics.height;
      label.text = wrapped ? wrapped.text : labelText;
      label.originalText = labelText;
      label.fontSize = fontSize;
      label.fontFamily = ILE_WORK_CANVAS_FONT_FAMILY;
      label.containerId = el.id;
      label.autoResize = !isNote;
      label.lineHeight = DEFAULT_LINE_HEIGHT;
      label.customData = el.customData ?? null;
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

export const ILE_XAI_NOTE_PAD_X = 16;
export const ILE_XAI_NOTE_PAD_Y = 12;

export function ileWorkCanvasContentBounds(
  elements: readonly (Pick<IleWorkCanvasElement, "x" | "y" | "width" | "height"> & {
    isDeleted?: boolean;
  })[],
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

export function nextXaiTextOrigin(elements: readonly IleWorkCanvasElement[]): { x: number; y: number } {
  const bounds = ileWorkCanvasContentBounds(elements);
  if (!bounds) return { x: TEXT_ORIGIN_X, y: TEXT_ORIGIN_Y };
  return { x: bounds.minX, y: bounds.maxY + TEXT_GAP_Y };
}

export function normalizeExtraSkeletons(raw: unknown): IleWorkCanvasSkeleton[] {
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

export const BOARD_INSTRUCTION_NOTE_KEY = "boardInstructionNote" as const;
export const BOARD_INSTRUCTION_NOTE_LABEL = "Work";
/**
 * Stored light so the dark-canvas invert paints a dark card.
 * Ink stays the shared near-black stroke, which inverts to a light edge and type.
 */
export const BOARD_INSTRUCTION_NOTE_BODY_FILL = "#f4f4f5";
export const BOARD_INSTRUCTION_NOTE_HEADER_FILL = "#ffffff";
const BOARD_NOTE_HEADER_HEIGHT = 32;
const BOARD_NOTE_PAD_X = 14;
const BOARD_NOTE_PAD_Y = 12;
const BOARD_NOTE_HEADER_FONT = 14;

/**
 * Instruction on the board is a work card: a filled card, a Work header, and the words.
 * Not a transparent rectangle with text bound inside it.
 * Body copy is not bound to the full card. Binding it there makes Excalidraw
 * pin the note to the top of the card, on top of Work.
 */
export function boardInstructionNoteElements(input: {
  text: string;
  x: number;
  y: number;
  textWidth: number;
  fontSize?: number;
  textCustomData?: Record<string, unknown> | null;
  bodyCustomData?: Record<string, unknown> | null;
  headerCustomData?: Record<string, unknown> | null;
  locked?: boolean;
  textId?: string;
}): { elements: IleWorkCanvasElement[]; width: number; height: number } {
  const text = String(input.text || "").trim();
  if (!text) return { elements: [], width: 0, height: 0 };
  const fontSize = Number(input.fontSize) || DEFAULT_FONT_SIZE;
  const textWidth = Math.max(96, Number(input.textWidth) || ILE_WORK_CANVAS_TEXT_BOX_WIDTH);
  const wrapped = wrapIleWorkCanvasText(text, textWidth, fontSize);
  const width = wrapped.width + BOARD_NOTE_PAD_X * 2;
  const height = BOARD_NOTE_HEADER_HEIGHT + BOARD_NOTE_PAD_Y + wrapped.height + BOARD_NOTE_PAD_Y;
  const locked = input.locked === true;
  const x = input.x;
  const y = input.y;
  const kind = (
    data: Record<string, unknown> | null | undefined,
    part: "body" | "header" | "text" | "label",
  ) => ({
    ...(data ?? {}),
    [BOARD_INSTRUCTION_NOTE_KEY]: part,
  });
  const headerSource = input.headerCustomData ?? input.bodyCustomData;
  const groupId = nextElementId("grp");
  const converted = convertToExcalidrawElements(
    [
      {
        type: "rectangle",
        x,
        y,
        width,
        height,
        strokeColor: ILE_WORK_CANVAS_STROKE_COLOR,
        backgroundColor: BOARD_INSTRUCTION_NOTE_BODY_FILL,
        fillStyle: "solid",
        strokeWidth: 2,
        roughness: 0,
        locked,
        groupIds: [groupId],
        customData: kind(input.bodyCustomData, "body"),
      },
      {
        type: "rectangle",
        x,
        y,
        width,
        height: BOARD_NOTE_HEADER_HEIGHT,
        strokeColor: ILE_WORK_CANVAS_STROKE_COLOR,
        backgroundColor: BOARD_INSTRUCTION_NOTE_HEADER_FILL,
        fillStyle: "solid",
        strokeWidth: 1,
        roughness: 0,
        locked,
        groupIds: [groupId],
        customData: kind(headerSource, "header"),
      },
      {
        type: "text",
        id: input.textId,
        text,
        x: x + BOARD_NOTE_PAD_X,
        y: y + BOARD_NOTE_HEADER_HEIGHT + BOARD_NOTE_PAD_Y,
        width: wrapped.width,
        fontSize,
        textAlign: "left",
        verticalAlign: "top",
        strokeColor: ILE_WORK_CANVAS_STROKE_COLOR,
        autoResize: false,
        locked,
        groupIds: [groupId],
        customData: kind(input.textCustomData ?? input.bodyCustomData, "text"),
      },
      {
        type: "text",
        text: BOARD_INSTRUCTION_NOTE_LABEL,
        x: x + BOARD_NOTE_PAD_X,
        y: y + 8,
        width: wrapped.width,
        fontSize: BOARD_NOTE_HEADER_FONT,
        textAlign: "left",
        verticalAlign: "middle",
        strokeColor: ILE_WORK_CANVAS_STROKE_COLOR,
        autoResize: false,
        locked,
        groupIds: [groupId],
        customData: kind(headerSource, "label"),
      },
    ],
    { regenerateIds: !input.textId },
  );
  const body = converted.find((el) => el.customData?.[BOARD_INSTRUCTION_NOTE_KEY] === "body");
  const header = converted.find((el) => el.customData?.[BOARD_INSTRUCTION_NOTE_KEY] === "header");
  const bodyText = converted.find((el) => el.customData?.[BOARD_INSTRUCTION_NOTE_KEY] === "text");
  const label = converted.find((el) => el.customData?.[BOARD_INSTRUCTION_NOTE_KEY] === "label");
  if (bodyText) {
    bodyText.containerId = null;
    bodyText.verticalAlign = "top";
    bodyText.textAlign = "left";
  }
  if (body) body.boundElements = null;
  if (header && label) {
    label.containerId = header.id;
    label.verticalAlign = "middle";
    label.textAlign = "left";
    header.boundElements = [{ type: "text", id: label.id }];
  }
  return { elements: converted, width, height };
}

/**
 * First open of a chapter board: place the chapter prompt as a note.
 * No-op when the board already has work.
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
  const chapterId = resolveIleChapterContextKey(input.chapterId);
  const note = boardInstructionNoteElements({
    text,
    x: origin.x,
    y: origin.y,
    textWidth: ILE_WORK_CANVAS_TEXT_BOX_WIDTH,
    textCustomData: {
      [ILE_CHAPTER_SEED_CUSTOM_DATA_KEY]: true,
      chapterId,
      author: "chapter",
    },
    bodyCustomData: {
      chapterId,
      author: "chapter",
    },
  });
  if (!note.elements.length) return { scene: current, seeded: false };
  return {
    scene: {
      elements: [...current.elements, ...note.elements],
      appState: current.appState,
      files: current.files,
    },
    seeded: true,
  };
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
 * Pick the one live board. A second chapter id does not select another scene.
 * The reply always applies to that board.
 */
export function pickIleWorkCanvasTurnScene(
  input: IleWorkCanvasTurnScenePickInput,
): IleWorkCanvasTurnScenePick {
  const focusedId = resolveIleChapterContextKey(input.focusedChapterId);
  const sessionScene =
    sceneAt(input.liveSceneByChapter, ILE_SESSION_GLOBAL_CONTEXT_KEY) ??
    sceneAt(input.coldSceneByChapter, ILE_SESSION_GLOBAL_CONTEXT_KEY);
  const raw =
    input.focusedSceneRef?.current ??
    sceneAt(input.liveSceneByChapter, focusedId) ??
    sceneAt(input.coldSceneByChapter, focusedId) ??
    sessionScene;
  return {
    chapterId: focusedId,
    applyLive: true,
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

export function ileWorkCanvasSceneForTurn(
  scene: IleWorkCanvasScene | null | undefined,
): IleWorkCanvasScene {
  return serializeIleWorkCanvasScene(scene);
}

/** Live (non-deleted) elements whose ids are in the selection list. */
export function ileWorkCanvasSelectedLive(
  scene: IleWorkCanvasScene,
  selected: readonly { id?: string | null; isDeleted?: boolean }[] | null | undefined,
): IleWorkCanvasElement[] {
  const ids = new Set<string>();
  for (const el of selected ?? []) {
    if (!el || el.isDeleted) continue;
    const id = String(el.id || "").trim();
    if (id) ids.add(id);
  }
  if (!ids.size) return [];
  return scene.elements.filter((el) => ids.has(el.id) && !el.isDeleted);
}
