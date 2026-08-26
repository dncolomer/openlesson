/**
 * Supabase persistence for TAPBench keys + runs. Service-role client only.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  KNOWLEDGE_CONFIG_DIM,
  KNOWLEDGE_CONFIG_EMBEDDING_MODEL_ID,
  isKnowledgeConfigVector,
} from "@/lib/knowledge-config";
import { insertKnowledgeConfigSnapshot } from "@/lib/pow-api/knowledge-config-store";
import type { TapbenchIssuedKey, TapbenchKeyStore } from "./keys";
import type { TapbenchRunRecord, TapbenchRunStore } from "./runs";
import type { TapbenchOwnerEmbedding } from "./wrap";
import type { TapbenchToolingDescription } from "./tooling";

const KEY_COLUMNS =
  "id, workspace_id, user_id, key_hash, key_prefix, label, is_active, created_at, last_used_at, expires_at, stopped_at";

function parseIssuedKey(raw: Record<string, unknown>): TapbenchIssuedKey {
  return {
    id: String(raw.id),
    workspace_id: String(raw.workspace_id),
    user_id: (raw.user_id as string | null) ?? null,
    key_hash: String(raw.key_hash || ""),
    key_prefix: String(raw.key_prefix || ""),
    label: (raw.label as string | null) ?? null,
    is_active: raw.is_active !== false,
    created_at: String(raw.created_at || ""),
    last_used_at: (raw.last_used_at as string | null) ?? null,
    expires_at: (raw.expires_at as string | null) ?? null,
    stopped_at: (raw.stopped_at as string | null) ?? null,
  };
}

function parseTooling(raw: unknown): TapbenchToolingDescription {
  const rec = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  return {
    agentic_harness: typeof rec.agentic_harness === "string" ? rec.agentic_harness : null,
    model: typeof rec.model === "string" ? rec.model : null,
    notes: typeof rec.notes === "string" ? rec.notes : null,
  };
}

function parseRun(raw: Record<string, unknown>): TapbenchRunRecord {
  const border = raw.distance_to_closest_border;
  return {
    id: String(raw.id),
    workspace_id: String(raw.workspace_id),
    key_id: (raw.key_id as string | null) ?? null,
    user_id: (raw.user_id as string | null) ?? null,
    tooling: parseTooling(raw.tooling),
    proof_of_work_id: (raw.proof_of_work_id as string | null) ?? null,
    embedding_model_id: String(raw.embedding_model_id || KNOWLEDGE_CONFIG_EMBEDDING_MODEL_ID),
    dim: Number(raw.dim) || KNOWLEDGE_CONFIG_DIM,
    in_region: Boolean(raw.in_region),
    distance_to_center: Number(raw.distance_to_center),
    distance_to_closest_border:
      border == null || border === "" ? null : Number(border),
    cosine_similarity: Number(raw.cosine_similarity) || 0,
    region_cosine_threshold: Number(raw.region_cosine_threshold) || 0,
    target_as_of_ms:
      raw.target_as_of_ms == null ? null : Number(raw.target_as_of_ms),
    created_at: String(raw.created_at || ""),
  };
}

export function supabaseTapbenchKeyStore(supabase: SupabaseClient): TapbenchKeyStore {
  return {
    async insert(record) {
      const { data, error } = await supabase
        .from("tapbench_task_keys")
        .insert({
          id: record.id,
          workspace_id: record.workspace_id,
          user_id: record.user_id,
          key_hash: record.key_hash,
          key_prefix: record.key_prefix,
          label: record.label,
          is_active: record.is_active,
          created_at: record.created_at,
          last_used_at: record.last_used_at,
          expires_at: record.expires_at,
          stopped_at: record.stopped_at,
        })
        .select(KEY_COLUMNS)
        .single();
      if (error || !data) {
        throw new Error(error?.message || "Failed to store TAPBench key");
      }
      return parseIssuedKey(data as Record<string, unknown>);
    },
    async findByHash(keyHash) {
      const { data, error } = await supabase
        .from("tapbench_task_keys")
        .select(KEY_COLUMNS)
        .eq("key_hash", keyHash)
        .maybeSingle();
      if (error || !data) return null;
      return parseIssuedKey(data as Record<string, unknown>);
    },
    async touchLastUsed(id, atIso) {
      await supabase.from("tapbench_task_keys").update({ last_used_at: atIso }).eq("id", id);
    },
    async markStopped(id, atIso) {
      await supabase.from("tapbench_task_keys").update({ stopped_at: atIso }).eq("id", id);
    },
  };
}

export function supabaseTapbenchRunStore(supabase: SupabaseClient): TapbenchRunStore {
  return {
    async insert(record) {
      const { data, error } = await supabase
        .from("tapbench_runs")
        .insert({
          id: record.id,
          workspace_id: record.workspace_id,
          key_id: record.key_id,
          user_id: record.user_id,
          tooling: record.tooling,
          proof_of_work_id: record.proof_of_work_id,
          embedding_model_id: record.embedding_model_id,
          dim: record.dim,
          in_region: record.in_region,
          distance_to_center: record.distance_to_center,
          distance_to_closest_border: record.distance_to_closest_border,
          cosine_similarity: record.cosine_similarity,
          region_cosine_threshold: record.region_cosine_threshold,
          target_as_of_ms: record.target_as_of_ms,
          created_at: record.created_at,
        })
        .select("*")
        .single();
      if (error || !data) {
        throw new Error(error?.message || "Failed to store TAPBench run");
      }
      return parseRun(data as Record<string, unknown>);
    },
    async listByWorkspace(workspaceId) {
      const { data, error } = await supabase
        .from("tapbench_runs")
        .select("*")
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error || !data) return [];
      return data.map((row) => parseRun(row as Record<string, unknown>));
    },
    async listByKey(keyId) {
      const { data, error } = await supabase
        .from("tapbench_runs")
        .select("*")
        .eq("key_id", keyId)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error || !data) return [];
      return data.map((row) => parseRun(row as Record<string, unknown>));
    },
    async listAll() {
      const { data, error } = await supabase
        .from("tapbench_runs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error || !data) return [];
      return data.map((row) => parseRun(row as Record<string, unknown>));
    },
    async getById(id) {
      const { data, error } = await supabase
        .from("tapbench_runs")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error || !data) return null;
      return parseRun(data as Record<string, unknown>);
    },
  };
}

export async function persistTapbenchParticipantEmbedding(
  supabase: SupabaseClient,
  options: {
    workspaceId: string;
    vector: number[];
    key: TapbenchIssuedKey;
    guestUserId?: string | null;
    powEventCount?: number;
  },
): Promise<void> {
  if (!isKnowledgeConfigVector(options.vector, KNOWLEDGE_CONFIG_DIM)) return;
  const asOfMs = Date.now();
  const guestUserId = options.guestUserId?.trim() || null;
  await insertKnowledgeConfigSnapshot(supabase, {
    workspaceId: options.workspaceId,
    subject: guestUserId
      ? { guest_user_id: guestUserId }
      : options.key.user_id
        ? { user_id: options.key.user_id }
        : null,
    embedding: {
      embedding_model_id: KNOWLEDGE_CONFIG_EMBEDDING_MODEL_ID,
      dim: KNOWLEDGE_CONFIG_DIM,
      vector: options.vector,
      as_of: new Date(asOfMs).toISOString(),
      as_of_ms: asOfMs,
      pow_event_count: options.powEventCount ?? 1,
      confidence: 0.5,
    },
    trigger: "pow_upload",
  });
}

export async function loadTapbenchOwnerLatestEmbedding(
  supabase: SupabaseClient,
  workspaceId: string,
  ownerUserId: string,
): Promise<TapbenchOwnerEmbedding | null> {
  const { data, error } = await supabase
    .from("knowledge_config_snapshots")
    .select("vector, as_of_ms, embedding_model_id, dim")
    .eq("workspace_id", workspaceId)
    .eq("subject_user_id", ownerUserId)
    .is("subject_guest_user_id", null)
    .eq("embedding_model_id", KNOWLEDGE_CONFIG_EMBEDDING_MODEL_ID)
    .order("as_of_ms", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  const vector = Array.isArray(data.vector) ? (data.vector as number[]) : [];
  if (!isKnowledgeConfigVector(vector, KNOWLEDGE_CONFIG_DIM)) return null;
  return {
    vector,
    as_of_ms: Number(data.as_of_ms) || 0,
    embedding_model_id: String(data.embedding_model_id || KNOWLEDGE_CONFIG_EMBEDDING_MODEL_ID),
  };
}
