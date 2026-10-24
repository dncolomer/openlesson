import { withoutSessionBranchNotes } from "@/lib/session-branch-model";
import {
  ileWorkCanvasWithScrollToContent,
  withIleWorkCanvasGridAppState,
  type IleWorkCanvasScene,
} from "@/lib/learn-work-canvas";

// Excalidraw's appState contains runtime-only fields like collaborators
// (a Map) that do not survive JSON storage. Persist only restorable state.
function sanitizeSceneData(scene: Partial<IleWorkCanvasScene> | null | undefined): IleWorkCanvasScene {
  if (!scene) {
    return {
      elements: [],
      appState: withIleWorkCanvasGridAppState({}),
      files: {},
    };
  }
  const { collaborators: _collaborators, ...appState } = (scene.appState ?? {}) as Record<string, unknown> & {
    collaborators?: unknown;
  };
  return {
    elements: scene.elements ?? [],
    appState: withIleWorkCanvasGridAppState(appState),
    files: scene.files ?? {},
  };
}

export function openCanvasScene(
  scene: IleWorkCanvasScene | null | undefined,
  scrollToContent: boolean,
) {
  const clean = sanitizeSceneData(scene);
  const next = {
    ...clean,
    elements: withoutSessionBranchNotes(clean.elements ?? []),
  };
  return scrollToContent ? ileWorkCanvasWithScrollToContent(next) : next;
}

export { sanitizeSceneData };
