/**
 * Stored TAPBench wrap runs: tooling + 64D region score vs tapbench@ latest embedding.
 */

import type { TapbenchRegionScore } from "./score";
import type { TapbenchToolingDescription } from "./tooling";

export interface TapbenchRunRecord {
  id: string;
  workspace_id: string;
  key_id: string | null;
  user_id: string | null;
  tooling: TapbenchToolingDescription;
  proof_of_work_id: string | null;
  embedding_model_id: string;
  dim: number;
  in_region: boolean;
  distance_to_center: number;
  distance_to_closest_border: number | null;
  cosine_similarity: number;
  region_cosine_threshold: number;
  target_as_of_ms: number | null;
  created_at: string;
}

export interface TapbenchRunStore {
  insert(record: TapbenchRunRecord): Promise<TapbenchRunRecord>;
  listByWorkspace(workspaceId: string): Promise<TapbenchRunRecord[]>;
  listByKey(keyId: string): Promise<TapbenchRunRecord[]>;
  listAll(): Promise<TapbenchRunRecord[]>;
  getById(id: string): Promise<TapbenchRunRecord | null>;
}

const memoryRuns: TapbenchRunRecord[] = [];

export function resetTapbenchRunStoreForTests(): void {
  memoryRuns.length = 0;
}

export const memoryTapbenchRunStore: TapbenchRunStore = {
  async insert(record) {
    memoryRuns.push({ ...record });
    return { ...record };
  },
  async listByWorkspace(workspaceId) {
    return memoryRuns.filter((r) => r.workspace_id === workspaceId).map((r) => ({ ...r }));
  },
  async listByKey(keyId) {
    return memoryRuns.filter((r) => r.key_id === keyId).map((r) => ({ ...r }));
  },
  async listAll() {
    return memoryRuns.map((r) => ({ ...r }));
  },
  async getById(id) {
    const row = memoryRuns.find((r) => r.id === id);
    return row ? { ...row } : null;
  },
};

export function tapbenchRunFromScore(options: {
  id?: string;
  workspaceId: string;
  keyId?: string | null;
  userId?: string | null;
  tooling: TapbenchToolingDescription;
  proofOfWorkId?: string | null;
  score: TapbenchRegionScore;
  regionCosineThreshold: number;
  targetAsOfMs?: number | null;
  nowMs?: number;
}): TapbenchRunRecord {
  const nowMs = options.nowMs ?? Date.now();
  return {
    id: options.id || crypto.randomUUID(),
    workspace_id: options.workspaceId,
    key_id: options.keyId ?? null,
    user_id: options.userId ?? null,
    tooling: options.tooling,
    proof_of_work_id: options.proofOfWorkId ?? null,
    embedding_model_id: options.score.embedding_model_id,
    dim: options.score.dim,
    in_region: options.score.in_region,
    distance_to_center: options.score.distance_to_center,
    distance_to_closest_border: options.score.distance_to_closest_border,
    cosine_similarity: options.score.cosine_similarity,
    region_cosine_threshold: options.regionCosineThreshold,
    target_as_of_ms: options.targetAsOfMs ?? null,
    created_at: new Date(nowMs).toISOString(),
  };
}

export function publicTapbenchRunView(run: TapbenchRunRecord) {
  return {
    id: run.id,
    workspace_id: run.workspace_id,
    tooling: run.tooling,
    embedding_model_id: run.embedding_model_id,
    dim: run.dim,
    in_region: run.in_region,
    distance_to_center: run.distance_to_center,
    distance_to_closest_border: run.distance_to_closest_border,
    cosine_similarity: run.cosine_similarity,
    created_at: run.created_at,
  };
}

export type TapbenchPublicRun = ReturnType<typeof publicTapbenchRunView>;
