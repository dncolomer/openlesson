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

export const ILE_XAI_CANVAS_CUSTOM_DATA_KEY = "ileXaiTurn" as const;
export const ILE_XAI_LOADING_CUSTOM_DATA_KEY = "ileXaiLoading" as const;
export const ILE_CHAPTER_SEED_CUSTOM_DATA_KEY = "ileChapterSeed" as const;
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
    const type = String(skeleton.type || "").trim();
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

function nextXaiTextOrigin(elements: readonly IleWorkCanvasElement[]): { x: number; y: number } {
  const bounds = ileWorkCanvasContentBounds(elements);
  if (!bounds) return { x: TEXT_ORIGIN_X, y: TEXT_ORIGIN_Y };
  return { x: bounds.minX, y: bounds.maxY + TEXT_GAP_Y };
}

function normalizeExtraSkeletons(raw: unknown): IleWorkCanvasSkeleton[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((item): item is IleWorkCanvasSkeleton => {
    if (!item || typeof item !== "object") return false;
    return typeof (item as IleWorkCanvasSkeleton).type === "string";
  });
}

export function ileWorkCanvasHasLiveElements(
  scene: IleWorkCanvasScene | null | undefined,
): boolean {
  return serializeIleWorkCanvasScene(scene).elements.some((el) => !el.isDeleted);
}

/**
 * First open of a chapter board: place the chapter's initial text as a
 * manipulable Excalidraw text element. No-op when the board already has work.
 */
export function seedIleChapterWorkCanvas(
  scene: IleWorkCanvasScene | null | undefined,
  input: { text?: string | null; chapterId?: string | null },
): { scene: IleWorkCanvasScene; seeded: boolean } {
  const current = serializeIleWorkCanvasScene(scene);
  const text = String(input.text || "").trim();
  if (!text) return { scene: current, seeded: false };
  if (ileWorkCanvasHasLiveElements(current)) return { scene: current, seeded: false };
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

  const origin =
    payload.origin && Number.isFinite(Number(payload.origin.x)) && Number.isFinite(Number(payload.origin.y))
      ? { x: Number(payload.origin.x), y: Number(payload.origin.y) }
      : nextXaiTextOrigin(current.elements);
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

export const ILE_XAI_LOADING_BOX_WIDTH = 220;
export const ILE_XAI_LOADING_BOX_HEIGHT = 52;
export const ILE_XAI_LOADING_GAP = 28;
export const ILE_XAI_LOADING_CLEARANCE = 16;

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
export const ILE_LEARN_MORE_BOX_HEIGHT = 80;
export const ILE_LEARN_MORE_GAP = 8;
export const ILE_LEARN_MORE_VIEWPORT_PAD = 8;

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
}): { count: number; left: number; top: number } | null {
  const ids = input.selectedElementIds ?? {};
  const selected = input.elements.filter((el) => el?.id && ids[el.id] && !el.isDeleted);
  if (!selected.length) return null;
  const appState = input.appState ?? {};
  const viewport = {
    left: (input.viewport?.left ?? Number(appState.offsetLeft)) || 0,
    top: (input.viewport?.top ?? Number(appState.offsetTop)) || 0,
    width: Number(input.viewport?.width) || Number(appState.width) || 0,
    height: Number(input.viewport?.height) || Number(appState.height) || 0,
  };
  const placed = placeIleLearnMorePrompt({
    selection: ileWorkCanvasSelectionViewportRect(selected, appState),
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

export function buildIleWorkCanvasAskUserMessage(input: {
  prompt: string;
  selectedElements?: readonly IleWorkCanvasElement[] | null;
}): string {
  const prompt = String(input.prompt || "").trim();
  const selected = ileWorkCanvasSelectionSummary(input.selectedElements);
  return `Ask about the selected Work canvas elements.\n\nQuestion:\n${prompt}\n\nSelected elements:\n${selected}`;
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

/** Parse an XAI reply into text + optional extra canvas skeletons. */
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
  return { text: String(text || "").trim() || source, elements, turnId: typeof parsed.turnId === "string" ? parsed.turnId : null };
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

const ELEMENT_TYPE_TO_TOOL: Record<string, IleExcalidrawPowTool> = {
  text: "text",
  freedraw: "freedraw",
  rectangle: "rectangle",
  diamond: "diamond",
  ellipse: "ellipse",
  arrow: "arrow",
  line: "line",
  image: "image",
  frame: "frame",
  selection: "selection",
};

/**
 * Map Excalidraw's internal active tool / element kind onto ILE PoW
 * `tool_name` / `tool_action`. Never emits retired ILE tools.
 */
export function mapExcalidrawToolToIlePow(input: {
  activeTool?: string | null;
  elementType?: string | null;
  action?: string | null;
}): { toolName: IleExcalidrawPowTool | string; toolAction: string } | null {
  const toolRaw = normalizeExcalidrawToolName(input.activeTool);
  const elementRaw = normalizeExcalidrawToolName(input.elementType);
  if (RETIRED_ILE_WORK_TOOLS.has(toolRaw) || RETIRED_ILE_WORK_TOOLS.has(elementRaw)) {
    return null;
  }
  const mapped =
    (ILE_EXCALIDRAW_POW_TOOLS as readonly string[]).includes(toolRaw)
      ? (toolRaw as IleExcalidrawPowTool)
      : ELEMENT_TYPE_TO_TOOL[elementRaw] ??
        ((ILE_EXCALIDRAW_POW_TOOLS as readonly string[]).includes(elementRaw)
          ? (elementRaw as IleExcalidrawPowTool)
          : null);
  if (!mapped) return null;
  const actionRaw = normalizeExcalidrawToolName(input.action);
  const toolAction = actionRaw || mapped;
  return { toolName: mapped, toolAction };
}

export function isRetiredIleWorkToolName(name: string | null | undefined): boolean {
  return RETIRED_ILE_WORK_TOOLS.has(normalizeExcalidrawToolName(name));
}

export function ileWorkCanvasSceneForTurn(
  scene: IleWorkCanvasScene | null | undefined,
): IleWorkCanvasScene {
  return serializeIleWorkCanvasScene(scene);
}

/** User-message payload: the focused chapter's full restorable board. */
export function ileWorkCanvasTurnContextMessage(
  scene: IleWorkCanvasScene | null | undefined,
): string {
  const restorable = serializeIleWorkCanvasScene(scene);
  return `CURRENT CHAPTER WORK CANVAS (full restorable Excalidraw scene JSON; collaborators stripped). Co-author this board: your reply is placed on it as a text block the learner can move and edit. Optional extra geometric marks or images go in "elements".\n${JSON.stringify(restorable)}`;
}
