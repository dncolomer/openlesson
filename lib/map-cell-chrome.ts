/**
 * Shared map cell chrome for workspace block maps and ILE chapter maps.
 * Neutral palette always; selection = white highlight; status = gear/tick icons only.
 */

export type MapCellStatusIcon = "gear" | "tick" | null;

/** White selection ring/border tokens (never cyan/blue neon). */
export const MAP_CELL_SELECTED_CLASS =
  "ring-2 ring-white/55 ring-offset-2 ring-offset-[#0b0b0b] border-white/45 bg-neutral-900/90 text-neutral-50";

/** Multi-select / empty-cell selection (same white language as single select). */
export const MAP_CELL_MULTI_SELECTED_CLASS =
  "border-white/50 bg-white/10 text-neutral-50 ring-2 ring-white/50 shadow-[0_0_14px_rgba(255,255,255,0.12)]";

export const MAP_CELL_EMPTY_SELECTED_CLASS =
  "border-white/45 bg-white/10 text-neutral-100 ring-2 ring-white/40";

/**
 * Pending expand/bridge generation slot — white highlight with a light pulse
 * until that cell is created (progress indicator while jobs run).
 */
export const MAP_CELL_GENERATION_PENDING_CLASS =
  "border-white/50 bg-white/12 text-neutral-100 ring-2 ring-white/45 shadow-[0_0_16px_rgba(255,255,255,0.14)] animate-pulse";

/**
 * Milder white highlight for prerequisite blocks of the focused/edited target.
 * Dashed outline (not solid multi-select ring) so deps read as related, not selected.
 */
export const MAP_CELL_PREREQ_CLASS =
  "border-2 border-dashed border-white/45 bg-white/[0.05] text-neutral-100 shadow-[0_0_8px_rgba(255,255,255,0.06)]";

/** Target block under prereq-edit (full select language). */
export const MAP_CELL_TARGET_CLASS = MAP_CELL_SELECTED_CLASS;

/** Neutral unselected occupied tile. */
export const MAP_CELL_NEUTRAL_CLASS =
  "border-neutral-700/80 bg-neutral-950/75 text-neutral-100";

/**
 * Mark-as-Done tile (workspace + ILE chapter): white fill/border plus a tick.
 * Selection still adds the existing white-ring language on top.
 */
export const MAP_CELL_CHAPTER_DONE_CLASS =
  "border-white/80 bg-white text-neutral-900 shadow-[0_0_12px_rgba(255,255,255,0.2)]";

/** Alias — workspace Done uses the same tokens as the chapter map. */
export const MAP_CELL_DONE_CLASS = MAP_CELL_CHAPTER_DONE_CLASS;

/**
 * Self-progress (this user worked on the item at least once, not Done).
 * Fainter white than Done so the two states stay distinct.
 */
export const MAP_CELL_SELF_PROGRESS_CLASS =
  "border-white/50 bg-white/40 text-neutral-800 shadow-[0_0_8px_rgba(255,255,255,0.1)]";

/** White ring stacked on Done / self-progress when the tile is selected. */
export const MAP_CELL_DONE_RING_CLASS =
  "ring-2 ring-white/55 ring-offset-2 ring-offset-[#0b0b0b]";

export type MapCellSurface = "block" | "chapter";

export function isMapCellDoneStatus(status: string): boolean {
  const s = String(status || "").toLowerCase();
  return s === "completed" || s === "done";
}

function isCompletedChapterStatus(status: string): boolean {
  return isMapCellDoneStatus(status);
}

/** Locked tiles stay neutral but slightly dimmed — still fully clickable/selectable. */
export const MAP_CELL_LOCKED_CLASS =
  "border-neutral-800 bg-neutral-950/50 text-neutral-500 opacity-80 pointer-events-auto";

/** Unusable ground — shapes paths; not placeable open ground. */
export const MAP_CELL_UNUSABLE_CLASS =
  "border-neutral-900 bg-[repeating-linear-gradient(135deg,rgba(30,30,30,0.9)_0_4px,rgba(12,12,12,0.95)_4px_8px)] text-neutral-600 opacity-80";

/**
 * Status → icon for occupied map tiles.
 * Done (completed/done) → tick on both workspace and chapter maps.
 * This-user worked-on (and not Done) → gear. Done wins over progress.
 */
export function resolveMapCellStatusIcon(
  status: string,
  _showProgress: boolean,
  surface: MapCellSurface = "block",
  workedOn = false,
): MapCellStatusIcon {
  void surface;
  if (isMapCellDoneStatus(status)) return "tick";
  if (workedOn) return "gear";
  return null;
}

/**
 * Pure class mapper for occupied skill-grid tiles.
 * No emerald/amber/cyan status fills — selection/focus use white highlight only.
 */
export function mapCellChromeClasses(input: {
  status: string;
  selected: boolean;
  /** Active/loaded chapter or focused tile — same white language as selected. */
  focused?: boolean;
  showProgress?: boolean;
  /** Unusable ground cell (path-shaping). */
  unusable?: boolean;
  /**
   * Prereq-edit / preview role. When set, overrides selected/locked for target/prereq.
   * "prereq" → mild white; "target" → full select chrome.
   */
  highlightRole?: "target" | "prereq" | "selected" | "locked" | "neutral" | null;
  /** ILE chapter map vs workspace block map. */
  surface?: MapCellSurface;
  /** This user has worked on this tile at least once. */
  workedOn?: boolean;
}): string {
  const selected = Boolean(input.selected || input.focused);
  const status = String(input.status || "").toLowerCase();
  const role = input.highlightRole ?? null;
  const done = isMapCellDoneStatus(status);
  const workedOn = Boolean(input.workedOn) && !done;

  if (input.unusable) {
    return selected
      ? `${MAP_CELL_UNUSABLE_CLASS} ring-1 ring-white/30`
      : MAP_CELL_UNUSABLE_CLASS;
  }

  if (role === "target") return MAP_CELL_TARGET_CLASS;
  if (role === "prereq") return MAP_CELL_PREREQ_CLASS;
  if (role === "selected") return MAP_CELL_MULTI_SELECTED_CLASS;

  if (!done && (status === "locked" || status === "skipped" || role === "locked")) {
    return selected
      ? `${MAP_CELL_SELECTED_CLASS} opacity-80`
      : MAP_CELL_LOCKED_CLASS;
  }

  if (done) {
    return selected
      ? `${MAP_CELL_DONE_CLASS} ${MAP_CELL_DONE_RING_CLASS}`
      : MAP_CELL_DONE_CLASS;
  }

  if (workedOn) {
    return selected
      ? `${MAP_CELL_SELF_PROGRESS_CLASS} ${MAP_CELL_DONE_RING_CLASS}`
      : MAP_CELL_SELF_PROGRESS_CLASS;
  }

  if (selected) {
    return MAP_CELL_SELECTED_CLASS;
  }

  return MAP_CELL_NEUTRAL_CLASS;
}

/**
 * Shipped occupied-tile mapper used by workspace block maps and ILE chapter maps.
 * Done → white + tick. Self-progress → fainter white + gear. Done wins.
 */
export function resolveMapTileChrome(input: {
  status: string;
  selected: boolean;
  focused?: boolean;
  workedOn?: boolean;
  showProgress?: boolean;
  unusable?: boolean;
  highlightRole?: "target" | "prereq" | "selected" | "locked" | "neutral" | null;
  surface?: MapCellSurface;
}): { className: string; statusIcon: MapCellStatusIcon } {
  const surface = input.surface ?? "block";
  const workedOn = Boolean(input.workedOn);
  return {
    className: mapCellChromeClasses({
      status: input.status,
      selected: input.selected,
      focused: input.focused,
      showProgress: input.showProgress,
      unusable: input.unusable,
      highlightRole: input.highlightRole,
      surface,
      workedOn,
    }),
    statusIcon: resolveMapCellStatusIcon(
      input.status,
      input.showProgress ?? true,
      surface,
      workedOn,
    ),
  };
}

/**
 * ILE chapter-map occupied-cell chrome. Same mapper BlockSkillGrid chapter
 * mode uses — white + tick when completed; self-progress is gear + fainter white.
 */
export function ileChapterCellChrome(input: {
  status: string;
  selected: boolean;
  focused?: boolean;
  workedOn?: boolean;
}): { className: string; statusIcon: MapCellStatusIcon } {
  return resolveMapTileChrome({
    status: input.status,
    selected: input.selected,
    focused: input.focused,
    workedOn: input.workedOn,
    surface: "chapter",
  });
}

/** Freeform fill/border for mild prereq highlight (pair with dashed borderStyle). */
export function mapCellFreeformPrereqColors(): {
  fill: string;
  border: string;
  text: string;
  shadow?: string;
  borderStyle: "dashed";
} {
  return {
    fill: "rgba(255, 255, 255, 0.05)",
    border: "rgba(255, 255, 255, 0.45)",
    text: "rgb(245, 245, 245)",
    shadow: "0 0 8px rgba(255,255,255,0.06)",
    borderStyle: "dashed",
  };
}

/** True if class string is free of progress tints and cyan selection chrome. */
export function mapCellChromeIsNeutral(className: string): boolean {
  const s = className.toLowerCase();
  if (s.includes("emerald") || s.includes("amber") || s.includes("yellow") || s.includes("green-")) {
    return false;
  }
  if (s.includes("cyan") || s.includes("blue-") || s.includes("sky-")) {
    return false;
  }
  return true;
}

/** Freeform Done fill — full white, matches MAP_CELL_DONE_CLASS. */
export function mapCellFreeformDoneColors(selected = false): {
  fill: string;
  border: string;
  text: string;
  shadow?: string;
} {
  return {
    fill: "rgb(255, 255, 255)",
    border: selected ? "rgba(255, 255, 255, 0.95)" : "rgba(255, 255, 255, 0.8)",
    text: "rgb(23, 23, 23)",
    shadow: "0 0 12px rgba(255,255,255,0.2)",
  };
}

/** Freeform self-progress — fainter white than Done. */
export function mapCellFreeformSelfProgressColors(selected = false): {
  fill: string;
  border: string;
  text: string;
  shadow?: string;
} {
  return {
    fill: "rgba(255, 255, 255, 0.38)",
    border: selected ? "rgba(255, 255, 255, 0.7)" : "rgba(255, 255, 255, 0.5)",
    text: "rgb(23, 23, 23)",
    shadow: "0 0 8px rgba(255,255,255,0.1)",
  };
}

/** Freeform multi-select fill/border as CSS rgba (inline styles path). */
export function mapCellFreeformColors(selected: boolean): {
  fill: string;
  border: string;
  text: string;
  shadow?: string;
} {
  if (selected) {
    return {
      fill: "rgba(255, 255, 255, 0.12)",
      border: "rgba(255, 255, 255, 0.55)",
      text: "rgb(250, 250, 250)",
      shadow: "0 0 14px rgba(255,255,255,0.14)",
    };
  }
  return {
    fill: "rgba(10, 10, 12, 0.88)",
    border: "rgba(82, 82, 91, 0.9)",
    text: "rgb(229, 229, 229)",
  };
}
