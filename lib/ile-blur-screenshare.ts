/**
 * ILE leave-tab policy: show/hide the Meet-style always-on-top compact
 * stash window. Losing focus does not auto-request screenshare.
 *
 * Pure decisions — SessionView / Grok-Grokipedia call these; I/O
 * (Document PiP / popup) stays at the edge.
 */

export type IleLeaveFocusReason =
  | "tab_hidden"
  | "tab_blur"
  | "grok"
  | "grokipedia"
  | "external_tool";

export type IleScreenshareDecision = "request" | "already_on" | "skip";
export type IleCompactWindowDecision = "show" | "hide";

export type IleLeaveFocusPolicyInput = {
  isIleSession: boolean;
  sessionActive: boolean;
  /** True when the Uncertain Systems ILE tab is visible and focused. */
  tabFocused: boolean;
  isScreenSharing: boolean;
  /** In-flight getDisplayMedia so we do not re-prompt. */
  shareRequestInFlight?: boolean;
  leaveReason?: IleLeaveFocusReason | null;
};

export type IleLeaveFocusPolicy = {
  screenshare: IleScreenshareDecision;
  compactWindow: IleCompactWindowDecision;
};

export function isIleLeaveFocusReason(value: unknown): value is IleLeaveFocusReason {
  return (
    value === "tab_hidden" ||
    value === "tab_blur" ||
    value === "grok" ||
    value === "grokipedia" ||
    value === "external_tool"
  );
}

export function ileTabIsFocused(input: { hidden?: boolean; hasFocus?: boolean }): boolean {
  if (input.hidden === true) return false;
  if (input.hasFocus === false) return false;
  return true;
}

export function isIleAwayFromTab(input: {
  tabFocused: boolean;
  leaveReason?: IleLeaveFocusReason | null;
}): boolean {
  if (!input.tabFocused) return true;
  const reason = input.leaveReason;
  return reason === "grok" || reason === "grokipedia" || reason === "external_tool";
}

export function decideIleLeaveFocusScreenshare(
  input: IleLeaveFocusPolicyInput,
): IleScreenshareDecision {
  if (!input.isIleSession || !input.sessionActive) return "skip";
  if (!isIleAwayFromTab(input)) return "skip";
  if (input.isScreenSharing || input.shareRequestInFlight) return "already_on";
  // Leave-focus never auto-opens getDisplayMedia.
  return "skip";
}

/** Brief tip shown in mini mode — recommendation only, not a picker. */
export function ileMiniModeShareScreenNote(): string {
  return "While you're in mini mode, share your screen so we can follow along.";
}

export function shouldShowIleMiniShareScreenNote(isScreenSharing: boolean): boolean {
  return !Boolean(isScreenSharing);
}

export function decideIleCompactWindow(
  input: IleLeaveFocusPolicyInput,
): IleCompactWindowDecision {
  if (!input.isIleSession || !input.sessionActive) return "hide";
  if (!isIleAwayFromTab(input)) return "hide";
  return "show";
}

/** Compact window on leave: open Document PiP or stay hidden. */
export type IleMiniAutoOpenDecision = "open" | "hide";

/**
 * When Document PiP exists, Chrome owns permission via enterpictureinpicture.
 * Without it, leave must not auto-open a popup.
 */
export function decideIleMiniAutoOpen(input: {
  sessionActive: boolean;
  tabFocused: boolean;
  leaveReason?: IleLeaveFocusReason | null;
  documentPipSupported?: boolean;
}): IleMiniAutoOpenDecision {
  if (!input.sessionActive) return "hide";
  if (!isIleAwayFromTab(input)) return "hide";
  if (input.documentPipSupported) return "open";
  return "hide";
}

/** Hide while away when auto-open said hide. Focused hide is the on-tab default. */
export function shouldHonorIleMiniHide(input: {
  decision: IleMiniAutoOpenDecision;
  away: boolean;
}): boolean {
  return input.decision === "hide" && input.away;
}

/** Single helper SessionView and leave-tab tools call. */
export function applyIleLeaveFocusPolicy(
  input: IleLeaveFocusPolicyInput,
): IleLeaveFocusPolicy {
  return {
    screenshare: decideIleLeaveFocusScreenshare(input),
    compactWindow: decideIleCompactWindow(input),
  };
}

/** Live ILE-tab focus after a picker await (document.hidden + hasFocus). */
export function readIleTabFocusedFromDocument(
  doc: { hidden?: boolean } = typeof document !== "undefined" ? document : {},
  win: { hasFocus?: () => boolean } = (typeof window !== "undefined"
    ? window
    : {}) as { hasFocus?: () => boolean },
): boolean {
  const hasFocus = typeof win.hasFocus === "function" ? win.hasFocus() : true;
  return ileTabIsFocused({ hidden: Boolean(doc.hidden), hasFocus });
}

/**
 * After getDisplayMedia resolves, ignore the original leaveReason.
 * Only live tab focus decides whether the compact window may show.
 * (Grok/Grokipedia click keeps the ILE tab in front during the picker.)
 */
export function applyIleCompactWindowAfterShareAwait(input: {
  isIleSession: boolean;
  sessionActive: boolean;
  tabFocused: boolean;
  isScreenSharing?: boolean;
}): IleLeaveFocusPolicy {
  return applyIleLeaveFocusPolicy({
    isIleSession: input.isIleSession,
    sessionActive: input.sessionActive,
    tabFocused: input.tabFocused,
    isScreenSharing: Boolean(input.isScreenSharing),
    leaveReason: null,
    shareRequestInFlight: false,
  });
}

export type IleExternalLeaveReason = "grok" | "grokipedia";

/**
 * Grok / Grokipedia (and similar) leave-tab: notify policy first so the
 * click gesture can still open the display-media picker, then open the URL.
 */
export function openIleExternalLeaveTab(input: {
  url: string;
  reason: IleExternalLeaveReason;
  openWindow?: (url: string, target?: string, features?: string) => Window | null;
  onLeave?: (reason: IleExternalLeaveReason) => void;
}): { left: true; reason: IleExternalLeaveReason } {
  input.onLeave?.(input.reason);
  const open = input.openWindow ?? (typeof window !== "undefined" ? window.open.bind(window) : undefined);
  open?.(input.url, "_blank", "noopener,noreferrer");
  return { left: true, reason: input.reason };
}
