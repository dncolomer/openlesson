import { describe, expect, it } from "vitest";
import { completeFlowEmbedding, FLOW_EMBEDDING_DIM, FLOW_EMBEDDING_MODEL_ID } from "@/lib/flow-embedding";
import {
  filterFlowEmbeddingRows,
  flowEmbeddingDistanceToRegion,
  flowEmbeddingSubjectKey,
  knowledgeConfigFromFlowEmbeddings,
  regionMatchesFlowEmbeddingSpace,
  subjectsFromFlowEmbeddings,
  type FlowEmbeddingViewRow,
} from "@/lib/flow-embedding-view";
import { projectTrajectoryAndRegions } from "@/lib/knowledge-config";

function row(input: {
  id: string;
  identity?: string | null;
  flowId?: string | null;
  createdAt: string;
  prompt: string;
  modelId?: string;
  vector?: number[];
}): FlowEmbeddingViewRow {
  const vector =
    input.vector ??
    completeFlowEmbedding({
      flowKind: "verify",
      pow: [{ type: "speech", tool_name: "runner", timestamp_ms: 1, payload: input.prompt }],
    }).vector;
  return {
    id: input.id,
    flow_kind: "verify",
    flow_id: input.flowId ?? "flow-a",
    identity: input.identity ?? null,
    vector,
    created_at: input.createdAt,
    embedding_model_id: input.modelId ?? FLOW_EMBEDDING_MODEL_ID,
    dim: vector.length,
  };
}

describe("flow embedding knowledge view", () => {
  it("maps stored flowcfg rows onto the Knowledge payload with identity subjects", () => {
    const ada = row({
      id: "e1",
      identity: "ada",
      createdAt: "2026-10-01T00:00:00.000Z",
      prompt: "epsilon proof",
    });
    const bea = row({
      id: "e2",
      identity: "bea",
      createdAt: "2026-10-02T00:00:00.000Z",
      prompt: "series proof",
    });
    const knowledgecfg = row({
      id: "e3",
      identity: "old",
      createdAt: "2026-10-03T00:00:00.000Z",
      prompt: "legacy",
      modelId: "knowledgecfg-v1-d64",
      vector: new Array(64).fill(0.1),
    });
    const payload = knowledgeConfigFromFlowEmbeddings([ada, bea, knowledgecfg]);
    expect(payload.knowledge_config.embedding_model_id).toBe(FLOW_EMBEDDING_MODEL_ID);
    expect(payload.knowledge_config.dim).toBe(FLOW_EMBEDDING_DIM);
    expect(payload.knowledge_config.empty).toBe(false);
    expect(payload.trajectory.point_count).toBe(2);
    expect(payload.trajectory.points?.map((point) => point.subject_guest_user_id)).toEqual([
      "ada",
      "bea",
    ]);
    expect(subjectsFromFlowEmbeddings([ada, bea]).map((subject) => subject.guest_user_id)).toEqual([
      "bea",
      "ada",
    ]);
    expect(flowEmbeddingSubjectKey(ada)).toBe("g:ada");
    expect(filterFlowEmbeddingRows([ada, knowledgecfg], { flowId: "flow-a" })).toEqual([ada]);
  });

  it("keeps 96D overlay regions and drops knowledgecfg centroids", () => {
    const centroid = completeFlowEmbedding({
      flowKind: "verify",
      pow: [{ type: "speech", tool_name: "runner", timestamp_ms: 1, payload: "region" }],
    }).vector;
    expect(
      regionMatchesFlowEmbeddingSpace({
        embedding_model_id: FLOW_EMBEDDING_MODEL_ID,
        centroid,
      }),
    ).toBe(true);
    expect(
      regionMatchesFlowEmbeddingSpace({
        embedding_model_id: "knowledgecfg-v1-d64",
        centroid: new Array(64).fill(0.2),
      }),
    ).toBe(false);
    const distance = flowEmbeddingDistanceToRegion(centroid, {
      name: "Limits",
      centroid,
      cosine_threshold: 0.5,
      embedding_model_id: FLOW_EMBEDDING_MODEL_ID,
    });
    expect(distance.knowledge_distance).toBe(0);
    expect(distance.in_region).toBe(true);
  });

  it("projects flowcfg points and overlay regions in ℝ⁹⁶", () => {
    const a = completeFlowEmbedding({
      flowKind: "verify",
      pow: [{ type: "speech", tool_name: "runner", timestamp_ms: 1, payload: "a" }],
    }).vector;
    const b = completeFlowEmbedding({
      flowKind: "verify",
      pow: [{ type: "speech", tool_name: "runner", timestamp_ms: 1, payload: "b" }],
    }).vector;
    const layout = projectTrajectoryAndRegions({
      points: [
        { t: "t0", as_of_ms: 1, vector: a, confidence: 1 },
        { t: "t1", as_of_ms: 2, vector: b, confidence: 1 },
      ],
      regions: [
        {
          id: "r1",
          name: "Limits",
          centroid: a,
          mean_radius: 0.2,
          cosine_threshold: 0.5,
        },
      ],
      algorithm: "random",
    });
    expect(layout.coords).toHaveLength(2);
    expect(layout.regionOverlays).toHaveLength(1);
    expect(Number.isFinite(layout.coords[0].x)).toBe(true);
    expect(Number.isFinite(layout.regionOverlays[0].x)).toBe(true);
    expect(layout.coords[0].x).not.toBe(layout.coords[1].x);
  });
});
