import { withIleWorkCanvasGridAppState } from "@/lib/ile-work-canvas";

// Excalidraw's appState contains runtime-only fields like collaborators
// (a Map) that do not survive JSON storage. Persist only restorable state.
 
function sanitizeSceneData(scene: { elements: any[]; appState: any; files: any } | null | undefined) {
  if (!scene) {
    return {
      elements: [],
      appState: withIleWorkCanvasGridAppState({}),
      files: {},
    };
  }
  const { collaborators: _collaborators, ...appState } = scene.appState ?? {};
  return {
    elements: scene.elements ?? [],
    appState: withIleWorkCanvasGridAppState(appState),
    files: scene.files ?? {},
  };
}

export { sanitizeSceneData };
