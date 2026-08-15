/**
 * Persist scope for map notes and drawing layers.
 * Workspace maps stay workspace-keyed. ILE chapter maps use a session key
 * so they do not no-op or collide with a workspace store.
 */

export type MapOverlayKind = "workspace" | "chapter";

export type MapOverlayPersistScope = {
  kind: MapOverlayKind;
  id: string;
};

export type MapOverlayPersistInput = {
  workspaceId?: string | null;
  sessionId?: string | null;
  mapKind?: MapOverlayKind | string | null;
};

export function resolveMapOverlayPersistScope(
  input: MapOverlayPersistInput,
): MapOverlayPersistScope | null {
  const mapKind = input.mapKind === "chapter" ? "chapter" : "workspace";
  if (mapKind === "chapter") {
    const sessionId = String(input.sessionId || "").trim();
    if (!sessionId) return null;
    return { kind: "chapter", id: sessionId };
  }
  const workspaceId = String(input.workspaceId || "").trim();
  if (!workspaceId) return null;
  return { kind: "workspace", id: workspaceId };
}

/** Token used in localStorage keys. Chapter tokens cannot match a workspace id. */
export function mapOverlayPersistToken(scope: MapOverlayPersistScope): string {
  return scope.kind === "chapter" ? `ile-chapter:${scope.id}` : scope.id;
}

export function mapOverlayPersistTokenFromInput(
  input: MapOverlayPersistInput,
  fallback = "unknown-workspace",
): string {
  const scope = resolveMapOverlayPersistScope(input);
  return scope ? mapOverlayPersistToken(scope) : fallback;
}
