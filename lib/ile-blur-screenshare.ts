/**
 * ILE leave-tab policy. Losing focus does not open a floating session
 * window and does not auto-request screenshare.
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
  void input;
  return "hide";
}

export type IleMiniAutoOpenDecision = "open" | "hide";

/** Leave-tab never opens a floating session window. */
export function decideIleMiniAutoOpen(input: {
  sessionActive: boolean;
  tabFocused: boolean;
  leaveReason?: IleLeaveFocusReason | null;
  documentPipSupported?: boolean;
}): IleMiniAutoOpenDecision {
  void input;
  return "hide";
}

/** Hide while away when auto-open said hide. Focused hide is the on-tab default. */
/** Stable PiP paint key — omit the canvas so board strokes do not remount Excalidraw. */
export function ileCompactPaintKey(compact: {
  formingText?: string | null;
  speechDisplay?: string | null;
  speechError?: string | null;
  speechSupported?: boolean | null;
  isListening?: boolean;
  speechEnabled?: boolean;
  isScreenSharing?: boolean;
}): string {
  return [
    compact.formingText ?? "",
    compact.speechDisplay ?? "",
    compact.speechError ?? "",
    compact.speechSupported ? "1" : "0",
    compact.isListening ? "1" : "0",
    compact.speechEnabled ? "1" : "0",
    compact.isScreenSharing ? "1" : "0",
  ].join("\0");
}

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


