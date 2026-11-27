/**
 * Public agent Knowledge Region CRUD — same store as cookie
 * `/api/dashboard/knowledge-regions` and the region-simulation wizard.
 */

import { OPENROUTER_ORG_KEY_MISSING } from "@/lib/ai/openrouter";
import { FLOW_EMBEDDING_PATH_TEXT_MODEL_ID } from "@/lib/flow-embedding";
import { listFlowEmbeddingsForOwner } from "@/lib/flow-embedding-store";
import {
  loadStoredRecordBodies,
  presentStoredRecord,
  RECORD_HYDRATE_MAX_BYTES,
  type StoredRecordView,
} from "@/lib/behavior-record";
import {
  DASHBOARD_KNOWLEDGE_REGION_FILE_PATH,
  extractStudioSpeechTranscripts,
  extractStudioTranscripts,
  flowPowFromWorkspaceRow,
  type DataStudioEmbeddingRow,
} from "@/lib/data-studio-view";
import {
  presentDashboardKnowledgeRegions,
  type DashboardKnowledgeRegion,
} from "@/lib/dashboard-knowledge-regions";
import {
  isRegionSimulationClusterRow,
  parseRegionSimulationClusterStrategyId,
  presentKnowledgeRegionDetails,
  type KnowledgeRegionDetails,
} from "@/lib/knowledge-region-details";
import { isMissingOrganizationIdColumn } from "@/lib/organization/membership";
import {
  getOrgScopedFileContentResponse,
  organizationIdFromUser,
  organizationIdFromWorkspace,
} from "@/lib/organization/org-xai-files";
import { loadOpenRouterApiKeyForOwnerUser } from "@/lib/organization/org-backend-runtime";
import { flowOwnedByUser, productFlowEmbeddingKind } from "@/lib/product-flow";
import {
  clampSamplesPerStrategy,
  EXPLORATION_STRATEGIES,
  isSimulatedEmbedding,
  parseSimulationStrategies,
  parseSimulationStrategiesWithRecovered,
  protocolIdsFromRequestBody,
  REGION_SIMULATION_DEFAULT_SAMPLES,
  REGION_SIMULATION_MAX_SAMPLES,
  REGION_SIMULATION_MIN_SAMPLES,
  REGION_SIMULATION_WIZARD_STEPS,
  isSimulationStrategyClusterName,
  regionSimulationFlowIds,
} from "@/lib/region-simulation";
import {
  AI_USE_DEFAULT_CHECKED,
  clampSamplesPerAiUse,
  parseAiUseCatalogIds,
  publicAiUseCatalog,
  REGION_SIMULATION_DEFAULT_SAMPLES_PER_AI_USE,
  REGION_SIMULATION_MAX_SAMPLES_PER_AI_USE,
  REGION_SIMULATION_MIN_SAMPLES_PER_AI_USE,
} from "@/lib/region-simulation-ai-use-catalog";
import { regionSimulationJobsEnabled } from "@/lib/region-simulation-flags";
import {
  enqueueRegionSimulation,
  getRegionSimulationJob,
  jobsPublicPayload,
  tickRegionSimulationJob,
  type RegionSimulationJobRow,
  type TickResult,
} from "@/lib/region-simulation-jobs";
import { applyProofOfWorkRunIdFilter } from "@/lib/region-simulation-persist";
import {
  addRegionSimulationSamples,
  problemsForSimulationFlow,
  runRegionSimulation,
  trashRegionSimulation,
} from "@/lib/region-simulation-run";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getVerificationFlowById,
  listVerificationFlowsForDashboard,
  listVerificationResultsForFlowId,
} from "@/lib/verification-flow-repository";

const REGION_LIST_SELECT =
  "id, workspace_id, owner_user_id, organization_id, name, description, subject_count, created_at, embedding_model_id";
const REGION_DETAIL_SELECT =
  "id, workspace_id, owner_user_id, organization_id, name, description, subject_count, subjects, created_at, embedding_model_id, centroid, cosine_threshold, mean_radius, verify_flow_id";
const FLOW_TABLE = "verify_flows";
const POW_SELECT =
  "proof_of_work_type, tool_name, tool_action, timestamp_ms, metadata, file_name, session_id, xai_file_id, mime_type, file_size";

export type PresentedAgentKnowledgeRegion = {
  id: string;
  name: string;
  description: string | null;
  workspace_id: string;
  subject_count: number;
  created_at: string;
};

export type PresentedAgentKnowledgeRegionCluster = {
  id: string;
  name: string;
  strategy_id: string | null;
  strategy_name: string;
  sample_count: number;
};

export type PresentedAgentKnowledgeRegionSample = {
  id: string;
  identity: string | null;
  origin: string;
  point_kind: string;
  flow_id: string | null;
  run_id: string | null;
  workspace_id: string | null;
  source: string | null;
  cluster_id: string | null;
  strategy_id: string | null;
  strategy_name: string | null;
};

export type PresentedAgentKnowledgeRegionDetails = {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  subject_count: number;
  workspace_id: string;
  protocols: Array<{ id: string; name: string }>;
  strategies: Array<{ id: string; name: string }>;
  samples_per_strategy: number;
  simulated_count: number;
  cohort_count: number;
  analysis_count: number;
  real_session_count: number;
  clusters: PresentedAgentKnowledgeRegionCluster[];
  ai_use_clusters: PresentedAgentKnowledgeRegionCluster[];
  samples: PresentedAgentKnowledgeRegionSample[];
};

export type PresentedAgentSimulationJob = {
  type: "job";
  job_id: string;
  family: string;
  status: string;
  knowledge_region_id: string | null;
  follow_up_job_id: string | null;
  exploration_job_id?: string;
  ai_use_job_id?: string | null;
  pending_ai_use_catalog_ids?: string[];
  progress: unknown;
  cost_usd: number | null;
  error: string | null;
  plan_cursor: number;
  plan_length: number;
};

export type AgentSimulationSchedule = {
  jobId: string;
  shouldContinue: boolean;
  followUpJobId: string | null;
};

export type AgentKnowledgeRegionCreateResult =
  | { kind: "job"; job: PresentedAgentSimulationJob; schedule: AgentSimulationSchedule }
  | { kind: "result"; knowledge_region_id: string | null; persisted: boolean };

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function presentListed(row: DashboardKnowledgeRegion): PresentedAgentKnowledgeRegion {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    workspace_id: row.workspaceId,
    subject_count: row.subjectCount,
    created_at: row.createdAt,
  };
}

function presentCluster(row: KnowledgeRegionDetails["clusters"][number]): PresentedAgentKnowledgeRegionCluster {
  return {
    id: row.id,
    name: row.name,
    strategy_id: row.strategyId,
    strategy_name: row.strategyName,
    sample_count: row.sampleCount,
  };
}

export function presentAgentKnowledgeRegionDetails(
  details: KnowledgeRegionDetails,
): PresentedAgentKnowledgeRegionDetails {
  return {
    id: details.id,
    name: details.name,
    description: details.description,
    created_at: details.createdAt,
    subject_count: details.subjectCount,
    workspace_id: details.workspaceId,
    protocols: details.flows.map((flow) => ({ id: flow.id, name: flow.name })),
    strategies: details.strategies.map((strategy) => ({ id: strategy.id, name: strategy.name })),
    samples_per_strategy: details.samplesPerStrategy,
    simulated_count: details.simulatedCount,
    cohort_count: details.cohortCount,
    analysis_count: details.analysisCount,
    real_session_count: details.realSessionCount,
    clusters: details.clusters.map(presentCluster),
    ai_use_clusters: details.aiUseClusters.map(presentCluster),
    samples: details.samples.map((sample) => ({
      id: sample.id,
      identity: sample.identity,
      origin: sample.origin,
      point_kind: sample.pointKind,
      flow_id: sample.flow_id,
      run_id: sample.run_id,
      workspace_id: sample.workspace_id,
      source: sample.source,
      cluster_id: sample.clusterId,
      strategy_id: sample.strategyId,
      strategy_name: sample.strategyName,
    })),
  };
}

export function presentAgentSimulationJob(
  job: RegionSimulationJobRow,
  extra?: {
    explorationJobId?: string;
    aiUseJobId?: string | null;
    pendingAiUseCatalogIds?: string[];
  },
): PresentedAgentSimulationJob {
  const payload = jobsPublicPayload(job);
  return {
    type: "job",
    job_id: String(payload.jobId || job.id),
    family: String(payload.family || job.family),
    status: String(payload.status || job.status),
    knowledge_region_id: payload.regionId ? String(payload.regionId) : job.region_id,
    follow_up_job_id: payload.followUpJobId ? String(payload.followUpJobId) : job.follow_up_job_id,
    ...(extra?.explorationJobId ? { exploration_job_id: extra.explorationJobId } : {}),
    ...(extra && "aiUseJobId" in extra ? { ai_use_job_id: extra.aiUseJobId || null } : {}),
    ...(extra?.pendingAiUseCatalogIds
      ? { pending_ai_use_catalog_ids: extra.pendingAiUseCatalogIds }
      : {}),
    progress: payload.progress,
    cost_usd: typeof payload.costUsd === "number" ? payload.costUsd : job.cost_usd,
    error: payload.error ? String(payload.error) : job.error,
    plan_cursor: Number(payload.planCursor ?? job.plan_cursor) || 0,
    plan_length: Number(payload.planLength ?? job.plan.items.length) || 0,
  };
}

function parseWizardBody(body: Record<string, unknown>) {
  return {
    name: text(body.name),
    protocolIds: protocolIdsFromRequestBody(body),
    strategies: parseSimulationStrategies({
      strategyIds: body.strategy_ids ?? body.strategyIds,
      customStrategies: body.custom_strategies ?? body.customStrategies,
    }),
    samplesPerStrategy: clampSamplesPerStrategy(
      body.samples_per_strategy ?? body.samplesPerStrategy,
    ),
    includeHumanData: body.include_human_data === true || body.includeHumanData === true,
    aiUseCatalogIds: parseAiUseCatalogIds(body.ai_use_catalog_ids ?? body.aiUseCatalogIds),
    samplesPerAiUse: clampSamplesPerAiUse(body.samples_per_ai_use ?? body.samplesPerAiUse),
  };
}

async function realSessionCountForFlow(input: {
  flowId: string;
  embeddings: readonly { flow_id?: string | null; source?: string | null; identity?: string | null }[];
}): Promise<number> {
  const fromEmbeddings = input.embeddings.filter(
    (row) => String(row.flow_id || "") === input.flowId && !isSimulatedEmbedding(row),
  ).length;
  if (fromEmbeddings > 0) return fromEmbeddings;
  const results = await listVerificationResultsForFlowId(input.flowId);
  return results.filter((row) => row.source !== "skill" || Boolean(row.identity)).length;
}

async function ownedSimulationFlow(
  flowId: string,
  userId: string,
  organizationId?: string | null,
) {
  const flow = await getVerificationFlowById(flowId);
  if (!flow) return null;
  const org = text(organizationId);
  const inOrg = org && text(flow.organizationId) === org;
  if (!flowOwnedByUser(flow, userId) && !inOrg) return null;
  return {
    id: flow.id,
    name: flow.name,
    workspaceId: flow.workspaceId || null,
    problems: problemsForSimulationFlow(flow),
    answersModelSeed: flow.answersModelSeed ?? null,
  };
}

async function flowNamesForIds(ids: string[]): Promise<Record<string, string>> {
  const unique = [...new Set(ids.map((id) => text(id)).filter(Boolean))];
  if (!unique.length) return {};
  const admin = createAdminClient();
  const { data } = await admin.from(FLOW_TABLE).select("id, name").in("id", unique);
  const names: Record<string, string> = {};
  for (const row of data || []) {
    const id = text(row.id);
    const name = text(row.name);
    if (id && name) names[id] = name;
  }
  return names;
}

export async function listAgentKnowledgeRegions(
  ownerUserId: string,
  organizationId: string,
): Promise<PresentedAgentKnowledgeRegion[]> {
  const userId = text(ownerUserId);
  if (!userId) return [];
  const admin = createAdminClient();
  let listed = organizationId
    ? await admin
        .from("knowledge_regions")
        .select(REGION_LIST_SELECT)
        .eq("organization_id", organizationId)
        .order("created_at", { ascending: false })
    : await admin
        .from("knowledge_regions")
        .select(REGION_LIST_SELECT)
        .eq("owner_user_id", userId)
        .order("created_at", { ascending: false });
  if (listed.error && organizationId && isMissingOrganizationIdColumn(listed.error)) {
    listed = await admin
      .from("knowledge_regions")
      .select(REGION_LIST_SELECT)
      .eq("owner_user_id", userId)
      .order("created_at", { ascending: false });
  }
  if (listed.error) return [];
  const ownerFilter = organizationId ? null : userId;
  return presentDashboardKnowledgeRegions(listed.data || [], ownerFilter).map(presentListed);
}

async function loadAccessibleRegionRow(
  ownerUserId: string,
  regionId: string,
  organizationId: string,
) {
  const userId = text(ownerUserId);
  const id = text(regionId);
  const requestedOrg = text(organizationId);
  if (!userId || !id || !requestedOrg) return null;
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("knowledge_regions")
    .select(REGION_DETAIL_SELECT)
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return null;
  if (String(data.embedding_model_id || "") === FLOW_EMBEDDING_PATH_TEXT_MODEL_ID) return null;
  if (String(data.description || "").includes("region-simulation-cluster:")) return null;
  const org = text(data.organization_id);
  const owner = text(data.owner_user_id);
  if (org && org === requestedOrg) return data;
  if (!org && owner === userId) return data;
  return null;
}

export async function getAgentKnowledgeRegion(
  ownerUserId: string,
  regionId: string,
  organizationId: string,
): Promise<{
  knowledge_region: PresentedAgentKnowledgeRegion;
  details: PresentedAgentKnowledgeRegionDetails;
} | null> {
  const row = await loadAccessibleRegionRow(ownerUserId, regionId, organizationId);
  if (!row) return null;
  const presented = presentDashboardKnowledgeRegions([row], null)[0];
  if (!presented) return null;
  const admin = createAdminClient();
  let siblings = organizationId
    ? await admin
        .from("knowledge_regions")
        .select(
          "id, name, description, owner_user_id, embedding_model_id, centroid, cosine_threshold, mean_radius, subject_count",
        )
        .eq("organization_id", organizationId)
    : await admin
        .from("knowledge_regions")
        .select(
          "id, name, description, owner_user_id, embedding_model_id, centroid, cosine_threshold, mean_radius, subject_count",
        )
        .eq("owner_user_id", ownerUserId);
  if (siblings.error && organizationId && isMissingOrganizationIdColumn(siblings.error)) {
    siblings = await admin
      .from("knowledge_regions")
      .select(
        "id, name, description, owner_user_id, embedding_model_id, centroid, cosine_threshold, mean_radius, subject_count",
      )
      .eq("owner_user_id", ownerUserId);
  }
  const stored = await listFlowEmbeddingsForOwner({
    ownerUserId: text(row.owner_user_id) || ownerUserId,
    flowKind: productFlowEmbeddingKind(),
  });
  const embeddings: DataStudioEmbeddingRow[] = stored.map((item) => ({
    id: item.id,
    workspace_id: item.workspace_id,
    owner_user_id: item.owner_user_id,
    flow_kind: item.flow_kind,
    flow_id: item.flow_id,
    run_id: item.run_id,
    identity: item.identity,
    vector: item.vector,
    raw: item.raw,
    embedding_model_id: item.embedding_model_id,
    created_at: item.created_at,
    source: item.source,
  }));
  const seedFlowId = text(row.verify_flow_id);
  const flowIds = [
    seedFlowId,
    ...embeddings.map((item) => text(item.flow_id)),
  ].filter(Boolean);
  const flowNames = await flowNamesForIds(flowIds);
  const details = presentKnowledgeRegionDetails({
    parent: row,
    clusters: siblings.data || [],
    embeddings,
    flowNames,
  });
  if (!details) return null;
  return {
    knowledge_region: presentListed(presented),
    details: presentAgentKnowledgeRegionDetails(details),
  };
}

export async function listAgentKnowledgeRegionOptions(
  ownerUserId: string,
  organizationId: string,
) {
  const userId = text(ownerUserId);
  if (!userId) throw new Error("Not authenticated");
  let embeddings: Awaited<ReturnType<typeof listFlowEmbeddingsForOwner>> = [];
  try {
    embeddings = await listFlowEmbeddingsForOwner({
      ownerUserId: userId,
      flowKind: productFlowEmbeddingKind(),
    });
  } catch {
    embeddings = [];
  }
  const flows = await listVerificationFlowsForDashboard({
    ownerUserId: userId,
    organizationId,
  });
  const protocols = [];
  for (const flow of flows) {
    protocols.push({
      id: flow.id,
      name: flow.name,
      challenge: flow.topic,
      question_count: Math.max(1, problemsForSimulationFlow(flow).length),
      real_session_count: await realSessionCountForFlow({
        flowId: flow.id,
        embeddings,
      }),
    });
  }
  return {
    wizard_steps: [...REGION_SIMULATION_WIZARD_STEPS],
    strategies: EXPLORATION_STRATEGIES.map((strategy) => ({
      id: strategy.id,
      name: strategy.name,
      description: strategy.description,
    })),
    default_samples_per_strategy: REGION_SIMULATION_DEFAULT_SAMPLES,
    min_samples_per_strategy: REGION_SIMULATION_MIN_SAMPLES,
    max_samples_per_strategy: REGION_SIMULATION_MAX_SAMPLES,
    ai_use_catalog: publicAiUseCatalog().map((row) => ({
      id: row.id,
      display_name: row.displayName,
      thinking_label: row.thinkingLabel,
      image_input: row.imageInput,
      training: row.training,
    })),
    default_checked: [...AI_USE_DEFAULT_CHECKED],
    default_samples_per_ai_use: REGION_SIMULATION_DEFAULT_SAMPLES_PER_AI_USE,
    min_samples_per_ai_use: REGION_SIMULATION_MIN_SAMPLES_PER_AI_USE,
    max_samples_per_ai_use: REGION_SIMULATION_MAX_SAMPLES_PER_AI_USE,
    protocols,
  };
}

function scheduleFromTick(jobId: string, ticked: TickResult): AgentSimulationSchedule {
  return {
    jobId,
    shouldContinue: ticked.shouldContinue,
    followUpJobId: ticked.followUpJobId,
  };
}

export async function createAgentKnowledgeRegion(
  ownerUserId: string,
  body: Record<string, unknown>,
  organizationId: string,
): Promise<AgentKnowledgeRegionCreateResult> {
  const userId = text(ownerUserId);
  if (!userId) throw new Error("Not authenticated");
  const parsed = parseWizardBody(body);
  if (!parsed.name) throw new Error("name is required");
  if (!parsed.protocolIds.length) throw new Error("Select at least one protocol");
  if (!parsed.strategies.length) throw new Error("Select at least one exploration strategy");
  if (parsed.aiUseCatalogIds.length) {
    const openRouterKey = await loadOpenRouterApiKeyForOwnerUser(userId);
    if (!openRouterKey) throw new Error(OPENROUTER_ORG_KEY_MISSING);
  }
  const selectedFlows = parsed.aiUseCatalogIds.length
    ? parsed.protocolIds.slice(0, 1)
    : parsed.protocolIds;
  const flows = [];
  for (const flowId of selectedFlows) {
    const flow = await ownedSimulationFlow(flowId, userId, organizationId);
    if (!flow) throw new Error("Protocol not found");
    flows.push(flow);
  }
  if (regionSimulationJobsEnabled()) {
    const job = await enqueueRegionSimulation({
      ownerUserId: userId,
      organizationId,
      family: "exploration",
      name: parsed.name,
      kind: "verification",
      flows,
      strategies: parsed.strategies,
      samplesPerStrategy: parsed.samplesPerStrategy,
      includeHumanData: parsed.includeHumanData,
      followUp: parsed.aiUseCatalogIds.length
        ? {
            family: "ai_use",
            catalogIds: parsed.aiUseCatalogIds,
            samplesPerAiUse: parsed.samplesPerAiUse,
          }
        : null,
    });
    const ticked = await tickRegionSimulationJob(job.id);
    return {
      kind: "job",
      job: presentAgentSimulationJob(ticked.job, {
        explorationJobId: job.id,
        aiUseJobId: ticked.followUpJobId,
        pendingAiUseCatalogIds: parsed.aiUseCatalogIds,
      }),
      schedule: scheduleFromTick(job.id, ticked),
    };
  }
  const result = await runRegionSimulation({
    ownerUserId: userId,
    organizationId,
    name: parsed.name,
    kind: "verification",
    flows,
    strategies: parsed.strategies,
    samplesPerStrategy: parsed.samplesPerStrategy,
    includeHumanData: parsed.includeHumanData,
  });
  return {
    kind: "result",
    knowledge_region_id: result.id,
    persisted: result.persisted,
  };
}

function clusterStrategiesForParent(
  parentName: string,
  rows: readonly { name?: unknown; description?: unknown; embedding_model_id?: unknown }[],
): Array<{ id: string; name: string }> {
  const prefix = `${parentName} · `;
  const out: Array<{ id: string; name: string }> = [];
  for (const row of rows) {
    if (!isRegionSimulationClusterRow(row)) continue;
    const name = text(row.name);
    if (!isSimulationStrategyClusterName(parentName, name)) continue;
    const strategyId = parseRegionSimulationClusterStrategyId(row.description);
    if (!strategyId) continue;
    out.push({
      id: strategyId,
      name: name.startsWith(prefix) ? name.slice(prefix.length).trim() : name,
    });
  }
  return out;
}

export async function simulateAgentKnowledgeRegion(
  ownerUserId: string,
  regionId: string,
  body: Record<string, unknown>,
  organizationId: string,
): Promise<AgentKnowledgeRegionCreateResult> {
  const row = await loadAccessibleRegionRow(ownerUserId, regionId, organizationId);
  if (!row) throw new Error("Region not found.");
  const userId = text(row.owner_user_id) || text(ownerUserId);
  const parsed = parseWizardBody(body);
  let embeddings: Awaited<ReturnType<typeof listFlowEmbeddingsForOwner>> = [];
  try {
    embeddings = await listFlowEmbeddingsForOwner({
      ownerUserId: userId,
      flowKind: productFlowEmbeddingKind(),
    });
  } catch {
    embeddings = [];
  }
  const strategies = parseSimulationStrategiesWithRecovered({
    strategyIds: body.strategy_ids ?? body.strategyIds,
    customStrategies: body.custom_strategies ?? body.customStrategies,
    embeddings,
  });
  if (parsed.aiUseCatalogIds.length) {
    const openRouterKey = await loadOpenRouterApiKeyForOwnerUser(userId);
    if (!openRouterKey) throw new Error(OPENROUTER_ORG_KEY_MISSING);
  }
  if (!strategies.length && !parsed.aiUseCatalogIds.length) {
    throw new Error("Select at least one exploration strategy");
  }
  const admin = createAdminClient();
  const { data: siblings } = await admin
    .from("knowledge_regions")
    .select("name, description, embedding_model_id")
    .eq("owner_user_id", userId);
  const allowed = regionSimulationFlowIds({
    seedFlowId: text(row.verify_flow_id),
    embeddings,
    strategies: clusterStrategiesForParent(text(row.name), siblings || []),
  });
  const requested = parsed.protocolIds.filter((id) => allowed.includes(id));
  const ids = requested.length ? requested : allowed;
  const flows = [];
  for (const flowId of ids) {
    const flow = await ownedSimulationFlow(flowId, userId, organizationId);
    if (flow) flows.push(flow);
  }
  if (!flows.length) throw new Error("Select at least one protocol");
  const name = text(row.name);
  if (regionSimulationJobsEnabled()) {
    if (strategies.length) {
      const job = await enqueueRegionSimulation({
        ownerUserId: userId,
        organizationId,
        family: "exploration",
        name,
        kind: "verification",
        flows: parsed.aiUseCatalogIds.length ? flows.slice(0, 1) : flows,
        strategies,
        samplesPerStrategy: parsed.samplesPerStrategy,
        regionId,
        followUp: parsed.aiUseCatalogIds.length
          ? {
              family: "ai_use",
              catalogIds: parsed.aiUseCatalogIds,
              samplesPerAiUse: parsed.samplesPerAiUse,
            }
          : null,
      });
      const ticked = await tickRegionSimulationJob(job.id);
      return {
        kind: "job",
        job: presentAgentSimulationJob(ticked.job),
        schedule: scheduleFromTick(job.id, ticked),
      };
    }
    const job = await enqueueRegionSimulation({
      ownerUserId: userId,
      organizationId,
      family: "ai_use",
      name,
      kind: "verification",
      flows: flows.slice(0, 1),
      catalogIds: parsed.aiUseCatalogIds,
      samplesPerAiUse: parsed.samplesPerAiUse,
      regionId,
    });
    const ticked = await tickRegionSimulationJob(job.id);
    return {
      kind: "job",
      job: presentAgentSimulationJob(ticked.job),
      schedule: scheduleFromTick(job.id, ticked),
    };
  }
  if (!strategies.length) throw new Error("Select at least one exploration strategy");
  const result = await addRegionSimulationSamples({
    ownerUserId: userId,
    regionId,
    name,
    kind: "verification",
    flows,
    strategies,
    samplesPerStrategy: parsed.samplesPerStrategy,
  });
  return { kind: "result", knowledge_region_id: regionId, persisted: result.persisted };
}

export async function updateAgentKnowledgeRegion(
  ownerUserId: string,
  regionId: string,
  body: Record<string, unknown>,
  organizationId: string,
): Promise<PresentedAgentKnowledgeRegion> {
  const row = await loadAccessibleRegionRow(ownerUserId, regionId, organizationId);
  if (!row) throw new Error("Region not found.");
  const name = text(body.name);
  if (!name) throw new Error("name is required");
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("knowledge_regions")
    .update({ name })
    .eq("id", row.id)
    .select(REGION_LIST_SELECT)
    .maybeSingle();
  if (error || !data) throw new Error(error?.message || "Failed to update knowledge region");
  const presented = presentDashboardKnowledgeRegions([data], null)[0];
  if (!presented) throw new Error("Failed to update knowledge region");
  return presentListed(presented);
}

export async function deleteAgentKnowledgeRegion(
  ownerUserId: string,
  regionId: string,
  organizationId: string,
) {
  const row = await loadAccessibleRegionRow(ownerUserId, regionId, organizationId);
  if (!row) throw new Error("Region not found.");
  const result = await trashRegionSimulation({
    ownerUserId: text(row.owner_user_id) || ownerUserId,
    regionId: row.id,
  });
  return { id: result.id, deleted_ids: result.deletedIds };
}

export async function getAgentKnowledgeRegionJob(
  ownerUserId: string,
  jobId: string,
  organizationId: string,
) {
  const job = await getRegionSimulationJob(jobId);
  if (!job) return null;
  const jobOrg = text(job.plan?.organizationId);
  const requested = text(organizationId);
  if (jobOrg && requested && jobOrg !== requested) return null;
  if (jobOrg && requested && jobOrg === requested) {
    return presentAgentSimulationJob(job);
  }
  if (job.owner_user_id !== ownerUserId) return null;
  return presentAgentSimulationJob(job);
}

function emptyRecord(): StoredRecordView {
  return {
    sample_count: 0,
    shown_count: 0,
    truncated: false,
    streams: [],
    files: [],
    rollup: null,
  };
}

export async function getAgentKnowledgeRegionRun(input: {
  ownerUserId: string;
  knowledgeRegionId: string;
  runId: string;
  organizationId: string;
}) {
  const region = await loadAccessibleRegionRow(
    input.ownerUserId,
    input.knowledgeRegionId,
    input.organizationId,
  );
  if (!region) throw new Error("Region not found.");
  const runId = text(input.runId);
  if (!/^[a-zA-Z0-9_-]+$/.test(runId)) throw new Error("run_id is required");
  const admin = createAdminClient();
  const owner = text(region.owner_user_id) || text(input.ownerUserId);
  const { data: owned } = await admin
    .from("session_embeddings")
    .select("id")
    .eq("owner_user_id", owner)
    .eq("run_id", runId)
    .limit(1);
  if (!owned?.length) throw new Error("Run not found.");
  let query = admin
    .from("proof_of_work")
    .select(POW_SELECT)
    .order("timestamp_ms", { ascending: true })
    .limit(400);
  query = applyProofOfWorkRunIdFilter(query, runId);
  const { data, error } = await query;
  if (error) {
    return {
      knowledge_region_id: region.id,
      run_id: runId,
      pow: [],
      transcripts: [],
      speech: [],
      record: emptyRecord(),
    };
  }
  const pow = (data || []).map((row) => flowPowFromWorkspaceRow(row));
  const orgId =
    text(input.organizationId) ||
    (await organizationIdFromWorkspace(admin, text(region.workspace_id) || null)) ||
    (await organizationIdFromUser(admin, owner));
  const bodies = await loadStoredRecordBodies(pow, async (fileId) => {
    const upstream = await getOrgScopedFileContentResponse(fileId, orgId);
    if (!upstream.ok) return null;
    const buf = Buffer.from(await upstream.arrayBuffer());
    if (buf.byteLength > RECORD_HYDRATE_MAX_BYTES) return null;
    return buf.toString("utf8");
  });
  return {
    knowledge_region_id: region.id,
    run_id: runId,
    pow,
    transcripts: extractStudioTranscripts(pow),
    speech: extractStudioSpeechTranscripts(pow),
    record: presentStoredRecord({
      rows: pow,
      bodies,
      filePath: DASHBOARD_KNOWLEDGE_REGION_FILE_PATH,
    }),
  };
}
