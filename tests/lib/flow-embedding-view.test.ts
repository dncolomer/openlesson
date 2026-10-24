import { describe, expect, it } from "vitest";
import {
  completeFlowEmbedding,
  FLOW_EMBEDDING_DIM,
  FLOW_EMBEDDING_MODEL_ID,
  FLOW_EMBEDDING_PATH_TEXT_MODEL_ID,
} from "@/lib/flow-embedding";
import {
  filterFlowEmbeddingRows,
  flowEmbeddingDistanceToRegion,
  flowEmbeddingSubjectKey,
  knowledgeConfigFromFlowEmbeddings,
  reconcileSelectedSubjectKeys,
  regionMatchesFlowEmbeddingChannel,
  regionMatchesFlowEmbeddingSpace,
  sameFlowEmbeddingList,
  subjectsFromFlowEmbeddings,
  type FlowEmbeddingViewRow,
} from "@/lib/flow-embedding-view";
import { normalizeSessionBranchModel } from "@/lib/session-branch-model";
import { projectTrajectoryAndRegions } from "@/lib/knowledge-config";
import { projectStudioEmbeddings } from "@/lib/data-studio-view";

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

  it("keeps calibrate rows for Calibration Knowledge and verify rows for Verification Knowledge", () => {
    const verify = row({
      id: "v1",
      identity: "ada",
      createdAt: "2026-10-01T00:00:00.000Z",
      prompt: "epsilon proof",
    });
    const calibrateVector = completeFlowEmbedding({
      flowKind: "calibrate",
      pow: [{ type: "speech", tool_name: "runner", timestamp_ms: 1, payload: "gap" }],
    }).vector;
    const calibrate: FlowEmbeddingViewRow = {
      ...verify,
      id: "c1",
      flow_kind: "calibrate",
      flow_id: "flow-cal",
      vector: calibrateVector,
      dim: calibrateVector.length,
    };
    expect(filterFlowEmbeddingRows([verify, calibrate], { flowKind: "verify" })).toEqual([
      verify,
    ]);
    expect(filterFlowEmbeddingRows([verify, calibrate], { flowKind: "calibrate" })).toEqual([
      calibrate,
    ]);
    expect(
      filterFlowEmbeddingRows([verify, calibrate], { flowKind: "calibrate" }).some(
        (item) => item.flow_kind === "verify",
      ),
    ).toBe(false);
    expect(
      filterFlowEmbeddingRows([verify, calibrate], { flowKind: "verify" }).some(
        (item) => item.flow_kind === "calibrate",
      ),
    ).toBe(false);
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
    expect(
      regionMatchesFlowEmbeddingSpace({
        embedding_model_id: FLOW_EMBEDDING_PATH_TEXT_MODEL_ID,
        centroid,
      }),
    ).toBe(false);
    expect(
      regionMatchesFlowEmbeddingChannel(
        { embedding_model_id: FLOW_EMBEDDING_PATH_TEXT_MODEL_ID, centroid },
        "path_text",
      ),
    ).toBe(true);
    expect(
      regionMatchesFlowEmbeddingChannel(
        { embedding_model_id: FLOW_EMBEDDING_PATH_TEXT_MODEL_ID, centroid },
        "any",
      ),
    ).toBe(true);
    const distance = flowEmbeddingDistanceToRegion(centroid, {
      name: "Limits",
      centroid,
      cosine_threshold: 0.5,
      embedding_model_id: FLOW_EMBEDDING_MODEL_ID,
    });
    expect(distance.knowledge_distance).toBe(0);
    expect(distance.in_region).toBe(true);
  });

  it("keeps subject-key identity so an empty list does not retrigger loads", () => {
    const empty: string[] = [];
    expect(reconcileSelectedSubjectKeys(empty, [])).toBe(empty);
    const prev = ["g:ada"];
    expect(reconcileSelectedSubjectKeys(prev, ["g:ada"])).toBe(prev);
    expect(reconcileSelectedSubjectKeys(prev, ["g:bea"])).toEqual(["g:bea"]);
    expect(sameFlowEmbeddingList([], [])).toBe(true);
    const ada = row({
      id: "e1",
      identity: "ada",
      createdAt: "2026-10-01T00:00:00.000Z",
      prompt: "epsilon proof",
    });
    expect(sameFlowEmbeddingList([ada], [{ ...ada }])).toBe(true);
    expect(sameFlowEmbeddingList([ada], [])).toBe(false);
  });

  it("projects flowcfg points and overlay regions in ℝ⁹⁶", () => {
    const model = normalizeSessionBranchModel(
      {
        premise: "A priced field.",
        regions: [
          { title: "Region", observation: "Open.", edgePrice: 10 },
          { title: "Region dear", observation: "Dear is open.", edgePrice: 80 },
        ],
      },
      "Priced",
    );
    if (!model) throw new Error("projection tree was refused");
    const a = completeFlowEmbedding({
      flowKind: "verify",
      model,
      sequence: ["r1"],
      pow: [{ type: "speech", tool_name: "runner", timestamp_ms: 1, payload: "a" }],
    }).vector;
    const b = completeFlowEmbedding({
      flowKind: "verify",
      model,
      sequence: ["r2"],
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

    const pca = projectStudioEmbeddings({
      embeddings: [
        { id: "e1", vector: a, created_at: "2026-10-01T00:00:00.000Z" },
        { id: "e2", vector: b, created_at: "2026-10-02T00:00:00.000Z" },
      ],
      regions: [
        { id: "r1", name: "Limits", centroid: a, mean_radius: 0.2, cosine_threshold: 0.5 },
      ],
      algorithm: "pca",
    });
    const mds = projectStudioEmbeddings({
      embeddings: [
        { id: "e1", vector: a, created_at: "2026-10-01T00:00:00.000Z" },
        { id: "e2", vector: b, created_at: "2026-10-02T00:00:00.000Z" },
      ],
      regions: [
        { id: "r1", name: "Limits", centroid: a, mean_radius: 0.2, cosine_threshold: 0.5 },
      ],
      algorithm: "classical_mds",
    });
    expect(pca.coords).toHaveLength(2);
    expect(mds.coords).toHaveLength(2);
    expect(pca.regionOverlays).toHaveLength(1);
    expect(mds.regionOverlays).toHaveLength(1);
    expect(pca.coords.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y))).toBe(true);
    expect(mds.coords.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y))).toBe(true);
    expect(pca.regionOverlays.every((r) => Number.isFinite(r.x) && Number.isFinite(r.radius))).toBe(
      true,
    );
  });
});
