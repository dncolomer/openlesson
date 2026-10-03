/**
 * Right-rail session chrome shared by ILE, TAP, and verification TAP.
 * Learn mounts it from session chrome. Prepare, Drill, conversational TAP,
 * and verification TAP mount it from SessionWorkSurface.
 */

export const SESSION_SIDEBAR_MODES = ["ile", "tap", "verification-tap"] as const;

export type SessionSidebarMode = (typeof SESSION_SIDEBAR_MODES)[number];

export const SESSION_SIDEBAR_SECTIONS = [
  "insights",
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
 * Expanded column. 20rem is under the 24rem cap and wider than the rail.
 */
export const SESSION_SIDEBAR_EXPANDED_REM = 20;

/**
 * Collapsed rail. Stays in the layout: inside 5.5rem–7.5rem, never 0.
 */
export const SESSION_SIDEBAR_COLLAPSED_REM = 6.5;

/** This ILE version has no work-canvas countdown. TAP can still show a clock. */
const ILE_SESSION_SIDEBAR_SECTIONS = [
  "insights",
  "chapters",
  "signals",
  "transcript",
  "data",
  "logs",
  "save",
] as const satisfies readonly SessionSidebarSection[];

/**
 * TAP and verification TAP drop insights and the extra data-input channels
 * (signal previews and the Data action). Transcript, clock, chapters, Logs,
 * and Save stay so the same host can be configured later.
 */
const TAP_SESSION_SIDEBAR_SECTIONS = [
  "chapters",
  "transcript",
  "clock",
  "logs",
  "save",
] as const satisfies readonly SessionSidebarSection[];

const VERIFICATION_TAP_SESSION_SIDEBAR_SECTIONS = [
  "chapters",
  "transcript",
  "clock",
  "logs",
  "save",
] as const satisfies readonly SessionSidebarSection[];

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
 * Signal tiles mounted in the ILE sidebar. Audio is always present; EEG,
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
