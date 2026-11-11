/**
 * Single-region details: reconstruct a polished summary + cluster/sample
 * lists from the persisted parent region, strategy-cluster children, and
 * owner embeddings. Inspect uses Data Studio's payload (identity, origin,
 * flow/run ids, transcripts/PoW).
 */

import { FLOW_EMBEDDING_PATH_TEXT_MODEL_ID } from "@/lib/flow-embedding";
import {
  inspectStudioEmbedding,
  studioPointInsideHighDimRegion,
  type DataStudioEmbeddingRow,
  type DataStudioInspectPayload,
} from "@/lib/data-studio-view";
import type { RegionCentroidInput } from "@/lib/knowledge-config";
import {
  knowledgeRegionPointKind,
  type KnowledgeRegionPointKind,
} from "@/lib/knowledge-region-figure";
import {
  dashboardKnowledgeRegionHref,
  dashboardKnowledgeRegionStudioHref,
  type DashboardKnowledgeRegionKind,
} from "@/lib/dashboard-knowledge-regions";
import {
  explorationStrategyById,
  isExplorationStrategyId,
  isSimulationStrategyClusterName,
  simulatedIdentityLabel,
  studioEmbeddingOrigin,
  type ExplorationStrategyId,
  type StudioEmbeddingOrigin,
} from "@/lib/region-simulation";
import type { ProductFlowKind } from "@/lib/product-flow";

export type KnowledgeRegionDetailsCluster = {
  id: string;
  name: string;
  strategyId: ExplorationStrategyId | null;
  strategyName: string;
  sampleCount: number;
};

export type KnowledgeRegionDetailsSample = {
  id: string;
  identity: string | null;
  origin: StudioEmbeddingOrigin;
  pointKind: KnowledgeRegionPointKind;
  flow_id: string | null;
  run_id: string | null;
  workspace_id: string | null;
  source: string | null;
  clusterId: string | null;
  strategyId: ExplorationStrategyId | null;
  strategyName: string | null;
  embedding: DataStudioEmbeddingRow;
};

export type KnowledgeRegionDetails = {
  id: string;
  kind: ProductFlowKind;
  name: string;
  description: string | null;
  createdAt: string;
  subjectCount: number;
  workspaceId: string;
  flows: Array<{ id: string; name: string }>;
  strategies: Array<{ id: string; name: string }>;
  samplesPerStrategy: number;
  simulatedCount: number;
  cohortCount: number;
  analysisCount: number;
  realSessionCount: number;
  clusters: KnowledgeRegionDetailsCluster[];
  samples: KnowledgeRegionDetailsSample[];
  embeddings: DataStudioEmbeddingRow[];
  regions: RegionCentroidInput[];
  regionPath: string;
  studioPath: string;
};

export type KnowledgeRegionDetailsRow = {
  id?: unknown;
  name?: unknown;
  description?: unknown;
  product?: unknown;
  owner_user_id?: unknown;
  workspace_id?: unknown;
  subject_count?: unknown;
  created_at?: unknown;
  embedding_model_id?: unknown;
  centroid?: unknown;
  cosine_threshold?: unknown;
  mean_radius?: unknown;
  verify_flow_id?: unknown;
  calibrate_flow_id?: unknown;
  solve_flow_id?: unknown;
  subjects?: unknown;
};

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function parseRegionSubjects(value: unknown): Array<{
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

function numbers(value: unknown): number[] {
  return Array.isArray(value)
    ? value.filter((n): n is number => typeof n === "number" && Number.isFinite(n))
    : [];
}

export function parseRegionSimulationDescription(description: unknown): {
  flowCount: number;
  strategyNames: string[];
  samplesPerStrategy: number;
  realSessionCount: number;
} | null {
  const raw = text(description);
  const match = raw.match(
    /^region-simulation:\s*(\d+)\s*flows\s*·\s*(.*?)\s*·\s*(\d+)\/strategy\s*·\s*(\d+)\s*real/i,
  );
  if (!match) return null;
  const strategyNames = match[2]
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean);
  return {
    flowCount: Number(match[1]) || 0,
    strategyNames,
    samplesPerStrategy: Number(match[3]) || 0,
    realSessionCount: Number(match[4]) || 0,
  };
}

export function parseRegionSimulationClusterStrategyId(
  description: unknown,
): ExplorationStrategyId | null {
  const match = text(description).match(/region-simulation-cluster:([a-z0-9-]+)/i);
  const id = match?.[1] || "";
  return isExplorationStrategyId(id) ? id : null;
}

export function isRegionSimulationClusterRow(row: {
  description?: unknown;
  embedding_model_id?: unknown;
}): boolean {
  if (text(row.embedding_model_id) === FLOW_EMBEDDING_PATH_TEXT_MODEL_ID) return false;
  return text(row.description).includes("region-simulation-cluster:");
}

function asEmbeddingRow(row: DataStudioEmbeddingRow | Record<string, unknown>): DataStudioEmbeddingRow | null {
  const id = text(row.id);
  if (!id) return null;
  const vector = numbers(row.vector);
  return {
    id,
    workspace_id: text(row.workspace_id) || null,
    owner_user_id: text(row.owner_user_id) || null,
    flow_kind: text(row.flow_kind) || null,
    flow_id: text(row.flow_id) || null,
    run_id: text(row.run_id) || null,
    identity: text(row.identity) || null,
    vector,
    vector_path_text: Array.isArray(row.vector_path_text) ? numbers(row.vector_path_text) : undefined,
    raw: "raw" in row ? row.raw : null,
    embedding_model_id: text(row.embedding_model_id) || null,
    created_at: text(row.created_at) || null,
    source: text(row.source) || null,
    user_id: text(row.user_id) || null,
    is_play_copy: typeof row.is_play_copy === "boolean" ? row.is_play_copy : null,
    workspace_title: text(row.workspace_title) || null,
  };
}

function regionCentroid(row: KnowledgeRegionDetailsRow): RegionCentroidInput | null {
  const id = text(row.id);
  const name = text(row.name);
  const centroid = numbers(row.centroid);
  if (!id || !name || !centroid.length) return null;
  const threshold = Number(row.cosine_threshold);
  const meanRadius = Number(row.mean_radius);
  return {
    id,
    name,
    centroid,
    mean_radius: Number.isFinite(meanRadius) ? meanRadius : 0,
    cosine_threshold: Number.isFinite(threshold) ? threshold : 0.5,
    embedding_model_id: text(row.embedding_model_id) || undefined,
  };
}

function parentFlowId(row: KnowledgeRegionDetailsRow, kind: ProductFlowKind): string {
  if (kind === "calibration") return text(row.calibrate_flow_id);
  if (kind === "solve") return text(row.solve_flow_id);
  return text(row.verify_flow_id);
}

function strategyNameFromCluster(row: KnowledgeRegionDetailsRow, parentName: string): string {
  const strategyId = parseRegionSimulationClusterStrategyId(row.description);
  const fromCatalog = strategyId ? explorationStrategyById(strategyId)?.name : "";
  if (fromCatalog) return fromCatalog;
  const name = text(row.name);
  const prefix = `${parentName} · `;
  if (name.startsWith(prefix)) return name.slice(prefix.length).trim();
  return name;
}

export function presentKnowledgeRegionClusters(
  parent: KnowledgeRegionDetailsRow,
  rows: readonly KnowledgeRegionDetailsRow[],
): KnowledgeRegionDetailsCluster[] {
  const parentName = text(parent.name);
  const parentId = text(parent.id);
  const out: KnowledgeRegionDetailsCluster[] = [];
  for (const row of rows) {
    const id = text(row.id);
    const name = text(row.name);
    if (!id || !name || id === parentId) continue;
    if (!isRegionSimulationClusterRow(row)) continue;
    if (!isSimulationStrategyClusterName(parentName, name)) continue;
    const strategyId = parseRegionSimulationClusterStrategyId(row.description);
    const subjectCount = Number(row.subject_count);
    out.push({
      id,
      name,
      strategyId,
      strategyName: strategyNameFromCluster(row, parentName),
      sampleCount: Number.isFinite(subjectCount) ? subjectCount : 0,
    });
  }
  return out.sort((a, b) => a.strategyName.localeCompare(b.strategyName));
}

function embeddingFlowKind(kind: ProductFlowKind): string {
  if (kind === "calibration") return "calibrate";
  if (kind === "solve") return "solve";
  return "verify";
}

export function inspectKnowledgeRegionSample(
  sample: KnowledgeRegionDetailsSample | DataStudioEmbeddingRow | null | undefined,
): DataStudioInspectPayload | null {
  if (!sample) return null;
  const row = "embedding" in sample ? sample.embedding : sample;
  return inspectStudioEmbedding(row);
}

export function presentKnowledgeRegionDetails(input: {
  parent: KnowledgeRegionDetailsRow;
  clusters?: readonly KnowledgeRegionDetailsRow[];
  embeddings?: readonly (DataStudioEmbeddingRow | Record<string, unknown>)[];
  flowNames?: Readonly<Record<string, string>>;
  kind: DashboardKnowledgeRegionKind;
}): KnowledgeRegionDetails | null {
  const id = text(input.parent.id);
  const name = text(input.parent.name);
  if (!id || !name) return null;
  const kind = input.kind;
  const parsed = parseRegionSimulationDescription(input.parent.description);
  const subjects = parseRegionSubjects(input.parent.subjects);
  const clusters = presentKnowledgeRegionClusters(input.parent, input.clusters ?? []);
  const clusterByStrategyName = new Map(clusters.map((cluster) => [cluster.strategyName, cluster]));
  const clusterCentroids = (input.clusters ?? [])
    .map((row) => {
      const presented = clusters.find((cluster) => cluster.id === text(row.id));
      const centroid = regionCentroid(row);
      if (!presented || !centroid) return null;
      return { ...centroid, strategyId: presented.strategyId, strategyName: presented.strategyName };
    })
    .filter((row): row is RegionCentroidInput & { strategyId: ExplorationStrategyId | null; strategyName: string } => !!row);

  const parentCentroid = regionCentroid(input.parent);
  const expectedKind = embeddingFlowKind(kind);
  const seededFlowId = parentFlowId(input.parent, kind);
  const rows: DataStudioEmbeddingRow[] = [];
  for (const raw of input.embeddings ?? []) {
    const embedding = asEmbeddingRow(raw);
    if (!embedding) continue;
    const flowKind = text(embedding.flow_kind);
    if (flowKind && flowKind !== expectedKind) continue;
    rows.push(embedding);
  }

  const samples: KnowledgeRegionDetailsSample[] = [];
  const embeddings: DataStudioEmbeddingRow[] = [];
  const flowIds = new Set<string>();
  if (seededFlowId) flowIds.add(seededFlowId);

  function pushSample(
    embedding: DataStudioEmbeddingRow,
    cluster: KnowledgeRegionDetailsCluster | null,
  ): void {
    const origin = studioEmbeddingOrigin(embedding);
    samples.push({
      id: embedding.id,
      identity: embedding.identity ?? null,
      origin,
      pointKind: knowledgeRegionPointKind({
        origin,
        id: embedding.id,
        identity: embedding.identity,
        userId: embedding.user_id,
        subjects,
      }),
      flow_id: embedding.flow_id ?? null,
      run_id: embedding.run_id ?? null,
      workspace_id: embedding.workspace_id ?? null,
      source: embedding.source ?? null,
      clusterId: cluster?.id ?? null,
      strategyId: cluster?.strategyId ?? null,
      strategyName: cluster?.strategyName ?? null,
      embedding,
    });
    embeddings.push(embedding);
    const flowId = text(embedding.flow_id);
    if (flowId) flowIds.add(flowId);
  }

  function insideParent(vector: number[]): boolean {
    return parentCentroid ? studioPointInsideHighDimRegion(vector, parentCentroid) : false;
  }

  function insideCluster(
    vector: number[],
    cluster: KnowledgeRegionDetailsCluster | null,
  ): boolean {
    if (!cluster) return false;
    const geom = clusterCentroids.find((row) => row.id === cluster.id);
    return geom ? studioPointInsideHighDimRegion(vector, geom) : false;
  }

  function insideThisRegion(
    vector: number[],
    cluster: KnowledgeRegionDetailsCluster | null,
  ): boolean {
    if (insideCluster(vector, cluster) || insideParent(vector)) return true;
    if (cluster) return false;
    return clusterCentroids.some((geom) => studioPointInsideHighDimRegion(vector, geom));
  }

  const hasGeometry = Boolean(parentCentroid || clusterCentroids.length);

  for (const embedding of rows) {
    if (studioEmbeddingOrigin(embedding) !== "simulated") continue;
    const identity = text(embedding.identity);
    const cluster =
      clusters.find((row) => identity === simulatedIdentityLabel(row.strategyName)) ?? null;
    if (clusters.length && !cluster) continue;
    if (hasGeometry) {
      if (!insideThisRegion(embedding.vector, cluster)) continue;
    } else {
      const onSeeded = Boolean(seededFlowId && text(embedding.flow_id) === seededFlowId);
      if (!cluster && !onSeeded) continue;
    }
    pushSample(embedding, cluster);
  }

  for (const embedding of rows) {
    if (studioEmbeddingOrigin(embedding) !== "human") continue;
    if (hasGeometry) {
      if (!insideThisRegion(embedding.vector, null)) continue;
    } else {
      const flowId = text(embedding.flow_id);
      const onRegionFlow = Boolean(flowId && flowIds.has(flowId));
      if (!onRegionFlow) continue;
    }
    pushSample(embedding, null);
  }

  const names = input.flowNames ?? {};
  const flows = [...flowIds].map((flowId) => ({
    id: flowId,
    name: text(names[flowId]) || flowId,
  }));

  const strategies =
    clusters.length > 0
      ? clusters.map((cluster) => ({
          id: cluster.strategyId || cluster.id,
          name: cluster.strategyName,
        }))
      : (parsed?.strategyNames ?? []).map((strategyName) => {
          const cluster = clusterByStrategyName.get(strategyName);
          return { id: cluster?.strategyId || strategyName, name: strategyName };
        });

  const simulatedCount = samples.filter((sample) => sample.pointKind === "simulated").length;
  const cohortCount = samples.filter((sample) => sample.pointKind === "cohort").length;
  const analysisCount = samples.filter((sample) => sample.pointKind === "analysis").length;
  const realSessionCount = samples.filter((sample) => sample.origin === "human").length;
  const samplesPerStrategy =
    parsed?.samplesPerStrategy ||
    (clusters[0]?.sampleCount ?? (clusters.length ? Math.round(simulatedCount / clusters.length) : 0));

  for (const cluster of clusters) {
    const counted = samples.filter((sample) => sample.clusterId === cluster.id).length;
    if (counted) cluster.sampleCount = counted;
  }

  const regions: RegionCentroidInput[] = [];
  if (parentCentroid) regions.push(parentCentroid);
  for (const cluster of clusterCentroids) {
    regions.push({
      id: cluster.id,
      name: cluster.name,
      centroid: cluster.centroid,
      mean_radius: cluster.mean_radius,
      cosine_threshold: cluster.cosine_threshold,
      embedding_model_id: cluster.embedding_model_id,
    });
  }

  const description = text(input.parent.description) || null;
  const subjectCount = Number(input.parent.subject_count);

  return {
    id,
    kind,
    name,
    description,
    createdAt: text(input.parent.created_at),
    subjectCount: Number.isFinite(subjectCount) ? subjectCount : samples.length,
    workspaceId: text(input.parent.workspace_id),
    flows,
    strategies,
    samplesPerStrategy,
    simulatedCount,
    cohortCount,
    analysisCount,
    realSessionCount,
    clusters,
    samples,
    embeddings,
    regions,
    regionPath: dashboardKnowledgeRegionHref(kind, id),
    studioPath: dashboardKnowledgeRegionStudioHref(kind, id),
  };
}
