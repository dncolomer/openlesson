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
  BOARD_INSTRUCTION_NOTE_KEY,
  ileWorkCanvasNoteLabel,
  ILE_WORK_CANVAS_END_ARROWHEAD,
  ILE_WORK_CANVAS_TEXT_BOX_WIDTH,
  TEXT_ORIGIN_X,
  TEXT_ORIGIN_Y,
  convertToExcalidrawElements,
  ileWorkCanvasContentBounds,
  ileWorkCanvasSelectedLive,
  normalizeExtraSkeletons,
  serializeIleWorkCanvasScene,
  type IleWorkCanvasElement,
  type IleWorkCanvasScene,
  type IleWorkCanvasSkeleton,
} from "@/lib/learn-work-canvas-scene";
import { withIleWorkCanvasAutoLayout } from "@/lib/learn-work-canvas-chrome";
import {
  ileWorkCanvasEmptyNearbyOriginWithReserved,
  ileWorkCanvasXaiNoteElements,
  placeTurn,
  settleIleWorkCanvasIncoming,
} from "@/lib/learn-work-canvas-place";

export const ILE_SELECTIVE_COMPRESSION_LABEL = "Compress";
export { ILE_WORK_CANVAS_OVERLAP_GAP };

export const ILE_WORK_CANVAS_COMMANDS = [
  {
    id: "focus",
    label: "Focus",
    tooltip: "Place the current harness focus onto the canvas as a note.",
    shortcut: "f",
    needsSelection: false,
    learnOnly: true,
    replacesSelection: false,
  },
  {
    id: "next",
    label: "Next",
    tooltip:
      "Place the next unused cheapest step on the hidden-state model. Each click walks another priced action.",
    shortcut: "n",
    needsSelection: false,
    learnOnly: true,
    replacesSelection: false,
  },
  {
    id: "simplify",
    label: "Simplify",
    tooltip:
      "Replace the selected marks with a shorter, plainer rewrite. If the selection is a term, make the meaning plain.",
    shortcut: "s",
    needsSelection: true,
    learnOnly: false,
    replacesSelection: true,
  },
  {
    id: "breakdown",
    label: "Subdivide",
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
    id: "draw",
    label: "Do/run",
    slash: "run",
    tooltip: "Work the highlighted problem: carry it out, compute it, or show the result.",
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
  | "draw"
  | "simplify"
  | "concepts"
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

function ileWorkCanvasCommandMatchNames(
  command: (typeof ILE_WORK_CANVAS_COMMANDS)[number],
): string[] {
  const label = command.label.toLowerCase();
  const names = [
    command.id,
    label,
    label.replace(/[\s/]+/g, ""),
    label.replace(/[\s/]+/g, "-"),
  ];
  if ("slash" in command) {
    const slash = String(command.slash || "")
      .trim()
      .toLowerCase();
    if (slash) names.push(slash);
  }
  return names;
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
  return catalog.filter((command) =>
    ileWorkCanvasCommandMatchNames(command).some((name) => name.startsWith(q)),
  );
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
    ILE_WORK_CANVAS_COMMANDS.find((command) =>
      ileWorkCanvasCommandMatchNames(command).includes(head),
    ) ?? (head && matches.length === 1 ? matches[0] : null);
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

/** Marks the vertical `[` that gathers a Concepts/Breakdown fan-out. */
export const ILE_WORK_CANVAS_FAN_BRACKET_KEY = "ileFanBracket" as const;

const FAN_BRACKET_INSET = 16;
const FAN_BRACKET_TICK = 8;
const FAN_BIND_GAP = 4;

function ileWorkCanvasBindFanArrow(
  arrow: IleWorkCanvasElement,
  start: IleWorkCanvasElement,
  end: IleWorkCanvasElement,
  hostBounds: Array<{ id: string; type: "arrow" }>,
) {
  arrow.endArrowhead = ILE_WORK_CANVAS_END_ARROWHEAD;
  arrow.startArrowhead = null;
  arrow.startBinding = { elementId: start.id, focus: 0, gap: FAN_BIND_GAP };
  arrow.endBinding = { elementId: end.id, focus: 0, gap: FAN_BIND_GAP };
  hostBounds.push({ id: arrow.id, type: "arrow" });
  end.boundElements = [
    ...(Array.isArray(end.boundElements) ? end.boundElements : []),
    { id: arrow.id, type: "arrow" },
  ];
}

function ileWorkCanvasFanStem(
  host: IleWorkCanvasElement,
  hostRect: { minX: number; minY: number; maxX: number; maxY: number },
  end: IleWorkCanvasElement,
  toX: number,
  toY: number,
  mark: "ileBreakdown" | "ileConcepts",
  hostBounds: Array<{ id: string; type: "arrow" }>,
): IleWorkCanvasElement | null {
  const startX = hostRect.maxX;
  const startY = (hostRect.minY + hostRect.maxY) / 2;
  const dx = toX - startX;
  const dy = toY - startY;
  const [arrow] = convertToExcalidrawElements([
    {
      type: "arrow",
      x: startX,
      y: startY,
      width: dx,
      height: dy,
      points: [
        [0, 0],
        [dx, dy],
      ],
      customData: { [mark]: true },
    },
  ]);
  if (!arrow) return null;
  ileWorkCanvasBindFanArrow(arrow, host, end, hostBounds);
  return arrow;
}

/**
 * One stem from the host into a vertical `[` that brackets the fan-out stack.
 * A single node keeps a direct arrow.
 */
function ileWorkCanvasFanConnectors(
  host: IleWorkCanvasElement,
  hostRect: { minX: number; minY: number; maxX: number; maxY: number },
  settledNodes: IleWorkCanvasElement[],
  nodeHosts: IleWorkCanvasElement[],
  mark: "ileBreakdown" | "ileConcepts",
): { connectors: IleWorkCanvasElement[]; hostBounds: unknown[] } {
  const hostBounds = Array.isArray(host.boundElements) ? [...host.boundElements] : [];
  const connectors: IleWorkCanvasElement[] = [];
  if (nodeHosts.length === 1) {
    const node = nodeHosts[0]!;
    const rect = ileWorkCanvasNormalizedRect(node);
    if (rect) {
      const arrow = ileWorkCanvasFanStem(
        host,
        hostRect,
        node,
        rect.minX,
        (rect.minY + rect.maxY) / 2,
        mark,
        hostBounds as Array<{ id: string; type: "arrow" }>,
      );
      if (arrow) connectors.push(arrow);
    }
    return { connectors, hostBounds };
  }
  const stack = ileWorkCanvasContentBounds(settledNodes);
  if (!stack) return { connectors, hostBounds };
  const height = Math.max(1, stack.maxY - stack.minY);
  const barX = stack.minX - FAN_BRACKET_INSET;
  const [bracket] = convertToExcalidrawElements([
    {
      type: "line",
      x: barX,
      y: stack.minY,
      width: FAN_BRACKET_TICK,
      height,
      points: [
        [FAN_BRACKET_TICK, 0],
        [0, 0],
        [0, height],
        [FAN_BRACKET_TICK, height],
      ],
      customData: { [mark]: true, [ILE_WORK_CANVAS_FAN_BRACKET_KEY]: true },
    },
  ]);
  if (!bracket) return { connectors, hostBounds };
  const arrow = ileWorkCanvasFanStem(
    host,
    hostRect,
    bracket,
    barX,
    stack.minY + height / 2,
    mark,
    hostBounds as Array<{ id: string; type: "arrow" }>,
  );
  connectors.push(bracket);
  if (arrow) connectors.push(arrow);
  return { connectors, hostBounds };
}

/**
 * Keep the original mark and fan labeled nodes to the right, linked with one
 * stem into a vertical bracket around the stack. The new nodes stay unselected.
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
  const gapX = ILE_WORK_CANVAS_OVERLAP_GAP + 48;
  const gapY = 12;
  const created: IleWorkCanvasElement[] = [];
  let cursorY = hostRect.minY;
  for (const chunk of labels) {
    const note = ileWorkCanvasXaiNoteElements({
      text: chunk,
      x: hostRect.maxX + gapX,
      y: cursorY,
      width: innerWidth,
      label: ileWorkCanvasNoteLabel(mark === "ileConcepts" ? "concepts" : "breakdown"),
      customData: { [mark]: true },
    });
    created.push(...note.elements);
    cursorY += note.height + gapY;
  }
  const stackHeight = cursorY - gapY - hostRect.minY;
  const hostHeight = hostRect.maxY - hostRect.minY;
  const shiftY = stackHeight < hostHeight ? (hostHeight - stackHeight) / 2 : 0;
  if (shiftY) {
    for (const el of created) {
      el.y = Number(el.y) + shiftY;
    }
  }
  if (!created.length) return { scene: current, split: false, parts: [] };
  const settledNodes = settleIleWorkCanvasIncoming(
    created,
    current.elements.filter((el) => !el.isDeleted),
  );
  const nodeHosts = settledNodes.filter(
    (el) => el.customData?.[BOARD_INSTRUCTION_NOTE_KEY] === "body",
  );
  const { connectors, hostBounds } = ileWorkCanvasFanConnectors(
    host,
    hostRect,
    settledNodes,
    nodeHosts,
    mark,
  );
  const hostNext = {
    ...host,
    boundElements: hostBounds,
    version: (Number(host.version) || 1) + 1,
  };
  const parts = [...settledNodes, ...connectors];
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
  if (action === "draw") return "Do/run";
  if (action === "focus") return "Focus";
  if (action === "next") return "Next";
  if (action === "breakdown") return "Subdivide";
  if (action === "concepts") return "Concepts";
  return action;
}

export function ileWorkCanvasPlacedHarnessNext(
  scene: IleWorkCanvasScene | null | undefined,
): { ids: string[]; texts: string[] } {
  const ids: string[] = [];
  const texts: string[] = [];
  const seenIds = new Set<string>();
  const seenTexts = new Set<string>();
  for (const el of serializeIleWorkCanvasScene(scene).elements) {
    if (el.isDeleted || !el.customData?.ileHarnessNext) continue;
    const hiddenId = String(el.customData.ileHarnessNextId || "").trim();
    if (hiddenId && !seenIds.has(hiddenId)) {
      seenIds.add(hiddenId);
      ids.push(hiddenId);
    }
    if (el.customData[BOARD_INSTRUCTION_NOTE_KEY] !== "text") continue;
    const text = String(el.originalText || el.text || "").replace(/\s+/g, " ").trim();
    if (!text || seenTexts.has(text)) continue;
    seenTexts.add(text);
    texts.push(text);
  }
  return { ids, texts };
}

export function appendIleWorkCanvasFocusNote(
  scene: IleWorkCanvasScene | null | undefined,
  text: string | null | undefined,
  kind: "focus" | "next" = "focus",
  hiddenStateId?: string | null,
): { scene: IleWorkCanvasScene; appended: IleWorkCanvasElement[] } {
  const current = serializeIleWorkCanvasScene(scene);
  const clean = String(text || "").replace(/\s+/g, " ").trim();
  if (!clean) return { scene: current, appended: [] };
  const nextId = String(hiddenStateId || "").trim();
  const note = ileWorkCanvasXaiNoteElements({
    text: clean,
    x: 0,
    y: 0,
    label: ileWorkCanvasNoteLabel(kind),
    customData: {
      author: "harness",
      ileHarnessFocus: kind === "focus",
      ileHarnessNext: kind === "next",
      ...(kind === "next" && nextId ? { ileHarnessNextId: nextId } : {}),
    },
  });
  const created = note.elements;
  if (!created.length) return { scene: current, appended: [] };
  const box = {
    width: note.width || ILE_WORK_CANVAS_TEXT_BOX_WIDTH,
    height: note.height || 80,
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
    label?: string | null;
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
  return placeTurn(
    current,
    { text, elements: extra, turnId: payload.turnId, label: payload.label },
    {
      origin: {
        x: bounds?.minX ?? TEXT_ORIGIN_X,
        y: bounds?.minY ?? TEXT_ORIGIN_Y,
      },
      replaceIds: originElements.map((el) => el.id),
    },
  );
}

/**
 * Local result of a sidebar/dock command click.
 * Subdivide, Focus, and Next mutate now. Simplify and Refactor drop the
 * original marks immediately, then ask XAI. Do/run and Concepts keep the
 * original and ask. A click that cannot run returns a short board notice instead of going silent.
 */
export function runIleWorkCanvasCommand(input: {
  action: IleWorkCanvasCommandId;
  scene: IleWorkCanvasScene | null | undefined;
  selectedElements: readonly IleWorkCanvasElement[] | null | undefined;
  focusText?: string | null;
  nextText?: string | null;
  nextSameAsHere?: boolean;
  nextHiddenStateId?: string | null;
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
    const placed = appendIleWorkCanvasFocusNote(current, input.focusText, "focus");
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
  if (input.action === "next") {
    if (input.nextSameAsHere) {
      return idle("You are already on the cheapest step to explore.");
    }
    const placed = appendIleWorkCanvasFocusNote(
      current,
      input.nextText,
      "next",
      input.nextHiddenStateId,
    );
    if (!placed.appended.length) {
      return idle("The harness has nothing cheaper to explore yet.");
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
        ? "Need at least two words to subdivide."
        : "Select text, or a labeled shape, to subdivide.",
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
