"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MutableRefObject,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { ILE_HELIOS_THINKING_ROTATE_MS } from "@/lib/learn-dialogue-turn";
import {
  ileWorkCanvasDragThinkingOrigin,
  ileWorkCanvasEmptyNearbyOriginWithReserved,
  ileWorkCanvasSceneToViewport,
  ileWorkCanvasThinkingOccupancy,
  ileWorkCanvasThinkingOverlayStyle,
  ileWorkCanvasViewportToHost,
  ileWorkCanvasZoomValue,
  type IleWorkCanvasElement,
} from "@/lib/learn-work-canvas";
import type { LiveExcalidrawAPI, LiveExcalidrawAppState } from "@/components/excalidraw-canvas/excalidraw-api";

export type WorkCanvasThinkingChip = {
  turnId: string;
  x: number;
  y: number;
  left: number;
  top: number;
  zoom: number;
};

export function useWorkCanvasThinking(input: {
  apiRef: MutableRefObject<LiveExcalidrawAPI | null>;
  sceneDataRef: MutableRefObject<
    { elements: IleWorkCanvasElement[]; appState: LiveExcalidrawAppState; files: Record<string, unknown> } | null
  >;
  canvasHostOrigin: () => { left: number; top: number; width: number; height: number };
  heliosBusy: boolean;
  askInFlight: number;
  isLoaded: boolean;
}) {
  const { apiRef, sceneDataRef, canvasHostOrigin, heliosBusy, askInFlight, isLoaded } = input;
  const [thinkingTick, setThinkingTick] = useState(0);
  const [thinkingChips, setThinkingChips] = useState<WorkCanvasThinkingChip[]>([]);
  const thinkingChipsRef = useRef(thinkingChips);
  const thinkingHostByIdRef = useRef(new Map<string, HTMLDivElement>());
  const thinkingDragRef = useRef<{
    turnId: string;
    originX: number;
    originY: number;
    startClientX: number;
    startClientY: number;
    zoom: number;
  } | null>(null);

  useEffect(() => {
    thinkingChipsRef.current = thinkingChips;
  }, [thinkingChips]);

  const thinkingOverlayBox = ileWorkCanvasThinkingOverlayStyle();
  const showHeliosThinking = thinkingChips.length > 0;

  const projectThinkingChip = useCallback(
    (
      turnId: string,
      origin: { x: number; y: number },
      appState: LiveExcalidrawAppState,
    ): WorkCanvasThinkingChip => {
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

  const upsertThinkingChip = useCallback((chip: WorkCanvasThinkingChip) => {
    thinkingChipsRef.current = [
      ...thinkingChipsRef.current.filter((item) => item.turnId !== chip.turnId),
      chip,
    ];
    setThinkingChips(thinkingChipsRef.current);
  }, []);

  const removeThinkingChip = useCallback((turnId: string) => {
    if (thinkingDragRef.current?.turnId === turnId) thinkingDragRef.current = null;
    thinkingChipsRef.current = thinkingChipsRef.current.filter((chip) => chip.turnId !== turnId);
    thinkingHostByIdRef.current.delete(turnId);
    setThinkingChips(thinkingChipsRef.current);
  }, []);

  const handleThinkingChipPointerDown = useCallback(
    (turnId: string, event: ReactPointerEvent<HTMLDivElement>) => {
      if (event.button !== 0) return;
      event.preventDefault();
      event.stopPropagation();
      const chip = thinkingChipsRef.current.find((row) => row.turnId === turnId);
      if (!chip) return;
      const appState = apiRef.current?.getAppState() ?? sceneDataRef.current?.appState ?? {};
      thinkingDragRef.current = {
        turnId,
        originX: chip.x,
        originY: chip.y,
        startClientX: event.clientX,
        startClientY: event.clientY,
        zoom: ileWorkCanvasZoomValue(appState),
      };
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    [apiRef, sceneDataRef],
  );

  const handleThinkingChipPointerMove = useCallback(
    (turnId: string, event: ReactPointerEvent<HTMLDivElement>) => {
      const drag = thinkingDragRef.current;
      if (!drag || drag.turnId !== turnId) return;
      event.preventDefault();
      event.stopPropagation();
      const origin = ileWorkCanvasDragThinkingOrigin({
        origin: { x: drag.originX, y: drag.originY },
        startClientX: drag.startClientX,
        startClientY: drag.startClientY,
        clientX: event.clientX,
        clientY: event.clientY,
        zoom: drag.zoom,
      });
      const appState = apiRef.current?.getAppState() ?? sceneDataRef.current?.appState ?? {};
      const next = projectThinkingChip(turnId, origin, appState);
      thinkingChipsRef.current = [
        ...thinkingChipsRef.current.filter((row) => row.turnId !== turnId),
        next,
      ];
      setThinkingChips(thinkingChipsRef.current);
      const node = thinkingHostByIdRef.current.get(turnId);
      if (node) {
        node.style.left = `${next.left}px`;
        node.style.top = `${next.top}px`;
      }
    },
    [apiRef, projectThinkingChip, sceneDataRef],
  );

  const handleThinkingChipPointerUp = useCallback(
    (turnId: string, event: ReactPointerEvent<HTMLDivElement>) => {
      if (thinkingDragRef.current?.turnId !== turnId) return;
      event.preventDefault();
      event.stopPropagation();
      thinkingDragRef.current = null;
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
      setThinkingChips(thinkingChipsRef.current);
    },
    [],
  );

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
    const api = apiRef.current;
    const elements = (api?.getSceneElements() ?? sceneDataRef.current?.elements ?? []) as IleWorkCanvasElement[];
    const origin = ileWorkCanvasEmptyNearbyOriginWithReserved({
      elements,
      reserved: reservedThinkingOrigins("helios"),
      box: ileWorkCanvasThinkingOverlayStyle(),
    });
    const appState = api?.getAppState() ?? sceneDataRef.current?.appState ?? {};
    upsertThinkingChip(projectThinkingChip("helios", origin, appState));
  }, [
    apiRef,
    askInFlight,
    heliosBusy,
    isLoaded,
    projectThinkingChip,
    removeThinkingChip,
    reservedThinkingOrigins,
    sceneDataRef,
    upsertThinkingChip,
  ]);

  const syncThinkingOverlay = useCallback(
    (appState: LiveExcalidrawAppState) => {
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
    },
    [canvasHostOrigin],
  );

  return {
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
  };
}
