/**
 * ILE session-global practice context: canvas, notebook, thoughts/chat.
 * Focusing a different chapter does not swap an isolated workspace.
 */
import type { ChatMessage, PendingChatMessage } from "@/components/HeliosChat";
import {
  createChapterWorkspace,
  type ChapterWorkspace,
} from "@/components/session/sessionViewHelpers";

export const ILE_SESSION_GLOBAL_CONTEXT_KEY = "session" as const;

export type IleSessionContext = ChapterWorkspace;

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

export function applyIleSessionContextWrite(
  current: IleSessionContext,
  _focusedChapterId: string | null | undefined,
  update: IleSessionContextPatch,
): IleSessionContext {
  const patch = typeof update === "function" ? update(current) : update;
  return { ...current, ...patch };
}

/** Same artifacts regardless of which chapter is focused. */
export function readIleSessionContext(
  context: IleSessionContext,
  _focusedChapterId?: string | null,
): IleSessionContext {
  return context;
}

export function mergeLegacyIleChapterWorkspaces(
  byChapter: Record<string, Partial<IleSessionContext> | undefined> | null | undefined,
): IleSessionContext {
  const base = createIleSessionContext();
  if (!byChapter || typeof byChapter !== "object") return base;
  const chat: ChatMessage[] = [];
  let pendingChatMessage: string | PendingChatMessage | null = base.pendingChatMessage;
  let whiteboardData = base.whiteboardData;
  let whiteboardSceneData = base.whiteboardSceneData;
  let notebookContent = base.notebookContent;
  let canvasDirtyForHelios = base.canvasDirtyForHelios;
  let notebookDirtyForHelios = base.notebookDirtyForHelios;
  for (const value of Object.values(byChapter)) {
    if (!value || typeof value !== "object") continue;
    if (Array.isArray(value.chatMessages) && value.chatMessages.length) {
      chat.push(...value.chatMessages);
    }
    if (value.pendingChatMessage != null) pendingChatMessage = value.pendingChatMessage;
    if (typeof value.whiteboardData === "string" && value.whiteboardData) {
      whiteboardData = value.whiteboardData;
    }
    if (value.whiteboardSceneData) whiteboardSceneData = value.whiteboardSceneData;
    if (typeof value.notebookContent === "string" && value.notebookContent) {
      notebookContent = value.notebookContent;
    }
    if (typeof value.canvasDirtyForHelios === "boolean") {
      canvasDirtyForHelios = value.canvasDirtyForHelios;
    }
    if (typeof value.notebookDirtyForHelios === "boolean") {
      notebookDirtyForHelios = value.notebookDirtyForHelios;
    }
  }
  return {
    chatMessages: chat,
    pendingChatMessage,
    whiteboardData,
    whiteboardSceneData,
    notebookContent,
    canvasDirtyForHelios,
    notebookDirtyForHelios,
  };
}

export function parseIleSessionContextStored(
  raw: string | null | undefined,
): IleSessionContext | null {
  if (typeof raw !== "string" || !raw.trim()) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<IleSessionContext> | Record<string, Partial<IleSessionContext>>;
    if (!parsed || typeof parsed !== "object") return null;
    if (Array.isArray((parsed as IleSessionContext).chatMessages) || "notebookContent" in parsed) {
      const row = parsed as Partial<IleSessionContext>;
      return {
        ...createIleSessionContext(),
        ...row,
        chatMessages: Array.isArray(row.chatMessages) ? row.chatMessages : [],
        notebookContent: typeof row.notebookContent === "string" ? row.notebookContent : "",
      };
    }
    return mergeLegacyIleChapterWorkspaces(parsed as Record<string, Partial<IleSessionContext>>);
  } catch {
    return null;
  }
}

/** Tiny store used by tests and as the hook's write algebra. */
export function createIleSessionContextStore(initial?: IleSessionContext) {
  let state = initial ?? createIleSessionContext();
  let focusedChapterId: string | null = null;
  return {
    focus(chapterId: string | null) {
      focusedChapterId = chapterId;
      return state;
    },
    write(chapterId: string | null | undefined, update: IleSessionContextPatch) {
      focusedChapterId = chapterId ?? focusedChapterId;
      state = applyIleSessionContextWrite(state, chapterId, update);
      return state;
    },
    read(chapterId?: string | null) {
      return readIleSessionContext(state, chapterId ?? focusedChapterId);
    },
    get focusedChapterId() {
      return focusedChapterId;
    },
  };
}
