/**
 * Run a knowledge-region simulation: persist labelled simulated embeddings,
 * optionally overlay real human embeddings from the same product flows,
 * and save a parent region plus one named cluster per strategy.
 */

import {
  createCustomVerificationModelFromVectors,
  pathTextRegionCompanionNames,
  type CustomVerificationModelSpec,
} from "@/lib/knowledge-config/custom-verification-model";
import { FLOW_EMBEDDING_DIM, FLOW_EMBEDDING_MODEL_ID } from "@/lib/flow-embedding";
import {
  deleteFlowEmbeddings,
  listFlowEmbeddingsForOwner,
  type StoredFlowEmbedding,
} from "@/lib/flow-embedding-store";
import { flowLinkDefinesReference } from "@/lib/flow-links";
import { studentSessionModelFromAuthorSeed } from "@/lib/author-unsys-model";
import { runCanvasFaithfulExplorationSample } from "@/lib/region-simulation-actor";
import { regionSimulationCanvasFaithfulEnabled } from "@/lib/region-simulation-flags";
import { persistRegionSimulationSample } from "@/lib/region-simulation-persist";
import { AI_USE_CATALOG, aiUseCatalogById } from "@/lib/region-simulation-ai-use-catalog";
import {
  isRegionSimulationClusterRow,
  parseRegionSimulationClusterStrategyId,
  type KnowledgeRegionDetailsRow,
} from "@/lib/knowledge-region-details";
import {
  productFlowEmbeddingKind,
  productRegionPagePath,
  type ProductFlowKind,
} from "@/lib/product-flow";
import { createAdminClient } from "@/lib/supabase/admin";
import { isMissingOrganizationIdColumn } from "@/lib/organization/membership";
import { loadActiveOrganizationId } from "@/lib/organization/membership-store";
import {
  aiUseClusterDescription,
  clampSamplesPerStrategy,
  collectRegionSimulationStrategies,
  emptySimulationProgress,
  isAiUseClusterDescription,
  isAiUseEmbedding,
  isSimulatedEmbedding,
  isSimulationStrategyClusterName,
  parseAiUseCatalogIdFromClusterDescription,
  parseSimulationStrategies,
  parseSimulationStrategiesWithRecovered,
  planRegionSimulationSamples,
  regionSimulationFlowIds,
  regionSimulationClusterDescription,
  regionSimulationParentDescription,
  runRegionSimulationSample,
  simulatedEmbeddingMatchesStrategy,
  simulatedIdentityLabel,
  simulationClusterRegionName,
  simulationSampleRunId,
  type ExplorationStrategy,
  type ExplorationStrategyId,
  type RegionSimulationProgress,
} from "@/lib/region-simulation";
import type { VerificationFlow } from "@/lib/verification-flow";

export type RegionSimulationFlowInput = {
  id: string;
  name: string;
  workspaceId?: string | null;
  problems: readonly string[];
  answersModelSeed?: unknown;
};

export type RegionSimulationClusterResult = {
  id: string | null;
  name: string;
  strategyId: ExplorationStrategyId;
  strategyName: string;
  sampleCount: number;
  persisted: boolean;
};

export type RegionSimulationSummary = {
  name: string;
  flows: Array<{ id: string; name: string }>;
  strategies: Array<{ id: ExplorationStrategyId; name: string }>;
  samplesPerStrategy: number;
  simulatedCount: number;
  realSessionCount: number;
};

export type RegionSimulationRunResult = {
  persisted: boolean;
  id: string | null;
  regionPath: string;
  parentName: string;
  clusters: RegionSimulationClusterResult[];
  summary: RegionSimulationSummary;
  progress: RegionSimulationProgress[];
};

export type RegionSimulationMutateResult = RegionSimulationRunResult & {
  parentRow: KnowledgeRegionDetailsRow;
  clusterRows: KnowledgeRegionDetailsRow[];
  addedSampleIds: string[];
  removedSampleIds: string[];
};

function supabaseConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

function simulationDetailsPath(kind: ProductFlowKind, regionId: string | null): string {
  return productRegionPagePath(kind, regionId || "");
}

function humanEmbeddingsForFlows(
  rows: readonly StoredFlowEmbedding[],
  flowIds: readonly string[],
): StoredFlowEmbedding[] {
  const allow = new Set(flowIds);
  return rows.filter(
    (row) => allow.has(String(row.flow_id || "")) && !isSimulatedEmbedding(row),
  );
}

function specFromEmbeddings(
  name: string,
  rows: readonly {
    vector: number[];
    identity?: string | null;
    id?: string;
    source?: string | null;
    link_label?: string | null;
  }[],
): CustomVerificationModelSpec {
  const defining = rows.filter((row) => {
    if ("source" in row || "link_label" in row) {
      return (
        isSimulatedEmbedding(row) || flowLinkDefinesReference(row.link_label)
      );
    }
    return true;
  });
  const used = defining.length ? defining : rows;
  return createCustomVerificationModelFromVectors({
    name,
    vectors: used.map((row) => row.vector),
    subjects: used.map((row) => ({
      label: row.identity || row.id || name,
    })),
    embedding_model_id: FLOW_EMBEDDING_MODEL_ID,
  });
}

function knowledgeRegionWriteRow(input: {
  ownerUserId: string;
  workspaceId: string | null;
  description: string;
  spec: CustomVerificationModelSpec;
  flowId: string | null;
  kind: ProductFlowKind;
  createdBy?: string;
}): Record<string, unknown> {
  return {
    workspace_id: input.workspaceId,
    owner_user_id: input.ownerUserId,
    product: input.kind,
    name: input.spec.name,
    description: input.description,
    embedding_model_id: input.spec.embedding_model_id,
    dim: input.spec.dim,
    centroid: input.spec.centroid,
    cohort_cohesion: input.spec.cohort_cohesion,
    mean_radius: input.spec.mean_radius,
    cosine_threshold: input.spec.cosine_threshold,
    subject_count: input.spec.subject_count,
    subjects: input.spec.subjects,
    updated_at: new Date().toISOString(),
    ...(input.createdBy ? { created_by: input.createdBy } : {}),
    verify_flow_id: input.flowId,
  };
}

async function persistKnowledgeRegion(input: {
  id?: string | null;
  ownerUserId: string;
  workspaceId: string | null;
  name: string;
  description: string;
  spec: CustomVerificationModelSpec;
  flowId: string | null;
  createdBy: string;
  kind: ProductFlowKind;
  organizationId?: string | null;
}): Promise<{ persisted: boolean; id: string | null }> {
  const existingId = String(input.id || "").trim();
  if (!supabaseConfigured()) {
    return { persisted: false, id: existingId || null };
  }
  const supabase = createAdminClient();
  if (existingId) {
    const { data, error } = await supabase
      .from("knowledge_regions")
      .update(knowledgeRegionWriteRow(input))
      .eq("id", existingId)
      .eq("owner_user_id", input.ownerUserId)
      .select("id")
      .maybeSingle();
    if (error || !data?.id) {
      throw new Error(error?.message || "Failed to update knowledge region");
    }
    return { persisted: true, id: String(data.id) };
  }
  const organizationId =
    String(input.organizationId || "").trim() ||
    (await loadActiveOrganizationId(supabase, input.ownerUserId));
  const row = {
    ...knowledgeRegionWriteRow({ ...input, createdBy: input.createdBy }),
    ...(organizationId ? { organization_id: organizationId } : {}),
  };
  let inserted = await supabase.from("knowledge_regions").insert(row).select("id").maybeSingle();
  if (inserted.error && organizationId && isMissingOrganizationIdColumn(inserted.error)) {
    const retry = { ...row };
    delete retry.organization_id;
    inserted = await supabase.from("knowledge_regions").insert(retry).select("id").maybeSingle();
  }
  if (inserted.error || !inserted.data?.id) {
    throw new Error(inserted.error?.message || "Failed to create knowledge region");
  }
  return { persisted: true, id: String(inserted.data.id) };
}

async function deleteKnowledgeRegion(input: {
  id: string;
  ownerUserId: string;
}): Promise<void> {
  const id = String(input.id || "").trim();
  if (!id || !supabaseConfigured()) return;
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("knowledge_regions")
    .delete()
    .eq("id", id)
    .eq("owner_user_id", input.ownerUserId);
  if (error) throw new Error(error.message);
}

async function persistPathTextCompanion(_input: {
  ownerUserId: string;
  organizationId?: string | null;
  workspaceId: string | null;
  name: string;
  description: string;
  embeddings: readonly { raw?: unknown }[];
  flowId: string | null;
  createdBy: string;
  kind: ProductFlowKind;
}): Promise<void> {
  return;
}

export async function runRegionSimulation(input: {
  ownerUserId: string;
  organizationId?: string | null;
  name: string;
  flows: readonly RegionSimulationFlowInput[];
  strategyIds?: readonly ExplorationStrategyId[];
  customStrategies?: unknown;
  strategies?: readonly ExplorationStrategy[];
  samplesPerStrategy: number;
  includeHumanData: boolean;
  kind?: ProductFlowKind;
  onProgress?: (progress: RegionSimulationProgress[]) => void;
}): Promise<RegionSimulationRunResult> {
  const ownerUserId = String(input.ownerUserId || "").trim();
  const name = String(input.name || "").trim();
  const kind: ProductFlowKind = input.kind || "verification";
  const flowKind = productFlowEmbeddingKind(kind);
  if (!ownerUserId) throw new Error("owner is required");
  if (!name) throw new Error("name is required");
  if (!input.flows.length) throw new Error("Select at least one flow");
  const strategies = input.strategies?.length
    ? [...input.strategies]
    : parseSimulationStrategies({
        strategyIds: input.strategyIds,
        customStrategies: input.customStrategies,
      });
  if (!strategies.length) throw new Error("Select at least one exploration strategy");
  const samplesPerStrategy = clampSamplesPerStrategy(input.samplesPerStrategy);
  const strategyIds = strategies.map((strategy) => strategy.id);
  const strategyById = new Map(strategies.map((strategy) => [strategy.id, strategy] as const));

  const flowIds = input.flows.map((flow) => flow.id);
  const problemsByFlowId: Record<string, readonly string[]> = {};
  for (const flow of input.flows) {
    problemsByFlowId[flow.id] = flow.problems;
  }
  const plans = planRegionSimulationSamples({
    flowIds,
    problemsByFlowId,
    strategyIds,
    samplesPerStrategy,
  });
  const progress = emptySimulationProgress(strategies, samplesPerStrategy);
  const byStrategy = new Map<ExplorationStrategyId, StoredFlowEmbedding[]>();
  for (const strategyId of strategyIds) {
    byStrategy.set(strategyId, []);
  }

  const simulated: StoredFlowEmbedding[] = [];
  for (const plan of plans) {
    const strategy = strategyById.get(plan.strategyId);
    if (!strategy) throw new Error(`Unknown exploration strategy: ${plan.strategyId}`);
    const flow = input.flows.find((row) => row.id === plan.flowId);
    const walk = await walkSimulationPlan(plan, flowKind, strategies, flow);
    const stored = await persistRegionSimulationSample({
      ownerUserId,
      workspaceId: flow?.workspaceId || undefined,
      flowKind,
      flowId: plan.flowId,
      runId: simulationSampleRunId(plan),
      identity: simulatedIdentityLabel(strategy.name),
      family: "exploration",
      model: walk.model,
      sequence: walk.sequence,
      pow: walk.pow,
    });
    simulated.push(stored);
    byStrategy.get(plan.strategyId)?.push(stored);
    const row = progress.find((item) => item.strategyId === plan.strategyId);
    if (row) row.done += 1;
    input.onProgress?.(progress.map((item) => ({ ...item })));
  }

  let humans: StoredFlowEmbedding[] = [];
  if (input.includeHumanData) {
    const owned = await listFlowEmbeddingsForOwner({
      ownerUserId,
      flowKind,
    });
    humans = humanEmbeddingsForFlows(owned, flowIds);
  }

  const parentRows = [...simulated, ...humans];
  const parentSpec = specFromEmbeddings(name, parentRows);
  const workspaceId = input.flows.find((flow) => flow.workspaceId)?.workspaceId || null;
  const primaryFlowId = flowIds[0] || null;
  const summary: RegionSimulationSummary = {
    name,
    flows: input.flows.map((flow) => ({ id: flow.id, name: flow.name })),
    strategies,
    samplesPerStrategy,
    simulatedCount: simulated.length,
    realSessionCount: humans.length,
  };
  const parentDescription = regionSimulationParentDescription({
    flowCount: summary.flows.length,
    strategyNames: strategies.map((row) => row.name),
    samplesPerStrategy: summary.samplesPerStrategy,
    realSessionCount: summary.realSessionCount,
  });

  const parent = await persistKnowledgeRegion({
    ownerUserId,
    organizationId: input.organizationId,
    workspaceId,
    name: parentSpec.name,
    description: parentDescription,
    spec: parentSpec,
    flowId: primaryFlowId,
    createdBy: ownerUserId,
    kind,
  });
  await persistPathTextCompanion({
    ownerUserId,
    organizationId: input.organizationId,
    workspaceId,
    name,
    description: parentDescription,
    embeddings: parentRows,
    flowId: primaryFlowId,
    createdBy: ownerUserId,
    kind,
  });

  const clusters: RegionSimulationClusterResult[] = [];
  for (const strategy of strategies) {
    const strategyId = strategy.id;
    const rows = byStrategy.get(strategyId) ?? [];
    if (!rows.length) continue;
    const clusterName = simulationClusterRegionName(name, strategy.name);
    const spec = specFromEmbeddings(clusterName, rows);
    const description = regionSimulationClusterDescription(strategyId);
    const saved = await persistKnowledgeRegion({
      ownerUserId,
      organizationId: input.organizationId,
      workspaceId,
      name: spec.name,
      description,
      spec,
      flowId: primaryFlowId,
      createdBy: ownerUserId,
      kind,
    });
    await persistPathTextCompanion({
      ownerUserId,
      organizationId: input.organizationId,
      workspaceId,
      name: clusterName,
      description,
      embeddings: rows,
      flowId: primaryFlowId,
      createdBy: ownerUserId,
      kind,
    });
    clusters.push({
      id: saved.id,
      name: clusterName,
      strategyId,
      strategyName: strategy.name,
      sampleCount: rows.length,
      persisted: saved.persisted,
    });
  }

  return {
    persisted: parent.persisted,
    id: parent.id,
    regionPath: simulationDetailsPath(kind, parent.id),
    parentName: name,
    clusters,
    summary,
    progress,
  };
}

export function problemsForSimulationFlow(flow: {
  questions?: readonly (string | { text?: string | null })[] | null;
  topic?: string | null;
  goal?: string | null;
  name?: string | null;
}): string[] {
  const questions = (flow.questions ?? [])
    .map((item) => (typeof item === "string" ? item : item.text))
    .map((item) => String(item || "").trim())
    .filter(Boolean);
  if (questions.length) return questions;
  const topic = String(flow.topic || flow.goal || "").trim();
  if (topic) return [topic];
  const name = String(flow.name || "").trim();
  return name ? [name] : ["Problem"];
}

export function problemsForVerificationFlow(
  flow: Pick<VerificationFlow, "questions" | "topic" | "name">,
): string[] {
  return problemsForSimulationFlow(flow);
}

function mergeExplorationStrategies(
  lists: readonly (readonly ExplorationStrategy[])[],
): ExplorationStrategy[] {
  const seen = new Set<string>();
  const out: ExplorationStrategy[] = [];
  for (const list of lists) {
    for (const strategy of list) {
      const id = String(strategy?.id || "").trim();
      if (!id || seen.has(id)) continue;
      seen.add(id);
      out.push(strategy);
    }
  }
  return out;
}

function embeddingsOnFlows(
  rows: readonly StoredFlowEmbedding[],
  flowIds: readonly string[],
): StoredFlowEmbedding[] {
  const allow = new Set(flowIds.map((id) => String(id || "").trim()).filter(Boolean));
  return rows.filter((row) => allow.has(String(row.flow_id || "")));
}

function strategiesFromSimulatedEmbeddings(
  rows: readonly StoredFlowEmbedding[],
): ExplorationStrategy[] {
  return collectRegionSimulationStrategies(rows);
}

async function walkSimulationPlan(
  plan: import("@/lib/region-simulation").RegionSimulationSamplePlan,
  flowKind: import("@/lib/flow-embedding").FlowKind,
  strategies: readonly ExplorationStrategy[],
  flow?: RegionSimulationFlowInput,
) {
  const seedModel = studentSessionModelFromAuthorSeed(flow?.answersModelSeed);
  if (regionSimulationCanvasFaithfulEnabled()) {
    return runCanvasFaithfulExplorationSample(plan, flowKind, strategies, seedModel);
  }
  return runRegionSimulationSample(plan, flowKind, strategies, seedModel);
}

function groupSimulatedByStrategy(
  rows: readonly StoredFlowEmbedding[],
  strategies: readonly ExplorationStrategy[],
): Map<ExplorationStrategyId, StoredFlowEmbedding[]> {
  const byStrategy = new Map<ExplorationStrategyId, StoredFlowEmbedding[]>();
  for (const strategy of strategies) byStrategy.set(strategy.id, []);
  for (const row of rows) {
    if (!isSimulatedEmbedding(row) || isAiUseEmbedding(row)) continue;
    const strategy = strategies.find((item) =>
      simulatedEmbeddingMatchesStrategy(row, item),
    );
    if (!strategy) continue;
    byStrategy.get(strategy.id)?.push(row);
  }
  return byStrategy;
}

function groupSimulatedByAiUseCatalog(
  rows: readonly StoredFlowEmbedding[],
): Map<string, StoredFlowEmbedding[]> {
  const byCatalog = new Map<string, StoredFlowEmbedding[]>();
  for (const row of rows) {
    if (!isAiUseEmbedding(row)) continue;
    const identity = String(row.identity || "");
    const catalog = AI_USE_CATALOG.find((item) => identity === `AI · ${item.displayName}`);
    const id = catalog?.id || parseAiUseCatalogIdFromClusterDescription(identity) || "model";
    const list = byCatalog.get(id) ?? [];
    list.push(row);
    byCatalog.set(id, list);
  }
  return byCatalog;
}

function detailsRowFromSpec(input: {
  id: string;
  name: string;
  description: string;
  spec: CustomVerificationModelSpec;
  ownerUserId: string;
  workspaceId: string | null;
  flowId: string | null;
  kind: ProductFlowKind;
  createdAt?: string;
}): KnowledgeRegionDetailsRow {
  return {
    id: input.id,
    name: input.name,
    description: input.description,
    owner_user_id: input.ownerUserId,
    workspace_id: input.workspaceId,
    subject_count: input.spec.subject_count,
    subjects: input.spec.subjects,
    created_at: input.createdAt || new Date().toISOString(),
    embedding_model_id: input.spec.embedding_model_id,
    centroid: input.spec.centroid,
    cosine_threshold: input.spec.cosine_threshold,
    mean_radius: input.spec.mean_radius,
    verify_flow_id: input.flowId,
  };
}

type LoadedSimulationCluster = {
  id: string;
  strategyId: ExplorationStrategyId;
  name: string;
};

function strategyNameFromClusterRegion(parentName: string, clusterName: string): string {
  const prefix = `${parentName} · `;
  if (clusterName.startsWith(prefix)) return clusterName.slice(prefix.length).trim();
  return clusterName;
}

async function loadOwnedSimulationParent(input: {
  ownerUserId: string;
  regionId: string;
}): Promise<{
  id: string;
  name: string;
  kind: ProductFlowKind;
  workspaceId: string | null;
  flowId: string | null;
  createdAt: string;
} | null> {
  if (!supabaseConfigured()) return null;
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("knowledge_regions")
    .select(
      "id, name, workspace_id, owner_user_id, verify_flow_id, created_at",
    )
    .eq("id", input.regionId)
    .eq("owner_user_id", input.ownerUserId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const kind: ProductFlowKind = "verification";
  const flowId = String(data.verify_flow_id || "").trim();
  return {
    id: String(data.id),
    name: String(data.name || "").trim(),
    kind,
    workspaceId: data.workspace_id ? String(data.workspace_id) : null,
    flowId: flowId || null,
    createdAt: String(data.created_at || ""),
  };
}

async function loadOwnedSimulationClusters(input: {
  ownerUserId: string;
  kind: ProductFlowKind;
  parentName: string;
}): Promise<LoadedSimulationCluster[]> {
  if (!supabaseConfigured()) return [];
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("knowledge_regions")
    .select("id, name, description, embedding_model_id")
    .eq("owner_user_id", input.ownerUserId);
  if (error) throw new Error(error.message);
  const out: LoadedSimulationCluster[] = [];
  for (const row of data || []) {
    if (!isRegionSimulationClusterRow(row)) continue;
    if (isAiUseClusterDescription(row.description)) continue;
    const name = String(row.name || "").trim();
    if (!isSimulationStrategyClusterName(input.parentName, name)) continue;
    const strategyId = parseRegionSimulationClusterStrategyId(row.description);
    const id = String(row.id || "").trim();
    if (!id || !strategyId) continue;
    out.push({ id, strategyId, name });
  }
  return out;
}

async function loadOwnedAiUseClusters(input: {
  ownerUserId: string;
  kind: ProductFlowKind;
  parentName: string;
}): Promise<LoadedSimulationCluster[]> {
  if (!supabaseConfigured()) return [];
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("knowledge_regions")
    .select("id, name, description, embedding_model_id")
    .eq("owner_user_id", input.ownerUserId);
  if (error) throw new Error(error.message);
  const out: LoadedSimulationCluster[] = [];
  for (const row of data || []) {
    if (!isAiUseClusterDescription(row.description)) continue;
    const name = String(row.name || "").trim();
    if (!isSimulationStrategyClusterName(input.parentName, name)) continue;
    const catalogId = parseAiUseCatalogIdFromClusterDescription(row.description);
    const id = String(row.id || "").trim();
    if (!id || !catalogId) continue;
    out.push({ id, strategyId: catalogId, name });
  }
  return out;
}

export async function refreshSimulationFamilyClusters(input: {
  ownerUserId: string;
  organizationId?: string | null;
  regionId: string;
  family: "exploration" | "ai_use";
  name: string;
  kind: ProductFlowKind;
  flows: readonly RegionSimulationFlowInput[];
  strategies?: readonly ExplorationStrategy[];
}): Promise<{ id: string; persisted: boolean }> {
  const flowKind = productFlowEmbeddingKind(input.kind);
  const flowIds = input.flows.map((flow) => flow.id);
  const owned = await listFlowEmbeddingsForOwner({
    ownerUserId: input.ownerUserId,
    flowKind,
  });
  const onFlows = embeddingsOnFlows(owned, flowIds);
  const humans = humanEmbeddingsForFlows(onFlows, flowIds);
  if (input.family === "ai_use") {
    const byCatalog = groupSimulatedByAiUseCatalog(onFlows);
    const existing = await loadOwnedAiUseClusters({
      ownerUserId: input.ownerUserId,
      kind: input.kind,
      parentName: input.name,
    });
    const exploration = await loadOwnedSimulationClusters({
      ownerUserId: input.ownerUserId,
      kind: input.kind,
      parentName: input.name,
    });
    const explorationRows = groupSimulatedByStrategy(
      onFlows,
      input.strategies?.length ? input.strategies : collectRegionSimulationStrategies(onFlows),
    );
    const records = await refreshRegionSimulationRecords({
      ownerUserId: input.ownerUserId,
      organizationId: input.organizationId,
      regionId: input.regionId,
      name: input.name,
      kind: input.kind,
      flows: input.flows,
      strategies: input.strategies?.length
        ? input.strategies
        : collectRegionSimulationStrategies(onFlows),
      simulatedByStrategy: explorationRows,
      humans,
      existingClusters: exploration,
    });
    await refreshAiUseClusters({
      ownerUserId: input.ownerUserId,
      organizationId: input.organizationId,
      parentId: records.id,
      name: input.name,
      kind: input.kind,
      flows: input.flows,
      byCatalog,
      existing,
    });
    return { id: records.id, persisted: records.persisted };
  }
  const strategies =
    input.strategies?.length ? input.strategies : collectRegionSimulationStrategies(onFlows);
  const existing = await loadOwnedSimulationClusters({
    ownerUserId: input.ownerUserId,
    kind: input.kind,
    parentName: input.name,
  });
  const records = await refreshRegionSimulationRecords({
    ownerUserId: input.ownerUserId,
    organizationId: input.organizationId,
    regionId: input.regionId,
    name: input.name,
    kind: input.kind,
    flows: input.flows,
    strategies,
    simulatedByStrategy: groupSimulatedByStrategy(onFlows, strategies),
    humans,
    existingClusters: existing,
  });
  const aiUseExisting = await loadOwnedAiUseClusters({
    ownerUserId: input.ownerUserId,
    kind: input.kind,
    parentName: input.name,
  });
  if (aiUseExisting.length) {
    await refreshAiUseClusters({
      ownerUserId: input.ownerUserId,
      organizationId: input.organizationId,
      parentId: records.id,
      name: input.name,
      kind: input.kind,
      flows: input.flows,
      byCatalog: groupSimulatedByAiUseCatalog(onFlows),
      existing: aiUseExisting,
    });
  }
  return { id: records.id, persisted: records.persisted };
}

async function refreshAiUseClusters(input: {
  ownerUserId: string;
  organizationId?: string | null;
  parentId: string;
  name: string;
  kind: ProductFlowKind;
  flows: readonly RegionSimulationFlowInput[];
  byCatalog: Map<string, StoredFlowEmbedding[]>;
  existing: readonly LoadedSimulationCluster[];
}): Promise<void> {
  const workspaceId = input.flows.find((flow) => flow.workspaceId)?.workspaceId || null;
  const primaryFlowId = input.flows[0]?.id || null;
  const existingById = new Map(input.existing.map((row) => [row.strategyId, row] as const));
  for (const [catalogId, rows] of input.byCatalog) {
    if (!rows.length) continue;
    const catalog = aiUseCatalogById(catalogId);
    const displayName = catalog?.displayName || catalogId;
    const clusterName = simulationClusterRegionName(input.name, displayName);
    const spec = specFromEmbeddings(clusterName, rows);
    const existing = existingById.get(catalogId);
    await persistKnowledgeRegion({
      id: existing?.id,
      ownerUserId: input.ownerUserId,
      organizationId: input.organizationId,
      workspaceId,
      name: spec.name,
      description: aiUseClusterDescription(catalogId),
      spec,
      flowId: primaryFlowId,
      createdBy: input.ownerUserId,
      kind: input.kind,
    });
  }
}

async function refreshRegionSimulationRecords(input: {
  ownerUserId: string;
  organizationId?: string | null;
  regionId: string;
  name: string;
  kind: ProductFlowKind;
  flows: readonly RegionSimulationFlowInput[];
  strategies: readonly ExplorationStrategy[];
  simulatedByStrategy: Map<ExplorationStrategyId, StoredFlowEmbedding[]>;
  humans: readonly StoredFlowEmbedding[];
  existingClusters: readonly LoadedSimulationCluster[];
  createdAt?: string;
}): Promise<{
  persisted: boolean;
  id: string;
  clusters: RegionSimulationClusterResult[];
  parentRow: KnowledgeRegionDetailsRow;
  clusterRows: KnowledgeRegionDetailsRow[];
  summary: RegionSimulationSummary;
}> {
  const remainingStrategies = input.strategies.filter(
    (strategy) => (input.simulatedByStrategy.get(strategy.id) ?? []).length > 0,
  );
  const simulated = remainingStrategies.flatMap(
    (strategy) => input.simulatedByStrategy.get(strategy.id) ?? [],
  );
  const parentRows = [...simulated, ...input.humans];
  const emptyVector = () => {
    const vector = new Array(FLOW_EMBEDDING_DIM).fill(0);
    vector[0] = 1;
    return vector;
  };
  const parentSpec = specFromEmbeddings(
    input.name,
    parentRows.length
      ? parentRows
      : [{ vector: emptyVector(), identity: input.name, id: input.regionId }],
  );
  const workspaceId = input.flows.find((flow) => flow.workspaceId)?.workspaceId || null;
  const primaryFlowId = input.flows[0]?.id || null;
  const samplesPerStrategy = remainingStrategies.length
    ? Math.max(
        ...remainingStrategies.map(
          (strategy) => (input.simulatedByStrategy.get(strategy.id) ?? []).length,
        ),
      )
    : 0;
  const summary: RegionSimulationSummary = {
    name: input.name,
    flows: input.flows.map((flow) => ({ id: flow.id, name: flow.name })),
    strategies: remainingStrategies,
    samplesPerStrategy,
    simulatedCount: simulated.length,
    realSessionCount: input.humans.length,
  };
  const parentDescription = regionSimulationParentDescription({
    flowCount: summary.flows.length,
    strategyNames: remainingStrategies.map((row) => row.name),
    samplesPerStrategy,
    realSessionCount: summary.realSessionCount,
  });
  const parent = await persistKnowledgeRegion({
    id: input.regionId,
    ownerUserId: input.ownerUserId,
    organizationId: input.organizationId,
    workspaceId,
    name: parentSpec.name,
    description: parentDescription,
    spec: parentSpec,
    flowId: primaryFlowId,
    createdBy: input.ownerUserId,
    kind: input.kind,
  });
  const parentId = parent.id || input.regionId;
  const parentRow = detailsRowFromSpec({
    id: parentId,
    name: input.name,
    description: parentDescription,
    spec: parentSpec,
    ownerUserId: input.ownerUserId,
    workspaceId,
    flowId: primaryFlowId,
    kind: input.kind,
    createdAt: input.createdAt,
  });
  const existingByStrategy = new Map(
    input.existingClusters.map((cluster) => [cluster.strategyId, cluster] as const),
  );
  const clusters: RegionSimulationClusterResult[] = [];
  const clusterRows: KnowledgeRegionDetailsRow[] = [];
  for (const strategy of remainingStrategies) {
    const rows = input.simulatedByStrategy.get(strategy.id) ?? [];
    const clusterName = simulationClusterRegionName(input.name, strategy.name);
    const spec = specFromEmbeddings(clusterName, rows);
    const description = regionSimulationClusterDescription(strategy.id);
    const existing = existingByStrategy.get(strategy.id);
    const saved = await persistKnowledgeRegion({
      id: existing?.id,
      ownerUserId: input.ownerUserId,
      organizationId: input.organizationId,
      workspaceId,
      name: spec.name,
      description,
      spec,
      flowId: primaryFlowId,
      createdBy: input.ownerUserId,
      kind: input.kind,
    });
    const clusterId = saved.id || existing?.id || `${parentId}:${strategy.id}`;
    clusters.push({
      id: clusterId,
      name: clusterName,
      strategyId: strategy.id,
      strategyName: strategy.name,
      sampleCount: rows.length,
      persisted: saved.persisted,
    });
    clusterRows.push(
      detailsRowFromSpec({
        id: clusterId,
        name: clusterName,
        description,
        spec,
        ownerUserId: input.ownerUserId,
        workspaceId,
        flowId: primaryFlowId,
        kind: input.kind,
        createdAt: input.createdAt,
      }),
    );
  }
  for (const existing of input.existingClusters) {
    if (remainingStrategies.some((strategy) => strategy.id === existing.strategyId)) continue;
    await deleteKnowledgeRegion({ id: existing.id, ownerUserId: input.ownerUserId });
  }
  return {
    persisted: parent.persisted,
    id: parentId,
    clusters,
    parentRow,
    clusterRows,
    summary,
  };
}

async function resolveRegionSimulationContext(input: {
  ownerUserId: string;
  regionId: string;
  name?: string;
  flows?: readonly RegionSimulationFlowInput[];
  kind?: ProductFlowKind;
}): Promise<{
  regionId: string;
  name: string;
  kind: ProductFlowKind;
  flows: RegionSimulationFlowInput[];
  createdAt?: string;
  existingClusters: LoadedSimulationCluster[];
}> {
  const ownerUserId = String(input.ownerUserId || "").trim();
  const regionId = String(input.regionId || "").trim();
  if (!ownerUserId) throw new Error("owner is required");
  if (!regionId) throw new Error("region is required");
  const loaded = await loadOwnedSimulationParent({ ownerUserId, regionId });
  if (supabaseConfigured() && !loaded) throw new Error("Region not found");
  const name = String(loaded?.name || input.name || "").trim();
  if (!name) throw new Error("name is required");
  const kind: ProductFlowKind = loaded?.kind || input.kind || "verification";
  const existingClusters = await loadOwnedSimulationClusters({
    ownerUserId,
    kind,
    parentName: name,
  });
  const embeddings = await listFlowEmbeddingsForOwner({
    ownerUserId,
    flowKind: productFlowEmbeddingKind(kind),
  });
  const clusterStrategies = existingClusters.map((cluster) => ({
    id: cluster.strategyId,
    name: strategyNameFromClusterRegion(name, cluster.name),
  }));
  const seedFlowId = loaded?.flowId || input.flows?.[0]?.id || "";
  const allowedFlowIds = regionSimulationFlowIds({
    seedFlowId,
    embeddings,
    strategies: clusterStrategies,
  });
  const allow = new Set(allowedFlowIds);
  let flows = input.flows?.length
    ? [...input.flows]
    : loaded?.flowId
      ? [{ id: loaded.flowId, name, workspaceId: loaded.workspaceId, problems: ["Problem"] }]
      : [];
  if (allow.size) {
    flows = flows.filter((flow) => allow.has(flow.id));
    if (!flows.length) {
      flows = allowedFlowIds.map((id) => ({
        id,
        name,
        workspaceId: loaded?.workspaceId,
        problems: ["Problem"],
      }));
    }
  }
  if (!flows.length) throw new Error("Select at least one flow");
  return {
    regionId,
    name,
    kind,
    flows,
    createdAt: loaded?.createdAt,
    existingClusters,
  };
}

export async function addRegionSimulationSamples(input: {
  ownerUserId: string;
  regionId: string;
  name?: string;
  flows?: readonly RegionSimulationFlowInput[];
  strategyIds?: readonly ExplorationStrategyId[];
  customStrategies?: unknown;
  strategies?: readonly ExplorationStrategy[];
  samplesPerStrategy: number;
  kind?: ProductFlowKind;
  onProgress?: (progress: RegionSimulationProgress[]) => void;
}): Promise<RegionSimulationMutateResult> {
  const ownerUserId = String(input.ownerUserId || "").trim();
  const ctx = await resolveRegionSimulationContext({
    ownerUserId,
    regionId: input.regionId,
    name: input.name,
    flows: input.flows,
    kind: input.kind,
  });
  const flowKind = productFlowEmbeddingKind(ctx.kind);
  const ownedForParse = await listFlowEmbeddingsForOwner({
    ownerUserId,
    flowKind: productFlowEmbeddingKind(ctx.kind),
  });
  const adding = input.strategies?.length
    ? [...input.strategies]
    : parseSimulationStrategiesWithRecovered({
        strategyIds: input.strategyIds,
        customStrategies: input.customStrategies,
        embeddings: ownedForParse,
      });
  if (!adding.length) throw new Error("Select at least one exploration strategy");
  const samplesPerStrategy = clampSamplesPerStrategy(input.samplesPerStrategy);
  const flowIds = ctx.flows.map((flow) => flow.id);
  const owned = await listFlowEmbeddingsForOwner({ ownerUserId, flowKind });
  const onFlows = embeddingsOnFlows(owned, flowIds);
  const existingSimulated = onFlows.filter((row) => isSimulatedEmbedding(row));
  const recovered = strategiesFromSimulatedEmbeddings(existingSimulated);
  const startIndexByStrategy: Record<string, number> = {};
  for (const strategy of adding) {
    startIndexByStrategy[strategy.id] = existingSimulated.filter((row) =>
      simulatedEmbeddingMatchesStrategy(row, strategy),
    ).length;
  }
  const problemsByFlowId: Record<string, readonly string[]> = {};
  for (const flow of ctx.flows) problemsByFlowId[flow.id] = flow.problems;
  const plans = planRegionSimulationSamples({
    flowIds,
    problemsByFlowId,
    strategyIds: adding.map((strategy) => strategy.id),
    samplesPerStrategy,
    startIndexByStrategy,
  });
  const progress = emptySimulationProgress(adding, samplesPerStrategy);
  const addedSampleIds: string[] = [];
  for (const plan of plans) {
    const strategy = adding.find((row) => row.id === plan.strategyId);
    if (!strategy) throw new Error(`Unknown exploration strategy: ${plan.strategyId}`);
    const flow = ctx.flows.find((row) => row.id === plan.flowId);
    const walk = await walkSimulationPlan(plan, flowKind, adding, flow);
    const stored = await persistRegionSimulationSample({
      ownerUserId,
      workspaceId: flow?.workspaceId || undefined,
      flowKind,
      flowId: plan.flowId,
      runId: simulationSampleRunId(plan),
      identity: simulatedIdentityLabel(strategy.name),
      family: "exploration",
      model: walk.model,
      sequence: walk.sequence,
      pow: walk.pow,
    });
    addedSampleIds.push(stored.id);
    const row = progress.find((item) => item.strategyId === plan.strategyId);
    if (row) row.done += 1;
    input.onProgress?.(progress.map((item) => ({ ...item })));
  }

  const refreshed = await listFlowEmbeddingsForOwner({ ownerUserId, flowKind });
  const onFlowsAfter = embeddingsOnFlows(refreshed, flowIds);
  const allStrategies = mergeExplorationStrategies([recovered, adding]);
  const simulatedByStrategy = groupSimulatedByStrategy(onFlowsAfter, allStrategies);
  const humans = humanEmbeddingsForFlows(onFlowsAfter, flowIds);
  const records = await refreshRegionSimulationRecords({
    ownerUserId,
    regionId: ctx.regionId,
    name: ctx.name,
    kind: ctx.kind,
    flows: ctx.flows,
    strategies: allStrategies,
    simulatedByStrategy,
    humans,
    existingClusters: ctx.existingClusters,
    createdAt: ctx.createdAt,
  });
  return {
    persisted: records.persisted,
    id: records.id,
    regionPath: simulationDetailsPath(ctx.kind, records.id),
    parentName: ctx.name,
    clusters: records.clusters,
    summary: records.summary,
    progress,
    parentRow: records.parentRow,
    clusterRows: records.clusterRows,
    addedSampleIds,
    removedSampleIds: [],
  };
}

export async function trashRegionSimulation(input: {
  ownerUserId: string;
  regionId: string;
}): Promise<{ id: string; deletedIds: string[] }> {
  const ownerUserId = String(input.ownerUserId || "").trim();
  const regionId = String(input.regionId || "").trim();
  if (!ownerUserId || !regionId) throw new Error("region is required");
  const loaded = await loadOwnedSimulationParent({ ownerUserId, regionId });
  if (supabaseConfigured() && !loaded) throw new Error("Region not found");
  if (!loaded) return { id: regionId, deletedIds: [regionId] };
  const clusters = await loadOwnedSimulationClusters({
    ownerUserId,
    kind: loaded.kind,
    parentName: loaded.name,
  });
  const names = new Set<string>([loaded.name, ...clusters.map((cluster) => cluster.name)]);
  for (const name of [...names]) {
    for (const companion of pathTextRegionCompanionNames(name)) names.add(companion);
  }
  const deletedIds = new Set<string>([loaded.id, ...clusters.map((cluster) => cluster.id)]);
  if (supabaseConfigured()) {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("knowledge_regions")
      .select("id, name")
      .eq("owner_user_id", ownerUserId)
      .eq("product", loaded.kind);
    if (error) throw new Error(error.message);
    for (const row of data || []) {
      const id = String(row.id || "").trim();
      const name = String(row.name || "").trim();
      if (id && names.has(name)) deletedIds.add(id);
    }
    for (const id of deletedIds) {
      await deleteKnowledgeRegion({ id, ownerUserId });
    }
  }
  return { id: regionId, deletedIds: [...deletedIds] };
}

export async function removeRegionSimulationSamples(input: {
  ownerUserId: string;
  regionId: string;
  name?: string;
  flows?: readonly RegionSimulationFlowInput[];
  kind?: ProductFlowKind;
  sampleIds?: readonly string[];
  strategyIds?: readonly string[];
}): Promise<RegionSimulationMutateResult> {
  const ownerUserId = String(input.ownerUserId || "").trim();
  const ctx = await resolveRegionSimulationContext({
    ownerUserId,
    regionId: input.regionId,
    name: input.name,
    flows: input.flows,
    kind: input.kind,
  });
  const sampleIds = (input.sampleIds ?? []).map((id) => String(id || "").trim()).filter(Boolean);
  const strategyIds = (input.strategyIds ?? []).map((id) => String(id || "").trim()).filter(Boolean);
  if (!sampleIds.length && !strategyIds.length) {
    throw new Error("Select simulated samples or a strategy to remove");
  }
  const flowKind = productFlowEmbeddingKind(ctx.kind);
  const flowIds = ctx.flows.map((flow) => flow.id);
  const owned = await listFlowEmbeddingsForOwner({ ownerUserId, flowKind });
  const onFlows = embeddingsOnFlows(owned, flowIds);
  const existingSimulated = onFlows.filter((row) => isSimulatedEmbedding(row));
  const recovered = strategiesFromSimulatedEmbeddings(existingSimulated);
  const toDelete = new Set<string>();
  for (const id of sampleIds) {
    const row = existingSimulated.find((item) => item.id === id);
    if (row) toDelete.add(id);
  }
  for (const strategyId of strategyIds) {
    const recoveredStrategy = recovered.find((item) => item.id === strategyId);
    const cluster = ctx.existingClusters.find((item) => item.strategyId === strategyId);
    const strategyName =
      recoveredStrategy?.name ||
      (cluster ? strategyNameFromClusterRegion(ctx.name, cluster.name) : "");
    const matcher = recoveredStrategy ?? {
      id: strategyId,
      name: strategyName || strategyId,
    };
    for (const row of existingSimulated) {
      if (simulatedEmbeddingMatchesStrategy(row, matcher)) toDelete.add(row.id);
    }
  }
  const removedSampleIds = [...toDelete];
  if (removedSampleIds.length) {
    await deleteFlowEmbeddings({ ownerUserId, ids: removedSampleIds });
  }

  const refreshed = await listFlowEmbeddingsForOwner({ ownerUserId, flowKind });
  const onFlowsAfter = embeddingsOnFlows(refreshed, flowIds);
  const remainingSimulated = onFlowsAfter.filter((row) => isSimulatedEmbedding(row));
  const remainingStrategies = mergeExplorationStrategies([
    recovered,
    ctx.existingClusters.map((cluster) => ({
      id: cluster.strategyId,
      name: strategyNameFromClusterRegion(ctx.name, cluster.name),
      description: "",
      instructions: "",
      params: { maxSteps: 3, prefer: "balanced" as const, commitAfter: 1 },
    })),
  ]).filter((strategy) =>
    remainingSimulated.some((row) => simulatedEmbeddingMatchesStrategy(row, strategy)),
  );
  const simulatedByStrategy = groupSimulatedByStrategy(remainingSimulated, remainingStrategies);
  const humans = humanEmbeddingsForFlows(onFlowsAfter, flowIds);
  const records = await refreshRegionSimulationRecords({
    ownerUserId,
    regionId: ctx.regionId,
    name: ctx.name,
    kind: ctx.kind,
    flows: ctx.flows,
    strategies: remainingStrategies,
    simulatedByStrategy,
    humans,
    existingClusters: ctx.existingClusters,
    createdAt: ctx.createdAt,
  });
  return {
    persisted: records.persisted,
    id: records.id,
    regionPath: simulationDetailsPath(ctx.kind, records.id),
    parentName: ctx.name,
    clusters: records.clusters,
    summary: records.summary,
    progress: emptySimulationProgress(remainingStrategies, records.summary.samplesPerStrategy || 3),
    parentRow: records.parentRow,
    clusterRows: records.clusterRows,
    addedSampleIds: [],
    removedSampleIds,
  };
}
