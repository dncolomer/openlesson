import {
  ILE_WORK_CANVAS_SCROLL_TO_CONTENT_OPTS,
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
  scrollToContent: (
    target?: readonly IleWorkCanvasElement[] | IleWorkCanvasElement[],
    opts?: { animate?: boolean },
  ) => void;
  refresh?: () => void;
  setActiveTool?: (tool: { type: string }) => void;
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
      api.scrollToContent(options.scrollTo, ILE_WORK_CANVAS_SCROLL_TO_CONTENT_OPTS);
    }
    return true;
  } finally {
    if (remote && flag) unlockApplyingRemote(flag);
  }
}
