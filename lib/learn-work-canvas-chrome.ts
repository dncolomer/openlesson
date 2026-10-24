/**
 * TAP Learning Work canvas chrome: prompt bar, Learn More, zoom, scroll, viewport.
 */
import {
  ileWorkCanvasContentBounds,
  ileWorkCanvasHasLiveElements,
  type IleWorkCanvasElement,
  type IleWorkCanvasScene,
} from "@/lib/learn-work-canvas-scene";

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
