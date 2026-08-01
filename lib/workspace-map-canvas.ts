/**
 * Pure helpers for workspace map right-pane Excalidraw scene persistence.
 * Safe empty restore + JSON-serializable scene payload (no Map collaborators).
 */

export type WorkspaceMapCanvasScene = {
  elements: unknown[];
  appState: Record<string, unknown>;
  files: Record<string, unknown>;
};

/** Blank valid Excalidraw scene (safe initialData). */
export function emptyWorkspaceMapCanvasScene(): WorkspaceMapCanvasScene {
  return {
    elements: [],
    appState: {
      viewBackgroundColor: "#0a0a0a",
      currentItemFontFamily: 1,
    },
    files: {},
  };
}

/**
 * Normalize raw DB/API payload into a restorable scene.
 * Drops non-JSON appState fields (e.g. collaborators Map).
 * Empty/missing/invalid → blank scene (never throws).
 */
export function normalizeWorkspaceMapCanvasScene(
  raw: unknown,
): WorkspaceMapCanvasScene {
  const blank = emptyWorkspaceMapCanvasScene();
  if (raw == null) return blank;

  let value: unknown = raw;
  if (typeof raw === "string") {
    const t = raw.trim();
    if (!t) return blank;
    try {
      value = JSON.parse(t);
    } catch {
      return blank;
    }
  }
  if (!value || typeof value !== "object") return blank;
  const rec = value as Record<string, unknown>;

  const elements = Array.isArray(rec.elements) ? [...rec.elements] : [];
  const files =
    rec.files && typeof rec.files === "object" && !Array.isArray(rec.files)
      ? { ...(rec.files as Record<string, unknown>) }
      : {};

  let appState: Record<string, unknown> = { ...blank.appState };
  if (rec.appState && typeof rec.appState === "object" && !Array.isArray(rec.appState)) {
    const { collaborators: _c, ...rest } = rec.appState as Record<string, unknown>;
    // Drop non-plain values that break JSON round-trip
    appState = {};
    for (const [k, v] of Object.entries(rest)) {
      if (v instanceof Map || typeof v === "function") continue;
      appState[k] = v;
    }
    if (!appState.viewBackgroundColor) {
      appState.viewBackgroundColor = "#0a0a0a";
    }
  }

  return { elements, appState, files };
}

/** Serialize scene for storage (string). Always valid JSON. */
export function serializeWorkspaceMapCanvasScene(
  scene: WorkspaceMapCanvasScene | null | undefined,
): string {
  return JSON.stringify(normalizeWorkspaceMapCanvasScene(scene));
}

/** True when scene has any drawing elements. */
export function workspaceMapCanvasSceneHasContent(
  scene: WorkspaceMapCanvasScene | null | undefined,
): boolean {
  const n = normalizeWorkspaceMapCanvasScene(scene);
  return n.elements.length > 0;
}

/** Merge/validate payload for PUT body before DB write. */
export function prepareWorkspaceMapCanvasPersist(
  raw: unknown,
): { scene: WorkspaceMapCanvasScene; json: string } {
  const scene = normalizeWorkspaceMapCanvasScene(raw);
  return { scene, json: JSON.stringify(scene) };
}
