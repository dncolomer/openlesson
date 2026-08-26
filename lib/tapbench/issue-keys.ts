/**
 * Issue TAPBench keys for catalog Tasks (one key per workspace).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { listTapbenchBenchmarkTasks, type TapbenchTask } from "./catalog";
import {
  issueTapbenchTaskKey,
  memoryTapbenchKeyStore,
  type TapbenchKeyStore,
} from "./keys";
import { supabaseTapbenchKeyStore } from "./store-supabase";

export interface IssuedTapbenchTaskKey {
  tapbench_key: string;
  workspace_id: string;
  task_title: string;
  key: {
    id: string;
    workspace_id: string;
    key_prefix: string;
    label: string | null;
    created_at: string;
  };
}

export function tapbenchKeyStoreForClient(
  supabase: SupabaseClient | null,
): TapbenchKeyStore {
  return supabase ? supabaseTapbenchKeyStore(supabase) : memoryTapbenchKeyStore;
}

export async function issueTapbenchKeysForTasks(options: {
  workspaceIds: string[];
  tasks: TapbenchTask[];
  store: TapbenchKeyStore;
  userId?: string | null;
  label?: string | null;
}): Promise<
  | { ok: true; issued: IssuedTapbenchTaskKey[] }
  | { ok: false; missing: string[] }
> {
  const wanted = [
    ...new Set(options.workspaceIds.map((id) => String(id || "").trim()).filter(Boolean)),
  ];
  if (!wanted.length) {
    return { ok: true, issued: [] };
  }
  const byId = new Map(options.tasks.map((t) => [t.id, t]));
  const missing = wanted.filter((id) => !byId.has(id));
  if (missing.length) {
    return { ok: false, missing };
  }

  const issued: IssuedTapbenchTaskKey[] = [];
  for (const workspaceId of wanted) {
    const task = byId.get(workspaceId)!;
    const minted = await issueTapbenchTaskKey(
      {
        workspaceId,
        userId: options.userId ?? null,
        label: options.label || task.title,
      },
      options.store,
    );
    issued.push({
      tapbench_key: minted.rawKey,
      workspace_id: workspaceId,
      task_title: task.title,
      key: {
        id: minted.record.id,
        workspace_id: minted.record.workspace_id,
        key_prefix: minted.record.key_prefix,
        label: minted.record.label,
        created_at: minted.record.created_at,
      },
    });
  }
  return { ok: true, issued };
}

export async function loadCatalogAndIssueKeys(options: {
  supabase: SupabaseClient | null;
  workspaceIds: string[];
  userId?: string | null;
  label?: string | null;
}): Promise<
  | { ok: true; issued: IssuedTapbenchTaskKey[]; tasks: TapbenchTask[] }
  | { ok: false; missing: string[]; tasks: TapbenchTask[] }
> {
  const tasks = await listTapbenchBenchmarkTasks(options.supabase);
  const result = await issueTapbenchKeysForTasks({
    workspaceIds: options.workspaceIds,
    tasks,
    store: tapbenchKeyStoreForClient(options.supabase),
    userId: options.userId,
    label: options.label,
  });
  if (!result.ok) {
    return { ok: false, missing: result.missing, tasks };
  }
  return { ok: true, issued: result.issued, tasks };
}
