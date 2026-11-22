import { quantizeCoord } from "@/lib/behavior-capture";
import type { BehaviorChunker } from "@/lib/behavior-capture-chunk";

export type ViewportVia = "hand" | "wheel" | "pinch" | "reveal";

const POINTER_DOWN_MIN_MS = 25;
const HOVER_MIN_MS = 125;
const REVEAL_WINDOW_MS = 400;

export type BehaviorPointerPayload = {
  pointer: { x: number; y: number; tool?: "pointer" | "laser" };
  button: "up" | "down";
};

export type BehaviorBoardSamplerOptions = {
  now?: () => number;
  schedule?: (flush: () => void) => void;
};

/**
 * Samples board pointer / viewport / tool into a chunker.
 * Does not serialize Excalidraw elements or appState.
 */
export class BehaviorBoardSampler {
  private down = false;
  private lastPointerAt = 0;
  private lastHover: { x: number; y: number } | null = null;
  private lastHoverAt = 0;
  private lastViewportKey = "";
  private lastTool = "";
  private lastEditKey = "";
  private revealUntil = 0;
  private pending: { t: number; x: number; y: number; button: "up" | "down" } | null = null;
  private scheduled = false;
  private readonly now: () => number;
  private readonly scheduleFlush: (flush: () => void) => void;

  constructor(
    private readonly chunker: BehaviorChunker,
    options: BehaviorBoardSamplerOptions = {},
  ) {
    this.now = options.now ?? (() => Date.now());
    this.scheduleFlush =
      options.schedule ??
      ((flush) => {
        if (typeof requestAnimationFrame === "function") {
          requestAnimationFrame(flush);
        } else {
          flush();
        }
      });
  }

  setHid(hid: string | null): void {
    this.chunker.hid = hid;
  }

  markReveal(t = this.now()): void {
    this.revealUntil = t + REVEAL_WINDOW_MS;
  }

  record(stream: string, body?: Record<string, unknown>, t = this.now()): void {
    this.chunker.append({ t, stream, body });
  }

  onPointerUpdate(payload: BehaviorPointerPayload, t = this.now()): void {
    const x = quantizeCoord(payload.pointer.x);
    const y = quantizeCoord(payload.pointer.y);
    if (payload.button === "down" && !this.down) {
      this.flushPendingMove();
      this.down = true;
      this.lastPointerAt = t;
      this.chunker.append({ t, stream: "pointer_edge", body: { type: "down", x, y } });
      this.chunker.append({ t, stream: "pointer", body: { x, y, buttons: 1 } });
      return;
    }
    if (payload.button === "up" && this.down) {
      this.flushPendingMove();
      this.down = false;
      this.lastPointerAt = t;
      this.chunker.append({ t, stream: "pointer", body: { x, y, buttons: 0 } });
      this.chunker.append({ t, stream: "pointer_edge", body: { type: "up", x, y } });
      return;
    }
    this.pending = { t, x, y, button: payload.button };
    if (this.scheduled) return;
    this.scheduled = true;
    this.scheduleFlush(() => {
      this.scheduled = false;
      this.flushPendingMove();
    });
  }

  onWheel(input: { dx: number; dy: number }, t = this.now()): void {
    this.chunker.append({
      t,
      stream: "wheel",
      body: { dx: quantizeCoord(input.dx), dy: quantizeCoord(input.dy) },
    });
  }

  onViewport(
    input: { scrollX: number; scrollY: number; zoom: number; via?: ViewportVia },
    t = this.now(),
  ): void {
    const via: ViewportVia = t <= this.revealUntil ? "reveal" : input.via ?? "hand";
    const body = {
      scrollX: quantizeCoord(input.scrollX),
      scrollY: quantizeCoord(input.scrollY),
      zoom: quantizeCoord(input.zoom, 3),
      via,
    };
    const key = `${body.scrollX}|${body.scrollY}|${body.zoom}|${body.via}`;
    if (key === this.lastViewportKey) return;
    this.lastViewportKey = key;
    this.chunker.append({ t, stream: "viewport", body });
  }

  onToolState(tool: string, t = this.now()): void {
    if (tool === this.lastTool) return;
    this.lastTool = tool;
    this.chunker.append({ t, stream: "tool_state", body: { tool } });
  }

  onEditState(
    state: { editing: boolean; resizing?: boolean; rotating?: boolean },
    t = this.now(),
  ): void {
    const key = `${state.editing ? 1 : 0}|${state.resizing ? 1 : 0}|${state.rotating ? 1 : 0}`;
    if (key === this.lastEditKey) return;
    this.lastEditKey = key;
    const stream = state.resizing || state.rotating ? "resize_rotate" : "edit_state";
    this.chunker.append({ t, stream, body: state });
  }

  private flushPendingMove(): void {
    const pending = this.pending;
    this.pending = null;
    if (!pending) return;
    const { t, x, y } = pending;
    if (this.down) {
      if (t - this.lastPointerAt < POINTER_DOWN_MIN_MS) return;
      this.lastPointerAt = t;
      this.chunker.append({ t, stream: "pointer", body: { x, y, buttons: 1 } });
      return;
    }
    if (this.lastHover && this.lastHover.x === x && this.lastHover.y === y) return;
    if (t - this.lastHoverAt < HOVER_MIN_MS) return;
    this.lastHover = { x, y };
    this.lastHoverAt = t;
    this.chunker.append({ t, stream: "hover", body: { x, y } });
  }
}

export function sampleBoardAppState(
  sampler: BehaviorBoardSampler,
  appState: {
    scrollX?: number;
    scrollY?: number;
    zoom?: { value?: number } | number;
    activeTool?: { type?: string } | string | null;
    editingTextElement?: unknown;
    resizingElement?: unknown;
    selectedElementIds?: Record<string, boolean> | null;
  },
  t?: number,
): void {
  const zoomRaw = appState.zoom;
  const zoom =
    typeof zoomRaw === "number"
      ? zoomRaw
      : typeof zoomRaw?.value === "number"
        ? zoomRaw.value
        : 1;
  sampler.onViewport(
    {
      scrollX: Number(appState.scrollX) || 0,
      scrollY: Number(appState.scrollY) || 0,
      zoom,
    },
    t,
  );
  const tool =
    typeof appState.activeTool === "string"
      ? appState.activeTool
      : String(appState.activeTool?.type || "selection");
  sampler.onToolState(tool, t);
  const editing = Boolean(appState.editingTextElement);
  const resizing = Boolean(appState.resizingElement);
  sampler.onEditState({ editing, resizing }, t);
}

let activeSampler: BehaviorBoardSampler | null = null;

export function sessionMountsBehaviorPointer(session: {
  kind?: string | null;
  interaction_kind?: string | null;
  metadata?: Record<string, unknown> | null;
} | null | undefined): boolean {
  const meta = session?.metadata && typeof session.metadata === "object" ? session.metadata : {};
  const kind = String(
    session?.kind || session?.interaction_kind || meta.kind || meta.session_kind || meta.play_mode || "",
  ).toLowerCase();
  return kind !== "calibrate" && kind !== "scout";
}

export function attachBehaviorBoardSampler(sampler: BehaviorBoardSampler | null): void {
  activeSampler = sampler;
}

export function behaviorBoardSampler(): BehaviorBoardSampler | null {
  return activeSampler;
}
