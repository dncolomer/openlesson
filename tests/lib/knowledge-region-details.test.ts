import { describe, expect, it } from "vitest";
import {
  FLOW_EMBEDDING_PATH_TEXT_MODEL_ID,
} from "@/lib/flow-embedding";
import { encodeFlowEmbedding, encodeFlowRaw, encodeTextsToFlowVector } from "@/lib/flow-embedding-encode";
import {
  inspectStudioEmbedding,
  type DataStudioEmbeddingRow,
} from "@/lib/data-studio-view";
import {
  inspectKnowledgeRegionSample,
  parseRegionSimulationDescription,
  presentKnowledgeRegionClusters,
  presentKnowledgeRegionDetails,
} from "@/lib/knowledge-region-details";

async function embeddingRow(input: {
  id: string;
  identity: string;
  source: string;
  flowId?: string;
  runId?: string;
  flowKind?: string;
  prompt: string;
}) : Promise<DataStudioEmbeddingRow> {
  const record = await encodeFlowEmbedding({
    flowKind: (input.flowKind as "verify" | "calibrate" | "solve") || "verify",
    pow: [
      {
        type: "tool",
        tool_name: input.source,
        tool_action: "speech_stop",
        timestamp_ms: 1,
        payload: input.prompt,
        metadata: { transcript: input.prompt, text: input.prompt },
      },
    ],
  });
  return {
    id: input.id,
    workspace_id: "ws-1",
    owner_user_id: "me",
    flow_kind: input.flowKind || "verify",
    flow_id: input.flowId ?? "flow-a",
    run_id: input.runId ?? input.id,
    identity: input.identity,
    source: input.source,
    vector: record.vector,
    raw: record.raw,
    embedding_model_id: record.embedding_model_id,
    created_at: "2026-11-09T00:00:00.000Z",
  };
}

describe("knowledge region details", () => {
  it("parses the persisted simulation description", async () => {
    expect(
      parseRegionSimulationDescription(
        "region-simulation: 2 flows · Exploit-heavy, Balanced · 3/strategy · 1 real",
      ),
    ).toEqual({
      flowCount: 2,
      strategyNames: ["Exploit-heavy", "Balanced"],
      samplesPerStrategy: 3,
      realSessionCount: 1,
    });
  });

  it("presents name, flows, strategies, samples, and clusters for one region", async () => {
    const simulated = await embeddingRow({
      id: "sim-1",
      identity: "Simulated · Exploit-heavy",
      source: "simulated",
      runId: "sim_exploit-heavy_0_seed",
      prompt: "agent walk",
    });
    const balanced = await embeddingRow({
      id: "sim-2",
      identity: "Simulated · Balanced",
      source: "simulated",
      runId: "sim_balanced_0_seed",
      prompt: "balanced walk",
    });
    const human = await embeddingRow({
      id: "human-1",
      identity: "ada",
      source: "runner",
      runId: "human-1",
      prompt: "real proof",
    });
    const outsider = await embeddingRow({
      id: "other-sim",
      identity: "Simulated · Novelty-seeking",
      source: "simulated",
      runId: "sim_novelty-seeking_0_seed",
      prompt: "other region",
    });
    const otherRegionSameStrategy = await embeddingRow({
      id: "sim-other-region",
      identity: "Simulated · Exploit-heavy",
      source: "simulated",
      flowId: "flow-b",
      runId: "sim_exploit-heavy_0_otherseed",
      prompt: "other region's exploit walk",
    });
    otherRegionSameStrategy.vector = simulated.vector;
    const otherFlowHuman = await embeddingRow({
      id: "ada-other-flow",
      identity: "ada",
      source: "runner",
      flowId: "flow-b",
      runId: "ada-other",
      prompt: "other test",
    });
    otherFlowHuman.vector = simulated.vector;
    const humanInRegion = { ...human, vector: simulated.vector };
    const candidate = await embeddingRow({
      id: "human-2",
      identity: "bea",
      source: "runner",
      runId: "human-2",
      prompt: "later session",
    });
    const candidateInRegion = { ...candidate, vector: simulated.vector };
    const details = presentKnowledgeRegionDetails({
      flowNames: { "flow-a": "Limits" },
      parent: {
        id: "parent",
        name: "Limits styles",
        description: "region-simulation: 1 flows · Exploit-heavy, Balanced · 3/strategy · 1 real",
        owner_user_id: "me",
        workspace_id: "ws-1",
        subject_count: 7,
        created_at: "2026-11-09",
        verify_flow_id: "flow-a",
        centroid: simulated.vector,
        cosine_threshold: 0.5,
        subjects: [{ label: "ada" }],
      },
      clusters: [
        {
          id: "c-exploit",
          name: "Limits styles · Exploit-heavy",
          description: "region-simulation-cluster:exploit-heavy",
          owner_user_id: "me",
          subject_count: 3,
          centroid: simulated.vector,
          cosine_threshold: 0.5,
        },
        {
          id: "c-balanced",
          name: "Limits styles · Balanced",
          description: "region-simulation-cluster:balanced",
          owner_user_id: "me",
          subject_count: 3,
          centroid: balanced.vector,
          cosine_threshold: 0.5,
        },
        {
          id: "c-voice",
          name: "Limits styles · Exploit-heavy · Path + Text",
          description: "region-simulation-cluster:exploit-heavy",
          embedding_model_id: FLOW_EMBEDDING_PATH_TEXT_MODEL_ID,
          subject_count: 3,
        },
      ],
      embeddings: [
        simulated,
        balanced,
        humanInRegion,
        candidateInRegion,
        outsider,
        otherRegionSameStrategy,
        otherFlowHuman,
      ],
    });
    expect(details).not.toBeNull();
    expect(details?.name).toBe("Limits styles");
    expect(details?.description).toContain("region-simulation:");
    expect(details?.flows).toEqual([{ id: "flow-a", name: "Limits" }]);
    expect(details?.strategies.map((row) => row.name).sort()).toEqual(["Balanced", "Exploit-heavy"]);
    expect(details?.samplesPerStrategy).toBe(3);
    expect(details?.clusters.map((row) => row.strategyName).sort()).toEqual([
      "Balanced",
      "Exploit-heavy",
    ]);
    expect(details?.samples.map((row) => row.id).sort()).toEqual([
      "human-1",
      "human-2",
      "sim-1",
      "sim-2",
    ]);
    expect(details?.samples.some((row) => row.id === "sim-other-region")).toBe(false);
    expect(details?.samples.some((row) => row.id === "ada-other-flow")).toBe(false);
    expect(details?.simulatedCount).toBe(2);
    expect(details?.cohortCount).toBe(1);
    expect(details?.analysisCount).toBe(1);
    expect(details?.realSessionCount).toBe(2);
    expect(details?.samples.find((row) => row.id === "human-1")?.pointKind).toBe("cohort");
    expect(details?.samples.find((row) => row.id === "human-2")?.pointKind).toBe("analysis");
    expect(details?.regionPath).toBe("/regions/parent");

    const simulatedInspect = inspectKnowledgeRegionSample(
      details?.samples.find((row) => row.id === "sim-1"),
    );
    const studioSimulated = inspectStudioEmbedding(simulated);
    expect(simulatedInspect?.identity).toBe("Simulated · Exploit-heavy");
    expect(simulatedInspect?.origin).toBe("simulated");
    expect(simulatedInspect?.flow_id).toBe("flow-a");
    expect(simulatedInspect?.run_id).toBe("sim_exploit-heavy_0_seed");
    expect(simulatedInspect?.pow.length).toBeGreaterThan(0);
    expect(simulatedInspect?.transcripts.length).toBeGreaterThan(0);
    expect(simulatedInspect).toEqual(studioSimulated);

    const realInspect = inspectKnowledgeRegionSample(
      details?.samples.find((row) => row.id === "human-1"),
    );
    const studioReal = inspectStudioEmbedding(humanInRegion);
    expect(realInspect?.identity).toBe("ada");
    expect(realInspect?.origin).toBe("human");
    expect(realInspect?.flow_id).toBe("flow-a");
    expect(realInspect?.run_id).toBe("human-1");
    expect(realInspect?.pow.length).toBeGreaterThan(0);
    expect(realInspect).toEqual(studioReal);
  });

  it("keeps AI-use samples when only exploration clusters exist and hides ai-use clusters by default", async () => {
    const simulated = await embeddingRow({
      id: "sim-1",
      identity: "Simulated · Exploit-heavy",
      source: "simulated",
      prompt: "agent walk",
    });
    const aiUse = {
      ...await embeddingRow({
        id: "ai-1",
        identity: "AI · Claude Sonnet · high",
        source: "simulated",
        prompt: "model walk",
      }),
      link_label: "ai-use",
    };
    const parent = {
      id: "parent",
      name: "Limits styles",
      description: "region-simulation: 1 flows · Exploit-heavy · 3/strategy · 0 real",
      owner_user_id: "me",
      workspace_id: "ws-1",
      verify_flow_id: "flow-a",
      centroid: simulated.vector,
      cosine_threshold: 0.5,
    };
    const explorationCluster = {
      id: "c-exploit",
      name: "Limits styles · Exploit-heavy",
      description: "region-simulation-cluster:exploit-heavy",
      subject_count: 1,
      centroid: simulated.vector,
      cosine_threshold: 0.5,
    };
    const aiUseCluster = {
      id: "c-ai",
      name: "Limits styles · Claude Sonnet · high",
      description: "region-simulation-cluster:ai-use:claude-sonnet-high",
      subject_count: 1,
      centroid: aiUse.vector,
      cosine_threshold: 0.5,
    };
    const withoutAiCluster = presentKnowledgeRegionDetails({
      flowNames: { "flow-a": "Limits" },
      parent,
      clusters: [explorationCluster],
      embeddings: [simulated, aiUse],
    });
    expect(withoutAiCluster?.samples.map((row) => row.id).sort()).toEqual(["ai-1", "sim-1"]);
    expect(withoutAiCluster?.samples.find((row) => row.id === "ai-1")?.pointKind).toBe("ai_use");
    expect(withoutAiCluster?.clusters.map((row) => row.id)).toEqual(["c-exploit"]);

    const withAiCluster = presentKnowledgeRegionDetails({
      flowNames: { "flow-a": "Limits" },
      parent,
      clusters: [explorationCluster, aiUseCluster],
      embeddings: [simulated, aiUse],
    });
    expect(withAiCluster?.samples.find((row) => row.id === "ai-1")?.clusterId).toBe("c-ai");
    expect(presentKnowledgeRegionClusters(parent, [explorationCluster, aiUseCluster]).map((row) => row.id)).toEqual([
      "c-exploit",
    ]);
    expect(
      presentKnowledgeRegionClusters(parent, [explorationCluster, aiUseCluster], { family: "ai_use" }).map(
        (row) => row.id,
      ),
    ).toEqual(["c-ai"]);
  });

  it("presents Solve regions without falling through to verification", async () => {
    const simulated = await embeddingRow({
      id: "sim-s",
      identity: "Simulated · Exploit-heavy",
      source: "simulated",
      flowKind: "verify",
      flowId: "flow-s",
      runId: "sim_exploit-heavy_0_seed",
      prompt: "solve walk",
    });
    const details = presentKnowledgeRegionDetails({
      flowNames: { "flow-s": "Normalize" },
      parent: {
        id: "solve-parent",
        name: "Gaussian packet",
        description: "region-simulation: 1 flows · Exploit-heavy · 3/strategy · 0 real",
        subject_count: 3,
      },
      clusters: [
        {
          id: "c-s",
          name: "Gaussian packet · Exploit-heavy",
          description: "region-simulation-cluster:exploit-heavy",
          subject_count: 3,
        },
      ],
      embeddings: [simulated],
    });
    expect(details?.regionPath).toContain("/regions/solve-parent");
    expect(details?.flows[0]?.name).toBe("Normalize");
    expect(details?.samples).toHaveLength(1);
  });
});
