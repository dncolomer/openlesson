import {
  ILE_WORK_CANVAS_VIEWPORT_OPTS,
  serializeIleWorkCanvasScene,
  type IleWorkCanvasAppState,
  type IleWorkCanvasElement,
  type IleWorkCanvasFiles,
  type IleWorkCanvasScene,
} from "@/lib/learn-work-canvas";

export type LiveExcalidrawAppState = IleWorkCanvasAppState & {
  width?: number;
  height?: number;
  offsetLeft?: number;
  offsetTop?: number;
  scrollX?: number;
  scrollY?: number;
  zoom?: { value?: number } | number;
  selectedElementIds?: Record<string, boolean>;
  cursorButton?: string | null;
  isResizing?: boolean;
  isRotating?: boolean;
  draggingElement?: unknown;
  editingElement?: unknown;
};

export type LiveViewportTarget =
  | IleWorkCanvasElement
  | readonly IleWorkCanvasElement[]
  | IleWorkCanvasElement[];

export type LiveViewportOpts = {
  target: LiveViewportTarget;
  fit?: "scale-down" | "contain" | "none";
  animation?: boolean | { duration?: number };
};

export type LiveActiveTool = { type: string; locked?: boolean };
export type LiveActiveToolOpts = { keepSelection?: boolean; toggle?: boolean };

/** Methods this board calls on the live instance. */
export type LiveExcalidrawAPI = {
  updateScene: (scene: {
    elements?: readonly IleWorkCanvasElement[];
    appState?: Partial<LiveExcalidrawAppState>;
    files?: IleWorkCanvasFiles;
  }) => void;
  getSceneElements: () => readonly IleWorkCanvasElement[];
  getSceneElementsIncludingDeleted?: () => readonly IleWorkCanvasElement[];
  getAppState: () => LiveExcalidrawAppState;
  getFiles: () => IleWorkCanvasFiles;
  setViewport: (opts: LiveViewportOpts | null) => void;
  refresh?: () => void;
  setActiveTool?: (tool: LiveActiveTool, opts?: LiveActiveToolOpts) => void;
};

export type WorkCanvasPngExportInput = {
  elements: readonly IleWorkCanvasElement[];
  appState?: Partial<LiveExcalidrawAppState> | LiveExcalidrawAppState;
  files?: IleWorkCanvasFiles | null;
  environment?: {
    createCanvas?: () => HTMLCanvasElement;
    createImage?: () => HTMLImageElement;
    createPath?: (d: string) => Path2D;
    document?: Document;
  };
};

export type CommitSceneInput = {
  elements?: readonly IleWorkCanvasElement[];
  appState?: Partial<LiveExcalidrawAppState>;
  files?: IleWorkCanvasFiles;
};

export type CommitSceneOptions = {
  /** When true (default), suppress PoW observe for programmatic writes. */
  remote?: boolean;
  applyingRemote?: { current: boolean };
  scrollTo?: readonly IleWorkCanvasElement[] | null;
};

export function liveSceneElements(
  api: LiveExcalidrawAPI | null | undefined,
): IleWorkCanvasElement[] {
  if (!api) return [];
  return [...(api.getSceneElementsIncludingDeleted?.() ?? api.getSceneElements() ?? [])];
}

export function liveWorkCanvasScene(
  api: LiveExcalidrawAPI | null | undefined,
  includingDeleted = false,
): IleWorkCanvasScene {
  return serializeIleWorkCanvasScene({
    elements: includingDeleted ? liveSceneElements(api) : [...(api?.getSceneElements() ?? [])],
    appState: api?.getAppState() ?? {},
    files: api?.getFiles() ?? {},
  });
}

type ApplyingRemoteFlag = { current: boolean; locks?: number };

function lockApplyingRemote(flag: ApplyingRemoteFlag) {
  flag.locks = (flag.locks ?? 0) + 1;
  flag.current = true;
}

function unlockApplyingRemote(flag: ApplyingRemoteFlag) {
  queueMicrotask(() => {
    const next = (flag.locks ?? 1) - 1;
    flag.locks = next;
    if (next <= 0) {
      flag.locks = 0;
      flag.current = false;
    }
  });
}

export function followViewport(
  api: LiveExcalidrawAPI | null | undefined,
  target: LiveViewportTarget | null | undefined,
  opts: Pick<LiveViewportOpts, "fit" | "animation"> = ILE_WORK_CANVAS_VIEWPORT_OPTS,
): boolean {
  if (!api || target == null) return false;
  const list = (Array.isArray(target) ? [...target] : [target]) as IleWorkCanvasElement[];
  if (!list.length) return false;
  api.setViewport({
    target: list,
    fit: opts.fit ?? ILE_WORK_CANVAS_VIEWPORT_OPTS.fit,
    animation: opts.animation ?? ILE_WORK_CANVAS_VIEWPORT_OPTS.animation,
  });
  return true;
}

export function setLiveActiveTool(
  api: LiveExcalidrawAPI | null | undefined,
  tool: LiveActiveTool,
  opts?: LiveActiveToolOpts,
): boolean {
  if (!api?.setActiveTool) return false;
  api.setActiveTool(tool, opts);
  return true;
}

function exportBindingTargetId(raw: unknown): string | null {
  if (!raw || typeof raw !== "object") return null;
  const id = (raw as { elementId?: unknown }).elementId;
  return typeof id === "string" && id.trim() ? id : null;
}

function snapshotWorkCanvasExportElements(
  elements: readonly IleWorkCanvasElement[],
): IleWorkCanvasElement[] {
  const live: IleWorkCanvasElement[] = [];
  for (const el of elements) {
    if (el && !el.isDeleted) live.push(el);
  }
  try {
    return JSON.parse(JSON.stringify(live)) as IleWorkCanvasElement[];
  } catch {
    return live.map((el) => ({ ...el }));
  }
}

function exportArrowBinding(
  raw: unknown,
  ids: Set<string>,
): Record<string, unknown> | null {
  const elementId = exportBindingTargetId(raw);
  if (!elementId || !ids.has(elementId)) return null;
  const rec = raw as Record<string, unknown>;
  return {
    ...rec,
    elementId,
    // restoreElements looks up the target unless mode is set; skip that path.
    mode: typeof rec.mode === "string" && rec.mode ? rec.mode : "orbit",
    fixedPoint: Array.isArray(rec.fixedPoint) ? rec.fixedPoint : [0.5, 0.5],
  };
}

/**
 * Snapshot the live scene and drop arrow bindings restoreElements cannot
 * repair. exportScene logs `Could not repair binding for element "undefined"`
 * when start/endBinding has no mode and the target is missing from the map.
 */
export function sanitizeWorkCanvasExportElements(
  elements: readonly IleWorkCanvasElement[],
): IleWorkCanvasElement[] {
  const snap = snapshotWorkCanvasExportElements(elements);
  const ids = new Set<string>();
  for (const el of snap) {
    if (typeof el.id === "string" && el.id) ids.add(el.id);
  }
  return snap.map((el) => {
    if (!el.startBinding && !el.endBinding) return el;
    return {
      ...el,
      startBinding: exportArrowBinding(el.startBinding, ids),
      endBinding: exportArrowBinding(el.endBinding, ids),
    };
  });
}

export async function exportWorkCanvasPng(input: WorkCanvasPngExportInput): Promise<Blob> {
  const elements = sanitizeWorkCanvasExportElements(input.elements);
  const appState = {
    viewBackgroundColor: "#0a0a0a",
    ...(input.appState ?? {}),
  };
  const files = input.files ?? {};
  const environment = input.environment;
  const { exportScene } = await import("@excalidraw/excalidraw");
  return exportScene({
    type: "png",
    data: {
      elements: elements as never,
      appState: appState as never,
      files: files as never,
    },
    config: {
      theme: "dark",
      canvasBackgroundColor: "#0a0a0a",
      ...(environment ? { environment } : {}),
    },
  });
}

export async function exportWorkCanvasPngDataUrl(
  input: WorkCanvasPngExportInput,
): Promise<string | null> {
  if (!sanitizeWorkCanvasExportElements(input.elements).length) return null;
  const blob = await exportWorkCanvasPng(input);
  if (!blob || blob.size === 0) return null;
  if (typeof FileReader !== "undefined") {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve((reader.result as string) || null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  }
  const buf = Buffer.from(await blob.arrayBuffer());
  return `data:${blob.type || "image/png"};base64,${buf.toString("base64")}`;
}

export function commitScene(
  api: LiveExcalidrawAPI | null | undefined,
  next: CommitSceneInput,
  options?: CommitSceneOptions,
): boolean {
  if (!api) return false;
  const remote = options?.remote !== false;
  const flag = options?.applyingRemote as ApplyingRemoteFlag | undefined;
  if (remote && flag) lockApplyingRemote(flag);
  try {
    api.updateScene(next);
    if (options?.scrollTo?.length) {
      followViewport(api, options.scrollTo);
    }
    return true;
  } finally {
    if (remote && flag) unlockApplyingRemote(flag);
  }
}
