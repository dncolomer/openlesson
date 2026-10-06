/**
 * TAP Learning Work canvas: per-chapter Excalidraw scene serialize / apply / PoW.
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
} from "@/lib/ile-session-global-context";
import {
  type PromptWorkspaceContext,
  type PromptWorkspaceContextInput,
} from "@/lib/prompt-workspace-context";

import {
  ILE_XAI_CANVAS_SHAPE_TYPES,
  buildIleWorkCanvasClearOverlapsUserMessage,
  ileWorkCanvasSelectionSummary,
  ileWorkCanvasWithDomainPrefix,
  ileWorkCanvasXaiToolsInstruction,
  type IleXaiCanvasShapeType,
} from "@/lib/ile-work-canvas-prompts";
import {
  ileWorkCanvasNormalizedRect,
  ileWorkCanvasPositiveAreaOverlap,
  ileWorkCanvasRectsOverlap,
} from "@/lib/ile-work-canvas-geometry";
import { ILE_WORK_CANVAS_OVERLAP_GAP } from "@/lib/ile-work-canvas-commands";

export {
  ILE_CANVAS_TIMER_RESET_LOADING_MS,
  ILE_CANVAS_TIMER_SECONDS_CEILING,
  ILE_CANVAS_TIMER_SECONDS_DEFAULT,
  ILE_CANVAS_TIMER_SECONDS_MIN,
  ILE_CANVAS_TIMER_SECONDS_STEP,
  clampIleCanvasTimerSeconds,
  formatIleWorkCanvasTimer,
  ileWorkCanvasTimerExpired,
  ileWorkCanvasTimerRemainingSeconds,
} from "@/lib/ile-work-canvas-timer";
export { ileWorkCanvasElementRect } from "@/lib/ile-work-canvas-geometry";
export {
  ileWorkCanvasNormalizedRect,
  ileWorkCanvasPositiveAreaOverlap,
  ileWorkCanvasRectsOverlap,
};
export {
  ILE_SELECTIVE_COMPRESSION_LABEL,
  ILE_WORK_CANVAS_COMMANDS,
  filterIleWorkCanvasCommands,
  ileCanvasCommandDraft,
  ileWorkCanvasCommandNeedsSelection,
} from "@/lib/ile-work-canvas-commands";
export { ILE_WORK_CANVAS_OVERLAP_GAP };
export type { IleWorkCanvasAskKind, IleWorkCanvasCommandId } from "@/lib/ile-work-canvas-commands";
export {
  ILE_COMPRESS_WORK_PROMPT,
  ILE_EXCALIDRAW_POW_TOOLS,
  ILE_WORK_CANVAS_STAY_ON_DOMAIN,
  ILE_XAI_CANVAS_SHAPE_TYPES,
  buildIleWorkCanvasAnswerUserMessage,
  buildIleWorkCanvasAskUserMessage,
  buildIleWorkCanvasClearOverlapsUserMessage,
  buildIleWorkCanvasCommandUserMessage,
  buildIleWorkCanvasRefactorUserMessage,
  buildIleWorkCanvasSelectiveCompressUserMessage,
  buildIleWorkCanvasSimplifyUserMessage,
  buildIleWorkCanvasSuggestInsightUserMessage,
  ileWorkCanvasDomainContextBlock,
  ileWorkCanvasSelectionSummary,
  ileWorkCanvasWorkspaceFromChatBody,
  ileWorkCanvasXaiToolsInstruction,
} from "@/lib/ile-work-canvas-prompts";
export type {
  IleExcalidrawPowTool,
  IleWorkCanvasWorkspaceInput,
  IleXaiCanvasShapeType,
} from "@/lib/ile-work-canvas-prompts";

export const ILE_XAI_CANVAS_CUSTOM_DATA_KEY = "ileXaiTurn" as const;
export const ILE_XAI_LOADING_CUSTOM_DATA_KEY = "ileXaiLoading" as const;
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

const DEFAULT_FONT_SIZE = 20;
const DEFAULT_LINE_HEIGHT = 1.25;
const DEFAULT_DIMENSION = 100;
const TEXT_GAP_Y = 48;
const TEXT_ORIGIN_X = 80;
const TEXT_ORIGIN_Y = 80;
/** Wide column so chapter seed and replies stay readable on the board. */
export const ILE_WORK_CANVAS_TEXT_BOX_WIDTH = 520;

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

/** Grid off and zen mode on, unless this scene already stored a choice. */
export function withIleWorkCanvasGridAppState(
  appState: IleWorkCanvasAppState | null | undefined,
): IleWorkCanvasAppState {
  const next = asRecord(appState);
  if (typeof next.gridModeEnabled !== "boolean") next.gridModeEnabled = false;
  if (typeof next.zenModeEnabled !== "boolean") next.zenModeEnabled = true;
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
  let text = String(payload.text || "").trim();
  let extra = normalizeExtraSkeletons(payload.elements);
  let originInput = payload.origin;
  if (ileXaiReplyIsCanvasJson(text)) {
    const parsed = parseIleXaiCanvasTurn(text);
    text = String(parsed.text || "").trim();
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
      const chosen = ileWorkCanvasXaiTextWidth(payload.textWidth);
      const wrapped = wrapIleWorkCanvasText(text, chosen ?? undefined);
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
  return {
    elements: [...current.elements, ...incoming],
    appState: current.appState,
    files: current.files,
  };
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
 * Fixed thinking plate. It matches the text column so the reply can replace
 * it in place. Rotating copy cannot resize it.
 */
export const ILE_XAI_REPLY_RESERVE_HEIGHT = 160;
/** Legacy square used by placement fixtures. Live replies reserve the text column. */
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
    width: ILE_WORK_CANVAS_TEXT_BOX_WIDTH,
    height: ILE_XAI_REPLY_RESERVE_HEIGHT,
    minWidth: ILE_WORK_CANVAS_TEXT_BOX_WIDTH,
    minHeight: ILE_XAI_REPLY_RESERVE_HEIGHT,
    maxWidth: ILE_WORK_CANVAS_TEXT_BOX_WIDTH,
    maxHeight: ILE_XAI_REPLY_RESERVE_HEIGHT,
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


export const ILE_COMPRESS_WORK_LABEL = "Compress work";
export const ILE_COMPRESS_WORK_LOADING_LABEL = "Compressing work";

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

const ILE_XAI_REPLY_TEXT_KEYS = [
  "text",
  "message",
  "reply",
  "content",
  "coaching",
  "answer",
  "response",
] as const;

/** True when a reply is a canvas JSON payload rather than a sentence for the learner. */
export function ileXaiReplyIsCanvasJson(raw: string | null | undefined): boolean {
  const trimmed = String(raw || "").trim();
  if (!trimmed) return false;
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) return true;
  if (/```(?:json)?/i.test(trimmed) && trimmed.includes("{")) return true;
  return /"elements"\s*:/.test(trimmed) && /"(?:text|origin|type)"\s*:/.test(trimmed);
}

function repairLooseJson(source: string): string {
  return source.replace(/[\u201c\u201d]/g, '"').replace(/,\s*([}\]])/g, "$1");
}

function tryParseJsonObject(candidate: string): Record<string, unknown> | null {
  for (const attempt of [candidate, repairLooseJson(candidate)]) {
    try {
      const parsed = JSON.parse(attempt) as unknown;
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) continue;
      return parsed as Record<string, unknown>;
    } catch {
      /* try the repaired candidate */
    }
  }
  return null;
}

function extractJsonObject(raw: string): Record<string, unknown> | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fence?.[1]?.trim() || trimmed;
  const direct = tryParseJsonObject(candidate);
  if (direct) return direct;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  return tryParseJsonObject(candidate.slice(start, end + 1));
}

function looksLikeJsonBlob(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (
    (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
    (trimmed.startsWith("[") && trimmed.endsWith("]"))
  ) {
    return true;
  }
  return /```(?:json)?/i.test(trimmed);
}

function proseOutsideJson(raw: string): string {
  let text = raw.replace(/```(?:json)?\s*[\s\S]*?```/gi, " ");
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start >= 0 && end > start) {
    text = `${text.slice(0, start)} ${text.slice(end + 1)}`;
  }
  return text.replace(/\s+/g, " ").trim();
}

function salvageQuotedTextField(raw: string): string {
  const match = raw.match(
    /"(?:text|message|reply|content|coaching|answer|response)"\s*:\s*"((?:\\.|[^"\\])*)"/,
  );
  if (!match?.[1]) return "";
  try {
    return String(JSON.parse(`"${match[1]}"`) || "").trim();
  } catch {
    return match[1].replace(/\\n/g, "\n").replace(/\\"/g, '"').trim();
  }
}

function textFromParsedCanvasJson(parsed: Record<string, unknown>, depth = 0): string {
  if (depth > 2) return "";
  for (const key of ILE_XAI_REPLY_TEXT_KEYS) {
    const value = parsed[key];
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (!trimmed || looksLikeJsonBlob(trimmed)) {
        if (!trimmed) continue;
        const inner = extractJsonObject(trimmed);
        const nested = inner ? textFromParsedCanvasJson(inner, depth + 1) : "";
        if (nested) return nested;
        const prose = proseOutsideJson(trimmed);
        if (prose && !looksLikeJsonBlob(prose)) return prose;
        continue;
      }
      return trimmed;
    }
    if (value && typeof value === "object" && !Array.isArray(value)) {
      const nested = textFromParsedCanvasJson(value as Record<string, unknown>, depth + 1);
      if (nested) return nested;
    }
  }
  return "";
}

function visibleTextFromXaiReply(source: string, parsed: Record<string, unknown> | null): string {
  const fromJson = parsed ? textFromParsedCanvasJson(parsed) : salvageQuotedTextField(source);
  if (fromJson && !looksLikeJsonBlob(fromJson)) return fromJson;
  if (!ileXaiReplyIsCanvasJson(source)) return source;
  const prose = proseOutsideJson(source);
  if (prose && !looksLikeJsonBlob(prose)) return prose;
  return "";
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
  const text = visibleTextFromXaiReply(source, parsed);
  if (!parsed) return { text, elements: [] };
  const elements = normalizeExtraSkeletons(parsed.elements ?? parsed.canvas_elements);
  const origin = originFromParsedCanvasJson(parsed);
  const textWidth = ileWorkCanvasXaiTextWidth(parsed.textWidth ?? parsed.text_width);
  return {
    text,
    elements,
    textWidth,
    turnId: typeof parsed.turnId === "string" ? parsed.turnId : null,
    origin,
  };
}

/**
 * Session-chat body for one assistant string.
 * `message` is the visible sentence. `raw` is that same assistant string, kept
 * so layout JSON is not discarded when the sentence and typed shapes are empty.
 */
export function ileSessionChatCanvasReply(assistantText: string | null | undefined): {
  message: string;
  canvasElements: IleWorkCanvasSkeleton[];
  raw: string;
} {
  const raw = String(assistantText || "").trim();
  const parsed = parseIleXaiCanvasTurn(raw);
  return {
    message: String(parsed.text || "").trim(),
    canvasElements: parsed.elements ?? [],
    raw,
  };
}

/**
 * Canvas ask result from a TAP Learning session-chat response.
 * A layout-only assistant string stays in `raw`. An empty visible sentence does
 * not become the error string when that raw reply is present.
 */
export function ileWorkCanvasAskFromSessionChat(input: {
  ok: boolean;
  message?: unknown;
  canvasElements?: unknown;
  raw?: unknown;
  errorMessage?: string | null;
}): {
  text: string;
  elements: IleWorkCanvasSkeleton[] | null;
  origin: { x?: number; y?: number } | null;
  raw: string;
} {
  if (!input.ok) {
    return {
      text: String(input.errorMessage || "").trim(),
      elements: null,
      origin: null,
      raw: "",
    };
  }
  const assistantRaw = typeof input.raw === "string" ? input.raw.trim() : "";
  const visible = typeof input.message === "string" ? input.message.trim() : "";
  const parsed = parseIleXaiCanvasTurn(assistantRaw || visible);
  const elements = Array.isArray(input.canvasElements)
    ? (input.canvasElements as IleWorkCanvasSkeleton[])
    : (parsed.elements ?? null);
  const text = visible || String(parsed.text || "").trim();
  if (!assistantRaw && !text) {
    return {
      text: String(input.errorMessage || "").trim(),
      elements,
      origin: parsed.origin ?? null,
      raw: "",
    };
  }
  return {
    text,
    elements,
    origin: parsed.origin ?? null,
    raw: assistantRaw,
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
  "rephrase",
  "split",
  "elaborate",
  "selective-compression",
  "refactor",
  "suggest-insight",
  "clear-overlaps",
  "join",
  "dictate",
  "answer",
  "simplify",
  "ask",
]);

/**
 * Map Excalidraw's internal active tool / element kind onto shared canvas PoW
 * `tool_name` / `tool_action` (`canvas` + draw_text / move / …). Never emits
 * retired TAP Learning tools. Selecting the selection tool is not work.
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
  'Suggest a scene origin for that reply as JSON "origin": {"x": number, "y": number} tucked against the existing cluster, usually directly under nearby marks. Do not jump far to the right.';

function formatCanvasMeasure(value: unknown): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return "0";
  const rounded = Math.round(n * 1000) / 1000;
  if (Object.is(rounded, -0)) return "0";
  return String(rounded);
}

/**
 * Every non-deleted mark: type, position, size, and text.
 * Deleted elements and collaborator cursors are omitted.
 */
export function ileWorkCanvasLiveGeometryListing(
  scene: IleWorkCanvasScene | { elements?: unknown } | null | undefined,
): string {
  const live = serializeIleWorkCanvasScene(scene).elements.filter(
    (el) => !el.isDeleted && el.type !== "cursor",
  );
  if (!live.length) return "(no live elements)";
  return live
    .map((el) => {
      const head = `${el.type} x=${formatCanvasMeasure(el.x)} y=${formatCanvasMeasure(el.y)} width=${formatCanvasMeasure(el.width)} height=${formatCanvasMeasure(el.height)}`;
      const text = String(el.originalText || el.text || "").replace(/\s+/g, " ").trim();
      return text ? `${head} text=${JSON.stringify(text)}` : head;
    })
    .join("\n");
}

/** User-message payload: the focused chapter's live board geometry and drawing tools. */
export function ileWorkCanvasTurnContextMessage(
  scene: IleWorkCanvasScene | null | undefined,
  input?: {
    boardLabel?: string;
    workspace?: PromptWorkspaceContextInput | PromptWorkspaceContext | null;
  },
): string {
  const board = String(input?.boardLabel || "CHAPTER").trim() || "CHAPTER";
  const body = `CURRENT ${board} WORK CANVAS (every live element: type, x, y, width, height, and text). Deleted marks are omitted. Co-author this board: your reply is placed on it as a text block the learner can move and edit. ${ILE_WORK_CANVAS_TURN_ORIGIN_INSTRUCTION} ${ileWorkCanvasXaiToolsInstruction()}\n${ileWorkCanvasLiveGeometryListing(scene)}`;
  return ileWorkCanvasWithDomainPrefix(body, input?.workspace);
}

export const ILE_WORK_CANVAS_QUICK_ACTION_REPHRASE = "rephrase" as const;
export const ILE_WORK_CANVAS_QUICK_ACTION_SPLIT = "split" as const;
export const ILE_WORK_CANVAS_QUICK_ACTION_ELABORATE = "elaborate more pls" as const;

export type IleWorkCanvasQuickActionId =
  | typeof ILE_WORK_CANVAS_QUICK_ACTION_REPHRASE
  | typeof ILE_WORK_CANVAS_QUICK_ACTION_SPLIT
  | typeof ILE_WORK_CANVAS_QUICK_ACTION_ELABORATE;

/** Canned Commands intents. Rephrase / elaborate go through the ask path. */
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

/**
 * Join the selection into one mark.
 * Two or more text-bearing marks become one text block, in reading order.
 * Other selections share one Excalidraw group so they move together.
 */
export function joinIleWorkCanvasSelection(
  scene: IleWorkCanvasScene | null | undefined,
  selectedElements: readonly IleWorkCanvasElement[] | null | undefined,
): { scene: IleWorkCanvasScene; joined: boolean; parts: IleWorkCanvasElement[] } {
  const current = serializeIleWorkCanvasScene(scene);
  const live = ileWorkCanvasSelectedLive(current, selectedElements);
  if (live.length < 2) return { scene: current, joined: false, parts: [] };
  const textual = live.filter((el) => String(el.originalText || el.text || "").trim());
  if (textual.length >= 2) {
    const ordered = [...textual].sort((a, b) => {
      const dy = (Number(a.y) || 0) - (Number(b.y) || 0);
      if (Math.abs(dy) > 8) return dy;
      return (Number(a.x) || 0) - (Number(b.x) || 0);
    });
    const text = ordered
      .map((el) => String(el.originalText || el.text || "").trim())
      .filter(Boolean)
      .join("\n\n");
    const bounds = ileWorkCanvasContentBounds(ordered);
    const created = convertToExcalidrawElements([
      {
        type: "text",
        text,
        x: bounds?.minX ?? (Number(ordered[0]?.x) || 0),
        y: bounds?.minY ?? (Number(ordered[0]?.y) || 0),
        width: ILE_WORK_CANVAS_TEXT_BOX_WIDTH,
        autoResize: false,
        customData: { ileJoin: true },
      },
    ]);
    if (!created.length || !text) return { scene: current, joined: false, parts: [] };
    const remove = new Set(ordered.map((el) => el.id));
    return {
      scene: {
        ...current,
        elements: [...current.elements.filter((el) => !remove.has(el.id)), ...created],
      },
      joined: true,
      parts: created,
    };
  }
  const groupId = nextElementId("join");
  const ids = new Set(live.map((el) => el.id));
  const parts: IleWorkCanvasElement[] = [];
  const elements = current.elements.map((el) => {
    if (!ids.has(el.id) || el.isDeleted) return el;
    const groupIds = Array.isArray(el.groupIds) ? el.groupIds.filter((id) => id !== groupId) : [];
    const next = { ...el, groupIds: [...groupIds, groupId] };
    parts.push(next);
    return next;
  });
  if (parts.length < 2) return { scene: current, joined: false, parts: [] };
  return { scene: { ...current, elements }, joined: true, parts };
}


export type IleWorkCanvasClearOverlapsResult = {
  scene: IleWorkCanvasScene;
  separated: boolean;
  needsModel: boolean;
  moved: boolean;
};

function ileWorkCanvasSelectedLive(
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


/** Sentence from a command reply. JSON canvas payloads contribute their text field only. */
export function ileWorkCanvasCommandProse(raw: string | null | undefined): string {
  const source = String(raw || "").trim();
  if (!source) return "";
  const parsed = parseIleXaiCanvasTurn(source);
  const prose = String(parsed.text ?? "").trim();
  if (prose) return prose;
  if (ileXaiReplyIsCanvasJson(source)) return "";
  return source;
}


/**
 * Replace the current selection with one summary mark.
 * A blank summary, or an empty selection, leaves the scene unchanged.
 */
export function compressIleWorkCanvasSelection(
  scene: IleWorkCanvasScene | null | undefined,
  selectedElements: readonly IleWorkCanvasElement[] | null | undefined,
  summary: unknown,
): IleWorkCanvasScene {
  const current = serializeIleWorkCanvasScene(scene);
  const text = ileWorkCanvasCommandProse(String(summary ?? ""));
  const liveSelected = ileWorkCanvasSelectedLive(current, selectedElements);
  if (!text || !liveSelected.length) return current;
  const bounds = ileWorkCanvasContentBounds(liveSelected);
  const created = convertToExcalidrawElements([
    {
      type: "text",
      text,
      x: bounds?.minX ?? TEXT_ORIGIN_X,
      y: bounds?.minY ?? TEXT_ORIGIN_Y,
      width: ILE_WORK_CANVAS_TEXT_BOX_WIDTH,
      autoResize: false,
      customData: {
        [ILE_COMPRESS_WORK_CUSTOM_DATA_KEY]: true,
        ileSelectiveCompression: true,
        author: "xai",
      },
    },
  ]);
  if (!created.length) return current;
  const remove = new Set(liveSelected.map((el) => el.id));
  const kept = current.elements.filter((el) => !remove.has(el.id));
  const settled = settleIleWorkCanvasIncoming(
    created,
    kept.filter((el) => !el.isDeleted),
  );
  return {
    ...current,
    elements: [...kept, ...settled],
    appState: {
      ...current.appState,
      selectedElementIds: {},
    },
  };
}

type IleWorkCanvasLayoutEdit = {
  id: string;
  text: string | null;
  x: number | null;
  y: number | null;
};

function parseIleWorkCanvasLayoutEdits(raw: unknown): IleWorkCanvasLayoutEdit[] {
  let record: Record<string, unknown> | null = null;
  if (typeof raw === "string") {
    record = extractJsonObject(raw);
  } else if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    record = raw as Record<string, unknown>;
  }
  const list = record && Array.isArray(record.elements)
    ? record.elements
    : Array.isArray(raw)
      ? raw
      : [];
  const edits: IleWorkCanvasLayoutEdit[] = [];
  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const rec = item as Record<string, unknown>;
    const id = typeof rec.id === "string" ? rec.id.trim() : "";
    const text = typeof rec.text === "string" ? rec.text.trim() : "";
    const x = Number(rec.x);
    const y = Number(rec.y);
    edits.push({
      id,
      text: text || null,
      x: Number.isFinite(x) ? x : null,
      y: Number.isFinite(y) ? y : null,
    });
  }
  return edits;
}

function ileWorkCanvasEditForElement(
  edits: readonly IleWorkCanvasLayoutEdit[],
  el: IleWorkCanvasElement,
  indexAmongSelected: number,
  matchById: boolean,
): IleWorkCanvasLayoutEdit | null {
  if (matchById) return edits.find((edit) => edit.id === el.id) ?? null;
  return edits[indexAmongSelected] ?? null;
}

/**
 * Reply the refactor and clear-overlaps applies should read.
 * Prefer layout JSON in the original assistant string. When that string has no
 * edits, use typed canvas elements (a tools-shaped reply).
 */
export function ileWorkCanvasLayoutReply(
  raw: string | null | undefined,
  elements?: readonly IleWorkCanvasSkeleton[] | null,
): unknown {
  const source = String(raw || "");
  if (parseIleWorkCanvasLayoutEdits(source).length) return source;
  const list = (elements ?? []).filter((el) => el && typeof el === "object");
  if (list.length) return { elements: list };
  return source;
}

/** Rephrase and move the selection. Unselected marks keep their text and positions. */
export function applyIleWorkCanvasRefactor(
  scene: IleWorkCanvasScene | null | undefined,
  selectedElements: readonly IleWorkCanvasElement[] | null | undefined,
  reply: unknown,
): IleWorkCanvasScene {
  const current = serializeIleWorkCanvasScene(scene);
  const liveSelected = ileWorkCanvasSelectedLive(current, selectedElements);
  if (!liveSelected.length) return current;
  const edits = parseIleWorkCanvasLayoutEdits(reply);
  if (!edits.length) return current;
  const selectedIds = new Set(liveSelected.map((el) => el.id));
  const matchById = edits.some((edit) => edit.id && selectedIds.has(edit.id));
  let ordinal = 0;
  return {
    ...current,
    elements: current.elements.map((el) => {
      if (!selectedIds.has(el.id) || el.isDeleted) return el;
      const edit = ileWorkCanvasEditForElement(edits, el, ordinal, matchById);
      ordinal += 1;
      if (!edit) return el;
      const next: IleWorkCanvasElement = { ...el, version: (Number(el.version) || 1) + 1 };
      if (edit.text) {
        if (el.type === "text") {
          const wrapped = wrapIleWorkCanvasText(
            edit.text,
            Number(el.width) || ILE_WORK_CANVAS_TEXT_BOX_WIDTH,
          );
          next.text = wrapped.text;
          next.originalText = edit.text;
          next.height = wrapped.height;
        } else {
          next.text = edit.text;
          next.originalText = edit.text;
        }
      }
      if (edit.x != null) next.x = edit.x;
      if (edit.y != null) next.y = edit.y;
      return next;
    }),
  };
}

/** Append one suggested-insight mark. The selection stays put and is not saved. */
export function applyIleWorkCanvasSuggestInsight(
  scene: IleWorkCanvasScene | null | undefined,
  selectedElements: readonly IleWorkCanvasElement[] | null | undefined,
  suggestion: unknown,
): IleWorkCanvasScene {
  const current = serializeIleWorkCanvasScene(scene);
  const text = ileWorkCanvasCommandProse(String(suggestion ?? ""));
  const liveSelected = ileWorkCanvasSelectedLive(current, selectedElements);
  if (!text || !liveSelected.length) return current;
  const wrapped = wrapIleWorkCanvasText(text);
  const origin = ileWorkCanvasEmptyNearbyOrigin({
    elements: current.elements,
    near: liveSelected,
    box: { width: wrapped.width, height: wrapped.height },
  });
  const created = convertToExcalidrawElements([
    {
      type: "text",
      text,
      x: origin.x,
      y: origin.y,
      width: wrapped.width,
      autoResize: false,
      customData: {
        author: "xai",
        ileSuggestedInsight: true,
      },
    },
  ]);
  if (!created.length) return current;
  const settled = settleIleWorkCanvasIncoming(
    created,
    current.elements.filter((el) => !el.isDeleted),
  );
  return {
    ...current,
    elements: [...current.elements, ...settled],
  };
}

/** Move selected marks to new positions. Text and type stay. */
export function applyIleWorkCanvasPositionEdits(
  scene: IleWorkCanvasScene | null | undefined,
  selectedElements: readonly IleWorkCanvasElement[] | null | undefined,
  reply: unknown,
): IleWorkCanvasScene {
  const current = serializeIleWorkCanvasScene(scene);
  const liveSelected = ileWorkCanvasSelectedLive(current, selectedElements);
  if (!liveSelected.length) return current;
  const edits = parseIleWorkCanvasLayoutEdits(reply);
  if (!edits.length) return current;
  const selectedIds = new Set(liveSelected.map((el) => el.id));
  const matchById = edits.some((edit) => edit.id && selectedIds.has(edit.id));
  let ordinal = 0;
  return {
    ...current,
    elements: current.elements.map((el) => {
      if (!selectedIds.has(el.id) || el.isDeleted) return el;
      const edit = ileWorkCanvasEditForElement(edits, el, ordinal, matchById);
      ordinal += 1;
      if (!edit || (edit.x == null && edit.y == null)) return el;
      return {
        ...el,
        x: edit.x == null ? el.x : edit.x,
        y: edit.y == null ? el.y : edit.y,
        version: (Number(el.version) || 1) + 1,
      };
    }),
  };
}

function ileWorkCanvasRectSeparation(
  a: { minX: number; minY: number; maxX: number; maxY: number },
  b: { minX: number; minY: number; maxX: number; maxY: number },
): number {
  const sepX = a.maxX <= b.minX ? b.minX - a.maxX : b.maxX <= a.minX ? a.minX - b.maxX : 0;
  const sepY = a.maxY <= b.minY ? b.minY - a.maxY : b.maxY <= a.minY ? a.minY - b.maxY : 0;
  if (sepX > 0 || sepY > 0) return Math.max(sepX, sepY);
  return 0;
}

function ileWorkCanvasBoxesTouch(
  rects: readonly { minX: number; minY: number; maxX: number; maxY: number }[],
): boolean {
  for (let i = 0; i < rects.length; i += 1) {
    for (let j = i + 1; j < rects.length; j += 1) {
      if (ileWorkCanvasRectSeparation(rects[i]!, rects[j]!) <= 0) return true;
    }
  }
  return false;
}

/**
 * Separate a selection with a local column layout.
 * Already-gapped selections stay put. XAI is requested only when a box cannot be measured.
 */
export function clearIleWorkCanvasSelectionOverlaps(
  scene: IleWorkCanvasScene | null | undefined,
  selectedElements: readonly IleWorkCanvasElement[] | null | undefined,
): IleWorkCanvasClearOverlapsResult {
  const current = serializeIleWorkCanvasScene(scene);
  const liveSelected = ileWorkCanvasSelectedLive(current, selectedElements);
  if (liveSelected.length < 2) {
    return { scene: current, separated: true, needsModel: false, moved: false };
  }
  const measured = liveSelected.map((el) => ({
    el,
    rect: ileWorkCanvasNormalizedRect(el),
  }));
  if (measured.some((item) => !item.rect)) {
    return { scene: current, separated: false, needsModel: true, moved: false };
  }
  const rects = measured.map((item) => item.rect!);
  if (!ileWorkCanvasBoxesTouch(rects)) {
    return { scene: current, separated: true, needsModel: false, moved: false };
  }
  const ordered = measured
    .map((item) => ({ el: item.el, rect: item.rect! }))
    .sort((a, b) => a.rect.minY - b.rect.minY || a.rect.minX - b.rect.minX);
  const anchorX = Math.min(...rects.map((rect) => rect.minX));
  let cursorY = Math.min(...rects.map((rect) => rect.minY));
  const placed = new Map<string, IleWorkCanvasElement>();
  for (const item of ordered) {
    const dx = anchorX - item.rect.minX;
    const dy = cursorY - item.rect.minY;
    placed.set(item.el.id, {
      ...item.el,
      x: item.el.x + dx,
      y: item.el.y + dy,
      version: (Number(item.el.version) || 1) + 1,
    });
    cursorY += item.rect.maxY - item.rect.minY + ILE_WORK_CANVAS_OVERLAP_GAP;
  }
  const nextElements = current.elements.map((el) => placed.get(el.id) ?? el);
  const placedRects = [...placed.values()]
    .map((el) => ileWorkCanvasNormalizedRect(el))
    .filter((rect): rect is NonNullable<typeof rect> => Boolean(rect));
  if (placedRects.length !== placed.size || ileWorkCanvasBoxesTouch(placedRects)) {
    return { scene: current, separated: false, needsModel: true, moved: false };
  }
  const moved = liveSelected.some((el) => {
    const next = placed.get(el.id);
    return !next || next.x !== el.x || next.y !== el.y;
  });
  return {
    scene: { ...current, elements: nextElements },
    separated: true,
    needsModel: false,
    moved,
  };
}

/** Call `ask` only when a local layout cannot separate the selection. */
export function runIleWorkCanvasClearOverlaps(input: {
  scene: IleWorkCanvasScene | null | undefined;
  selectedElements?: readonly IleWorkCanvasElement[] | null;
  workspace?: PromptWorkspaceContextInput | PromptWorkspaceContext | null;
  ask?: ((message: string) => void) | null;
}): IleWorkCanvasClearOverlapsResult {
  const result = clearIleWorkCanvasSelectionOverlaps(input.scene, input.selectedElements);
  if (result.needsModel && input.ask) {
    input.ask(
      buildIleWorkCanvasClearOverlapsUserMessage({
        selectedElements: input.selectedElements,
        workspace: input.workspace,
      }),
    );
  }
  return result;
}

export function ileWorkCanvasAddedElementIds(
  before: { elements?: readonly { id?: string | null; isDeleted?: boolean }[] | null } | null | undefined,
  after: { elements?: readonly { id?: string | null; isDeleted?: boolean }[] | null } | null | undefined,
): string[] {
  const seen = new Set<string>();
  for (const el of before?.elements ?? []) {
    const id = String(el?.id || "").trim();
    if (id) seen.add(id);
  }
  const ids: string[] = [];
  for (const el of after?.elements ?? []) {
    const id = String(el?.id || "").trim();
    if (!id || el?.isDeleted || seen.has(id)) continue;
    ids.push(id);
  }
  return ids;
}
