"use client";

import { useCallback, useEffect, useRef, type MutableRefObject } from "react";
import {
  usePublishSessionBranchSlot,
  useSessionMarkCanvasEffects,
} from "@/components/session-view/session-policy-context";
import {
  graftSessionBranchModel,
  type SessionBranchModel,
} from "@/lib/session-branch-model";
import {
  commitSessionAction,
  type SessionMarkCanvasEffect,
} from "@/lib/session-mark-canvas";
import type { IleWorkCanvasPowCollector } from "@/lib/learn-work-canvas-pow";
import type { IleWorkCanvasElement } from "@/lib/learn-work-canvas";
import {
  commitScene,
  liveWorkCanvasScene,
  type LiveExcalidrawAPI,
} from "@/components/excalidraw-canvas/excalidraw-api";

export function useSessionMarkCanvas(input: {
  apiRef: MutableRefObject<LiveExcalidrawAPI | null>;
  canvasApiReady: boolean;
  applyingRemoteRef: MutableRefObject<boolean>;
  canvasPowCollectorRef: MutableRefObject<IleWorkCanvasPowCollector>;
  sessionBranchRef: MutableRefObject<SessionBranchModel | null>;
  selectedCanvasElements: () => IleWorkCanvasElement[];
}) {
  const {
    apiRef,
    canvasApiReady,
    applyingRemoteRef,
    canvasPowCollectorRef,
    sessionBranchRef,
    selectedCanvasElements,
  } = input;
  const sessionMarkCanvasEffects = useSessionMarkCanvasEffects();
  const publishSessionBranch = usePublishSessionBranchSlot();
  const publishSessionBranchRef = useRef(publishSessionBranch);
  publishSessionBranchRef.current = publishSessionBranch;

  const applySessionMarkCanvasEffect = useCallback(
    (effect: SessionMarkCanvasEffect) => {
      const api = apiRef.current;
      if (!api) return;
      const selected = selectedCanvasElements();
      const live = liveWorkCanvasScene(api, true);
      const committed = commitSessionAction({
        elements: live.elements,
        selectedIds: selected.map((element) => element.id),
        model: sessionBranchRef.current,
        action: effect.kind,
        branchId: effect.branchId,
      });
      if (!committed.changed) return;
      if (committed.added.length > 0 || committed.selectedElementIds) {
        const scrollTarget = committed.anchor ? [committed.anchor] : committed.added;
        commitScene(
          api,
          committed.selectedElementIds
            ? { elements: committed.elements, appState: { selectedElementIds: committed.selectedElementIds } }
            : { elements: committed.elements },
          {
            applyingRemote: applyingRemoteRef,
            scrollTo: scrollTarget.length > 0 ? scrollTarget : null,
          },
        );
        canvasPowCollectorRef.current.syncWithoutEmit({
          elements: committed.elements,
          appState: {
            ...(api.getAppState() ?? {}),
            ...(committed.selectedElementIds ? { selectedElementIds: committed.selectedElementIds } : {}),
          },
          files: api.getFiles() ?? {},
        });
      }
      if (committed.model && committed.model !== sessionBranchRef.current) {
        const advanced = committed.model;
        publishSessionBranchRef.current((current) => ({
          status: "ready",
          model: current.birth ? graftSessionBranchModel(advanced, current.birth) : advanced,
          birth: current.birth ?? null,
          error: null,
        }));
      }
    },
    [
      apiRef,
      applyingRemoteRef,
      canvasPowCollectorRef,
      selectedCanvasElements,
      sessionBranchRef,
    ],
  );

  const applySessionMarkCanvasEffectRef = useRef(applySessionMarkCanvasEffect);
  applySessionMarkCanvasEffectRef.current = applySessionMarkCanvasEffect;
  useEffect(() => {
    if (!sessionMarkCanvasEffects) return;
    if (!canvasApiReady || !apiRef.current) {
      sessionMarkCanvasEffects.register(null);
      return;
    }
    const apply = (effect: SessionMarkCanvasEffect) => applySessionMarkCanvasEffectRef.current(effect);
    sessionMarkCanvasEffects.register(apply);
    return () => sessionMarkCanvasEffects.register(null);
  }, [apiRef, canvasApiReady, sessionMarkCanvasEffects]);
}
