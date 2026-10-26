"use client";

import { CommandMark } from "@/components/excalidraw-canvas/command-plate";
import {
  ILE_WORK_CANVAS_AUTO_LAYOUT_LABEL,
  ILE_WORK_CANVAS_AUTO_LAYOUT_SHORTCUT,
  ILE_WORK_CANVAS_AUTO_LAYOUT_TOOLTIP,
  ILE_WORK_CANVAS_CHEATSHEET_LABEL,
  ILE_WORK_CANVAS_SHORTCUT_MOD_HINT,
  ileWorkCanvasCommandShortcutAltLabel,
  ileWorkCanvasCommandShortcutAppleLabel,
  ileWorkCanvasCommandsFor,
  type IleWorkCanvasCommandId,
} from "@/lib/learn-work-canvas-commands";
import type { SessionGuideId } from "@/lib/session-instructions";

export function SessionCommandCheatsheet({
  guide,
  open,
  onClose,
}: {
  guide: SessionGuideId;
  open: boolean;
  onClose: () => void;
}) {
  if (!open) return null;
  const commands = ileWorkCanvasCommandsFor(guide);
  return (
    <div
      data-session-command-cheatsheet
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={ILE_WORK_CANVAS_CHEATSHEET_LABEL}
        className="max-h-[min(42rem,calc(100vh-2rem))] w-full max-w-xl overflow-y-auto border border-white bg-black p-5 text-white"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="font-mono text-[12px] font-semibold uppercase tracking-[0.16em]">
            {ILE_WORK_CANVAS_CHEATSHEET_LABEL}
          </h2>
          <button
            type="button"
            data-session-command-cheatsheet-close
            onClick={onClose}
            className="border border-white/40 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-white/80 hover:border-white hover:text-white"
          >
            Close
          </button>
        </div>
        <p
          data-session-command-cheatsheet-mac
          className="mb-3 font-mono text-[11px] leading-snug text-white/70"
        >
          {ILE_WORK_CANVAS_SHORTCUT_MOD_HINT}
        </p>
        <ul className="flex flex-col gap-2">
          {commands.map((command) => (
            <li
              key={command.id}
              data-session-command-cheatsheet-row={command.id}
              className="flex items-start gap-2 border border-white/20 px-2 py-2"
            >
              <CommandMark
                id={command.id as IleWorkCanvasCommandId}
                label={command.label}
                className="mt-0.5 h-4 w-4 shrink-0"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-mono text-[12px] font-semibold">{command.label}</span>
                  <span className="flex shrink-0 items-baseline gap-1.5 font-mono text-[10px] text-white/55">
                    <kbd data-shortcut-apple={command.shortcut}>
                      {ileWorkCanvasCommandShortcutAppleLabel(command.shortcut)}
                    </kbd>
                    <kbd data-shortcut-alt={command.shortcut} className="text-white/40">
                      {ileWorkCanvasCommandShortcutAltLabel(command.shortcut)}
                    </kbd>
                  </span>
                </div>
                <p className="mt-1 font-mono text-[11px] leading-snug text-white/70">{command.tooltip}</p>
              </div>
            </li>
          ))}
          <li
            data-session-command-cheatsheet-row="auto-layout"
            className="flex items-start gap-2 border border-white/20 px-2 py-2"
          >
            <CommandMark id="auto-layout" label={ILE_WORK_CANVAS_AUTO_LAYOUT_LABEL} className="mt-0.5 h-4 w-4 shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-mono text-[12px] font-semibold">{ILE_WORK_CANVAS_AUTO_LAYOUT_LABEL}</span>
                <span className="flex shrink-0 items-baseline gap-1.5 font-mono text-[10px] text-white/55">
                  <kbd data-shortcut-apple="l">
                    {ileWorkCanvasCommandShortcutAppleLabel(ILE_WORK_CANVAS_AUTO_LAYOUT_SHORTCUT)}
                  </kbd>
                  <kbd data-shortcut-alt="l" className="text-white/40">
                    {ileWorkCanvasCommandShortcutAltLabel(ILE_WORK_CANVAS_AUTO_LAYOUT_SHORTCUT)}
                  </kbd>
                </span>
              </div>
              <p className="mt-1 font-mono text-[11px] leading-snug text-white/70">
                Toggle. {ILE_WORK_CANVAS_AUTO_LAYOUT_TOOLTIP}
              </p>
            </div>
          </li>
        </ul>
      </div>
    </div>
  );
}
