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
import { bindIleSurfaceEditorEvents, bindIleSurfaceWheelZoom } from "@/lib/ile-compact-window";
import {
  ILE_HELIOS_THINKING_ROTATE_MS,
  ileHeliosThinkingLine,
} from "@/lib/ile-dialogue-turn";
import {
  clampIleLearnMorePosition,
  compressIleWorkCanvasScene,
  ILE_CANVAS_PROMPT_BAR_FALLBACK_TOP,
  ILE_CANVAS_PROMPT_BAR_FALLBACK_WIDTH,
  ILE_CANVAS_PROMPT_BAR_TOOLBAR_SELECTOR,
  ILE_CANVAS_TIMER_RESET_LOADING_MS,
  ILE_COMPRESS_WORK_LABEL,
  ILE_COMPRESS_WORK_PROMPT,
  ILE_LEARN_MORE_BOX_WIDTH,
  ILE_LEARN_MORE_LABEL,
  ileWorkCanvasCanCompress,
  ileCanvasPromptBarTop,
  ileCanvasPromptBarWidth,
  ileLearnMoreFollowOffset,
  ileLearnMoreFollowPosition,
  ileLearnMorePromptPlacement,
  ileLearnMoreSelectionKey,
  ileLearnMoreVisiblePlacement,
  ileWorkCanvasQuickActionPrompt,
  ileWorkCanvasSelectionHostRect,
  ileWorkCanvasThinkingOccupancy,
  ileWorkCanvasEmptyNearbyOriginWithReserved,
  ileWorkCanvasFiniteOrigin,
  ileWorkCanvasHasLiveElements,
  ileWorkCanvasShouldRestoreEmptyBoard,
  ileWorkCanvasPointerBusy,
  ileWorkCanvasSceneToViewport,
  ileWorkCanvasThinkingOverlayStyle,
  ileWorkCanvasViewportToHost,
  ileWorkCanvasWithScrollToContent,
  ileWorkCanvasZoomAtPoint,
  ileWorkCanvasZoomValue,
  mergeIleXaiTurnOntoLiveWorkCanvas,
  serializeIleWorkCanvasScene,
  splitIleWorkCanvasSelectedText,
  withIleWorkCanvasGridAppState,
  ILE_WORK_CANVAS_SCROLL_TO_CONTENT_OPTS,
  ILE_XAI_LOADING_BOX_HEIGHT,
  ILE_XAI_LOADING_BOX_WIDTH,
  type IleWorkCanvasElement,
  type IleWorkCanvasScene,
  type IleWorkCanvasSkeleton,
} from "@/lib/ile-work-canvas";
import { ileCanvasCraftInsightUsable } from "@/lib/ile-turn-insights";
import {
  IleCanvasCraftInsightForm,
  IleCraftInsightButton,
  type IleCanvasCraftInsightConfig,
} from "@/components/session-view/ile-canvas-craft-insight";
import {
  IleWorkCanvasPowCollector,
  ileWorkCanvasGestureBusy,
  type IleWorkCanvasPowEvent,
} from "@/lib/ile-work-canvas-pow";
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
  /** Classified Work-canvas PoW (draw/move/rotate/delete/Expand More/board prompt). */
  onCanvasPowActions?: (events: IleWorkCanvasPowEvent[]) => void;
  onAskSelected?: (input: {
    prompt: string;
    selectedElements: IleWorkCanvasElement[];
    scene: IleWorkCanvasScene;
    kind?: "ask" | "compress";
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
  /** ILE: craft an insight linked to this chapter. */
  craftInsight?: IleCanvasCraftInsightConfig | null;
  /** When nonce changes, replace the live board (timer expiry reset). */
  replaceScene?: IleWorkCanvasScene | null;
  replaceSceneNonce?: string | number | null;
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
  onCanvasPowActions,
  onAskSelected,
  boardId = null,
  peerId = "work",
  heliosBusy = false,
  craftInsight = null,
  replaceScene = null,
  replaceSceneNonce = null,
}: ExcalidrawCanvasProps) {
  const { t } = useI18n();
  const submitButtonLabel = submitLabel || t("whiteboard.submitToHelios");
  const excalidrawAPIRef = useRef<ExcalidrawAPIRef>(null);
  const canvasHostRef = useRef<HTMLDivElement>(null);
  const [isSubmittingToHelios, setIsSubmittingToHelios] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [askPrompt, setAskPrompt] = useState("");
  const [boardPrompt, setBoardPrompt] = useState("");
  const [hasLiveCanvas, setHasLiveCanvas] = useState(() =>
    ileWorkCanvasCanCompress(initialSceneData as IleWorkCanvasScene),
  );
  const [askInFlight, setAskInFlight] = useState(0);
  const [craftInsightOpen, setCraftInsightOpen] = useState(false);
  const lastReplaceNonceRef = useRef<string | number | null>(null);
  const [learnMoreUi, setLearnMoreUi] = useState<{
    count: number;
    left: number;
    top: number;
  } | null>(null);
  const [learnMoreDragging, setLearnMoreDragging] = useState(false);
  const [promptBarTop, setPromptBarTop] = useState(ILE_CANVAS_PROMPT_BAR_FALLBACK_TOP);
  const [promptBarWidth, setPromptBarWidth] = useState(ILE_CANVAS_PROMPT_BAR_FALLBACK_WIDTH);
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
  const onCanvasPowActionsRef = useRef(onCanvasPowActions);
  const canvasPowCollectorRef = useRef(new IleWorkCanvasPowCollector());
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
  const userClearedRef = useRef(false);
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
    const live = (
      typeof api.getSceneElementsIncludingDeleted === "function"
        ? api.getSceneElementsIncludingDeleted()
        : (api.getSceneElements?.() ?? [])
    ) as { id?: string; isDeleted?: boolean }[];
    const liveCount = live.filter((el) => !el.isDeleted).length;
    if (
      ileWorkCanvasShouldRestoreEmptyBoard({
        liveNonDeletedCount: liveCount,
        initialHasLive: ileWorkCanvasHasLiveElements(initial as IleWorkCanvasScene),
        userCleared: userClearedRef.current || live.some((el) => el.isDeleted),
      })
    ) {
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
    const width = ileCanvasPromptBarWidth(
      toolbarRect ? { width: toolbarRect.width } : null,
    );
    setPromptBarTop((prev) => (prev === top ? prev : top));
    setPromptBarWidth((prev) => (prev === width ? prev : width));
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
    onCanvasPowActionsRef.current = onCanvasPowActions;
  }, [onCanvasPowActions]);

  useEffect(() => {
    canvasPowCollectorRef.current.reset(sanitizeSceneData(initialSceneData));
  }, [boardId]);

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
    const askIds = thinkingChipsRef.current
      .filter((chip) => chip.turnId !== "helios")
      .map((chip) => chip.turnId);
    const occupancy = ileWorkCanvasThinkingOccupancy({
      heliosBusy,
      canvasAskTurnIds: askIds,
    });
    if (!occupancy.includes("helios")) {
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
  }, [askInFlight, heliosBusy, isLoaded, projectThinkingChip, removeThinkingChip, reservedThinkingOrigins, upsertThinkingChip]);

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
    if (!selectionKey) {
      learnMorePinnedRef.current = null;
      paintLearnMoreUi(
        ileLearnMoreVisiblePlacement({
          selectedElementIds: selectedIds,
          pointerBusy: ileWorkCanvasPointerBusy(appState),
          placed: learnMoreUiRef.current,
        }),
      );
      return;
    }
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
    paintLearnMoreUi(
      ileLearnMoreVisiblePlacement({
        selectedElementIds: selectedIds,
        pointerBusy: busy,
        placed: next,
      }),
    );
  }, [canvasHostOrigin, learnMoreViewport, paintLearnMoreUi]);

  const enqueueCanvasAskApply = useCallback((task: () => void) => {
    const run = applyChainRef.current.then(task, task);
    applyChainRef.current = run.catch(() => {});
    return run;
  }, []);

  const runCanvasAsk = useCallback(
    async (input: {
      prompt: string;
      selectedElements: IleWorkCanvasElement[];
      kind?: "ask" | "compress";
      replaceWithSummary?: boolean;
    }) => {
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
      removeThinkingChip("helios");
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
        const next = input.replaceWithSummary
          ? compressIleWorkCanvasScene(live, payload.text)
          : mergeIleXaiTurnOntoLiveWorkCanvas(
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
        applyingRemoteRef.current = true;
        try {
          api.updateScene({
            elements: next.elements,
            ...(input.replaceWithSummary ? { appState: next.appState } : {}),
          });
        } finally {
          applyingRemoteRef.current = false;
        }
        canvasPowCollectorRef.current.syncWithoutEmit({
          elements: next.elements,
          appState: api.getAppState?.() ?? {},
          files: api.getFiles?.() ?? {},
        });
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
          kind: input.kind,
        });
        await enqueueCanvasAskApply(() => {
          applyReply({
            text: reply?.text || (input.replaceWithSummary ? "" : "No reply"),
            elements: reply?.elements,
            origin: ileWorkCanvasFiniteOrigin(reply?.origin),
          });
        });
        return true;
      } catch (err) {
        console.error("[ExcalidrawCanvas] Ask XAI failed:", err);
        if (!input.replaceWithSummary) {
          await enqueueCanvasAskApply(() => {
            applyReply({ text: "Learn more failed. Try again." });
          });
        }
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

  const selectedCanvasElements = useCallback((): IleWorkCanvasElement[] => {
    const api = excalidrawAPIRef.current;
    const appState = api?.getAppState?.() ?? {};
    const selectedIds = appState.selectedElementIds ?? {};
    return ((api?.getSceneElements?.() ?? []) as IleWorkCanvasElement[]).filter(
      (el) => el?.id && selectedIds[el.id] && !el.isDeleted,
    );
  }, []);

  const handleAskSelected = useCallback(() => {
    const prompt = askPrompt.trim();
    const selected = selectedCanvasElements();
    if (!prompt || !selected.length) return;
    setAskPrompt("");
    const powEvents = canvasPowCollectorRef.current.expandMore({
      prompt,
      selectedElements: selected,
    });
    if (powEvents.length) onCanvasPowActionsRef.current?.(powEvents);
    void runCanvasAsk({ prompt, selectedElements: selected });
  }, [askPrompt, runCanvasAsk, selectedCanvasElements]);

  const handleQuickAction = useCallback(
    (action: "rephrase" | "split" | "elaborate more pls") => {
      const api = excalidrawAPIRef.current;
      const selected = selectedCanvasElements();
      if (!api || !selected.length) return;
      if (action === "split") {
        const live = serializeIleWorkCanvasScene({
          elements: api.getSceneElements?.() ?? [],
          appState: api.getAppState?.() ?? {},
          files: api.getFiles?.() ?? {},
        });
        const result = splitIleWorkCanvasSelectedText(live, selected);
        if (!result.split) return;
        applyingRemoteRef.current = true;
        try {
          api.updateScene({ elements: result.scene.elements });
        } finally {
          applyingRemoteRef.current = false;
        }
        const powEvents = canvasPowCollectorRef.current.expandMore({
          prompt: "split",
          selectedElements: selected,
        });
        if (powEvents.length) onCanvasPowActionsRef.current?.(powEvents);
        return;
      }
      const prompt = ileWorkCanvasQuickActionPrompt(action);
      const powEvents = canvasPowCollectorRef.current.expandMore({
        prompt,
        selectedElements: selected,
      });
      if (powEvents.length) onCanvasPowActionsRef.current?.(powEvents);
      void runCanvasAsk({ prompt, selectedElements: selected });
    },
    [runCanvasAsk, selectedCanvasElements],
  );

  const handleBoardAsk = useCallback(() => {
    const prompt = boardPrompt.trim();
    if (!prompt) return;
    setBoardPrompt("");
    const powEvents = canvasPowCollectorRef.current.boardPrompt({ prompt });
    if (powEvents.length) onCanvasPowActionsRef.current?.(powEvents);
    void runCanvasAsk({ prompt, selectedElements: [] });
  }, [boardPrompt, runCanvasAsk]);

  const handleCompressWork = useCallback(() => {
    const api = excalidrawAPIRef.current;
    if (!api || askInFlightRef.current > 0) return;
    const scene = serializeIleWorkCanvasScene({
      elements: api.getSceneElements?.() ?? [],
      appState: api.getAppState?.() ?? {},
      files: api.getFiles?.() ?? {},
    });
    if (!ileWorkCanvasCanCompress(scene)) return;
    const selected = scene.elements.filter((el) => !el.isDeleted);
    const powEvents = canvasPowCollectorRef.current.compressWork({
      prompt: ILE_COMPRESS_WORK_LABEL,
      selectedElements: selected,
    });
    if (powEvents.length) onCanvasPowActionsRef.current?.(powEvents);
    void runCanvasAsk({
      prompt: ILE_COMPRESS_WORK_PROMPT,
      selectedElements: selected,
      kind: "compress",
      replaceWithSummary: true,
    });
  }, [runCanvasAsk]);

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
    if (replaceSceneNonce == null || replaceSceneNonce === lastReplaceNonceRef.current) {
      return;
    }
    lastReplaceNonceRef.current = replaceSceneNonce;
    const api = excalidrawAPIRef.current;
    if (!api) return;
    const turnId = `timer-reset-${String(replaceSceneNonce)}`;
    const liveElements = (api.getSceneElements?.() ?? []) as IleWorkCanvasElement[];
    const origin = ileWorkCanvasEmptyNearbyOriginWithReserved({
      elements: liveElements,
      reserved: reservedThinkingOrigins(),
      box: { width: ILE_XAI_LOADING_BOX_WIDTH, height: ILE_XAI_LOADING_BOX_HEIGHT },
    });
    const liveAppState = api.getAppState?.() ?? {};
    upsertThinkingChip(projectThinkingChip(turnId, origin, liveAppState));
    const timer = window.setTimeout(() => {
      const next = sanitizeSceneData(replaceScene ?? { elements: [], appState: {}, files: {} });
      applyingRemoteRef.current = true;
      try {
        api.updateScene({ elements: next.elements, appState: next.appState });
      } finally {
        applyingRemoteRef.current = false;
      }
      canvasPowCollectorRef.current.syncWithoutEmit({
        elements: next.elements,
        appState: api.getAppState?.() ?? next.appState,
        files: api.getFiles?.() ?? next.files,
      });
      onSceneChangeRef.current?.(next);
      removeThinkingChip(turnId);
    }, ILE_CANVAS_TIMER_RESET_LOADING_MS);
    return () => {
      window.clearTimeout(timer);
      removeThinkingChip(turnId);
    };
  }, [
    projectThinkingChip,
    removeThinkingChip,
    replaceScene,
    replaceSceneNonce,
    reservedThinkingOrigins,
    upsertThinkingChip,
  ]);

  useEffect(() => {
    const next = ileWorkCanvasWithScrollToContent(sanitizeSceneData(initialSceneData));
    initialSceneDataRef.current = next;
    if (ileWorkCanvasHasLiveElements(initialSceneData as IleWorkCanvasScene)) {
      userClearedRef.current = false;
      flushPendingApply();
    }
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
      const previous = sceneDataRef.current;
      const sceneData = sanitizeSceneData({ elements: [...elements], appState, files });
      const prevLive = ileWorkCanvasHasLiveElements(previous as IleWorkCanvasScene);
      const nextLive = ileWorkCanvasHasLiveElements(sceneData);
      setHasLiveCanvas(nextLive);
      const deletedSnapshot = (sceneData.elements ?? []).some(
        (el: { isDeleted?: boolean }) => el.isDeleted,
      );
      if (!applyingRemoteRef.current && prevLive && !nextLive && deletedSnapshot) {
        userClearedRef.current = true;
        initialSceneDataRef.current = sceneData;
      } else if (nextLive) {
        userClearedRef.current = false;
      }
      sceneDataRef.current = sceneData ?? null;
      if (applyingRemoteRef.current) {
        canvasPowCollectorRef.current.syncWithoutEmit(sceneData);
      } else {
        const powEvents = canvasPowCollectorRef.current.observeScene(sceneData, {
          gestureBusy: ileWorkCanvasGestureBusy(appState),
        });
        if (powEvents.length) onCanvasPowActionsRef.current?.(powEvents);
      }
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
        canvasPowCollectorRef.current.markGestureBusy(true);
      } else if (payload.button === "up") {
        const scene = sanitizeSceneData({
          elements: [...(api?.getSceneElements?.() ?? [])],
          appState: api?.getAppState?.() ?? {},
          files: api?.getFiles?.() ?? {},
        });
        const powEvents = canvasPowCollectorRef.current.observeScene(scene, {
          gestureBusy: false,
        });
        if (powEvents.length) onCanvasPowActionsRef.current?.(powEvents);
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
    const unbindZoom = bindIleSurfaceWheelZoom(host, (input) => {
      const api = excalidrawAPIRef.current;
      if (!api || typeof api.updateScene !== "function") return;
      const appState = api.getAppState?.() ?? {};
      const next = ileWorkCanvasZoomAtPoint({
        zoom: ileWorkCanvasZoomValue(appState),
        scrollX: Number(appState.scrollX) || 0,
        scrollY: Number(appState.scrollY) || 0,
        offsetLeft: Number(appState.offsetLeft) || 0,
        offsetTop: Number(appState.offsetTop) || 0,
        viewportX: input.clientX,
        viewportY: input.clientY,
        deltaY: input.deltaY,
      });
      try {
        api.updateScene({
          appState: {
            zoom: { value: next.zoom },
            scrollX: next.scrollX,
            scrollY: next.scrollY,
          },
        });
      } catch (err) {
        console.error("[ExcalidrawCanvas] PiP zoom failed:", err);
      }
    });
    refreshSurface();
    return () => {
      unbind();
      unbindZoom();
    };
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
            <div
              data-ile-learn-more-actions
              className="pointer-events-auto flex items-center gap-1"
            >
              <button
                type="button"
                data-ile-learn-more-quick="rephrase"
                aria-label="Rephrase"
                title="Rephrase"
                onClick={() => handleQuickAction("rephrase")}
                className="inline-flex h-7 w-7 items-center justify-center rounded-none border border-neutral-600 bg-neutral-900 text-white hover:border-white hover:bg-neutral-800"
              >
                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v6h6" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20 20v-6h-6" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5.5 9A7 7 0 0119 7.4L20 10" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M18.5 15A7 7 0 015 16.6L4 14" />
                </svg>
              </button>
              <button
                type="button"
                data-ile-learn-more-quick="split"
                aria-label="Split"
                title="Split"
                onClick={() => handleQuickAction("split")}
                className="inline-flex h-7 w-7 items-center justify-center rounded-none border border-neutral-600 bg-neutral-900 text-white hover:border-white hover:bg-neutral-800"
              >
                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16M5 7h5v10H5zM14 7h5v10h-5z" />
                </svg>
              </button>
              <button
                type="button"
                data-ile-learn-more-quick="elaborate"
                aria-label="Elaborate more"
                title="Elaborate more"
                onClick={() => handleQuickAction("elaborate more pls")}
                className="inline-flex h-7 w-7 items-center justify-center rounded-none border border-neutral-600 bg-neutral-900 text-white hover:border-white hover:bg-neutral-800"
              >
                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14M5 12h14M7 7l10 10M17 7L7 17" />
                </svg>
              </button>
            </div>
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
            className="pointer-events-none absolute left-1/2 z-[58] flex -translate-x-1/2 justify-center"
            style={{ top: promptBarTop, width: promptBarWidth }}
            onSubmit={(event) => {
              event.preventDefault();
              void handleBoardAsk();
            }}
          >
            <div className="pointer-events-auto flex w-full flex-col gap-1.5">
              <div className="flex items-stretch gap-1.5">
                <div className="flex min-w-0 flex-1 items-stretch gap-1 rounded-none border border-white bg-neutral-950/95 p-2 shadow-[0_12px_40px_rgba(0,0,0,0.55)]">
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
                <button
                  type="button"
                  data-ile-compress-work
                  disabled={!hasLiveCanvas || askInFlight > 0}
                  onClick={handleCompressWork}
                  className="shrink-0 rounded-none border border-white bg-white px-3 font-mono text-[11px] font-semibold uppercase tracking-wider text-neutral-950 shadow-[0_12px_40px_rgba(0,0,0,0.55)] hover:bg-neutral-200 disabled:cursor-not-allowed disabled:border-white/30 disabled:bg-neutral-800 disabled:text-white/40"
                >
                  {ILE_COMPRESS_WORK_LABEL}
                </button>
                {craftInsight ? (
                  <IleCraftInsightButton
                    usable={ileCanvasCraftInsightUsable()}
                    onClick={() => setCraftInsightOpen(true)}
                  />
                ) : null}
              </div>
              {craftInsight ? (
                <IleCanvasCraftInsightForm
                  open={craftInsightOpen}
                  enabled={ileCanvasCraftInsightUsable()}
                  selectedElements={selectedCanvasElements()}
                  config={craftInsight}
                  onClose={() => setCraftInsightOpen(false)}
                />
              ) : null}
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
  onCanvasPowActions: NonNullable<ExcalidrawCanvasProps["onCanvasPowActions"]>;
  heliosBusy: boolean;
};

export function WorkCanvas(props: WorkCanvasProps) {
  return <ExcalidrawCanvas {...props} />;
}
