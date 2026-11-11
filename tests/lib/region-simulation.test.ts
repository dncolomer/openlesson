import { describe, expect, it, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  allocateSamplesAcrossFlows,
  clampSamplesPerStrategy,
  coverProblems,
  EXPLORATION_STRATEGIES,
  explorationStrategyById,
  isSimulatedEmbedding,
  nearestStrategyCluster,
  planRegionSimulationSamples,
  REGION_SIMULATION_DEFAULT_SAMPLES,
  REGION_SIMULATION_SOURCE,
  runRegionSimulationSample,
  seededSimulationTree,
  simulatedIdentityLabel,
  simulationClusterRegionName,
  studioEmbeddingOrigin,
  walkExplorationStrategy,
} from "@/lib/region-simulation";
import { runRegionSimulation } from "@/lib/region-simulation-run";
import {
  listFlowEmbeddingsForOwner,
  persistCompletedFlowEmbedding,
  resetFlowEmbeddingStore,
} from "@/lib/flow-embedding-store";
import { presentDashboardKnowledgeRegions } from "@/lib/dashboard-knowledge-regions";

const ROOT = join(__dirname, "../..");

function read(path: string): string {
  return readFileSync(join(ROOT, path), "utf8");
}

describe("region simulation", () => {
  beforeEach(() => {
    resetFlowEmbeddingStore("memory");
  });

  it("publishes a short active-inference catalog with instructions", () => {
    expect(EXPLORATION_STRATEGIES.map((row) => row.id)).toEqual([
      "exploit-heavy",
      "information-seeking",
      "novelty-seeking",
      "balanced",
      "narrow-and-deep",
    ]);
    for (const strategy of EXPLORATION_STRATEGIES) {
      expect(strategy.description.length).toBeGreaterThan(10);
      expect(strategy.instructions.length).toBeGreaterThan(20);
    }
    expect(explorationStrategyById("exploit-heavy")?.name).toBe("Exploit-heavy");
    expect(REGION_SIMULATION_DEFAULT_SAMPLES).toBe(12);
    expect(clampSamplesPerStrategy(1)).toBe(3);
    expect(clampSamplesPerStrategy(99)).toBe(48);
  });

  it("spreads samples evenly across flows and covers problems round-robin", () => {
    expect(allocateSamplesAcrossFlows(["a", "b", "c"], 30)).toEqual([10, 10, 10]);
    expect(allocateSamplesAcrossFlows(["a", "b", "c"], 31)).toEqual([11, 10, 10]);
    expect(coverProblems(["p1", "p2"], 5).map((row) => row.problemIndex)).toEqual([
      0, 1, 0, 1, 0,
    ]);
    const plans = planRegionSimulationSamples({
      flowIds: ["f1", "f2", "f3"],
      problemsByFlowId: {
        f1: ["one"],
        f2: ["two", "two-b"],
        f3: ["three"],
      },
      strategyIds: ["exploit-heavy", "balanced"],
      samplesPerStrategy: 30,
    });
    expect(plans).toHaveLength(60);
    for (const strategyId of ["exploit-heavy", "balanced"]) {
      const rows = plans.filter((plan) => plan.strategyId === strategyId);
      expect(rows).toHaveLength(30);
      expect(rows.filter((plan) => plan.flowId === "f1")).toHaveLength(10);
      expect(rows.filter((plan) => plan.flowId === "f2")).toHaveLength(10);
      expect(rows.filter((plan) => plan.flowId === "f3")).toHaveLength(10);
    }
    const f2 = plans.filter(
      (plan) => plan.strategyId === "exploit-heavy" && plan.flowId === "f2",
    );
    expect(new Set(f2.map((plan) => plan.problemIndex)).size).toBe(2);
    expect(plans.every((plan) => plan.seed.includes(plan.strategyId))).toBe(true);
  });

  it("walks each strategy on a seeded tree and labels the sample simulated", () => {
    const plan = planRegionSimulationSamples({
      flowIds: ["flow-a"],
      problemsByFlowId: { "flow-a": ["What is a limit?"] },
      strategyIds: ["exploit-heavy"],
      samplesPerStrategy: 3,
    })[0]!;
    const walk = runRegionSimulationSample(plan);
    expect(walk.sequence.length).toBeGreaterThan(0);
    expect(walk.embedding.raw.flowKind).toBe("verify");
    expect(runRegionSimulationSample(plan, "solve").embedding.raw.flowKind).toBe("solve");
    expect(walk.pow[0]?.tool_name).toBe(REGION_SIMULATION_SOURCE);
    expect(walk.pow[0]?.metadata?.simulated).toBe(true);
    expect(walk.pow[0]?.metadata?.strategyId).toBe("exploit-heavy");
    expect(walk.pow[0]?.metadata?.seed).toBe(plan.seed);
    expect(walk.pow[0]?.metadata?.instructions).toContain("cheapest");
    expect(simulatedIdentityLabel("Exploit-heavy")).toBe("Simulated · Exploit-heavy");
    expect(
      isSimulatedEmbedding({
        source: REGION_SIMULATION_SOURCE,
        identity: simulatedIdentityLabel("Exploit-heavy"),
      }),
    ).toBe(true);
    expect(studioEmbeddingOrigin({ source: "runner", identity: "ada" })).toBe("human");

    const tree = seededSimulationTree({
      problem: "What is a limit?",
      seed: "same-seed",
      strategyId: "exploit-heavy",
    });
    const exploit = walkExplorationStrategy({
      model: tree,
      strategy: explorationStrategyById("exploit-heavy")!,
      seed: "same-seed",
    });
    const info = walkExplorationStrategy({
      model: tree,
      strategy: explorationStrategyById("information-seeking")!,
      seed: "same-seed",
    });
    expect(exploit.join(">")).not.toBe(info.join(">"));
    const again = runRegionSimulationSample(plan);
    expect(again.sequence).toEqual(walk.sequence);
  });

  it("runs the requested samples per strategy and keeps humans out of strategy clusters", async () => {
    await persistCompletedFlowEmbedding({
      ownerUserId: "owner-1",
      flowKind: "verify",
      flowId: "flow-a",
      runId: "human-1",
      identity: "ada",
      source: "runner",
      pow: [{ type: "speech", tool_name: "runner", timestamp_ms: 1, payload: "real proof" }],
    });
    const ticks: number[] = [];
    const result = await runRegionSimulation({
      ownerUserId: "owner-1",
      name: "Limits styles",
      flows: [{ id: "flow-a", name: "Limits", problems: ["ε-δ"] }],
      strategyIds: ["exploit-heavy", "balanced"],
      samplesPerStrategy: 3,
      includeHumanData: true,
      onProgress: (progress) => {
        ticks.push(progress.reduce((sum, row) => sum + row.done, 0));
      },
    });
    expect(result.summary.samplesPerStrategy).toBe(3);
    expect(result.summary.simulatedCount).toBe(6);
    expect(result.summary.realSessionCount).toBe(1);
    expect(result.clusters.map((cluster) => cluster.strategyName).sort()).toEqual([
      "Balanced",
      "Exploit-heavy",
    ]);
    expect(result.regionPath).toContain("/verification/regions/");
    expect(result.studioPath).toContain("verification_studio");
    expect(result.clusters.every((cluster) => cluster.sampleCount === 3)).toBe(true);
    expect(result.progress.every((row) => row.done === 3 && row.total === 3)).toBe(true);
    expect(ticks.at(-1)).toBe(6);
    const stored = await listFlowEmbeddingsForOwner({
      ownerUserId: "owner-1",
      flowKind: "verify",
    });
    const simulated = stored.filter((row) => row.source === REGION_SIMULATION_SOURCE);
    expect(simulated).toHaveLength(6);
    expect(simulated.every((row) => String(row.identity).startsWith("Simulated ·"))).toBe(true);
    expect(simulationClusterRegionName("Limits styles", "Exploit-heavy")).toBe(
      "Limits styles · Exploit-heavy",
    );
    const nearest = nearestStrategyCluster([1, 0], [
      { id: "a", centroid: [1, 0] },
      { id: "b", centroid: [0, 1] },
    ]);
    expect(nearest?.id).toBe("a");
  });

  it("hides strategy clusters from the knowledge-region table", () => {
    const regions = presentDashboardKnowledgeRegions(
      [
        {
          id: "parent",
          name: "Limits styles",
          owner_user_id: "me",
          product: "verification",
          description: "region-simulation: 1 flows",
          subject_count: 6,
          created_at: "2026-11-09",
        },
        {
          id: "cluster",
          name: "Limits styles · Exploit-heavy",
          owner_user_id: "me",
          product: "verification",
          description: "region-simulation-cluster:exploit-heavy",
          subject_count: 3,
          created_at: "2026-11-09",
        },
      ],
      "verification",
      "me",
    );
    expect(regions.map((row) => row.id)).toEqual(["parent"]);
  });

  it("uses the same simulation setup for Verification, Calibration, and Solve", () => {
    const create = read("components/product-flow/knowledge-region-create.tsx");
    expect(create).toContain("RegionSimulationSetup");
    expect(create).toContain("kind={kind}");
    expect(create).not.toContain("LegacyKnowledgeRegionCreate");
    const setup = read("components/product-flow/region-simulation-setup.tsx");
    expect(setup).toContain("data-run-simulation");
    expect(setup).toContain("data-region-simulation-setup");
    expect(setup).toContain("data-region-simulation-result");
    expect(setup).toContain("Include data from real humans in these flows");
    expect(setup).toContain("Run simulation");
    expect(setup).not.toContain("Run another simulation");
    expect(setup).toContain("Open details");
    expect(setup).toContain("data-open-region-details");
    expect(setup).toContain("productRegionPagePath");
    expect(setup).toContain("productRegionStudioPath");
    expect(setup).toContain("data-region-simulation-progress");
    expect(setup).toContain("kind=${kind}");
    const route = read("app/api/dashboard/region-simulation/route.ts");
    expect(route).toContain("runRegionSimulation");
    expect(route).toContain("requireAuthenticatedUser");
    expect(route).toContain("listSolveFlowsForOwnerUserId");
    expect(route).toContain("listCalibrationFlowsForOwnerUserId");
    expect(route).toContain("productFlowEmbeddingKind");
    expect(route).toContain("topic: flow.topic");
    expect(route).not.toContain("flow.goal");
    expect(read("app/verification/regions/new/page.tsx")).toContain('kind="verification"');
    expect(read("app/calibration/regions/new/page.tsx")).toContain('kind="calibration"');
    expect(read("app/solve/regions/new/page.tsx")).toContain('kind="solve"');
  });

  it("stores Solve simulations on solve embeddings", async () => {
    const result = await runRegionSimulation({
      ownerUserId: "owner-solve",
      name: "Gaussian packet",
      kind: "solve",
      flows: [{ id: "flow-s", name: "Normalize", problems: ["Find A"] }],
      strategyIds: ["exploit-heavy"],
      samplesPerStrategy: 3,
      includeHumanData: false,
    });
    expect(result.regionPath).toContain("/solve/regions/");
    expect(result.studioPath).toContain("solve_studio");
    const stored = await listFlowEmbeddingsForOwner({
      ownerUserId: "owner-solve",
      flowKind: "solve",
    });
    expect(stored.filter((row) => row.source === REGION_SIMULATION_SOURCE)).toHaveLength(3);
  });

  it("stores Calibration simulations on calibrate embeddings", async () => {
    const result = await runRegionSimulation({
      ownerUserId: "owner-cal",
      name: "Limits scout",
      kind: "calibration",
      flows: [{ id: "flow-c", name: "Scout", problems: ["What is a limit?"] }],
      strategyIds: ["balanced"],
      samplesPerStrategy: 3,
      includeHumanData: false,
    });
    expect(result.regionPath).toContain("/calibration/regions/");
    expect(result.studioPath).toContain("calibration_studio");
    const stored = await listFlowEmbeddingsForOwner({
      ownerUserId: "owner-cal",
      flowKind: "calibrate",
    });
    expect(stored.filter((row) => row.source === REGION_SIMULATION_SOURCE)).toHaveLength(3);
  });
});
