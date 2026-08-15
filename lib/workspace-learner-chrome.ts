/**
 * Learner map visual cues for content blocks.
 * Default: white/neutral theme. Distinct color only when marked Done.
 * Creator path stays neutral via mapCellChromeClasses.
 */

import {
  MAP_CELL_DONE_CLASS,
  MAP_CELL_DONE_RING_CLASS,
  MAP_CELL_SELECTED_CLASS,
  MAP_CELL_SELF_PROGRESS_CLASS,
  mapCellChromeClasses,
  mapCellFreeformDoneColors,
  mapCellFreeformSelfProgressColors,
  resolveMapCellStatusIcon,
  type MapCellStatusIcon,
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

/** Done learner tile — same white + tick language as the ILE chapter map. */
export const LEARNER_MAP_CELL_DONE_CLASS = MAP_CELL_DONE_CLASS;

/** Self-progress learner tile — fainter white than Done. */
export const LEARNER_MAP_CELL_PROGRESS_CLASS = MAP_CELL_SELF_PROGRESS_CLASS;

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
  /** This user has worked on this block at least once. */
  workedOn?: boolean;
}): string {
  void input.isStart; // Starter flag badge still shows; tile color stays white.
  const done = isBlockCompletedStatus(input.status);
  const workedOn = Boolean(input.workedOn) && !done;
  if (input.depHighlight && !done && !workedOn) {
    return LEARNER_MAP_CELL_DEP_HIGHLIGHT_CLASS;
  }
  if (input.locked && !done) {
    return input.selected
      ? `${MAP_CELL_SELECTED_CLASS} opacity-80`
      : LEARNER_MAP_CELL_LOCKED_CLASS;
  }
  if (done) {
    return input.selected
      ? `${LEARNER_MAP_CELL_DONE_CLASS} ${MAP_CELL_DONE_RING_CLASS}`
      : LEARNER_MAP_CELL_DONE_CLASS;
  }
  if (workedOn) {
    return input.selected
      ? `${LEARNER_MAP_CELL_PROGRESS_CLASS} ${MAP_CELL_DONE_RING_CLASS}`
      : LEARNER_MAP_CELL_PROGRESS_CLASS;
  }
  if (input.selected) {
    return MAP_CELL_SELECTED_CLASS;
  }
  return LEARNER_MAP_CELL_DEFAULT_CLASS;
}

/** Freeform inline fill/border for learner white theme + selection / lock / dep. */
export function learnerMapFreeformColors(
  selected: boolean,
  opts?: {
    locked?: boolean;
    depHighlight?: boolean;
    done?: boolean;
    workedOn?: boolean;
  },
): {
  fill: string;
  border: string;
  text: string;
  shadow?: string;
} {
  if (opts?.done) {
    return mapCellFreeformDoneColors(selected);
  }
  if (opts?.workedOn) {
    return mapCellFreeformSelfProgressColors(selected);
  }
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

/** Creator path unchanged — delegate to shared map chrome. */
export function resolveOccupiedMapChrome(input: {
  learnerMode: boolean;
  status: string;
  selected: boolean;
  focused?: boolean;
  isStart?: boolean;
  locked?: boolean;
  depHighlight?: boolean;
  highlightRole?: "target" | "prereq" | "selected" | "locked" | "neutral" | null;
  workedOn?: boolean;
}): string {
  if (input.learnerMode) {
    return learnerMapCellChromeClasses({
      status: input.locked && !isBlockCompletedStatus(input.status)
        ? "locked"
        : input.status,
      selected: Boolean(input.selected || input.focused),
      isStart: input.isStart,
      locked: input.locked,
      depHighlight: input.depHighlight,
      workedOn: input.workedOn,
    });
  }
  return mapCellChromeClasses({
    status: input.locked && !isBlockCompletedStatus(input.status)
      ? "locked"
      : input.status,
    selected: input.selected,
    focused: input.focused,
    highlightRole: input.highlightRole,
    workedOn: input.workedOn,
    surface: "block",
  });
}

/** Occupied workspace tile chrome + glyph (tick / gear) from the shared mapper. */
export function resolveOccupiedMapTileChrome(input: {
  learnerMode: boolean;
  status: string;
  selected: boolean;
  focused?: boolean;
  isStart?: boolean;
  locked?: boolean;
  depHighlight?: boolean;
  highlightRole?: "target" | "prereq" | "selected" | "locked" | "neutral" | null;
  workedOn?: boolean;
}): { className: string; statusIcon: MapCellStatusIcon } {
  return {
    className: resolveOccupiedMapChrome(input),
    statusIcon: resolveMapCellStatusIcon(
      input.status,
      true,
      "block",
      Boolean(input.workedOn),
    ),
  };
}
