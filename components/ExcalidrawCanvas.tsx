"use client";

import {
  useRef,
  useCallback,
  useState,
  useEffect,
} from "react";
import { useI18n } from "@/lib/i18n";
import { bindIleSurfaceEditorEvents, bindIleSurfaceWheelZoom } from "@/lib/learn-compact-window";
import { ILE_CANVAS_TIMER_RESET_LOADING_MS } from "@/lib/learn-work-canvas-timer";
import {
  ILE_WORK_CANVAS_AUTO_LAYOUT_SHORTCUT,
  ileWorkCanvasCommandByShortcut,
  ileWorkCanvasCommandShortcutKeyFromEvent,
} from "@/lib/learn-work-canvas-commands";
import { CanvasPromptBar } from "@/components/excalidraw-canvas/canvas-prompt-bar";
import {
  usePublishSessionProof,
  useSessionBranchSlot,
  useSessionPolicyInferences,
  useSessionPolicySuggestion,
} from "@/components/session-view/session-policy-context";
import {
  openSessionBranchQuestions,
  type SessionBranchModel,
} from "@/lib/session-branch-model";
import { CanvasSubmitBar } from "@/components/excalidraw-canvas/canvas-submit-bar";
import { CanvasThinkingChips } from "@/components/excalidraw-canvas/canvas-thinking-chips";
import {
  IleExcalidrawErrorBoundary,
  IleExcalidrawMount,
} from "@/components/excalidraw-canvas/learn-excalidraw-mount";
import { openCanvasScene, sanitizeSceneData } from "@/components/excalidraw-canvas/sanitize-scene";
import { exportWorkCanvasPng } from "@/components/excalidraw-canvas/work-canvas-png";
import {
  acknowledgeIleWorkCanvasXaiNotes,
  ILE_CANVAS_PROMPT_BAR_FALLBACK_WIDTH,
  ILE_CANVAS_PROMPT_BAR_TOOLBAR_SELECTOR,
  ileCanvasPromptBarWidth,
  ileCanvasCraftInsightOpenAfterSelection,
  ileCanvasPromptMode,
  ileCanvasSlashBarOpen,
  ileCanvasSlashKeyOpensBar,
  ileWorkCanvasEmptyNearbyOriginWithReserved,
  ileWorkCanvasCenterScroll,
  ileWorkCanvasContentBounds,
  ileWorkCanvasHasLiveElements,
  ileWorkCanvasShouldRestoreEmptyBoard,
  ileWorkCanvasThinkingOverlayStyle,
  ileWorkCanvasZoomAtPoint,
  ileWorkCanvasZoomValue,
  pasteIleWorkCanvasElements,
  ILE_WORK_CANVAS_SCROLL_TO_CONTENT_OPTS,
  type IleWorkCanvasAskKind,
  type IleWorkCanvasElement,
  type IleWorkCanvasFiles,
  type IleWorkCanvasScene,
  type IleWorkCanvasSkeleton,
} from "@/lib/learn-work-canvas";
import { type IleCanvasCraftInsightConfig } from "@/components/session-view/learn-canvas-craft-insight";
import {
  IleWorkCanvasPowCollector,
  ileWorkCanvasGestureBusy,
  type IleWorkCanvasPowEvent,
} from "@/lib/learn-work-canvas-pow";
import {
  commitScene,
  liveSceneElements,
  type LiveExcalidrawAPI,
  type LiveExcalidrawAppState,
} from "@/components/excalidraw-canvas/excalidraw-api";
import { useSessionMarkCanvas } from "@/components/excalidraw-canvas/use-session-mark-canvas";
import { useWorkCanvasThinking } from "@/components/excalidraw-canvas/use-work-canvas-thinking";
import { useWorkCanvasCommands } from "@/components/excalidraw-canvas/use-work-canvas-commands";
import "@excalidraw/excalidraw/index.css";
import "@/app/learn-excalidraw-theme.css";

export interface ExcalidrawCanvasProps {
  initialData?: string;
  initialSceneData?: IleWorkCanvasScene | null;
  onCanvasChange?: (data: string) => void;
  onSceneChange?: (data: IleWorkCanvasScene) => void;
  onSubmitToHelios?: (dataUrl?: string | null) => Promise<void> | void;
  canSubmitToHelios?: boolean;
  /** Override default "I'm Done Drawing" label (e.g. Project Mode "To solution"). */
  submitLabel?: string;
  /** When nonce changes, merge these elements onto the live board via commitScene. */
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
  /** Helios/XAI in-flight (Verify wait, Learn send) — same overlay chip as ask-about-selection. */
  heliosBusy?: boolean;
  /**
   * Purity clock. Canvas chunk load and an in-flight XAI reply are waits,
   * not learner silence. Omitted on surfaces that do not score silence.
   */
  onLearnerWaitChange?: (wait: { canvasLoading: boolean; waitingForXaiReply: boolean }) => void;
  /** Learn: craft an insight linked to this chapter. */
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
  /**
   * Calibrate, Learn, or Verify. The four buttons are the work.
   * Omit on boards that are not one of those sessions.
   */
  sessionMarkMode?: "calibrate" | "learn" | "verification" | null;
  sessionMarkQuestions?: readonly { id?: string | null; text?: string | null }[];
  /** Session and chapter. Growing questions inside one key keeps the presses. */
  sessionMarkListKey?: string | null;
}

/**
 * Shared Learn/Verify work board. Hosts must not fork this — both surfaces
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
  sessionMarkMode = null,
  sessionMarkQuestions,
  sessionMarkListKey = null,
}: ExcalidrawCanvasProps) {
  const { t } = useI18n();
  const submitButtonLabel = submitLabel || t("whiteboard.submitToHelios");
  const excalidrawAPIRef = useRef<LiveExcalidrawAPI | null>(null);
  const canvasHostRef = useRef<HTMLDivElement>(null);
  const [isSubmittingToHelios, setIsSubmittingToHelios] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [canvasApiReady, setCanvasApiReady] = useState(false);
  const [commandText, setCommandText] = useState("");
  const [slashBarOpen, setSlashBarOpen] = useState(false);
  const commandInputRef = useRef<HTMLInputElement>(null);

  const selectionWasActiveRef = useRef(false);
  const [askInFlight, setAskInFlight] = useState(0);
  const [craftInsightOpen, setCraftInsightOpen] = useState(false);
  const lastReplaceNonceRef = useRef<string | number | null>(null);
  const [canvasSelectionActive, setCanvasSelectionActive] = useState(false);
  const [autoLayoutEnabled, setAutoLayoutEnabled] = useState(false);
  const harnessSuggestion = useSessionPolicySuggestion();
  const harnessInferences = useSessionPolicyInferences();
  const harnessSuggestionRef = useRef(harnessSuggestion);
  const harnessInferencesRef = useRef(harnessInferences);
  harnessSuggestionRef.current = harnessSuggestion;
  harnessInferencesRef.current = harnessInferences;
  const sessionMarkModeRef = useRef(sessionMarkMode);
  sessionMarkModeRef.current = sessionMarkMode;
  const sessionBranchSlot = useSessionBranchSlot();
  const sessionBranchRef = useRef<SessionBranchModel | null>(null);
  sessionBranchRef.current = sessionBranchSlot?.status === "ready" ? sessionBranchSlot.model : null;
  const openBranchQuestions = openSessionBranchQuestions(sessionBranchRef.current);
  const sessionMarkQuestionsForBar =
    openBranchQuestions.length > 0 ? openBranchQuestions : sessionMarkQuestions;
  const [promptBarWidth, setPromptBarWidth] = useState(ILE_CANVAS_PROMPT_BAR_FALLBACK_WIDTH);
  const [promptHost, setPromptHost] = useState({ width: 0, height: 0 });
  const onAskSelectedRef = useRef(onAskSelected);
  const askInFlightRef = useRef(0);
  const applyingRemoteRef = useRef(false);

  const sceneDataRef = useRef<IleWorkCanvasScene | null>(null);
  const initialSceneDataRef = useRef(openCanvasScene(initialSceneData, !openFocusRole));
  const onSceneChangeRef = useRef(onSceneChange);
  const onCanvasPowActionsRef = useRef(onCanvasPowActions);
  const publishSessionProof = usePublishSessionProof();
  const publishSessionProofRef = useRef(publishSessionProof);
  publishSessionProofRef.current = publishSessionProof;
  const emitCanvasPowRef = useRef<(powEvents: IleWorkCanvasPowEvent[]) => void>(() => {});
  emitCanvasPowRef.current = (powEvents) => {
    if (!powEvents.length) return;
    onCanvasPowActionsRef.current?.(powEvents);
    publishSessionProofRef.current(powEvents);
  };
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
      if (!api) return;
      const elements = (api.getSceneElements() ?? []).filter((el) => !el.isDeleted);
      const appState = api.getAppState() ?? {};
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
        ? elements.filter((el) => el.customData?.calibrateRole === role)
        : [];
      if (role && !focused.length) {
        if (centerTriesRef.current < 40) {
          centerTriesRef.current += 1;
          centerRafRef.current = requestAnimationFrame(run);
        }
        return;
      }
      if (focused.length) {
        const bounds = ileWorkCanvasContentBounds(focused);
        const scroll = ileWorkCanvasCenterScroll(bounds, { width, height, zoom: { value: 1 } });
        if (scroll) {
          const offsetLeft = Number(appState.offsetLeft) || 0;
          const offsetTop = Number(appState.offsetTop) || 0;
          try {
            commitScene(
              api,
              {
                appState: {
                  zoom: { value: 1 },
                  scrollX: scroll.scrollX - offsetLeft,
                  scrollY: scroll.scrollY - offsetTop,
                },
              },
              { remote: false },
            );
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
    const live = liveSceneElements(api);
    const liveCount = live.filter((el) => !el.isDeleted).length;
    if (
      ileWorkCanvasShouldRestoreEmptyBoard({
        liveNonDeletedCount: liveCount,
        initialHasLive: ileWorkCanvasHasLiveElements(initial),
        userCleared: userClearedRef.current || live.some((el) => el.isDeleted),
      })
    ) {
      commitScene(api, { elements: initial.elements }, { applyingRemote: applyingRemoteRef });
    }
    if (!pending || pending.nonce === lastApplyNonceRef.current) {
      pendingApplyRef.current = null;
      scheduleCenterOnOpen();
      return;
    }
    lastApplyNonceRef.current = pending.nonce;
    pendingApplyRef.current = null;
    const incoming = (pending.elements ?? []).filter(
      (el): el is IleWorkCanvasElement => Boolean(el && typeof el === "object"),
    );
    const removeIds = new Set(pending.removeIds ?? []);
    const existing = (api.getSceneElements() ?? []).filter((el) => !el?.id || !removeIds.has(el.id));
    const existingIds = new Set(existing.map((el) => el.id));
    const toAdd = incoming.filter((el) => el && typeof el === "object" && !existingIds.has(el.id));
    if (!toAdd.length && !removeIds.size) {
      scheduleCenterOnOpen();
      return;
    }
    const merged = pasteIleWorkCanvasElements({
      existing,
      incoming: toAdd,
    });
    const addedIds = new Set(toAdd.map((el) => el.id).filter(Boolean));
    const added = merged.filter((el) => addedIds.has(el.id) && !el.isDeleted);
    const shouldScroll = Boolean(added.length && scrollAppliedElementsRef.current);
    commitScene(
      api,
      {
        elements: merged,
        appState: { selectedElementIds: {} },
      },
      { applyingRemote: applyingRemoteRef },
    );
    if (shouldScroll) {
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
    const width = ileCanvasPromptBarWidth(
      toolbarRect ? { width: toolbarRect.width } : null,
    );
    const hostWidth = Math.round(hostRect.width);
    const hostHeight = Math.round(hostRect.height);
    setPromptBarWidth((prev) => (prev === width ? prev : width));
    setPromptHost((prev) =>
      prev.width === hostWidth && prev.height === hostHeight ? prev : { width: hostWidth, height: hostHeight },
    );
  }, []);

  const setExcalidrawAPI = useCallback((api: LiveExcalidrawAPI) => {
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
    canvasPowCollectorRef.current.reset(openCanvasScene(initialSceneData, false));
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
    return () => {
      onLearnerWaitChangeRef.current?.({
        canvasLoading: true,
        waitingForXaiReply: false,
      });
    };
  }, []);

  const {
    thinkingChips,
    thinkingChipsRef,
    thinkingHostByIdRef,
    thinkingOverlayBox,
    thinkingTick,
    projectThinkingChip,
    reservedThinkingOrigins,
    upsertThinkingChip,
    removeThinkingChip,
    handleThinkingChipPointerDown,
    handleThinkingChipPointerMove,
    handleThinkingChipPointerUp,
    syncThinkingOverlay,
  } = useWorkCanvasThinking({
    apiRef: excalidrawAPIRef,
    sceneDataRef,
    canvasHostOrigin,
    heliosBusy,
    askInFlight,
    isLoaded,
  });

  const syncCanvasSelection = useCallback((appState: LiveExcalidrawAppState) => {
    const active =
      Boolean(onAskSelectedRef.current) &&
      ileCanvasPromptMode(appState?.selectedElementIds ?? {}) === "commands";
    if (selectionWasActiveRef.current && !active) {
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

  const commands = useWorkCanvasCommands({
    apiRef: excalidrawAPIRef,
    applyingRemoteRef,
    canvasPowCollectorRef,
    emitCanvasPow: (events) => emitCanvasPowRef.current(events),
    onAskSelectedRef,
    thinkingChipsRef,
    reservedThinkingOrigins,
    projectThinkingChip,
    upsertThinkingChip,
    removeThinkingChip,
    sessionMarkModeRef,
    harnessSuggestionRef,
    harnessInferencesRef,
    commandText,
    setCommandText,
    setAutoLayoutEnabled,
    setAskInFlight,
    askInFlightRef,
  });
  const {
    selectedCanvasElements,
    handleQuickAction,
    handleQuickActionRef,
    toggleAutoLayout,
    toggleAutoLayoutRef,
    writeDictatedText,
    submitCommand,
  } = commands;

  useSessionMarkCanvas({
    apiRef: excalidrawAPIRef,
    canvasApiReady,
    applyingRemoteRef,
    canvasPowCollectorRef,
    sessionBranchRef,
    selectedCanvasElements,
  });

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typingInField =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        Boolean(target?.isContentEditable);
      if (typingInField) return;
      const letter = ileWorkCanvasCommandShortcutKeyFromEvent(event);
      if (letter) {
        if (letter === ILE_WORK_CANVAS_AUTO_LAYOUT_SHORTCUT) {
          event.preventDefault();
          toggleAutoLayoutRef.current();
          return;
        }
        const command = ileWorkCanvasCommandByShortcut(letter, sessionMarkModeRef.current);
        if (command) {
          event.preventDefault();
          handleQuickActionRef.current(command.id);
          return;
        }
      }
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
  }, [canvasSelectionActive, handleQuickActionRef, toggleAutoLayoutRef]);

  useEffect(() => {
    if (!ileCanvasSlashBarOpen({
      selectionActive: canvasSelectionActive,
      slashIntent: slashBarOpen,
    })) {
      return;
    }
    commandInputRef.current?.focus();
  }, [canvasSelectionActive, slashBarOpen]);

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
    const liveElements = [...(api.getSceneElements() ?? [])];
    const origin = ileWorkCanvasEmptyNearbyOriginWithReserved({
      elements: liveElements,
      reserved: reservedThinkingOrigins(),
      box: ileWorkCanvasThinkingOverlayStyle(),
    });
    const liveAppState = api.getAppState() ?? {};
    upsertThinkingChip(projectThinkingChip(turnId, origin, liveAppState));
    const timer = window.setTimeout(() => {
      const next = sanitizeSceneData(replaceScene ?? { elements: [], appState: {}, files: {} });
      commitScene(
        api,
        { elements: next.elements, appState: next.appState },
        { applyingRemote: applyingRemoteRef },
      );
      canvasPowCollectorRef.current.syncWithoutEmit({
        elements: next.elements,
        appState: api.getAppState() ?? next.appState,
        files: api.getFiles() ?? next.files,
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
    const next = openCanvasScene(initialSceneData, true);
    initialSceneDataRef.current = next;
    if (ileWorkCanvasHasLiveElements(initialSceneData)) {
      userClearedRef.current = false;
      flushPendingApply();
    }
  }, [initialSceneData, flushPendingApply]);

  const exportToPNG = useCallback(async (): Promise<string | null> => {
    return exportWorkCanvasPng(excalidrawAPIRef.current);
  }, []);

  const debouncedExportPNG = useCallback(() => {
    if (!onCanvasChange) return;
    if (exportTimeoutRef.current) {
      clearTimeout(exportTimeoutRef.current);
    }
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

  const handleChange = useCallback(
    (
      elements: readonly IleWorkCanvasElement[],
      appState: LiveExcalidrawAppState,
      files: IleWorkCanvasFiles,
    ) => {
      const previous = sceneDataRef.current;
      const sceneData = sanitizeSceneData({ elements: [...elements], appState, files });
      const prevLive = ileWorkCanvasHasLiveElements(previous);
      const nextLive = ileWorkCanvasHasLiveElements(sceneData);
      const deletedSnapshot = (sceneData.elements ?? []).some((el) => el.isDeleted);
      if (!applyingRemoteRef.current && prevLive && !nextLive && deletedSnapshot) {
        userClearedRef.current = true;
        initialSceneDataRef.current = sceneData;
      } else if (nextLive) {
        userClearedRef.current = false;
      }
      sceneDataRef.current = sceneData ?? null;
      if (!applyingRemoteRef.current) {
        const acked = acknowledgeIleWorkCanvasXaiNotes(
          sceneData.elements,
          appState?.selectedElementIds ?? {},
        );
        if (acked.changed) {
          commitScene(
            excalidrawAPIRef.current,
            { elements: acked.elements },
            { applyingRemote: applyingRemoteRef },
          );
          sceneData.elements = acked.elements;
          sceneDataRef.current = sceneData;
        }
      }
      if (applyingRemoteRef.current) {
        canvasPowCollectorRef.current.syncWithoutEmit(sceneData);
      } else {
        const powEvents = canvasPowCollectorRef.current.observeScene(sceneData, {
          gestureBusy: ileWorkCanvasGestureBusy(appState),
        });
        emitCanvasPowRef.current(powEvents);
      }
      if (scenePersistTimeoutRef.current) clearTimeout(scenePersistTimeoutRef.current);
      scenePersistTimeoutRef.current = setTimeout(() => {
        if (!sceneData) return;
        const json = JSON.stringify(sceneData);
        if (json === lastPersistedSceneJsonRef.current) return;
        lastPersistedSceneJsonRef.current = json;
        onSceneChangeRef.current?.(sceneData);
      }, 250);
      debouncedExportPNG();
      syncCanvasSelection(appState);
      syncThinkingOverlay(appState);
    },
    [debouncedExportPNG, syncCanvasSelection, syncThinkingOverlay],
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
          elements: [...(api?.getSceneElements() ?? [])],
          appState: api?.getAppState() ?? {},
          files: api?.getFiles() ?? {},
        });
        const powEvents = canvasPowCollectorRef.current.observeScene(scene, {
          gestureBusy: false,
        });
        emitCanvasPowRef.current(powEvents);
      }
    },
    [syncCanvasSelection],
  );

  const handleSubmitToHelios = useCallback(async () => {
    if (!onSubmitToHelios || isSubmittingToHelios || !canSubmitToHelios) return;
    setIsSubmittingToHelios(true);
    try {
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
        const appState = api.getAppState() ?? {};
        syncCanvasSelection(appState);
        syncThinkingOverlay(appState);
      }
    };
    const unbind = bindIleSurfaceEditorEvents(host, refreshSurface);
    const unbindZoom = bindIleSurfaceWheelZoom(host, (input) => {
      const api = excalidrawAPIRef.current;
      if (!api) return;
      const appState = api.getAppState() ?? {};
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
        commitScene(
          api,
          {
            appState: {
              zoom: { value: next.zoom },
              scrollX: next.scrollX,
              scrollY: next.scrollY,
            },
          },
          { remote: false },
        );
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
    ileWorkCanvasHasLiveElements(initialSceneData)
  ) {
    initialSceneDataRef.current = openCanvasScene(initialSceneData, !openFocusRole);
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
          onChipPointerDown={handleThinkingChipPointerDown}
          onChipPointerMove={handleThinkingChipPointerMove}
          onChipPointerUp={handleThinkingChipPointerUp}
        />
        {onAskSelected ? (
          <CanvasPromptBar
            askInFlight={askInFlight}
            canvasSelectionActive={canvasSelectionActive}
            promptBarWidth={promptBarWidth}
            hostWidth={promptHost.width}
            hostHeight={promptHost.height}
            submitCommand={submitCommand}
            slashBarOpen={slashBarOpen}
            commandText={commandText}
            setCommandText={setCommandText}
            handleQuickAction={handleQuickAction}
            commandInputRef={commandInputRef}
            craftInsight={craftInsight}
            setCraftInsightOpen={setCraftInsightOpen}
            dictateTranscript={dictateTranscript}
            viewModeEnabled={viewModeEnabled}
            writeDictatedText={writeDictatedText}
            autoLayoutEnabled={autoLayoutEnabled}
            onToggleAutoLayout={toggleAutoLayout}
            onDictateActive={onDictateActive}
            craftInsightOpen={craftInsightOpen}
            selectedCanvasElements={selectedCanvasElements}
            sessionMarkMode={sessionMarkMode}
            sessionMarkQuestions={sessionMarkQuestionsForBar}
            sessionMarkListKey={sessionMarkListKey}
            selectedMarkTexts={selectedCanvasElements()
              .map((element) => element.text || "")
              .filter((text) => text.trim())}
            markSpeech={dictateTranscript || ""}
          />
        ) : null}
      </div>
    </div>
  );
}

/**
 * Learn/Verify work board — same component, same features. Required props
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
