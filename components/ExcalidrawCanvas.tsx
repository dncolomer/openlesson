"use client";

import dynamic from "next/dynamic";
import {
  Component,
  memo,
  useRef,
  useCallback,
  useState,
  useEffect,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { useI18n } from "@/lib/i18n";
import { bindIleSurfaceEditorEvents } from "@/lib/ile-compact-window";
import {
  ILE_HELIOS_THINKING_ROTATE_MS,
  ileHeliosThinkingLine,
} from "@/lib/ile-dialogue-turn";
import {
  clampIleLearnMorePosition,
  ILE_CANVAS_PROMPT_BAR_FALLBACK_TOP,
  ILE_CANVAS_PROMPT_BAR_TOOLBAR_SELECTOR,
  ILE_LEARN_MORE_BOX_WIDTH,
  ILE_LEARN_MORE_LABEL,
  ileCanvasPromptBarTop,
  ileLearnMoreFollowOffset,
  ileLearnMoreFollowPosition,
  ileLearnMorePromptPlacement,
  ileLearnMoreSelectionKey,
  ileWorkCanvasSelectionHostRect,
  ileWorkCanvasEmptyNearbyOriginWithReserved,
  ileWorkCanvasFiniteOrigin,
  ileWorkCanvasHasLiveElements,
  ileWorkCanvasPointerBusy,
  ileWorkCanvasSceneToViewport,
  ileWorkCanvasThinkingOverlayStyle,
  ileWorkCanvasViewportToHost,
  ileWorkCanvasWithScrollToContent,
  ileWorkCanvasZoomValue,
  mergeIleXaiTurnOntoLiveWorkCanvas,
  serializeIleWorkCanvasScene,
  withIleWorkCanvasGridAppState,
  ILE_WORK_CANVAS_SCROLL_TO_CONTENT_OPTS,
  ILE_XAI_LOADING_BOX_HEIGHT,
  ILE_XAI_LOADING_BOX_WIDTH,
  type IleWorkCanvasElement,
  type IleWorkCanvasScene,
  type IleWorkCanvasSkeleton,
} from "@/lib/ile-work-canvas";
import {
  countIleWorkCanvasRoomPeers,
  ileWorkCanvasPeerLabel,
  ileWorkCanvasSceneFingerprint,
  nextIleWorkCanvasRoomNonce,
  publishIleWorkCanvasRoom,
  subscribeIleWorkCanvasRoom,
  type IleWorkCanvasPeerId,
} from "@/lib/ile-work-canvas-room";

// Excalidraw CSS - required for proper rendering
import "@excalidraw/excalidraw/index.css";
import "@/app/ile-excalidraw-theme.css";

// Dynamic import for Next.js SSR compatibility
const Excalidraw = dynamic(
  async () => (await import("@excalidraw/excalidraw")).Excalidraw,
  { ssr: false }
);

type ExcalidrawAPIRef = any;

const ILE_EXCALIDRAW_UI_OPTIONS = {
  canvasActions: {
    loadScene: false,
    export: false as false,
    saveAsImage: false,
    saveToActiveFile: false,
    toggleTheme: false,
  },
};

const IleExcalidrawMount = memo(function IleExcalidrawMount({
  onApi,
  onChange,
  onPointerUpdate,
  initialData,
  isCollaborating,
}: {
  onApi: (api: ExcalidrawAPIRef) => void;
  onChange: (
    elements: readonly any[],
    appState: any,
    files: any,
  ) => void;
  onPointerUpdate?: (payload: {
    pointer: { x: number; y: number; tool: "pointer" | "laser" };
    button: "up" | "down";
    pointersMap: Map<number, unknown>;
  }) => void;
  initialData: { elements: any[]; appState: any; files: any; scrollToContent?: boolean };
  isCollaborating?: boolean;
}) {
  return (
    <Excalidraw
      excalidrawAPI={onApi}
      onChange={onChange}
      onPointerUpdate={onPointerUpdate}
      initialData={initialData}
      theme="dark"
      isCollaborating={isCollaborating}
      viewModeEnabled={false}
      UIOptions={ILE_EXCALIDRAW_UI_OPTIONS}
    />
  );
});

class IleExcalidrawErrorBoundary extends Component<{ children: ReactNode }, { crashed: boolean }> {
  state = { crashed: false };
  static getDerivedStateFromError() {
    return { crashed: true };
  }
  componentDidCatch(error: unknown) {
    console.error("[ExcalidrawCanvas] crashed:", error);
  }
  render() {
    if (this.state.crashed) {
      return (
        <div
          data-ile-excalidraw-crash
          className="flex h-full items-center justify-center bg-[#0a0a0a] px-4 text-center font-mono text-[11px] uppercase tracking-wider text-neutral-400"
        >
          Canvas failed in this window. Keep drawing in the other view.
        </div>
      );
    }
    return this.props.children;
  }
}

export interface ExcalidrawCanvasProps {
  initialData?: string;
   
  initialSceneData?: { elements: any[]; appState: any; files: any } | null;
  onCanvasChange?: (data: string) => void;
   
  onSceneChange?: (data: { elements: any[]; appState: any; files: any }) => void;
  onSubmitToHelios?: (dataUrl?: string | null) => Promise<void> | void;
  canSubmitToHelios?: boolean;
  /** Override default "I'm Done Drawing" label (e.g. Project Mode "To solution"). */
  submitLabel?: string;
  /** When nonce changes, merge these elements onto the live board via updateScene. */
  applyElements?: readonly unknown[] | null;
  applyElementsNonce?: string | number | null;
  /** Ids to drop before merging applyElements (loading-placeholder replace). */
  applyRemoveElementIds?: readonly string[] | null;
  onExcalidrawTool?: (input: { activeTool?: string | null; elementType?: string | null }) => void;
  onAskSelected?: (input: {
    prompt: string;
    selectedElements: IleWorkCanvasElement[];
    scene: IleWorkCanvasScene;
  }) => Promise<{
    text: string;
    elements?: IleWorkCanvasSkeleton[] | null;
    origin?: { x?: number; y?: number } | null;
  }>;
  /** Shared board id so session Work and PiP act as two collaborators. */
  boardId?: string | null;
  peerId?: IleWorkCanvasPeerId;
  /** Helios/XAI in-flight (TAP wait, ILE send) — same overlay chip as ask-about-selection. */
  heliosBusy?: boolean;
}

// Excalidraw's appState contains runtime-only fields like collaborators
// (a Map) that do not survive JSON storage. Persist only restorable state.
 
function sanitizeSceneData(scene: { elements: any[]; appState: any; files: any } | null | undefined) {
  if (!scene) {
    return {
      elements: [],
      appState: withIleWorkCanvasGridAppState({}),
      files: {},
    };
  }
  const { collaborators: _collaborators, ...appState } = scene.appState ?? {};
  return {
    elements: scene.elements ?? [],
    appState: withIleWorkCanvasGridAppState(appState),
    files: scene.files ?? {},
  };
}

/**
 * Shared ILE + TAP Work board. Hosts must not fork this — both surfaces
 * mount `WorkCanvas` so Expand More, the board prompt, thinking overlay,
 * XAI apply, and center-on-open stay one implementation.
 */
export function ExcalidrawCanvas({
  initialData,
  initialSceneData,
  onCanvasChange,
  onSceneChange,
  onSubmitToHelios,
  canSubmitToHelios = true,
  submitLabel,
  applyElements = null,
  applyElementsNonce = null,
  applyRemoveElementIds = null,
  onExcalidrawTool,
  onAskSelected,
  boardId = null,
  peerId = "work",
  heliosBusy = false,
}: ExcalidrawCanvasProps) {
  const { t } = useI18n();
  const submitButtonLabel = submitLabel || t("whiteboard.submitToHelios");
  const excalidrawAPIRef = useRef<ExcalidrawAPIRef>(null);
  const canvasHostRef = useRef<HTMLDivElement>(null);
  const [isSubmittingToHelios, setIsSubmittingToHelios] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [askPrompt, setAskPrompt] = useState("");
  const [boardPrompt, setBoardPrompt] = useState("");
  const [askInFlight, setAskInFlight] = useState(0);
  const [learnMoreUi, setLearnMoreUi] = useState<{
    count: number;
    left: number;
    top: number;
  } | null>(null);
  const [learnMoreDragging, setLearnMoreDragging] = useState(false);
  const [promptBarTop, setPromptBarTop] = useState(ILE_CANVAS_PROMPT_BAR_FALLBACK_TOP);
  const [thinkingTick, setThinkingTick] = useState(0);
  const [thinkingChips, setThinkingChips] = useState<
    Array<{ turnId: string; x: number; y: number; left: number; top: number; zoom: number }>
  >([]);
  const onAskSelectedRef = useRef(onAskSelected);
  const askInFlightRef = useRef(0);
  const askSeqRef = useRef(0);
  const applyChainRef = useRef(Promise.resolve());
  const thinkingChipsRef = useRef(thinkingChips);
  const thinkingHostByIdRef = useRef(new Map<string, HTMLDivElement>());
  const learnMoreUiRef = useRef(learnMoreUi);
  const learnMoreKeyRef = useRef("");
  const learnMoreHostRef = useRef<HTMLFormElement>(null);
  const learnMorePinnedRef = useRef<{
    key: string;
    left: number;
    top: number;
    dx?: number;
    dy?: number;
  } | null>(null);
  const learnMoreDragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    origLeft: number;
    origTop: number;
  } | null>(null);
  
  // Store the latest scene data for PNG export
   
  const sceneDataRef = useRef<{ elements: any[]; appState: any; files: any } | null>(null);
  const initialSceneDataRef = useRef(
    ileWorkCanvasWithScrollToContent(sanitizeSceneData(initialSceneData)),
  );
  const onSceneChangeRef = useRef(onSceneChange);
  const onExcalidrawToolRef = useRef(onExcalidrawTool);
  const lastApplyNonceRef = useRef<string | number | null>(null);
  const pendingApplyRef = useRef<{
    nonce: string | number;
    elements: readonly unknown[];
    removeIds: readonly string[];
  } | null>(null);
  const exportTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const scenePersistTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isExportingRef = useRef(false);
  const lastPersistedSceneJsonRef = useRef("");
  const applyingRemoteRef = useRef(false);
  const sceneFingerprintRef = useRef("");
  const remoteNonceRef = useRef(0);
  const [collaborating, setCollaborating] = useState(false);
  const centeredOnOpenRef = useRef(false);
  const centerRafRef = useRef(0);
  const centerTriesRef = useRef(0);

  const scheduleCenterOnOpen = useCallback(() => {
    if (centeredOnOpenRef.current) return;
    if (centerRafRef.current) cancelAnimationFrame(centerRafRef.current);
    const run = () => {
      centerRafRef.current = 0;
      const api = excalidrawAPIRef.current;
      if (!api || typeof api.scrollToContent !== "function") return;
      const elements = (api.getSceneElements?.() ?? []).filter(
        (el: { isDeleted?: boolean }) => !el.isDeleted,
      );
      if (!elements.length) return;
      if (typeof api.refresh === "function") {
        try {
          api.refresh();
        } catch {
          /* layout may not be ready */
        }
      }
      const appState = api.getAppState?.() ?? {};
      const width = Number(appState.width);
      const height = Number(appState.height);
      if (!Number.isFinite(width) || width <= 0 || !Number.isFinite(height) || height <= 0) {
        if (centerTriesRef.current < 24) {
          centerTriesRef.current += 1;
          centerRafRef.current = requestAnimationFrame(run);
        }
        return;
      }
      centeredOnOpenRef.current = true;
      api.scrollToContent(elements, ILE_WORK_CANVAS_SCROLL_TO_CONTENT_OPTS);
    };
    centerRafRef.current = requestAnimationFrame(() => {
      centerRafRef.current = requestAnimationFrame(run);
    });
  }, []);

  const flushPendingApply = useCallback(() => {
    const api = excalidrawAPIRef.current;
    const pending = pendingApplyRef.current;
    if (!api) return;
    const initial = initialSceneDataRef.current;
    const live = (api.getSceneElements?.() ?? []) as { id?: string; isDeleted?: boolean }[];
    const liveCount = live.filter((el) => !el.isDeleted).length;
    if (liveCount === 0 && ileWorkCanvasHasLiveElements(initial as IleWorkCanvasScene)) {
      applyingRemoteRef.current = true;
      try {
        api.updateScene({ elements: initial.elements });
      } finally {
        applyingRemoteRef.current = false;
      }
    }
    if (!pending || pending.nonce === lastApplyNonceRef.current) {
      pendingApplyRef.current = null;
      scheduleCenterOnOpen();
      return;
    }
    lastApplyNonceRef.current = pending.nonce;
    pendingApplyRef.current = null;
    const incoming = (pending.elements ?? []) as any[];
    const removeIds = new Set(pending.removeIds ?? []);
    const existing = (api.getSceneElements?.() ?? []).filter(
      (el: { id?: string }) => !el?.id || !removeIds.has(el.id),
    );
    const existingIds = new Set(existing.map((el: { id?: string }) => el.id));
    const toAdd = incoming.filter((el) => el && typeof el === "object" && !existingIds.has(el.id));
    if (!toAdd.length && !removeIds.size) {
      scheduleCenterOnOpen();
      return;
    }
    applyingRemoteRef.current = true;
    try {
      api.updateScene({ elements: [...existing, ...toAdd] });
    } finally {
      applyingRemoteRef.current = false;
    }
    scheduleCenterOnOpen();
  }, [scheduleCenterOnOpen]);

  const syncPromptBarPlacement = useCallback(() => {
    const host = canvasHostRef.current;
    if (!host) return;
    const toolbar = host.querySelector(ILE_CANVAS_PROMPT_BAR_TOOLBAR_SELECTOR);
    const hostRect = host.getBoundingClientRect();
    const toolbarRect = toolbar?.getBoundingClientRect();
    const top = ileCanvasPromptBarTop(
      toolbarRect ? { bottom: toolbarRect.bottom } : null,
      { top: hostRect.top },
    );
    setPromptBarTop((prev) => (prev === top ? prev : top));
  }, []);

  const setExcalidrawAPI = useCallback((api: ExcalidrawAPIRef) => {
    excalidrawAPIRef.current = api;
    flushPendingApply();
    requestAnimationFrame(() => {
      syncPromptBarPlacement();
    });
  }, [flushPendingApply, syncPromptBarPlacement]);

  useEffect(() => {
    onSceneChangeRef.current = onSceneChange;
  }, [onSceneChange]);

  useEffect(() => {
    onExcalidrawToolRef.current = onExcalidrawTool;
  }, [onExcalidrawTool]);

  useEffect(() => {
    onAskSelectedRef.current = onAskSelected;
  }, [onAskSelected]);

  useEffect(() => {
    const id = String(boardId || "").trim();
    if (!id) return;
    const unsub = subscribeIleWorkCanvasRoom(id, peerId, (message) => {
      if (message.from === peerId) return;
      const api = excalidrawAPIRef.current;
      if (!api) return;
      if (message.kind === "scene") {
        if (message.nonce <= remoteNonceRef.current) return;
        remoteNonceRef.current = message.nonce;
        const fingerprint = ileWorkCanvasSceneFingerprint(message.elements, message.files);
        if (fingerprint && fingerprint === sceneFingerprintRef.current) return;
        applyingRemoteRef.current = true;
        sceneFingerprintRef.current = fingerprint;
        try {
          api.updateScene({
            elements: message.elements,
            appState: {},
            captureUpdate: "NEVER",
          });
          if (message.files && typeof api.addFiles === "function") {
            api.addFiles(Object.values(message.files));
          }
        } catch (err) {
          console.error("[ExcalidrawCanvas] room apply failed:", err);
        } finally {
          applyingRemoteRef.current = false;
        }
        scheduleCenterOnOpen();
        return;
      }
      const others = new Map();
      if (message.pointer) {
        others.set(message.from, {
          id: message.from,
          username: ileWorkCanvasPeerLabel(message.from),
          pointer: {
            x: message.pointer.x,
            y: message.pointer.y,
            tool: message.pointer.tool || "pointer",
          },
          button: message.button || "up",
          selectedElementIds: message.selectedElementIds,
          color: { background: "#e5e5e5", stroke: "#111111" },
        });
      }
      try {
        api.updateScene({
          appState: { collaborators: others },
          captureUpdate: "NEVER",
        });
      } catch {
        /* peer scene not ready */
      }
    });
    setCollaborating(countIleWorkCanvasRoomPeers(id) > 1);
    const syncPeers = window.setInterval(() => {
      setCollaborating(countIleWorkCanvasRoomPeers(id) > 1);
    }, 800);
    return () => {
      window.clearInterval(syncPeers);
      unsub();
      setCollaborating(false);
    };
  }, [boardId, peerId, scheduleCenterOnOpen]);

  useEffect(() => {
    askInFlightRef.current = askInFlight;
  }, [askInFlight]);

  useEffect(() => {
    thinkingChipsRef.current = thinkingChips;
  }, [thinkingChips]);

  useEffect(() => {
    learnMoreUiRef.current = learnMoreUi;
  }, [learnMoreUi]);

  const thinkingOverlayBox = ileWorkCanvasThinkingOverlayStyle();
  const showHeliosThinking = thinkingChips.length > 0;

  const canvasHostOrigin = useCallback(() => {
    const host = canvasHostRef.current;
    if (!host) return { left: 0, top: 0, width: 0, height: 0 };
    const rect = host.getBoundingClientRect();
    return {
      left: rect.left,
      top: rect.top,
      width: host.clientWidth,
      height: host.clientHeight,
    };
  }, []);

  const projectThinkingChip = useCallback(
    (
      turnId: string,
      origin: { x: number; y: number },
      appState: any,
    ): { turnId: string; x: number; y: number; left: number; top: number; zoom: number } => {
      const vp = ileWorkCanvasViewportToHost(
        ileWorkCanvasSceneToViewport(origin, appState),
        canvasHostOrigin(),
      );
      return {
        turnId,
        x: origin.x,
        y: origin.y,
        left: Math.round(vp.x),
        top: Math.round(vp.y),
        zoom: ileWorkCanvasZoomValue(appState),
      };
    },
    [canvasHostOrigin],
  );

  const reservedThinkingOrigins = useCallback((exceptTurnId?: string) => {
    return thinkingChipsRef.current
      .filter((chip) => chip.turnId !== exceptTurnId)
      .map((chip) => ({ x: chip.x, y: chip.y }));
  }, []);

  const upsertThinkingChip = useCallback((chip: {
    turnId: string;
    x: number;
    y: number;
    left: number;
    top: number;
    zoom: number;
  }) => {
    thinkingChipsRef.current = [
      ...thinkingChipsRef.current.filter((item) => item.turnId !== chip.turnId),
      chip,
    ];
    setThinkingChips(thinkingChipsRef.current);
  }, []);

  const removeThinkingChip = useCallback((turnId: string) => {
    thinkingChipsRef.current = thinkingChipsRef.current.filter((chip) => chip.turnId !== turnId);
    thinkingHostByIdRef.current.delete(turnId);
    setThinkingChips(thinkingChipsRef.current);
  }, []);

  useEffect(() => {
    if (!showHeliosThinking) {
      setThinkingTick(0);
      return;
    }
    const id = window.setInterval(() => {
      setThinkingTick((n) => n + 1);
    }, ILE_HELIOS_THINKING_ROTATE_MS);
    return () => window.clearInterval(id);
  }, [showHeliosThinking]);

  useEffect(() => {
    if (!heliosBusy) {
      removeThinkingChip("helios");
      return;
    }
    if (thinkingChipsRef.current.some((chip) => chip.turnId === "helios")) return;
    const api = excalidrawAPIRef.current;
    const elements = (api?.getSceneElements?.() ?? sceneDataRef.current?.elements ?? []) as IleWorkCanvasElement[];
    const origin = ileWorkCanvasEmptyNearbyOriginWithReserved({
      elements,
      reserved: reservedThinkingOrigins("helios"),
      box: { width: ILE_XAI_LOADING_BOX_WIDTH, height: ILE_XAI_LOADING_BOX_HEIGHT },
    });
    const appState = api?.getAppState?.() ?? sceneDataRef.current?.appState ?? {};
    upsertThinkingChip(projectThinkingChip("helios", origin, appState));
  }, [heliosBusy, isLoaded, projectThinkingChip, removeThinkingChip, reservedThinkingOrigins, upsertThinkingChip]);

  const syncThinkingOverlay = useCallback((appState: any) => {
    const host = canvasHostOrigin();
    for (const chip of thinkingChipsRef.current) {
      const node = thinkingHostByIdRef.current.get(chip.turnId);
      if (!node) continue;
      const vp = ileWorkCanvasViewportToHost(ileWorkCanvasSceneToViewport(chip, appState), host);
      const zoom = ileWorkCanvasZoomValue(appState);
      node.style.left = `${Math.round(vp.x)}px`;
      node.style.top = `${Math.round(vp.y)}px`;
      node.style.transform = `scale(${zoom})`;
    }
  }, [canvasHostOrigin]);

  const learnMoreViewport = useCallback((appState: any) => {
    const host = canvasHostOrigin();
    return {
      left: 0,
      top: 0,
      width: Number(appState?.width) || host.width || 0,
      height: Number(appState?.height) || host.height || 0,
    };
  }, [canvasHostOrigin]);

  const paintLearnMoreUi = useCallback((next: { count: number; left: number; top: number } | null) => {
    const key = next ? `${next.count}:${next.left}:${next.top}` : "";
    if (key === learnMoreKeyRef.current) return;
    learnMoreKeyRef.current = key;
    learnMoreUiRef.current = next;
    const node = learnMoreHostRef.current;
    if (node && next) {
      node.style.left = `${next.left}px`;
      node.style.top = `${next.top}px`;
    }
    setLearnMoreUi(next);
  }, []);

  const syncLearnMorePlacement = useCallback((elements: readonly any[], appState: any) => {
    if (!onAskSelectedRef.current) {
      learnMorePinnedRef.current = null;
      if (learnMoreKeyRef.current !== "") {
        learnMoreKeyRef.current = "";
        setLearnMoreUi(null);
      }
      return;
    }
    const selectedIds = appState?.selectedElementIds ?? {};
    const selectionKey = ileLearnMoreSelectionKey(selectedIds);
    const busy = ileWorkCanvasPointerBusy(appState) && !learnMoreDragRef.current;
    if (busy && learnMorePinnedRef.current?.key !== selectionKey) return;
    const viewport = learnMoreViewport(appState);
    const host = canvasHostOrigin();
    const selected = ((elements ?? []) as IleWorkCanvasElement[]).filter(
      (el) => el?.id && selectedIds[el.id] && !el.isDeleted,
    );
    const selectionRect = ileWorkCanvasSelectionHostRect(selected, appState, host);
    const pinned = learnMorePinnedRef.current;
    if (pinned && pinned.key !== selectionKey) learnMorePinnedRef.current = null;
    let next: { count: number; left: number; top: number } | null = null;
    const follow = learnMorePinnedRef.current;
    if (follow && follow.key === selectionKey) {
      const offset =
        follow.dx != null && follow.dy != null
          ? { dx: follow.dx, dy: follow.dy }
          : ileLearnMoreFollowOffset(follow, selectionRect);
      const raw = ileLearnMoreFollowPosition(selectionRect, offset) ?? {
        left: follow.left,
        top: follow.top,
      };
      const held = clampIleLearnMorePosition({ ...raw, viewport });
      learnMorePinnedRef.current = {
        key: selectionKey,
        ...held,
        dx: offset?.dx,
        dy: offset?.dy,
      };
      next = {
        count: selectionKey ? selectionKey.split(",").length : learnMoreUiRef.current?.count ?? 1,
        ...held,
      };
    } else {
      const placed = ileLearnMorePromptPlacement({
        elements: (elements ?? []) as IleWorkCanvasElement[],
        selectedElementIds: selectedIds,
        appState,
        viewport,
        host,
      });
      next =
        placed ??
        (askInFlightRef.current > 0 && learnMoreUiRef.current ? learnMoreUiRef.current : null);
      const offset = ileLearnMoreFollowOffset(next, selectionRect);
      learnMorePinnedRef.current =
        next && selectionKey
          ? { key: selectionKey, ...next, dx: offset?.dx, dy: offset?.dy }
          : null;
    }
    paintLearnMoreUi(next);
  }, [canvasHostOrigin, learnMoreViewport, paintLearnMoreUi]);

  const enqueueCanvasAskApply = useCallback((task: () => void) => {
    const run = applyChainRef.current.then(task, task);
    applyChainRef.current = run.catch(() => {});
    return run;
  }, []);

  const runCanvasAsk = useCallback(
    async (input: { prompt: string; selectedElements: IleWorkCanvasElement[] }) => {
      const ask = onAskSelectedRef.current;
      const api = excalidrawAPIRef.current;
      const prompt = input.prompt.trim();
      if (!ask || !api || !prompt) return false;
      const turnId = `ask-${Date.now()}-${++askSeqRef.current}`;
      const liveElements = (api.getSceneElements?.() ?? []) as IleWorkCanvasElement[];
      const origin = ileWorkCanvasEmptyNearbyOriginWithReserved({
        elements: liveElements,
        reserved: reservedThinkingOrigins(),
        near: input.selectedElements.length ? input.selectedElements : liveElements,
        box: { width: ILE_XAI_LOADING_BOX_WIDTH, height: ILE_XAI_LOADING_BOX_HEIGHT },
      });
      const liveAppState = api.getAppState?.() ?? {};
      upsertThinkingChip(projectThinkingChip(turnId, origin, liveAppState));
      askInFlightRef.current += 1;
      setAskInFlight(askInFlightRef.current);
      const applyReply = (payload: {
        text: string;
        elements?: IleWorkCanvasSkeleton[] | null;
        origin?: { x?: number; y?: number } | null;
      }) => {
        const live = serializeIleWorkCanvasScene({
          elements: api.getSceneElements?.() ?? [],
          appState: api.getAppState?.() ?? {},
          files: api.getFiles?.() ?? {},
        });
        const next = mergeIleXaiTurnOntoLiveWorkCanvas(
          live,
          {
            text: payload.text,
            elements: payload.elements,
            turnId,
            origin: payload.origin,
          },
          {
            fallbackOrigin: origin,
            reserved: reservedThinkingOrigins(turnId),
          },
        );
        api.updateScene({ elements: next.elements });
      };
      try {
        const scene = serializeIleWorkCanvasScene({
          elements: api.getSceneElements?.() ?? [],
          appState: api.getAppState?.() ?? {},
          files: api.getFiles?.() ?? {},
        });
        const reply = await ask({
          prompt,
          selectedElements: input.selectedElements,
          scene,
        });
        await enqueueCanvasAskApply(() => {
          applyReply({
            text: reply?.text || "No reply",
            elements: reply?.elements,
            origin: ileWorkCanvasFiniteOrigin(reply?.origin),
          });
        });
        return true;
      } catch (err) {
        console.error("[ExcalidrawCanvas] Ask XAI failed:", err);
        await enqueueCanvasAskApply(() => {
          applyReply({ text: "Learn more failed. Try again." });
        });
        return false;
      } finally {
        removeThinkingChip(turnId);
        askInFlightRef.current = Math.max(0, askInFlightRef.current - 1);
        setAskInFlight(askInFlightRef.current);
      }
    },
    [
      enqueueCanvasAskApply,
      projectThinkingChip,
      removeThinkingChip,
      reservedThinkingOrigins,
      upsertThinkingChip,
    ],
  );

  const handleAskSelected = useCallback(() => {
    const api = excalidrawAPIRef.current;
    const prompt = askPrompt.trim();
    if (!api || !prompt) return;
    const appState = api.getAppState?.() ?? {};
    const selectedIds = appState.selectedElementIds ?? {};
    const selected = (api.getSceneElements?.() ?? []).filter(
      (el: { id?: string; isDeleted?: boolean }) =>
        el?.id && selectedIds[el.id] && !el.isDeleted,
    ) as IleWorkCanvasElement[];
    if (!selected.length) return;
    setAskPrompt("");
    void runCanvasAsk({ prompt, selectedElements: selected });
  }, [askPrompt, runCanvasAsk]);

  const handleBoardAsk = useCallback(() => {
    const prompt = boardPrompt.trim();
    if (!prompt) return;
    setBoardPrompt("");
    void runCanvasAsk({ prompt, selectedElements: [] });
  }, [boardPrompt, runCanvasAsk]);

  const handleLearnMorePointerDown = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    event.stopPropagation();
    if (!learnMoreUiRef.current) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    const origLeft = learnMoreUiRef.current.left;
    const origTop = learnMoreUiRef.current.top;
    learnMoreDragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      origLeft,
      origTop,
    };
    const api = excalidrawAPIRef.current;
    const appState = api?.getAppState?.() ?? {};
    const selectedIds = appState?.selectedElementIds ?? {};
    const selected = (api?.getSceneElements?.() ?? []).filter(
      (el: { id?: string; isDeleted?: boolean }) =>
        el?.id && selectedIds[el.id] && !el.isDeleted,
    ) as IleWorkCanvasElement[];
    const selectionRect = ileWorkCanvasSelectionHostRect(
      selected,
      appState,
      canvasHostOrigin(),
    );
    const offset = ileLearnMoreFollowOffset({ left: origLeft, top: origTop }, selectionRect);
    learnMorePinnedRef.current = {
      key: ileLearnMoreSelectionKey(selectedIds) || "*",
      left: origLeft,
      top: origTop,
      dx: offset?.dx,
      dy: offset?.dy,
    };
    setLearnMoreDragging(true);
  }, [canvasHostOrigin]);

  const handleLearnMorePointerMove = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    event.stopPropagation();
    const drag = learnMoreDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const api = excalidrawAPIRef.current;
    const appState = api?.getAppState?.() ?? {};
    const next = clampIleLearnMorePosition({
      left: drag.origLeft + (event.clientX - drag.startX),
      top: drag.origTop + (event.clientY - drag.startY),
      viewport: learnMoreViewport(appState),
    });
    const selectedIds = appState?.selectedElementIds ?? {};
    const selected = (api?.getSceneElements?.() ?? []).filter(
      (el: { id?: string; isDeleted?: boolean }) =>
        el?.id && selectedIds[el.id] && !el.isDeleted,
    ) as IleWorkCanvasElement[];
    const selectionRect = ileWorkCanvasSelectionHostRect(
      selected,
      appState,
      canvasHostOrigin(),
    );
    const offset = ileLearnMoreFollowOffset(next, selectionRect);
    const selectionKey = ileLearnMoreSelectionKey(selectedIds);
    learnMorePinnedRef.current = {
      key: selectionKey || learnMorePinnedRef.current?.key || "*",
      ...next,
      dx: offset?.dx,
      dy: offset?.dy,
    };
    paintLearnMoreUi({
      count: learnMoreUiRef.current?.count ?? 1,
      ...next,
    });
  }, [canvasHostOrigin, learnMoreViewport, paintLearnMoreUi]);

  const handleLearnMorePointerUp = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    event.stopPropagation();
    if (learnMoreDragRef.current?.pointerId !== event.pointerId) return;
    learnMoreDragRef.current = null;
    setLearnMoreDragging(false);
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      /* already released */
    }
  }, []);

  useEffect(() => {
    if (applyElementsNonce == null || applyElementsNonce === lastApplyNonceRef.current) return;
    pendingApplyRef.current = {
      nonce: applyElementsNonce,
      elements: applyElements ?? [],
      removeIds: applyRemoveElementIds ?? [],
    };
    flushPendingApply();
  }, [applyElements, applyElementsNonce, applyRemoveElementIds, isLoaded, flushPendingApply]);

  useEffect(() => {
    if (!ileWorkCanvasHasLiveElements(initialSceneData as IleWorkCanvasScene)) return;
    initialSceneDataRef.current = ileWorkCanvasWithScrollToContent(
      sanitizeSceneData(initialSceneData),
    );
    flushPendingApply();
  }, [initialSceneData, flushPendingApply]);

  /**
   * Export current scene to PNG data URL
   */
  const exportToPNG = useCallback(async (): Promise<string | null> => {
    const api = excalidrawAPIRef.current;
    if (!api) return null;

    try {
      const { exportToBlob } = await import("@excalidraw/excalidraw");
      
      const elements = api.getSceneElements();
      const appState = api.getAppState();
      const files = api.getFiles();

      // Skip if no elements
      if (!elements || elements.length === 0) {
        return null;
      }

      const blob = await exportToBlob({
        elements,
        appState: {
          ...appState,
          exportWithDarkMode: true,
          exportBackground: true,
          viewBackgroundColor: "#0a0a0a",
        },
        files,
        mimeType: "image/png",
      });

      // Convert blob to data URL
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          resolve(reader.result as string);
        };
        reader.onerror = () => {
          resolve(null);
        };
        reader.readAsDataURL(blob);
      });
    } catch (err) {
      console.error("[ExcalidrawCanvas] PNG export failed:", err);
      return null;
    }
  }, []);

  /**
   * Debounced PNG export - called on scene changes
   */
  const debouncedExportPNG = useCallback(() => {
    if (!onCanvasChange) return;

    // Clear any pending export
    if (exportTimeoutRef.current) {
      clearTimeout(exportTimeoutRef.current);
    }

    // Debounce: wait 500ms after last change before exporting
    exportTimeoutRef.current = setTimeout(async () => {
      if (isExportingRef.current) return;
      isExportingRef.current = true;

      try {
        const dataUrl = await exportToPNG();
        if (dataUrl) {
          onCanvasChange(dataUrl);
        }
      } finally {
        isExportingRef.current = false;
      }
    }, 500);
  }, [onCanvasChange, exportToPNG]);

  /**
   * Handle changes from Excalidraw
   */
  const handleChange = useCallback(
    (
       
      elements: readonly any[],
       
      appState: any,
       
      files: any
    ) => {
      // Store scene data for potential immediate export
      const sceneData = sanitizeSceneData({ elements: [...elements], appState, files });
      sceneDataRef.current = sceneData ?? null;
      const activeTool =
        typeof appState?.activeTool === "string"
          ? appState.activeTool
          : appState?.activeTool?.type ?? null;
      const lastEl = elements.length ? elements[elements.length - 1] : null;
      onExcalidrawToolRef.current?.({
        activeTool: activeTool ? String(activeTool) : null,
        elementType: lastEl && typeof lastEl.type === "string" ? lastEl.type : null,
      });
      if (scenePersistTimeoutRef.current) clearTimeout(scenePersistTimeoutRef.current);
      scenePersistTimeoutRef.current = setTimeout(() => {
        if (!sceneData) return;
        const json = JSON.stringify(sceneData);
        if (json === lastPersistedSceneJsonRef.current) return;
        lastPersistedSceneJsonRef.current = json;
        onSceneChangeRef.current?.(sceneData);
      }, 250);
      
      // Trigger debounced PNG export
      debouncedExportPNG();
      syncLearnMorePlacement(elements, appState);
      syncThinkingOverlay(appState);
      const id = String(boardId || "").trim();
      if (!id || applyingRemoteRef.current) return;
      const fingerprint = ileWorkCanvasSceneFingerprint(elements, files);
      if (fingerprint && fingerprint === sceneFingerprintRef.current) return;
      sceneFingerprintRef.current = fingerprint;
      publishIleWorkCanvasRoom(id, {
        kind: "scene",
        from: peerId,
        nonce: nextIleWorkCanvasRoomNonce(id),
        elements,
        files: files ?? {},
      });
    },
    [boardId, peerId, debouncedExportPNG, syncLearnMorePlacement, syncThinkingOverlay]
  );

  const handlePointerUpdate = useCallback(
    (payload: {
      pointer: { x: number; y: number; tool: "pointer" | "laser" };
      button: "up" | "down";
    }) => {
      const api = excalidrawAPIRef.current;
      if (payload.button === "down" && api) {
        syncLearnMorePlacement(api.getSceneElements?.() ?? [], api.getAppState?.() ?? {});
      }
      const id = String(boardId || "").trim();
      if (!id) return;
      const appState = api?.getAppState?.() ?? {};
      publishIleWorkCanvasRoom(id, {
        kind: "pointer",
        from: peerId,
        pointer: payload.pointer,
        button: payload.button,
        selectedElementIds: appState.selectedElementIds,
      });
    },
    [boardId, peerId, syncLearnMorePlacement],
  );

  /**
   * Handle "Submit to Helios" click.
   * Forces an immediate PNG export before calling the parent handler.
   */
  const handleSubmitToHelios = useCallback(async () => {
    if (!onSubmitToHelios || isSubmittingToHelios || !canSubmitToHelios) return;

    setIsSubmittingToHelios(true);
    try {
      // Force immediate PNG export before submitting
      let dataUrl: string | null = null;
      if (onCanvasChange) {
        dataUrl = await exportToPNG();
        if (dataUrl) {
          onCanvasChange(dataUrl);
        }
      }
      await onSubmitToHelios(dataUrl);
    } finally {
      setIsSubmittingToHelios(false);
    }
  }, [onSubmitToHelios, isSubmittingToHelios, canSubmitToHelios, onCanvasChange, exportToPNG]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (exportTimeoutRef.current) {
        clearTimeout(exportTimeoutRef.current);
      }
      if (scenePersistTimeoutRef.current) {
        clearTimeout(scenePersistTimeoutRef.current);
      }
      if (centerRafRef.current) {
        cancelAnimationFrame(centerRafRef.current);
        centerRafRef.current = 0;
      }
    };
  }, []);

  // Mark as loaded after mount
  useEffect(() => {
    setIsLoaded(true);
  }, []);

  useEffect(() => {
    if (!isLoaded) return;
    const host = canvasHostRef.current;
    if (!host || typeof ResizeObserver === "undefined") {
      syncPromptBarPlacement();
      return;
    }
    const observer = new ResizeObserver(() => {
      syncPromptBarPlacement();
    });
    observer.observe(host);
    const toolbar = host.querySelector(ILE_CANVAS_PROMPT_BAR_TOOLBAR_SELECTOR);
    if (toolbar) observer.observe(toolbar);
    const raf = requestAnimationFrame(() => {
      syncPromptBarPlacement();
    });
    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
    };
  }, [isLoaded, syncPromptBarPlacement]);

  useEffect(() => {
    const host = canvasHostRef.current;
    const refreshSurface = () => {
      const api = excalidrawAPIRef.current;
      if (api && typeof api.refresh === "function") {
        api.refresh();
      }
      if (!centeredOnOpenRef.current) {
        scheduleCenterOnOpen();
      }
      syncPromptBarPlacement();
      if (api) {
        const appState = api.getAppState?.() ?? {};
        syncLearnMorePlacement(api.getSceneElements?.() ?? [], appState);
        syncThinkingOverlay(appState);
      }
    };
    const unbind = bindIleSurfaceEditorEvents(host, refreshSurface);
    refreshSurface();
    return unbind;
  }, [isLoaded, scheduleCenterOnOpen, syncLearnMorePlacement, syncPromptBarPlacement, syncThinkingOverlay]);

  if (
    !excalidrawAPIRef.current &&
    ileWorkCanvasHasLiveElements(initialSceneData as IleWorkCanvasScene)
  ) {
    initialSceneDataRef.current = ileWorkCanvasWithScrollToContent(
      sanitizeSceneData(initialSceneData),
    );
  }

  return (
    <div className="flex flex-col h-full bg-[#0a0a0a] rounded-none overflow-hidden">
      {onSubmitToHelios ? (
      <div className="flex items-center justify-end gap-2 p-2 border-b border-neutral-800 bg-neutral-900/30">
          <button
            onClick={handleSubmitToHelios}
            disabled={isSubmittingToHelios || !canSubmitToHelios}
            title={
              canSubmitToHelios
                ? t("whiteboard.submitHint")
                : t("whiteboard.alreadySubmitted")
            }
            aria-label={submitButtonLabel}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-black bg-white border border-white hover:bg-neutral-200 disabled:opacity-50 disabled:cursor-not-allowed rounded-none transition-colors"
          >
            {isSubmittingToHelios ? (
              <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
            ) : (
              <svg
                className="w-3.5 h-3.5"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M5 12l5 5L20 7"
                />
              </svg>
            )}
            <span className="whitespace-nowrap">
              {isSubmittingToHelios
                ? t("whiteboard.submitting")
                : submitButtonLabel}
            </span>
          </button>
      </div>
      ) : null}

      {/* Excalidraw container — ownerDocument.defaultView for PiP pointer/resize */}
      <div ref={canvasHostRef} className="flex-1 min-h-0 relative" data-ile-excalidraw-host>
        {isLoaded && (
          <IleExcalidrawErrorBoundary>
            <IleExcalidrawMount
              onApi={setExcalidrawAPI}
              onChange={handleChange}
              onPointerUpdate={handlePointerUpdate}
              initialData={initialSceneDataRef.current}
              isCollaborating={collaborating}
            />
          </IleExcalidrawErrorBoundary>
        )}
        {thinkingChips.map((chip) => (
          <div
            key={chip.turnId}
            ref={(node) => {
              if (node) thinkingHostByIdRef.current.set(chip.turnId, node);
              else thinkingHostByIdRef.current.delete(chip.turnId);
            }}
            data-ile-canvas-thinking
            data-ile-canvas-thinking-id={chip.turnId}
            className="pointer-events-none absolute z-[55] origin-top-left"
            style={{
              left: chip.left,
              top: chip.top,
              transform: `scale(${chip.zoom})`,
            }}
          >
            <div
              data-ile-canvas-thinking-chip
              className="animate-ile-canvas-thinking box-border flex flex-col items-center justify-center gap-2 overflow-hidden rounded-none border border-white bg-neutral-950/92 px-3 py-3 shadow-[0_10px_32px_rgba(0,0,0,0.55)]"
              style={{
                width: thinkingOverlayBox.width,
                height: thinkingOverlayBox.height,
                minWidth: thinkingOverlayBox.minWidth,
                minHeight: thinkingOverlayBox.minHeight,
                maxWidth: thinkingOverlayBox.maxWidth,
                maxHeight: thinkingOverlayBox.maxHeight,
              }}
            >
              <span className="relative flex h-6 w-6 shrink-0 items-center justify-center" aria-hidden>
                <span className="animate-ile-canvas-thinking-orbit absolute inset-0 rounded-full border border-white/30 border-t-white" />
                <span className="h-1.5 w-1.5 rounded-full bg-white" />
              </span>
              <span
                data-ile-canvas-thinking-copy
                className="min-w-0 w-full overflow-hidden text-center font-mono text-[10px] uppercase leading-tight tracking-wider text-white"
              >
                {ileHeliosThinkingLine(thinkingTick)}
              </span>
              <span className="flex shrink-0 items-center gap-1" aria-hidden>
                <span className="size-1 animate-bounce rounded-full bg-white" style={{ animationDelay: "0ms" }} />
                <span className="size-1 animate-bounce rounded-full bg-white" style={{ animationDelay: "150ms" }} />
                <span className="size-1 animate-bounce rounded-full bg-white" style={{ animationDelay: "300ms" }} />
              </span>
            </div>
          </div>
        ))}
        {onAskSelected && learnMoreUi ? (
          <form
            ref={learnMoreHostRef}
            data-ile-excalidraw-ask
            data-ile-learn-more
            data-ile-learn-more-dragging={learnMoreDragging ? "true" : undefined}
            data-ile-excalidraw-ask-busy={askInFlight > 0 ? "true" : undefined}
            className="pointer-events-none absolute flex flex-col gap-1.5 rounded-none border border-white bg-neutral-950/95 p-2 shadow-[0_12px_40px_rgba(0,0,0,0.55)]"
            style={{
              left: learnMoreUi.left,
              top: learnMoreUi.top,
              width: ILE_LEARN_MORE_BOX_WIDTH,
              zIndex: 60,
            }}
            onSubmit={(event) => {
              event.preventDefault();
              void handleAskSelected();
            }}
          >
            <span
              data-ile-learn-more-handle
              className={`pointer-events-auto select-none font-mono text-[10px] uppercase tracking-wider text-white ${
                learnMoreDragging ? "cursor-grabbing" : "cursor-grab"
              }`}
              onPointerDown={handleLearnMorePointerDown}
              onPointerMove={handleLearnMorePointerMove}
              onPointerUp={handleLearnMorePointerUp}
              onPointerCancel={handleLearnMorePointerUp}
            >
              {ILE_LEARN_MORE_LABEL}
            </span>
            <div className="pointer-events-auto flex items-stretch gap-1">
              <input
                data-ile-excalidraw-ask-input
                type="text"
                value={askPrompt}
                onChange={(event) => setAskPrompt(event.target.value)}
                placeholder="Prompt a question about this selection"
                className="min-w-0 flex-1 rounded-none border border-neutral-600 bg-neutral-900 px-2 py-1.5 text-sm text-white placeholder-neutral-500 focus:border-white focus:outline-none"
              />
              <button
                type="submit"
                data-ile-excalidraw-ask-send
                disabled={!askPrompt.trim()}
                className="rounded-none border border-white bg-white px-2.5 text-xs font-semibold uppercase tracking-wider text-neutral-950 hover:bg-neutral-200 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Send
              </button>
            </div>
          </form>
        ) : null}
        {onAskSelected ? (
          <form
            data-ile-canvas-prompt-bar
            data-ile-canvas-prompt-bar-busy={askInFlight > 0 ? "true" : undefined}
            className="pointer-events-none absolute inset-x-0 z-[58] flex justify-center px-16"
            style={{ top: promptBarTop }}
            onSubmit={(event) => {
              event.preventDefault();
              void handleBoardAsk();
            }}
          >
            <div className="pointer-events-auto flex w-full max-w-xl items-stretch gap-1 rounded-none border border-white bg-neutral-950/95 p-2 shadow-[0_12px_40px_rgba(0,0,0,0.55)]">
              <input
                data-ile-canvas-prompt-bar-input
                type="text"
                value={boardPrompt}
                onChange={(event) => setBoardPrompt(event.target.value)}
                placeholder="Put something on the canvas"
                className="min-w-0 flex-1 rounded-none border border-neutral-600 bg-neutral-900 px-2 py-1.5 text-sm text-white placeholder-neutral-500 focus:border-white focus:outline-none"
              />
              <button
                type="submit"
                data-ile-canvas-prompt-bar-send
                disabled={!boardPrompt.trim()}
                className="rounded-none border border-white bg-white px-2.5 text-xs font-semibold uppercase tracking-wider text-neutral-950 hover:bg-neutral-200 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Send
              </button>
            </div>
          </form>
        ) : null}
      </div>
    </div>
  );
}

/**
 * ILE and TAP Work board — same component, same features. Required props
 * keep Expand More, the board prompt, Helios thinking, and XAI apply on.
 */
export type WorkCanvasProps = ExcalidrawCanvasProps & {
  boardId: string;
  onSceneChange: NonNullable<ExcalidrawCanvasProps["onSceneChange"]>;
  onAskSelected: NonNullable<ExcalidrawCanvasProps["onAskSelected"]>;
  onExcalidrawTool: NonNullable<ExcalidrawCanvasProps["onExcalidrawTool"]>;
  heliosBusy: boolean;
};

export function WorkCanvas(props: WorkCanvasProps) {
  return <ExcalidrawCanvas {...props} />;
}
