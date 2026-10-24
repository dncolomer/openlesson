/**
 * TAP Learning Work canvas xAI: JSON salvage, parseIleXaiCanvasTurn, ask/command run.
 */
import { stripLearnerFacingWrappers } from "@/lib/session-format-wrapper";
import {
  type PromptWorkspaceContext,
  type PromptWorkspaceContextInput,
} from "@/lib/prompt-workspace-context";
import {
  ILE_WORK_CANVAS_OVERLAP_GAP,
  type IleWorkCanvasAskKind,
  type IleWorkCanvasCommandId,
} from "@/lib/learn-work-canvas-commands";
import {
  buildIleWorkCanvasClearOverlapsUserMessage,
  ileWorkCanvasSelectionSummary,
  ileWorkCanvasWithDomainPrefix,
  ileWorkCanvasXaiToolsInstruction,
} from "@/lib/learn-work-canvas-prompts";
import { ileWorkCanvasNormalizedRect } from "@/lib/learn-work-canvas-geometry";
import {
  DEFAULT_DIMENSION,
  DEFAULT_FONT_SIZE,
  ILE_COMPRESS_WORK_CUSTOM_DATA_KEY,
  ILE_WORK_CANVAS_FONT_FAMILY,
  ILE_WORK_CANVAS_STROKE_COLOR,
  ILE_WORK_CANVAS_TEXT_BOX_WIDTH,
  ILE_XAI_CANVAS_CUSTOM_DATA_KEY,
  ILE_XAI_NOTE_CUSTOM_DATA_KEY,
  ILE_XAI_NOTE_PAD_X,
  ILE_XAI_NOTE_PAD_Y,
  TEXT_ORIGIN_X,
  TEXT_ORIGIN_Y,
  asRecord,
  convertToExcalidrawElements,
  ileWorkCanvasContentBounds,
  ileWorkCanvasFiniteOrigin,
  ileWorkCanvasHasLiveElements,
  ileWorkCanvasXaiNoteSkeletons,
  ileWorkCanvasXaiTextWidth,
  nextElementId,
  normalizeExtraSkeletons,
  serializeIleWorkCanvasScene,
  withIleWorkCanvasGridAppState,
  wrapIleWorkCanvasText,
  type IleWorkCanvasElement,
  type IleWorkCanvasScene,
  type IleWorkCanvasSkeleton,
  type IleXaiCanvasTurnPayload,
} from "@/lib/learn-work-canvas-scene";
import {
  applyIleXaiTurnToWorkCanvas,
  ileWorkCanvasEmptyNearbyOrigin,
  ileWorkCanvasEmptyNearbyOriginWithReserved,
  mergeIleXaiTurnOntoLiveWorkCanvas,
  settleIleWorkCanvasIncoming,
  withIleWorkCanvasAutoLayout,
} from "@/lib/learn-work-canvas-place";

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
  const text = stripLearnerFacingWrappers(visibleTextFromXaiReply(source, parsed));
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
  const clauses = original.split(/\s*[,;:|/—–]\s+/).map((part) => part.trim()).filter(Boolean);
  if (clauses.length >= 2) return groupIleWorkCanvasSplitParts(clauses, " ");
  const words = original.split(/\s+/).filter(Boolean);
  if (words.length < 2) return [];
  const n = words.length >= 9 ? 3 : 2;
  const groups: string[][] = Array.from({ length: n }, () => []);
  words.forEach((word, index) => {
    groups[Math.min(n - 1, Math.floor((index * n) / words.length))].push(word);
  });
  return groups.map((group) => group.join(" ")).filter(Boolean);
}

function ileWorkCanvasBoundTextId(
  element: IleWorkCanvasElement,
  scene?: IleWorkCanvasScene | null,
): string | null {
  const bound = Array.isArray(element.boundElements) ? element.boundElements : [];
  for (const entry of bound) {
    if (!entry || typeof entry !== "object") continue;
    const rec = entry as { type?: unknown; id?: unknown };
    if (typeof rec.id !== "string" || !rec.id.trim()) continue;
    if (rec.type === "text" || rec.type == null) return rec.id;
  }
  const containerId = element.id;
  const nested = (scene?.elements ?? []).find(
    (el) =>
      ileWorkCanvasHasSplitText(el) &&
      typeof el.containerId === "string" &&
      el.containerId === containerId,
  );
  return nested?.id ?? null;
}

function ileWorkCanvasHasSplitText(element: IleWorkCanvasElement | null | undefined): boolean {
  return Boolean(
    element &&
      !element.isDeleted &&
      element.type === "text" &&
      String(element.originalText || element.text || "").trim(),
  );
}

/** Selected free text, or bound caption on a selected container. */
export function ileWorkCanvasSplitTextTarget(
  scene: IleWorkCanvasScene | null | undefined,
  selectedElements: readonly IleWorkCanvasElement[] | null | undefined,
): IleWorkCanvasElement | null {
  const current = serializeIleWorkCanvasScene(scene);
  const live = ileWorkCanvasSelectedLive(current, selectedElements);
  const direct = live.find((el) => ileWorkCanvasHasSplitText(el));
  if (direct) return current.elements.find((el) => el.id === direct.id) ?? direct;
  for (const el of live) {
    const boundId = ileWorkCanvasBoundTextId(el, current);
    if (!boundId) continue;
    const bound = current.elements.find((item) => item.id === boundId);
    if (ileWorkCanvasHasSplitText(bound)) return bound ?? null;
  }
  return null;
}

/** Include bound captions so a labeled rectangle is a real command target. */
export function expandIleWorkCanvasCommandSelection(
  scene: IleWorkCanvasScene | null | undefined,
  selectedElements: readonly IleWorkCanvasElement[] | null | undefined,
): IleWorkCanvasElement[] {
  const current = serializeIleWorkCanvasScene(scene);
  const live = ileWorkCanvasSelectedLive(current, selectedElements);
  const byId = new Map(live.map((el) => [el.id, el]));
  for (const el of live) {
    const boundId = ileWorkCanvasBoundTextId(el, current);
    if (!boundId || byId.has(boundId)) continue;
    const bound = current.elements.find((item) => item.id === boundId && !item.isDeleted);
    if (bound) byId.set(bound.id, bound);
  }
  return [...byId.values()];
}

function ileWorkCanvasWithoutBoundText(
  elements: IleWorkCanvasElement[],
  textId: string,
): IleWorkCanvasElement[] {
  return elements
    .filter((el) => el.id !== textId)
    .map((el) => {
      const bound = Array.isArray(el.boundElements) ? el.boundElements : null;
      if (!bound?.length) return el;
      const nextBound = bound.filter((entry) => {
        if (!entry || typeof entry !== "object") return true;
        return (entry as { id?: unknown }).id !== textId;
      });
      if (nextBound.length === bound.length) return el;
      return { ...el, boundElements: nextBound.length ? nextBound : null };
    });
}

/**
 * Replace one text element with 2 or 3 live text blocks. Non-text is a no-op.
 * Concatenated chunks preserve the source modulo whitespace.
 * Bound captions unbind from their container so the new blocks stay editable.
 */
export function splitIleWorkCanvasTextElement(
  scene: IleWorkCanvasScene | null | undefined,
  element: Pick<
    IleWorkCanvasElement,
    | "id"
    | "type"
    | "text"
    | "originalText"
    | "x"
    | "y"
    | "width"
    | "height"
    | "isDeleted"
    | "fontSize"
    | "fontFamily"
    | "strokeColor"
    | "textAlign"
    | "opacity"
    | "containerId"
  > | null | undefined,
): { scene: IleWorkCanvasScene; split: boolean; parts: IleWorkCanvasElement[] } {
  const current = serializeIleWorkCanvasScene(scene);
  if (!element || element.isDeleted || element.type !== "text") {
    return { scene: current, split: false, parts: [] };
  }
  const source = String(element.originalText || element.text || "");
  const chunks = ileWorkCanvasSplitTextChunks(source);
  if (chunks.length < 2) return { scene: current, split: false, parts: [] };
  const boxWidth = Number(element.width) > 0 ? Number(element.width) : ILE_WORK_CANVAS_TEXT_BOX_WIDTH;
  const fontSize = Number(element.fontSize) || DEFAULT_FONT_SIZE;
  const skeletons: IleWorkCanvasSkeleton[] = [];
  let y = Number(element.y) || 0;
  const x = Number(element.x) || 0;
  for (const chunk of chunks) {
    const wrapped = wrapIleWorkCanvasText(chunk, boxWidth, fontSize);
    skeletons.push({
      type: "text",
      text: chunk,
      x,
      y,
      width: wrapped.width,
      autoResize: false,
      fontSize,
      fontFamily: Number(element.fontFamily) || ILE_WORK_CANVAS_FONT_FAMILY,
      strokeColor:
        typeof element.strokeColor === "string" ? element.strokeColor : ILE_WORK_CANVAS_STROKE_COLOR,
      textAlign: typeof element.textAlign === "string" ? element.textAlign : "left",
      opacity: element.opacity == null ? 100 : Number(element.opacity) || 0,
    });
    y += wrapped.height + 16;
  }
  const parts = convertToExcalidrawElements(skeletons);
  if (parts.length < 2) return { scene: current, split: false, parts: [] };
  const remaining = ileWorkCanvasWithoutBoundText(current.elements, element.id);
  const selectedElementIds = Object.fromEntries(parts.map((part) => [part.id, true]));
  return {
    scene: {
      ...current,
      elements: [...remaining, ...parts],
      appState: {
        ...current.appState,
        selectedElementIds,
      },
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
  const expanded = expandIleWorkCanvasCommandSelection(current, selectedElements);
  const target = ileWorkCanvasSplitTextTarget(current, expanded);
  if (!target) return { scene: current, split: false, parts: [] };
  const live = current.elements.find((el) => el.id === target.id) ?? target;
  return splitIleWorkCanvasTextElement(current, live);
}

function ileWorkCanvasFanHost(
  scene: IleWorkCanvasScene,
  selectedElements: readonly IleWorkCanvasElement[] | null | undefined,
): { host: IleWorkCanvasElement; expanded: IleWorkCanvasElement[] } | null {
  const expanded = expandIleWorkCanvasCommandSelection(scene, selectedElements);
  const target = ileWorkCanvasSplitTextTarget(scene, expanded);
  const host =
    (target && typeof target.containerId === "string" && target.containerId
      ? scene.elements.find((el) => el.id === target.containerId && !el.isDeleted)
      : null) ??
    (target ? scene.elements.find((el) => el.id === target.id && !el.isDeleted) ?? target : null) ??
    ileWorkCanvasSelectedLive(scene, expanded)[0] ??
    null;
  if (!host) return null;
  return { host, expanded };
}

/**
 * Keep the original mark and fan labeled nodes to the right, each linked back
 * with an arrow. The new nodes stay unselected.
 */
export function fanIleWorkCanvasLabeledNodes(
  scene: IleWorkCanvasScene | null | undefined,
  selectedElements: readonly IleWorkCanvasElement[] | null | undefined,
  chunks: readonly string[],
  mark: "ileBreakdown" | "ileConcepts",
): { scene: IleWorkCanvasScene; split: boolean; parts: IleWorkCanvasElement[] } {
  const current = serializeIleWorkCanvasScene(scene);
  const labels = chunks.map((chunk) => String(chunk || "").replace(/\s+/g, " ").trim()).filter(Boolean);
  if (!labels.length) return { scene: current, split: false, parts: [] };
  const found = ileWorkCanvasFanHost(current, selectedElements);
  if (!found) return { scene: current, split: false, parts: [] };
  const { host, expanded } = found;
  const hostRect = ileWorkCanvasNormalizedRect(host) ?? {
    minX: Number(host.x) || 0,
    minY: Number(host.y) || 0,
    maxX: (Number(host.x) || 0) + Math.max(1, Number(host.width) || 0),
    maxY: (Number(host.y) || 0) + Math.max(1, Number(host.height) || 0),
  };
  const innerWidth = Math.min(
    ILE_WORK_CANVAS_TEXT_BOX_WIDTH,
    Math.max(140, hostRect.maxX - hostRect.minX),
  );
  const gapX = ILE_WORK_CANVAS_OVERLAP_GAP + 28;
  const gapY = 12;
  const nodeSkeletons: IleWorkCanvasSkeleton[] = [];
  let cursorY = hostRect.minY;
  for (const chunk of labels) {
    const wrapped = wrapIleWorkCanvasText(chunk, innerWidth);
    const height = wrapped.height + ILE_XAI_NOTE_PAD_Y * 2;
    nodeSkeletons.push({
      type: "rectangle",
      x: hostRect.maxX + gapX,
      y: cursorY,
      width: wrapped.width + ILE_XAI_NOTE_PAD_X * 2,
      height,
      label: { text: chunk },
      customData: { [mark]: true },
    });
    cursorY += height + gapY;
  }
  const stackHeight = cursorY - gapY - hostRect.minY;
  const hostHeight = hostRect.maxY - hostRect.minY;
  const shiftY = stackHeight < hostHeight ? (hostHeight - stackHeight) / 2 : 0;
  if (shiftY) {
    for (const skeleton of nodeSkeletons) {
      skeleton.y = Number(skeleton.y) + shiftY;
    }
  }
  const created = convertToExcalidrawElements(nodeSkeletons);
  if (!created.length) return { scene: current, split: false, parts: [] };
  const settledNodes = settleIleWorkCanvasIncoming(
    created,
    current.elements.filter((el) => !el.isDeleted),
  );
  const nodeHosts = settledNodes.filter((el) => el.type === "rectangle");
  const hostMidY = (hostRect.minY + hostRect.maxY) / 2;
  const arrows: IleWorkCanvasElement[] = [];
  const hostBounds = Array.isArray(host.boundElements) ? [...host.boundElements] : [];
  for (const node of nodeHosts) {
    const rect = ileWorkCanvasNormalizedRect(node);
    if (!rect) continue;
    const endX = rect.minX;
    const endY = (rect.minY + rect.maxY) / 2;
    const dx = endX - hostRect.maxX;
    const dy = endY - hostMidY;
    const [arrow] = convertToExcalidrawElements([
      {
        type: "arrow",
        x: hostRect.maxX,
        y: hostMidY,
        width: dx,
        height: dy,
        points: [
          [0, 0],
          [dx, dy],
        ],
        customData: { [mark]: true },
      },
    ]);
    if (!arrow) continue;
    arrow.endArrowhead = "arrow";
    arrow.startArrowhead = null;
    arrow.startBinding = { elementId: host.id, focus: 0, gap: 4 };
    arrow.endBinding = { elementId: node.id, focus: 0, gap: 4 };
    hostBounds.push({ id: arrow.id, type: "arrow" });
    node.boundElements = [
      ...(Array.isArray(node.boundElements) ? node.boundElements : []),
      { id: arrow.id, type: "arrow" },
    ];
    arrows.push(arrow);
  }
  const hostNext = {
    ...host,
    boundElements: hostBounds,
    version: (Number(host.version) || 1) + 1,
  };
  const parts = [...settledNodes, ...arrows];
  return {
    scene: {
      ...current,
      elements: [
        ...current.elements.map((el) => (el.id === host.id ? hostNext : el)),
        ...parts,
      ],
      appState: {
        ...current.appState,
        selectedElementIds: Object.fromEntries(
          expanded.filter((el) => el.id && !el.isDeleted).map((el) => [el.id, true]),
        ),
      },
    },
    split: true,
    parts,
  };
}

export function breakdownIleWorkCanvasSelection(
  scene: IleWorkCanvasScene | null | undefined,
  selectedElements: readonly IleWorkCanvasElement[] | null | undefined,
): { scene: IleWorkCanvasScene; split: boolean; parts: IleWorkCanvasElement[] } {
  const current = serializeIleWorkCanvasScene(scene);
  const expanded = expandIleWorkCanvasCommandSelection(current, selectedElements);
  const target = ileWorkCanvasSplitTextTarget(current, expanded);
  if (!target) return { scene: current, split: false, parts: [] };
  const source = String(target.originalText || target.text || "");
  const chunks = ileWorkCanvasSplitTextChunks(source);
  if (chunks.length < 2) return { scene: current, split: false, parts: [] };
  return fanIleWorkCanvasLabeledNodes(current, selectedElements, chunks, "ileBreakdown");
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

export type IleWorkCanvasCommandAsk = {
  kind: IleWorkCanvasAskKind;
  prompt: string;
};

export type IleWorkCanvasCommandRun = {
  scene: IleWorkCanvasScene;
  changed: boolean;
  parts: IleWorkCanvasElement[];
  selected: IleWorkCanvasElement[];
  prompt: string;
  ask: IleWorkCanvasCommandAsk | null;
  notice: string | null;
};

function ileWorkCanvasCommandPrompt(action: IleWorkCanvasCommandId): string {
  if (action === "simplify") return "Simplify";
  if (action === "refactor") return "Refactor";
  if (action === "answer") return "Answer";
  if (action === "draw") return "Draw";
  if (action === "focus") return "Focus";
  if (action === "split") return "Split";
  if (action === "breakdown") return "Breakdown";
  if (action === "concepts") return "Concepts";
  if (action === "define") return "Define";
  return action;
}

export function appendIleWorkCanvasFocusNote(
  scene: IleWorkCanvasScene | null | undefined,
  text: string | null | undefined,
): { scene: IleWorkCanvasScene; appended: IleWorkCanvasElement[] } {
  const current = serializeIleWorkCanvasScene(scene);
  const clean = String(text || "").replace(/\s+/g, " ").trim();
  if (!clean) return { scene: current, appended: [] };
  const created = convertToExcalidrawElements(
    ileWorkCanvasXaiNoteSkeletons({
      text: clean,
      x: 0,
      y: 0,
      customData: { author: "harness", ileHarnessFocus: true },
    }),
  );
  if (!created.length) return { scene: current, appended: [] };
  const box = {
    width: Number(created[0]?.width) || ILE_WORK_CANVAS_TEXT_BOX_WIDTH,
    height: Number(created[0]?.height) || 80,
  };
  const origin = ileWorkCanvasEmptyNearbyOriginWithReserved({
    elements: current.elements,
    near: current.elements.filter((el) => !el.isDeleted),
    box,
  });
  const shifted = created.map((el) => ({ ...el, x: el.x + origin.x, y: el.y + origin.y }));
  const settled = settleIleWorkCanvasIncoming(
    shifted,
    current.elements.filter((el) => !el.isDeleted),
  );
  return {
    scene: withIleWorkCanvasAutoLayout({
      elements: [...current.elements, ...settled],
      appState: current.appState,
      files: current.files,
    }),
    appended: settled,
  };
}

export function removeIleWorkCanvasSelection(
  scene: IleWorkCanvasScene | null | undefined,
  selectedElements: readonly IleWorkCanvasElement[] | null | undefined,
): { scene: IleWorkCanvasScene; removed: IleWorkCanvasElement[] } {
  const current = serializeIleWorkCanvasScene(scene);
  const liveSelected = ileWorkCanvasSelectedLive(current, selectedElements);
  if (!liveSelected.length) return { scene: current, removed: [] };
  const remove = new Set(liveSelected.map((el) => el.id));
  for (const el of current.elements) {
    if (typeof el.containerId === "string" && el.containerId && remove.has(el.containerId)) {
      remove.add(el.id);
    }
  }
  return {
    scene: {
      ...current,
      elements: current.elements.filter((el) => !remove.has(el.id)),
      appState: {
        ...current.appState,
        selectedElementIds: {},
      },
    },
    removed: current.elements.filter((el) => remove.has(el.id)),
  };
}

export function replaceIleWorkCanvasSelection(
  scene: IleWorkCanvasScene | null | undefined,
  selectedElements: readonly IleWorkCanvasElement[] | null | undefined,
  payload: {
    text?: string | null;
    elements?: IleWorkCanvasSkeleton[] | null;
    turnId?: string | null;
  },
): IleWorkCanvasScene {
  const current = serializeIleWorkCanvasScene(scene);
  const liveSelected = ileWorkCanvasSelectedLive(current, selectedElements);
  const originElements = liveSelected.length
    ? liveSelected
    : (selectedElements ?? []).filter((el) => el && !el.isDeleted);
  const text = stripLearnerFacingWrappers(String(payload.text || "").trim());
  const extra = normalizeExtraSkeletons(payload.elements);
  if (!text && extra.length === 0) return current;
  if (!originElements.length && !liveSelected.length) return current;
  const bounds = ileWorkCanvasContentBounds(originElements);
  const origin = {
    x: bounds?.minX ?? TEXT_ORIGIN_X,
    y: bounds?.minY ?? TEXT_ORIGIN_Y,
  };
  const customData = {
    [ILE_XAI_CANVAS_CUSTOM_DATA_KEY]: true,
    [ILE_XAI_NOTE_CUSTOM_DATA_KEY]: true,
    turnId: String(payload.turnId || `turn-${Date.now()}`),
    author: "xai",
  };
  const skeletons: IleWorkCanvasSkeleton[] = [
    ...ileWorkCanvasXaiNoteSkeletons({
      text,
      x: origin.x,
      y: origin.y,
      customData,
    }),
  ];
  let extraY = origin.y + (Number(skeletons[0]?.height) || 0) + 16;
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
  const created = convertToExcalidrawElements(skeletons);
  if (!created.length) return current;
  const stripped = removeIleWorkCanvasSelection(current, originElements);
  const settled = settleIleWorkCanvasIncoming(
    created,
    stripped.scene.elements.filter((el) => !el.isDeleted),
  );
  return withIleWorkCanvasAutoLayout({
    ...stripped.scene,
    elements: [...stripped.scene.elements, ...settled],
    appState: {
      ...stripped.scene.appState,
      selectedElementIds: {},
    },
  });
}

/**
 * Local result of a sidebar/dock command click.
 * Split, Breakdown, and Focus mutate now. Simplify and Refactor drop the
 * original marks immediately, then ask XAI. Answer, Draw, Concepts, and Define
 * keep the original and ask. A click that cannot run returns a short board notice instead of going silent.
 */
export function runIleWorkCanvasCommand(input: {
  action: IleWorkCanvasCommandId;
  scene: IleWorkCanvasScene | null | undefined;
  selectedElements: readonly IleWorkCanvasElement[] | null | undefined;
  focusText?: string | null;
}): IleWorkCanvasCommandRun {
  const current = serializeIleWorkCanvasScene(input.scene);
  const selected = expandIleWorkCanvasCommandSelection(current, input.selectedElements);
  const prompt = ileWorkCanvasCommandPrompt(input.action);
  const idle = (notice: string | null, ask: IleWorkCanvasCommandAsk | null = null): IleWorkCanvasCommandRun => ({
    scene: current,
    changed: false,
    parts: [],
    selected,
    prompt,
    ask,
    notice,
  });
  if (input.action === "focus") {
    const placed = appendIleWorkCanvasFocusNote(current, input.focusText);
    if (!placed.appended.length) {
      return idle("The harness has nothing to place yet.");
    }
    return {
      scene: placed.scene,
      changed: true,
      parts: placed.appended,
      selected,
      prompt,
      ask: null,
      notice: null,
    };
  }
  if (!selected.length) {
    return idle(null);
  }
  if (input.action === "split") {
    const result = splitIleWorkCanvasSelectedText(current, selected);
    if (result.split) {
      return {
        scene: withIleWorkCanvasAutoLayout(result.scene),
        changed: true,
        parts: result.parts,
        selected,
        prompt,
        ask: null,
        notice: null,
      };
    }
    const target = ileWorkCanvasSplitTextTarget(current, selected);
    return idle(
      target
        ? "Need at least two words to split."
        : "Select text, or a labeled shape, to split.",
    );
  }
  if (input.action === "breakdown") {
    const result = breakdownIleWorkCanvasSelection(current, selected);
    if (result.split) {
      const keep = ileWorkCanvasSelectedLive(result.scene, selected);
      return {
        scene: withIleWorkCanvasAutoLayout(result.scene),
        changed: true,
        parts: keep,
        selected,
        prompt,
        ask: null,
        notice: null,
      };
    }
    const target = ileWorkCanvasSplitTextTarget(current, selected);
    return idle(
      target
        ? "Need at least two words to break down."
        : "Select text, or a labeled shape, to break down.",
    );
  }
  if (input.action === "simplify" || input.action === "refactor") {
    const stripped = removeIleWorkCanvasSelection(current, selected);
    return {
      scene: withIleWorkCanvasAutoLayout(stripped.scene),
      changed: stripped.removed.length > 0,
      parts: [],
      selected,
      prompt,
      ask: { kind: input.action, prompt },
      notice: null,
    };
  }
  if (input.action === "concepts") {
    return idle(null, { kind: "concepts", prompt });
  }
  if (input.action === "define") {
    return idle(null, { kind: "define", prompt });
  }
  if (input.action === "answer") {
    return idle(null, { kind: "answer", prompt });
  }
  if (input.action === "draw") {
    return idle(null, { kind: "draw", prompt });
  }
  return idle(null);
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
