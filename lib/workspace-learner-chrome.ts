/**
 * Learner map visual cues for content blocks.
 * Default: white/neutral theme. Distinct color only when marked Done.
 * Creator path stays neutral via mapCellChromeClasses.
 */

import {
  MAP_CELL_SELECTED_CLASS,
  mapCellChromeClasses,
} from "@/lib/map-cell-chrome";
import { isBlockCompletedStatus } from "@/lib/map-ground-rules";

/** Default learner tile — white-themed content block (not starter/sky tints). */
export const LEARNER_MAP_CELL_DEFAULT_CLASS =
  "border-white/25 bg-white/[0.07] text-neutral-50 shadow-[0_0_10px_rgba(255,255,255,0.04)]";

/** Locked learner tile — rose lock chrome so gated blocks are spottable. */
export const LEARNER_MAP_CELL_LOCKED_CLASS =
  "border-rose-500/45 bg-rose-950/30 text-neutral-100 shadow-[0_0_10px_rgba(244,63,94,0.12)] opacity-95 pointer-events-auto";

/** Dependency peer highlight (prereq / local-DAG neighbor of selected block). */
export const LEARNER_MAP_CELL_DEP_HIGHLIGHT_CLASS =
  "border-white/55 bg-white/12 text-white shadow-[0_0_14px_rgba(255,255,255,0.16)] ring-1 ring-white/30";

/** Done learner tile — only status that leaves the white default. */
export const LEARNER_MAP_CELL_DONE_CLASS =
  "border-emerald-600/45 bg-emerald-950/45 text-emerald-50/95 shadow-[0_0_12px_rgba(16,185,129,0.12)]";

/**
 * Learner-mode occupied tile classes.
 * White theme by default; distinct color only when status is completed/done.
 * Selection uses a strong white ring (same language as Creator select).
 */
export function learnerMapCellChromeClasses(input: {
  status: string;
  selected: boolean;
  isStart?: boolean;
  locked?: boolean;
  /** Local-DAG dependency peer of the selected block. */
  depHighlight?: boolean;
}): string {
  void input.isStart; // Starter flag badge still shows; tile color stays white.
  if (input.selected) {
    return MAP_CELL_SELECTED_CLASS;
  }
  if (input.depHighlight) {
    return LEARNER_MAP_CELL_DEP_HIGHLIGHT_CLASS;
  }
  if (input.locked) {
    return LEARNER_MAP_CELL_LOCKED_CLASS;
  }
  if (isBlockCompletedStatus(input.status)) {
    return LEARNER_MAP_CELL_DONE_CLASS;
  }
  return LEARNER_MAP_CELL_DEFAULT_CLASS;
}

/** Freeform inline fill/border for learner white theme + selection / lock / dep. */
export function learnerMapFreeformColors(
  selected: boolean,
  opts?: { locked?: boolean; depHighlight?: boolean },
): {
  fill: string;
  border: string;
  text: string;
  shadow?: string;
} {
  if (selected) {
    return {
      fill: "rgba(255, 255, 255, 0.16)",
      border: "rgba(255, 255, 255, 0.65)",
      text: "rgb(250, 250, 250)",
      shadow: "0 0 16px rgba(255,255,255,0.18)",
    };
  }
  if (opts?.depHighlight) {
    return {
      fill: "rgba(255, 255, 255, 0.12)",
      border: "rgba(255, 255, 255, 0.55)",
      text: "rgb(250, 250, 250)",
      shadow: "0 0 14px rgba(255,255,255,0.14)",
    };
  }
  if (opts?.locked) {
    return {
      fill: "rgba(127, 29, 29, 0.35)",
      border: "rgba(244, 63, 94, 0.5)",
      text: "rgb(254, 226, 226)",
      shadow: "0 0 10px rgba(244,63,94,0.14)",
    };
  }
  return {
    fill: "rgba(255, 255, 255, 0.07)",
    border: "rgba(255, 255, 255, 0.28)",
    text: "rgb(245, 245, 245)",
    shadow: "0 0 10px rgba(255,255,255,0.04)",
  };
}

/** Creator path unchanged — delegate to neutral map chrome. */
export function resolveOccupiedMapChrome(input: {
  learnerMode: boolean;
  status: string;
  selected: boolean;
  focused?: boolean;
  isStart?: boolean;
  locked?: boolean;
  depHighlight?: boolean;
  highlightRole?: "target" | "prereq" | "selected" | "locked" | "neutral" | null;
}): string {
  if (input.learnerMode) {
    return learnerMapCellChromeClasses({
      status: input.locked ? "locked" : input.status,
      selected: Boolean(input.selected || input.focused),
      isStart: input.isStart,
      locked: input.locked,
      depHighlight: input.depHighlight,
    });
  }
  return mapCellChromeClasses({
    status: input.locked ? "locked" : input.status,
    selected: input.selected,
    focused: input.focused,
    highlightRole: input.highlightRole,
  });
}
