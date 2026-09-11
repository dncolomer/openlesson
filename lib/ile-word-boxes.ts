/**
 * ILE per-word bounding boxes: split, drag-range selection, Open Grok / Open Dantes.
 * Not a concept highlighter — every word is selectable.
 */

export const ILE_WORD_BOX_GROK_TOOL = "grokipedia" as const;
export const ILE_WORD_BOX_DANTES_TOOL = "dantes" as const;

export const ILE_WORD_BOX_OPEN_GROK_LABEL = "Open Grok";
export const ILE_WORD_BOX_OPEN_DANTES_LABEL = "Open Dantes";

export type IleWordBoxTool = typeof ILE_WORD_BOX_GROK_TOOL | typeof ILE_WORD_BOX_DANTES_TOOL;

export type IleWordBoxToken =
  | { kind: "word"; text: string; wordIndex: number }
  | { kind: "gap"; text: string };

export type IleWordBoxMenuAction = {
  tool: IleWordBoxTool;
  query: string;
  label: typeof ILE_WORD_BOX_OPEN_GROK_LABEL | typeof ILE_WORD_BOX_OPEN_DANTES_LABEL;
};

function normalizeQuery(text: string | null | undefined): string {
  return String(text || "").replace(/\s+/g, " ").trim();
}

/** Unwrap leftover ==term== so old Helios turns do not show highlighter delimiters. */
export function stripIleConceptMarkDelimiters(text: string | null | undefined): string {
  return String(text || "").replace(/==([^=\n`$]{1,120}?)==/g, "$1");
}

/** Split turn text into words (punctuation stays on the word) and whitespace gaps. */
export function splitIleTurnWords(text: string | null | undefined): IleWordBoxToken[] {
  const src = stripIleConceptMarkDelimiters(text);
  if (!src) return [];
  const tokens: IleWordBoxToken[] = [];
  const re = /(\S+)|(\s+)/g;
  let wordIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = re.exec(src))) {
    if (match[1]) {
      tokens.push({ kind: "word", text: match[1], wordIndex: wordIndex++ });
    } else if (match[2]) {
      tokens.push({ kind: "gap", text: match[2] });
    }
  }
  return tokens;
}

export function ileWordBoxDragRange(fromIndex: number, toIndex: number): { from: number; to: number } {
  const a = Number.isFinite(fromIndex) ? fromIndex : 0;
  const b = Number.isFinite(toIndex) ? toIndex : a;
  return { from: Math.min(a, b), to: Math.max(a, b) };
}

/** Joined selected words (consecutive drag). */
export function ileWordBoxSelectionText(
  tokens: readonly IleWordBoxToken[],
  fromIndex: number,
  toIndex: number,
): string {
  const { from, to } = ileWordBoxDragRange(fromIndex, toIndex);
  return tokens
    .filter(
      (token): token is { kind: "word"; text: string; wordIndex: number } =>
        token.kind === "word" && token.wordIndex >= from && token.wordIndex <= to,
    )
    .map((token) => token.text)
    .join(" ");
}

export function ileWordBoxMenuActions(selection: string | null | undefined): IleWordBoxMenuAction[] {
  const query = normalizeQuery(selection);
  if (!query) return [];
  return [
    { tool: ILE_WORD_BOX_GROK_TOOL, query, label: ILE_WORD_BOX_OPEN_GROK_LABEL },
    { tool: ILE_WORD_BOX_DANTES_TOOL, query, label: ILE_WORD_BOX_OPEN_DANTES_LABEL },
  ];
}

export function resolveIleGrokipediaSearchValue(input: {
  prefillQuery?: string | null;
  sessionProblem?: string | null;
}): string {
  const prefill = normalizeQuery(input.prefillQuery);
  if (prefill) return prefill;
  return String(input.sessionProblem || "");
}

export function openIleWordBoxTool(input: {
  tool: IleWordBoxTool | string;
  query: string | null | undefined;
  setActiveTool: (tool: IleWordBoxTool) => void;
  setPrefillQuery: (query: string) => void;
}): IleWordBoxMenuAction | null {
  const actions = ileWordBoxMenuActions(input.query);
  const action = actions.find((item) => item.tool === input.tool) ?? null;
  if (!action) return null;
  input.setPrefillQuery(action.query);
  input.setActiveTool(action.tool);
  return action;
}

/** Pointer machine IleWordBoxText uses — range lives here so pointerup is not a stale closure. */
export type IleWordBoxPointerState = {
  dragging: boolean;
  anchor: number | null;
  head: number | null;
};

export function ileWordBoxPointerIdle(): IleWordBoxPointerState {
  return { dragging: false, anchor: null, head: null };
}

export function ileWordBoxPointerDown(
  _state: IleWordBoxPointerState,
  wordIndex: number,
): IleWordBoxPointerState {
  return { dragging: true, anchor: wordIndex, head: wordIndex };
}

export function ileWordBoxPointerEnter(
  state: IleWordBoxPointerState,
  wordIndex: number,
): IleWordBoxPointerState {
  if (!state.dragging) return state;
  return { dragging: true, anchor: state.anchor, head: wordIndex };
}

/** Read data-ile-word-index from a hit target (elementFromPoint or event.target). */
export function ileWordBoxIndexFromHit(hit: unknown): number | null {
  if (!hit || typeof (hit as { closest?: unknown }).closest !== "function") {
    return null;
  }
  try {
    const node = (hit as { closest: (sel: string) => { getAttribute?: (name: string) => string | null } | null }).closest(
      "[data-ile-word-index]",
    );
    if (!node || typeof node.getAttribute !== "function") return null;
    const n = Number(node.getAttribute("data-ile-word-index"));
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

/**
 * Hit-test the word under the pointer in the owning document (opener or PiP).
 * pointerenter on sibling spans is unreliable while dragging.
 */
export function ileWordBoxHitTest(
  input: IleWordBoxView | { document?: IleWordBoxDocumentLike | null } | null | undefined,
  clientX: number,
  clientY: number,
): number | null {
  const doc = input?.document;
  if (!doc || typeof doc.elementFromPoint !== "function") return null;
  return ileWordBoxIndexFromHit(doc.elementFromPoint(clientX, clientY));
}

export function ileWordBoxEventTargets(view: IleWordBoxView | null | undefined): unknown[] {
  const targets: unknown[] = [];
  const win = view?.document?.defaultView;
  if (win && typeof (win as { addEventListener?: unknown }).addEventListener === "function") {
    targets.push(win);
  }
  const doc = view?.document;
  if (
    doc &&
    doc !== win &&
    typeof (doc as { addEventListener?: unknown }).addEventListener === "function"
  ) {
    targets.push(doc);
  }
  return targets;
}

export function ileWordBoxPointerUp(
  state: IleWordBoxPointerState,
  tokens: readonly IleWordBoxToken[],
): { state: IleWordBoxPointerState; menuText: string | null } {
  if (!state.dragging) {
    return { state, menuText: null };
  }
  const next: IleWordBoxPointerState = {
    dragging: false,
    anchor: state.anchor,
    head: state.head,
  };
  if (state.anchor == null || state.head == null) {
    return { state: next, menuText: null };
  }
  const menuText = ileWordBoxSelectionText(tokens, state.anchor, state.head) || null;
  return { state: next, menuText };
}

/**
 * Window pointerup handler. Ignore idle ups (menu button clicks) so an
 * already-open Open Grok / Open Dantes menu is not unmounted before onClick.
 */
export function ileWordBoxApplyWindowPointerUp(
  state: IleWordBoxPointerState,
  tokens: readonly IleWordBoxToken[],
): { state: IleWordBoxPointerState; menuText: string | null; apply: boolean } {
  if (!state.dragging) {
    return { state, menuText: null, apply: false };
  }
  const released = ileWordBoxPointerUp(state, tokens);
  return { ...released, apply: true };
}

export const ILE_WORD_BOX_MENU_OFFSET_PX = 8;
export const ILE_WORD_BOX_MENU_WIDTH_PX = 176;
export const ILE_WORD_BOX_MENU_HEIGHT_PX = 80;

/** Window that owns a word-box surface (opener or Document PiP). */
export type IleWordBoxWindowLike = {
  innerWidth?: number;
  innerHeight?: number;
  document?: IleWordBoxDocumentLike | null;
  defaultView?: IleWordBoxWindowLike | null;
  addEventListener?: unknown;
};

export type IleWordBoxDocumentLike = {
  body?: unknown | null;
  defaultView?: IleWordBoxWindowLike | null;
  elementFromPoint?: (x: number, y: number) => unknown;
  addEventListener?: unknown;
};

export type IleWordBoxView = {
  document: IleWordBoxDocumentLike | null;
  innerWidth: number;
  innerHeight: number;
  body: unknown | null;
};

/**
 * Resolve the document/window that owns a word-box surface.
 * Document PiP must use the PiP window — not the opener.
 */
export function resolveIleWordBoxView(
  node?: { ownerDocument?: IleWordBoxDocumentLike | null } | null,
  fallback?: Partial<IleWordBoxView> | null,
): IleWordBoxView | null {
  const ownerDoc = node?.ownerDocument ?? null;
  const ownerWin = ownerDoc?.defaultView ?? null;
  if (ownerDoc) {
    return {
      document: ownerDoc,
      innerWidth: Number(ownerWin?.innerWidth) || Number(fallback?.innerWidth) || 0,
      innerHeight: Number(ownerWin?.innerHeight) || Number(fallback?.innerHeight) || 0,
      body: ownerDoc.body ?? fallback?.body ?? null,
    };
  }
  if (!fallback) return null;
  return {
    document: fallback.document ?? null,
    innerWidth: Number(fallback.innerWidth) || 0,
    innerHeight: Number(fallback.innerHeight) || 0,
    body: fallback.body ?? fallback.document?.body ?? null,
  };
}

/** Portal the Open Grok / Open Dantes menu into the owning document body (PiP or opener). */
export function ileWordBoxPortalTarget(
  view: Pick<IleWordBoxView, "body" | "document"> | null | undefined,
): unknown | null {
  if (view?.body) return view.body;
  if (view?.document?.body) return view.document.body;
  return null;
}

function viewportFromInput(input: {
  viewportWidth?: number;
  viewportHeight?: number;
  view?: { innerWidth?: number; innerHeight?: number; document?: unknown; body?: unknown } | null;
}): { vw: number; vh: number } {
  const fromViewW = Number(input.view?.innerWidth);
  const fromViewH = Number(input.view?.innerHeight);
  const vw = Number.isFinite(input.viewportWidth)
    ? Number(input.viewportWidth)
    : Number.isFinite(fromViewW)
      ? fromViewW
      : Number.POSITIVE_INFINITY;
  const vh = Number.isFinite(input.viewportHeight)
    ? Number(input.viewportHeight)
    : Number.isFinite(fromViewH)
      ? fromViewH
      : Number.POSITIVE_INFINITY;
  return { vw, vh };
}

/** Place Open Grok / Open Dantes beside the pointer, flipping if near the viewport edge. */
export function ileWordBoxMenuPosition(input: {
  clientX: number;
  clientY: number;
  viewportWidth?: number;
  viewportHeight?: number;
  view?: { innerWidth?: number; innerHeight?: number; document?: unknown; body?: unknown } | null;
}): { left: number; top: number } {
  const x = Number(input.clientX) || 0;
  const y = Number(input.clientY) || 0;
  const offset = ILE_WORD_BOX_MENU_OFFSET_PX;
  const { vw, vh } = viewportFromInput(input);
  let left = x + offset;
  let top = y + offset;
  if (left + ILE_WORD_BOX_MENU_WIDTH_PX > vw) {
    left = Math.max(offset, x - ILE_WORD_BOX_MENU_WIDTH_PX - offset);
  }
  if (top + ILE_WORD_BOX_MENU_HEIGHT_PX > vh) {
    top = Math.max(offset, y - ILE_WORD_BOX_MENU_HEIGHT_PX - offset);
  }
  return { left, top };
}

type IleWordBoxClickTarget = {
  closest?: (selector: string) => unknown;
} | EventTarget | null;

function hasClosest(target: IleWordBoxClickTarget, selector: string): boolean {
  if (!target || typeof (target as { closest?: unknown }).closest !== "function") {
    return false;
  }
  try {
    return Boolean((target as { closest: (sel: string) => unknown }).closest(selector));
  } catch {
    return false;
  }
}

/** Click-away (not a word box, not the menu) clears the bounding-box selection. */
export function ileWordBoxShouldClearSelection(input: {
  target: IleWordBoxClickTarget;
  hasSelection: boolean;
}): boolean {
  if (!input.hasSelection) return false;
  if (hasClosest(input.target, "[data-ile-word-box-menu]")) return false;
  if (hasClosest(input.target, "[data-ile-word-box]")) return false;
  return true;
}
