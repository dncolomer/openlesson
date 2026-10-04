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
  "data",
  "logs",
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
 * Fixed height of the major block (insights, stashed text, or generated questions).
 * Content scrolls inside. The block does not grow with the list.
 */
export const SESSION_SIDEBAR_FOCUS_REM = 22;

/** Learn has no work-canvas countdown. The Data action stays on Learn. */
const ILE_SESSION_SIDEBAR_SECTIONS = [
  "focus",
  "chapters",
  "signals",
  "transcript",
  "data",
  "logs",
  "save",
] as const satisfies readonly SessionSidebarSection[];

/**
 * Prepare, Drill, conversational TAP, and Verify share the same sections.
 * The focus block is what changes. Data stays off. The clock stays on.
 */
const TAP_SESSION_SIDEBAR_SECTIONS = [
  "focus",
  "chapters",
  "signals",
  "transcript",
  "clock",
  "logs",
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

export function sessionSidebarHasSection(
  mode: SessionSidebarMode,
  section: SessionSidebarSection,
): boolean {
  return sessionSidebarSections(mode).includes(section);
}

/**
 * Signal tiles mounted in the TAP Learning sidebar. Audio is always present; EEG,
 * screen share, and webcam are added only while those captures are live.
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
  "pointer-events-auto h-7 min-w-0 rounded-none border border-white bg-white px-2 text-center font-mono text-[10px] font-semibold uppercase tracking-wider text-neutral-950 hover:bg-neutral-200";

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
