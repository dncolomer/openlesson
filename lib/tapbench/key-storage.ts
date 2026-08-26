import { TAPBENCH_KEY_PREFIX } from "./constants";

export const TAPBENCH_KEY_STORAGE = "tapbench.taskKeys.v1";

export type StoredTapbenchKeys = Record<string, string>;

export function loadStoredTapbenchKeys(): StoredTapbenchKeys {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(TAPBENCH_KEY_STORAGE);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const out: StoredTapbenchKeys = {};
    for (const [k, v] of Object.entries(parsed)) {
      if (typeof v === "string" && v.startsWith(TAPBENCH_KEY_PREFIX)) out[k] = v;
    }
    return out;
  } catch {
    return {};
  }
}

export function saveStoredTapbenchKeys(keys: StoredTapbenchKeys) {
  try {
    window.localStorage.setItem(TAPBENCH_KEY_STORAGE, JSON.stringify(keys));
  } catch {
    /* ignore quota */
  }
}

export function mergeIssuedKeys(
  current: StoredTapbenchKeys,
  issued: Array<{ workspace_id: string; tapbench_key: string }>,
): StoredTapbenchKeys {
  const next = { ...current };
  for (const row of issued) {
    if (row.workspace_id && row.tapbench_key.startsWith(TAPBENCH_KEY_PREFIX)) {
      next[row.workspace_id] = row.tapbench_key;
    }
  }
  return next;
}
