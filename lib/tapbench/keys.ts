/**
 * Task-scoped TAPBench keys. A key is issued for one Benchmark Task (workspace)
 * and is rejected when used against any other Task.
 */

import { createHash, randomBytes } from "node:crypto";
import { TAPBENCH_KEY_PREFIX } from "./constants";

export interface TapbenchIssuedKey {
  id: string;
  workspace_id: string;
  user_id: string | null;
  key_hash: string;
  key_prefix: string;
  label: string | null;
  is_active: boolean;
  created_at: string;
  last_used_at: string | null;
  expires_at: string | null;
  stopped_at: string | null;
}

export type TapbenchKeyAuthResult =
  | { ok: true; key: TapbenchIssuedKey }
  | {
      ok: false;
      code: "unauthorized" | "key_revoked" | "key_expired" | "forbidden" | "session_stopped";
      message: string;
    };

export interface TapbenchKeyStore {
  insert(record: TapbenchIssuedKey): Promise<TapbenchIssuedKey>;
  findByHash(keyHash: string): Promise<TapbenchIssuedKey | null>;
  touchLastUsed(id: string, atIso: string): Promise<void>;
  markStopped(id: string, atIso: string): Promise<void>;
}

const memoryKeys = new Map<string, TapbenchIssuedKey>();

export function resetTapbenchKeyStoreForTests(): void {
  memoryKeys.clear();
}

export const memoryTapbenchKeyStore: TapbenchKeyStore = {
  async insert(record) {
    memoryKeys.set(record.key_hash, { ...record });
    return { ...record };
  },
  async findByHash(keyHash) {
    const row = memoryKeys.get(keyHash);
    return row ? { ...row } : null;
  },
  async touchLastUsed(id, atIso) {
    for (const [hash, row] of memoryKeys) {
      if (row.id === id) {
        memoryKeys.set(hash, { ...row, last_used_at: atIso });
        return;
      }
    }
  },
  async markStopped(id, atIso) {
    for (const [hash, row] of memoryKeys) {
      if (row.id === id) {
        memoryKeys.set(hash, { ...row, stopped_at: atIso });
        return;
      }
    }
  },
};

export function hashTapbenchKey(rawKey: string): string {
  return createHash("sha256").update(rawKey, "utf8").digest("hex");
}

export function mintTapbenchKeyMaterial(): { rawKey: string; keyHash: string; keyPrefix: string } {
  const rawKey = `${TAPBENCH_KEY_PREFIX}${randomBytes(24).toString("hex")}`;
  return {
    rawKey,
    keyHash: hashTapbenchKey(rawKey),
    keyPrefix: rawKey.slice(0, 12),
  };
}

export async function issueTapbenchTaskKey(
  options: {
    workspaceId: string;
    userId?: string | null;
    label?: string | null;
    id?: string;
    nowMs?: number;
    expiresAt?: string | null;
  },
  store: TapbenchKeyStore = memoryTapbenchKeyStore,
): Promise<{ rawKey: string; record: TapbenchIssuedKey }> {
  const workspaceId = String(options.workspaceId || "").trim();
  if (!workspaceId) {
    throw new Error("workspaceId is required to issue a TAPBench key");
  }
  const nowMs = options.nowMs ?? Date.now();
  const material = mintTapbenchKeyMaterial();
  const record: TapbenchIssuedKey = {
    id: options.id || crypto.randomUUID(),
    workspace_id: workspaceId,
    user_id: options.userId ?? null,
    key_hash: material.keyHash,
    key_prefix: material.keyPrefix,
    label: options.label?.trim() || null,
    is_active: true,
    created_at: new Date(nowMs).toISOString(),
    last_used_at: null,
    expires_at: options.expiresAt ?? null,
    stopped_at: null,
  };
  await store.insert(record);
  return { rawKey: material.rawKey, record };
}

export async function authenticateTapbenchKey(
  rawKey: string,
  store: TapbenchKeyStore = memoryTapbenchKeyStore,
  nowMs: number = Date.now(),
): Promise<TapbenchKeyAuthResult> {
  const trimmed = typeof rawKey === "string" ? rawKey.trim() : "";
  if (!trimmed || !trimmed.startsWith(TAPBENCH_KEY_PREFIX)) {
    return { ok: false, code: "unauthorized", message: "Invalid TAPBench key" };
  }
  const row = await store.findByHash(hashTapbenchKey(trimmed));
  if (!row) {
    return { ok: false, code: "unauthorized", message: "Invalid TAPBench key" };
  }
  if (row.stopped_at) {
    return {
      ok: false,
      code: "session_stopped",
      message: "TAPBench session has been stopped. Issue a new key for another run.",
    };
  }
  if (!row.is_active) {
    return { ok: false, code: "key_revoked", message: "TAPBench key has been revoked" };
  }
  if (row.expires_at && new Date(row.expires_at).getTime() < nowMs) {
    return { ok: false, code: "key_expired", message: "TAPBench key has expired" };
  }
  await store.touchLastUsed(row.id, new Date(nowMs).toISOString());
  return { ok: true, key: row };
}

/**
 * A TAPBench key may only be used for PoW / wrap on the Task it was issued for.
 */
export function assertTapbenchKeyForTask(
  key: TapbenchIssuedKey,
  workspaceId: string,
): TapbenchKeyAuthResult {
  const taskId = String(workspaceId || "").trim();
  if (!taskId || key.workspace_id !== taskId) {
    return {
      ok: false,
      code: "forbidden",
      message: "This TAPBench key is not issued for this Benchmark Task",
    };
  }
  return { ok: true, key };
}
