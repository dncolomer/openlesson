/**
 * Closed render payload for one knowledge region × one candidate.
 * Mixes embeddings into a named space; unsys distance stays policy excess.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import {
  FLOW_EMBEDDING_DIM,
  FLOW_EMBEDDING_MODEL_ID,
  FLOW_EMBEDDING_PATH_TEXT_MODEL_ID,
  recoverFlowEmbeddingRaw,
  vectorForFlowSpace,
} from "@/lib/flow-embedding";
import {
  listFlowEmbeddingsForOwner,
  type StoredFlowEmbedding,
} from "@/lib/flow-embedding-store";
import { parseFlowEmbeddingSpace } from "@/lib/flow-embedding-space";
import { l2Distance, l2Normalize } from "@/lib/knowledge-config/math";
import { studioPointInsideHighDimRegion } from "@/lib/data-studio-view";
import {
  presentKnowledgeRegionClusters,
  type KnowledgeRegionDetailsRow,
} from "@/lib/knowledge-region-details";
import { productFlowEmbeddingKind } from "@/lib/product-flow";
import {
  isAiUseEmbedding,
  simulatedIdentityLabel,
  studioEmbeddingOrigin,
} from "@/lib/region-simulation";

export type KnowledgeRegionCandidateRender = {
  knowledge_region_id: string;
  candidate_id: string;
  embedding_model_id: typeof FLOW_EMBEDDING_MODEL_ID;
  space: string;
  dim: typeof FLOW_EMBEDDING_DIM;
  clusters: Array<{
    id: string;
    strategy_id: string | null;
    strategy_name: string;
  }>;
  observations: KnowledgeRegionCandidateObservation[];
  unsys: {
    average: number | null;
    observation_count: number;
    scored_count: number;
    flows: UnsysFlowBreakdown[];
  };
  path: {
    segments: DistancePair[];
    span: DistancePair | null;
  };
  pairwise: {
    observation_ids: string[];
    matrix: number[][];
  };
};

export type KnowledgeRegionCandidateObservation = {
  id: string;
  created_at: string;
  flow_id: string | null;
  run_id: string | null;
  nearest_cluster_id: string | null;
  unsys: {
    distance: number | null;
    excess: number | null;
    steps: number | null;
  };
  cluster_distances: Array<{
    cluster_id: string;
    l2: number;
    nearest: boolean;
    in_cluster: boolean;
  }>;
};

export type UnsysFlowBreakdown = {
  flow_id: string;
  average: number | null;
  observation_count: number;
  scored_count: number;
  observations: Array<{
    id: string;
    distance: number | null;
    excess: number | null;
    steps: number | null;
  }>;
};

export type DistancePair = {
  from_id: string;
  to_id: string;
  l2: number;
};

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function numbers(value: unknown): number[] {
  return Array.isArray(value)
    ? value.filter((n): n is number => typeof n === "number" && Number.isFinite(n))
    : [];
}

function parseSubjects(value: unknown): Array<{
  user_id: string | null;
  guest_user_id: string | null;
  label: string | null;
}> {
  if (!Array.isArray(value)) return [];
  const out: Array<{
    user_id: string | null;
    guest_user_id: string | null;
    label: string | null;
  }> = [];
  for (const row of value) {
    if (!row || typeof row !== "object") continue;
    const record = row as { user_id?: unknown; guest_user_id?: unknown; label?: unknown };
    out.push({
      user_id: text(record.user_id) || null,
      guest_user_id: text(record.guest_user_id) || null,
      label: text(record.label) || null,
    });
  }
  return out;
}

export function candidateIdentityKeys(
  candidateId: string,
  subjects: readonly {
    user_id: string | null;
    guest_user_id: string | null;
    label: string | null;
  }[],
): Set<string> {
  const keys = new Set<string>([candidateId]);
  for (const subject of subjects) {
    const ids = [subject.user_id, subject.guest_user_id, subject.label]
      .map((value) => text(value))
      .filter(Boolean);
    if (ids.includes(candidateId)) {
      for (const id of ids) keys.add(id);
    }
  }
  return keys;
}

function embeddingMatchesCandidate(
  embedding: StoredFlowEmbedding,
  keys: Set<string>,
): boolean {
  const identity = text(embedding.identity);
  if (identity && keys.has(identity)) return true;
  return false;
}

function unsysFromEmbedding(embedding: StoredFlowEmbedding): {
  distance: number | null;
  excess: number | null;
  steps: number | null;
} {
  const raw = recoverFlowEmbeddingRaw(embedding.raw) ?? embedding.raw;
  const policy = raw?.projectedPolicy;
  if (!policy) return { distance: null, excess: null, steps: null };
  const distance = Number(policy.distance);
  const excess = Number(policy.excess);
  const steps = Number(policy.steps);
  return {
    distance: Number.isFinite(distance) ? distance : null,
    excess: Number.isFinite(excess) ? excess : null,
    steps: Number.isFinite(steps) ? steps : null,
  };
}

function meanCentroid(vectors: readonly number[][]): number[] | null {
  const usable = vectors.filter((vector) => vector.length === FLOW_EMBEDDING_DIM);
  if (!usable.length) return null;
  const acc = new Array(FLOW_EMBEDDING_DIM).fill(0);
  for (const vector of usable) {
    for (let i = 0; i < FLOW_EMBEDDING_DIM; i += 1) acc[i] += vector[i] ?? 0;
  }
  for (let i = 0; i < FLOW_EMBEDDING_DIM; i += 1) acc[i] /= usable.length;
  return l2Normalize(acc);
}

function meanOf(values: readonly number[]): number | null {
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function createdAtMs(value: string | null | undefined): number {
  const ms = Date.parse(String(value || ""));
  return Number.isFinite(ms) ? ms : 0;
}

function parentFlowId(row: KnowledgeRegionDetailsRow): string {
  return text(row.verify_flow_id);
}

function pathInsideRegion(
  vector: number[],
  parent: KnowledgeRegionDetailsRow,
  clusterRows: readonly KnowledgeRegionDetailsRow[],
): boolean {
  const parentCentroid = numbers(parent.centroid);
  const parentThreshold = Number(parent.cosine_threshold);
  if (parentCentroid.length === vector.length) {
    if (
      studioPointInsideHighDimRegion(vector, {
        centroid: parentCentroid,
        cosine_threshold: Number.isFinite(parentThreshold) ? parentThreshold : 0.5,
      })
    ) {
      return true;
    }
  }
  for (const row of clusterRows) {
    const centroid = numbers(row.centroid);
    if (centroid.length !== vector.length) continue;
    const threshold = Number(row.cosine_threshold);
    if (
      studioPointInsideHighDimRegion(vector, {
        centroid,
        cosine_threshold: Number.isFinite(threshold) ? threshold : 0.5,
      })
    ) {
      return true;
    }
  }
  return false;
}

export function presentKnowledgeRegionCandidate(input: {
  knowledgeRegionId: string;
  candidateId: string;
  space: string;
  parent: KnowledgeRegionDetailsRow;
  clusters?: readonly KnowledgeRegionDetailsRow[];
  embeddings?: readonly StoredFlowEmbedding[];
}): KnowledgeRegionCandidateRender {
  const space = parseFlowEmbeddingSpace(input.space);
  const canonical = space.ok ? space.space : "path";
  const clusters = presentKnowledgeRegionClusters(input.parent, input.clusters ?? []);
  const subjects = parseSubjects(input.parent.subjects);
  const keys = candidateIdentityKeys(input.candidateId, subjects);
  const seededFlowId = parentFlowId(input.parent);
  const clusterRows = (input.clusters ?? []).filter((row) =>
    clusters.some((cluster) => cluster.id === text(row.id)),
  );

  const mixedById = new Map<string, number[]>();
  for (const embedding of input.embeddings ?? []) {
    mixedById.set(embedding.id, vectorForFlowSpace(embedding, canonical));
  }

  const clusterGeom = clusters.map((cluster) => {
    const row = clusterRows.find((item) => text(item.id) === cluster.id);
    const members = (input.embeddings ?? []).filter((embedding) => {
      if (studioEmbeddingOrigin(embedding) !== "simulated") return false;
      if (isAiUseEmbedding(embedding)) return false;
      return text(embedding.identity) === simulatedIdentityLabel(cluster.strategyName);
    });
    const mixed = members
      .map((embedding) => mixedById.get(embedding.id))
      .filter((vector): vector is number[] => Array.isArray(vector) && vector.length === FLOW_EMBEDDING_DIM);
    const centroid = meanCentroid(mixed) ?? (row ? numbers(row.centroid) : []);
    const threshold = Number(row?.cosine_threshold);
    return {
      id: cluster.id,
      strategy_id: cluster.strategyId,
      strategy_name: cluster.strategyName,
      centroid,
      cosine_threshold: Number.isFinite(threshold) ? threshold : 0.5,
    };
  });

  const matched = (input.embeddings ?? [])
    .filter((embedding) => embeddingMatchesCandidate(embedding, keys))
    .filter((embedding) => {
      const pathVector = Array.isArray(embedding.vector) ? embedding.vector : [];
      if (seededFlowId && text(embedding.flow_id) === seededFlowId) return true;
      if (pathVector.length) return pathInsideRegion(pathVector, input.parent, clusterRows);
      return true;
    })
    .sort((a, b) => {
      const byTime = createdAtMs(a.created_at) - createdAtMs(b.created_at);
      return byTime !== 0 ? byTime : a.id.localeCompare(b.id);
    });

  const observations: KnowledgeRegionCandidateObservation[] = matched.map((embedding) => {
    const vector = mixedById.get(embedding.id) ?? [];
    const unsys = unsysFromEmbedding(embedding);
    const cluster_distances = clusterGeom
      .map((cluster) => {
        if (!cluster.centroid.length || cluster.centroid.length !== vector.length) return null;
        const l2 = l2Distance(vector, cluster.centroid);
        if (!Number.isFinite(l2)) return null;
        return {
          cluster_id: cluster.id,
          l2,
          nearest: false,
          in_cluster: studioPointInsideHighDimRegion(vector, cluster),
        };
      })
      .filter((row): row is KnowledgeRegionCandidateObservation["cluster_distances"][number] => !!row)
      .sort((a, b) => a.l2 - b.l2);
    if (cluster_distances[0]) cluster_distances[0].nearest = true;
    return {
      id: embedding.id,
      created_at: embedding.created_at,
      flow_id: embedding.flow_id,
      run_id: embedding.run_id,
      nearest_cluster_id: cluster_distances[0]?.cluster_id ?? null,
      unsys,
      cluster_distances,
    };
  });

  const flowIds = [...new Set(observations.map((row) => row.flow_id).filter((id): id is string => !!id))];
  const flows: UnsysFlowBreakdown[] = flowIds.map((flowId) => {
    const rows = observations.filter((row) => row.flow_id === flowId);
    const scored = rows
      .map((row) => row.unsys.distance)
      .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
    return {
      flow_id: flowId,
      average: meanOf(scored),
      observation_count: rows.length,
      scored_count: scored.length,
      observations: rows.map((row) => ({
        id: row.id,
        distance: row.unsys.distance,
        excess: row.unsys.excess,
        steps: row.unsys.steps,
      })),
    };
  });

  const scoredAll = observations
    .map((row) => row.unsys.distance)
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value));

  const observationIds = observations.map((row) => row.id);
  const matrix: number[][] = observationIds.map((_, i) =>
    observationIds.map((__, j) => {
      if (i === j) return 0;
      const a = mixedById.get(observationIds[i]!) ?? [];
      const b = mixedById.get(observationIds[j]!) ?? [];
      const d = l2Distance(a, b);
      return Number.isFinite(d) ? d : 0;
    }),
  );

  const segments: DistancePair[] = [];
  for (let i = 1; i < observationIds.length; i += 1) {
    segments.push({
      from_id: observationIds[i - 1]!,
      to_id: observationIds[i]!,
      l2: matrix[i - 1]?.[i] ?? 0,
    });
  }
  const span: DistancePair | null =
    observationIds.length >= 2
      ? {
          from_id: observationIds[0]!,
          to_id: observationIds[observationIds.length - 1]!,
          l2: matrix[0]?.[observationIds.length - 1] ?? 0,
        }
      : null;

  return {
    knowledge_region_id: input.knowledgeRegionId,
    candidate_id: input.candidateId,
    embedding_model_id: FLOW_EMBEDDING_MODEL_ID,
    space: canonical,
    dim: FLOW_EMBEDDING_DIM,
    clusters: clusters.map((cluster) => ({
      id: cluster.id,
      strategy_id: cluster.strategyId,
      strategy_name: cluster.strategyName,
    })),
    observations,
    unsys: {
      average: meanOf(scoredAll),
      observation_count: observations.length,
      scored_count: scoredAll.length,
      flows,
    },
    path: { segments, span },
    pairwise: { observation_ids: observationIds, matrix },
  };
}

export type LoadKnowledgeRegionCandidateResult =
  | { ok: true; payload: KnowledgeRegionCandidateRender }
  | { ok: false; status: 400 | 404; code: "not_found" | "validation_error"; message: string };

const REGION_SELECT =
  "id, workspace_id, owner_user_id, name, description, subject_count, subjects, created_at, embedding_model_id, centroid, cosine_threshold, mean_radius, verify_flow_id";

export async function loadKnowledgeRegionCandidate(
  input: {
    ownerUserId: string;
    knowledgeRegionId: string;
    candidateId: string;
    space?: unknown;
  },
): Promise<LoadKnowledgeRegionCandidateResult> {
  const ownerUserId = text(input.ownerUserId);
  const knowledgeRegionId = text(input.knowledgeRegionId);
  const candidateId = text(input.candidateId);
  if (!ownerUserId) {
    return { ok: false, status: 404, code: "not_found", message: "Knowledge region not found" };
  }
  if (!knowledgeRegionId || !candidateId) {
    return { ok: false, status: 400, code: "validation_error", message: "knowledge_region_id and candidate_id are required" };
  }
  const space = parseFlowEmbeddingSpace(input.space);
  if (!space.ok) {
    return { ok: false, status: 400, code: "validation_error", message: space.error };
  }

  const supabase = createAdminClient();
  const { data: row, error } = await supabase
    .from("knowledge_regions")
    .select(REGION_SELECT)
    .eq("id", knowledgeRegionId)
    .eq("owner_user_id", ownerUserId)
    .maybeSingle();
  if (error || !row) {
    return { ok: false, status: 404, code: "not_found", message: "Knowledge region not found" };
  }
  if (text(row.embedding_model_id) === FLOW_EMBEDDING_PATH_TEXT_MODEL_ID) {
    return { ok: false, status: 404, code: "not_found", message: "Knowledge region not found" };
  }
  const { data: siblings } = await supabase
    .from("knowledge_regions")
    .select(REGION_SELECT)
    .eq("owner_user_id", ownerUserId);

  const embeddings = await listFlowEmbeddingsForOwner({
    ownerUserId,
    flowKind: productFlowEmbeddingKind(),
  });

  return {
    ok: true,
    payload: presentKnowledgeRegionCandidate({
      knowledgeRegionId,
      candidateId,
      space: space.space,
      parent: row as KnowledgeRegionDetailsRow,
      clusters: (siblings || []) as KnowledgeRegionDetailsRow[],
      embeddings,
    }),
  };
}
