/**
 * TAP Learning session context: one topic, one canvas, one notebook.
 * A second chapter id reads and writes that same scene. It does not open,
 * swap, or restore another board. Stored rows for other chapters are not
 * merged into the live scene.
 *
 * Live client state is bounded: chat and notebook lists are capped so a long
 * session cannot unbounded-grow.
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

/** Fallback id used before a plan step exists, for example `step-0`. */
export function isIlePrePlanChapterId(chapterId: string | null | undefined): boolean {
  return /^step-\d+$/.test(String(chapterId ?? "").trim());
}

/**
 * React remount key for the one session canvas. The chapter id is ignored so
 * focusing another chapter does not mount a second board.
 */
export function ileChapterCanvasRemountKey(
  sessionId: string | null | undefined,
  _chapterId?: string | null,
): string {
  const session = typeof sessionId === "string" ? sessionId.trim() : "";
  return `${session || ILE_SESSION_GLOBAL_CONTEXT_KEY}:${ILE_SESSION_GLOBAL_CONTEXT_KEY}`;
}

/**
 * Copy one stored chapter onto the session canvas. Does not merge other
 * chapters' drawings. Returns null when the current chapter is not in a
 * multi-chapter snapshot yet, so a placeholder id cannot blank the map.
 */
export function adoptIleSingleLiveCanvas(
  live: IleSessionContextMap,
  cold: IleSessionContextMap | null | undefined,
  chapterId: string | null | undefined,
): IleSessionContextMap | null {
  const sessionKey = ILE_SESSION_GLOBAL_CONTEXT_KEY;
  if (live[sessionKey] || cold?.[sessionKey]) {
    return {
      [sessionKey]: restoreIleChapterHeavyPayload(live[sessionKey], cold?.[sessionKey]),
    };
  }
  const legacyKey = resolveIleChapterContextKey(chapterId);
  const placeholder = isIlePrePlanChapterId(legacyKey);
  const keys = [
    ...new Set([...Object.keys(live), ...Object.keys(cold ?? {})]),
  ].filter((key) => key !== sessionKey);
  const realKeys = keys.filter((key) => !isIlePrePlanChapterId(key));
  if (!placeholder && legacyKey !== sessionKey && (live[legacyKey] || cold?.[legacyKey])) {
    return {
      [sessionKey]: restoreIleChapterHeavyPayload(live[legacyKey], cold?.[legacyKey]),
    };
  }
  // step-N must not publish an empty row over several stored chapters.
  if (placeholder && realKeys.length > 1) return null;
  if (realKeys.length === 1) {
    const only = realKeys[0]!;
    return {
      [sessionKey]: restoreIleChapterHeavyPayload(live[only], cold?.[only]),
    };
  }
  if (realKeys.length > 1) return null;
  if (keys.length === 1) {
    const only = keys[0]!;
    return {
      [sessionKey]: restoreIleChapterHeavyPayload(live[only], cold?.[only]),
    };
  }
  return null;
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
  const sessionKey = ILE_SESSION_GLOBAL_CONTEXT_KEY;
  if (live[sessionKey] || cold?.[sessionKey]) {
    return {
      [sessionKey]: restoreIleChapterHeavyPayload(live[sessionKey], cold?.[sessionKey]),
    };
  }
  const key = resolveIleChapterContextKey(focusedChapterId);
  if (!live[key] && !cold?.[key]) return live;
  const focused = restoreIleChapterHeavyPayload(live[key], cold?.[key]);
  return boundIleSessionLiveState({ ...live, [key]: focused }, key);
}

/**
 * Every chapter id reads this one workspace. A second id is the same object,
 * so a lookup cannot come back as a missing row.
 */
export function ileSingleCanvasChapterWorkspaces<T extends object>(
  workspace: T,
): Record<string, T> {
  return new Proxy({} as Record<string, T>, {
    get(_target, prop) {
      if (typeof prop !== "string") return undefined;
      return workspace;
    },
    has(_target, prop) {
      return typeof prop === "string";
    },
    ownKeys() {
      return [ILE_SESSION_GLOBAL_CONTEXT_KEY];
    },
    getOwnPropertyDescriptor(_target, prop) {
      if (prop !== ILE_SESSION_GLOBAL_CONTEXT_KEY) return undefined;
      return {
        configurable: true,
        enumerable: true,
        writable: false,
        value: workspace,
      };
    },
  });
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
  const sessionKey = ILE_SESSION_GLOBAL_CONTEXT_KEY;
  if (map[sessionKey]) {
    return { [sessionKey]: capIleLiveWorkspace(map[sessionKey]) };
  }
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

function legacyChapterIds(current: IleSessionContextMap): string[] {
  const key = ILE_SESSION_GLOBAL_CONTEXT_KEY;
  return Object.keys(current).filter((id) => id !== key && current[id]);
}

function writeIleSessionRow(
  existing: IleSessionContext,
  update: IleSessionContextPatch,
): IleSessionContextMap {
  const key = ILE_SESSION_GLOBAL_CONTEXT_KEY;
  const patch = typeof update === "function" ? update(existing) : update;
  const written = capIleLiveWorkspace({ ...existing, ...patch });
  return boundIleSessionLiveState({ [key]: written }, key);
}

export function applyIleSessionContextWrite(
  current: IleSessionContextMap,
  focusedChapterId: string | null | undefined,
  update: IleSessionContextPatch,
): IleSessionContextMap {
  const key = ILE_SESSION_GLOBAL_CONTEXT_KEY;
  if (current[key]) return writeIleSessionRow(current[key], update);
  const legacyKey = resolveIleChapterContextKey(focusedChapterId);
  const placeholder = isIlePrePlanChapterId(legacyKey);
  const stored = legacyChapterIds(current);
  const realIds = stored.filter((id) => !isIlePrePlanChapterId(id));
  // A pre-plan id such as step-0 must not publish an empty session over a
  // multi-chapter snapshot, even when that placeholder row is already present.
  if (placeholder && realIds.length > 1) return current;
  if (!placeholder && legacyKey !== key && current[legacyKey]) {
    return writeIleSessionRow(current[legacyKey], update);
  }
  if (realIds.length > 1) return current;
  if (realIds.length === 1) return writeIleSessionRow(current[realIds[0]!]!, update);
  if (stored.length === 1) return writeIleSessionRow(current[stored[0]!]!, update);
  if (stored.length > 1) return current;
  return writeIleSessionRow(createIleSessionContext(), update);
}

/** The one live workspace. A second chapter id does not select another row. */
export function readIleSessionContext(
  context: IleSessionContextMap,
  focusedChapterId?: string | null,
): IleSessionContext {
  const sessionKey = ILE_SESSION_GLOBAL_CONTEXT_KEY;
  if (context[sessionKey]) return context[sessionKey];
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

  function pin(chapterId: string | null | undefined) {
    if (live[ILE_SESSION_GLOBAL_CONTEXT_KEY] || cold[ILE_SESSION_GLOBAL_CONTEXT_KEY]) {
      const adopted = adoptIleSingleLiveCanvas(live, cold, chapterId);
      if (adopted) {
        live = adopted;
        cold = { ...adopted };
      }
      return;
    }
    const adopted = adoptIleSingleLiveCanvas(live, cold, chapterId);
    if (!adopted) return;
    live = adopted;
    cold = { ...adopted };
  }

  return {
    focus(chapterId: string | null) {
      focusedChapterId = chapterId;
      pin(chapterId);
      live = boundIleSessionLiveState(live, ILE_SESSION_GLOBAL_CONTEXT_KEY);
      return live;
    },
    write(chapterId: string | null | undefined, update: IleSessionContextPatch) {
      focusedChapterId = chapterId ?? focusedChapterId;
      pin(chapterId);
      const next = applyIleSessionContextWrite(live, chapterId, update);
      const key = ILE_SESSION_GLOBAL_CONTEXT_KEY;
      if (!next[key]) {
        live = next;
        return live;
      }
      live = next;
      cold = persistIleChapterColdWorkspace({ [key]: cold[key] }, key, live[key]);
      return live;
    },
    read(chapterId?: string | null) {
      const id = chapterId ?? focusedChapterId;
      pin(id);
      return readIleFocusedChapterWorkspace(live, cold, ILE_SESSION_GLOBAL_CONTEXT_KEY);
    },
    readLive(chapterId?: string | null) {
      const id = chapterId ?? focusedChapterId;
      pin(id);
      return readIleSessionContext(live, ILE_SESSION_GLOBAL_CONTEXT_KEY);
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
