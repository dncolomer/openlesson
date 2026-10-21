"use client";

import { useState } from "react";
import {
  CommandMark,
  CommandPlate,
  ILE_CANVAS_COMMAND_SIDEBAR_CLASS,
  ileWorkCanvasCommandIndex,
} from "@/components/excalidraw-canvas/command-plate";
import { IleCraftInsightButton } from "@/components/session-view/ile-canvas-craft-insight";
import { IleCanvasDictateButton } from "@/components/session-view/ile-canvas-dictate-button";
import { SessionHarnessPanel } from "@/components/session-view/session-harness-panel";
import { useSessionCanvasCommands } from "@/components/session-view/session-command-bridge";
import { ILE_WORK_CANVAS_COMMANDS } from "@/lib/ile-work-canvas-commands";
import { ileCanvasCraftInsightUsable } from "@/lib/ile-turn-insights";
import { SESSION_INSTRUCTIONS, type SessionGuideId } from "@/lib/session-instructions";

const TAB_CLASS =
  "flex min-w-0 items-center justify-center rounded-none px-1 py-1 text-center font-mono text-[10px] font-semibold uppercase tracking-[0.08em]";

type GuideTab = "commands" | "harness" | "help";

/**
 * Sidebar focus for Learn, Calibrate, and Verification.
 * Learn and Verification run canvas commands from this rail.
 * Calibrate has no canvas, so this panel is Harness and Help.
 */
export function SessionGuidePanel({
  guide,
  remainingSeconds = 0,
}: {
  guide: SessionGuideId;
  remainingSeconds?: number;
}) {
  const canvasCommands = guide !== "calibrate";
  const [tab, setTab] = useState<GuideTab>(canvasCommands ? "commands" : "help");
  const bridge = useSessionCanvasCommands();
  const commandsOpen = canvasCommands && tab === "commands";
  const harnessOpen = tab === "harness";
  const text = SESSION_INSTRUCTIONS[guide];
  const commandsHint = !bridge ? "The board is still opening." : null;
  return (
    <div data-session-guide={guide} className="flex h-full min-h-0 flex-col overflow-hidden bg-black text-white">
      <div className="flex shrink-0 border-b border-white/30 bg-black">
        <span aria-hidden className="flex shrink-0 items-center pl-2 pr-1 font-mono text-[9px] tracking-[0.12em] text-white/35">
          02
        </span>
        <div
          role="tablist"
          className={`grid min-w-0 flex-1 ${canvasCommands ? "grid-cols-3" : "grid-cols-2"}`}
        >
          {canvasCommands ? (
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
          ) : null}
          <button
            type="button"
            role="tab"
            data-session-guide-tab="harness"
            aria-selected={harnessOpen}
            onClick={() => setTab("harness")}
            className={`${TAB_CLASS} ${harnessOpen ? "bg-white text-black" : "text-white/40 hover:text-white"}`}
          >
            harness
          </button>
          <button
            type="button"
            role="tab"
            data-session-guide-tab="help"
            aria-selected={tab === "help"}
            onClick={() => setTab("help")}
            className={`${TAB_CLASS} ${tab === "help" ? "bg-white text-black" : "text-white/40 hover:text-white"}`}
          >
            help
          </button>
        </div>
      </div>
      {commandsOpen ? (
        <div data-session-commands className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="grid min-h-0 flex-1 auto-rows-fr grid-cols-2 grid-rows-3 gap-0.5 px-1.5 pt-0.5">
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
                  className={ILE_CANVAS_COMMAND_SIDEBAR_CLASS}
                >
                  <CommandPlate index={ileWorkCanvasCommandIndex(command.id)} />
                  <CommandMark
                    id={command.id}
                    label={command.label}
                    className="h-[clamp(0.6rem,22cqh,1rem)] w-[clamp(0.6rem,22cqh,1rem)] shrink-0"
                  />
                  <span className="min-w-0 truncate">{command.label}</span>
                </button>
              );
            })}
            <IleCanvasDictateButton
              plate
              index="06"
              transcript={bridge?.dictate?.transcript ?? ""}
              onLiveText={(text) => bridge?.dictate?.write(text, false)}
              onCommit={(text) => bridge?.dictate?.write(text, true)}
              onActiveChange={bridge?.dictate?.onActive}
            />
          </div>
          <div data-session-commit className="shrink-0 px-1.5 pb-1 pt-1">
            <IleCraftInsightButton
              plate
              bar
              index="07"
              usable={Boolean(bridge?.craft) && ileCanvasCraftInsightUsable()}
              onClick={() => bridge?.craft?.open()}
            />
          </div>
          {commandsHint ? (
            <p className="shrink-0 px-2 pb-1.5 pt-0.5 font-mono text-[9px] leading-snug text-white/45">
              {commandsHint}
            </p>
          ) : null}
        </div>
      ) : harnessOpen ? (
        <SessionHarnessPanel guide={guide} remainingSeconds={remainingSeconds} />
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
