"use client";

import { useState } from "react";
import { IleCraftInsightButton } from "@/components/session-view/ile-canvas-craft-insight";
import { IleCanvasDictateButton } from "@/components/session-view/ile-canvas-dictate-button";
import { useSessionCanvasCommands } from "@/components/session-view/session-command-bridge";
import { ILE_WORK_CANVAS_COMMANDS } from "@/lib/ile-work-canvas-commands";
import { ileCanvasCraftInsightUsable } from "@/lib/ile-turn-insights";
import { SESSION_INSTRUCTIONS, type SessionGuideId } from "@/lib/session-instructions";

const TAB_CLASS =
  "min-w-0 flex-1 rounded-none px-2 py-1 text-left font-mono text-[10px] font-semibold uppercase tracking-[0.18em]";

const COMMAND_CLASS =
  "flex w-full items-center justify-between gap-2 rounded-none border border-white/40 bg-black px-2 py-1.5 text-left font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-white hover:border-white hover:bg-white hover:text-black disabled:cursor-not-allowed disabled:border-white/20 disabled:bg-black disabled:text-white/35";

/**
 * Sidebar focus for Learn, Calibrate, and Verification.
 * Commands run on the canvas selection. Instructions stay fixed for the mode.
 */
export function SessionGuidePanel({ guide }: { guide: SessionGuideId }) {
  const [tab, setTab] = useState<"commands" | "instructions">("commands");
  const bridge = useSessionCanvasCommands();
  const commandsOpen = tab === "commands";
  const text = SESSION_INSTRUCTIONS[guide];
  return (
    <div data-session-guide={guide} className="flex h-full min-h-0 flex-col overflow-hidden bg-black text-white">
      <div role="tablist" className="flex shrink-0 border-b border-white/30 bg-black">
        <span aria-hidden className="flex items-center pl-3 pr-1 font-mono text-[9px] tracking-[0.28em] text-white/45">
          02
        </span>
        <button
          type="button"
          role="tab"
          data-session-guide-tab="commands"
          aria-selected={commandsOpen}
          onClick={() => setTab("commands")}
          className={`${TAB_CLASS} ${commandsOpen ? "bg-white text-black" : "text-white/40 hover:text-white"}`}
        >
          commands
        </button>
        <button
          type="button"
          role="tab"
          data-session-guide-tab="instructions"
          aria-selected={!commandsOpen}
          onClick={() => setTab("instructions")}
          className={`${TAB_CLASS} ${commandsOpen ? "text-white/40 hover:text-white" : "bg-white text-black"}`}
        >
          instructions
        </button>
      </div>
      {commandsOpen ? (
        <div data-session-commands className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-2 py-1.5">
          <div className="grid grid-cols-2 gap-1">
            {ILE_WORK_CANVAS_COMMANDS.map((command) => {
              const ready = Boolean(bridge?.selectionActive);
              return (
                <button
                  key={command.id}
                  type="button"
                  data-session-command={command.id}
                  title={command.tooltip}
                  aria-label={command.label}
                  disabled={!ready}
                  onClick={() => {
                    if (!ready || !bridge) return;
                    bridge.run(command.id);
                  }}
                  className={COMMAND_CLASS}
                >
                  <span>{command.label}</span>
                </button>
              );
            })}
          </div>
          {bridge?.craft ? (
            <IleCraftInsightButton
              square
              usable={ileCanvasCraftInsightUsable()}
              onClick={() => bridge.craft?.open()}
            />
          ) : null}
          {bridge?.dictate ? (
            <IleCanvasDictateButton
              square
              transcript={bridge.dictate.transcript}
              onLiveText={(text) => bridge.dictate?.write(text, false)}
              onCommit={(text) => bridge.dictate?.write(text, true)}
              onActiveChange={bridge.dictate.onActive}
            />
          ) : null}
          <p className="px-1 pt-1 font-mono text-[10px] leading-snug text-white/45">
            {bridge
              ? bridge.selectionActive
                ? "Commands use the marks selected on the canvas."
                : "Select marks on the canvas first."
              : "The board is still opening."}
          </p>
        </div>
      ) : (
        <div data-session-instructions className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
          {text.split("\n\n").map((paragraph) => (
            <p key={paragraph.slice(0, 24)} className="mb-3 font-mono text-[12px] leading-snug text-white/85 last:mb-0">
              {paragraph}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
