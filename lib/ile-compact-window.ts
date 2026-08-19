/**
 * Always-on-top compact ILE window (Google Meet analog).
 * When Document Picture-in-Picture exists, that is the only open path —
 * a failed / Don’t-allow requestWindow must not fall through to window.open.
 * Popup is only for browsers with no Document PiP API.
 */

export const ILE_COMPACT_WINDOW_WIDTH = 360;
export const ILE_COMPACT_WINDOW_HEIGHT = 440;

export type IleCompactWindowKind = "document-pip" | "popup";

export type IleCompactWindowHandle = {
  window: Window;
  kind: IleCompactWindowKind;
};

export type DocumentPipHost = {
  requestWindow: (options?: {
    width?: number;
    height?: number;
    disallowReturnToOpener?: boolean;
  }) => Promise<Window>;
  /** Current Document PiP window, if any (Chrome `documentPictureInPicture.window`). */
  window?: Window | null;
};

export function isIleCompactWindowLive(
  handle: { window?: Window | null } | null | undefined,
): boolean {
  return Boolean(handle?.window && handle.window.closed !== true);
}

export function resolveLiveIleDocumentPipWindow(
  host: { window?: Window | null } | null | undefined,
): Window | null {
  if (!isIleCompactWindowLive(host)) return null;
  return host!.window ?? null;
}

function defaultDocumentPipWindow(): { documentPictureInPicture?: DocumentPipHost } | null {
  if (typeof globalThis === "undefined") return null;
  const win = (globalThis as { window?: { documentPictureInPicture?: DocumentPipHost } }).window;
  return win ?? null;
}

export function resolveIleDocumentPipHost(
  win: { documentPictureInPicture?: DocumentPipHost } | null | undefined = defaultDocumentPipWindow(),
): DocumentPipHost | null {
  const host = win?.documentPictureInPicture;
  if (!host || typeof host.requestWindow !== "function") return null;
  return host;
}

export function isIleDocumentPipSupported(
  host: { documentPictureInPicture?: DocumentPipHost } | null | undefined = defaultDocumentPipWindow(),
): boolean {
  return resolveIleDocumentPipHost(host) != null;
}

/** Call requestWindow as a method — Blink WebIDL throws if the function is detached. */
export async function invokeIleDocumentPipRequestWindow(
  host: DocumentPipHost | null | undefined,
  options: { width: number; height: number; disallowReturnToOpener?: boolean },
): Promise<Window | null | undefined> {
  if (!host || typeof host.requestWindow !== "function") return undefined;
  return host.requestWindow(options);
}

export function decideIleMiniWindowKind(documentPipSupported: boolean): IleCompactWindowKind {
  return documentPipSupported ? "document-pip" : "popup";
}

export function interpretIlePopupOpenResult(win: Window | null | undefined): "opened" | "blocked" {
  if (!win) return "blocked";
  if (win.closed === true) return "blocked";
  return "opened";
}

export function isIlePopupReusable(input: {
  window?: { closed?: boolean } | null;
  userDismissed?: boolean;
}): boolean {
  if (input.userDismissed) return false;
  if (!input.window || input.window.closed === true) return false;
  return true;
}

export const ILE_OPEN_PIC_IN_PIC_LABEL = "open pic-in-pic";

/** Meet-style Document PiP may auto-open on leave. Popups never do. */
export function shouldAutoOpenIleMiniOnLeave(input: {
  documentPipSupported: boolean;
}): boolean {
  return input.documentPipSupported === true;
}

export function shouldShowIleOpenPicInPicButton(documentPipSupported: boolean): boolean {
  return !documentPipSupported;
}

export function shouldOpenIlePopupFromButton(input: {
  sessionActive: boolean;
  documentPipSupported: boolean;
  reusable: boolean;
}): boolean {
  return Boolean(input.sessionActive && !input.documentPipSupported && !input.reusable);
}

/**
 * Button-opened popup stays until the learner closes it or the page unmounts.
 * Help/pause (recording off) must not destroy it.
 */
export function shouldKeepIleManualPopupOnReturn(input: {
  kind?: IleCompactWindowKind;
  sessionActive?: boolean;
}): boolean {
  void input.sessionActive;
  return input.kind === "popup";
}

export function ileCompactPopupFeatures(
  width = ILE_COMPACT_WINDOW_WIDTH,
  height = ILE_COMPACT_WINDOW_HEIGHT,
  screenLike?: { availLeft?: number; availTop?: number; availWidth?: number; availHeight?: number },
): string {
  const screen = (screenLike ??
    (typeof window !== "undefined" ? window.screen : undefined)) as
    | { availLeft?: number; availTop?: number; availWidth?: number; availHeight?: number }
    | undefined;
  const availLeft = screen?.availLeft ?? 0;
  const availTop = screen?.availTop ?? 0;
  const availWidth = screen?.availWidth ?? 1280;
  const availHeight = screen?.availHeight ?? 800;
  const left = Math.max(0, availLeft + availWidth - width - 16);
  const top = Math.max(0, availTop + availHeight - height - 56);
  return `popup=yes,width=${width},height=${height},left=${left},top=${top}`;
}

/** html/body fill the live PiP window — no leftover fixed content height. */
export function ileCompactDocumentFillStyles(): {
  html: { height: string; margin: string };
  body: { height: string; margin: string; padding: string; overflow: string };
} {
  return {
    html: { height: "100%", margin: "0" },
    body: { height: "100%", margin: "0", padding: "0", overflow: "hidden" },
  };
}

/** Compact paint root stretches to the document; do not pin minHeight. */
export function ileCompactRootFillStyle(): { height: "100%"; minHeight: 0 } {
  return { height: "100%", minHeight: 0 };
}

export function styleIleCompactDocument(doc: Document): void {
  const fill = ileCompactDocumentFillStyles();
  doc.documentElement.style.height = fill.html.height;
  doc.documentElement.style.margin = fill.html.margin;
  doc.documentElement.style.background = "#0a0a0a";
  doc.body.style.margin = fill.body.margin;
  doc.body.style.padding = fill.body.padding;
  doc.body.style.background = "#0a0a0a";
  doc.body.style.color = "#e5e5e5";
  doc.body.style.fontFamily = "ui-sans-serif, system-ui, sans-serif";
  doc.body.style.height = fill.body.height;
  doc.body.style.overflow = fill.body.overflow;
}

/** Copy opener stylesheets so TAP/ILE Tailwind chrome works in PiP / popup. */
export function copyOpenerStylesToIleCompactDocument(
  target: Document,
  source?: Document | null,
): void {
  const src = source ?? (typeof document !== "undefined" ? document : null);
  if (!src || !target) return;
  const head = target.head;
  if (!head) return;
  let nodes: Element[] = [];
  try {
    nodes = Array.from(src.querySelectorAll('link[rel="stylesheet"], style'));
  } catch {
    return;
  }
  for (const node of nodes) {
    try {
      head.appendChild(node.cloneNode(true));
    } catch {
      /* ignore */
    }
  }
}

export async function openIleAlwaysOnTopWindow(options?: {
  width?: number;
  height?: number;
  requestPip?: DocumentPipHost["requestWindow"];
  pipHost?: DocumentPipHost | null;
  openPopup?: (url: string, name: string, features: string) => Window | null;
  screen?: { availLeft?: number; availTop?: number; availWidth?: number; availHeight?: number };
  /** Only for browsers with no Document PiP API. Ignored when requestPip exists. */
  allowPopupFallback?: boolean;
}): Promise<IleCompactWindowHandle | null> {
  const width = options?.width ?? ILE_COMPACT_WINDOW_WIDTH;
  const height = options?.height ?? ILE_COMPACT_WINDOW_HEIGHT;
  const pipOpts = { width, height, disallowReturnToOpener: false };

  if (typeof options?.requestPip === "function") {
    try {
      const pip = await options.requestPip(pipOpts);
      if (pip) {
        styleIleCompactDocument(pip.document);
        copyOpenerStylesToIleCompactDocument(pip.document);
        return { window: pip, kind: "document-pip" };
      }
    } catch {
      // Don’t allow / no-gesture — never a popup stand-in when Document PiP exists.
    }
    return null;
  }

  const pipHost = options?.pipHost !== undefined ? options.pipHost : resolveIleDocumentPipHost();
  if (pipHost) {
    try {
      const pip = await invokeIleDocumentPipRequestWindow(pipHost, pipOpts);
      if (pip) {
        styleIleCompactDocument(pip.document);
        copyOpenerStylesToIleCompactDocument(pip.document);
        return { window: pip, kind: "document-pip" };
      }
    } catch {
      // Don’t allow / no-gesture — never a popup stand-in when Document PiP exists.
    }
    return null;
  }

  if (options?.allowPopupFallback === false) return null;
  return openIleCompactPopupWindow({
    width,
    height,
    openPopup: options?.openPopup,
    screen: options?.screen,
  });
}

/** Popup-only open. Null `window.open` is blocked — never a live handle. */
export async function openIleCompactPopupWindow(options?: {
  width?: number;
  height?: number;
  openPopup?: (url: string, name: string, features: string) => Window | null;
  screen?: { availLeft?: number; availTop?: number; availWidth?: number; availHeight?: number };
}): Promise<IleCompactWindowHandle | null> {
  const width = options?.width ?? ILE_COMPACT_WINDOW_WIDTH;
  const height = options?.height ?? ILE_COMPACT_WINDOW_HEIGHT;
  const openPopup =
    options?.openPopup ??
    (typeof window !== "undefined" ? window.open.bind(window) : undefined);
  if (!openPopup) return null;
  try {
    const popup = openPopup(
      "",
      "ile-compact-stash",
      ileCompactPopupFeatures(width, height, options?.screen),
    );
    if (interpretIlePopupOpenResult(popup) === "blocked") return null;
    styleIleCompactDocument(popup!.document);
    copyOpenerStylesToIleCompactDocument(popup!.document);
    return { window: popup!, kind: "popup" };
  } catch {
    return null;
  }
}

export function closeIleAlwaysOnTopWindow(handle: IleCompactWindowHandle | null | undefined): void {
  if (!handle?.window || handle.window.closed) return;
  try {
    handle.window.close();
  } catch {
    // already gone
  }
}
