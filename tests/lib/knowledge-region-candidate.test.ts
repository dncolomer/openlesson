import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { completeFlowEmbedding, FLOW_EMBEDDING_DIM } from "@/lib/flow-embedding";
import type { StoredFlowEmbedding } from "@/lib/flow-embedding-store";
import { l2Distance } from "@/lib/knowledge-config/math";
import { presentKnowledgeRegionCandidate } from "@/lib/knowledge-region-candidate";
import { normalizeSessionBranchModel } from "@/lib/session-branch-model";
import { vectorForFlowSpace } from "@/lib/flow-embedding";

const ROOT = join(__dirname, "../..");

function fixtureModel() {
  const model = normalizeSessionBranchModel(
    {
      premise: "A priced field.",
      question: "What is still open?",
      territory: "A priced field.",
      observation: "The field is open.",
      regions: [
        {
          title: "Region",
          question: "What is Region 0?",
          territory: "Region of the field.",
          observation: "Region is open.",
          edgePrice: 10,
        },
        {
          title: "Region 1",
          question: "What is Region 1?",
          territory: "Region of the field.",
          observation: "Region is open.",
          edgePrice: 80,
        },
      ],
    },
    "Priced",
  );
  if (!model) throw new Error("fixture tree was refused");
  return model;
}

function stored(input: {
  id: string;
  identity: string;
  source?: string;
  flowId?: string;
  createdAt: string;
  sequence?: string[];
  pow?: StoredFlowEmbedding["raw"]["pow"];
}): StoredFlowEmbedding {
  const model = fixtureModel();
  const record = completeFlowEmbedding({
    flowKind: "verify",
    model,
    sequence: input.sequence ?? ["r1"],
    pow: input.pow ?? [
      { type: "speech", tool_name: "runner", timestamp_ms: 1, payload: `${input.id} spoken` },
    ],
  });
  return {
    id: input.id,
    workspace_id: "ws-1",
    owner_user_id: "me",
    flow_kind: "verify",
    flow_id: input.flowId ?? "flow-a",
    run_id: input.id,
    identity: input.identity,
    source: input.source ?? "runner",
    embedding_model_id: record.embedding_model_id,
    dim: record.dim,
    vector: record.vector,
    vector_path_text: record.vector_path_text,
    channel_vectors: record.channel_vectors,
    raw: record.raw,
    created_at: input.createdAt,
  };
}

describe("knowledge region candidate render", () => {
  const parent = {
    id: "parent",
    name: "Limits styles",
    description: "region-simulation: 2 flows · Exploit-heavy · 3/strategy · 1 real",
    product: "verification",
    owner_user_id: "me",
    workspace_id: "ws-1",
    verify_flow_id: "flow-a",
    cosine_threshold: 0.1,
    subjects: [{ label: "ada", user_id: "user_ada" }],
  };
  const clusters = [
    {
      id: "c-exploit",
      name: "Limits styles · Exploit-heavy",
      description: "region-simulation-cluster:exploit-heavy",
      product: "verification",
      cosine_threshold: 0.1,
    },
  ];

  it("returns unsys averages, cluster L2, chronological path, and a symmetric pairwise matrix", () => {
    const sim = stored({
      id: "sim-1",
      identity: "Simulated · Exploit-heavy",
      source: "simulated",
      createdAt: "2026-03-01T00:00:00.000Z",
    });
    const first = stored({
      id: "o1",
      identity: "ada",
      flowId: "flow-a",
      createdAt: "2026-03-01T12:00:00.000Z",
      sequence: ["r1"],
      pow: [{ type: "speech", tool_name: "runner", timestamp_ms: 1, payload: "first talk" }],
    });
    const second = stored({
      id: "o2",
      identity: "user_ada",
      flowId: "flow-b",
      createdAt: "2026-03-08T12:00:00.000Z",
      sequence: ["r1", "r2"],
      pow: [{ type: "speech", tool_name: "runner", timestamp_ms: 1, payload: "second talk" }],
    });
    const other = stored({
      id: "other",
      identity: "bea",
      createdAt: "2026-03-09T12:00:00.000Z",
    });
    const payload = presentKnowledgeRegionCandidate({
      knowledgeRegionId: "parent",
      candidateId: "ada",
      space: "path",
      parent: { ...parent, centroid: sim.vector, cosine_threshold: 0 },
      clusters: [{ ...clusters[0]!, centroid: sim.vector }],
      embeddings: [second, first, sim, other],
      kind: "verification",
    });
    expect(payload.space).toBe("path");
    expect(payload.dim).toBe(FLOW_EMBEDDING_DIM);
    expect(payload.observations.map((row) => row.id)).toEqual(["o1", "o2"]);
    expect(payload.observations[0]?.created_at).toBe("2026-03-01T12:00:00.000Z");
    expect(payload.observations[0]?.unsys.distance).not.toBeNull();
    expect(payload.observations[0]?.cluster_distances[0]?.cluster_id).toBe("c-exploit");
    expect(payload.unsys.flows).toHaveLength(2);
    expect(payload.unsys.scored_count).toBe(2);
    expect(payload.unsys.average).toBeCloseTo(
      ((payload.observations[0]?.unsys.distance ?? 0) +
        (payload.observations[1]?.unsys.distance ?? 0)) /
        2,
      6,
    );
    expect(payload.path.segments).toHaveLength(1);
    expect(payload.path.span?.from_id).toBe("o1");
    expect(payload.path.span?.to_id).toBe("o2");
    expect(payload.pairwise.matrix).toHaveLength(2);
    expect(payload.pairwise.matrix[0]?.[0]).toBe(0);
    expect(payload.pairwise.matrix[0]?.[1]).toBe(payload.pairwise.matrix[1]?.[0]);
    expect(payload.pairwise.matrix[0]?.[1]).toBeCloseTo(
      l2Distance(vectorForFlowSpace(first, "path"), vectorForFlowSpace(second, "path")),
      6,
    );
    expect(payload.observations.some((row) => row.id === "sim-1")).toBe(false);
    expect(payload.observations.some((row) => row.id === "other")).toBe(false);
  });

  it("returns empty observations for an unknown candidate and mixes path+audio when asked", () => {
    const empty = presentKnowledgeRegionCandidate({
      knowledgeRegionId: "parent",
      candidateId: "nobody",
      space: "path+eeg+audio",
      parent,
      clusters,
      embeddings: [],
      kind: "verification",
    });
    expect(empty.observations).toEqual([]);
    expect(empty.unsys.average).toBeNull();
    expect(empty.path.span).toBeNull();
    expect(empty.pairwise.matrix).toEqual([]);
    expect(empty.space).toBe("path+audio+eeg");

    const a = stored({
      id: "a",
      identity: "ada",
      createdAt: "2026-03-01T00:00:00.000Z",
      pow: [{ type: "speech", tool_name: "runner", timestamp_ms: 1, payload: "alpha spoken" }],
    });
    const b = stored({
      id: "b",
      identity: "ada",
      createdAt: "2026-03-02T00:00:00.000Z",
      pow: [{ type: "speech", tool_name: "runner", timestamp_ms: 1, payload: "beta spoken" }],
    });
    const pathPayload = presentKnowledgeRegionCandidate({
      knowledgeRegionId: "parent",
      candidateId: "ada",
      space: "path",
      parent: { ...parent, centroid: a.vector, cosine_threshold: 0 },
      embeddings: [a, b],
      kind: "verification",
    });
    const audioPayload = presentKnowledgeRegionCandidate({
      knowledgeRegionId: "parent",
      candidateId: "ada",
      space: "path_text",
      parent: { ...parent, centroid: a.vector, cosine_threshold: 0 },
      embeddings: [a, b],
      kind: "verification",
    });
    expect(audioPayload.space).toBe("path+audio");
    expect(pathPayload.pairwise.matrix[0]?.[1]).toBe(0);
    expect(audioPayload.pairwise.matrix[0]?.[1]).toBeGreaterThan(0);
  });

  it("ships the public route and MCP tool", () => {
    const route = join(
      ROOT,
      "app/api/v3/knowledge-regions/[id]/candidates/[candidateId]/route.ts",
    );
    expect(existsSync(route)).toBe(true);
    const src = readFileSync(route, "utf8");
    expect(src).toContain("authenticateRequest");
    expect(src).toContain("loadKnowledgeRegionCandidate");
    const skill = readFileSync(join(ROOT, "public/skill.md"), "utf8");
    expect(skill).toContain("get_knowledge_region_candidate");
  });
});
