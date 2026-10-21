/**
 * Where the canvas command box sits. Bottom-left is the resting anchor.
 * A drag can leave it free, or release it into a full-height bar on the
 * left or on the right edge beside the session sidebar.
 */

import { ILE_CANVAS_PROMPT_BAR_FALLBACK_WIDTH } from "@/lib/learn-work-canvas";

export const ILE_COMMAND_DOCK_STORAGE_KEY = "ile-command-dock";
export const ILE_COMMAND_DOCK_PAD = 8;
export const ILE_COMMAND_DOCK_SNAP = 48;
/** One command name beside its mark, plus the card's border and padding. */
export const ILE_COMMAND_DOCK_RAIL_WIDTH = 176;

export type IleCommandDockMode = "bottom-left" | "left" | "right" | "free";

/**
 * Learn, Calibrate, and Verification keep commands on the right sidebar.
 * Conversational TAP has no command list there, so the canvas dock stays.
 */
export function ileCanvasCommandDockVisible(mode: string | null | undefined): boolean {
  return mode !== "learn" && mode !== "calibrate" && mode !== "verification";
}

export type IleCommandDockState = {
  mode: IleCommandDockMode;
  left: number;
  top: number;
};

export type IleCommandDockFrame = {
  mode: IleCommandDockMode;
  left: number | null;
  right: number | null;
  top: number | null;
  bottom: number | null;
  width: number;
};

const DOCK_MODES: readonly IleCommandDockMode[] = ["bottom-left", "left", "right", "free"];

export function ileCommandDockFloatWidth(preferred: number, hostWidth: number): number {
  const base =
    Number.isFinite(preferred) && preferred > 0 ? preferred : ILE_CANVAS_PROMPT_BAR_FALLBACK_WIDTH;
  const capped = Math.min(base, ILE_CANVAS_PROMPT_BAR_FALLBACK_WIDTH);
  if (!Number.isFinite(hostWidth) || hostWidth <= ILE_COMMAND_DOCK_PAD * 2) return Math.round(capped);
  return Math.round(Math.min(capped, Math.max(160, hostWidth - ILE_COMMAND_DOCK_PAD * 2)));
}

export function ileCommandDockRailWidth(hostWidth: number): number {
  const thin = ILE_COMMAND_DOCK_RAIL_WIDTH;
  if (!Number.isFinite(hostWidth) || hostWidth <= 0) return thin;
  return Math.round(Math.min(thin, Math.max(96, hostWidth - ILE_COMMAND_DOCK_PAD * 2)));
}

export function clampIleCommandDockPoint(input: {
  left: number;
  top: number;
  hostWidth: number;
  hostHeight: number;
  boxWidth: number;
  boxHeight: number;
}): { left: number; top: number } {
  const left = Number(input.left) || 0;
  const top = Number(input.top) || 0;
  if (!(input.hostWidth > 0) || !(input.hostHeight > 0)) {
    return { left: Math.round(left), top: Math.round(top) };
  }
  const pad = ILE_COMMAND_DOCK_PAD;
  const boxWidth = Math.max(1, input.boxWidth || 0);
  const boxHeight = Math.max(1, input.boxHeight || 0);
  const maxLeft = Math.max(pad, input.hostWidth - boxWidth - pad);
  const maxTop = Math.max(pad, input.hostHeight - boxHeight - pad);
  return {
    left: Math.round(Math.min(Math.max(left, pad), maxLeft)),
    top: Math.round(Math.min(Math.max(top, pad), maxTop)),
  };
}

/** Release near an edge to dock. Otherwise keep the box where it was dropped. */
export function ileCommandDockAfterDrag(input: {
  left: number;
  top: number;
  hostWidth: number;
  hostHeight: number;
  boxWidth: number;
  boxHeight: number;
}): IleCommandDockState {
  const left = Number(input.left) || 0;
  const top = Number(input.top) || 0;
  const boxWidth = Math.max(1, input.boxWidth || 0);
  const boxHeight = Math.max(1, input.boxHeight || 0);
  if (input.hostWidth > 0 && input.hostHeight > 0) {
    const snap = ILE_COMMAND_DOCK_SNAP;
    const nearLeft = left <= snap;
    const nearRight = left + boxWidth >= input.hostWidth - snap && left >= input.hostWidth * 0.35;
    const inLowerHalf = top >= input.hostHeight / 2;
    if (nearRight && !nearLeft) return { mode: "right", left, top };
    if (nearLeft && inLowerHalf) return { mode: "bottom-left", left, top };
    if (nearLeft) return { mode: "left", left, top };
  }
  const clamped = clampIleCommandDockPoint({
    left,
    top,
    hostWidth: input.hostWidth,
    hostHeight: input.hostHeight,
    boxWidth,
    boxHeight,
  });
  return { mode: "free", left: clamped.left, top: clamped.top };
}

export function ileCommandDockFrame(input: {
  state: IleCommandDockState;
  hostWidth: number;
  hostHeight: number;
  floatWidth: number;
}): IleCommandDockFrame {
  const floatWidth = Math.max(160, input.floatWidth || ILE_CANVAS_PROMPT_BAR_FALLBACK_WIDTH);
  if (input.state.mode === "left" || input.state.mode === "right") {
    const width = ileCommandDockRailWidth(input.hostWidth);
    return {
      mode: input.state.mode,
      left: input.state.mode === "left" ? 0 : null,
      right: input.state.mode === "right" ? 0 : null,
      top: 0,
      bottom: 0,
      width,
    };
  }
  if (input.state.mode === "bottom-left") {
    return {
      mode: "bottom-left",
      left: ILE_COMMAND_DOCK_PAD,
      right: null,
      top: null,
      bottom: ILE_COMMAND_DOCK_PAD,
      width: floatWidth,
    };
  }
  return {
    mode: "free",
    left: Math.round(Number(input.state.left) || 0),
    right: null,
    top: Math.round(Number(input.state.top) || 0),
    bottom: null,
    width: floatWidth,
  };
}

export function parseIleCommandDock(raw: string | null | undefined): IleCommandDockState {
  const fallback: IleCommandDockState = { mode: "bottom-left", left: 0, top: 0 };
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw) as { mode?: unknown; left?: unknown; top?: unknown };
    const mode = DOCK_MODES.includes(parsed.mode as IleCommandDockMode)
      ? (parsed.mode as IleCommandDockMode)
      : "bottom-left";
    const left = Number(parsed.left);
    const top = Number(parsed.top);
    return {
      mode,
      left: Number.isFinite(left) ? left : 0,
      top: Number.isFinite(top) ? top : 0,
    };
  } catch {
    return fallback;
  }
}

export function serializeIleCommandDock(state: IleCommandDockState): string {
  return JSON.stringify({ mode: state.mode, left: state.left, top: state.top });
}
