/**
 * Run a knowledge-region simulation: persist labelled simulated embeddings,
 * optionally overlay real human embeddings from the same verification flows,
 * and save a parent region plus one named cluster per strategy.
 */

import {
  buildVoiceRegionFromFlowRaws,
} from "@/lib/verification-flow";
import {
  createCustomVerificationModelFromVectors,
  type CustomVerificationModelSpec,
} from "@/lib/knowledge-config/custom-verification-model";
import { FLOW_EMBEDDING_MODEL_ID } from "@/lib/flow-embedding";
import {
  listFlowEmbeddingsForOwner,
  persistCompletedFlowEmbedding,
  type StoredFlowEmbedding,
} from "@/lib/flow-embedding-store";
import { productRegionPagePath } from "@/lib/product-flow";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  clampSamplesPerStrategy,
  emptySimulationProgress,
  explorationStrategyById,
  isSimulatedEmbedding,
  planRegionSimulationSamples,
  REGION_SIMULATION_SOURCE,
  runRegionSimulationSample,
  simulatedIdentityLabel,
  simulationClusterRegionName,
  simulationSampleRunId,
  type ExplorationStrategyId,
  type RegionSimulationProgress,
  type RegionSimulationSamplePlan,
} from "@/lib/region-simulation";
import type { VerificationFlow } from "@/lib/verification-flow";

export type RegionSimulationFlowInput = {
  id: string;
  name: string;
  workspaceId?: string | null;
  problems: readonly string[];
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

function supabaseConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
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
  rows: readonly { vector: number[]; identity?: string | null; id?: string }[],
): CustomVerificationModelSpec {
  return createCustomVerificationModelFromVectors({
    name,
    vectors: rows.map((row) => row.vector),
    subjects: rows.map((row) => ({
      label: row.identity || row.id || name,
    })),
    embedding_model_id: FLOW_EMBEDDING_MODEL_ID,
  });
}

async function persistKnowledgeRegion(input: {
  ownerUserId: string;
  workspaceId: string | null;
  name: string;
  description: string;
  spec: CustomVerificationModelSpec;
  flowId: string | null;
  createdBy: string;
}): Promise<{ persisted: boolean; id: string | null }> {
  if (!supabaseConfigured()) {
    return { persisted: false, id: null };
  }
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("knowledge_regions")
    .insert({
      workspace_id: input.workspaceId,
      owner_user_id: input.ownerUserId,
      product: "verification",
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
      created_by: input.createdBy,
      updated_at: new Date().toISOString(),
      verify_flow_id: input.flowId,
    })
    .select("id")
    .maybeSingle();
  if (error || !data?.id) {
    throw new Error(error?.message || "Failed to create knowledge region");
  }
  return { persisted: true, id: String(data.id) };
}

async function persistPathTextCompanion(input: {
  ownerUserId: string;
  workspaceId: string | null;
  name: string;
  description: string;
  embeddings: readonly { raw?: unknown }[];
  flowId: string | null;
  createdBy: string;
}): Promise<void> {
  try {
    const voiceSpec = buildVoiceRegionFromFlowRaws({
      name: input.name,
      embeddings: input.embeddings,
    });
    if (!voiceSpec) return;
    await persistKnowledgeRegion({
      ...input,
      name: voiceSpec.name,
      spec: voiceSpec,
    });
  } catch {
    /* Path region is already saved. */
  }
}

export async function runRegionSimulation(input: {
  ownerUserId: string;
  name: string;
  flows: readonly RegionSimulationFlowInput[];
  strategyIds: readonly ExplorationStrategyId[];
  samplesPerStrategy: number;
  includeHumanData: boolean;
  onProgress?: (progress: RegionSimulationProgress[]) => void;
}): Promise<RegionSimulationRunResult> {
  const ownerUserId = String(input.ownerUserId || "").trim();
  const name = String(input.name || "").trim();
  if (!ownerUserId) throw new Error("owner is required");
  if (!name) throw new Error("name is required");
  if (!input.flows.length) throw new Error("Select at least one verification flow");
  if (!input.strategyIds.length) throw new Error("Select at least one exploration strategy");
  const samplesPerStrategy = clampSamplesPerStrategy(input.samplesPerStrategy);

  const flowIds = input.flows.map((flow) => flow.id);
  const problemsByFlowId: Record<string, readonly string[]> = {};
  for (const flow of input.flows) {
    problemsByFlowId[flow.id] = flow.problems;
  }
  const plans = planRegionSimulationSamples({
    flowIds,
    problemsByFlowId,
    strategyIds: input.strategyIds,
    samplesPerStrategy,
  });
  const progress = emptySimulationProgress(input.strategyIds, samplesPerStrategy);
  const byStrategy = new Map<ExplorationStrategyId, StoredFlowEmbedding[]>();
  for (const strategyId of input.strategyIds) {
    byStrategy.set(strategyId, []);
  }

  const simulated: StoredFlowEmbedding[] = [];
  for (const plan of plans) {
    const walk = runRegionSimulationSample(plan);
    const strategy = explorationStrategyById(plan.strategyId)!;
    const flow = input.flows.find((row) => row.id === plan.flowId);
    const stored = await persistCompletedFlowEmbedding({
      ownerUserId,
      workspaceId: flow?.workspaceId || undefined,
      flowKind: "verify",
      flowId: plan.flowId,
      runId: simulationSampleRunId(plan),
      identity: simulatedIdentityLabel(strategy.name),
      source: REGION_SIMULATION_SOURCE,
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
      flowKind: "verify",
    });
    humans = humanEmbeddingsForFlows(owned, flowIds);
  }

  const parentRows = [...simulated, ...humans];
  const parentSpec = specFromEmbeddings(name, parentRows);
  const workspaceId = input.flows.find((flow) => flow.workspaceId)?.workspaceId || null;
  const primaryFlowId = flowIds[0] || null;
  const strategies = input.strategyIds.map((id) => {
    const strategy = explorationStrategyById(id)!;
    return { id, name: strategy.name };
  });
  const summary: RegionSimulationSummary = {
    name,
    flows: input.flows.map((flow) => ({ id: flow.id, name: flow.name })),
    strategies,
    samplesPerStrategy,
    simulatedCount: simulated.length,
    realSessionCount: humans.length,
  };
  const parentDescription = `region-simulation: ${summary.flows.length} flows · ${strategies.map((row) => row.name).join(", ")} · ${summary.samplesPerStrategy}/strategy · ${summary.realSessionCount} real`;

  const parent = await persistKnowledgeRegion({
    ownerUserId,
    workspaceId,
    name: parentSpec.name,
    description: parentDescription,
    spec: parentSpec,
    flowId: primaryFlowId,
    createdBy: ownerUserId,
  });
  await persistPathTextCompanion({
    ownerUserId,
    workspaceId,
    name,
    description: parentDescription,
    embeddings: parentRows,
    flowId: primaryFlowId,
    createdBy: ownerUserId,
  });

  const clusters: RegionSimulationClusterResult[] = [];
  for (const strategyId of input.strategyIds) {
    const strategy = explorationStrategyById(strategyId)!;
    const rows = byStrategy.get(strategyId) ?? [];
    if (!rows.length) continue;
    const clusterName = simulationClusterRegionName(name, strategy.name);
    const spec = specFromEmbeddings(clusterName, rows);
    const description = `region-simulation-cluster:${strategyId}`;
    const saved = await persistKnowledgeRegion({
      ownerUserId,
      workspaceId,
      name: spec.name,
      description,
      spec,
      flowId: primaryFlowId,
      createdBy: ownerUserId,
    });
    await persistPathTextCompanion({
      ownerUserId,
      workspaceId,
      name: clusterName,
      description,
      embeddings: rows,
      flowId: primaryFlowId,
      createdBy: ownerUserId,
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
    regionPath: productRegionPagePath("verification", parent.id || ""),
    parentName: name,
    clusters,
    summary,
    progress,
  };
}

export function problemsForVerificationFlow(flow: Pick<VerificationFlow, "questions" | "topic" | "name">): string[] {
  const questions = (flow.questions ?? [])
    .map((item) => (typeof item === "string" ? item : item.text))
    .map((item) => String(item || "").trim())
    .filter(Boolean);
  if (questions.length) return questions;
  const topic = String(flow.topic || "").trim();
  if (topic) return [topic];
  const name = String(flow.name || "").trim();
  return name ? [name] : ["Problem"];
}

export type { RegionSimulationSamplePlan };
