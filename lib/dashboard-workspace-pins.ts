/**
 * Dashboard workspace pin preferences: pure sort + durable user-scoped store.
 * Pins are per signed-in user (localStorage), not a workspace column — so remixes
 * and org-shared views don't share pin state across accounts on the same device.
 */

export type PinnableWorkspace = {
  id: string;
  created_at?: string | null;
  title?: string | null;
  root_topic?: string | null;
};

export function dashboardPinsStorageKey(userId: string): string {
  return `openlesson.dashboard.pinnedWorkspaces.v1:${userId}`;
}

/** Partition + sort: pinned first, then by created_at desc (stable secondary). */
export function sortWorkspacesPinnedFirst<T extends PinnableWorkspace>(
  workspaces: T[],
  pinnedIds: ReadonlySet<string> | Iterable<string>,
): T[] {
  const pinned = pinnedIds instanceof Set ? pinnedIds : new Set(pinnedIds);
  const copy = [...workspaces];
  copy.sort((a, b) => {
    const aPin = pinned.has(a.id) ? 1 : 0;
    const bPin = pinned.has(b.id) ? 1 : 0;
    if (aPin !== bPin) return bPin - aPin; // pinned (1) before unpinned (0)
    const aT = Date.parse(a.created_at || "") || 0;
    const bT = Date.parse(b.created_at || "") || 0;
    if (aT !== bT) return bT - aT;
    return (a.id || "").localeCompare(b.id || "");
  });
  return copy;
}

export function togglePinnedWorkspaceId(
  pinnedIds: ReadonlySet<string>,
  workspaceId: string,
): Set<string> {
  const next = new Set(pinnedIds);
  if (next.has(workspaceId)) next.delete(workspaceId);
  else next.add(workspaceId);
  return next;
}

export function loadPinnedWorkspaceIds(userId: string | null | undefined): Set<string> {
  if (!userId || typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(dashboardPinsStorageKey(userId));
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((id): id is string => typeof id === "string" && id.length > 0));
  } catch {
    return new Set();
  }
}

export function savePinnedWorkspaceIds(
  userId: string | null | undefined,
  pinnedIds: ReadonlySet<string> | Iterable<string>,
): void {
  if (!userId || typeof window === "undefined") return;
  try {
    const ids = [...(pinnedIds instanceof Set ? pinnedIds : new Set(pinnedIds))];
    window.localStorage.setItem(dashboardPinsStorageKey(userId), JSON.stringify(ids));
  } catch {
    // ignore quota / private mode
  }
}
