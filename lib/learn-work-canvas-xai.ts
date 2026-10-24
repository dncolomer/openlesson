/**
 * TAP Learning Work canvas xAI: ask/command run (parse lives in xai-parse).
 */
import { stripLearnerFacingWrappers } from "@/lib/session-format-wrapper";
import {
  type PromptWorkspaceContext,
  type PromptWorkspaceContextInput,
} from "@/lib/prompt-workspace-context";
import {
  expandIleWorkCanvasCommandSelection,
  fanIleWorkCanvasLabeledNodes,
  replaceIleWorkCanvasSelection,
  type IleWorkCanvasAskKind,
} from "@/lib/learn-work-canvas-commands";
import {
  buildIleWorkCanvasClearOverlapsUserMessage,
  ileWorkCanvasSelectionSummary,
  ileWorkCanvasWithDomainPrefix,
  ileWorkCanvasXaiToolsInstruction,
} from "@/lib/learn-work-canvas-prompts";
import {
  ILE_WORK_CANVAS_OVERLAP_GAP,
  ileWorkCanvasNormalizedRect,
} from "@/lib/learn-work-canvas-geometry";
import {
  ILE_COMPRESS_WORK_CUSTOM_DATA_KEY,
  ILE_WORK_CANVAS_TEXT_BOX_WIDTH,
  TEXT_ORIGIN_X,
  TEXT_ORIGIN_Y,
  asRecord,
  convertToExcalidrawElements,
  ileWorkCanvasContentBounds,
  ileWorkCanvasHasLiveElements,
  ileWorkCanvasSelectedLive,
  nextElementId,
  normalizeExtraSkeletons,
  serializeIleWorkCanvasScene,
  withIleWorkCanvasGridAppState,
  wrapIleWorkCanvasText,
  type IleWorkCanvasElement,
  type IleWorkCanvasScene,
  type IleWorkCanvasSkeleton,
} from "@/lib/learn-work-canvas-scene";
import { withIleWorkCanvasAutoLayout } from "@/lib/learn-work-canvas-chrome";
import {
  applyIleXaiTurnToWorkCanvas,
  ileWorkCanvasEmptyNearbyOrigin,
  mergeIleXaiTurnOntoLiveWorkCanvas,
  settleIleWorkCanvasIncoming,
} from "@/lib/learn-work-canvas-place";
import {
  extractJsonObject,
  ileWorkCanvasCommandProse,
  parseIleXaiCanvasTurn,
} from "@/lib/learn-work-canvas-xai-parse";

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

export function applyIleXaiReplyToWorkCanvas(
  scene: IleWorkCanvasScene | null | undefined,
  rawReply: string | null | undefined,
  extras?: IleWorkCanvasSkeleton[] | null,
): IleWorkCanvasScene {
  const parsed = parseIleXaiCanvasTurn(rawReply);
  const extra = [...(parsed.elements ?? []), ...normalizeExtraSkeletons(extras)];
  return applyIleXaiTurnToWorkCanvas(scene, { ...parsed, elements: extra });
}

/** Instruct XAI to suggest a scene origin alongside the restorable board. */
export const ILE_WORK_CANVAS_TURN_ORIGIN_INSTRUCTION =
  'Suggest a scene origin for that reply as JSON "origin": {"x": number, "y": number} tucked against the existing cluster, usually directly under nearby marks. Do not jump far to the right. Origin is JSON only — never mention origin, placement, Check/ask, or that a question sits in the right place in "text".';

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

export const ILE_WORK_CANVAS_QUICK_ACTION_CHECK = "check" as const;

export type IleWorkCanvasQuickActionId = typeof ILE_WORK_CANVAS_QUICK_ACTION_CHECK;

/** Canned Check intent. It goes through the ask path. */
export function ileWorkCanvasQuickActionPrompt(
  _action: typeof ILE_WORK_CANVAS_QUICK_ACTION_CHECK,
): string {
  return "Check this selection. Say what holds and what to fix. Answer directly. Do not mention Check/ask, commands, or placement. Stay on the workspace/block domain, and do not invent unrelated topics.";
}

const ILE_CONCEPT_LABEL_MAX = 8;
const ILE_CONCEPT_LABEL_MAX_CHARS = 72;

function ileWorkCanvasCleanConceptLabel(raw: string): string {
  return String(raw || "")
    .replace(/^\s*(?:[-*•]+|\d+[.)])\s+/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function ileWorkCanvasTakeConceptLabels(items: readonly string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of items) {
    const label = ileWorkCanvasCleanConceptLabel(item);
    if (label.length < 2 || label.length > ILE_CONCEPT_LABEL_MAX_CHARS) continue;
    const key = label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(label);
    if (out.length >= ILE_CONCEPT_LABEL_MAX) break;
  }
  return out;
}

/** Concept names from an XAI Concepts reply: JSON list, labeled shapes, or one name per line. */
export function ileWorkCanvasConceptLabels(
  raw: string | null | undefined,
  payload?: {
    text?: string | null;
    elements?: IleWorkCanvasSkeleton[] | null;
  },
): string[] {
  const source = String(raw || "").trim();
  const parsed = extractJsonObject(source);
  const fromJson = parsed?.concepts ?? parsed?.labels;
  if (Array.isArray(fromJson)) {
    const labels = ileWorkCanvasTakeConceptLabels(fromJson.map((item) => String(item ?? "")));
    if (labels.length) return labels;
  }
  const fromElements = ileWorkCanvasTakeConceptLabels(
    (payload?.elements ?? []).map((el) => String(el?.label?.text || el?.text || "")),
  );
  if (fromElements.length) return fromElements;
  const prose = stripLearnerFacingWrappers(String(payload?.text || parsed?.text || source).trim());
  const lines = prose
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
  const fromLines = ileWorkCanvasTakeConceptLabels(lines);
  if (fromLines.length >= 2) return fromLines;
  if (fromLines.length === 1 && lines.length === 1) {
    const parts = fromLines[0]!.split(/\s*(?:,|;|•)\s+|\s+and\s+/i);
    const fromParts = ileWorkCanvasTakeConceptLabels(parts);
    if (fromParts.length >= 2) return fromParts;
  }
  return fromLines;
}

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

export function ileWorkCanvasSceneVisiblyChanged(
  before: IleWorkCanvasScene | null | undefined,
  after: IleWorkCanvasScene | null | undefined,
): boolean {
  const previous = serializeIleWorkCanvasScene(before).elements.filter((el) => !el.isDeleted);
  const next = serializeIleWorkCanvasScene(after).elements.filter((el) => !el.isDeleted);
  if (previous.length !== next.length) return true;
  const byId = new Map(previous.map((el) => [el.id, el]));
  for (const el of next) {
    const prior = byId.get(el.id);
    if (!prior) return true;
    if (
      prior.x !== el.x ||
      prior.y !== el.y ||
      prior.width !== el.width ||
      prior.height !== el.height ||
      String(prior.text || "") !== String(el.text || "") ||
      String(prior.originalText || "") !== String(el.originalText || "")
    ) {
      return true;
    }
  }
  return false;
}

export function ileWorkCanvasAskFallback(kind?: IleWorkCanvasAskKind | null): string {
  if (!kind || kind === "ask") return "Learn more failed. Try again.";
  return `${kind} failed. Try again.`;
}

/**
 * Apply an XAI command reply. Layout commands that cannot edit still place the
 * coaching/fallback sentence so the click is never a silent no-op.
 */
export function applyIleWorkCanvasAskReply(input: {
  kind?: IleWorkCanvasAskKind | null;
  live: IleWorkCanvasScene | null | undefined;
  selectedElements: readonly IleWorkCanvasElement[] | null | undefined;
  payload: {
    text?: string | null;
    raw?: string | null;
    elements?: IleWorkCanvasSkeleton[] | null;
    origin?: { x?: number; y?: number } | null;
    turnId?: string | null;
  };
  fallbackOrigin?: { x?: number; y?: number } | null;
  reserved?: readonly { x: number; y: number }[] | null;
}): IleWorkCanvasScene {
  const live = serializeIleWorkCanvasScene(input.live);
  const selected = expandIleWorkCanvasCommandSelection(live, input.selectedElements);
  const kind = input.kind ?? null;
  const source =
    kind && kind !== "ask" ? String(input.payload.raw || "") : String(input.payload.text || "");
  const layoutReply = ileWorkCanvasLayoutReply(input.payload.raw, input.payload.elements);
  const merge = (text: string, extra?: IleWorkCanvasSkeleton[] | null) =>
    mergeIleXaiTurnOntoLiveWorkCanvas(
      live,
      {
        text,
        elements: extra ?? input.payload.elements,
        turnId: input.payload.turnId,
        origin: input.payload.origin,
      },
      {
        fallbackOrigin: input.fallbackOrigin,
        reserved: input.reserved,
      },
    );
  let next = live;
  if (kind === "selective-compress") {
    next = compressIleWorkCanvasSelection(live, selected, source);
  } else if (kind === "simplify" || kind === "refactor") {
    next = replaceIleWorkCanvasSelection(live, selected, {
      text: input.payload.text,
      elements: input.payload.elements,
      turnId: input.payload.turnId,
    });
  } else if (kind === "concepts") {
    const labels = ileWorkCanvasConceptLabels(source, {
      text: input.payload.text,
      elements: input.payload.elements,
    });
    next = fanIleWorkCanvasLabeledNodes(live, selected, labels, "ileConcepts").scene;
  } else if (kind === "suggest-insight") {
    next = applyIleWorkCanvasSuggestInsight(live, selected, source);
  } else if (kind === "declutter" || kind === "clear-overlaps") {
    next = applyIleWorkCanvasPositionEdits(live, selected, layoutReply);
  } else {
    next = merge(stripLearnerFacingWrappers(String(input.payload.text || "").trim()));
  }
  if (ileWorkCanvasSceneVisiblyChanged(live, next)) return withIleWorkCanvasAutoLayout(next);
  const fallback =
    stripLearnerFacingWrappers(String(input.payload.text || "").trim()) ||
    ileWorkCanvasAskFallback(kind);
  return withIleWorkCanvasAutoLayout(merge(fallback));
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
