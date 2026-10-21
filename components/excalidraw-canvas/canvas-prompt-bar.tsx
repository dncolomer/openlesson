"use client";

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type RefObject } from "react";
import { ILE_CANVAS_PROMPT_BAR_FALLBACK_WIDTH, ileCanvasSlashBarOpen } from "@/lib/ile-work-canvas";
import {
  ILE_COMMAND_DOCK_STORAGE_KEY,
  clampIleCommandDockPoint,
  ileCommandDockAfterDrag,
  ileCommandDockFloatWidth,
  ileCanvasCommandDockVisible,
  ileCommandDockFrame,
  parseIleCommandDock,
  serializeIleCommandDock,
  type IleCommandDockMode,
  type IleCommandDockState,
} from "@/lib/ile-command-dock";
import {
  filterIleWorkCanvasCommands,
  ILE_WORK_CANVAS_COMMANDS,
  ileCanvasCommandDraft,
  ileWorkCanvasCommandNeedsSelection,
  type IleWorkCanvasCommandId,
} from "@/lib/ile-work-canvas-commands";
import type { IleWorkCanvasElement } from "@/lib/ile-work-canvas";
import { ileCanvasCraftInsightUsable, ileCanvasShowsCraftInsight } from "@/lib/ile-turn-insights";
import { IleCanvasDictateButton } from "@/components/session-view/ile-canvas-dictate-button";
import {
  IleCanvasCraftInsightForm,
  IleCraftInsightButton,
  type IleCanvasCraftInsightConfig,
} from "@/components/session-view/ile-canvas-craft-insight";
import { usePublishSessionCanvasCommands } from "@/components/session-view/session-command-bridge";
import { LearnSuggestionToast } from "@/components/session-view/learn-suggestion-toast";
import { learnSuggestionToastText } from "@/lib/ile-learn-suggestion";
import {
  usePublishSessionMarkDraft,
  useSessionPolicySuggestion,
} from "@/components/session-view/session-policy-context";
import type { SessionMarkMode } from "@/lib/session-marks";
import {
  CommandMark,
  CommandPlate,
  ILE_CANVAS_COMMAND_BUTTON_CLASS,
  ILE_CANVAS_COMMAND_RAIL_CLASS,
  ileWorkCanvasCommandIndex,
} from "@/components/excalidraw-canvas/command-plate";

const DOCK_ANCHORS: readonly { mode: IleCommandDockMode; title: string }[] = [
  { mode: "bottom-left", title: "Anchor at the bottom left" },
  { mode: "left", title: "Anchor as a full-height bar on the left" },
  { mode: "right", title: "Anchor beside the sidebar" },
];

function DockAnchorIcon({ mode }: { mode: IleCommandDockMode }) {
  const bar =
    mode === "bottom-left" ? "M3 10h6v3H3z" : mode === "left" ? "M3 3h3v10H3z" : "M10 3h3v10h-3z";
  return (
    <svg
      viewBox="0 0 16 16"
      className="h-3.5 w-3.5"
      fill="currentColor"
      stroke="currentColor"
      strokeWidth={1.2}
      aria-hidden
    >
      <path fill="none" d="M3 3h10v10H3z" />
      <path d={bar} />
    </svg>
  );
}

export function CanvasPromptBar({
  askInFlight,
  canvasSelectionActive,
  promptBarWidth,
  hostWidth = 0,
  hostHeight = 0,
  submitCommand,
  slashBarOpen,
  commandText,
  setCommandText,
  handleQuickAction,
  commandInputRef,
  craftInsight,
  setCraftInsightOpen,
  dictateTranscript,
  viewModeEnabled,
  writeDictatedText,
  placeSuggestionText,
  onDictateActive,
  craftInsightOpen,
  selectedCanvasElements,
  sessionMarkMode,
  sessionMarkQuestions,
  sessionMarkListKey,
  selectedMarkTexts,
  markSpeech,
}: {
  askInFlight: number;
  canvasSelectionActive: boolean;
  promptBarWidth: number;
  hostWidth?: number;
  hostHeight?: number;
  submitCommand: () => void;
  slashBarOpen: boolean;
  commandText: string;
  setCommandText: (value: string) => void;
  handleQuickAction: (id: IleWorkCanvasCommandId) => void;
  commandInputRef: RefObject<HTMLInputElement | null>;
  craftInsight?: IleCanvasCraftInsightConfig | null;
  setCraftInsightOpen: (open: boolean) => void;
  dictateTranscript?: string;
  viewModeEnabled?: boolean;
  writeDictatedText: (text: string, commit: boolean) => void;
  placeSuggestionText?: (text: string) => void;
  onDictateActive?: (active: boolean) => void;
  craftInsightOpen: boolean;
  selectedCanvasElements: () => IleWorkCanvasElement[];
  sessionMarkMode?: SessionMarkMode | null;
  sessionMarkQuestions?: readonly { id?: string | null; text?: string | null }[];
  sessionMarkListKey?: string | null;
  selectedMarkTexts: string[];
  markSpeech: string;
}) {
  const [dockState, setDockState] = useState<IleCommandDockState>({ mode: "bottom-left", left: 0, top: 0 });
  const formRef = useRef<HTMLFormElement>(null);
  const suppressClickRef = useRef(false);
  const stopDragRef = useRef<(() => void) | null>(null);
  const publishDraft = usePublishSessionMarkDraft();
  const publishCommands = usePublishSessionCanvasCommands();
  const suggestion = useSessionPolicySuggestion();
  const [dismissedSuggestion, setDismissedSuggestion] = useState<string | null>(null);
  const runCommandRef = useRef(handleQuickAction);
  const clearCommandRef = useRef(setCommandText);
  const writeDictatedRef = useRef(writeDictatedText);
  const placeSuggestionRef = useRef(placeSuggestionText);
  const dictateActiveRef = useRef(onDictateActive);
  const openCraftRef = useRef(setCraftInsightOpen);
  runCommandRef.current = handleQuickAction;
  clearCommandRef.current = setCommandText;
  writeDictatedRef.current = writeDictatedText;
  placeSuggestionRef.current = placeSuggestionText;
  dictateActiveRef.current = onDictateActive;
  openCraftRef.current = setCraftInsightOpen;
  const questionKey = (sessionMarkQuestions ?? [])
    .map((question) => `${question.id || ""}:${question.text || ""}`)
    .join("|");
  const selectionKey = selectedMarkTexts.join("\n");
  useEffect(() => {
    if (!sessionMarkMode) {
      publishDraft(null);
      return;
    }
    publishDraft({
      mode: sessionMarkMode,
      questions: sessionMarkQuestions ?? [],
      listKey: sessionMarkListKey ?? null,
      selectionActive: canvasSelectionActive,
      selectedTexts: selectedMarkTexts,
      speech: markSpeech,
    });
  }, [
    canvasSelectionActive,
    markSpeech,
    publishDraft,
    questionKey,
    selectionKey,
    sessionMarkListKey,
    sessionMarkMode,
  ]);
  useEffect(() => {
    try {
      setDockState(parseIleCommandDock(sessionStorage.getItem(ILE_COMMAND_DOCK_STORAGE_KEY)));
    } catch {
      // Storage can be blocked. The box stays at the bottom left.
    }
    return () => stopDragRef.current?.();
  }, []);
  const commandDraft = ileCanvasCommandDraft(commandText);
  const commands = filterIleWorkCanvasCommands(commandDraft.slash ? commandDraft.query : "");
  const showCraftInsight = Boolean(craftInsight) && ileCanvasShowsCraftInsight(sessionMarkMode);
  const dictateOn = dictateTranscript !== undefined && !viewModeEnabled;
  useEffect(() => {
    publishCommands({
      selectionActive: canvasSelectionActive,
      run(id) {
        clearCommandRef.current("");
        runCommandRef.current(id);
      },
      dictate: dictateOn
        ? {
            transcript: dictateTranscript ?? "",
            write: (text, commit) => writeDictatedRef.current(text, commit),
            onActive: (active) => dictateActiveRef.current?.(active),
          }
        : null,
      craft: showCraftInsight ? { open: () => openCraftRef.current(true) } : null,
    });
  }, [canvasSelectionActive, dictateOn, dictateTranscript, publishCommands, showCraftInsight]);
  useEffect(() => () => publishCommands(null), [publishCommands]);
  const floatWidth = ileCommandDockFloatWidth(
    Math.max(promptBarWidth, ILE_CANVAS_PROMPT_BAR_FALLBACK_WIDTH),
    hostWidth,
  );
  const frame = ileCommandDockFrame({
    state: dockState,
    hostWidth,
    hostHeight,
    floatWidth,
  });
  const rail = frame.mode === "left" || frame.mode === "right";
  const learnSuggestion = learnSuggestionToastText({
    mode: sessionMarkMode,
    suggestion,
    dismissed: dismissedSuggestion,
  });
  const commandDockVisible = ileCanvasCommandDockVisible(sessionMarkMode);
  const rememberDock = (next: IleCommandDockState) => {
    setDockState(next);
    try {
      sessionStorage.setItem(ILE_COMMAND_DOCK_STORAGE_KEY, serializeIleCommandDock(next));
    } catch {
      // The dock still moves for this view.
    }
  };
  const beginDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    const target = event.target;
    if (target instanceof Element && target.closest("input, textarea, [data-ile-learn-suggestion]")) return;
    const form = formRef.current;
    const host = form?.offsetParent instanceof HTMLElement ? form.offsetParent : null;
    if (!form || !host) return;
    const formRect = form.getBoundingClientRect();
    const hostRect = host.getBoundingClientRect();
    const originLeft = formRect.left - hostRect.left;
    const originTop = formRect.top - hostRect.top;
    const startX = event.clientX;
    const startY = event.clientY;
    let moved = false;
    const box = {
      hostWidth: hostRect.width,
      hostHeight: hostRect.height,
      boxWidth: formRect.width,
      boxHeight: formRect.height,
    };
    const stop = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      if (stopDragRef.current === stop) stopDragRef.current = null;
    };
    const finish = (clientX: number, clientY: number) => {
      stop();
      if (!moved) return;
      suppressClickRef.current = true;
      rememberDock(
        ileCommandDockAfterDrag({
          left: originLeft + (clientX - startX),
          top: originTop + (clientY - startY),
          ...box,
        }),
      );
    };
    const onMove = (move: PointerEvent) => {
      const dx = move.clientX - startX;
      const dy = move.clientY - startY;
      if (!moved && Math.hypot(dx, dy) < 6) return;
      moved = true;
      const clamped = clampIleCommandDockPoint({
        left: originLeft + dx,
        top: originTop + dy,
        ...box,
      });
      setDockState({ mode: "free", left: clamped.left, top: clamped.top });
    };
    const onUp = (up: PointerEvent) => finish(up.clientX, up.clientY);
    stopDragRef.current?.();
    stopDragRef.current = stop;
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };
  const suggestionNote = learnSuggestion ? (
    <LearnSuggestionToast
      key={learnSuggestion}
      text={learnSuggestion}
      placement={commandDockVisible ? "under" : "notification"}
      onDone={(text) => setDismissedSuggestion(text)}
      onAdd={(text) => placeSuggestionRef.current?.(text)}
    />
  ) : null;
  return commandDockVisible ? (
          <form
            ref={formRef}
            data-ile-canvas-prompt-bar
            data-ile-canvas-prompt-mode="commands"
            data-ile-command-dock={frame.mode}
            data-ile-excalidraw-ask="true"
            data-ile-excalidraw-ask-busy={askInFlight > 0 ? "true" : undefined}
            data-ile-canvas-prompt-bar-busy={askInFlight > 0 ? "true" : undefined}
            className="pointer-events-none absolute z-[58] flex flex-col"
            style={{
              left: frame.left ?? undefined,
              right: frame.right ?? undefined,
              top: frame.top ?? undefined,
              bottom: frame.bottom ?? undefined,
              width: frame.width,
            }}
            onSubmit={(event) => {
              event.preventDefault();
              submitCommand();
            }}
          >
            <div
              className={`pointer-events-auto relative flex w-full flex-col gap-1.5 ${rail ? "h-full" : ""}`}
              onPointerDown={beginDrag}
              onClickCapture={(event) => {
                if (!suppressClickRef.current) return;
                suppressClickRef.current = false;
                event.preventDefault();
                event.stopPropagation();
              }}
            >
              <div className={`relative flex w-full flex-col gap-1 rounded-none border border-white bg-neutral-950/95 shadow-[0_12px_40px_rgba(0,0,0,0.55)] ${rail ? "min-h-0 flex-1 overflow-y-auto p-1" : "gap-1.5 p-2"}`}>
              <div
                data-ile-command-dock-grip
                className="sticky top-0 z-10 flex cursor-grab items-center gap-1 border border-white/40 bg-black px-1 py-1 active:cursor-grabbing"
              >
                <span className="font-mono text-[9px] uppercase tracking-[0.22em] text-white/55">drag</span>
                <span className="ml-auto flex items-center gap-1">
                  {DOCK_ANCHORS.map((anchor) => {
                    const selected = frame.mode === anchor.mode;
                    return (
                      <button
                        key={anchor.mode}
                        type="button"
                        data-ile-command-dock-anchor={anchor.mode}
                        aria-pressed={selected}
                        aria-label={anchor.title}
                        title={anchor.title}
                        onClick={() => rememberDock({ mode: anchor.mode, left: dockState.left, top: dockState.top })}
                        className={`flex aspect-square h-6 w-6 items-center justify-center rounded-none border p-0 ${selected ? "border-white bg-white text-neutral-950" : "border-white/40 text-white/55 hover:border-white hover:text-white"}`}
                      >
                        <DockAnchorIcon mode={anchor.mode} />
                      </button>
                    );
                  })}
                </span>
              </div>
                <div
                  data-ile-learn-more
                  data-ile-learn-more-actions
                  className={rail ? "grid w-full grid-cols-1 gap-1" : "grid w-full grid-cols-4 gap-1"}
                >
                  {commands.map((command) => {
                    const needsSelection = ileWorkCanvasCommandNeedsSelection(command.id);
                    const blocked = needsSelection && !canvasSelectionActive;
                    return (
                      <button
                        key={command.id}
                        type="button"
                        data-ile-learn-more-quick={command.id}
                        aria-label={command.label}
                        title={command.tooltip}
                        disabled={blocked}
                        onClick={() => {
                          if (blocked) return;
                          setCommandText("");
                          handleQuickAction(command.id);
                        }}
                        className={rail ? ILE_CANVAS_COMMAND_RAIL_CLASS : ILE_CANVAS_COMMAND_BUTTON_CLASS}
                      >
                        <CommandPlate index={ileWorkCanvasCommandIndex(command.id)} />
                        <CommandMark id={command.id} label={command.label} />
                        <span>{command.label}</span>
                      </button>
                    );
                  })}
                </div>
                {ileCanvasSlashBarOpen({
                  selectionActive: canvasSelectionActive,
                  slashIntent: slashBarOpen,
                }) ? (
                <div className={rail ? "absolute top-8 z-20 flex w-56 flex-col gap-1 border border-white bg-neutral-950 p-1 " + (frame.mode === "right" ? "right-full mr-1" : "left-full ml-1") : "flex items-stretch gap-1"}>
                  <input
                    ref={commandInputRef}
                    data-ile-canvas-prompt-bar-input
                    data-ile-canvas-command-input
                    type="text"
                    value={commandText}
                    onChange={(event) => setCommandText(event.target.value)}
                    placeholder="Type / for a command"
                    aria-label="Type / for a command"
                    className="min-w-0 flex-1 rounded-none border border-neutral-600 bg-neutral-900 px-2 py-1.5 text-sm text-white placeholder-neutral-500 focus:border-white focus:outline-none"
                  />
                  <button
                    type="submit"
                    data-ile-canvas-prompt-bar-send
                    className="rounded-none border border-white bg-white px-2.5 text-xs font-semibold uppercase tracking-wider text-neutral-950 hover:bg-neutral-200"
                  >
                    Run
                  </button>
                </div>
                ) : null}
                {showCraftInsight || (dictateTranscript !== undefined && !viewModeEnabled) ? (
                <div
                  data-ile-board-tools
                  className={
                    rail
                      ? "mt-1 grid w-full grid-cols-1 gap-1 border-t border-white/30 pt-1.5"
                      : "mt-1 flex w-full flex-col gap-1.5 border-t border-white/30 pt-1.5"
                  }
                >
                  <p className="px-0.5 font-mono text-[9px] uppercase tracking-[0.22em] text-white/45">board</p>
                  <div className={rail ? "grid w-full grid-cols-1 gap-1" : "flex w-full items-stretch gap-1"}>
                  {showCraftInsight ? (
                    <IleCraftInsightButton
                      square={rail}
                      usable={ileCanvasCraftInsightUsable()}
                      onClick={() => setCraftInsightOpen(true)}
                    />
                  ) : null}
                  {dictateTranscript !== undefined && !viewModeEnabled ? (
                    <IleCanvasDictateButton
                      square={rail}
                      transcript={dictateTranscript}
                      onLiveText={(text) => writeDictatedText(text, false)}
                      onCommit={(text) => writeDictatedText(text, true)}
                      onActiveChange={onDictateActive}
                    />
                  ) : null}
                  </div>
                </div>
                ) : null}
              </div>
              {showCraftInsight && craftInsight ? (
                <div className={rail ? `absolute top-0 z-20 w-72 ${frame.mode === "right" ? "right-full mr-1" : "left-full ml-1"}` : undefined}>
                  <IleCanvasCraftInsightForm
                    open={craftInsightOpen}
                    enabled={ileCanvasCraftInsightUsable()}
                    selectedElements={selectedCanvasElements()}
                    config={craftInsight}
                    onClose={() => setCraftInsightOpen(false)}
                  />
                </div>
              ) : null}
            </div>
          </form>
  ) : suggestionNote || (showCraftInsight && craftInsight && craftInsightOpen) ? (
    <div
      data-ile-canvas-side-note
      className="pointer-events-none absolute bottom-3 left-3 z-[58] flex w-[min(22rem,calc(100%-1.5rem))] flex-col gap-1"
    >
      {showCraftInsight && craftInsight ? (
        <IleCanvasCraftInsightForm
          open={craftInsightOpen}
          enabled={ileCanvasCraftInsightUsable()}
          selectedElements={selectedCanvasElements()}
          config={craftInsight}
          onClose={() => setCraftInsightOpen(false)}
        />
      ) : null}
      {suggestionNote}
    </div>
  ) : null;
}
