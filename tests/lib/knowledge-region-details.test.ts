import { describe, expect, it } from "vitest";
import {
  completeFlowEmbedding,
  FLOW_EMBEDDING_PATH_TEXT_MODEL_ID,
} from "@/lib/flow-embedding";
import { l2Normalize } from "@/lib/knowledge-config/math";
import {
  inspectStudioEmbedding,
  type DataStudioEmbeddingRow,
} from "@/lib/data-studio-view";
import {
  inspectKnowledgeRegionSample,
  parseRegionSimulationDescription,
  presentKnowledgeRegionDetails,
} from "@/lib/knowledge-region-details";

function embeddingRow(input: {
  id: string;
  identity: string;
  source: string;
  flowId?: string;
  runId?: string;
  flowKind?: string;
  prompt: string;
}): DataStudioEmbeddingRow {
  const record = completeFlowEmbedding({
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
  it("parses the persisted simulation description", () => {
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

  it("presents name, flows, strategies, samples, and clusters for one region", () => {
    const simulated = embeddingRow({
      id: "sim-1",
      identity: "Simulated · Exploit-heavy",
      source: "simulated",
      runId: "sim_exploit-heavy_0_seed",
      prompt: "agent walk",
    });
    const balanced = embeddingRow({
      id: "sim-2",
      identity: "Simulated · Balanced",
      source: "simulated",
      runId: "sim_balanced_0_seed",
      prompt: "balanced walk",
    });
    const human = embeddingRow({
      id: "human-1",
      identity: "ada",
      source: "runner",
      runId: "human-1",
      prompt: "real proof",
    });
    const outsider = embeddingRow({
      id: "other-sim",
      identity: "Simulated · Novelty-seeking",
      source: "simulated",
      runId: "sim_novelty-seeking_0_seed",
      prompt: "other region",
    });
    const otherRegionSameStrategy = embeddingRow({
      id: "sim-other-region",
      identity: "Simulated · Exploit-heavy",
      source: "simulated",
      flowId: "flow-b",
      runId: "sim_exploit-heavy_0_otherseed",
      prompt: "other region's exploit walk",
    });
    otherRegionSameStrategy.vector = l2Normalize(simulated.vector.map((value) => -value));
    const humanInRegion = { ...human, vector: simulated.vector };
    const candidate = embeddingRow({
      id: "human-2",
      identity: "bea",
      source: "runner",
      runId: "human-2",
      prompt: "later session",
    });
    const candidateInRegion = { ...candidate, vector: simulated.vector };
    const details = presentKnowledgeRegionDetails({
      kind: "verification",
      flowNames: { "flow-a": "Limits" },
      parent: {
        id: "parent",
        name: "Limits styles",
        description: "region-simulation: 1 flows · Exploit-heavy, Balanced · 3/strategy · 1 real",
        product: "verification",
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
          product: "verification",
          owner_user_id: "me",
          subject_count: 3,
          centroid: simulated.vector,
          cosine_threshold: 0.5,
        },
        {
          id: "c-balanced",
          name: "Limits styles · Balanced",
          description: "region-simulation-cluster:balanced",
          product: "verification",
          owner_user_id: "me",
          subject_count: 3,
          centroid: balanced.vector,
          cosine_threshold: 0.5,
        },
        {
          id: "c-voice",
          name: "Limits styles · Exploit-heavy · Path + Text",
          description: "region-simulation-cluster:exploit-heavy",
          product: "verification",
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
    expect(details?.simulatedCount).toBe(2);
    expect(details?.cohortCount).toBe(1);
    expect(details?.analysisCount).toBe(1);
    expect(details?.realSessionCount).toBe(2);
    expect(details?.samples.find((row) => row.id === "human-1")?.pointKind).toBe("cohort");
    expect(details?.samples.find((row) => row.id === "human-2")?.pointKind).toBe("analysis");
    expect(details?.regionPath).toBe("/verification/regions/parent");
    expect(details?.studioPath).toBe("/dashboard?tab=verification_studio&region=parent");

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

  it("presents Solve regions without falling through to verification", () => {
    const simulated = embeddingRow({
      id: "sim-s",
      identity: "Simulated · Exploit-heavy",
      source: "simulated",
      flowKind: "solve",
      flowId: "flow-s",
      runId: "sim_exploit-heavy_0_seed",
      prompt: "solve walk",
    });
    const details = presentKnowledgeRegionDetails({
      kind: "solve",
      flowNames: { "flow-s": "Normalize" },
      parent: {
        id: "solve-parent",
        name: "Gaussian packet",
        description: "region-simulation: 1 flows · Exploit-heavy · 3/strategy · 0 real",
        product: "solve",
        solve_flow_id: "flow-s",
        subject_count: 3,
      },
      clusters: [
        {
          id: "c-s",
          name: "Gaussian packet · Exploit-heavy",
          description: "region-simulation-cluster:exploit-heavy",
          product: "solve",
          subject_count: 3,
        },
      ],
      embeddings: [simulated],
    });
    expect(details?.kind).toBe("solve");
    expect(details?.regionPath).toBe("/solve/regions/solve-parent");
    expect(details?.studioPath).toContain("solve_studio");
    expect(details?.flows[0]?.name).toBe("Normalize");
    expect(details?.samples).toHaveLength(1);
  });
});
