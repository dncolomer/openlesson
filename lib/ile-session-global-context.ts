/**
 * ILE per-chapter practice context: canvas, notebook, thoughts/chat.
 * Focusing a different chapter swaps that chapter's workspace — notes from
 * chapter 1 do not appear on chapter 3.
 *
 * Live client state is bounded: unfocused chapters drop heavy payloads
 * (PNG/scene), and chat/notebook lists are capped so a long session cannot
 * unbounded-grow.
 */
import {
  createChapterWorkspace,
  type ChapterWorkspace,
} from "@/components/session/sessionViewHelpers";

export const ILE_SESSION_GLOBAL_CONTEXT_KEY = "session" as const;

/** Max chat turns kept hot per chapter. */
export const ILE_LIVE_CHAT_MAX_MESSAGES = 80;
/** Notebook text cap in live React state. */
export const ILE_LIVE_NOTEBOOK_MAX_CHARS = 80_000;
/** How many chapters keep heavy canvas PNG/scene hot (focused + this many). */
export const ILE_HOT_CHAPTER_LIMIT = 1;

export type IleSessionContext = ChapterWorkspace;

export type IleSessionContextMap = Record<string, IleSessionContext>;

export type IleSessionContextPatch =
  | Partial<IleSessionContext>
  | ((current: IleSessionContext) => Partial<IleSessionContext>);

export function createIleSessionContext(): IleSessionContext {
  return createChapterWorkspace();
}

export function ileSessionContextStorageKey(sessionId: string): string {
  return `uncertain-systems:${sessionId}:session-context`;
}

export function ileLegacyChapterWorkspacesStorageKey(sessionId: string): string {
  return `uncertain-systems:${sessionId}:chapter-workspaces`;
}

export function resolveIleChapterContextKey(
  chapterId: string | null | undefined,
): string {
  const id = typeof chapterId === "string" ? chapterId.trim() : "";
  return id || ILE_SESSION_GLOBAL_CONTEXT_KEY;
}

/**
 * React remount key for the chapter canvas. Excalidraw snapshots
 * `initialSceneData` on mount — a session-only key would keep CH1 drawings
 * on screen after focusing CH3.
 */
export function ileChapterCanvasRemountKey(
  sessionId: string | null | undefined,
  chapterId: string | null | undefined,
): string {
  const session = typeof sessionId === "string" ? sessionId.trim() : "";
  return `${session || ILE_SESSION_GLOBAL_CONTEXT_KEY}:${resolveIleChapterContextKey(chapterId)}`;
}

export function ileChapterCanvasInitialScene(
  workspace:
    | Pick<IleSessionContext, "whiteboardSceneData">
    | null
    | undefined,
): IleSessionContext["whiteboardSceneData"] {
  return workspace?.whiteboardSceneData ?? null;
}

/**
 * Keep heavy canvas PNG/scene in the cold map when live state evicts them.
 * Writes that omit those fields must not wipe a stored drawing.
 */
export function persistIleChapterColdWorkspace(
  cold: IleSessionContextMap,
  chapterId: string | null | undefined,
  written: IleSessionContext | undefined,
): IleSessionContextMap {
  const key = resolveIleChapterContextKey(chapterId);
  if (!written) return cold;
  const prevCold = cold[key];
  return {
    ...cold,
    [key]: {
      ...written,
      whiteboardData: written.whiteboardData ?? prevCold?.whiteboardData ?? null,
      whiteboardSceneData:
        written.whiteboardSceneData ?? prevCold?.whiteboardSceneData ?? null,
    },
  };
}

/**
 * Restore evicted canvas PNG/scene from cold onto the focused chapter.
 * Must run during render (not in an effect) so Excalidraw's mount snapshot
 * sees the drawing when ileChapterCanvasRemountKey changes.
 */
export function restoreIleChapterHeavyPayload(
  liveRow: IleSessionContext | undefined,
  coldRow: IleSessionContext | undefined,
): IleSessionContext {
  if (!liveRow && !coldRow) return createIleSessionContext();
  if (!coldRow) return capIleLiveWorkspace(liveRow!);
  if (!liveRow) return capIleLiveWorkspace(coldRow);
  return capIleLiveWorkspace({
    ...coldRow,
    ...liveRow,
    whiteboardData: liveRow.whiteboardData ?? coldRow.whiteboardData ?? null,
    whiteboardSceneData:
      liveRow.whiteboardSceneData ?? coldRow.whiteboardSceneData ?? null,
  });
}

export function hydrateIleFocusedChapterLiveState(
  live: IleSessionContextMap,
  cold: IleSessionContextMap | null | undefined,
  focusedChapterId: string | null | undefined,
): IleSessionContextMap {
  const key = resolveIleChapterContextKey(focusedChapterId);
  const focused = restoreIleChapterHeavyPayload(live[key], cold?.[key]);
  return boundIleSessionLiveState({ ...live, [key]: focused }, key);
}

/** Focused chapter workspace with cold canvas restored on this render. */
export function readIleFocusedChapterWorkspace(
  live: IleSessionContextMap,
  cold: IleSessionContextMap | null | undefined,
  focusedChapterId?: string | null,
): IleSessionContext {
  const hydrated = hydrateIleFocusedChapterLiveState(live, cold, focusedChapterId);
  return readIleSessionContext(hydrated, focusedChapterId);
}

export function capIleLiveList<T>(items: readonly T[], max: number): T[] {
  const limit = Math.max(1, Math.floor(max));
  if (items.length <= limit) return items.slice();
  return items.slice(-limit);
}

export function capIleLiveWorkspace(workspace: IleSessionContext): IleSessionContext {
  const chat = Array.isArray(workspace.chatMessages) ? workspace.chatMessages : [];
  const notebook =
    typeof workspace.notebookContent === "string" ? workspace.notebookContent : "";
  return {
    ...workspace,
    chatMessages: capIleLiveList(chat, ILE_LIVE_CHAT_MAX_MESSAGES),
    notebookContent:
      notebook.length > ILE_LIVE_NOTEBOOK_MAX_CHARS
        ? notebook.slice(-ILE_LIVE_NOTEBOOK_MAX_CHARS)
        : notebook,
  };
}

/** Drop PNG + Excalidraw scene so unfocused chapters are not kept hot. */
export function evictIleChapterHeavyPayload(workspace: IleSessionContext): IleSessionContext {
  return {
    ...capIleLiveWorkspace(workspace),
    whiteboardData: null,
    whiteboardSceneData: null,
  };
}

export function boundIleSessionLiveState(
  map: IleSessionContextMap,
  focusedChapterId: string | null | undefined,
): IleSessionContextMap {
  const focused = resolveIleChapterContextKey(focusedChapterId);
  const next: IleSessionContextMap = {};
  let hotKept = 0;
  for (const [id, workspace] of Object.entries(map)) {
    if (!workspace) continue;
    const keepHot = id === focused && hotKept < ILE_HOT_CHAPTER_LIMIT;
    if (keepHot) {
      next[id] = capIleLiveWorkspace(workspace);
      hotKept += 1;
    } else {
      next[id] = evictIleChapterHeavyPayload(workspace);
    }
  }
  return next;
}

function normalizeWorkspace(row: Partial<IleSessionContext> | undefined): IleSessionContext {
  const base = createIleSessionContext();
  if (!row || typeof row !== "object") return base;
  return capIleLiveWorkspace({
    ...base,
    ...row,
    chatMessages: Array.isArray(row.chatMessages) ? row.chatMessages : [],
    notebookContent: typeof row.notebookContent === "string" ? row.notebookContent : "",
    pendingChatMessage:
      row.pendingChatMessage === undefined ? base.pendingChatMessage : row.pendingChatMessage,
  });
}

export function applyIleSessionContextWrite(
  current: IleSessionContextMap,
  focusedChapterId: string | null | undefined,
  update: IleSessionContextPatch,
): IleSessionContextMap {
  const key = resolveIleChapterContextKey(focusedChapterId);
  const existing = current[key] ?? createIleSessionContext();
  const patch = typeof update === "function" ? update(existing) : update;
  const written = capIleLiveWorkspace({ ...existing, ...patch });
  return boundIleSessionLiveState({ ...current, [key]: written }, key);
}

/** Artifacts for the focused chapter only. */
export function readIleSessionContext(
  context: IleSessionContextMap,
  focusedChapterId?: string | null,
): IleSessionContext {
  const key = resolveIleChapterContextKey(focusedChapterId);
  return context[key] ?? createIleSessionContext();
}

export function mergeLegacyIleChapterWorkspaces(
  byChapter: Record<string, Partial<IleSessionContext> | undefined> | null | undefined,
): IleSessionContextMap {
  const out: IleSessionContextMap = {};
  if (!byChapter || typeof byChapter !== "object") return out;
  for (const [id, value] of Object.entries(byChapter)) {
    const key = resolveIleChapterContextKey(id);
    if (!value || typeof value !== "object") continue;
    out[key] = normalizeWorkspace(value);
  }
  return out;
}

function isSingleWorkspaceShape(parsed: object): parsed is Partial<IleSessionContext> {
  return (
    Array.isArray((parsed as IleSessionContext).chatMessages) ||
    "notebookContent" in parsed ||
    "whiteboardData" in parsed
  );
}

function looksLikeChapterMap(parsed: object): boolean {
  const values = Object.values(parsed as Record<string, unknown>);
  if (values.length === 0) return false;
  return values.every(
    (value) =>
      value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      (Array.isArray((value as IleSessionContext).chatMessages) ||
        "notebookContent" in (value as object) ||
        "whiteboardData" in (value as object) ||
        "whiteboardSceneData" in (value as object)),
  );
}

export function parseIleSessionContextStored(
  raw: string | null | undefined,
): IleSessionContextMap | null {
  if (typeof raw !== "string" || !raw.trim()) return null;
  try {
    const parsed = JSON.parse(raw) as
      | Partial<IleSessionContext>
      | Record<string, Partial<IleSessionContext>>;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    if (looksLikeChapterMap(parsed) && !isSingleWorkspaceShape(parsed)) {
      return mergeLegacyIleChapterWorkspaces(parsed as Record<string, Partial<IleSessionContext>>);
    }
    if (isSingleWorkspaceShape(parsed)) {
      return {
        [ILE_SESSION_GLOBAL_CONTEXT_KEY]: normalizeWorkspace(parsed as Partial<IleSessionContext>),
      };
    }
    return mergeLegacyIleChapterWorkspaces(parsed as Record<string, Partial<IleSessionContext>>);
  } catch {
    return null;
  }
}

/** Tiny store used by tests and as the hook's write algebra. */
export function createIleSessionContextStore(initial?: IleSessionContextMap) {
  let live: IleSessionContextMap = initial ?? {};
  let cold: IleSessionContextMap = initial ? { ...initial } : {};
  let focusedChapterId: string | null = null;
  return {
    focus(chapterId: string | null) {
      focusedChapterId = chapterId;
      live = boundIleSessionLiveState(live, chapterId);
      return live;
    },
    write(chapterId: string | null | undefined, update: IleSessionContextPatch) {
      focusedChapterId = chapterId ?? focusedChapterId;
      live = applyIleSessionContextWrite(live, chapterId, update);
      const key = resolveIleChapterContextKey(chapterId ?? focusedChapterId);
      cold = persistIleChapterColdWorkspace(cold, key, live[key]);
      return live;
    },
    read(chapterId?: string | null) {
      return readIleFocusedChapterWorkspace(
        live,
        cold,
        chapterId ?? focusedChapterId,
      );
    },
    readLive(chapterId?: string | null) {
      return readIleSessionContext(live, chapterId ?? focusedChapterId);
    },
    get focusedChapterId() {
      return focusedChapterId;
    },
    get map() {
      return live;
    },
    get cold() {
      return cold;
    },
  };
}
