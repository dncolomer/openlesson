/**
 * Right-rail session chrome shared by TAP Learning, TAP, and verification TAP.
 * Learn mounts it from session chrome. Prepare, Drill, conversational TAP,
 * and verification TAP mount it from SessionWorkSurface.
 */

export const SESSION_SIDEBAR_MODES = ["ile", "tap", "verification-tap"] as const;

export type SessionSidebarMode = (typeof SESSION_SIDEBAR_MODES)[number];

export const SESSION_SIDEBAR_SECTIONS = [
  "focus",
  "chapters",
  "signals",
  "transcript",
  "clock",
  "save",
] as const;

export type SessionSidebarSection = (typeof SESSION_SIDEBAR_SECTIONS)[number];

/**
 * Expanded column. 20rem is under the 24rem cap. The rail does not collapse.
 */
export const SESSION_SIDEBAR_EXPANDED_REM = 20;

/**
 * Retired collapsed width. Kept so older width checks still have a number.
 * The live sidebar never uses it.
 */
export const SESSION_SIDEBAR_COLLAPSED_REM = 6.5;

/**
 * Full-width topic card at the top of the sidebar.
 * Taller than the retired 6rem dock chip (`h-24`) and taller than the Data console.
 */
export const SESSION_TOPIC_CARD_REM = 16;

/**
 * Data console under the focus block. The extra room keeps the readout
 * labels off the traces and the stop control.
 */
export const SESSION_DATA_CARD_REM = 13;

/** Retired dock chip height, in rem. The topic card stays taller than this. */
export const SESSION_TOPIC_DOCK_CHIP_REM = 6;

/**
 * `chapters` is the single static topic card, not a list.
 * Learn has no work-canvas countdown. The bottom row is Exit.
 * Prepare, Drill, conversational TAP, and Verify draw their countdown on the
 * bottom left of the topic card.
 */
const ILE_SESSION_SIDEBAR_SECTIONS = [
  "focus",
  "chapters",
  "signals",
  "transcript",
  "save",
] as const satisfies readonly SessionSidebarSection[];

/**
 * Prepare, Drill, conversational TAP, and Verify share the same sections.
 * The focus block is what changes. The clock stays on.
 */
const TAP_SESSION_SIDEBAR_SECTIONS = [
  "focus",
  "chapters",
  "signals",
  "transcript",
  "clock",
  "save",
] as const satisfies readonly SessionSidebarSection[];

const VERIFICATION_TAP_SESSION_SIDEBAR_SECTIONS = TAP_SESSION_SIDEBAR_SECTIONS;

export function sessionSidebarSections(
  mode: SessionSidebarMode,
): readonly SessionSidebarSection[] {
  switch (mode) {
    case "ile":
      return ILE_SESSION_SIDEBAR_SECTIONS;
    case "tap":
      return TAP_SESSION_SIDEBAR_SECTIONS;
    case "verification-tap":
      return VERIFICATION_TAP_SESSION_SIDEBAR_SECTIONS;
    default: {
      const unknown: never = mode;
      return unknown;
    }
  }
}

/** Elapsed Learn clock. Hours appear only after the first hour. */
export function formatLearnElapsedClock(elapsedMs: number): string {
  const total = Math.max(0, Math.floor(Number(elapsedMs) / 1000));
  const safe = Number.isFinite(total) ? total : 0;
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;
  const ss = String(seconds).padStart(2, "0");
  if (hours > 0) return `${hours}:${String(minutes).padStart(2, "0")}:${ss}`;
  return `${minutes}:${ss}`;
}

export function sessionSidebarHasSection(
  mode: SessionSidebarMode,
  section: SessionSidebarSection,
): boolean {
  return sessionSidebarSections(mode).includes(section);
}

/**
 * How many Data streams are live. Audio counts as one. EEG, screen, and webcam
 * add one each while that capture is on. The sidebar shows them as tabs, not tiles.
 */
export function ileSidebarSignalCount(input: {
  eegStreaming: boolean;
  screenCapturing: boolean;
  webcamEnabled: boolean;
}): number {
  return (
    1 +
    (input.eegStreaming ? 1 : 0) +
    (input.screenCapturing ? 1 : 0) +
    (input.webcamEnabled ? 1 : 0)
  );
}

/**
 * White primary control in the expanded sidebar actions row.
 * Learn uses it for Save. TAP flows use it for End session.
 */
export const SESSION_SIDEBAR_PRIMARY_BUTTON_CLASS =
  "pointer-events-auto h-7 min-w-0 rounded-none border border-white bg-white px-2 text-center font-mono text-[10px] font-semibold uppercase tracking-[0.22em] text-black hover:bg-neutral-200";

export function sessionSidebarWidthRem(collapsed: boolean): number {
  return collapsed ? SESSION_SIDEBAR_COLLAPSED_REM : SESSION_SIDEBAR_EXPANDED_REM;
}

/** In-flow rail. Width is never 0, and nothing translates the column off screen. */
export function sessionSidebarRailStyle(collapsed: boolean): {
  width: string;
  minWidth: string;
  maxWidth: string;
  flexShrink: 0;
} {
  const rem = sessionSidebarWidthRem(collapsed);
  const width = `${rem}rem`;
  return {
    width,
    minWidth: width,
    maxWidth: width,
    flexShrink: 0,
  };
}
