/**
 * Durable headless-session store. Same backend choice as live PoW /
 * flow-embedding-store: Supabase when configured, otherwise memory.
 * Process-local Maps are not enough — start then later upload/end must
 * survive a fresh instance.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import type { HeadlessSessionRecord } from "./headless-session";

const STORE_KEY = "__openlessonHeadlessSessionStore";
const TABLE = "sessions";

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

function headlessRecordFromSessionRow(row: {
  guest_link?: unknown;
  kind?: unknown;
  workspace_id?: unknown;
  block_id?: unknown;
  status?: unknown;
  id?: unknown;
} | null): HeadlessSessionRecord | null {
  if (!row) return null;
  const link =
    row.guest_link && typeof row.guest_link === "object" && !Array.isArray(row.guest_link)
      ? (row.guest_link as Record<string, unknown>)
      : {};
  if (link.headless !== true && !link.prepared) return null;
  return parseRecord({
    ...link,
    id: row.id,
    workspace_id: row.workspace_id,
    block_id: row.block_id ?? link.block_id ?? null,
    flow_kind: link.flow_kind || row.kind,
    status: link.status || row.status,
  });
}

const supabaseBackend: HeadlessSessionDurableBackend = {
  async get(id) {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from(TABLE)
      .select("id, workspace_id, block_id, kind, status, guest_link")
      .eq("id", id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return headlessRecordFromSessionRow(data as never);
  },
  async put(record) {
    const supabase = createAdminClient();
    const stored = cloneRecord(record);
    const { data: workspace } = await supabase
      .from("workspaces")
      .select("user_id")
      .eq("id", stored.workspace_id)
      .maybeSingle();
    const userId = (workspace as { user_id?: string | null } | null)?.user_id;
    if (!userId) throw new Error("Headless session requires a Learning Map owner");
    const { error } = await supabase.from(TABLE).upsert({
      id: stored.id,
      user_id: userId,
      problem: stored.chapter_title || "Headless",
      status: stored.status,
      kind: stored.flow_kind,
      workspace_id: stored.workspace_id,
      block_id: stored.block_id,
      guest_link: { ...stored, headless: true },
    });
    if (error) throw new Error(error.message);
  },
  async listByWorkspace(workspaceId) {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from(TABLE)
      .select("id, workspace_id, block_id, kind, status, guest_link")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data || [])
      .map((row) => headlessRecordFromSessionRow(row as never))
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
