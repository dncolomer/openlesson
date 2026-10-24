"use client";

import { useCallback, useRef, type Dispatch, type MutableRefObject, type SetStateAction } from "react";
import { sessionHarnessFocusLine } from "@/lib/session-harness";
import {
  ileCanvasCommandDraft,
  ileWorkCanvasAddedElementIds,
  ileWorkCanvasAskFallback,
  ileWorkCanvasAutoLayoutEnabled,
  ileWorkCanvasCommandNeedsSelection,
  ileWorkCanvasEmptyNearbyOriginWithReserved,
  ileWorkCanvasFiniteOrigin,
  ileWorkCanvasRevealScroll,
  ileWorkCanvasThinkingOverlayStyle,
  applyIleWorkCanvasAskReply,
  layoutIleWorkCanvasBoard,
  mergeIleXaiTurnOntoLiveWorkCanvas,
  runIleWorkCanvasCommand,
  ILE_AUTO_LAYOUT_APP_STATE_KEY,
  type IleWorkCanvasAskKind,
  type IleWorkCanvasCommandId,
  type IleWorkCanvasElement,
  type IleWorkCanvasScene,
  type IleWorkCanvasSkeleton,
} from "@/lib/learn-work-canvas";
import { syncIleDictatedTextOnWorkCanvas } from "@/lib/learn-canvas-dictate";
import type { IleWorkCanvasPowCollector, IleWorkCanvasPowEvent } from "@/lib/learn-work-canvas-pow";
import type { SessionPolicyInference } from "@/lib/session-policy-infer";
import {
  commitScene,
  liveWorkCanvasScene,
  type LiveExcalidrawAPI,
} from "@/components/excalidraw-canvas/excalidraw-api";
import type { WorkCanvasThinkingChip } from "@/components/excalidraw-canvas/use-work-canvas-thinking";

export function useWorkCanvasCommands(input: {
  apiRef: MutableRefObject<LiveExcalidrawAPI | null>;
  applyingRemoteRef: MutableRefObject<boolean>;
  canvasPowCollectorRef: MutableRefObject<IleWorkCanvasPowCollector>;
  emitCanvasPow: (events: IleWorkCanvasPowEvent[]) => void;
  onAskSelectedRef: MutableRefObject<
    | ((input: {
        prompt: string;
        selectedElements: IleWorkCanvasElement[];
        scene: IleWorkCanvasScene;
        kind?: IleWorkCanvasAskKind;
      }) => Promise<{
        text: string;
        elements?: IleWorkCanvasSkeleton[] | null;
        origin?: { x?: number; y?: number } | null;
        raw?: string | null;
      }>)
    | undefined
  >;
  thinkingChipsRef: MutableRefObject<WorkCanvasThinkingChip[]>;
  reservedThinkingOrigins: (exceptTurnId?: string) => { x: number; y: number }[];
  projectThinkingChip: (
    turnId: string,
    origin: { x: number; y: number },
    appState: ReturnType<LiveExcalidrawAPI["getAppState"]>,
  ) => WorkCanvasThinkingChip;
  upsertThinkingChip: (chip: WorkCanvasThinkingChip) => void;
  removeThinkingChip: (turnId: string) => void;
  sessionMarkModeRef: MutableRefObject<"calibrate" | "learn" | "verification" | null | undefined>;
  harnessSuggestionRef: MutableRefObject<string | null>;
  harnessInferencesRef: MutableRefObject<readonly SessionPolicyInference[]>;
  commandText: string;
  setCommandText: Dispatch<SetStateAction<string>>;
  setAutoLayoutEnabled: Dispatch<SetStateAction<boolean>>;
  setAskInFlight: Dispatch<SetStateAction<number>>;
  askInFlightRef: MutableRefObject<number>;
}) {
  const {
    apiRef,
    applyingRemoteRef,
    canvasPowCollectorRef,
    emitCanvasPow,
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
  } = input;
  const handleQuickActionRef = useRef<(id: IleWorkCanvasCommandId) => void>(() => {});
  const toggleAutoLayoutRef = useRef<() => void>(() => {});
  const askSeqRef = useRef(0);
  const applyChainRef = useRef(Promise.resolve());
  const dictateElementIdRef = useRef<string | null>(null);
  const emitCanvasPowRef = useRef(emitCanvasPow);
  emitCanvasPowRef.current = emitCanvasPow;

  const selectedCanvasElements = useCallback((): IleWorkCanvasElement[] => {
    const api = apiRef.current;
    const appState = api?.getAppState() ?? {};
    const selectedIds = appState.selectedElementIds ?? {};
    return (api?.getSceneElements() ?? []).filter(
      (el) => el?.id && selectedIds[el.id] && !el.isDeleted,
    );
  }, [apiRef]);

  const enqueueCanvasAskApply = useCallback((task: () => void) => {
    const run = applyChainRef.current.then(task, task);
    applyChainRef.current = run.catch(() => {});
    return run;
  }, []);

  const runCanvasAsk = useCallback(
    async (askInput: {
      prompt: string;
      selectedElements: IleWorkCanvasElement[];
      kind?: IleWorkCanvasAskKind;
    }) => {
      const ask = onAskSelectedRef.current;
      const api = apiRef.current;
      const prompt = askInput.prompt.trim();
      if (!ask || !api || !prompt) return false;
      const turnId = `ask-${Date.now()}-${++askSeqRef.current}`;
      const liveElements = [...(api.getSceneElements() ?? [])];
      const origin = ileWorkCanvasEmptyNearbyOriginWithReserved({
        elements: liveElements,
        reserved: reservedThinkingOrigins(),
        near: askInput.selectedElements.length ? askInput.selectedElements : liveElements,
        box: ileWorkCanvasThinkingOverlayStyle(),
      });
      const liveAppState = api.getAppState() ?? {};
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
        const live = liveWorkCanvasScene(api);
        const liveChip = thinkingChipsRef.current.find((chip) => chip.turnId === turnId);
        const placeAt = liveChip ? { x: liveChip.x, y: liveChip.y } : origin;
        const next = applyIleWorkCanvasAskReply({
          kind: askInput.kind,
          live,
          selectedElements: askInput.selectedElements,
          payload: {
            text: payload.text,
            raw: payload.raw,
            elements: payload.elements,
            origin: liveChip ? placeAt : payload.origin,
            turnId,
          },
          fallbackOrigin: placeAt,
          reserved: reservedThinkingOrigins(turnId),
        });
        const addedIds = new Set(ileWorkCanvasAddedElementIds(live, next));
        const added = next.elements.filter((el) => addedIds.has(el.id) && !el.isDeleted);
        const selectAdded = askInput.kind !== "concepts";
        const selectedElementIds = selectAdded
          ? Object.fromEntries(added.map((el) => [el.id, true]))
          : Object.fromEntries(
              askInput.selectedElements
                .filter((el) => el.id && !el.isDeleted)
                .map((el) => [el.id, true]),
            );
        const reveal = ileWorkCanvasRevealScroll(added, api.getAppState() ?? live.appState);
        commitScene(
          api,
          {
            elements: next.elements,
            appState: {
              selectedElementIds,
              ...(reveal ?? {}),
            },
            ...(next.files ? { files: next.files } : {}),
          },
          { applyingRemote: applyingRemoteRef },
        );
        canvasPowCollectorRef.current.syncWithoutEmit({
          elements: next.elements,
          appState: api.getAppState() ?? {},
          files: api.getFiles() ?? {},
        });
      };
      try {
        const scene = liveWorkCanvasScene(api);
        const reply = await ask({
          prompt,
          selectedElements: askInput.selectedElements,
          scene,
          kind: askInput.kind,
        });
        await enqueueCanvasAskApply(() => {
          applyReply({
            text: reply?.text || (askInput.kind && askInput.kind !== "ask" ? "" : "No reply"),
            raw: reply?.raw,
            elements: reply?.elements,
            origin: ileWorkCanvasFiniteOrigin(reply?.origin),
          });
        });
        return true;
      } catch (err) {
        console.error("[ExcalidrawCanvas] Ask XAI failed:", err);
        const fallback = ileWorkCanvasAskFallback(askInput.kind);
        await enqueueCanvasAskApply(() => {
          applyReply({ text: fallback });
        });
        return false;
      } finally {
        removeThinkingChip(turnId);
        askInFlightRef.current = Math.max(0, askInFlightRef.current - 1);
        setAskInFlight(askInFlightRef.current);
      }
    },
    [
      apiRef,
      applyingRemoteRef,
      askInFlightRef,
      canvasPowCollectorRef,
      enqueueCanvasAskApply,
      onAskSelectedRef,
      projectThinkingChip,
      removeThinkingChip,
      reservedThinkingOrigins,
      setAskInFlight,
      thinkingChipsRef,
      upsertThinkingChip,
    ],
  );

  const handleQuickAction = useCallback(
    (action: IleWorkCanvasCommandId) => {
      const api = apiRef.current;
      const selected = selectedCanvasElements();
      if (!api) return;
      if (ileWorkCanvasCommandNeedsSelection(action) && !selected.length) return;
      const live = liveWorkCanvasScene(api);
      const mode = sessionMarkModeRef.current;
      const outcome = runIleWorkCanvasCommand({
        action,
        scene: live,
        selectedElements: selected,
        focusText: sessionHarnessFocusLine({
          guide: mode === "verification" ? "verification" : mode === "calibrate" ? "calibrate" : "learn",
          suggestion: harnessSuggestionRef.current,
          inferenceLabel: harnessInferencesRef.current.at(-1)?.label ?? null,
        }),
      });
      const emitCommand = (commandId: IleWorkCanvasCommandId, prompt: string) => {
        const powEvents = canvasPowCollectorRef.current.command(commandId, {
          prompt,
          selectedElements: outcome.selected,
        });
        emitCanvasPowRef.current(powEvents);
      };
      const applyLocalCanvasEdit = (
        scene: IleWorkCanvasScene,
        parts: IleWorkCanvasElement[],
        emit: boolean,
      ) => {
        const selectedElementIds = Object.fromEntries(parts.map((part) => [part.id, true]));
        const reveal = ileWorkCanvasRevealScroll(parts, api.getAppState() ?? {});
        commitScene(
          api,
          {
            elements: scene.elements,
            appState: {
              selectedElementIds,
              ...(reveal ?? {}),
            },
            ...(scene.files ? { files: scene.files } : {}),
          },
          { applyingRemote: applyingRemoteRef },
        );
        canvasPowCollectorRef.current.syncWithoutEmit({
          elements: scene.elements,
          appState: {
            ...(api.getAppState() ?? {}),
            selectedElementIds,
          },
          files: api.getFiles() ?? {},
        });
        if (emit) emitCommand(action, outcome.prompt);
      };
      if (outcome.changed) {
        applyLocalCanvasEdit(outcome.scene, outcome.parts, !outcome.ask);
      }
      if (outcome.ask) {
        emitCommand(action, outcome.ask.prompt);
        void runCanvasAsk({
          prompt: outcome.ask.prompt,
          selectedElements: outcome.selected,
          kind: outcome.ask.kind,
        });
        return;
      }
      if (outcome.changed) return;
      if (outcome.notice) {
        const notice = mergeIleXaiTurnOntoLiveWorkCanvas(
          live,
          { text: outcome.notice },
          {
            fallbackOrigin: ileWorkCanvasEmptyNearbyOriginWithReserved({
              elements: live.elements,
              near: outcome.selected.length ? outcome.selected : selected,
            }),
          },
        );
        const addedIds = new Set(ileWorkCanvasAddedElementIds(live, notice));
        applyLocalCanvasEdit(
          notice,
          notice.elements.filter((el) => addedIds.has(el.id) && !el.isDeleted),
          false,
        );
      }
    },
    [
      apiRef,
      applyingRemoteRef,
      canvasPowCollectorRef,
      harnessInferencesRef,
      harnessSuggestionRef,
      runCanvasAsk,
      selectedCanvasElements,
      sessionMarkModeRef,
    ],
  );
  handleQuickActionRef.current = handleQuickAction;

  const toggleAutoLayout = useCallback(() => {
    const api = apiRef.current;
    if (!api) return;
    const live = liveWorkCanvasScene(api);
    const nextEnabled = !ileWorkCanvasAutoLayoutEnabled(live.appState);
    const laid = nextEnabled ? layoutIleWorkCanvasBoard(live) : live;
    commitScene(
      api,
      {
        elements: laid.elements,
        appState: { ...laid.appState, [ILE_AUTO_LAYOUT_APP_STATE_KEY]: nextEnabled },
        ...(laid.files ? { files: laid.files } : {}),
      },
      { applyingRemote: applyingRemoteRef },
    );
    setAutoLayoutEnabled(nextEnabled);
    canvasPowCollectorRef.current.syncWithoutEmit({
      elements: laid.elements,
      appState: { ...(api.getAppState() ?? {}), [ILE_AUTO_LAYOUT_APP_STATE_KEY]: nextEnabled },
      files: api.getFiles() ?? {},
    });
  }, [apiRef, applyingRemoteRef, canvasPowCollectorRef, setAutoLayoutEnabled]);
  toggleAutoLayoutRef.current = toggleAutoLayout;

  const writeDictatedText = useCallback(
    (text: string, emitPow: boolean) => {
      const api = apiRef.current;
      if (!api) return;
      const clean = text.trim();
      const live = liveWorkCanvasScene(api, true);
      const previousId = dictateElementIdRef.current;
      const result = syncIleDictatedTextOnWorkCanvas(live, clean, previousId);
      dictateElementIdRef.current = emitPow ? null : result.elementId;
      if (!result.changed && !emitPow) return;
      const selectedElementIds =
        emitPow && result.elementId ? { [result.elementId]: true } : {};
      if (result.changed || emitPow) {
        const created = Boolean(result.elementId && result.elementId !== previousId);
        const mark = created
          ? result.scene.elements.find((el) => el.id === result.elementId)
          : null;
        commitScene(
          api,
          {
            elements: result.scene.elements,
            appState: { selectedElementIds },
          },
          {
            applyingRemote: applyingRemoteRef,
            scrollTo: mark ? [mark] : null,
          },
        );
        canvasPowCollectorRef.current.syncWithoutEmit({
          elements: result.scene.elements,
          appState: api.getAppState() ?? {},
          files: api.getFiles() ?? {},
        });
      }
      if (!emitPow || !clean) return;
      const powEvents = canvasPowCollectorRef.current.dictate({
        text: clean,
        elementId: result.elementId,
      });
      emitCanvasPowRef.current(powEvents);
    },
    [apiRef, applyingRemoteRef, canvasPowCollectorRef],
  );

  const submitCommand = useCallback(() => {
    const draft = ileCanvasCommandDraft(commandText);
    if (!draft.slash || !draft.exactId) return;
    if (ileWorkCanvasCommandNeedsSelection(draft.exactId) && selectedCanvasElements().length === 0) {
      return;
    }
    setCommandText("");
    handleQuickAction(draft.exactId);
  }, [commandText, handleQuickAction, selectedCanvasElements, setCommandText]);

  return {
    selectedCanvasElements,
    handleQuickAction,
    handleQuickActionRef,
    toggleAutoLayout,
    toggleAutoLayoutRef,
    writeDictatedText,
    submitCommand,
  };
}
