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

/** Methods the live board actually calls. One assertion at the Excalidraw mount. */
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
};

export type CommitSceneInput = {
  elements?: readonly IleWorkCanvasElement[];
  appState?: Partial<LiveExcalidrawAppState>;
  files?: IleWorkCanvasFiles;
};

export type CommitSceneOptions = {
  /** Programmatic write: suppress PoW observe. Camera/zoom pass false. */
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

export function commitScene(
  api: LiveExcalidrawAPI | null | undefined,
  next: CommitSceneInput,
  options?: CommitSceneOptions,
): boolean {
  if (!api) return false;
  const remote = options?.remote !== false;
  const flag = options?.applyingRemote;
  if (remote && flag) flag.current = true;
  try {
    api.updateScene(next);
    if (options?.scrollTo?.length) {
      api.scrollToContent(options.scrollTo, ILE_WORK_CANVAS_SCROLL_TO_CONTENT_OPTS);
    }
    return true;
  } finally {
    if (remote && flag) flag.current = false;
  }
}
