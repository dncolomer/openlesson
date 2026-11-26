/**
 * Durable region-simulation jobs: 55s lease, one sample (exploration) or
 * one OpenRouter round (AI-use) per tick. Never sleeps.
 */

import { randomUUID } from "node:crypto";
import type { FlowKind } from "@/lib/flow-embedding";
import { studentSessionModelFromAuthorSeed } from "@/lib/author-unsys-model";
import { productFlowEmbeddingKind, type ProductFlowKind } from "@/lib/product-flow";
import {
  aiUseIdentityLabel,
  clampSamplesPerStrategy,
  emptySimulationProgress,
  planRegionSimulationSamples,
  runRegionSimulationSample,
  simulatedIdentityLabel,
  simulationSampleRunId,
  type ExplorationStrategy,
  type RegionSimulationProgress,
  type RegionSimulationSamplePlan,
} from "@/lib/region-simulation";
import { runCanvasFaithfulExplorationSample } from "@/lib/region-simulation-actor";
import {
  aiUseCatalogById,
  aiUseSampleRunId,
  clampSamplesPerAiUse,
  parseAiUseCatalogIds,
} from "@/lib/region-simulation-ai-use-catalog";
import {
  regionSimulationAiUseEnabled,
  regionSimulationCanvasFaithfulEnabled,
  regionSimulationJobsEnabled,
} from "@/lib/region-simulation-flags";
import {
  createAiUseCheckpoint,
  runAiUseHarnessRound,
  type AiUseCheckpoint,
} from "@/lib/region-simulation-harness";
import { persistRegionSimulationSample } from "@/lib/region-simulation-persist";
import {
  refreshSimulationFamilyClusters,
  type RegionSimulationFlowInput,
} from "@/lib/region-simulation-run";
import { OPENROUTER_ORG_KEY_MISSING, openRouterJobMaxUsd } from "@/lib/ai/openrouter";
import { loadOpenRouterApiKeyForOwnerUser } from "@/lib/organization/org-backend-runtime";
import { seededSimulationTree } from "@/lib/region-simulation";
import { createAdminClient } from "@/lib/supabase/admin";
import type { SessionBranchModel } from "@/lib/session-branch-model";

export const REGION_SIM_LEASE_MS = 55_000;
export const REGION_SIM_TICK_MAX_DURATION = 60;
export const REGION_SIM_CRON_JOB_CAP = 10;

export type RegionSimulationFamily = "exploration" | "ai_use";

export type RegionSimulationFollowUp = {
  family: "ai_use";
  catalogIds: string[];
  samplesPerAiUse: number;
};

export type RegionSimulationJobPlan = {
  family: RegionSimulationFamily;
  name: string;
  kind: ProductFlowKind;
  flows: RegionSimulationFlowInput[];
  strategies: ExplorationStrategy[];
  samplesPerStrategy: number;
  includeHumanData: boolean;
  catalogIds: string[];
  samplesPerAiUse: number;
  followUp?: RegionSimulationFollowUp | null;
  items: RegionSimulationJobItem[];
};

export type RegionSimulationJobItem =
  | { family: "exploration"; plan: RegionSimulationSamplePlan }
  | {
      family: "ai_use";
      catalogId: string;
      index: number;
      flowId: string;
      problem: string;
      seed: string;
      runId: string;
    };

export type RegionSimulationJobRow = {
  id: string;
  owner_user_id: string;
  region_id: string | null;
  product: string;
  status: "queued" | "running" | "done" | "failed";
  family: RegionSimulationFamily;
  follow_up_job_id: string | null;
  plan: RegionSimulationJobPlan;
  plan_cursor: number;
  checkpoint: AiUseCheckpoint | null;
  lease_owner: string | null;
  lease_until: string | null;
  progress: RegionSimulationProgress[];
  result: Record<string, unknown> | null;
  cost_usd: number;
  error: string | null;
  created_at: string;
  updated_at: string;
};

export type TickResult = {
  job: RegionSimulationJobRow;
  shouldContinue: boolean;
  followUpJobId: string | null;
};

const memoryJobs = new Map<string, RegionSimulationJobRow>();

function supabaseConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

function nowIso(): string {
  return new Date().toISOString();
}

function leaseUntilIso(): string {
  return new Date(Date.now() + REGION_SIM_LEASE_MS).toISOString();
}

function leaseExpired(job: RegionSimulationJobRow): boolean {
  if (!job.lease_until) return true;
  return new Date(job.lease_until).getTime() < Date.now();
}

export function resetRegionSimulationJobsForTests(): void {
  memoryJobs.clear();
}

export function listMemoryRegionSimulationJobs(): RegionSimulationJobRow[] {
  return [...memoryJobs.values()];
}

function flowKindFor(kind: ProductFlowKind): FlowKind {
  return productFlowEmbeddingKind(kind);
}

function referenceModelFor(
  flow: RegionSimulationFlowInput | undefined,
  plan: { problem: string; seed: string; strategyId?: string },
): SessionBranchModel {
  const fromSeed = studentSessionModelFromAuthorSeed(flow?.answersModelSeed);
  if (fromSeed) return { ...fromSeed, focusId: fromSeed.rootId };
  return seededSimulationTree({
    problem: plan.problem,
    seed: plan.seed,
    strategyId: plan.strategyId || "balanced",
  });
}

function walkExploration(plan: RegionSimulationSamplePlan, kind: ProductFlowKind, strategies: readonly ExplorationStrategy[], flow?: RegionSimulationFlowInput) {
  const fk = flowKindFor(kind);
  const model = referenceModelFor(flow, plan);
  if (regionSimulationCanvasFaithfulEnabled()) {
    return runCanvasFaithfulExplorationSample(plan, fk, strategies, model);
  }
  return runRegionSimulationSample(plan, fk, strategies, model);
}

export function buildExplorationJobItems(input: {
  flows: readonly RegionSimulationFlowInput[];
  strategies: readonly ExplorationStrategy[];
  samplesPerStrategy: number;
}): RegionSimulationJobItem[] {
  const flowIds = input.flows.map((flow) => flow.id);
  const problemsByFlowId: Record<string, readonly string[]> = {};
  for (const flow of input.flows) problemsByFlowId[flow.id] = flow.problems;
  return planRegionSimulationSamples({
    flowIds,
    problemsByFlowId,
    strategyIds: input.strategies.map((row) => row.id),
    samplesPerStrategy: clampSamplesPerStrategy(input.samplesPerStrategy),
  }).map((plan) => ({ family: "exploration" as const, plan }));
}

export function buildAiUseJobItems(input: {
  flow: RegionSimulationFlowInput;
  catalogIds: readonly string[];
  samplesPerAiUse: number;
}): RegionSimulationJobItem[] {
  const ids = parseAiUseCatalogIds(input.catalogIds);
  const n = clampSamplesPerAiUse(input.samplesPerAiUse);
  const problem = input.flow.problems[0] || input.flow.name || "Problem";
  const items: RegionSimulationJobItem[] = [];
  for (const catalogId of ids) {
    for (let index = 0; index < n; index += 1) {
      const seed = `${catalogId}:${input.flow.id}:${index}`;
      items.push({
        family: "ai_use",
        catalogId,
        index,
        flowId: input.flow.id,
        problem,
        seed,
        runId: aiUseSampleRunId({ catalogId, index, seed }),
      });
    }
  }
  return items;
}

function progressForPlan(plan: RegionSimulationJobPlan): RegionSimulationProgress[] {
  if (plan.family === "ai_use") {
    return plan.catalogIds.map((id) => {
      const row = aiUseCatalogById(id);
      return {
        strategyId: id,
        strategyName: row?.displayName || id,
        done: 0,
        total: plan.samplesPerAiUse,
        family: "ai_use" as const,
      };
    });
  }
  return emptySimulationProgress(plan.strategies, plan.samplesPerStrategy).map((row) => ({
    ...row,
    family: "exploration" as const,
  }));
}

function bumpProgress(progress: RegionSimulationProgress[], strategyId: string): RegionSimulationProgress[] {
  return progress.map((row) =>
    row.strategyId === strategyId ? { ...row, done: Math.min(row.total, row.done + 1) } : row,
  );
}

async function writeJob(job: RegionSimulationJobRow): Promise<RegionSimulationJobRow> {
  job.updated_at = nowIso();
  if (!supabaseConfigured()) {
    memoryJobs.set(job.id, { ...job });
    return memoryJobs.get(job.id)!;
  }
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("region_simulation_jobs")
    .upsert({
      id: job.id,
      owner_user_id: job.owner_user_id,
      region_id: job.region_id,
      product: job.product,
      status: job.status,
      family: job.family,
      follow_up_job_id: job.follow_up_job_id,
      plan: job.plan,
      plan_cursor: job.plan_cursor,
      checkpoint: job.checkpoint,
      lease_owner: job.lease_owner,
      lease_until: job.lease_until,
      progress: job.progress,
      result: job.result,
      cost_usd: job.cost_usd,
      error: job.error,
      created_at: job.created_at,
      updated_at: job.updated_at,
    })
    .select("*")
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? (normalizeJob(data) ?? job) : job;
}

function normalizeJob(row: Record<string, unknown>): RegionSimulationJobRow | null {
  const id = String(row.id || "").trim();
  if (!id) return null;
  return {
    id,
    owner_user_id: String(row.owner_user_id || ""),
    region_id: row.region_id ? String(row.region_id) : null,
    product: String(row.product || "verification"),
    status: (row.status as RegionSimulationJobRow["status"]) || "queued",
    family: row.family === "ai_use" ? "ai_use" : "exploration",
    follow_up_job_id: row.follow_up_job_id ? String(row.follow_up_job_id) : null,
    plan: (row.plan || {}) as RegionSimulationJobPlan,
    plan_cursor: Number(row.plan_cursor) || 0,
    checkpoint: (row.checkpoint as AiUseCheckpoint | null) || null,
    lease_owner: row.lease_owner ? String(row.lease_owner) : null,
    lease_until: row.lease_until ? String(row.lease_until) : null,
    progress: Array.isArray(row.progress) ? (row.progress as RegionSimulationProgress[]) : [],
    result: (row.result as Record<string, unknown> | null) || null,
    cost_usd: Number(row.cost_usd) || 0,
    error: row.error ? String(row.error) : null,
    created_at: String(row.created_at || nowIso()),
    updated_at: String(row.updated_at || nowIso()),
  };
}

export async function getRegionSimulationJob(
  jobId: string,
  ownerUserId?: string,
): Promise<RegionSimulationJobRow | null> {
  const id = String(jobId || "").trim();
  if (!id) return null;
  if (!supabaseConfigured()) {
    const job = memoryJobs.get(id) || null;
    if (job && ownerUserId && job.owner_user_id !== ownerUserId) return null;
    if (job && job.status === "running" && leaseExpired(job)) {
      job.status = "queued";
      job.lease_owner = null;
      job.lease_until = null;
      memoryJobs.set(id, job);
    }
    return job ? { ...job } : null;
  }
  const supabase = createAdminClient();
  let query = supabase.from("region_simulation_jobs").select("*").eq("id", id);
  if (ownerUserId) query = query.eq("owner_user_id", ownerUserId);
  const { data, error } = await query.maybeSingle();
  if (error) throw new Error(error.message);
  const job = data ? normalizeJob(data as Record<string, unknown>) : null;
  if (job && job.status === "running" && leaseExpired(job)) {
    job.status = "queued";
    job.lease_owner = null;
    job.lease_until = null;
    return writeJob(job);
  }
  return job;
}

async function acquireLease(jobId: string, owner: string): Promise<RegionSimulationJobRow | null> {
  const job = await getRegionSimulationJob(jobId);
  if (!job) return null;
  if (!["queued", "running"].includes(job.status)) return null;
  if (job.lease_until && !leaseExpired(job) && job.lease_owner && job.lease_owner !== owner) {
    return null;
  }
  job.lease_owner = owner;
  job.lease_until = leaseUntilIso();
  job.status = "running";
  return writeJob(job);
}

export async function enqueueRegionSimulation(input: {
  ownerUserId: string;
  family: RegionSimulationFamily;
  name: string;
  kind: ProductFlowKind;
  flows: readonly RegionSimulationFlowInput[];
  strategies?: readonly ExplorationStrategy[];
  samplesPerStrategy?: number;
  includeHumanData?: boolean;
  catalogIds?: readonly string[];
  samplesPerAiUse?: number;
  followUp?: RegionSimulationFollowUp | null;
  regionId?: string | null;
}): Promise<RegionSimulationJobRow> {
  const ownerUserId = String(input.ownerUserId || "").trim();
  if (!ownerUserId) throw new Error("owner is required");
  const family = input.family;
  const flows =
    family === "ai_use" || (input.catalogIds?.length ?? 0) > 0
      ? input.flows.slice(0, 1)
      : [...input.flows];
  if (!flows.length) throw new Error("Select at least one flow");
  const strategies = [...(input.strategies || [])];
  if (family === "exploration" && !strategies.length) {
    throw new Error("Select at least one exploration strategy");
  }
  if (family === "ai_use" && !parseAiUseCatalogIds(input.catalogIds).length) {
    throw new Error("Select at least one AI-use model");
  }
  const catalogIds = family === "ai_use" ? parseAiUseCatalogIds(input.catalogIds) : parseAiUseCatalogIds(input.followUp?.catalogIds);
  const samplesPerAiUse = clampSamplesPerAiUse(input.samplesPerAiUse ?? input.followUp?.samplesPerAiUse);
  const items =
    family === "ai_use"
      ? buildAiUseJobItems({
          flow: flows[0]!,
          catalogIds: parseAiUseCatalogIds(input.catalogIds),
          samplesPerAiUse,
        })
      : buildExplorationJobItems({
          flows,
          strategies,
          samplesPerStrategy: input.samplesPerStrategy ?? 12,
        });
  const plan: RegionSimulationJobPlan = {
    family,
    name: String(input.name || "").trim(),
    kind: input.kind,
    flows,
    strategies,
    samplesPerStrategy: clampSamplesPerStrategy(input.samplesPerStrategy ?? 12),
    includeHumanData: input.includeHumanData === true,
    catalogIds: family === "ai_use" ? parseAiUseCatalogIds(input.catalogIds) : catalogIds,
    samplesPerAiUse,
    followUp: family === "exploration" ? input.followUp || null : null,
    items,
  };
  const job: RegionSimulationJobRow = {
    id: randomUUID(),
    owner_user_id: ownerUserId,
    region_id: input.regionId || null,
    product: input.kind,
    status: "queued",
    family,
    follow_up_job_id: null,
    plan,
    plan_cursor: 0,
    checkpoint: null,
    lease_owner: null,
    lease_until: null,
    progress: progressForPlan(plan),
    result: null,
    cost_usd: 0,
    error: null,
    created_at: nowIso(),
    updated_at: nowIso(),
  };
  return writeJob(job);
}

async function persistExplorationItem(
  job: RegionSimulationJobRow,
  item: Extract<RegionSimulationJobItem, { family: "exploration" }>,
): Promise<void> {
  const plan = item.plan;
  const flow = job.plan.flows.find((row) => row.id === plan.flowId);
  const strategy = job.plan.strategies.find((row) => row.id === plan.strategyId);
  if (!strategy) throw new Error(`Unknown exploration strategy: ${plan.strategyId}`);
  const walk = walkExploration(plan, job.plan.kind, job.plan.strategies, flow);
  await persistRegionSimulationSample({
    ownerUserId: job.owner_user_id,
    workspaceId: flow?.workspaceId,
    flowKind: flowKindFor(job.plan.kind),
    flowId: plan.flowId,
    runId: simulationSampleRunId(plan),
    identity: simulatedIdentityLabel(strategy.name),
    family: "exploration",
    model: walk.model,
    sequence: walk.sequence,
    pow: walk.pow,
  });
  job.progress = bumpProgress(job.progress, plan.strategyId);
}

async function persistAiUseSample(job: RegionSimulationJobRow, checkpoint: AiUseCheckpoint): Promise<void> {
  const catalog = aiUseCatalogById(checkpoint.catalogId);
  if (!catalog) throw new Error("unknown catalog");
  const item = job.plan.items[checkpoint.plan_cursor];
  const flowId = item && item.family === "ai_use" ? item.flowId : job.plan.flows[0]?.id;
  const flow = job.plan.flows.find((row) => row.id === flowId) || job.plan.flows[0];
  const model = referenceModelFor(flow, {
    problem: flow?.problems[0] || job.plan.name,
    seed: checkpoint.run_id,
    strategyId: "balanced",
  });
  const sequence = job.plan.kind === "calibration" ? [] : checkpoint.sequence;
  await persistRegionSimulationSample({
    ownerUserId: job.owner_user_id,
    workspaceId: flow?.workspaceId,
    flowKind: flowKindFor(job.plan.kind),
    flowId: flow?.id || "",
    runId: checkpoint.run_id,
    identity: aiUseIdentityLabel(catalog.displayName),
    linkLabel: "ai-use",
    family: "ai_use",
    model,
    sequence,
    pow: checkpoint.pow,
  });
  job.progress = bumpProgress(job.progress, catalog.id);
}

export async function tickRegionSimulationJob(jobId: string): Promise<TickResult> {
  const owner = `tick:${randomUUID().slice(0, 8)}`;
  const acquired = await acquireLease(jobId, owner);
  if (!acquired) {
    const current = await getRegionSimulationJob(jobId);
    return {
      job: current || ({ id: jobId } as RegionSimulationJobRow),
      shouldContinue: false,
      followUpJobId: null,
    };
  }
  const job = acquired;
  try {
    const item = job.plan.items[job.plan_cursor];
    if (!item) {
      job.status = "done";
      job.lease_owner = null;
      job.lease_until = null;
      const followUpJobId = await maybeEnqueueFollowUp(job);
      await writeJob(job);
      return { job, shouldContinue: false, followUpJobId };
    }

    if (item.family === "exploration") {
      await persistExplorationItem(job, item);
      job.plan_cursor += 1;
      job.checkpoint = null;
      await refreshAfterTick(job);
    } else {
      if (!regionSimulationAiUseEnabled()) {
        throw new Error("AI-use simulation is disabled");
      }
      const catalog = aiUseCatalogById(item.catalogId);
      if (!catalog) throw new Error("unknown catalog");
      if (job.cost_usd >= openRouterJobMaxUsd()) {
        throw new Error("OpenRouter job USD cap");
      }
      const apiKey = await loadOpenRouterApiKeyForOwnerUser(job.owner_user_id);
      if (!apiKey) throw new Error(OPENROUTER_ORG_KEY_MISSING);
      const flow = job.plan.flows.find((row) => row.id === item.flowId) || job.plan.flows[0];
      const model = referenceModelFor(flow, {
        problem: item.problem,
        seed: item.seed,
        strategyId: "balanced",
      });
      const checkpoint =
        job.checkpoint && job.checkpoint.run_id === item.runId
          ? job.checkpoint
          : createAiUseCheckpoint({
              catalog,
              runId: item.runId,
              problem: item.problem,
              seed: item.seed,
              flowKind: flowKindFor(job.plan.kind) === "learn" ? "learn" : flowKindFor(job.plan.kind),
              ownerUserId: job.owner_user_id,
              planCursor: job.plan_cursor,
              sampleIndex: item.index,
              model,
            });
      const costBefore = checkpoint.costUsd;
      const round = await runAiUseHarnessRound({
        checkpoint,
        catalog,
        seed: item.seed,
        flowKind: flowKindFor(job.plan.kind) === "learn" ? "learn" : flowKindFor(job.plan.kind),
        model,
        ownerUserId: job.owner_user_id,
        apiKey,
      });
      job.checkpoint = round.checkpoint;
      job.cost_usd += Math.max(0, round.checkpoint.costUsd - costBefore);
      if (round.done || round.failed) {
        if (!round.failed) await persistAiUseSample(job, round.checkpoint);
        job.plan_cursor += 1;
        job.checkpoint = null;
        await refreshAfterTick(job);
      }
    }

    const finished = job.plan_cursor >= job.plan.items.length;
    job.status = finished ? "done" : "running";
    job.lease_owner = null;
    job.lease_until = null;
    let followUpJobId: string | null = null;
    if (finished) followUpJobId = await maybeEnqueueFollowUp(job);
    await writeJob(job);
    return {
      job,
      shouldContinue: !finished,
      followUpJobId,
    };
  } catch (error) {
    job.status = "failed";
    job.error = error instanceof Error ? error.message : "tick failed";
    job.lease_owner = null;
    job.lease_until = null;
    await writeJob(job);
    return { job, shouldContinue: false, followUpJobId: null };
  }
}

async function maybeEnqueueFollowUp(job: RegionSimulationJobRow): Promise<string | null> {
  if (job.follow_up_job_id) return job.follow_up_job_id;
  const follow = job.plan.followUp;
  if (!follow || follow.family !== "ai_use" || !follow.catalogIds.length) return null;
  if (!regionSimulationAiUseEnabled()) return null;
  const next = await enqueueRegionSimulation({
    ownerUserId: job.owner_user_id,
    family: "ai_use",
    name: job.plan.name,
    kind: job.plan.kind,
    flows: job.plan.flows.slice(0, 1),
    catalogIds: follow.catalogIds,
    samplesPerAiUse: follow.samplesPerAiUse,
    regionId: job.region_id,
  });
  job.follow_up_job_id = next.id;
  return next.id;
}

async function refreshAfterTick(job: RegionSimulationJobRow): Promise<void> {
  try {
    const records = await refreshSimulationFamilyClusters({
      ownerUserId: job.owner_user_id,
      regionId: job.region_id || "",
      family: job.family,
      name: job.plan.name,
      kind: job.plan.kind,
      flows: job.plan.flows,
      strategies: job.plan.strategies,
    });
    if (records.id) job.region_id = records.id;
    job.result = { id: records.id };
  } catch {
    /* next tick retries */
  }
}

export async function drainRegionSimulationJobs(limit = REGION_SIM_CRON_JOB_CAP): Promise<string[]> {
  const cap = Math.max(1, Math.min(50, Math.floor(limit) || REGION_SIM_CRON_JOB_CAP));
  const ids: string[] = [];
  if (!supabaseConfigured()) {
    const due = [...memoryJobs.values()]
      .filter((job) => ["queued", "running"].includes(job.status) && leaseExpired(job))
      .slice(0, cap);
    for (const job of due) {
      await tickRegionSimulationJob(job.id);
      ids.push(job.id);
    }
    return ids;
  }
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("region_simulation_jobs")
    .select("id, lease_until, status")
    .in("status", ["queued", "running"])
    .order("created_at", { ascending: true })
    .limit(cap * 3);
  if (error) throw new Error(error.message);
  for (const row of data || []) {
    if (ids.length >= cap) break;
    const until = row.lease_until ? new Date(String(row.lease_until)).getTime() : 0;
    if (until && until > Date.now()) continue;
    await tickRegionSimulationJob(String(row.id));
    ids.push(String(row.id));
  }
  return ids;
}

export function jobsPublicPayload(job: RegionSimulationJobRow): Record<string, unknown> {
  return {
    type: "jobs",
    jobId: job.id,
    family: job.family,
    status: job.status,
    regionId: job.region_id,
    followUpJobId: job.follow_up_job_id,
    progress: job.progress,
    costUsd: job.cost_usd,
    error: job.error,
    planCursor: job.plan_cursor,
    planLength: job.plan.items.length,
  };
}

export { regionSimulationJobsEnabled };
