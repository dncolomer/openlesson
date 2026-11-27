import { withoutSessionBranchNotes } from "@/lib/session-branch-model";
import {
  ileWorkCanvasWithScrollToContent,
  withIleWorkCanvasGridAppState,
  type IleWorkCanvasChrome,
  type IleWorkCanvasGridAppStateOptions,
  type IleWorkCanvasScene,
} from "@/lib/learn-work-canvas";

export type SanitizeSceneOptions = IleWorkCanvasGridAppStateOptions;

// Excalidraw's appState contains runtime-only fields like collaborators
// (a Map) that do not survive JSON storage. Persist only restorable state.
function sanitizeSceneData(
  scene: Partial<IleWorkCanvasScene> | null | undefined,
  options?: SanitizeSceneOptions,
): IleWorkCanvasScene {
  if (!scene) {
    return {
      elements: [],
      appState: withIleWorkCanvasGridAppState({}, options),
      files: {},
    };
  }
  const { collaborators: _collaborators, ...appState } = (scene.appState ?? {}) as Record<string, unknown> & {
    collaborators?: unknown;
  };
  return {
    elements: scene.elements ?? [],
    appState: withIleWorkCanvasGridAppState(appState, options),
    files: scene.files ?? {},
  };
}

export function openCanvasScene(
  scene: IleWorkCanvasScene | null | undefined,
  scrollToContent: boolean,
  chrome?: IleWorkCanvasChrome | null,
) {
  const clean = sanitizeSceneData(scene, {
    migrateLegacyStrokeWidth: true,
    migrateLegacyRoundness: true,
    chrome,
  });
  const next = {
    ...clean,
    elements: withoutSessionBranchNotes(clean.elements ?? []),
  };
  return scrollToContent ? ileWorkCanvasWithScrollToContent(next) : next;
}

export { sanitizeSceneData };
