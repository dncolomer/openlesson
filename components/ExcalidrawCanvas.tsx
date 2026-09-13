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
import { bindIleSurfaceResize } from "@/lib/ile-compact-window";
import {
  ILE_HELIOS_THINKING_ROTATE_MS,
  ileHeliosThinkingLine,
} from "@/lib/ile-dialogue-turn";
import {
  clampIleLearnMorePosition,
  ILE_LEARN_MORE_BOX_WIDTH,
  ILE_LEARN_MORE_LABEL,
  ileLearnMorePromptPlacement,
  ileLearnMoreSelectionKey,
  ileWorkCanvasEmptyNearbyOrigin,
  ileWorkCanvasHasLiveElements,
  ileWorkCanvasPointerBusy,
  ileWorkCanvasSceneToViewport,
  ileWorkCanvasZoomValue,
  applyIleXaiTurnToWorkCanvas,
  serializeIleWorkCanvasScene,
  withIleWorkCanvasGridAppState,
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
    export: false,
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
  initialData: { elements: any[]; appState: any; files: any };
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

interface ExcalidrawCanvasProps {
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
  }) => Promise<{ text: string; elements?: IleWorkCanvasSkeleton[] | null }>;
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
 * Excalidraw-based whiteboard canvas for desktop SessionView.
 * Replaces the old custom canvas implementation with Excalidraw's
 * full-featured drawing capabilities.
 * 
 * Exports PNG data URL on changes (debounced) for compatibility with
 * the existing storage/analysis pipeline.
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
  const [askBusy, setAskBusy] = useState(false);
  const [learnMoreUi, setLearnMoreUi] = useState<{
    count: number;
    left: number;
    top: number;
  } | null>(null);
  const [learnMoreDragging, setLearnMoreDragging] = useState(false);
  const [thinkingTick, setThinkingTick] = useState(0);
  const [thinkingOrigin, setThinkingOrigin] = useState<{
    x: number;
    y: number;
    left: number;
    top: number;
    zoom: number;
  } | null>(null);
  const onAskSelectedRef = useRef(onAskSelected);
  const askBusyRef = useRef(askBusy);
  const learnMoreUiRef = useRef(learnMoreUi);
  const learnMoreKeyRef = useRef("");
  const learnMorePinnedRef = useRef<{ key: string; left: number; top: number } | null>(null);
  const learnMoreDragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    origLeft: number;
    origTop: number;
  } | null>(null);
  
  // Store the latest scene data for PNG export
   
  const sceneDataRef = useRef<{ elements: any[]; appState: any; files: any } | null>(null);
  const initialSceneDataRef = useRef(sanitizeSceneData(initialSceneData));
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
  const thinkingHostRef = useRef<HTMLDivElement>(null);
  const thinkingSceneRef = useRef<{ x: number; y: number } | null>(null);
  const applyingRemoteRef = useRef(false);
  const sceneFingerprintRef = useRef("");
  const remoteNonceRef = useRef(0);
  const [collaborating, setCollaborating] = useState(false);
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
    if (!toAdd.length && !removeIds.size) return;
    applyingRemoteRef.current = true;
    try {
      api.updateScene({ elements: [...existing, ...toAdd] });
    } finally {
      applyingRemoteRef.current = false;
    }
  }, []);

  const setExcalidrawAPI = useCallback((api: ExcalidrawAPIRef) => {
    excalidrawAPIRef.current = api;
    flushPendingApply();
  }, [flushPendingApply]);

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
  }, [boardId, peerId]);

  useEffect(() => {
    askBusyRef.current = askBusy;
  }, [askBusy]);

  useEffect(() => {
    learnMoreUiRef.current = learnMoreUi;
  }, [learnMoreUi]);

  const showHeliosThinking = askBusy || heliosBusy;

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
    if (askBusy) return;
    if (!heliosBusy) {
      thinkingSceneRef.current = null;
      setThinkingOrigin(null);
      return;
    }
    const api = excalidrawAPIRef.current;
    const elements = (api?.getSceneElements?.() ?? sceneDataRef.current?.elements ?? []) as IleWorkCanvasElement[];
    const origin = ileWorkCanvasEmptyNearbyOrigin({ elements });
    const appState = api?.getAppState?.() ?? sceneDataRef.current?.appState ?? {};
    const vp = ileWorkCanvasSceneToViewport(origin, appState);
    thinkingSceneRef.current = origin;
    setThinkingOrigin({
      x: origin.x,
      y: origin.y,
      left: Math.round(vp.x),
      top: Math.round(vp.y),
      zoom: ileWorkCanvasZoomValue(appState),
    });
  }, [heliosBusy, askBusy, isLoaded]);

  const syncThinkingOverlay = useCallback((appState: any) => {
    const scene = thinkingSceneRef.current;
    const node = thinkingHostRef.current;
    if (!scene || !node) return;
    const vp = ileWorkCanvasSceneToViewport(scene, appState);
    const zoom = ileWorkCanvasZoomValue(appState);
    node.style.left = `${Math.round(vp.x)}px`;
    node.style.top = `${Math.round(vp.y)}px`;
    node.style.transform = `scale(${zoom})`;
  }, []);

  const learnMoreViewport = useCallback((appState: any) => {
    const host = canvasHostRef.current;
    return {
      left: Number(appState?.offsetLeft) || 0,
      top: Number(appState?.offsetTop) || 0,
      width: Number(appState?.width) || host?.clientWidth || 0,
      height: Number(appState?.height) || host?.clientHeight || 0,
    };
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
    if (ileWorkCanvasPointerBusy(appState) && !learnMoreDragRef.current) return;
    const selectedIds = appState?.selectedElementIds ?? {};
    const selectionKey = ileLearnMoreSelectionKey(selectedIds);
    const viewport = learnMoreViewport(appState);
    const pinned = learnMorePinnedRef.current;
    if (pinned && pinned.key !== selectionKey) learnMorePinnedRef.current = null;
    let next: { count: number; left: number; top: number } | null = null;
    if (learnMorePinnedRef.current && learnMorePinnedRef.current.key === selectionKey) {
      const held = clampIleLearnMorePosition({
        left: learnMorePinnedRef.current.left,
        top: learnMorePinnedRef.current.top,
        viewport,
      });
      learnMorePinnedRef.current = { key: selectionKey, ...held };
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
      });
      next =
        placed ??
        (askBusyRef.current && learnMoreUiRef.current ? learnMoreUiRef.current : null);
    }
    const key = next ? `${next.count}:${next.left}:${next.top}` : "";
    if (key === learnMoreKeyRef.current) return;
    learnMoreKeyRef.current = key;
    setLearnMoreUi(next);
  }, [learnMoreViewport]);

  const handleAskSelected = useCallback(async () => {
    const ask = onAskSelectedRef.current;
    const api = excalidrawAPIRef.current;
    const prompt = askPrompt.trim();
    if (!ask || !api || !prompt || askBusy) return;
    const appState = api.getAppState?.() ?? {};
    const selectedIds = appState.selectedElementIds ?? {};
    const selected = (api.getSceneElements?.() ?? []).filter(
      (el: { id?: string; isDeleted?: boolean }) =>
        el?.id && selectedIds[el.id] && !el.isDeleted,
    ) as IleWorkCanvasElement[];
    if (!selected.length) return;
    const turnId = `ask-${Date.now()}`;
    const liveElements = (api.getSceneElements?.() ?? []) as IleWorkCanvasElement[];
    const origin = ileWorkCanvasEmptyNearbyOrigin({
      elements: liveElements,
      near: selected,
    });
    const liveAppState = api.getAppState?.() ?? appState;
    const vp = ileWorkCanvasSceneToViewport(origin, liveAppState);
    thinkingSceneRef.current = origin;
    setThinkingOrigin({
      x: origin.x,
      y: origin.y,
      left: Math.round(vp.x),
      top: Math.round(vp.y),
      zoom: ileWorkCanvasZoomValue(liveAppState),
    });
    setAskBusy(true);
    try {
      const scene = serializeIleWorkCanvasScene({
        elements: api.getSceneElements?.() ?? [],
        appState: api.getAppState?.() ?? {},
        files: api.getFiles?.() ?? {},
      });
      const reply = await ask({ prompt, selectedElements: selected, scene });
      const next = applyIleXaiTurnToWorkCanvas(scene, {
        text: reply?.text || "No reply",
        elements: reply?.elements,
        turnId,
        origin,
      });
      api.updateScene({ elements: next.elements });
      setAskPrompt("");
    } catch (err) {
      console.error("[ExcalidrawCanvas] Ask XAI failed:", err);
      const scene = serializeIleWorkCanvasScene({
        elements: api.getSceneElements?.() ?? [],
        appState: api.getAppState?.() ?? {},
        files: api.getFiles?.() ?? {},
      });
      const next = applyIleXaiTurnToWorkCanvas(scene, {
        text: "Learn more failed. Try again.",
        turnId,
        origin,
      });
      api.updateScene({ elements: next.elements });
    } finally {
      thinkingSceneRef.current = null;
      setThinkingOrigin(null);
      setAskBusy(false);
    }
  }, [askBusy, askPrompt]);

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
    learnMorePinnedRef.current = {
      key: ileLearnMoreSelectionKey(appState?.selectedElementIds) || "*",
      left: origLeft,
      top: origTop,
    };
    setLearnMoreDragging(true);
  }, []);

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
    const selectionKey = ileLearnMoreSelectionKey(appState?.selectedElementIds);
    learnMorePinnedRef.current = {
      key: selectionKey || learnMorePinnedRef.current?.key || "*",
      ...next,
    };
    const ui = {
      count: learnMoreUiRef.current?.count ?? 1,
      ...next,
    };
    const key = `${ui.count}:${ui.left}:${ui.top}`;
    if (key === learnMoreKeyRef.current) return;
    learnMoreKeyRef.current = key;
    setLearnMoreUi(ui);
  }, [learnMoreViewport]);

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
    initialSceneDataRef.current = sanitizeSceneData(initialSceneData);
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
      const id = String(boardId || "").trim();
      if (!id) return;
      const appState = excalidrawAPIRef.current?.getAppState?.() ?? {};
      publishIleWorkCanvasRoom(id, {
        kind: "pointer",
        from: peerId,
        pointer: payload.pointer,
        button: payload.button,
        selectedElementIds: appState.selectedElementIds,
      });
    },
    [boardId, peerId],
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
    };
  }, []);

  // Mark as loaded after mount
  useEffect(() => {
    setIsLoaded(true);
  }, []);

  useEffect(() => {
    return bindIleSurfaceResize(canvasHostRef.current, () => {
      const api = excalidrawAPIRef.current;
      if (api && typeof api.refresh === "function") {
        api.refresh();
      }
      if (api) {
        const appState = api.getAppState?.() ?? {};
        syncLearnMorePlacement(api.getSceneElements?.() ?? [], appState);
        syncThinkingOverlay(appState);
      }
    });
  }, [isLoaded, syncLearnMorePlacement, syncThinkingOverlay]);

  return (
    <div className="flex flex-col h-full bg-[#0a0a0a] rounded-none overflow-hidden">
      {onSubmitToHelios && (
      <div className="flex items-center justify-end gap-2 p-2 border-b border-neutral-800 bg-neutral-900/30">
        {onSubmitToHelios && (
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
        )}
      </div>
      )}

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
        {showHeliosThinking && thinkingOrigin ? (
          <div
            ref={thinkingHostRef}
            data-ile-canvas-thinking
            className="pointer-events-none absolute z-[55] origin-top-left"
            style={{
              left: thinkingOrigin.left,
              top: thinkingOrigin.top,
              transform: `scale(${thinkingOrigin.zoom})`,
            }}
          >
            <div
              data-ile-canvas-thinking-chip
              className="animate-ile-canvas-thinking flex items-center gap-2.5 rounded-none border border-white bg-neutral-950/92 px-3 py-2 shadow-[0_10px_32px_rgba(0,0,0,0.55)]"
            >
              <span className="relative flex h-5 w-5 items-center justify-center" aria-hidden>
                <span className="animate-ile-canvas-thinking-orbit absolute inset-0 rounded-full border border-white/30 border-t-white" />
                <span className="h-1.5 w-1.5 rounded-full bg-white" />
              </span>
              <span
                data-ile-canvas-thinking-copy
                className="font-mono text-[11px] uppercase tracking-wider text-white"
              >
                {ileHeliosThinkingLine(thinkingTick)}
              </span>
              <span className="flex items-center gap-1" aria-hidden>
                <span className="size-1 animate-bounce rounded-full bg-white" style={{ animationDelay: "0ms" }} />
                <span className="size-1 animate-bounce rounded-full bg-white" style={{ animationDelay: "150ms" }} />
                <span className="size-1 animate-bounce rounded-full bg-white" style={{ animationDelay: "300ms" }} />
              </span>
            </div>
          </div>
        ) : null}
        {onAskSelected && learnMoreUi ? (
          <form
            data-ile-excalidraw-ask
            data-ile-learn-more
            data-ile-learn-more-dragging={learnMoreDragging ? "true" : undefined}
            data-ile-excalidraw-ask-busy={askBusy ? "true" : undefined}
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
                disabled={askBusy}
                onChange={(event) => setAskPrompt(event.target.value)}
                placeholder="Prompt a question about this selection"
                className="min-w-0 flex-1 rounded-none border border-neutral-600 bg-neutral-900 px-2 py-1.5 text-sm text-white placeholder-neutral-500 focus:border-white focus:outline-none"
              />
              <button
                type="submit"
                data-ile-excalidraw-ask-send
                disabled={askBusy || !askPrompt.trim()}
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
