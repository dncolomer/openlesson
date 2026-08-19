/**
 * Per-user “worked on at least once” marks for workspace blocks and ILE chapters.
 * Progress chrome (gear + fainter white) reads this set. Done is a separate status.
 */

export type MapSelfProgressKind = "workspace" | "chapter";

export type MapSelfProgressScope = {
  userId: string;
  kind: MapSelfProgressKind;
  scopeId: string;
};

export type MapSelfProgressStorage = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
};

export const MAP_SELF_PROGRESS_EVENT = "openlesson:map-self-progress";

export function resolveMapSelfProgressScope(input: {
  userId?: string | null;
  kind?: MapSelfProgressKind | string | null;
  scopeId?: string | null;
}): MapSelfProgressScope | null {
  const userId = String(input.userId || "").trim();
  const scopeId = String(input.scopeId || "").trim();
  if (!userId || !scopeId) return null;
  return {
    userId,
    kind: input.kind === "chapter" ? "chapter" : "workspace",
    scopeId,
  };
}

export function mapSelfProgressStorageKey(scope: MapSelfProgressScope): string {
  return `openlesson.map.selfProgress.v1:${scope.userId}:${scope.kind}:${scope.scopeId}`;
}

export function parseMapSelfProgressIds(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const ids: string[] = [];
  for (const value of raw) {
    const id = typeof value === "string" ? value.trim() : "";
    if (!id || seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
  }
  return ids;
}

export function isMapItemWorkedOn(
  ids: readonly string[] | ReadonlySet<string> | null | undefined,
  itemId: string,
): boolean {
  const id = String(itemId || "").trim();
  if (!id || !ids) return false;
  if (ids instanceof Set) return ids.has(id);
  return Array.from(ids).includes(id);
}

export function addMapItemWorkedOn(
  ids: readonly string[] | null | undefined,
  itemId: string,
): string[] {
  const id = String(itemId || "").trim();
  const next = parseMapSelfProgressIds(ids ?? []);
  if (!id || next.includes(id)) return next;
  next.push(id);
  return next;
}

function defaultStorage(): MapSelfProgressStorage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function loadMapSelfProgressIds(
  scope: MapSelfProgressScope | null | undefined,
  storage?: MapSelfProgressStorage | null,
): string[] {
  if (!scope) return [];
  const store = storage === undefined ? defaultStorage() : storage;
  if (!store) return [];
  try {
    const raw = store.getItem(mapSelfProgressStorageKey(scope));
    if (!raw) return [];
    return parseMapSelfProgressIds(JSON.parse(raw) as unknown);
  } catch {
    return [];
  }
}

export function saveMapSelfProgressIds(
  scope: MapSelfProgressScope | null | undefined,
  ids: readonly string[],
  storage?: MapSelfProgressStorage | null,
): void {
  if (!scope) return;
  const store = storage === undefined ? defaultStorage() : storage;
  if (!store) return;
  try {
    store.setItem(
      mapSelfProgressStorageKey(scope),
      JSON.stringify(parseMapSelfProgressIds(ids)),
    );
  } catch {
    /* quota / private mode */
  }
}

function emitSelfProgressChange(
  scope: MapSelfProgressScope,
  ids: readonly string[],
): void {
  if (typeof window === "undefined") return;
  try {
    window.dispatchEvent(
      new CustomEvent(MAP_SELF_PROGRESS_EVENT, {
        detail: {
          key: mapSelfProgressStorageKey(scope),
          userId: scope.userId,
          kind: scope.kind,
          scopeId: scope.scopeId,
          ids: [...ids],
        },
      }),
    );
  } catch {
    /* ignore */
  }
}

/**
 * Mark that this user worked on `itemId` at least once. Idempotent.
 * Returns the persisted id list (reload-safe when storage is available).
 */
export function recordMapItemWorkedOn(
  scope: MapSelfProgressScope | null | undefined,
  itemId: string,
  storage?: MapSelfProgressStorage | null,
): string[] {
  if (!scope) return [];
  const next = addMapItemWorkedOn(loadMapSelfProgressIds(scope, storage), itemId);
  saveMapSelfProgressIds(scope, next, storage);
  if (storage === undefined) emitSelfProgressChange(scope, next);
  return next;
}
