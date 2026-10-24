/**
 * Work-canvas command catalog, slash drafts, and local command apply.
 * Prompt text for those commands lives with the other prompts.
 */
import { stripLearnerFacingWrappers } from "@/lib/session-format-wrapper";
import {
  ILE_WORK_CANVAS_OVERLAP_GAP,
  ileWorkCanvasNormalizedRect,
} from "@/lib/learn-work-canvas-geometry";
import {
  DEFAULT_DIMENSION,
  DEFAULT_FONT_SIZE,
  ILE_WORK_CANVAS_FONT_FAMILY,
  ILE_WORK_CANVAS_STROKE_COLOR,
  ILE_WORK_CANVAS_TEXT_BOX_WIDTH,
  ILE_XAI_CANVAS_CUSTOM_DATA_KEY,
  ILE_XAI_NOTE_CUSTOM_DATA_KEY,
  ILE_XAI_NOTE_PAD_X,
  ILE_XAI_NOTE_PAD_Y,
  TEXT_ORIGIN_X,
  TEXT_ORIGIN_Y,
  convertToExcalidrawElements,
  ileWorkCanvasContentBounds,
  ileWorkCanvasSelectedLive,
  normalizeExtraSkeletons,
  serializeIleWorkCanvasScene,
  wrapIleWorkCanvasText,
  type IleWorkCanvasElement,
  type IleWorkCanvasScene,
  type IleWorkCanvasSkeleton,
} from "@/lib/learn-work-canvas-scene";
import { withIleWorkCanvasAutoLayout } from "@/lib/learn-work-canvas-chrome";
import {
  ileWorkCanvasEmptyNearbyOriginWithReserved,
  ileWorkCanvasXaiNoteSkeletons,
  settleIleWorkCanvasIncoming,
} from "@/lib/learn-work-canvas-place";

export const ILE_SELECTIVE_COMPRESSION_LABEL = "Compress";
export { ILE_WORK_CANVAS_OVERLAP_GAP };

export const ILE_WORK_CANVAS_COMMANDS = [
  {
    id: "focus",
    label: "Focus",
    tooltip: "Place the harness next step onto the canvas as a note.",
    shortcut: "f",
    needsSelection: false,
    learnOnly: true,
    replacesSelection: false,
  },
  {
    id: "simplify",
    label: "Simplify",
    tooltip: "Replace the selected marks with a shorter, plainer rewrite.",
    shortcut: "s",
    needsSelection: true,
    learnOnly: false,
    replacesSelection: true,
  },
  {
    id: "split",
    label: "Split",
    tooltip: "Break the selected text into two or three separate blocks on the canvas.",
    shortcut: "x",
    needsSelection: true,
    learnOnly: false,
    replacesSelection: false,
  },
  {
    id: "breakdown",
    label: "Breakdown",
    tooltip: "Keep the original mark and fan its parts into smaller nodes, linked with arrows.",
    shortcut: "b",
    needsSelection: true,
    learnOnly: false,
    replacesSelection: false,
  },
  {
    id: "concepts",
    label: "Concepts",
    tooltip: "Keep the original and fan its named concepts into linked nodes.",
    shortcut: "c",
    needsSelection: true,
    learnOnly: false,
    replacesSelection: false,
  },
  {
    id: "define",
    label: "Define",
    tooltip: "Keep the original and place a clean, simple definition beside it.",
    shortcut: "e",
    needsSelection: true,
    learnOnly: false,
    replacesSelection: false,
  },
  {
    id: "answer",
    label: "Answer",
    tooltip: "Answer the highlighted question and place the reply beside it.",
    shortcut: "a",
    needsSelection: true,
    learnOnly: false,
    replacesSelection: false,
  },
  {
    id: "draw",
    label: "Draw",
    tooltip: "Give a visual answer: a diagram of the highlighted question.",
    shortcut: "d",
    needsSelection: true,
    learnOnly: false,
    replacesSelection: false,
  },
  {
    id: "refactor",
    label: "Refactor",
    tooltip: "Delete the selected marks and replace them with a clearer rewrite.",
    shortcut: "r",
    needsSelection: true,
    learnOnly: false,
    replacesSelection: true,
  },
] as const;

export type IleWorkCanvasCommandId = (typeof ILE_WORK_CANVAS_COMMANDS)[number]["id"];

export type IleWorkCanvasAskKind =
  | "ask"
  | "answer"
  | "draw"
  | "simplify"
  | "concepts"
  | "define"
  | "check"
  | "selective-compress"
  | "refactor"
  | "suggest-insight"
  | "clear-overlaps"
  | "declutter";

export const ILE_WORK_CANVAS_AUTO_LAYOUT_SHORTCUT = "l";
export const ILE_WORK_CANVAS_AUTO_LAYOUT_LABEL = "Auto layout";
export const ILE_WORK_CANVAS_AUTO_LAYOUT_TOOLTIP =
  "Toggle: after each command or reply, space loose notes so they do not overlap. Drawings, groups, and linked diagrams stay together.";
export const ILE_WORK_CANVAS_CHEATSHEET_LABEL = "Command cheat sheet";

export type IleWorkCanvasCommandDef = (typeof ILE_WORK_CANVAS_COMMANDS)[number];

/** Learn includes Focus. Verify and the leftover TAP dock do not. */
export function ileWorkCanvasCommandsFor(
  guide: string | null | undefined,
): IleWorkCanvasCommandDef[] {
  if (guide === "learn") return [...ILE_WORK_CANVAS_COMMANDS];
  return ILE_WORK_CANVAS_COMMANDS.filter((command) => !command.learnOnly);
}

export const ILE_WORK_CANVAS_SHORTCUT_MOD_HINT =
  "On a MacBook, hold Option (⌥) and the letter. The same modifier is Alt on other keyboards.";

export function ileWorkCanvasCommandShortcutKey(shortcut: string | null | undefined): string {
  return String(shortcut || "").trim().toUpperCase();
}

export function ileWorkCanvasCommandShortcutAppleLabel(shortcut: string | null | undefined): string {
  const key = ileWorkCanvasCommandShortcutKey(shortcut);
  return key ? `⌥${key}` : "";
}

export function ileWorkCanvasCommandShortcutAltLabel(shortcut: string | null | undefined): string {
  const key = ileWorkCanvasCommandShortcutKey(shortcut);
  return key ? `Alt+${key}` : "";
}

export function ileWorkCanvasCommandShortcutLabel(shortcut: string | null | undefined): string {
  const apple = ileWorkCanvasCommandShortcutAppleLabel(shortcut);
  const alt = ileWorkCanvasCommandShortcutAltLabel(shortcut);
  if (!apple) return "";
  return `${apple} / ${alt}`;
}

/** Option/Alt letter from a keydown. Prefer `code` so Mac Option does not send å/ƒ/ß. */
export function ileWorkCanvasCommandShortcutKeyFromEvent(event: {
  altKey?: boolean;
  metaKey?: boolean;
  ctrlKey?: boolean;
  code?: string;
  key?: string;
}): string | null {
  if (!event.altKey || event.metaKey || event.ctrlKey) return null;
  const fromCode = /^Key([A-Z])$/i.exec(String(event.code || ""));
  if (fromCode) return fromCode[1]!.toLowerCase();
  const key = String(event.key || "").toLowerCase();
  return /^[a-z]$/.test(key) ? key : null;
}

export function ileWorkCanvasCommandByShortcut(
  key: string | null | undefined,
  guide?: string | null,
): IleWorkCanvasCommandDef | null {
  const letter = String(key || "")
    .trim()
    .toLowerCase();
  if (!letter) return null;
  return ileWorkCanvasCommandsFor(guide).find((command) => command.shortcut === letter) ?? null;
}

export function ileWorkCanvasCommandNeedsSelection(id: string | null | undefined): boolean {
  const command = ILE_WORK_CANVAS_COMMANDS.find((row) => row.id === id);
  return command ? command.needsSelection : Boolean(String(id || "").trim());
}

/** True when the command drops the original marks before the model reply lands. */
export function ileWorkCanvasCommandReplacesSelection(id: string | null | undefined): boolean {
  return Boolean(ILE_WORK_CANVAS_COMMANDS.find((row) => row.id === id)?.replacesSelection);
}

export function filterIleWorkCanvasCommands(
  query: string | null | undefined,
  guide?: string | null,
) {
  const catalog = ileWorkCanvasCommandsFor(guide);
  const q = String(query || "")
    .trim()
    .toLowerCase();
  if (!q) return catalog;
  return catalog.filter((command) => {
    const label = command.label.toLowerCase();
    const compact = label.replace(/[\s/]+/g, "");
    const dashed = label.replace(/[\s/]+/g, "-");
    return (
      command.id.startsWith(q) ||
      label.startsWith(q) ||
      compact.startsWith(q) ||
      dashed.startsWith(q)
    );
  });
}

/** Slash draft. `/ask what is force` is Ask plus the typed question. */
export function ileCanvasCommandDraft(raw: string | null | undefined): {
  slash: boolean;
  query: string;
  rest: string;
  exactId: IleWorkCanvasCommandId | null;
} {
  const trimmed = String(raw ?? "").trim();
  if (!trimmed.startsWith("/")) {
    return { slash: false, query: "", rest: trimmed, exactId: null };
  }
  const body = trimmed.slice(1).trim();
  const space = body.search(/\s/);
  const head = (space === -1 ? body : body.slice(0, space)).toLowerCase();
  const rest = space === -1 ? "" : body.slice(space + 1).trim();
  const matches = filterIleWorkCanvasCommands(head);
  const exact =
    ILE_WORK_CANVAS_COMMANDS.find((command) => {
      const label = command.label.toLowerCase();
      return (
        command.id === head ||
        label === head ||
        label.replace(/[\s/]+/g, "") === head ||
        label.replace(/[\s/]+/g, "-") === head
      );
    }) ?? (head && matches.length === 1 ? matches[0] : null);
  return { slash: true, query: head, rest, exactId: exact?.id ?? null };
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
