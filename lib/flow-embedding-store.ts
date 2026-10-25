/**
 * Persist Calibrate / Learn / Verify embeddings with recoverable raw.
 * Completing those runs writes here.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import {
  completeFlowEmbedding,
  embedFlowOutput,
  recoverFlowEmbeddingRaw,
  type FlowEmbeddingRaw,
  type FlowKind,
  type FlowPowRow,
  FLOW_EMBEDDING_DIM,
  FLOW_EMBEDDING_MODEL_ID,
} from "@/lib/flow-embedding";
import type { SessionBranchModel } from "@/lib/session-branch-model";

const FLOW_EMBEDDING_GLOBAL = "__openlessonFlowEmbeddingStore";

export type StoredFlowEmbedding = {
  id: string;
  workspace_id: string;
  owner_user_id?: string;
  flow_kind: FlowKind;
  flow_id: string | null;
  run_id: string | null;
  identity: string | null;
  source: string | null;
  embedding_model_id: typeof FLOW_EMBEDDING_MODEL_ID;
  dim: typeof FLOW_EMBEDDING_DIM;
  vector: number[];
  raw: FlowEmbeddingRaw;
  created_at: string;
};

export type PersistFlowEmbeddingInput = {
  workspaceId?: string;
  ownerUserId?: string;
  flowKind: FlowKind | string;
  flowId?: string | null;
  runId?: string | null;
  identity?: string | null;
  source?: string | null;
  model?: SessionBranchModel | null;
  /** Ignored. Catalog size is no longer part of the gen model. */
  catalogSize?: unknown;
  sequence?: readonly string[] | null;
  pow?: readonly FlowPowRow[] | null;
  raw?: unknown;
  id?: string;
};

type StoreGlobal = {
  memory: StoredFlowEmbedding[];
  backend: "unknown" | "supabase" | "memory";
};

function storeGlobal(): StoreGlobal {
  const scope = globalThis as typeof globalThis & {
    [FLOW_EMBEDDING_GLOBAL]?: StoreGlobal;
  };
  if (!scope[FLOW_EMBEDDING_GLOBAL]) {
    scope[FLOW_EMBEDDING_GLOBAL] = { memory: [], backend: "unknown" };
  }
  return scope[FLOW_EMBEDDING_GLOBAL];
}

export function resetFlowEmbeddingStore(backend: "unknown" | "memory" = "unknown"): void {
  const store = storeGlobal();
  store.memory = [];
  store.backend = backend;
}

function supabaseConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

async function resolveBackend(): Promise<"supabase" | "memory"> {
  const store = storeGlobal();
  if (store.backend !== "unknown") return store.backend;
  if (!supabaseConfigured()) {
    store.backend = "memory";
    return store.backend;
  }
  try {
    const supabase = createAdminClient();
    const { error } = await supabase.from("workspace_flow_embeddings").select("id").limit(1);
    store.backend = error ? "memory" : "supabase";
  } catch {
    store.backend = "memory";
  }
  return store.backend;
}

function makeId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `fe_${Math.random().toString(36).slice(2, 12)}`;
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function mapRow(row: Record<string, unknown>): StoredFlowEmbedding | null {
  const raw = recoverFlowEmbeddingRaw(row.raw);
  if (!raw) return null;
  const vector = Array.isArray(row.vector)
    ? row.vector.filter((value): value is number => typeof value === "number" && Number.isFinite(value))
    : [];
  const kind = raw.flowKind;
  return {
    id: String(row.id),
    workspace_id: String(row.workspace_id || ""),
    owner_user_id: row.owner_user_id ? String(row.owner_user_id) : "",
    flow_kind: kind,
    flow_id: row.flow_id ? String(row.flow_id) : null,
    run_id: row.run_id ? String(row.run_id) : null,
    identity: row.identity ? String(row.identity) : null,
    source: row.source ? String(row.source) : null,
    embedding_model_id: FLOW_EMBEDDING_MODEL_ID,
    dim: FLOW_EMBEDDING_DIM,
    vector: vector.length === FLOW_EMBEDDING_DIM ? vector : embedFlowOutput(raw).vector,
    raw,
    created_at: String(row.created_at || new Date().toISOString()),
  };
}

export function presentFlowEmbedding(row: StoredFlowEmbedding): StoredFlowEmbedding {
  const recovered = recoverFlowEmbeddingRaw(row.raw);
  if (!recovered) {
    return {
      ...row,
      embedding_model_id: FLOW_EMBEDDING_MODEL_ID,
      dim: FLOW_EMBEDDING_DIM,
    };
  }
  return {
    ...row,
    embedding_model_id: FLOW_EMBEDDING_MODEL_ID,
    dim: FLOW_EMBEDDING_DIM,
    vector: embedFlowOutput(recovered).vector,
    raw: recovered,
  };
}

export async function persistCompletedFlowEmbedding(
  input: PersistFlowEmbeddingInput,
): Promise<StoredFlowEmbedding> {
  const workspaceId = text(input.workspaceId);
  const ownerUserId = text(input.ownerUserId);
  if (!workspaceId && !ownerUserId) throw new Error("owner_user_id is required");
  const recovered = recoverFlowEmbeddingRaw(input.raw);
  const record = recovered
    ? embedFlowOutput(recovered)
    : completeFlowEmbedding({
        flowKind: input.flowKind,
        model: input.model,
        sequence: input.sequence,
        pow: input.pow,
      });
  const stored: StoredFlowEmbedding = {
    id: text(input.id) || makeId(),
    workspace_id: workspaceId,
    owner_user_id: ownerUserId,
    flow_kind: record.raw.flowKind,
    flow_id: text(input.flowId) || null,
    run_id: text(input.runId) || null,
    identity: text(input.identity) || null,
    source: text(input.source) || null,
    embedding_model_id: FLOW_EMBEDDING_MODEL_ID,
    dim: FLOW_EMBEDDING_DIM,
    vector: record.vector,
    raw: record.raw,
    created_at: new Date().toISOString(),
  };
  if ((await resolveBackend()) === "memory") {
    storeGlobal().memory = [stored, ...storeGlobal().memory.filter((row) => row.id !== stored.id)];
    return stored;
  }
  const supabase = createAdminClient();
  const { error } = await supabase.from("workspace_flow_embeddings").insert({
    id: stored.id,
    workspace_id: stored.workspace_id || null,
    owner_user_id: stored.owner_user_id || null,
    flow_kind: stored.flow_kind,
    flow_id: stored.flow_id,
    run_id: stored.run_id,
    identity: stored.identity,
    source: stored.source,
    embedding_model_id: stored.embedding_model_id,
    dim: stored.dim,
    vector: stored.vector,
    raw: stored.raw,
    created_at: stored.created_at,
  });
  if (error) throw new Error(error.message);
  return stored;
}

export async function listFlowEmbeddings(input: {
  workspaceId: string;
  flowKind?: FlowKind | string | null;
  flowId?: string | null;
}): Promise<StoredFlowEmbedding[]> {
  return listFlowEmbeddingsForWorkspaces({
    workspaceIds: [input.workspaceId],
    flowKind: input.flowKind,
    flowId: input.flowId,
  });
}

export async function listFlowEmbeddingsForOwner(input: {
  ownerUserId: string;
  flowKind?: FlowKind | string | null;
  flowId?: string | null;
}): Promise<StoredFlowEmbedding[]> {
  const ownerUserId = text(input.ownerUserId);
  if (!ownerUserId) return [];
  const flowKind = text(input.flowKind);
  const flowId = text(input.flowId);
  if ((await resolveBackend()) === "memory") {
    return storeGlobal()
      .memory.filter((row) => {
        if (text(row.owner_user_id) !== ownerUserId) return false;
        if (flowKind && row.flow_kind !== flowKind) return false;
        if (flowId && row.flow_id !== flowId) return false;
        return true;
      })
      .map(presentFlowEmbedding);
  }
  const supabase = createAdminClient();
  let query = supabase
    .from("workspace_flow_embeddings")
    .select("*")
    .eq("owner_user_id", ownerUserId)
    .order("created_at", { ascending: false });
  if (flowKind) query = query.eq("flow_kind", flowKind);
  if (flowId) query = query.eq("flow_id", flowId);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data || [])
    .map((row) => mapRow(row as Record<string, unknown>))
    .filter((row): row is StoredFlowEmbedding => !!row)
    .map(presentFlowEmbedding);
}

export async function listFlowEmbeddingsForWorkspaces(input: {
  workspaceIds: readonly string[];
  flowKind?: FlowKind | string | null;
  flowId?: string | null;
}): Promise<StoredFlowEmbedding[]> {
  const workspaceIds = input.workspaceIds.map((id) => text(id)).filter(Boolean);
  if (workspaceIds.length === 0) return [];
  const flowKind = text(input.flowKind);
  const flowId = text(input.flowId);
  const allow = new Set(workspaceIds);
  if ((await resolveBackend()) === "memory") {
    return storeGlobal()
      .memory.filter((row) => {
        if (!allow.has(row.workspace_id)) return false;
        if (flowKind && row.flow_kind !== flowKind) return false;
        if (flowId && row.flow_id !== flowId) return false;
        return true;
      })
      .map(presentFlowEmbedding);
  }
  const supabase = createAdminClient();
  let query = supabase
    .from("workspace_flow_embeddings")
    .select("*")
    .in("workspace_id", workspaceIds)
    .order("created_at", { ascending: false });
  if (flowKind) query = query.eq("flow_kind", flowKind);
  if (flowId) query = query.eq("flow_id", flowId);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data || [])
    .map((row) => mapRow(row as Record<string, unknown>))
    .filter((row): row is StoredFlowEmbedding => !!row)
    .map(presentFlowEmbedding);
}

export async function getFlowEmbedding(input: {
  workspaceId: string;
  embeddingId: string;
}): Promise<StoredFlowEmbedding | null> {
  const workspaceId = text(input.workspaceId);
  const embeddingId = text(input.embeddingId);
  if (!workspaceId || !embeddingId) return null;
  if ((await resolveBackend()) === "memory") {
    const row = storeGlobal().memory.find(
      (item) => item.workspace_id === workspaceId && item.id === embeddingId,
    );
    return row ? presentFlowEmbedding(row) : null;
  }
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("workspace_flow_embeddings")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("id", embeddingId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const mapped = mapRow(data as Record<string, unknown>);
  return mapped ? presentFlowEmbedding(mapped) : null;
}
