"use client";

import type { RefObject } from "react";
import { ILE_CANVAS_PROMPT_BAR_FALLBACK_WIDTH, ileCanvasSlashBarOpen } from "@/lib/ile-work-canvas";
import {
  filterIleWorkCanvasCommands,
  ileCanvasCommandDraft,
  ileWorkCanvasCommandNeedsSelection,
  type IleWorkCanvasCommandId,
} from "@/lib/ile-work-canvas-commands";
import type { IleWorkCanvasElement } from "@/lib/ile-work-canvas";
import type { IleDictateCapture } from "@/lib/ile-canvas-dictate";
import { ileCanvasCraftInsightUsable } from "@/lib/ile-turn-insights";
import { IleCanvasDictateButton } from "@/components/session-view/ile-canvas-dictate-button";
import {
  IleCanvasCraftInsightForm,
  IleCraftInsightButton,
  type IleCanvasCraftInsightConfig,
} from "@/components/session-view/ile-canvas-craft-insight";

const ILE_CANVAS_COMMAND_BUTTON_CLASS =
  "pointer-events-auto flex h-full min-w-0 items-center justify-center whitespace-normal rounded-none border border-neutral-600 bg-neutral-900 px-1.5 py-1 text-center font-mono text-[11px] leading-tight text-white hover:border-white hover:bg-neutral-800";

export function CanvasPromptBar({
  askInFlight,
  promptBarTop,
  canvasSelectionActive,
  promptBarWidth,
  submitCommand,
  slashBarOpen,
  commandText,
  setCommandText,
  beginAskVoice,
  handleQuickAction,
  commandInputRef,
  askListening,
  setAskListening,
  askCaptureRef,
  finishAskVoice,
  craftInsight,
  setCraftInsightOpen,
  dictateTranscript,
  viewModeEnabled,
  writeDictatedText,
  onDictateActive,
  craftInsightOpen,
  selectedCanvasElements,
}: {
  askInFlight: number;
  promptBarTop: number;
  canvasSelectionActive: boolean;
  promptBarWidth: number;
  submitCommand: () => void;
  slashBarOpen: boolean;
  commandText: string;
  setCommandText: (value: string) => void;
  beginAskVoice: () => void;
  handleQuickAction: (id: IleWorkCanvasCommandId) => void;
  commandInputRef: RefObject<HTMLInputElement | null>;
  askListening: boolean;
  setAskListening: (value: boolean) => void;
  askCaptureRef: { current: IleDictateCapture | null };
  finishAskVoice: (commit: boolean) => void;
  craftInsight?: IleCanvasCraftInsightConfig | null;
  setCraftInsightOpen: (open: boolean) => void;
  dictateTranscript?: string;
  viewModeEnabled?: boolean;
  writeDictatedText: (text: string, commit: boolean) => void;
  onDictateActive?: (active: boolean) => void;
  craftInsightOpen: boolean;
  selectedCanvasElements: () => IleWorkCanvasElement[];
}) {
  return (
          <form
            data-ile-canvas-prompt-bar
            data-ile-canvas-prompt-mode="commands"
            data-ile-excalidraw-ask="true"
            data-ile-excalidraw-ask-busy={askInFlight > 0 ? "true" : undefined}
            data-ile-canvas-prompt-bar-busy={askInFlight > 0 ? "true" : undefined}
            className="pointer-events-none absolute left-1/2 z-[58] flex -translate-x-1/2 justify-center"
            style={{
              top: promptBarTop,
              width: canvasSelectionActive
                ? Math.max(promptBarWidth, ILE_CANVAS_PROMPT_BAR_FALLBACK_WIDTH)
                : undefined,
            }}
            onSubmit={(event) => {
              event.preventDefault();
              submitCommand();
            }}
          >
            <div
              className={`pointer-events-auto flex flex-col gap-1.5 ${canvasSelectionActive ? "w-full" : "w-max"}`}
            >
              {ileCanvasSlashBarOpen({
                selectionActive: canvasSelectionActive,
                slashIntent: slashBarOpen,
              }) ? (
              <div className="flex w-full flex-col gap-1.5 rounded-none border border-white bg-neutral-950/95 p-2 shadow-[0_12px_40px_rgba(0,0,0,0.55)]">
                {ileCanvasCommandDraft(commandText).slash ? (
                  <div
                    data-ile-learn-more
                    data-ile-learn-more-actions
                    className="grid w-full grid-cols-4 gap-1"
                  >
                    {filterIleWorkCanvasCommands(ileCanvasCommandDraft(commandText).query).map((command) => {
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
                            if (command.id === "ask") {
                              setCommandText("/ask ");
                              beginAskVoice();
                              return;
                            }
                            if (blocked) return;
                            setCommandText("");
                            handleQuickAction(command.id);
                          }}
                          className={ILE_CANVAS_COMMAND_BUTTON_CLASS}
                        >
                          {command.label}
                        </button>
                      );
                    })}
                  </div>
                ) : null}
                <div className="flex items-stretch gap-1">
                  <input
                    ref={commandInputRef}
                    data-ile-canvas-prompt-bar-input
                    data-ile-canvas-command-input
                    type="text"
                    value={commandText}
                    onChange={(event) => {
                      if (askListening) setAskListening(false);
                      askCaptureRef.current = null;
                      setCommandText(event.target.value);
                    }}
                    placeholder="Type / for a command"
                    aria-label="Type / for a command"
                    className="min-w-0 flex-1 rounded-none border border-neutral-600 bg-neutral-900 px-2 py-1.5 text-sm text-white placeholder-neutral-500 focus:border-white focus:outline-none"
                  />
                  <button
                    type="button"
                    data-ile-canvas-ask
                    aria-pressed={askListening}
                    onClick={() => (askListening ? finishAskVoice(true) : beginAskVoice())}
                    className="rounded-none border border-white bg-neutral-950 px-2.5 text-xs font-semibold uppercase tracking-wider text-white hover:bg-neutral-800 aria-pressed:bg-white aria-pressed:text-neutral-950"
                  >
                    {askListening ? "Stop" : "Ask"}
                  </button>
                  <button
                    type="submit"
                    data-ile-canvas-prompt-bar-send
                    className="rounded-none border border-white bg-white px-2.5 text-xs font-semibold uppercase tracking-wider text-neutral-950 hover:bg-neutral-200"
                  >
                    Run
                  </button>
                </div>
              </div>
              ) : null}
              <div className="flex items-stretch gap-1.5">
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
                    onActiveChange={onDictateActive}
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
  );
}
