/**
 * TAP conversational Work canvas: one session-scoped Excalidraw board.
 * Reuses ILE scene apply / pull / PoW units — TAP does not fork Excalidraw.
 */
import {
  applyIleXaiReplyToWorkCanvas,
  applyIleXaiTurnToWorkCanvas,
  buildIleWorkCanvasAskUserMessage,
  createIleXaiLoadingPlaceholder,
  emptyIleWorkCanvasScene,
  ileWorkCanvasEmptyNearbyOrigin,
  ileWorkCanvasHasLiveElements,
  ileWorkCanvasTurnContextMessage,
  ILE_XAI_LOADING_CUSTOM_DATA_KEY,
  ILE_XAI_LOADING_TEXT,
  parseIleXaiCanvasTurn,
  replaceIleXaiLoadingPlaceholder,
  serializeIleWorkCanvasScene,
  type IleWorkCanvasElement,
  type IleWorkCanvasScene,
  type IleXaiCanvasTurnPayload,
} from "@/lib/ile-work-canvas";

export { ILE_XAI_LOADING_CUSTOM_DATA_KEY, ILE_XAI_LOADING_TEXT };
import {
  buildIleCanvasUploadItem,
  buildIleExcalidrawToolUploadItem,
} from "@/lib/ile-realtime-pow";
import {
  buildIleWorkCanvasActionUploadItem,
  buildIleWorkCanvasAskPowEvent,
  classifyIleWorkCanvasSceneDiff,
  ileWorkCanvasElementContentFingerprint,
  type IleWorkCanvasPowEvent,
} from "@/lib/ile-work-canvas-pow";
import { textToBase64 } from "@/lib/ile-proof-of-work-client";
import { TAP_SESSION_RUNTIME_PATHS } from "@/lib/tap-session-runtime";
import type { IleProofOfWorkUploadItem } from "@/lib/ile-evidence-buffer";

export {
  applyIleXaiReplyToWorkCanvas as applyTapXaiReplyToWorkCanvas,
  applyIleXaiTurnToWorkCanvas as applyTapXaiTurnToWorkCanvas,
  buildIleWorkCanvasAskUserMessage as buildTapWorkCanvasAskUserMessage,
  createIleXaiLoadingPlaceholder as createTapXaiLoadingPlaceholder,
  emptyIleWorkCanvasScene as emptyTapWorkCanvasScene,
  parseIleXaiCanvasTurn as parseTapXaiCanvasTurn,
  replaceIleXaiLoadingPlaceholder as replaceTapXaiLoadingPlaceholder,
  serializeIleWorkCanvasScene as serializeTapWorkCanvasScene,
};

export const TAP_WORK_CANVAS_BOARD_PREFIX = "tap-work-canvas";

export function tapWorkCanvasBoardId(sessionKey: string | null | undefined): string {
  const key = String(sessionKey || "session").trim() || "session";
  return `${TAP_WORK_CANVAS_BOARD_PREFIX}:${key}`;
}

/** Fancy ILE thinking chip — not a "Thinking ..." text element on the board. */
export function tapHeliosCanvasBusy(input: {
  isSending?: boolean;
  isStartingSession?: boolean;
  hasAssistantTurn?: boolean;
}): boolean {
  if (input.isSending) return true;
  return Boolean(input.isStartingSession) && !input.hasAssistantTurn;
}

/** Prompt context so Helios co-authors the session Work canvas. */
export function tapWorkCanvasTurnContextMessage(
  scene: IleWorkCanvasScene | null | undefined,
): string {
  return ileWorkCanvasTurnContextMessage(scene, { boardLabel: "SESSION" });
}

/**
 * Drop a Helios/XAI reply onto a TAP session board from empty or existing work.
 * Uses the shipped ILE apply path (text + optional extra skeletons).
 */
export function applyTapHeliosReplyToWorkCanvas(
  scene: IleWorkCanvasScene | null | undefined,
  rawReply: string | null | undefined,
  extras?: IleXaiCanvasTurnPayload["elements"],
  turnId?: string | null,
): IleWorkCanvasScene {
  const parsed = parseIleXaiCanvasTurn(rawReply);
  return applyIleXaiTurnToWorkCanvas(scene, {
    text: parsed.text,
    elements: [...(parsed.elements ?? []), ...(extras ?? [])],
    turnId: turnId ?? parsed.turnId,
    origin: parsed.origin,
  });
}

export type TapAssistantCanvasTurn = {
  id?: string | null;
  role?: string | null;
  content?: string | null;
};

/** Apply Helios assistant turns in order onto a TAP session board. */
export function applyTapAssistantTurnsToWorkCanvas(
  scene: IleWorkCanvasScene | null | undefined,
  turns: readonly TapAssistantCanvasTurn[] | null | undefined,
): IleWorkCanvasScene {
  let next = serializeIleWorkCanvasScene(scene);
  for (const turn of turns ?? []) {
    const role = String(turn.role || "assistant").toLowerCase();
    if (role && role !== "assistant") continue;
    const content = String(turn.content || "").trim();
    if (!content) continue;
    next = applyTapHeliosReplyToWorkCanvas(next, content, null, turn.id);
  }
  return next;
}

/**
 * Excalidraw fires an empty onChange on mount. Do not let that wipe Helios text.
 * A later non-empty scene (user draw or XAI apply) is always accepted.
 */
export function tapWorkCanvasShouldAcceptSceneUpdate(
  current: IleWorkCanvasScene | null | undefined,
  incoming: IleWorkCanvasScene | null | undefined,
): boolean {
  if (ileWorkCanvasHasLiveElements(incoming)) return true;
  return !ileWorkCanvasHasLiveElements(current);
}

/**
 * Place a loading placeholder then replace it with a Helios reply.
 * Drives the same create/replace helpers ILE uses.
 */
export function placeThenReplaceTapXaiLoading(
  scene: IleWorkCanvasScene | null | undefined,
  turnId: string,
  payload: IleXaiCanvasTurnPayload,
): { withLoading: IleWorkCanvasScene; replaced: IleWorkCanvasScene; loading: IleWorkCanvasElement } {
  const current = serializeIleWorkCanvasScene(scene);
  const origin = ileWorkCanvasEmptyNearbyOrigin({ elements: current.elements });
  const loading = createIleXaiLoadingPlaceholder({
    x: origin.x,
    y: origin.y,
    turnId,
  });
  const withLoading: IleWorkCanvasScene = {
    ...current,
    elements: [...current.elements, loading],
  };
  return {
    withLoading,
    loading,
    replaced: replaceIleXaiLoadingPlaceholder(withLoading, turnId, payload),
  };
}

/** Same Excalidraw-tool PoW builder ILE uses. */
export function buildTapExcalidrawToolUploadItem(
  sessionId: string,
  input: {
    activeTool?: string | null;
    elementType?: string | null;
    action?: string | null;
    timestampMs?: number;
    metadata?: Record<string, unknown>;
  },
) {
  return buildIleExcalidrawToolUploadItem(sessionId, input);
}

/** Same classified canvas-action builder ILE uses. */
export function buildTapWorkCanvasActionUploadItem(
  sessionId: string,
  event: IleWorkCanvasPowEvent | Parameters<typeof buildIleWorkCanvasActionUploadItem>[1],
  timestampMs?: number,
) {
  return buildIleWorkCanvasActionUploadItem(sessionId, event, timestampMs);
}

export {
  buildIleWorkCanvasAskPowEvent as buildTapWorkCanvasAskPowEvent,
  classifyIleWorkCanvasSceneDiff as classifyTapWorkCanvasSceneDiff,
  ileWorkCanvasElementContentFingerprint as tapWorkCanvasElementContentFingerprint,
};

/** Same canvas-snapshot PoW builder ILE uses. */
export function buildTapCanvasSnapshotUploadItem(
  sessionId: string,
  data: string,
  timestampMs = Date.now(),
) {
  return buildIleCanvasUploadItem(sessionId, data, timestampMs);
}

export function tapWorkCanvasAskUserMessage(input: {
  prompt: string;
  selectedElements?: readonly IleWorkCanvasElement[] | null;
}): string {
  return buildIleWorkCanvasAskUserMessage(input);
}

export async function uploadTapWorkCanvasPow(input: {
  workspaceId?: string;
  blockId?: string;
  sessionId?: string;
  privateToken?: string;
  tapSessionId?: string | null;
  entryQueryParams?: Record<string, string | string[]>;
  practice?: boolean;
  item: IleProofOfWorkUploadItem;
}): Promise<void> {
  const sessionKey = String(input.tapSessionId || input.sessionId || "").trim();
  if (!sessionKey) return;
  await fetch(TAP_SESSION_RUNTIME_PATHS.canvas, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      workspaceId: input.workspaceId,
      blockId: input.blockId,
      sessionId: input.sessionId,
      privateToken: input.privateToken,
      tapSessionId: input.tapSessionId,
      entryQueryParams: input.entryQueryParams,
      practice: input.practice === true ? true : undefined,
      tool_name: input.item.toolName,
      tool_action: input.item.toolAction,
      file_name: input.item.fileName,
      mime_type: input.item.mimeType,
      timestampMs: input.item.timestampMs,
      metadata: input.item.metadata,
      payload: textToBase64(input.item.payload),
    }),
  }).catch(() => {});
}


