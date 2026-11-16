"use client";

import { useCallback, useLayoutEffect, useRef, useState, type MutableRefObject } from "react";
import type { LiveExcalidrawAppState } from "@/components/excalidraw-canvas/excalidraw-api";
import {
  ileWorkCanvasLatexSignature,
  ileWorkCanvasLatexTargets,
  type IleWorkCanvasLatexTarget,
} from "@/lib/learn-work-canvas-latex";
import {
  ileWorkCanvasSceneToViewport,
  ileWorkCanvasViewportToHost,
  ileWorkCanvasZoomValue,
  type IleWorkCanvasHostRect,
  type IleWorkCanvasScene,
} from "@/lib/learn-work-canvas";

function placeLatexNodes(
  items: readonly IleWorkCanvasLatexTarget[],
  appState: LiveExcalidrawAppState,
  host: IleWorkCanvasHostRect,
  nodes: Map<string, HTMLDivElement>,
) {
  const zoom = ileWorkCanvasZoomValue(appState);
  for (const item of items) {
    const node = nodes.get(item.id);
    if (!node) continue;
    const vp = ileWorkCanvasViewportToHost(
      ileWorkCanvasSceneToViewport({ x: item.x, y: item.y }, appState),
      host,
    );
    node.style.left = `${Math.round(vp.x)}px`;
    node.style.top = `${Math.round(vp.y)}px`;
    node.style.transform = `scale(${zoom})`;
    node.style.width = `${item.width}px`;
    node.style.minHeight = `${item.height}px`;
    node.style.fontSize = `${item.fontSize}px`;
  }
}

export function useWorkCanvasLatex(input: {
  sceneDataRef: MutableRefObject<IleWorkCanvasScene | null>;
  canvasHostOrigin: () => IleWorkCanvasHostRect;
}) {
  const { sceneDataRef, canvasHostOrigin } = input;
  const [items, setItems] = useState<IleWorkCanvasLatexTarget[]>([]);
  const hostByIdRef = useRef(new Map<string, HTMLDivElement>());
  const signatureRef = useRef("");
  const appStateRef = useRef<LiveExcalidrawAppState | null>(null);

  const syncLatexOverlay = useCallback(
    (appState: LiveExcalidrawAppState) => {
      appStateRef.current = appState;
      const next = ileWorkCanvasLatexTargets(sceneDataRef.current?.elements, appState);
      const signature = ileWorkCanvasLatexSignature(next);
      if (signature !== signatureRef.current) {
        signatureRef.current = signature;
        setItems(next);
      }
      placeLatexNodes(next, appState, canvasHostOrigin(), hostByIdRef.current);
    },
    [canvasHostOrigin, sceneDataRef],
  );

  useLayoutEffect(() => {
    const appState = appStateRef.current;
    if (!appState) return;
    placeLatexNodes(items, appState, canvasHostOrigin(), hostByIdRef.current);
  }, [canvasHostOrigin, items]);

  return { latexItems: items, latexHostByIdRef: hostByIdRef, syncLatexOverlay };
}
