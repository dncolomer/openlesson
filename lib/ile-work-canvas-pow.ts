/**
 * Shared ILE + TAP Work-canvas Proof of Work.
 * Pure scene-diff classifier + upload-item builder so hosts do not fork
 * `tool_name` / `tool_action` and tests do not mount Excalidraw.
 */
import {
  ILE_EXCALIDRAW_POW_TOOLS,
  ileWorkCanvasHasLiveElements,
  ileWorkCanvasPointerBusy,
  isRetiredIleWorkToolName,
  serializeIleWorkCanvasScene,
  type IleWorkCanvasElement,
  type IleWorkCanvasScene,
} from "@/lib/ile-work-canvas";
import type { IleProofOfWorkUploadItem } from "@/lib/ile-evidence-buffer";

export const ILE_WORK_CANVAS_POW_TOOL_NAME = "canvas" as const;

export const ILE_WORK_CANVAS_POW_ACTIONS = [
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
] as const;

export type IleWorkCanvasPowAction = (typeof ILE_WORK_CANVAS_POW_ACTIONS)[number];

const POW_ACTION_SET = new Set<string>(ILE_WORK_CANVAS_POW_ACTIONS);

const ELEMENT_DRAW_ACTION: Record<string, IleWorkCanvasPowAction> = {
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

const POS_EPS = 0.5;
const ANGLE_EPS = 0.01;

export type IleWorkCanvasPowEvent = {
  toolName: typeof ILE_WORK_CANVAS_POW_TOOL_NAME;
  toolAction: IleWorkCanvasPowAction;
  metadata: Record<string, unknown>;
};

export type IleWorkCanvasAskPowKind = "expand_more" | "board_prompt" | "compress_work";

function normalizeToolToken(value: string | null | undefined): string {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/^tool_/, "")
    .replace(/\s+/g, "_");
}

export function ileWorkCanvasActiveToolName(
  appState: Record<string, unknown> | null | undefined,
): string {
  const raw = appState?.activeTool;
  if (typeof raw === "string") return normalizeToolToken(raw);
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const type = (raw as { type?: unknown }).type;
    if (typeof type === "string") return normalizeToolToken(type);
  }
  return "";
}

export function ileWorkCanvasSelectedIds(
  appState: Record<string, unknown> | null | undefined,
): string[] {
  const raw = appState?.selectedElementIds;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return [];
  return Object.keys(raw as Record<string, unknown>).filter((id) =>
    Boolean((raw as Record<string, unknown>)[id]),
  );
}

export function ileWorkCanvasGestureBusy(
  appState:
    | {
        cursorButton?: string | null;
        isResizing?: boolean;
        isRotating?: boolean;
        draggingElement?: unknown;
        editingElement?: unknown;
      }
    | null
    | undefined,
): boolean {
  if (ileWorkCanvasPointerBusy(appState)) return true;
  return Boolean(appState?.editingElement);
}

function liveElements(scene: IleWorkCanvasScene): IleWorkCanvasElement[] {
  return scene.elements.filter((el) => el && !el.isDeleted && el.id);
}

function indexById(elements: readonly IleWorkCanvasElement[]): Map<string, IleWorkCanvasElement> {
  const map = new Map<string, IleWorkCanvasElement>();
  for (const el of elements) map.set(el.id, el);
  return map;
}

function pointsSignature(el: IleWorkCanvasElement): string {
  if (!Array.isArray(el.points) || !el.points.length) return "";
  return el.points
    .map((pair) =>
      Array.isArray(pair)
        ? pair.map((n) => (Number.isFinite(Number(n)) ? Number(n).toFixed(2) : "0")).join(",")
        : "",
    )
    .join(";");
}

function textOf(el: IleWorkCanvasElement): string {
  return String(el.originalText || el.text || "");
}

function nearlyEqual(a: number, b: number, eps: number): boolean {
  return Math.abs(a - b) <= eps;
}

function elementGeometryChanged(prev: IleWorkCanvasElement, next: IleWorkCanvasElement): boolean {
  if (!nearlyEqual(prev.x, next.x, POS_EPS)) return true;
  if (!nearlyEqual(prev.y, next.y, POS_EPS)) return true;
  if (!nearlyEqual(prev.width, next.width, POS_EPS)) return true;
  if (!nearlyEqual(prev.height, next.height, POS_EPS)) return true;
  return pointsSignature(prev) !== pointsSignature(next);
}

function elementRotated(prev: IleWorkCanvasElement, next: IleWorkCanvasElement): boolean {
  return !nearlyEqual(Number(prev.angle) || 0, Number(next.angle) || 0, ANGLE_EPS);
}

function elementDrawnAgain(prev: IleWorkCanvasElement, next: IleWorkCanvasElement): boolean {
  if (textOf(prev) !== textOf(next)) return true;
  if (String(prev.strokeColor || "") !== String(next.strokeColor || "")) return true;
  if (String(prev.backgroundColor || "") !== String(next.backgroundColor || "")) return true;
  if (String(prev.fileId || "") !== String(next.fileId || "")) return true;
  return false;
}

function liveContentEqual(prev: IleWorkCanvasScene, next: IleWorkCanvasScene): boolean {
  const a = liveElements(prev);
  const b = liveElements(next);
  if (a.length !== b.length) return false;
  const prevMap = indexById(a);
  for (const el of b) {
    const before = prevMap.get(el.id);
    if (!before) return false;
    if (before.type !== el.type) return false;
    if (elementRotated(before, el) || elementGeometryChanged(before, el) || elementDrawnAgain(before, el)) {
      return false;
    }
  }
  return true;
}

function drawActionForType(type: string): IleWorkCanvasPowAction | null {
  const key = normalizeToolToken(type);
  return ELEMENT_DRAW_ACTION[key] ?? null;
}

function eventOf(
  action: IleWorkCanvasPowAction,
  elements: readonly Pick<IleWorkCanvasElement, "id" | "type">[],
  extra?: Record<string, unknown>,
): IleWorkCanvasPowEvent {
  const ids = elements.map((el) => el.id).filter(Boolean);
  const types = elements.map((el) => el.type).filter(Boolean);
  return {
    toolName: ILE_WORK_CANVAS_POW_TOOL_NAME,
    toolAction: action,
    metadata: {
      via: "excalidraw",
      element_ids: ids,
      element_types: types,
      count: ids.length || Number(extra?.count) || 0,
      multi: ids.length > 1 || extra?.multi === true,
      ...extra,
    },
  };
}

function isViewportOnlyAppStateChange(prev: IleWorkCanvasScene, next: IleWorkCanvasScene): boolean {
  if (!liveContentEqual(prev, next)) return false;
  const prevSelected = ileWorkCanvasSelectedIds(prev.appState).sort().join(",");
  const nextSelected = ileWorkCanvasSelectedIds(next.appState).sort().join(",");
  if (prevSelected !== nextSelected) return false;
  return true;
}

/**
 * Map Excalidraw's active tool / element kind / explicit action onto the
 * shared canvas PoW vocabulary. Retired ILE tools never emit.
 */
export function mapExcalidrawToolToCanvasPow(input: {
  activeTool?: string | null;
  elementType?: string | null;
  action?: string | null;
}): IleWorkCanvasPowEvent | null {
  const toolRaw = normalizeToolToken(input.activeTool);
  const elementRaw = normalizeToolToken(input.elementType);
  const actionRaw = normalizeToolToken(input.action);
  if (
    isRetiredIleWorkToolName(toolRaw) ||
    isRetiredIleWorkToolName(elementRaw) ||
    isRetiredIleWorkToolName(actionRaw)
  ) {
    return null;
  }
  if (actionRaw && POW_ACTION_SET.has(actionRaw)) {
    return {
      toolName: ILE_WORK_CANVAS_POW_TOOL_NAME,
      toolAction: actionRaw as IleWorkCanvasPowAction,
      metadata: { via: "excalidraw" },
    };
  }
  const draw =
    drawActionForType(toolRaw) ||
    drawActionForType(elementRaw) ||
    ((ILE_EXCALIDRAW_POW_TOOLS as readonly string[]).includes(toolRaw)
      ? drawActionForType(toolRaw)
      : null);
  if (!draw) return null;
  return {
    toolName: ILE_WORK_CANVAS_POW_TOOL_NAME,
    toolAction: draw,
    metadata: { via: "excalidraw" },
  };
}

export function classifyIleWorkCanvasSceneDiff(
  prevScene: IleWorkCanvasScene | null | undefined,
  nextScene: IleWorkCanvasScene | null | undefined,
): IleWorkCanvasPowEvent[] {
  const next = serializeIleWorkCanvasScene(nextScene);
  if (isRetiredIleWorkToolName(ileWorkCanvasActiveToolName(next.appState))) return [];
  if (!prevScene) {
    const created = liveElements(next);
    if (!created.length) return [];
    return eventsForCreated(created);
  }
  const prev = serializeIleWorkCanvasScene(prevScene);
  if (isRetiredIleWorkToolName(ileWorkCanvasActiveToolName(prev.appState))) return [];

  const prevLive = liveElements(prev);
  const nextLive = liveElements(next);
  const prevMap = indexById(prevLive);
  const nextMap = indexById(nextLive);
  const events: IleWorkCanvasPowEvent[] = [];

  const created = nextLive.filter((el) => !prevMap.has(el.id));
  const deleted = prevLive.filter((el) => !nextMap.has(el.id));
  const shared = nextLive.filter((el) => prevMap.has(el.id));

  const prevSelected = ileWorkCanvasSelectedIds(prev.appState);
  const nextSelected = ileWorkCanvasSelectedIds(next.appState);
  const prevSelectKey = [...prevSelected].sort().join(",");
  const nextSelectKey = [...nextSelected].sort().join(",");
  const selectionBecameMulti =
    nextSelected.length >= 2 && nextSelectKey !== prevSelectKey;

  const contentUnchanged = liveContentEqual(prev, next);
  if (contentUnchanged && !selectionBecameMulti) {
    return [];
  }
  if (contentUnchanged && selectionBecameMulti) {
    const selectedEls = nextSelected
      .map((id) => nextMap.get(id))
      .filter((el): el is IleWorkCanvasElement => Boolean(el));
    events.push(
      eventOf("multi_select", selectedEls, {
        count: nextSelected.length,
        selected_ids: nextSelected,
      }),
    );
    return events;
  }

  if (isViewportOnlyAppStateChange(prev, next)) return [];

  if (created.length) events.push(...eventsForCreated(created));

  if (deleted.length) {
    const tool = ileWorkCanvasActiveToolName(next.appState) || ileWorkCanvasActiveToolName(prev.appState);
    const action: IleWorkCanvasPowAction = tool === "eraser" ? "erase" : "delete";
    events.push(
      eventOf(action, deleted, {
        count: deleted.length,
        multi: deleted.length > 1,
      }),
    );
  }

  const rotated: IleWorkCanvasElement[] = [];
  const moved: IleWorkCanvasElement[] = [];
  const redrawnByType = new Map<IleWorkCanvasPowAction, IleWorkCanvasElement[]>();
  for (const el of shared) {
    const before = prevMap.get(el.id);
    if (!before) continue;
    if (elementRotated(before, el)) {
      rotated.push(el);
      continue;
    }
    if (elementGeometryChanged(before, el)) {
      moved.push(el);
      continue;
    }
    if (elementDrawnAgain(before, el)) {
      const action = drawActionForType(el.type);
      if (!action) continue;
      const list = redrawnByType.get(action) ?? [];
      list.push(el);
      redrawnByType.set(action, list);
    }
  }

  if (rotated.length) {
    events.push(eventOf("rotate", rotated, { count: rotated.length, multi: rotated.length > 1 }));
  }
  if (moved.length) {
    events.push(eventOf("move", moved, { count: moved.length, multi: moved.length > 1 }));
  }
  for (const [action, els] of redrawnByType) {
    events.push(eventOf(action, els, { count: els.length, multi: els.length > 1 }));
  }

  if (selectionBecameMulti) {
    const selectedEls = nextSelected
      .map((id) => nextMap.get(id))
      .filter((el): el is IleWorkCanvasElement => Boolean(el));
    events.push(
      eventOf("multi_select", selectedEls, {
        count: nextSelected.length,
        selected_ids: nextSelected,
        subsequent_op: Boolean(rotated.length || moved.length || deleted.length || created.length),
      }),
    );
  } else if (
    nextSelected.length >= 2 &&
    (rotated.length > 1 || moved.length > 1 || deleted.length > 1)
  ) {
    for (const event of events) {
      if (event.toolAction === "multi_select") continue;
      event.metadata.multi = true;
      event.metadata.selected_ids = nextSelected;
    }
  }

  return events;
}

function eventsForCreated(created: IleWorkCanvasElement[]): IleWorkCanvasPowEvent[] {
  const byAction = new Map<IleWorkCanvasPowAction, IleWorkCanvasElement[]>();
  for (const el of created) {
    const action = drawActionForType(el.type);
    if (!action || action === "erase") continue;
    const list = byAction.get(action) ?? [];
    list.push(el);
    byAction.set(action, list);
  }
  const events: IleWorkCanvasPowEvent[] = [];
  for (const [action, els] of byAction) {
    events.push(eventOf(action, els, { count: els.length, multi: els.length > 1 }));
  }
  return events;
}

export function buildIleWorkCanvasAskPowEvent(
  kind: IleWorkCanvasAskPowKind,
  input: {
    prompt?: string | null;
    selectedElements?: readonly IleWorkCanvasElement[] | null;
    selectedIds?: readonly string[] | null;
  } = {},
): IleWorkCanvasPowEvent | null {
  if (kind !== "expand_more" && kind !== "board_prompt" && kind !== "compress_work") {
    return null;
  }
  const selected = [...(input.selectedElements ?? [])];
  const ids =
    input.selectedIds?.length
      ? [...input.selectedIds]
      : selected.map((el) => el.id).filter(Boolean);
  const prompt = String(input.prompt || "").trim();
  if (kind === "expand_more" && !ids.length && !prompt) return null;
  if (kind === "board_prompt" && !prompt) return null;
  if (kind === "compress_work" && !ids.length && !prompt) return null;
  return {
    toolName: ILE_WORK_CANVAS_POW_TOOL_NAME,
    toolAction: kind,
    metadata: {
      via: "excalidraw",
      prompt,
      element_ids: ids,
      element_types: selected.map((el) => el.type).filter(Boolean),
      count: ids.length,
      multi: ids.length > 1,
    },
  };
}

export function buildIleWorkCanvasActionUploadItem(
  sessionId: string,
  event: {
    toolName?: string | null;
    toolAction?: string | null;
    metadata?: Record<string, unknown> | null;
  },
  timestampMs = Date.now(),
): IleProofOfWorkUploadItem | null {
  const toolName = normalizeToolToken(event.toolName) || ILE_WORK_CANVAS_POW_TOOL_NAME;
  const toolAction = normalizeToolToken(event.toolAction);
  if (
    isRetiredIleWorkToolName(toolName) ||
    isRetiredIleWorkToolName(toolAction) ||
    isRetiredIleWorkToolName(String(event.metadata?.tool || ""))
  ) {
    return null;
  }
  if (!toolAction || !POW_ACTION_SET.has(toolAction)) return null;
  const metadata = { via: "excalidraw", ...(event.metadata ?? {}) };
  return {
    kind: "tool",
    mimeType: "application/json",
    fileName: `ile-canvas-${toolAction}-${timestampMs}.json`,
    payload: JSON.stringify({
      session_id: sessionId,
      tool: ILE_WORK_CANVAS_POW_TOOL_NAME,
      action: toolAction,
      timestamp_ms: timestampMs,
      metadata,
    }),
    timestampMs,
    toolName: ILE_WORK_CANVAS_POW_TOOL_NAME,
    toolAction,
    metadata,
  };
}

/** Sidebar open/close is not Work-canvas density. Retired tools never upload. */
export function shouldLogIleSidebarToolSwitch(toolName: string | null | undefined): boolean {
  const name = normalizeToolToken(toolName);
  if (!name) return false;
  if (name === ILE_WORK_CANVAS_POW_TOOL_NAME) return false;
  if (isRetiredIleWorkToolName(name)) return false;
  return true;
}

export function ileWorkCanvasElementContentFingerprint(
  scene: IleWorkCanvasScene | null | undefined,
): string {
  const restorable = serializeIleWorkCanvasScene(scene);
  const live = liveElements(restorable);
  if (!live.length) return "";
  try {
    return JSON.stringify(
      live.map((el) => [
        el.id,
        el.type,
        el.x,
        el.y,
        el.width,
        el.height,
        el.angle,
        el.isDeleted,
        textOf(el),
        pointsSignature(el),
        el.fileId || "",
      ]),
    );
  } catch {
    return "";
  }
}

type CollectorObserveOpts = {
  gestureBusy?: boolean;
};

/** Bare `elements: []` while the board already has work — Excalidraw mount, not a learner wipe. */
function isIleWorkCanvasMountEmptyWipe(
  baseline: IleWorkCanvasScene | null | undefined,
  incoming: IleWorkCanvasScene,
): boolean {
  if (!ileWorkCanvasHasLiveElements(baseline)) return false;
  if (ileWorkCanvasHasLiveElements(incoming)) return false;
  return incoming.elements.length === 0;
}

/**
 * Collapses a pointer-drag / in-progress text edit into one emit.
 * Hosts call `syncWithoutEmit` for XAI/remote applies so those are not learner work.
 */
export class IleWorkCanvasPowCollector {
  private baseline: IleWorkCanvasScene | null = null;
  private latest: IleWorkCanvasScene | null = null;
  private gestureBusy = false;

  reset(scene?: IleWorkCanvasScene | null) {
    const next = scene ? serializeIleWorkCanvasScene(scene) : null;
    this.baseline = next;
    this.latest = next;
    this.gestureBusy = false;
  }

  syncWithoutEmit(scene: IleWorkCanvasScene | null | undefined) {
    const next = serializeIleWorkCanvasScene(scene);
    this.baseline = next;
    this.latest = next;
  }

  observeScene(
    scene: IleWorkCanvasScene | null | undefined,
    opts?: CollectorObserveOpts,
  ): IleWorkCanvasPowEvent[] {
    const next = serializeIleWorkCanvasScene(scene);
    // Excalidraw fires a bare empty scene on mount. That is not last-element
    // delete/erase, which leave isDeleted remnants the classifier must emit.
    if (isIleWorkCanvasMountEmptyWipe(this.baseline, next)) {
      return [];
    }
    this.latest = next;
    const busy = Boolean(opts?.gestureBusy);
    if (busy) {
      this.gestureBusy = true;
      return [];
    }
    const events = classifyIleWorkCanvasSceneDiff(this.baseline, next);
    this.baseline = next;
    this.gestureBusy = false;
    return events;
  }

  markGestureBusy(busy: boolean): IleWorkCanvasPowEvent[] {
    if (this.gestureBusy && !busy) {
      this.gestureBusy = false;
      if (!this.latest) return [];
      const events = classifyIleWorkCanvasSceneDiff(this.baseline, this.latest);
      this.baseline = this.latest;
      return events;
    }
    this.gestureBusy = busy;
    return [];
  }

  expandMore(input: {
    prompt?: string | null;
    selectedElements?: readonly IleWorkCanvasElement[] | null;
    selectedIds?: readonly string[] | null;
  }): IleWorkCanvasPowEvent[] {
    const event = buildIleWorkCanvasAskPowEvent("expand_more", input);
    return event ? [event] : [];
  }

  boardPrompt(input: {
    prompt?: string | null;
    selectedElements?: readonly IleWorkCanvasElement[] | null;
  }): IleWorkCanvasPowEvent[] {
    const event = buildIleWorkCanvasAskPowEvent("board_prompt", input);
    return event ? [event] : [];
  }

  compressWork(input: {
    prompt?: string | null;
    selectedElements?: readonly IleWorkCanvasElement[] | null;
  } = {}): IleWorkCanvasPowEvent[] {
    const event = buildIleWorkCanvasAskPowEvent("compress_work", {
      prompt: input.prompt || "Compress work",
      selectedElements: input.selectedElements,
    });
    return event ? [event] : [];
  }
}
