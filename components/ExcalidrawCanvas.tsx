"use client";

import {
  useRef,
  useCallback,
  useState,
  useEffect,
} from "react";
import { useI18n } from "@/lib/i18n";
import { bindIleSurfaceEditorEvents, bindIleSurfaceWheelZoom } from "@/lib/ile-compact-window";
import { ILE_HELIOS_THINKING_ROTATE_MS } from "@/lib/ile-dialogue-turn";
import { ILE_CANVAS_TIMER_RESET_LOADING_MS } from "@/lib/ile-work-canvas-timer";
import {
  ILE_SELECTIVE_COMPRESSION_LABEL,
  ileCanvasCommandDraft,
  ileWorkCanvasCommandNeedsSelection,
  type IleWorkCanvasCommandId,
} from "@/lib/ile-work-canvas-commands";
import { CanvasPromptBar } from "@/components/excalidraw-canvas/canvas-prompt-bar";
import { CanvasSubmitBar } from "@/components/excalidraw-canvas/canvas-submit-bar";
import { CanvasThinkingChips } from "@/components/excalidraw-canvas/canvas-thinking-chips";
import {
  IleExcalidrawErrorBoundary,
  IleExcalidrawMount,
} from "@/components/excalidraw-canvas/ile-excalidraw-mount";
import { sanitizeSceneData } from "@/components/excalidraw-canvas/sanitize-scene";
import {
  applyIleWorkCanvasPositionEdits,
  applyIleWorkCanvasRefactor,
  applyIleWorkCanvasSuggestInsight,
  compressIleWorkCanvasSelection,
  ILE_CANVAS_PROMPT_BAR_FALLBACK_TOP,
  ILE_CANVAS_PROMPT_BAR_FALLBACK_WIDTH,
  ILE_CANVAS_PROMPT_BAR_TOOLBAR_SELECTOR,
  ileCanvasPromptBarTop,
  ileCanvasPromptBarWidth,
  ileCanvasCraftInsightOpenAfterSelection,
  ileCanvasPromptMode,
  ileCanvasSlashBarOpen,
  ileCanvasSlashKeyOpensBar,
  ileWorkCanvasMarksNeedScroll,
  ileWorkCanvasQuickActionPrompt,
  ileWorkCanvasThinkingOccupancy,
  ileWorkCanvasEmptyNearbyOriginWithReserved,
  ileWorkCanvasFiniteOrigin,
  ileWorkCanvasAddedElementIds,
  ileWorkCanvasCenterScroll,
  ileWorkCanvasContentBounds,
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
  type IleWorkCanvasAskKind,
  ILE_WORK_CANVAS_SCROLL_TO_CONTENT_OPTS,
  type IleWorkCanvasElement,
  type IleWorkCanvasScene,
  type IleWorkCanvasSkeleton,
} from "@/lib/ile-work-canvas";
import {
  advanceIleDictateCapture,
  ileDictateCaptureText,
  noteIleDictateTranscript,
  startIleDictateCapture,
  syncIleDictatedTextOnWorkCanvas,
  type IleDictateCapture,
} from "@/lib/ile-canvas-dictate";
import { type IleCanvasCraftInsightConfig } from "@/components/session-view/ile-canvas-craft-insight";
import {
  IleWorkCanvasPowCollector,
  ileWorkCanvasGestureBusy,
  type IleWorkCanvasPowEvent,
} from "@/lib/ile-work-canvas-pow";
// Excalidraw CSS - required for proper rendering
import "@excalidraw/excalidraw/index.css";
import "@/app/ile-excalidraw-theme.css";

// Dynamic import for Next.js SSR compatibility
type ExcalidrawAPIRef = any;

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
  /** On open, center these marks (`customData.calibrateRole`) instead of the whole board. */
  openFocusRole?: string | null;
  /** When false, merging elements does not pan the camera. */
  scrollAppliedElements?: boolean;
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
  /**
   * Fires when Dictate is turned on or off. Omitted callers keep the
   * existing transcript feed and do not start a recognizer from this button.
   */
  onDictateActive?: (active: boolean) => void;
  /** When nonce changes, replace the live board (timer expiry reset). */
  replaceScene?: IleWorkCanvasScene | null;
  replaceSceneNonce?: string | number | null;
  /** Read-only board (Scout thank-you / frozen canvas). */
  viewModeEnabled?: boolean;
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
  openFocusRole = null,
  scrollAppliedElements = true,
  onCanvasPowActions,
  onAskSelected,
  boardId = null,
  heliosBusy = false,
  onLearnerWaitChange,
  craftInsight = null,
  dictateTranscript,
  onDictateActive,
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
  const [commandText, setCommandText] = useState("");
  const [slashBarOpen, setSlashBarOpen] = useState(false);
  const commandInputRef = useRef<HTMLInputElement>(null);
  const [askListening, setAskListening] = useState(false);
  const askCaptureRef = useRef<IleDictateCapture | null>(null);
  const selectionWasActiveRef = useRef(false);
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
    openFocusRole
      ? sanitizeSceneData(initialSceneData)
      : ileWorkCanvasWithScrollToContent(sanitizeSceneData(initialSceneData)),
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
  const openFocusRoleRef = useRef(openFocusRole);
  openFocusRoleRef.current = openFocusRole;
  const scrollAppliedElementsRef = useRef(scrollAppliedElements);
  scrollAppliedElementsRef.current = scrollAppliedElements;
  const centerRafRef = useRef(0);
  const centerTriesRef = useRef(0);
  const focusHoldUntilRef = useRef(0);

  const scheduleCenterOnOpen = useCallback(() => {
    if (centeredOnOpenRef.current) return;
    centerTriesRef.current = 0;
    if (centerRafRef.current) cancelAnimationFrame(centerRafRef.current);
    const run = () => {
      centerRafRef.current = 0;
      const api = excalidrawAPIRef.current;
      if (!api || typeof api.scrollToContent !== "function") return;
      const elements = (api.getSceneElements?.() ?? []).filter(
        (el: { isDeleted?: boolean }) => !el.isDeleted,
      );
      const appState = api.getAppState?.() ?? {};
      const width = Number(appState.width);
      const height = Number(appState.height);
      const viewportReady =
        elements.length > 0 &&
        Number.isFinite(width) &&
        width > 0 &&
        Number.isFinite(height) &&
        height > 0;
      if (!viewportReady) {
        if (centerTriesRef.current < 24) {
          centerTriesRef.current += 1;
          centerRafRef.current = requestAnimationFrame(run);
        }
        return;
      }
      if (typeof api.refresh === "function") {
        try {
          api.refresh();
        } catch {
          /* layout may not be ready */
        }
      }
      const role = openFocusRoleRef.current;
      const focused = role
        ? elements.filter(
            (el: { customData?: { calibrateRole?: string } }) => el.customData?.calibrateRole === role,
          )
        : [];
      if (role && !focused.length) {
        if (centerTriesRef.current < 40) {
          centerTriesRef.current += 1;
          centerRafRef.current = requestAnimationFrame(run);
        }
        return;
      }
      if (focused.length && typeof api.updateScene === "function") {
        const bounds = ileWorkCanvasContentBounds(focused);
        const scroll = ileWorkCanvasCenterScroll(bounds, { width, height, zoom: { value: 1 } });
        if (scroll) {
          const offsetLeft = Number(appState.offsetLeft) || 0;
          const offsetTop = Number(appState.offsetTop) || 0;
          try {
            api.updateScene({
              appState: {
                zoom: { value: 1 },
                scrollX: scroll.scrollX - offsetLeft,
                scrollY: scroll.scrollY - offsetTop,
              },
            });
          } catch {
            api.scrollToContent(focused, ILE_WORK_CANVAS_SCROLL_TO_CONTENT_OPTS);
          }
        } else {
          api.scrollToContent(focused, ILE_WORK_CANVAS_SCROLL_TO_CONTENT_OPTS);
        }
        if (!focusHoldUntilRef.current) focusHoldUntilRef.current = performance.now() + 900;
        if (performance.now() < focusHoldUntilRef.current) {
          centerRafRef.current = requestAnimationFrame(run);
          return;
        }
      } else {
        api.scrollToContent(elements, ILE_WORK_CANVAS_SCROLL_TO_CONTENT_OPTS);
      }
      centeredOnOpenRef.current = true;
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
    if (added.length && scrollAppliedElementsRef.current && typeof api.scrollToContent === "function") {
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
      box: ileWorkCanvasThinkingOverlayStyle(),
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
    if (selectionWasActiveRef.current && !active) {
      askCaptureRef.current = null;
      setAskListening(false);
      setCommandText("");
      setSlashBarOpen(false);
    }
    selectionWasActiveRef.current = active;
    setCanvasSelectionActive((prev) => (prev === active ? prev : active));
    setCraftInsightOpen((open) =>
      ileCanvasCraftInsightOpenAfterSelection({
        open,
        selectionActive: active,
      }),
    );
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typingInField =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        Boolean(target?.isContentEditable);
      if (
        !ileCanvasSlashKeyOpensBar({
          key: event.key,
          selectionActive: canvasSelectionActive,
          typingInField,
        })
      ) {
        return;
      }
      event.preventDefault();
      setSlashBarOpen(true);
      setCommandText((current) => (current.startsWith("/") ? current : "/"));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [canvasSelectionActive]);

  useEffect(() => {
    if (!ileCanvasSlashBarOpen({
      selectionActive: canvasSelectionActive,
      slashIntent: slashBarOpen,
    })) {
      return;
    }
    commandInputRef.current?.focus();
  }, [canvasSelectionActive, slashBarOpen]);

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
        box: ileWorkCanvasThinkingOverlayStyle(),
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
        if (
          added.length &&
          typeof api.scrollToContent === "function" &&
          ileWorkCanvasMarksNeedScroll(added, api.getAppState?.() ?? {})
        ) {
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
      if (action === "answer" || action === "simplify") {
        const prompt = action === "answer" ? "Answer" : "Simplify";
        emitCommand(action, prompt);
        void runCanvasAsk({
          prompt,
          selectedElements: selected,
          kind: action,
        });
        return;
      }
      if (action === "ask") return;
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

  const handleBoardAsk = useCallback((prompt: string) => {
    const text = String(prompt || "").trim();
    if (!text) return;
    const powEvents = canvasPowCollectorRef.current.command("ask", { prompt: text });
    if (powEvents.length) onCanvasPowActionsRef.current?.(powEvents);
    void runCanvasAsk({ prompt: text, selectedElements: [], kind: "ask" });
  }, [runCanvasAsk]);

  useEffect(() => {
    if (!askListening || !askCaptureRef.current) return;
    const advanced = advanceIleDictateCapture(askCaptureRef.current, dictateTranscript ?? "");
    askCaptureRef.current = advanced.capture;
    const spoken = advanced.text.trim();
    setCommandText(spoken ? `/ask ${spoken}` : "/ask ");
  }, [askListening, dictateTranscript]);

  const beginAskVoice = useCallback(() => {
    if (dictateTranscript === undefined) {
      setCommandText((current) => (current.trim().startsWith("/ask") ? current : "/ask "));
      return;
    }
    askCaptureRef.current = startIleDictateCapture(dictateTranscript);
    setAskListening(true);
    setCommandText("/ask ");
  }, [dictateTranscript]);

  const finishAskVoice = useCallback(
    (send: boolean) => {
      const capture = askCaptureRef.current;
      askCaptureRef.current = null;
      setAskListening(false);
      const spoken = capture
        ? ileDictateCaptureText(
            noteIleDictateTranscript(capture, dictateTranscript ?? ""),
          ).trim()
        : "";
      const draft = ileCanvasCommandDraft(commandText);
      const typed = draft.exactId === "ask" ? draft.rest.trim() : "";
      const text = typed || spoken;
      setCommandText("");
      if (send && text) handleBoardAsk(text);
    },
    [commandText, dictateTranscript, handleBoardAsk],
  );

  const submitCommand = useCallback(() => {
    if (askListening) {
      finishAskVoice(true);
      return;
    }
    const draft = ileCanvasCommandDraft(commandText);
    if (!draft.slash || !draft.exactId) return;
    if (draft.exactId === "ask") {
      if (draft.rest.trim()) {
        setCommandText("");
        handleBoardAsk(draft.rest);
        return;
      }
      beginAskVoice();
      return;
    }
    if (ileWorkCanvasCommandNeedsSelection(draft.exactId) && selectedCanvasElements().length === 0) {
      return;
    }
    setCommandText("");
    handleQuickAction(draft.exactId);
  }, [
    askListening,
    beginAskVoice,
    commandText,
    finishAskVoice,
    handleBoardAsk,
    handleQuickAction,
    selectedCanvasElements,
  ]);

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
      box: ileWorkCanvasThinkingOverlayStyle(),
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
    const clean = sanitizeSceneData(initialSceneData);
    initialSceneDataRef.current = openFocusRole
      ? clean
      : ileWorkCanvasWithScrollToContent(clean);
  }

  return (
    <div className="flex flex-col h-full bg-[#0a0a0a] rounded-none overflow-hidden">
      {onSubmitToHelios ? (
        <CanvasSubmitBar
          t={t}
          handleSubmitToHelios={handleSubmitToHelios}
          isSubmittingToHelios={isSubmittingToHelios}
          canSubmitToHelios={canSubmitToHelios}
          submitButtonLabel={submitButtonLabel}
        />
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
        <CanvasThinkingChips
          thinkingChips={thinkingChips}
          thinkingHostByIdRef={thinkingHostByIdRef}
          thinkingOverlayBox={thinkingOverlayBox}
          thinkingTick={thinkingTick}
        />
        {onAskSelected ? (
          <CanvasPromptBar
            askInFlight={askInFlight}
            promptBarTop={promptBarTop}
            canvasSelectionActive={canvasSelectionActive}
            promptBarWidth={promptBarWidth}
            submitCommand={submitCommand}
            slashBarOpen={slashBarOpen}
            commandText={commandText}
            setCommandText={setCommandText}
            beginAskVoice={beginAskVoice}
            handleQuickAction={handleQuickAction}
            commandInputRef={commandInputRef}
            askListening={askListening}
            setAskListening={setAskListening}
            askCaptureRef={askCaptureRef}
            finishAskVoice={finishAskVoice}
            craftInsight={craftInsight}
            setCraftInsightOpen={setCraftInsightOpen}
            dictateTranscript={dictateTranscript}
            viewModeEnabled={viewModeEnabled}
            writeDictatedText={writeDictatedText}
            onDictateActive={onDictateActive}
            craftInsightOpen={craftInsightOpen}
            selectedCanvasElements={selectedCanvasElements}
          />
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
