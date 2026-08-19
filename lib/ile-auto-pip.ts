/**
 * Chrome automatic Document Picture-in-Picture (Meet-style).
 * Register Media Session "enterpictureinpicture" while an ILE session
 * is capturing; Chrome then shows its native this-time / every-visit /
 * don’t-allow prompt. Never open a popup stand-in on this path.
 */

import {
  copyOpenerStylesToIleCompactDocument,
  ILE_COMPACT_WINDOW_HEIGHT,
  ILE_COMPACT_WINDOW_WIDTH,
  invokeIleDocumentPipRequestWindow,
  isIleDocumentPipSupported,
  resolveIleDocumentPipHost,
  resolveLiveIleDocumentPipWindow,
  styleIleCompactDocument,
  type DocumentPipHost,
  type IleCompactWindowHandle,
} from "@/lib/ile-compact-window";

export const ILE_ENTER_PICTURE_IN_PICTURE_ACTION = "enterpictureinpicture";

export type IleDocumentPipRequestWindow = (options?: {
  width?: number;
  height?: number;
  disallowReturnToOpener?: boolean;
}) => Promise<Window | null | undefined>;

export type IleMediaSessionLike = {
  setActionHandler: (
    action: string,
    handler: (() => void | Promise<void>) | null,
  ) => void;
  setMicrophoneActive?: (active: boolean) => Promise<void> | void;
  setCameraActive?: (active: boolean) => Promise<void> | void;
  playbackState?: string;
};

export function resolveIleMediaSession(
  host: { mediaSession?: IleMediaSessionLike } | null | undefined = typeof navigator === "undefined"
    ? null
    : (navigator as { mediaSession?: IleMediaSessionLike }),
): IleMediaSessionLike | null {
  const session = host?.mediaSession;
  if (!session || typeof session.setActionHandler !== "function") return null;
  return session;
}

export function registerIleEnterPictureInPictureHandler(
  session: IleMediaSessionLike | null | undefined,
  onEnter: () => void | Promise<void>,
): boolean {
  if (!session || typeof session.setActionHandler !== "function") return false;
  try {
    session.setActionHandler(ILE_ENTER_PICTURE_IN_PICTURE_ACTION, onEnter);
    return true;
  } catch {
    return false;
  }
}

export function clearIleEnterPictureInPictureHandler(
  session: IleMediaSessionLike | null | undefined,
): void {
  if (!session || typeof session.setActionHandler !== "function") return;
  try {
    session.setActionHandler(ILE_ENTER_PICTURE_IN_PICTURE_ACTION, null);
  } catch {
    /* unsupported */
  }
}

/** Signal conferencing capture so Chrome treats the tab as auto-PiP eligible. */
export function markIleMediaSessionCaptureActive(
  session: IleMediaSessionLike | null | undefined,
  active: boolean,
): void {
  if (!session) return;
  try {
    session.playbackState = active ? "playing" : "none";
  } catch {
    /* optional */
  }
  try {
    void session.setMicrophoneActive?.(active);
  } catch {
    /* optional */
  }
}

export const ILE_AUTO_PIP_MEDIA_ATTR = "data-ile-auto-pip-media";

/** Chrome auto-PiP eligibility: live getUserMedia must stay attached to a media element. */
export function attachIleAutoPipCaptureElement(
  stream: MediaStream | null | undefined,
  doc: Document | null | undefined = typeof document === "undefined" ? null : document,
): HTMLMediaElement | null {
  if (!stream || !doc?.body || typeof doc.createElement !== "function") return null;
  const hasVideo = typeof stream.getVideoTracks === "function" && stream.getVideoTracks().length > 0;
  const el = doc.createElement(hasVideo ? "video" : "audio");
  el.setAttribute(ILE_AUTO_PIP_MEDIA_ATTR, "true");
  el.autoplay = true;
  el.muted = true;
  el.setAttribute("playsinline", "true");
  el.style.position = "fixed";
  el.style.width = "1px";
  el.style.height = "1px";
  el.style.opacity = "0";
  el.style.pointerEvents = "none";
  try {
    el.srcObject = stream;
  } catch {
    return null;
  }
  doc.body.appendChild(el);
  void el.play()?.catch(() => {
    /* autoplay policy — getUserMedia capture still counts */
  });
  return el;
}

export function detachIleAutoPipCaptureElement(el: HTMLMediaElement | null | undefined): void {
  if (!el) return;
  try {
    el.pause();
  } catch {
    /* already gone */
  }
  try {
    el.srcObject = null;
  } catch {
    /* ignore */
  }
  el.remove();
}

/** Leave-tab must open Document PiP (Meet), not wait only for Chrome's handler. */
export function shouldRequestIleDocumentPipOnLeave(input: {
  sessionActive: boolean;
  compactWindow: "show" | "hide";
  documentPipSupported: boolean;
}): boolean {
  return Boolean(input.sessionActive && input.compactWindow === "show" && input.documentPipSupported);
}

/** Closed or user-dismissed PiP must not be painted or reused. */
export function isIleDocumentPipReusable(input: {
  window?: { closed?: boolean } | null;
  userDismissed?: boolean;
}): boolean {
  if (input.userDismissed) return false;
  if (!input.window || input.window.closed === true) return false;
  return true;
}

/**
 * pagehide on the PiP window.
 * User X (away or leftover after return) and Chrome auto-close are both
 * dismissals — that window must not be reused. Only ignore open-time pagehide.
 */
export function interpretIlePipPagehide(input: {
  openerHidden?: boolean;
  windowClosed?: boolean;
  justOpened?: boolean;
}): "ignore" | "user_dismissed" | "chrome_auto_closed" {
  if (input.justOpened) return "ignore";
  if (input.windowClosed === true) return "user_dismissed";
  if (input.openerHidden === true) return "user_dismissed";
  // Leftover PiP closed while the ILE tab is still visible (other window / after return).
  return "user_dismissed";
}

export function shouldRequestIleDocumentPipAfterDismiss(input: {
  sessionActive: boolean;
  away: boolean;
  reusable: boolean;
  documentPipSupported: boolean;
}): boolean {
  return Boolean(
    input.sessionActive && input.away && !input.reusable && input.documentPipSupported,
  );
}

export type IlePipStayEvent =
  | "open_complete"
  | "pip_pagehide"
  | "opener_focus"
  | "opener_blur"
  | "visibility"
  | "leave"
  | "session_off";

/**
 * Keep Document PiP up while the learner is away.
 * Do not treat opener-still-visible, post-open focus, or PiP pagehide as “back”.
 */
export function decideIlePipStayVsHide(input: {
  sessionActive: boolean;
  event: IlePipStayEvent;
  openerHidden?: boolean;
  openerHasFocus?: boolean;
  leaveReason?: string | null;
  justOpened?: boolean;
  kind?: "document-pip" | "popup";
}): "stay" | "hide" {
  // Manual popup: never auto-close on return/focus/visibility/pause.
  if (input.kind === "popup") return "stay";
  if (!input.sessionActive || input.event === "session_off") return "hide";

  if (
    input.event === "open_complete" ||
    input.event === "pip_pagehide" ||
    input.event === "opener_blur" ||
    input.event === "leave"
  ) {
    return "stay";
  }

  if (input.justOpened) return "stay";

  const ileTabReallyFocused = input.openerHidden === false && input.openerHasFocus === true;
  const awayLeave =
    input.leaveReason === "grok" ||
    input.leaveReason === "grokipedia" ||
    input.leaveReason === "external_tool";

  if (
    (input.event === "opener_focus" || input.event === "visibility") &&
    ileTabReallyFocused &&
    !awayLeave
  ) {
    return "hide";
  }

  return "stay";
}

/** Returning to the ILE tab must not destroy the PiP — Chrome hides it; next leave reuses or re-requests. */
export function shouldDestroyIlePipOnHide(input: {
  sessionActive: boolean;
  reason: "return" | "session_off";
  kind?: "document-pip" | "popup";
}): boolean {
  // Button-opened popup stays until explicit destroy (page unmount) or user X.
  if (input.kind === "popup") return false;
  if (!input.sessionActive || input.reason === "session_off") return true;
  return false;
}

/**
 * Document PiP only. A failed / Don’t-allow requestWindow must not
 * fall through to a popup stand-in.
 */
export async function openIleDocumentPictureInPictureWindow(options?: {
  width?: number;
  height?: number;
  requestPip?: IleDocumentPipRequestWindow;
  pipHost?: DocumentPipHost | null;
  openPopup?: (url: string, name: string, features: string) => Window | null;
  /** After the learner closes PiP, never reuse a stale host.window. */
  userDismissed?: boolean;
}): Promise<IleCompactWindowHandle | null> {
  void options?.openPopup;
  const width = options?.width ?? ILE_COMPACT_WINDOW_WIDTH;
  const height = options?.height ?? ILE_COMPACT_WINDOW_HEIGHT;
  const pipOpts = { width, height, disallowReturnToOpener: false };
  const host = options?.pipHost !== undefined ? options.pipHost : resolveIleDocumentPipHost();
  const adopt = (win: Window | null | undefined) => {
    if (!win || win.closed) return null;
    styleIleCompactDocument(win.document);
    copyOpenerStylesToIleCompactDocument(win.document);
    return { window: win, kind: "document-pip" as const };
  };
  const existing = resolveLiveIleDocumentPipWindow(host);
  if (
    existing &&
    typeof options?.requestPip !== "function" &&
    isIleDocumentPipReusable({ window: existing, userDismissed: options?.userDismissed })
  ) {
    return adopt(existing);
  }
  try {
    let pip: Window | null | undefined;
    if (typeof options?.requestPip === "function") {
      pip = await options.requestPip(pipOpts);
    } else {
      pip = await invokeIleDocumentPipRequestWindow(host, pipOpts);
    }
    const adopted = adopt(pip);
    if (adopted) return adopted;
  } catch {
    if (options?.userDismissed) return null;
    const fallback = resolveLiveIleDocumentPipWindow(host);
    if (fallback) return adopt(fallback);
    return null;
  }
  if (options?.userDismissed) return null;
  return adopt(resolveLiveIleDocumentPipWindow(host));
}

export function shouldUseIleDocumentPipOnly(
  host?: Parameters<typeof isIleDocumentPipSupported>[0],
): boolean {
  return isIleDocumentPipSupported(host);
}


