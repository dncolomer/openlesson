"use client";

import {
  CommandMark,
  ILE_CANVAS_COMMAND_RAIL_CLASS,
  ILE_CANVAS_COMMAND_SIDEBAR_CLASS,
  ILE_CANVAS_COMMAND_SIDEBAR_MARK_CLASS,
} from "@/components/excalidraw-canvas/command-plate";
import {
  ILE_CANVAS_POINTER_LABEL,
  ILE_CANVAS_POINTER_TOOLTIP,
} from "@/lib/learn-work-canvas-laser-gestures";

export function IleCanvasPointerButton({
  active,
  disabled,
  onToggle,
  plate = false,
  square = false,
}: {
  active: boolean;
  disabled?: boolean;
  onToggle: () => void;
  plate?: boolean;
  square?: boolean;
}) {
  const markClass = plate ? ILE_CANVAS_COMMAND_SIDEBAR_MARK_CLASS : "h-3.5 w-3.5";
  const className = plate
    ? `${ILE_CANVAS_COMMAND_SIDEBAR_CLASS} aria-pressed:bg-white aria-pressed:text-neutral-950`
    : square
      ? ILE_CANVAS_COMMAND_RAIL_CLASS
      : `${ILE_CANVAS_COMMAND_RAIL_CLASS} min-w-0 flex-1`;
  return (
    <button
      type="button"
      data-ile-canvas-pointer
      data-session-command="pointer"
      aria-pressed={active ? "true" : "false"}
      aria-label={ILE_CANVAS_POINTER_LABEL}
      title={ILE_CANVAS_POINTER_TOOLTIP}
      disabled={disabled}
      onClick={onToggle}
      className={className}
    >
      <CommandMark id="pointer" label={ILE_CANVAS_POINTER_LABEL} className={markClass} />
      <span className="min-w-0 truncate">{ILE_CANVAS_POINTER_LABEL}</span>
    </button>
  );
}
