import { describe, expect, it, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  allocateSamplesAcrossFlows,
  clampSamplesPerStrategy,
  coverProblems,
  customExplorationStrategyId,
  EXPLORATION_STRATEGIES,
  explorationStrategyById,
  isCustomExplorationStrategyId,
  isSimulatedEmbedding,
  matchSimulationProtocols,
  nextRegionSimulationWizardStep,
  nearestStrategyCluster,
  parseCustomExplorationStrategy,
  parseSimulationStrategies,
  protocolIdsFromRequestBody,
  parseRegionSimulationWizardStep,
  parseSimulationStrategiesWithRecovered,
  planRegionSimulationSamples,
  previousRegionSimulationWizardStep,
  regionSimulationFlowIds,
  REGION_SIMULATION_DEFAULT_SAMPLES,
  REGION_SIMULATION_FLOW_MATCH_LIMIT,
  REGION_SIMULATION_SOURCE,
  REGION_SIMULATION_WIZARD_STEPS,
  regionSimulationWizardCanAdvance,
  runRegionSimulationSample,
  seededSimulationTree,
  simulatedIdentityLabel,
  simulationClusterRegionName,
  studioEmbeddingOrigin,
  walkExplorationStrategy,
} from "@/lib/region-simulation";
import {
  addRegionSimulationSamples,
  removeRegionSimulationSamples,
  runRegionSimulation,
} from "@/lib/region-simulation-run";
import {
  listFlowEmbeddingsForOwner,
  persistCompletedFlowEmbedding,
  resetFlowEmbeddingStore,
} from "@/lib/flow-embedding-store";
import { presentDashboardKnowledgeRegions } from "@/lib/dashboard-knowledge-regions";
import {
  parseRegionSimulationClusterStrategyId,
  presentKnowledgeRegionDetails,
} from "@/lib/knowledge-region-details";

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
    expect(runRegionSimulationSample(plan, "verify").embedding.raw.flowKind).toBe("verify");
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
    expect(result.regionPath).toContain("/regions/");
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
    expect(read("lib/region-simulation-run.ts")).toContain("flowLinkDefinesReference");
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
          description: "region-simulation: 1 flows",
          subject_count: 6,
          created_at: "2026-11-09",
        },
        {
          id: "cluster",
          name: "Limits styles · Exploit-heavy",
          owner_user_id: "me",
          description: "region-simulation-cluster:exploit-heavy",
          subject_count: 3,
          created_at: "2026-11-09",
        },
      ],
      "me",
    );
    expect(regions.map((row) => row.id)).toEqual(["parent"]);
  });

  it("uses the same simulation setup for knowledge verification protocols", () => {
    const create = read("components/product-flow/knowledge-region-create.tsx");
    expect(create).toContain("RegionSimulationSetup");
    expect(create).toContain("RegionSimulationSetup");
    expect(create).not.toContain("LegacyKnowledgeRegionCreate");
    const setup = read("components/product-flow/region-simulation-setup.tsx");
    expect(setup).toContain("PRODUCT_CREATE_SHELL");
    expect(setup).toContain("FlowWizardSteps");
    expect(setup).toContain("data-region-simulation-wizard");
    expect(setup).toContain("REGION_SIMULATION_WIZARD_STEPS");
    expect(setup).toContain("sm:grid-cols-2");
    expect(setup).not.toContain("lg:grid-cols-2");
    expect(setup).not.toContain("max-w-3xl");
    expect(setup).not.toContain("max-w-5xl");
    expect(setup).not.toContain("max-w-[96rem]");
    expect(setup).not.toContain("data-region-kind");
    expect(setup).toContain("data-run-simulation");
    expect(setup).toContain("data-region-simulation-setup");
    expect(setup).toContain("data-region-simulation-review");
    expect(setup).toContain("data-region-simulation-result");
    expect(setup).toContain("Include data from real humans in these protocols");
    expect(setup).toContain("Run simulation");
    expect(setup).not.toContain("Run another simulation");
    expect(setup).toContain("Open details");
    expect(setup).toContain("data-open-region-details");
    expect(setup).toContain("productRegionPagePath");
    expect(setup).not.toContain("productRegionStudioPath");
    expect(setup).not.toContain("Open in Data Studio");
    expect(setup).toContain("data-region-simulation-progress");
    expect(setup).toContain("data-region-simulation-progress-overall");
    expect(setup).toContain("regionSimulationProgressOverall");
    expect(setup).toContain("data-region-simulation-flow-search");
    expect(setup).toContain("data-region-simulation-flow-matches");
    expect(setup).toContain("data-region-simulation-add-custom");
    expect(setup).toContain("data-region-simulation-custom-name");
    expect(setup).toContain("data-region-simulation-custom-instructions");
    expect(setup).toContain("data-region-simulation-ai-use");
    expect(setup).toContain("setAiUseCatalogIds([])");
    expect(setup).toContain("DASHBOARD_REGION_SIMULATION_JOBS_PATH");
    expect(setup).not.toContain("/api/dashboard/region-simulation/jobs");
    expect(setup).toContain("customStrategies");
    expect(setup).toContain("REGION_SIMULATION_FLOW_MATCH_LIMIT");
    expect(setup).not.toContain("kind=${kind}");
    const route = read("app/api/dashboard/region-simulation/route.ts");
    expect(route).toContain("customStrategies: body.customStrategies");
    expect(route).toContain("parseSimulationStrategies");
    expect(route).toContain("runRegionSimulation");
    expect(route).toContain("enqueueRegionSimulation");
    expect(route).toContain("defaultChecked: AI_USE_DEFAULT_CHECKED");
    expect(route).toContain("requireAuthenticatedUser");
    expect(route).toContain("listVerificationFlowsForOwnerUserId");
    expect(route).not.toContain("listSolveFlowsForOwnerUserId");
    expect(route).not.toContain("listCalibrationFlowsForOwnerUserId");
    expect(route).toContain("productFlowEmbeddingKind");
    expect(route).toContain("challenge: flow.topic");
    expect(route).toContain("protocols: listed");
    expect(route).toContain("protocolIdsFromRequestBody");
    expect(route).not.toContain("body.flowIds");
    expect(route).not.toContain("flow.goal");
    expect(read("app/regions/new/page.tsx")).toContain("KnowledgeRegionCreate");
  });

  it("advances create-region wizard steps with the same chrome as protocol create", () => {
    expect([...REGION_SIMULATION_WIZARD_STEPS]).toEqual([
      "name",
      "protocols",
      "explore",
      "ai-use",
      "run",
    ]);
    expect(parseRegionSimulationWizardStep("explore")).toBe("explore");
    expect(parseRegionSimulationWizardStep("nope")).toBe("name");
    expect(nextRegionSimulationWizardStep("name")).toBe("protocols");
    expect(nextRegionSimulationWizardStep("run")).toBe("run");
    expect(previousRegionSimulationWizardStep("protocols")).toBe("name");
    expect(previousRegionSimulationWizardStep("name")).toBe("name");
    expect(
      regionSimulationWizardCanAdvance("name", { name: "", protocolIds: [], strategyIds: [] }),
    ).toBe(false);
    expect(
      regionSimulationWizardCanAdvance("name", { name: "Limits", protocolIds: [], strategyIds: [] }),
    ).toBe(true);
    expect(
      regionSimulationWizardCanAdvance("protocols", {
        name: "Limits",
        protocolIds: [],
        strategyIds: ["balanced"],
      }),
    ).toBe(false);
    expect(
      regionSimulationWizardCanAdvance("protocols", {
        name: "Limits",
        protocolIds: ["flow-1"],
        strategyIds: [],
      }),
    ).toBe(true);
    expect(
      regionSimulationWizardCanAdvance("explore", {
        name: "Limits",
        protocolIds: ["flow-1"],
        strategyIds: [],
      }),
    ).toBe(false);
    expect(
      regionSimulationWizardCanAdvance("ai-use", {
        name: "Limits",
        protocolIds: ["flow-1"],
        strategyIds: ["balanced"],
      }),
    ).toBe(true);
    expect(
      regionSimulationWizardCanAdvance("run", {
        name: "Limits",
        protocolIds: ["flow-1"],
        strategyIds: ["balanced"],
      }),
    ).toBe(true);
    expect(protocolIdsFromRequestBody({ protocolIds: [" p1 ", "", "p2"] })).toEqual(["p1", "p2"]);
    expect(protocolIdsFromRequestBody({ flowIds: ["legacy"] })).toEqual([]);
  });

  it("stores protocol simulations on verification embeddings", async () => {
    const result = await runRegionSimulation({
      ownerUserId: "owner-proto",
      name: "Gaussian packet",
      flows: [{ id: "flow-s", name: "Normalize", problems: ["Find A"] }],
      strategyIds: ["exploit-heavy"],
      samplesPerStrategy: 3,
      includeHumanData: false,
    });
    expect(result.regionPath).toContain("/regions/");
    const stored = await listFlowEmbeddingsForOwner({
      ownerUserId: "owner-proto",
      flowKind: "verify",
    });
    expect(stored.filter((row) => row.source === REGION_SIMULATION_SOURCE)).toHaveLength(3);
  });

  it("matches a short list of flows from a search query", () => {
    const flows = [
      { id: "1", name: "Limits", topic: "calc" },
      { id: "2", name: "Integrals", topic: "calc" },
      { id: "3", name: "Series", topic: "calc" },
      { id: "4", name: "ODE", topic: "diff" },
      { id: "5", name: "PDE", topic: "diff" },
      { id: "6", name: "Algebra", topic: "alg" },
    ];
    expect(REGION_SIMULATION_FLOW_MATCH_LIMIT).toBe(4);
    expect(matchSimulationProtocols(flows, "").map((flow) => flow.id)).toEqual(["1", "2", "3", "4"]);
    expect(matchSimulationProtocols(flows, "diff").map((flow) => flow.id)).toEqual(["4", "5"]);
    expect(matchSimulationProtocols(flows, "algebra").map((flow) => flow.id)).toEqual(["6"]);
    expect(matchSimulationProtocols(flows, "missing")).toEqual([]);
  });

  it("parses custom exploration strategies as simulation prompts", () => {
    expect(parseCustomExplorationStrategy({ name: "Cautious" })).toBeNull();
    expect(parseCustomExplorationStrategy({ instructions: "Go slow." })).toBeNull();
    const parsed = parseCustomExplorationStrategy({
      name: "Cautious",
      prompt: "Ask more questions before you commit to an answer.",
    });
    expect(parsed?.name).toBe("Cautious");
    expect(parsed?.instructions).toContain("Ask more questions");
    expect(isCustomExplorationStrategyId(parsed?.id)).toBe(true);
    expect(parsed?.id).toBe(
      customExplorationStrategyId("Cautious", "Ask more questions before you commit to an answer."),
    );
    const mixed = parseSimulationStrategies({
      strategyIds: ["exploit-heavy", parsed!.id, "unknown"],
      customStrategies: [parsed],
    });
    expect(mixed.map((row) => row.id)).toEqual(["exploit-heavy", parsed!.id]);
    expect(mixed[1]?.instructions).toContain("Ask more questions");
  });

  it("walks a custom strategy from its prompt and stores the instructions", async () => {
    const custom = parseCustomExplorationStrategy({
      name: "Cautious",
      instructions: "Take the slowest path and ask more questions before answering.",
    })!;
    const other = parseCustomExplorationStrategy({
      name: "Impulsive",
      instructions: "Commit immediately to the cheapest first step and stop.",
    })!;
    expect(custom.id).not.toBe(other.id);
    const plan = planRegionSimulationSamples({
      flowIds: ["flow-a"],
      problemsByFlowId: { "flow-a": ["What is a limit?"] },
      strategyIds: [custom.id],
      samplesPerStrategy: 3,
    })[0]!;
    const walk = runRegionSimulationSample(plan, "verify", [custom]);
    expect(walk.pow[0]?.metadata?.strategyId).toBe(custom.id);
    expect(walk.pow[0]?.metadata?.instructions).toBe(custom.instructions);
    expect(custom.params).not.toEqual(other.params);

    const result = await runRegionSimulation({
      ownerUserId: "owner-custom",
      name: "Custom styles",
      flows: [{ id: "flow-a", name: "Limits", problems: ["ε-δ"] }],
      strategyIds: [custom.id],
      customStrategies: [custom],
      samplesPerStrategy: 3,
      includeHumanData: false,
    });
    expect(result.clusters.map((cluster) => cluster.strategyName)).toEqual(["Cautious"]);
    expect(result.clusters[0]?.strategyId).toBe(custom.id);
    expect(result.summary.simulatedCount).toBe(3);
    expect(
      parseRegionSimulationClusterStrategyId(`region-simulation-cluster:${custom.id}`),
    ).toBe(custom.id);
  });

  it("stores leftover calibration-named simulations as verification embeddings", async () => {
    const result = await runRegionSimulation({
      ownerUserId: "owner-cal",
      name: "Limits scout",
      flows: [{ id: "flow-c", name: "Scout", problems: ["What is a limit?"] }],
      strategyIds: ["balanced"],
      samplesPerStrategy: 3,
      includeHumanData: false,
    });
    expect(result.regionPath).toContain("/regions/");
    const stored = await listFlowEmbeddingsForOwner({
      ownerUserId: "owner-cal",
      flowKind: "verify",
    });
    expect(stored.filter((row) => row.source === REGION_SIMULATION_SOURCE)).toHaveLength(3);
  });

  it("adds custom simulated samples to an existing region and removes them", async () => {
    await persistCompletedFlowEmbedding({
      ownerUserId: "owner-mutate",
      flowKind: "verify",
      flowId: "flow-a",
      runId: "human-mutate",
      identity: "ada",
      source: "runner",
      pow: [{ type: "speech", tool_name: "runner", timestamp_ms: 1, payload: "real proof" }],
    });
    const flows = [{ id: "flow-a", name: "Limits", problems: ["ε-δ"] }];
    const created = await runRegionSimulation({
      ownerUserId: "owner-mutate",
      name: "Limits styles",
      flows,
      strategyIds: ["exploit-heavy"],
      samplesPerStrategy: 3,
      includeHumanData: true,
    });
    const regionId = created.id || "limits-mutate";
    const custom = parseCustomExplorationStrategy({
      name: "Cautious",
      instructions: "Ask more questions before you commit to an answer.",
    })!;
    const added = await addRegionSimulationSamples({
      ownerUserId: "owner-mutate",
      regionId,
      name: "Limits styles",
      flows,
      strategyIds: [custom.id],
      customStrategies: [custom],
      samplesPerStrategy: 3,
    });
    expect(added.id).toBe(regionId);
    expect(added.addedSampleIds).toHaveLength(3);
    expect(added.clusters.map((cluster) => cluster.strategyName).sort()).toEqual([
      "Cautious",
      "Exploit-heavy",
    ]);
    const afterAdd = await listFlowEmbeddingsForOwner({
      ownerUserId: "owner-mutate",
      flowKind: "verify",
    });
    const simulatedAfterAdd = afterAdd.filter((row) => row.source === REGION_SIMULATION_SOURCE);
    expect(simulatedAfterAdd).toHaveLength(6);
    expect(
      simulatedAfterAdd.every(
        (row) =>
          row.source === REGION_SIMULATION_SOURCE &&
          String(row.identity).startsWith("Simulated ·"),
      ),
    ).toBe(true);
    expect(simulatedAfterAdd.filter((row) => row.identity === "Simulated · Cautious")).toHaveLength(
      3,
    );
    expect(afterAdd.some((row) => row.identity === "ada" && row.source === "runner")).toBe(true);

    const addedDetails = presentKnowledgeRegionDetails({
      parent: added.parentRow,
      clusters: added.clusterRows,
      embeddings: afterAdd,
      flowNames: { "flow-a": "Limits" },
    });
    expect(addedDetails?.id).toBe(regionId);
    expect(addedDetails?.simulatedCount).toBe(6);
    expect(addedDetails?.strategies.map((row) => row.name).sort()).toEqual([
      "Cautious",
      "Exploit-heavy",
    ]);
    expect(addedDetails?.clusters.find((row) => row.strategyName === "Cautious")?.sampleCount).toBe(
      3,
    );
    expect(
      addedDetails?.samples.filter((row) => row.identity === "Simulated · Cautious"),
    ).toHaveLength(3);
    expect(addedDetails?.samples.some((row) => row.identity === "ada")).toBe(true);

    const cautiousIds = simulatedAfterAdd
      .filter((row) => row.identity === "Simulated · Cautious")
      .map((row) => row.id);
    const removedSampleId = cautiousIds[0]!;
    const afterSampleRemove = await removeRegionSimulationSamples({
      ownerUserId: "owner-mutate",
      regionId,
      name: "Limits styles",
      flows,
      sampleIds: [removedSampleId],
    });
    expect(afterSampleRemove.removedSampleIds).toContain(removedSampleId);
    const afterOneGone = await listFlowEmbeddingsForOwner({
      ownerUserId: "owner-mutate",
      flowKind: "verify",
    });
    expect(afterOneGone.some((row) => row.id === removedSampleId)).toBe(false);
    expect(afterOneGone.some((row) => row.identity === "ada")).toBe(true);

    const afterClusterRemove = await removeRegionSimulationSamples({
      ownerUserId: "owner-mutate",
      regionId,
      name: "Limits styles",
      flows,
      strategyIds: ["exploit-heavy"],
    });
    expect(afterClusterRemove.clusters.map((cluster) => cluster.strategyName)).toEqual(["Cautious"]);
    const leftover = await listFlowEmbeddingsForOwner({
      ownerUserId: "owner-mutate",
      flowKind: "verify",
    });
    const leftoverSimulated = leftover.filter((row) => row.source === REGION_SIMULATION_SOURCE);
    expect(leftoverSimulated.every((row) => row.identity === "Simulated · Cautious")).toBe(true);
    expect(leftoverSimulated).toHaveLength(2);
    expect(leftoverSimulated.some((row) => row.id === removedSampleId)).toBe(false);
    expect(leftover.some((row) => row.identity === "ada" && row.source === "runner")).toBe(true);

    const removedDetails = presentKnowledgeRegionDetails({
      parent: afterClusterRemove.parentRow,
      clusters: afterClusterRemove.clusterRows,
      embeddings: leftover,
      flowNames: { "flow-a": "Limits" },
    });
    expect(removedDetails?.simulatedCount).toBe(2);
    expect(removedDetails?.strategies.map((row) => row.name)).toEqual(["Cautious"]);
    expect(removedDetails?.samples.map((row) => row.id)).not.toContain(removedSampleId);
    expect(
      removedDetails?.samples.some((row) => row.identity === "Simulated · Exploit-heavy"),
    ).toBe(false);
    expect(removedDetails?.samples.some((row) => row.identity === "ada")).toBe(true);
    expect(
      leftoverSimulated.map((row) => row.identity).sort(),
    ).toEqual(["Simulated · Cautious", "Simulated · Cautious"]);
  });

  it("keeps mutate flows on this region's seed and cluster embeddings", () => {
    const ids = regionSimulationFlowIds({
      seedFlowId: "flow-a",
      embeddings: [
        {
          flow_id: "flow-a",
          source: REGION_SIMULATION_SOURCE,
          identity: "Simulated · Exploit-heavy",
        },
        {
          flow_id: "flow-b",
          source: REGION_SIMULATION_SOURCE,
          identity: "Simulated · Exploit-heavy",
        },
        {
          flow_id: "flow-c",
          source: "runner",
          identity: "ada",
        },
      ],
      strategies: [{ id: "exploit-heavy", name: "Exploit-heavy" }],
    });
    expect(ids).toEqual(["flow-a"]);
    const route = read("app/api/dashboard/knowledge-regions/[id]/simulation/route.ts");
    expect(route).toContain("regionSimulationFlowIds");
    expect(route).toContain("parseSimulationStrategiesWithRecovered");
    expect(route).not.toContain("listVerificationFlowsForOwnerUserId");
    expect(route).not.toContain("listSolveFlowsForOwnerUserId");
  });

  it("remove on region A leaves region B samples of the same strategy", async () => {
    const flowA = { id: "flow-a", name: "Limits", problems: ["ε-δ"] };
    const flowB = { id: "flow-b", name: "Series", problems: ["sum"] };
    await runRegionSimulation({
      ownerUserId: "owner-isolate",
      name: "Region A",
      flows: [flowA],
      strategyIds: ["exploit-heavy"],
      samplesPerStrategy: 3,
      includeHumanData: false,
    });
    await runRegionSimulation({
      ownerUserId: "owner-isolate",
      name: "Region B",
      flows: [flowB],
      strategyIds: ["exploit-heavy"],
      samplesPerStrategy: 3,
      includeHumanData: false,
    });
    const before = await listFlowEmbeddingsForOwner({
      ownerUserId: "owner-isolate",
      flowKind: "verify",
    });
    expect(
      before.filter(
        (row) => row.flow_id === "flow-b" && row.source === REGION_SIMULATION_SOURCE,
      ),
    ).toHaveLength(3);
    await removeRegionSimulationSamples({
      ownerUserId: "owner-isolate",
      regionId: "region-a",
      name: "Region A",
      flows: [flowA, flowB],
      strategyIds: ["exploit-heavy"],
    });
    const leftover = await listFlowEmbeddingsForOwner({
      ownerUserId: "owner-isolate",
      flowKind: "verify",
    });
    expect(
      leftover.filter(
        (row) => row.flow_id === "flow-a" && row.source === REGION_SIMULATION_SOURCE,
      ),
    ).toHaveLength(0);
    expect(
      leftover.filter(
        (row) => row.flow_id === "flow-b" && row.source === REGION_SIMULATION_SOURCE,
      ),
    ).toHaveLength(3);
    expect(
      leftover
        .filter((row) => row.flow_id === "flow-b")
        .every((row) => row.identity === "Simulated · Exploit-heavy"),
    ).toBe(true);
  });

  it("adds more samples of an existing custom strategy from recovered instructions", async () => {
    const custom = parseCustomExplorationStrategy({
      name: "Cautious",
      instructions: "Ask more questions before you commit to an answer.",
    })!;
    expect(
      parseSimulationStrategies({ strategyIds: [custom.id] }).map((row) => row.id),
    ).toEqual([]);
    const flows = [{ id: "flow-a", name: "Limits", problems: ["ε-δ"] }];
    await runRegionSimulation({
      ownerUserId: "owner-custom-again",
      name: "Limits styles",
      flows,
      strategyIds: [custom.id],
      customStrategies: [custom],
      samplesPerStrategy: 3,
      includeHumanData: false,
    });
    const stored = await listFlowEmbeddingsForOwner({
      ownerUserId: "owner-custom-again",
      flowKind: "verify",
    });
    const recovered = parseSimulationStrategiesWithRecovered({
      strategyIds: [custom.id],
      embeddings: stored,
    });
    expect(recovered.map((row) => row.id)).toEqual([custom.id]);
    expect(recovered[0]?.instructions).toContain("Ask more questions");
    const added = await addRegionSimulationSamples({
      ownerUserId: "owner-custom-again",
      regionId: "limits-custom-again",
      name: "Limits styles",
      flows,
      strategyIds: [custom.id],
      samplesPerStrategy: 3,
    });
    expect(added.addedSampleIds).toHaveLength(3);
    expect(added.clusters.map((cluster) => cluster.strategyName)).toEqual(["Cautious"]);
    const after = await listFlowEmbeddingsForOwner({
      ownerUserId: "owner-custom-again",
      flowKind: "verify",
    });
    expect(after.filter((row) => row.identity === "Simulated · Cautious")).toHaveLength(6);
    const detailsPage = read("components/product-flow/knowledge-region-page.tsx");
    expect(detailsPage).toContain("explorationStrategyFromSimulatedEmbedding");
    expect(detailsPage).toContain("recoveredCustomStrategies");
  });

  it("exposes add simulated data on the region edit view", () => {
    const detailsPage = read("components/product-flow/knowledge-region-page.tsx");
    expect(detailsPage).toContain("data-knowledge-region-details");
    expect(detailsPage).toContain("data-knowledge-region-edit");
    expect(detailsPage).toContain("data-knowledge-region-add-simulation");
    expect(detailsPage).toContain("data-knowledge-region-add-custom");
    expect(detailsPage).toContain("data-knowledge-region-custom-name");
    expect(detailsPage).toContain("data-knowledge-region-custom-instructions");
    expect(detailsPage).toContain("data-knowledge-region-trash");
    expect(detailsPage).not.toContain("data-knowledge-region-remove-simulated");
    expect(detailsPage).not.toContain("data-knowledge-region-remove-cluster");
    expect(read("components/product-flow/region-simulation-setup.tsx")).toContain(
      "data-run-simulation",
    );
    expect(read("lib/region-simulation-run.ts")).toContain("export async function trashRegionSimulation");
    expect(read("app/api/dashboard/knowledge-regions/[id]/route.ts")).not.toContain(
      "deleteFlowEmbeddings",
    );
    expect(read("app/api/dashboard/knowledge-regions/[id]/simulation/route.ts")).toContain(
      "addRegionSimulationSamples",
    );
    expect(read("app/api/dashboard/knowledge-regions/[id]/simulation/route.ts")).not.toContain(
      "removeRegionSimulationSamples",
    );
  });
});
