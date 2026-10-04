"use client";

import dynamic from "next/dynamic";
import {
  Component,
  memo,
  useRef,
  useCallback,
  useState,
  useEffect,
  type ReactNode,
} from "react";
import { useI18n } from "@/lib/i18n";
import { bindIleSurfaceEditorEvents, bindIleSurfaceWheelZoom } from "@/lib/ile-compact-window";
import {
  ILE_HELIOS_THINKING_ROTATE_MS,
  ileHeliosThinkingLine,
} from "@/lib/ile-dialogue-turn";
import {
  applyIleWorkCanvasPositionEdits,
  applyIleWorkCanvasRefactor,
  applyIleWorkCanvasSuggestInsight,
  compressIleWorkCanvasSelection,
  ILE_CANVAS_PROMPT_BAR_FALLBACK_TOP,
  ILE_CANVAS_PROMPT_BAR_FALLBACK_WIDTH,
  ILE_CANVAS_PROMPT_BAR_TOOLBAR_SELECTOR,
  ILE_CANVAS_TIMER_RESET_LOADING_MS,
  ILE_SELECTIVE_COMPRESSION_LABEL,
  ileCanvasPromptBarTop,
  ileCanvasPromptBarWidth,
  ileCanvasPromptMode,
  ileWorkCanvasQuickActionPrompt,
  ileWorkCanvasThinkingOccupancy,
  ileWorkCanvasEmptyNearbyOriginWithReserved,
  ileWorkCanvasFiniteOrigin,
  ileWorkCanvasAddedElementIds,
  ileWorkCanvasHasLiveElements,
  ileWorkCanvasLayoutReply,
  ileWorkCanvasShouldRestoreEmptyBoard,
  ileWorkCanvasSceneToViewport,
  ileWorkCanvasThinkingOverlayStyle,
  ileWorkCanvasViewportToHost,
  ileWorkCanvasWithScrollToContent,
  ileWorkCanvasZoomAtPoint,
  ileWorkCanvasZoomValue,
  mergeIleXaiTurnOntoLiveWorkCanvas,
  pasteIleWorkCanvasElements,
  serializeIleWorkCanvasScene,
  joinIleWorkCanvasSelection,
  runIleWorkCanvasClearOverlaps,
  splitIleWorkCanvasSelectedText,
  withIleWorkCanvasGridAppState,
  ILE_WORK_CANVAS_COMMANDS,
  type IleWorkCanvasAskKind,
  type IleWorkCanvasCommandId,
  ILE_WORK_CANVAS_SCROLL_TO_CONTENT_OPTS,
  ILE_XAI_LOADING_BOX_HEIGHT,
  ILE_XAI_LOADING_BOX_WIDTH,
  type IleWorkCanvasElement,
  type IleWorkCanvasScene,
  type IleWorkCanvasSkeleton,
} from "@/lib/ile-work-canvas";
import { syncIleDictatedTextOnWorkCanvas } from "@/lib/ile-canvas-dictate";
import { ileCanvasCraftInsightUsable } from "@/lib/ile-turn-insights";
import { IleCanvasDictateButton } from "@/components/session-view/ile-canvas-dictate-button";
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
// Excalidraw CSS - required for proper rendering
import "@excalidraw/excalidraw/index.css";
import "@/app/ile-excalidraw-theme.css";

// Dynamic import for Next.js SSR compatibility
const Excalidraw = dynamic(
  async () => (await import("@excalidraw/excalidraw")).Excalidraw,
  { ssr: false }
);

type ExcalidrawAPIRef = any;

const ILE_CANVAS_COMMAND_BUTTON_CLASS =
  "pointer-events-auto shrink-0 whitespace-nowrap rounded-none border border-neutral-600 bg-neutral-900 px-2 py-1 font-mono text-[11px] text-white hover:border-white hover:bg-neutral-800";

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
  viewModeEnabled = false,
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
  viewModeEnabled?: boolean;
}) {
  return (
    <Excalidraw
      excalidrawAPI={onApi}
      onChange={onChange}
      onPointerUpdate={onPointerUpdate}
      initialData={initialData}
      theme="dark"
      viewModeEnabled={viewModeEnabled}
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
          Canvas failed to load.
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
  /** Classified Work-canvas PoW (draw/move/rotate/delete/Commands/board prompt). */
  onCanvasPowActions?: (events: IleWorkCanvasPowEvent[]) => void;
  onAskSelected?: (input: {
    prompt: string;
    selectedElements: IleWorkCanvasElement[];
    scene: IleWorkCanvasScene;
    kind?: IleWorkCanvasAskKind;
  }) => Promise<{
    text: string;
    elements?: IleWorkCanvasSkeleton[] | null;
    origin?: { x?: number; y?: number } | null;
    raw?: string | null;
  }>;
  /** Resets the proof-of-work collector when the board changes. */
  boardId?: string | null;
  /** Helios/XAI in-flight (TAP wait, TAP Learning send) — same overlay chip as ask-about-selection. */
  heliosBusy?: boolean;
  /**
   * TAP purity clock. Canvas chunk load and an in-flight XAI reply are waits,
   * not learner silence. Omitted on surfaces that do not score silence.
   */
  onLearnerWaitChange?: (wait: { canvasLoading: boolean; waitingForXaiReply: boolean }) => void;
  /** TAP Learning: craft an insight linked to this chapter. */
  craftInsight?: IleCanvasCraftInsightConfig | null;
  /**
   * Live speech-bar text. Pass it (even when empty) to show Dictate.
   * Omit it on boards with no microphone. Speech after the click is written
   * onto the canvas as it arrives.
   */
  dictateTranscript?: string;
  /** When nonce changes, replace the live board (timer expiry reset). */
  replaceScene?: IleWorkCanvasScene | null;
  replaceSceneNonce?: string | number | null;
  /** Read-only board (Scout thank-you / frozen canvas). */
  viewModeEnabled?: boolean;
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
 * Shared TAP Learning + TAP Work board. Hosts must not fork this — both surfaces
 * mount `WorkCanvas` so Commands, the board prompt, thinking overlay,
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
  heliosBusy = false,
  onLearnerWaitChange,
  craftInsight = null,
  dictateTranscript,
  replaceScene = null,
  replaceSceneNonce = null,
  viewModeEnabled = false,
}: ExcalidrawCanvasProps) {
  const { t } = useI18n();
  const submitButtonLabel = submitLabel || t("whiteboard.submitToHelios");
  const excalidrawAPIRef = useRef<ExcalidrawAPIRef>(null);
  const canvasHostRef = useRef<HTMLDivElement>(null);
  const [isSubmittingToHelios, setIsSubmittingToHelios] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [canvasApiReady, setCanvasApiReady] = useState(false);
  const [askPrompt, setAskPrompt] = useState("");
  const [boardPrompt, setBoardPrompt] = useState("");
  const [askInFlight, setAskInFlight] = useState(0);
  const [craftInsightOpen, setCraftInsightOpen] = useState(false);
  const lastReplaceNonceRef = useRef<string | number | null>(null);
  const [canvasSelectionActive, setCanvasSelectionActive] = useState(false);
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
  
  // Store the latest scene data for PNG export
   
  const sceneDataRef = useRef<{ elements: any[]; appState: any; files: any } | null>(null);
  const initialSceneDataRef = useRef(
    ileWorkCanvasWithScrollToContent(sanitizeSceneData(initialSceneData)),
  );
  const onSceneChangeRef = useRef(onSceneChange);
  const onCanvasPowActionsRef = useRef(onCanvasPowActions);
  const canvasPowCollectorRef = useRef(new IleWorkCanvasPowCollector());
  const dictateElementIdRef = useRef<string | null>(null);
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
    const merged = pasteIleWorkCanvasElements({
      existing: existing as IleWorkCanvasElement[],
      incoming: toAdd as IleWorkCanvasElement[],
    });
    const addedIds = new Set(
      (toAdd as IleWorkCanvasElement[]).map((el) => el.id).filter(Boolean),
    );
    const added = merged.filter((el) => addedIds.has(el.id) && !el.isDeleted);
    applyingRemoteRef.current = true;
    try {
      api.updateScene({
        elements: merged,
        appState: { selectedElementIds: {} },
      });
    } finally {
      applyingRemoteRef.current = false;
    }
    if (added.length && typeof api.scrollToContent === "function") {
      api.scrollToContent(added, ILE_WORK_CANVAS_SCROLL_TO_CONTENT_OPTS);
    } else {
      scheduleCenterOnOpen();
    }
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
    setCanvasApiReady(true);
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

  const onLearnerWaitChangeRef = useRef(onLearnerWaitChange);
  useEffect(() => {
    onLearnerWaitChangeRef.current = onLearnerWaitChange;
  }, [onLearnerWaitChange]);

  useEffect(() => {
    onLearnerWaitChangeRef.current?.({
      canvasLoading: !canvasApiReady,
      waitingForXaiReply: askInFlight > 0 || heliosBusy,
    });
  }, [askInFlight, canvasApiReady, heliosBusy]);

  useEffect(() => {
    askInFlightRef.current = askInFlight;
  }, [askInFlight]);

  useEffect(() => {
    thinkingChipsRef.current = thinkingChips;
  }, [thinkingChips]);

  useEffect(() => {
    return () => {
      onLearnerWaitChangeRef.current?.({
        canvasLoading: true,
        waitingForXaiReply: false,
      });
    };
  }, []);

  const thinkingOverlayBox = ileWorkCanvasThinkingOverlayStyle();
  const showHeliosThinking = thinkingChips.length > 0;

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

  const syncCanvasSelection = useCallback((appState: any) => {
    const active =
      Boolean(onAskSelectedRef.current) &&
      ileCanvasPromptMode(appState?.selectedElementIds ?? {}) === "commands";
    setCanvasSelectionActive((prev) => (prev === active ? prev : active));
    if (active) setCraftInsightOpen(false);
  }, []);

  const enqueueCanvasAskApply = useCallback((task: () => void) => {
    const run = applyChainRef.current.then(task, task);
    applyChainRef.current = run.catch(() => {});
    return run;
  }, []);

  const runCanvasAsk = useCallback(
    async (input: {
      prompt: string;
      selectedElements: IleWorkCanvasElement[];
      kind?: IleWorkCanvasAskKind;
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
        raw?: string | null;
        elements?: IleWorkCanvasSkeleton[] | null;
        origin?: { x?: number; y?: number } | null;
      }) => {
        const live = serializeIleWorkCanvasScene({
          elements: api.getSceneElements?.() ?? [],
          appState: api.getAppState?.() ?? {},
          files: api.getFiles?.() ?? {},
        });
        const source = input.kind && input.kind !== "ask"
          ? String(payload.raw || "")
          : String(payload.text || "");
        const layoutReply = ileWorkCanvasLayoutReply(payload.raw, payload.elements);
        const next = input.kind === "selective-compress"
          ? compressIleWorkCanvasSelection(live, input.selectedElements, source)
          : input.kind === "refactor"
            ? applyIleWorkCanvasRefactor(live, input.selectedElements, layoutReply)
            : input.kind === "suggest-insight"
              ? applyIleWorkCanvasSuggestInsight(live, input.selectedElements, source)
              : input.kind === "clear-overlaps"
                ? applyIleWorkCanvasPositionEdits(live, input.selectedElements, layoutReply)
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
        const addedIds = new Set(ileWorkCanvasAddedElementIds(live, next));
        const added = next.elements.filter((el) => addedIds.has(el.id) && !el.isDeleted);
        applyingRemoteRef.current = true;
        try {
          api.updateScene({
            elements: next.elements,
            appState: {
              selectedElementIds: {},
            },
          });
        } finally {
          applyingRemoteRef.current = false;
        }
        if (added.length && typeof api.scrollToContent === "function") {
          api.scrollToContent(added, ILE_WORK_CANVAS_SCROLL_TO_CONTENT_OPTS);
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
            text: reply?.text || (input.kind && input.kind !== "ask" ? "" : "No reply"),
            raw: reply?.raw,
            elements: reply?.elements,
            origin: ileWorkCanvasFiniteOrigin(reply?.origin),
          });
        });
        return true;
      } catch (err) {
        console.error("[ExcalidrawCanvas] Ask XAI failed:", err);
        if (!input.kind || input.kind === "ask") {
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
    (action: IleWorkCanvasCommandId) => {
      const api = excalidrawAPIRef.current;
      const selected = selectedCanvasElements();
      if (!api || !selected.length) return;
      const live = serializeIleWorkCanvasScene({
        elements: api.getSceneElements?.() ?? [],
        appState: api.getAppState?.() ?? {},
        files: api.getFiles?.() ?? {},
      });
      const emitCommand = (commandId: IleWorkCanvasCommandId, prompt: string) => {
        const powEvents = canvasPowCollectorRef.current.command(commandId, {
          prompt,
          selectedElements: selected,
        });
        if (powEvents.length) onCanvasPowActionsRef.current?.(powEvents);
      };
      const applyLocalCanvasEdit = (
        scene: IleWorkCanvasScene,
        parts: IleWorkCanvasElement[],
        commandId: IleWorkCanvasCommandId,
        prompt: string,
      ) => {
        applyingRemoteRef.current = true;
        try {
          api.updateScene({
            elements: scene.elements,
            appState: { selectedElementIds: {} },
          });
        } finally {
          applyingRemoteRef.current = false;
        }
        if (parts.length && typeof api.scrollToContent === "function") {
          api.scrollToContent(parts, ILE_WORK_CANVAS_SCROLL_TO_CONTENT_OPTS);
        }
        emitCommand(commandId, prompt);
      };
      if (action === "join") {
        const result = joinIleWorkCanvasSelection(live, selected);
        if (!result.joined) return;
        applyLocalCanvasEdit(result.scene, result.parts, "join", "Join");
        return;
      }
      if (action === "split") {
        const result = splitIleWorkCanvasSelectedText(live, selected);
        if (!result.split) return;
        applyLocalCanvasEdit(result.scene, result.parts, "split", "split");
        return;
      }
      if (action === "clear-overlaps") {
        emitCommand("clear-overlaps", "Clear overlaps");
        const cleared = runIleWorkCanvasClearOverlaps({
          scene: live,
          selectedElements: selected,
          ask: (message) => {
            void runCanvasAsk({
              prompt: message,
              selectedElements: selected,
              kind: "clear-overlaps",
            });
          },
        });
        if (!cleared.needsModel && cleared.moved) {
          applyingRemoteRef.current = true;
          try {
            api.updateScene({ elements: cleared.scene.elements });
          } finally {
            applyingRemoteRef.current = false;
          }
          canvasPowCollectorRef.current.syncWithoutEmit({
            elements: cleared.scene.elements,
            appState: api.getAppState?.() ?? {},
            files: api.getFiles?.() ?? {},
          });
        }
        return;
      }
      if (action === "selective-compression") {
        emitCommand("selective-compression", ILE_SELECTIVE_COMPRESSION_LABEL);
        void runCanvasAsk({
          prompt: ILE_SELECTIVE_COMPRESSION_LABEL,
          selectedElements: selected,
          kind: "selective-compress",
        });
        return;
      }
      if (action === "rephrase" || action === "elaborate") {
        const prompt = ileWorkCanvasQuickActionPrompt(
          action === "rephrase" ? "rephrase" : "elaborate more pls",
        );
        emitCommand(action, prompt);
        void runCanvasAsk({ prompt, selectedElements: selected });
        return;
      }
      if (action === "refactor") {
        emitCommand("refactor", "Refactor");
        void runCanvasAsk({
          prompt: "Refactor",
          selectedElements: selected,
          kind: "refactor",
        });
        return;
      }
      emitCommand("suggest-insight", "Suggest Insight");
      void runCanvasAsk({
        prompt: "Suggest Insight",
        selectedElements: selected,
        kind: "suggest-insight",
      });
    },
    [runCanvasAsk, selectedCanvasElements],
  );

  const writeDictatedText = useCallback(
    (text: string, emitPow: boolean) => {
      const api = excalidrawAPIRef.current;
      if (!api) return;
      const clean = text.trim();
      const rawElements = (
        typeof api.getSceneElementsIncludingDeleted === "function"
          ? api.getSceneElementsIncludingDeleted()
          : (api.getSceneElements?.() ?? [])
      ) as IleWorkCanvasElement[];
      const live = serializeIleWorkCanvasScene({
        elements: rawElements,
        appState: api.getAppState?.() ?? {},
        files: api.getFiles?.() ?? {},
      });
      const previousId = dictateElementIdRef.current;
      const result = syncIleDictatedTextOnWorkCanvas(live, clean, previousId);
      dictateElementIdRef.current = emitPow ? null : result.elementId;
      if (!result.changed && !emitPow) return;
      if (result.changed) {
        applyingRemoteRef.current = true;
        try {
          api.updateScene({
            elements: result.scene.elements,
            appState: { selectedElementIds: {} },
          });
        } finally {
          applyingRemoteRef.current = false;
        }
        const created = Boolean(result.elementId && result.elementId !== previousId);
        if (created) {
          const mark = result.scene.elements.find((el) => el.id === result.elementId);
          if (mark && typeof api.scrollToContent === "function") {
            api.scrollToContent([mark], ILE_WORK_CANVAS_SCROLL_TO_CONTENT_OPTS);
          }
        }
        canvasPowCollectorRef.current.syncWithoutEmit({
          elements: result.scene.elements,
          appState: api.getAppState?.() ?? {},
          files: api.getFiles?.() ?? {},
        });
      }
      if (!emitPow || !clean) return;
      const powEvents = canvasPowCollectorRef.current.dictate({
        text: clean,
        elementId: result.elementId,
      });
      if (powEvents.length) onCanvasPowActionsRef.current?.(powEvents);
    },
    [],
  );

  const handleBoardAsk = useCallback(() => {
    const prompt = boardPrompt.trim();
    if (!prompt) return;
    setBoardPrompt("");
    const powEvents = canvasPowCollectorRef.current.boardPrompt({ prompt });
    if (powEvents.length) onCanvasPowActionsRef.current?.(powEvents);
    void runCanvasAsk({ prompt, selectedElements: [] });
  }, [boardPrompt, runCanvasAsk]);

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
      syncCanvasSelection(appState);
      syncThinkingOverlay(appState);
    },
    [debouncedExportPNG, syncCanvasSelection, syncThinkingOverlay]
  );

  const handlePointerUpdate = useCallback(
    (payload: {
      pointer: { x: number; y: number; tool: "pointer" | "laser" };
      button: "up" | "down";
    }) => {
      const api = excalidrawAPIRef.current;
      if (payload.button === "down" && api) {
        syncCanvasSelection(api.getAppState?.() ?? {});
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
    },
    [syncCanvasSelection],
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
        syncCanvasSelection(appState);
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
        console.error("[ExcalidrawCanvas] zoom failed:", err);
      }
    });
    refreshSurface();
    return () => {
      unbind();
      unbindZoom();
    };
  }, [isLoaded, scheduleCenterOnOpen, syncCanvasSelection, syncPromptBarPlacement, syncThinkingOverlay]);

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

      <div ref={canvasHostRef} className="flex-1 min-h-0 relative" data-ile-excalidraw-host>
        {isLoaded && (
          <IleExcalidrawErrorBoundary>
            <IleExcalidrawMount
              onApi={setExcalidrawAPI}
              onChange={handleChange}
              onPointerUpdate={handlePointerUpdate}
              initialData={initialSceneDataRef.current}
              viewModeEnabled={viewModeEnabled}
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
        {onAskSelected ? (
          <form
            data-ile-canvas-prompt-bar
            data-ile-canvas-prompt-mode={canvasSelectionActive ? "commands" : "ask"}
            data-ile-excalidraw-ask={canvasSelectionActive ? "true" : undefined}
            data-ile-excalidraw-ask-busy={askInFlight > 0 ? "true" : undefined}
            data-ile-canvas-prompt-bar-busy={askInFlight > 0 ? "true" : undefined}
            className="pointer-events-none absolute left-1/2 z-[58] flex -translate-x-1/2 justify-center"
            style={{
              top: promptBarTop,
              width: canvasSelectionActive
                ? Math.max(promptBarWidth, ILE_CANVAS_PROMPT_BAR_FALLBACK_WIDTH)
                : promptBarWidth,
            }}
            onSubmit={(event) => {
              event.preventDefault();
              if (canvasSelectionActive) void handleAskSelected();
              else void handleBoardAsk();
            }}
          >
            <div className="pointer-events-auto flex w-full flex-col gap-1.5">
              {canvasSelectionActive ? (
                <div className="flex w-full flex-col gap-1.5 rounded-none border border-white bg-neutral-950/95 p-2 shadow-[0_12px_40px_rgba(0,0,0,0.55)]">
                  <div
                    data-ile-learn-more
                    data-ile-learn-more-actions
                    className="flex flex-wrap gap-1"
                  >
                    {ILE_WORK_CANVAS_COMMANDS.map((command) => (
                      <button
                        key={command.id}
                        type="button"
                        data-ile-learn-more-quick={command.id}
                        aria-label={command.label}
                        title={command.tooltip}
                        onClick={() => handleQuickAction(command.id)}
                        className={ILE_CANVAS_COMMAND_BUTTON_CLASS}
                      >
                        {command.label}
                      </button>
                    ))}
                  </div>
                  <div className="flex items-stretch gap-1">
                    <input
                      data-ile-excalidraw-ask-input
                      type="text"
                      value={askPrompt}
                      onChange={(event) => setAskPrompt(event.target.value)}
                      placeholder="Prompt a question about this selection"
                      aria-label="Prompt a question about this selection"
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
                </div>
              ) : (
              <>
              <div className="flex items-stretch gap-1.5">
                <div className="flex min-w-0 flex-1 items-stretch gap-1 rounded-none border border-white bg-neutral-950/95 p-2 shadow-[0_12px_40px_rgba(0,0,0,0.55)]">
                  <input
                    data-ile-canvas-prompt-bar-input
                    type="text"
                    value={boardPrompt}
                    onChange={(event) => setBoardPrompt(event.target.value)}
                    placeholder="Any questions?"
                    aria-label="Any questions?"
                    className="min-w-0 flex-1 rounded-none border border-neutral-600 bg-neutral-900 px-2 py-1.5 text-sm text-white placeholder-neutral-500 focus:border-white focus:outline-none"
                  />
                  <button
                    type="submit"
                    data-ile-canvas-prompt-bar-send
                    disabled={!boardPrompt.trim()}
                    aria-label="Ask"
                    className="rounded-none border border-white bg-white px-2.5 text-xs font-semibold uppercase tracking-wider text-neutral-950 hover:bg-neutral-200 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Ask
                  </button>
                </div>
                {craftInsight ? (
                  <IleCraftInsightButton
                    usable={ileCanvasCraftInsightUsable()}
                    onClick={() => setCraftInsightOpen(true)}
                  />
                ) : null}
                {dictateTranscript !== undefined && !viewModeEnabled ? (
                  <IleCanvasDictateButton
                    transcript={dictateTranscript}
                    onLiveText={(text) => writeDictatedText(text, false)}
                    onCommit={(text) => writeDictatedText(text, true)}
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
              </>
              )}
            </div>
          </form>
        ) : null}
      </div>
    </div>
  );
}

/**
 * TAP Learning and TAP Work board — same component, same features. Required props
 * keep Commands, the board prompt, Helios thinking, and XAI apply on.
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
