/**
 * Knowledge-region simulation: exploration-strategy catalog, even sample
 * spread across verification flows, problem coverage, and deterministic
 * agent walks on a seeded hidden-state tree.
 *
 * One sample is one agent on one problem from one selected flow, with one
 * strategy as its instructions, producing a proof-of-work trace.
 */

import { completeFlowEmbedding, type FlowEmbeddingRecord, type FlowPowRow } from "@/lib/flow-embedding";
import { cosineSimilarity, hashUnit } from "@/lib/knowledge-config/math";
import {
  normalizeSessionBranchModel,
  sessionBranchById,
  type SessionBranch,
  type SessionBranchModel,
} from "@/lib/session-branch-model";

export const REGION_SIMULATION_SOURCE = "simulated" as const;
export const REGION_SIMULATION_DEFAULT_SAMPLES = 12;
export const REGION_SIMULATION_MIN_SAMPLES = 3;
export const REGION_SIMULATION_MAX_SAMPLES = 48;
export const DASHBOARD_REGION_SIMULATION_PATH = "/api/dashboard/region-simulation";

export const EXPLORATION_STRATEGY_IDS = [
  "exploit-heavy",
  "information-seeking",
  "novelty-seeking",
  "balanced",
  "narrow-and-deep",
] as const;

export type ExplorationStrategyId = (typeof EXPLORATION_STRATEGY_IDS)[number];

export type ExplorationStrategy = {
  id: ExplorationStrategyId;
  name: string;
  description: string;
  instructions: string;
  params: {
    maxSteps: number;
    prefer: "cheap" | "costly" | "novel" | "balanced" | "lineage";
    commitAfter: number;
  };
};

/**
 * Research-owned catalog. Active inference: each agent balances using what
 * it already knows (exploitation) against gathering information to reduce
 * uncertainty (epistemic foraging).
 */
export const EXPLORATION_STRATEGIES: readonly ExplorationStrategy[] = [
  {
    id: "exploit-heavy",
    name: "Exploit-heavy",
    description: "Goes for the answer it already thinks is best and explores little.",
    instructions:
      "Use what you already think is best. Take the cheapest next step. Do not wander. Commit early and stop once you have an answer.",
    params: { maxSteps: 3, prefer: "cheap", commitAfter: 0 },
  },
  {
    id: "information-seeking",
    name: "Information-seeking",
    description: "Chooses steps that reduce uncertainty most, even if they are slower.",
    instructions:
      "Choose the step that reduces your uncertainty the most, even when it is slower or more expensive. Keep foraging for information before you answer.",
    params: { maxSteps: 6, prefer: "costly", commitAfter: 6 },
  },
  {
    id: "novelty-seeking",
    name: "Novelty-seeking",
    description: "Goes for unfamiliar parts of the problem.",
    instructions:
      "Prefer parts of the problem you have not visited. Skip familiar branches. Seek novelty even when a known path looks cheaper.",
    params: { maxSteps: 5, prefer: "novel", commitAfter: 5 },
  },
  {
    id: "balanced",
    name: "Balanced",
    description: "Explores early, then commits.",
    instructions:
      "Explore early to reduce uncertainty, then commit to the best remaining path. Do not keep foraging after you have enough to answer.",
    params: { maxSteps: 6, prefer: "balanced", commitAfter: 3 },
  },
  {
    id: "narrow-and-deep",
    name: "Narrow and deep",
    description: "Stays with one approach and goes deep.",
    instructions:
      "Pick one approach and stay with it. Go deep along that lineage. Do not switch branches once you have chosen.",
    params: { maxSteps: 7, prefer: "lineage", commitAfter: 1 },
  },
];

export type RegionSimulationSamplePlan = {
  index: number;
  strategyId: ExplorationStrategyId;
  flowId: string;
  problem: string;
  problemIndex: number;
  seed: string;
};

export type RegionSimulationProgress = {
  strategyId: ExplorationStrategyId;
  strategyName: string;
  done: number;
  total: number;
};

export type RegionSimulationWalk = {
  model: SessionBranchModel;
  sequence: string[];
  pow: FlowPowRow[];
  embedding: FlowEmbeddingRecord;
};

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function isExplorationStrategyId(value: unknown): value is ExplorationStrategyId {
  return EXPLORATION_STRATEGY_IDS.includes(value as ExplorationStrategyId);
}

export function explorationStrategyById(id: unknown): ExplorationStrategy | null {
  const key = text(id);
  return EXPLORATION_STRATEGIES.find((row) => row.id === key) ?? null;
}

export function parseExplorationStrategyIds(value: unknown): ExplorationStrategyId[] {
  const listed = Array.isArray(value) ? value : [];
  const seen = new Set<ExplorationStrategyId>();
  const out: ExplorationStrategyId[] = [];
  for (const item of listed) {
    if (!isExplorationStrategyId(item) || seen.has(item)) continue;
    seen.add(item);
    out.push(item);
  }
  return out;
}

export function clampSamplesPerStrategy(value: unknown): number {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return REGION_SIMULATION_DEFAULT_SAMPLES;
  return Math.max(
    REGION_SIMULATION_MIN_SAMPLES,
    Math.min(REGION_SIMULATION_MAX_SAMPLES, n),
  );
}

export function isSimulatedStudioSource(source: unknown): boolean {
  return text(source).toLowerCase() === REGION_SIMULATION_SOURCE;
}

export function isSimulatedStudioIdentity(identity: unknown): boolean {
  return /^simulated(\s|·|:|-)/i.test(text(identity));
}

export function isSimulatedEmbedding(row: {
  source?: unknown;
  identity?: unknown;
}): boolean {
  return isSimulatedStudioSource(row.source) || isSimulatedStudioIdentity(row.identity);
}

export function simulatedIdentityLabel(strategyName: string): string {
  const name = text(strategyName) || "agent";
  return `Simulated · ${name}`;
}

export function simulationClusterRegionName(parentName: string, strategyName: string): string {
  const parent = text(parentName) || "Region";
  const strategy = text(strategyName) || "strategy";
  return `${parent} · ${strategy}`.slice(0, 120);
}

export function isSimulationStrategyClusterName(parentName: string, regionName: string): boolean {
  const parent = text(parentName);
  const name = text(regionName);
  if (!parent || !name) return false;
  const prefix = `${parent} · `;
  if (!name.startsWith(prefix)) return false;
  const rest = name.slice(prefix.length);
  if (!rest || rest === "Path + Text" || rest === "Voice") return false;
  return true;
}

export function allocateSamplesAcrossFlows(
  flowIds: readonly string[],
  sampleCount: number,
): number[] {
  const ids = flowIds.map((id) => text(id)).filter(Boolean);
  const n = ids.length;
  const total = Math.max(0, Math.floor(Number(sampleCount) || 0));
  if (n === 0 || total === 0) return [];
  const base = Math.floor(total / n);
  const remainder = total % n;
  return ids.map((_, index) => base + (index < remainder ? 1 : 0));
}

export function coverProblems(
  problems: readonly string[],
  count: number,
): Array<{ problem: string; problemIndex: number }> {
  const pool = problems.map((item) => text(item)).filter(Boolean);
  const items = pool.length ? pool : ["Problem"];
  const n = Math.max(0, Math.floor(Number(count) || 0));
  const out: Array<{ problem: string; problemIndex: number }> = [];
  for (let index = 0; index < n; index += 1) {
    const problemIndex = index % items.length;
    out.push({ problem: items[problemIndex]!, problemIndex });
  }
  return out;
}

function sampleSeed(input: {
  strategyId: string;
  flowId: string;
  problemIndex: number;
  index: number;
}): string {
  const unit = hashUnit(
    `${input.strategyId}:${input.flowId}:${input.problemIndex}:${input.index}`,
  );
  return `${input.strategyId}:${input.flowId}:${input.index}:${unit.toFixed(8)}`;
}

export function planRegionSimulationSamples(input: {
  flowIds: readonly string[];
  problemsByFlowId: Record<string, readonly string[]>;
  strategyIds: readonly string[];
  samplesPerStrategy: number;
}): RegionSimulationSamplePlan[] {
  const flowIds = input.flowIds.map((id) => text(id)).filter(Boolean);
  const strategyIds = parseExplorationStrategyIds(input.strategyIds);
  const samplesPerStrategy = clampSamplesPerStrategy(input.samplesPerStrategy);
  const allocation = allocateSamplesAcrossFlows(flowIds, samplesPerStrategy);
  const out: RegionSimulationSamplePlan[] = [];
  for (const strategyId of strategyIds) {
    let index = 0;
    for (let flowIndex = 0; flowIndex < flowIds.length; flowIndex += 1) {
      const flowId = flowIds[flowIndex]!;
      const count = allocation[flowIndex] ?? 0;
      const covered = coverProblems(input.problemsByFlowId[flowId] ?? [], count);
      for (const item of covered) {
        out.push({
          index,
          strategyId,
          flowId,
          problem: item.problem,
          problemIndex: item.problemIndex,
          seed: sampleSeed({
            strategyId,
            flowId,
            problemIndex: item.problemIndex,
            index,
          }),
        });
        index += 1;
      }
    }
  }
  return out;
}

export function emptySimulationProgress(
  strategyIds: readonly string[],
  samplesPerStrategy: number,
): RegionSimulationProgress[] {
  const total = clampSamplesPerStrategy(samplesPerStrategy);
  return parseExplorationStrategyIds(strategyIds).map((id) => {
    const strategy = explorationStrategyById(id)!;
    return {
      strategyId: id,
      strategyName: strategy.name,
      done: 0,
      total,
    };
  });
}

function seededPrice(seed: string, key: string, min: number, max: number): number {
  const unit = hashUnit(`${seed}:${key}:price`);
  return Math.max(min, Math.min(max, Math.round(min + unit * (max - min))));
}

/** Seeded nested hidden-state tree so strategy walks cover the flow, not one path. */
export function seededSimulationTree(input: {
  problem: string;
  seed: string;
  strategyId: string;
}): SessionBranchModel {
  const problem = text(input.problem) || "Problem";
  const seed = `${text(input.seed)}:${text(input.strategyId)}`;
  const regions = Array.from({ length: 6 }, (_, regionIndex) => {
    const regionKey = `r${regionIndex}`;
    return {
      title: `Approach ${regionIndex + 1}`,
      question: `${problem} — approach ${regionIndex + 1}?`,
      territory: `Approach ${regionIndex + 1} of ${problem}`,
      observation: `Open approach ${regionIndex + 1}.`,
      edgePrice: seededPrice(seed, regionKey, 6, 92),
      children: Array.from({ length: 3 }, (_, avenueIndex) => {
        const avenueKey = `${regionKey}-a${avenueIndex}`;
        return {
          title: `Avenue ${regionIndex + 1}.${avenueIndex + 1}`,
          question: `${problem} — avenue ${regionIndex + 1}.${avenueIndex + 1}?`,
          territory: `Avenue ${regionIndex + 1}.${avenueIndex + 1}`,
          observation: `Foraging avenue ${regionIndex + 1}.${avenueIndex + 1}.`,
          edgePrice: seededPrice(seed, avenueKey, 8, 94),
          children: Array.from({ length: 2 }, (_, inquiryIndex) => {
            const inquiryKey = `${avenueKey}-q${inquiryIndex}`;
            return {
              title: `Inquiry ${regionIndex + 1}.${avenueIndex + 1}.${inquiryIndex + 1}`,
              question: `${problem} — inquiry ${inquiryIndex + 1}?`,
              territory: `Inquiry ${inquiryKey}`,
              observation: `Deep probe ${inquiryKey}.`,
              edgePrice: seededPrice(seed, inquiryKey, 10, 96),
            };
          }),
        };
      }),
    };
  });
  const model = normalizeSessionBranchModel(
    {
      premise: problem,
      question: problem,
      territory: problem,
      observation: problem,
      regions,
    },
    problem.slice(0, 80) || "Problem",
  );
  if (!model) {
    throw new Error("Simulation tree was refused");
  }
  return model;
}

function childrenOf(model: SessionBranchModel, parentId: string): SessionBranch[] {
  return model.branches.filter((branch) => branch.parentId === parentId);
}

function edgePrice(parent: SessionBranch, childId: string): number {
  const edge = parent.edges.find((item) => item.toId === childId);
  return edge ? edge.price : 50;
}

function pickChild(input: {
  strategy: ExplorationStrategy;
  parent: SessionBranch;
  children: SessionBranch[];
  visited: ReadonlySet<string>;
  step: number;
  seed: string;
}): SessionBranch | null {
  const kids = input.children;
  if (!kids.length) return null;
  const { strategy, parent, visited, step, seed } = input;

  if (strategy.params.prefer === "lineage") {
    if (step === 0) {
      const index = Math.floor(hashUnit(`${seed}:lineage`) * kids.length) % kids.length;
      return kids[index] ?? kids[0]!;
    }
    return [...kids].sort(
      (a, b) => edgePrice(parent, a.id) - edgePrice(parent, b.id) || a.id.localeCompare(b.id),
    )[0]!;
  }

  if (strategy.params.prefer === "novel") {
    const unvisited = kids.filter((child) => !visited.has(child.id));
    const pool = unvisited.length ? unvisited : kids;
    return [...pool].sort((a, b) => {
      const depth = b.depth - a.depth;
      if (depth) return depth;
      return hashUnit(`${seed}:novel:${b.id}`) - hashUnit(`${seed}:novel:${a.id}`);
    })[0]!;
  }

  const costly =
    strategy.params.prefer === "costly" ||
    (strategy.params.prefer === "balanced" && step < strategy.params.commitAfter);
  const ranked = [...kids].sort((a, b) => {
    const delta = edgePrice(parent, a.id) - edgePrice(parent, b.id);
    if (delta) return costly ? -delta : delta;
    return a.id.localeCompare(b.id);
  });
  return ranked[0]!;
}

export function walkExplorationStrategy(input: {
  model: SessionBranchModel;
  strategy: ExplorationStrategy;
  seed: string;
}): string[] {
  const sequence: string[] = [];
  let currentId = input.model.rootId;
  const visited = new Set<string>([currentId]);
  for (let step = 0; step < input.strategy.params.maxSteps; step += 1) {
    const parent = sessionBranchById(input.model, currentId);
    if (!parent) break;
    const children = childrenOf(input.model, currentId);
    const next = pickChild({
      strategy: input.strategy,
      parent,
      children,
      visited,
      step,
      seed: input.seed,
    });
    if (!next) break;
    sequence.push(next.id);
    visited.add(next.id);
    currentId = next.id;
  }
  return sequence;
}

export function regionSimulationPow(input: {
  strategy: ExplorationStrategy;
  problem: string;
  flowId: string;
  seed: string;
  sequence: readonly string[];
}): FlowPowRow[] {
  return [
    {
      type: "speech",
      tool_name: REGION_SIMULATION_SOURCE,
      tool_action: input.strategy.id,
      timestamp_ms: 1,
      payload: input.problem,
      metadata: {
        origin: REGION_SIMULATION_SOURCE,
        simulated: true,
        strategyId: input.strategy.id,
        strategyName: input.strategy.name,
        instructions: input.strategy.instructions,
        flowId: input.flowId,
        problem: input.problem,
        seed: input.seed,
      },
    },
    ...input.sequence.map((action, index) => ({
      type: "tool" as const,
      tool_name: "session_policy",
      tool_action: action,
      timestamp_ms: index + 2,
      metadata: {
        origin: REGION_SIMULATION_SOURCE,
        simulated: true,
        strategyId: input.strategy.id,
        seed: input.seed,
      },
    })),
  ];
}

export function runRegionSimulationSample(plan: RegionSimulationSamplePlan): RegionSimulationWalk {
  const strategy = explorationStrategyById(plan.strategyId);
  if (!strategy) {
    throw new Error(`Unknown exploration strategy: ${plan.strategyId}`);
  }
  const model = seededSimulationTree({
    problem: plan.problem,
    seed: plan.seed,
    strategyId: strategy.id,
  });
  const sequence = walkExplorationStrategy({ model, strategy, seed: plan.seed });
  const pow = regionSimulationPow({
    strategy,
    problem: plan.problem,
    flowId: plan.flowId,
    seed: plan.seed,
    sequence,
  });
  const embedding = completeFlowEmbedding({
    flowKind: "verify",
    model,
    sequence,
    pow,
  });
  return { model, sequence, pow, embedding };
}

export function nearestStrategyCluster<T extends { id: string; centroid: number[] }>(
  vector: number[],
  clusters: readonly T[],
): T | null {
  if (!Array.isArray(vector) || !vector.length || !clusters.length) return null;
  let best: T | null = null;
  let bestScore = -Infinity;
  for (const cluster of clusters) {
    const score = cosineSimilarity(vector, cluster.centroid);
    if (score > bestScore) {
      bestScore = score;
      best = cluster;
    }
  }
  return best;
}

export function simulationSampleRunId(plan: RegionSimulationSamplePlan): string {
  const seed = plan.seed.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 24);
  return `sim_${plan.strategyId}_${plan.index}_${seed || "seed"}`.slice(0, 80);
}

export type StudioEmbeddingOrigin = "simulated" | "human";

export function studioEmbeddingOrigin(row: {
  source?: unknown;
  identity?: unknown;
}): StudioEmbeddingOrigin {
  return isSimulatedEmbedding(row) ? "simulated" : "human";
}
