/**
 * Durable headless-session store. Same backend choice as live PoW /
 * flow-embedding-store: Supabase when configured, otherwise memory.
 * Process-local Maps are not enough — start then later upload/end must
 * survive a fresh instance.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import type { HeadlessSessionRecord } from "./headless-session";

const STORE_KEY = "__openlessonHeadlessSessionStore";
const TABLE = "workspace_headless_sessions";

export type HeadlessSessionDurableBackend = {
  get(id: string): Promise<HeadlessSessionRecord | null>;
  put(record: HeadlessSessionRecord): Promise<void>;
  listByWorkspace(workspaceId: string): Promise<HeadlessSessionRecord[]>;
};

type StoreGlobal = {
  memory: Map<string, HeadlessSessionRecord>;
  backend: "unknown" | "supabase" | "memory" | "injected";
  injected: HeadlessSessionDurableBackend | null;
};

function storeGlobal(): StoreGlobal {
  const scope = globalThis as typeof globalThis & { [STORE_KEY]?: StoreGlobal };
  if (!scope[STORE_KEY]) {
    scope[STORE_KEY] = { memory: new Map(), backend: "unknown", injected: null };
  }
  return scope[STORE_KEY];
}

export function resetHeadlessSessionStore(backend: "unknown" | "memory" = "unknown"): void {
  const store = storeGlobal();
  store.memory = new Map();
  store.backend = backend;
  store.injected = null;
}

export function setHeadlessSessionDurableBackendForTests(
  backend: HeadlessSessionDurableBackend | null,
): void {
  const store = storeGlobal();
  store.injected = backend;
  store.backend = backend ? "injected" : "unknown";
  store.memory = new Map();
}

function supabaseConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

function cloneRecord(record: HeadlessSessionRecord): HeadlessSessionRecord {
  return JSON.parse(JSON.stringify(record)) as HeadlessSessionRecord;
}

function parseRecord(value: unknown): HeadlessSessionRecord | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Partial<HeadlessSessionRecord>;
  if (typeof row.id !== "string" || !row.id.trim()) return null;
  if (typeof row.workspace_id !== "string" || !row.workspace_id.trim()) return null;
  return cloneRecord(row as HeadlessSessionRecord);
}

async function resolveBackend(): Promise<"supabase" | "memory" | "injected"> {
  const store = storeGlobal();
  if (store.backend === "injected" && store.injected) return "injected";
  if (store.backend === "supabase" || store.backend === "memory") return store.backend;
  if (store.injected) {
    store.backend = "injected";
    return "injected";
  }
  if (!supabaseConfigured()) {
    store.backend = "memory";
    return "memory";
  }
  try {
    const supabase = createAdminClient();
    const { error } = await supabase.from(TABLE).select("id").limit(1);
    store.backend = error ? "memory" : "supabase";
  } catch {
    store.backend = "memory";
  }
  return store.backend;
}

const supabaseBackend: HeadlessSessionDurableBackend = {
  async get(id) {
    const supabase = createAdminClient();
    const { data, error } = await supabase.from(TABLE).select("record").eq("id", id).maybeSingle();
    if (error) throw new Error(error.message);
    return parseRecord((data as { record?: unknown } | null)?.record);
  },
  async put(record) {
    const supabase = createAdminClient();
    const stored = cloneRecord(record);
    const { error } = await supabase.from(TABLE).upsert({
      id: stored.id,
      workspace_id: stored.workspace_id,
      flow_kind: stored.flow_kind,
      status: stored.status,
      catalog_size: stored.catalog_size,
      started_at_ms: stored.started_at_ms,
      expires_at_ms: stored.expires_at_ms,
      record: stored,
      updated_at: new Date().toISOString(),
    });
    if (error) throw new Error(error.message);
  },
  async listByWorkspace(workspaceId) {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from(TABLE)
      .select("record")
      .eq("workspace_id", workspaceId)
      .order("started_at_ms", { ascending: false });
    if (error) throw new Error(error.message);
    return (data || [])
      .map((row) => parseRecord((row as { record?: unknown }).record))
      .filter((row): row is HeadlessSessionRecord => !!row);
  },
};

const memoryBackend: HeadlessSessionDurableBackend = {
  async get(id) {
    const row = storeGlobal().memory.get(id);
    return row ? cloneRecord(row) : null;
  },
  async put(record) {
    storeGlobal().memory.set(record.id, cloneRecord(record));
  },
  async listByWorkspace(workspaceId) {
    return [...storeGlobal().memory.values()]
      .filter((row) => row.workspace_id === workspaceId)
      .map(cloneRecord);
  },
};

async function activeBackend(): Promise<HeadlessSessionDurableBackend> {
  const kind = await resolveBackend();
  if (kind === "injected") {
    const injected = storeGlobal().injected;
    if (injected) return injected;
  }
  if (kind === "supabase") return supabaseBackend;
  return memoryBackend;
}

export async function loadHeadlessSessionRecord(
  sessionId: string,
): Promise<HeadlessSessionRecord | null> {
  const id = sessionId.trim();
  if (!id) return null;
  return (await activeBackend()).get(id);
}

export async function saveHeadlessSessionRecord(record: HeadlessSessionRecord): Promise<void> {
  await (await activeBackend()).put(record);
}

export async function listHeadlessSessionRecords(
  workspaceId: string,
): Promise<HeadlessSessionRecord[]> {
  const id = workspaceId.trim();
  if (!id) return [];
  return (await activeBackend()).listByWorkspace(id);
}
