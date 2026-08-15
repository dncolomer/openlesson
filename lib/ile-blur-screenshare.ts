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
  /** User already dismissed the picker this session — do not re-prompt. */
  shareDeclined?: boolean;
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
  // Leave-focus never auto-opens getDisplayMedia. Mini mode can recommend share.
  void input.shareDeclined;
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

/** First-time mini-mode consent. `never` = not asked yet. */
export type IleMiniModeConsent = "never" | "accepted" | "declined";

/** Compact window vs first-time prompt on a leave/focus event. */
export type IleMiniModeFirstAskDecision = "ask" | "open" | "hide";

export const ILE_MINI_MODE_CONSENT_STORAGE_KEY = "openlesson.ile.miniMode.consent.v1";

export function parseIleMiniModeConsent(raw: unknown): IleMiniModeConsent {
  if (raw === "accepted" || raw === "declined") return raw;
  return "never";
}

export type IleMiniModeConsentStorage = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
};

function defaultConsentStorage(): IleMiniModeConsentStorage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function loadIleMiniModeConsent(
  storage?: IleMiniModeConsentStorage | null,
): IleMiniModeConsent {
  const store = storage === undefined ? defaultConsentStorage() : storage;
  if (!store) return "never";
  try {
    return parseIleMiniModeConsent(store.getItem(ILE_MINI_MODE_CONSENT_STORAGE_KEY));
  } catch {
    return "never";
  }
}

export function saveIleMiniModeConsent(
  consent: IleMiniModeConsent,
  storage?: IleMiniModeConsentStorage | null,
): IleMiniModeConsent {
  const next = parseIleMiniModeConsent(consent);
  const store = storage === undefined ? defaultConsentStorage() : storage;
  if (store && next !== "never") {
    try {
      store.setItem(ILE_MINI_MODE_CONSENT_STORAGE_KEY, next);
    } catch {
      /* quota / private mode */
    }
  }
  return next;
}

/**
 * When Document PiP exists, Chrome owns first-time permission
 * (this time / every visit / don’t allow) via enterpictureinpicture.
 * In-app ask is only for browsers with no Document PiP API.
 */
export function decideIleMiniModeFirstAsk(input: {
  sessionActive: boolean;
  tabFocused: boolean;
  leaveReason?: IleLeaveFocusReason | null;
  consent: IleMiniModeConsent;
  documentPipSupported?: boolean;
}): IleMiniModeFirstAskDecision {
  if (!input.sessionActive) return "hide";
  if (!isIleAwayFromTab(input)) return "hide";
  if (input.documentPipSupported) return "open";
  // No Document PiP: never first-ask or auto-open on leave. Button only.
  void input.consent;
  return "hide";
}

/**
 * Declined (first==="hide") while away must not open or re-ask the popup.
 * Focused first==="hide" is the on-tab default — do not honor-hide that,
 * or an in-progress first-ask would be cleared on return/focus.
 */
export function shouldHonorIleMiniModeHide(input: {
  first: IleMiniModeFirstAskDecision;
  away: boolean;
}): boolean {
  return input.first === "hide" && input.away;
}

export function ileMiniModeFirstAskCopy(): {
  title: string;
  body: string;
  accept: string;
  decline: string;
} {
  return {
    title: "Enable mini mode",
    body: "When you leave this tab, ILE can stay in a small always-on-top mini window. Browsers block that unless you allow it once — enable mini mode so you don't miss it.",
    accept: "Enable mini mode",
    decline: "Not now",
  };
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
  win: { hasFocus?: () => boolean } = typeof window !== "undefined" ? window : {},
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

/**
 * Full leave-focus sequence the ILE hook runs: decide compact show/hide
 * (no auto share request) → re-apply with live focus. Tests drive this.
 */
export async function runIleLeaveFocusSequence(input: {
  isIleSession: boolean;
  sessionActive: boolean;
  tabFocused: boolean;
  isScreenSharing: boolean;
  shareRequestInFlight?: boolean;
  shareDeclined?: boolean;
  leaveReason?: IleLeaveFocusReason | null;
  startScreenshare?: () => Promise<boolean | void>;
  readLiveTabFocused: () => boolean;
}): Promise<{
  pre: IleLeaveFocusPolicy;
  post: IleLeaveFocusPolicy;
  requestedShare: boolean;
}> {
  const pre = applyIleLeaveFocusPolicy({
    isIleSession: input.isIleSession,
    sessionActive: input.sessionActive,
    tabFocused: input.tabFocused,
    isScreenSharing: input.isScreenSharing,
    shareRequestInFlight: input.shareRequestInFlight,
    shareDeclined: input.shareDeclined,
    leaveReason: input.leaveReason,
  });

  let requestedShare = false;
  let sharing = input.isScreenSharing;
  if (pre.screenshare === "request" && input.startScreenshare) {
    requestedShare = true;
    try {
      const started = await input.startScreenshare();
      if (started !== false) sharing = true;
    } catch {
      // Permission denied / unsupported — session continues.
    }
  }

  const liveFocused = input.readLiveTabFocused();
  const post = applyIleCompactWindowAfterShareAwait({
    isIleSession: input.isIleSession,
    sessionActive: input.sessionActive,
    tabFocused: liveFocused,
    isScreenSharing: sharing,
  });

  return { pre, post, requestedShare };
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
