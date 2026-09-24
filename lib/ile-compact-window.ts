/**
 * Main-canvas surface events for the ILE work board.
 * Resize and wheel stay on the page that hosts the canvas.
 * There is no detached picture-in-picture or popup window.
 */

export type IleSurfaceView = {
  document: Document;
  window: Window;
  innerWidth: number;
  innerHeight: number;
  body: HTMLElement | null;
};

/** PiP / popup painting surface — ownerDocument.defaultView, never the opener. */
export function resolveIleSurfaceView(
  node?: { ownerDocument?: Document | null } | null,
): IleSurfaceView | null {
  const doc = node?.ownerDocument ?? null;
  const win = doc?.defaultView ?? null;
  if (!doc || !win) return null;
  return {
    document: doc,
    window: win,
    innerWidth: win.innerWidth,
    innerHeight: win.innerHeight,
    body: doc.body ?? null,
  };
}

/** Bind resize to the surface window so Excalidraw in PiP stays in sync. */
export function bindIleSurfaceResize(
  node: { ownerDocument?: Document | null } | null | undefined,
  onResize: () => void,
): () => void {
  const view = resolveIleSurfaceView(node ?? null);
  if (!view) return () => {};
  const handler = () => onResize();
  view.window.addEventListener("resize", handler);
  let observer: ResizeObserver | null = null;
  if (typeof ResizeObserver === "function" && node && "getBoundingClientRect" in node) {
    observer = new ResizeObserver(handler);
    try {
      observer.observe(node as Element);
    } catch {
      observer = null;
    }
  }
  return () => {
    view.window.removeEventListener("resize", handler);
    observer?.disconnect();
  };
}

/**
 * Excalidraw binds pointermove/up and wheel to `window` (the opener).
 * Document PiP has a different window, so strokes never finish unless we
 * forward those events onto the opener.
 *
 * Dispatch onto an HTMLElement (body), not the Window: Excalidraw's drag
 * handler bails if `event.target instanceof HTMLElement` is false.
 */
export const ILE_PIP_POINTER_BRIDGE_EVENTS = [
  "pointermove",
  "pointerup",
  "pointercancel",
  "keydown",
  "keyup",
] as const;

/**
 * PiP window-level `wheel` listeners are passive, so ctrl/pinch never
 * preventDefault and Chrome zooms the PiP chrome instead of the board.
 * Bind on the canvas host with `{passive:false}` instead.
 *
 * Trackpad two-finger pan (pixel deltas, no ctrl) stays native.
 * Ctrl/meta (pinch) and mouse-wheel line mode zoom the board.
 */
export function ileSurfaceWheelIsZoomIntent(event: {
  ctrlKey?: boolean;
  metaKey?: boolean;
  deltaX?: number;
  deltaY?: number;
  deltaMode?: number;
}): boolean {
  if (event.ctrlKey || event.metaKey) return true;
  const mode = Number(event.deltaMode) || 0;
  const dx = Number(event.deltaX) || 0;
  return mode !== 0 && Math.abs(dx) < 1;
}

export type IleSurfaceWheelZoomInput = {
  clientX: number;
  clientY: number;
  deltaY: number;
};

export function bindIleSurfaceWheelZoom(
  node: { ownerDocument?: Document | null; addEventListener?: EventTarget["addEventListener"]; removeEventListener?: EventTarget["removeEventListener"] } | null | undefined,
  onZoom: (input: IleSurfaceWheelZoomInput) => void,
  opener?: Window | null,
): () => void {
  if (!node || typeof node.addEventListener !== "function") return () => {};
  if (!ileSurfaceNeedsPointerBridge(node, opener)) return () => {};
  const opts: AddEventListenerOptions = { capture: true, passive: false };
  const onWheel = (event: Event) => {
    const wheel = event as WheelEvent;
    if (!ileSurfaceWheelIsZoomIntent(wheel)) return;
    if (typeof wheel.preventDefault === "function") wheel.preventDefault();
    if (typeof wheel.stopImmediatePropagation === "function") {
      wheel.stopImmediatePropagation();
    } else if (typeof wheel.stopPropagation === "function") {
      wheel.stopPropagation();
    }
    onZoom({
      clientX: Number(wheel.clientX) || 0,
      clientY: Number(wheel.clientY) || 0,
      deltaY: Number(wheel.deltaY) || 0,
    });
  };
  node.addEventListener("wheel", onWheel, opts);
  return () => {
    node.removeEventListener?.("wheel", onWheel, opts);
  };
}

const ILE_PIP_FORWARDED = "__ilePipForwarded";

export function ileSurfaceNeedsPointerBridge(
  node?: { ownerDocument?: Document | null } | null,
  opener?: Window | null,
): boolean {
  const view = resolveIleSurfaceView(node ?? null);
  const host = opener ?? (typeof window !== "undefined" ? window : null);
  return Boolean(view && host && view.window !== host);
}

/** Opener body so cloned events have an HTMLElement target (not Window). */
export function ileSurfacePointerBridgeDispatchTarget(
  host: Window | null | undefined,
): EventTarget | null {
  if (!host) return null;
  return host.document?.body ?? host.document?.documentElement ?? host;
}

function ileSurfaceEventInit(event: Event): EventInit {
  const mouse = event as Partial<MouseEvent & PointerEvent & WheelEvent & KeyboardEvent>;
  const init: Record<string, unknown> = {
    bubbles: true,
    cancelable: true,
    composed: true,
  };
  if (typeof mouse.clientX === "number") {
    init.clientX = mouse.clientX;
    init.clientY = mouse.clientY;
    init.screenX = mouse.screenX;
    init.screenY = mouse.screenY;
    init.ctrlKey = Boolean(mouse.ctrlKey);
    init.shiftKey = Boolean(mouse.shiftKey);
    init.altKey = Boolean(mouse.altKey);
    init.metaKey = Boolean(mouse.metaKey);
    init.button = mouse.button ?? 0;
    init.buttons = mouse.buttons ?? 0;
  }
  if (typeof mouse.pointerId === "number") {
    init.pointerId = mouse.pointerId;
    init.pointerType = mouse.pointerType || "mouse";
    init.isPrimary = mouse.isPrimary !== false;
    init.pressure = mouse.pressure ?? (mouse.buttons ? 0.5 : 0);
    init.width = mouse.width ?? 1;
    init.height = mouse.height ?? 1;
    init.tiltX = mouse.tiltX ?? 0;
    init.tiltY = mouse.tiltY ?? 0;
  }
  if (typeof mouse.deltaY === "number" || typeof mouse.deltaX === "number") {
    init.deltaX = mouse.deltaX ?? 0;
    init.deltaY = mouse.deltaY ?? 0;
    init.deltaZ = mouse.deltaZ ?? 0;
    init.deltaMode = mouse.deltaMode ?? 0;
  }
  if (typeof mouse.key === "string") {
    init.key = mouse.key;
    init.code = mouse.code;
    init.location = mouse.location ?? 0;
    init.repeat = Boolean(mouse.repeat);
  }
  return init;
}

function stampIleSurfaceEventClone(clone: Event, init: Record<string, unknown>): Event {
  for (const [key, value] of Object.entries(init)) {
    if (key === "bubbles" || key === "cancelable" || key === "composed") continue;
    try {
      Object.defineProperty(clone, key, { value, configurable: true });
    } catch {
      (clone as unknown as Record<string, unknown>)[key] = value;
    }
  }
  Object.defineProperty(clone, ILE_PIP_FORWARDED, { value: true });
  return clone;
}

export function cloneIleSurfaceEventForOpener(event: Event): Event | null {
  if ((event as { [ILE_PIP_FORWARDED]?: boolean })[ILE_PIP_FORWARDED]) return null;
  const init = ileSurfaceEventInit(event) as Record<string, unknown>;
  try {
    const Ctor = event.constructor as new (type: string, init?: EventInit) => Event;
    return stampIleSurfaceEventClone(new Ctor(event.type, init), init);
  } catch {
    try {
      return stampIleSurfaceEventClone(new Event(event.type, init), init);
    } catch {
      return null;
    }
  }
}

export function bindIleSurfacePointerBridge(
  node: { ownerDocument?: Document | null } | null | undefined,
  opener?: Window | null,
): () => void {
  const view = resolveIleSurfaceView(node ?? null);
  const host = opener ?? (typeof window !== "undefined" ? window : null);
  if (!view || !host || view.window === host) return () => {};
  const target = ileSurfacePointerBridgeDispatchTarget(host);
  if (!target) return () => {};
  const forward = (event: Event) => {
    const clone = cloneIleSurfaceEventForOpener(event);
    if (!clone) return;
    target.dispatchEvent(clone);
  };
  for (const type of ILE_PIP_POINTER_BRIDGE_EVENTS) {
    view.window.addEventListener(type, forward, true);
  }
  return () => {
    for (const type of ILE_PIP_POINTER_BRIDGE_EVENTS) {
      view.window.removeEventListener(type, forward, true);
    }
  };
}

/** Resize + PiP pointer/keyboard bridge for Excalidraw in a foreign window. */
export function bindIleSurfaceEditorEvents(
  node: { ownerDocument?: Document | null } | null | undefined,
  onResize: () => void,
  opener?: Window | null,
): () => void {
  const unbindResize = bindIleSurfaceResize(node, onResize);
  const unbindPointer = bindIleSurfacePointerBridge(node, opener);
  return () => {
    unbindResize();
    unbindPointer();
  };
}
