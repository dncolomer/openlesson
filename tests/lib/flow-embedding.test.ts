import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import {
  FLOW_EMBEDDING_DIM,
  FLOW_EMBEDDING_MODEL_ID,
  flowEmbeddingChannelLabel,
  flowEmbeddingModelIdForChannel,
  recoverFlowEmbeddingRaw,
  vectorForFlowSpace,
  vectorsMatch,
} from "@/lib/flow-embedding";
import { encodeFlowEmbedding, encodeFlowRaw } from "@/lib/flow-embedding-encode";
import { cosineSimilarity } from "@/lib/knowledge-config/math";
import {
  persistCompletedFlowEmbedding,
  resetFlowEmbeddingStore,
  listFlowEmbeddings,
  getFlowEmbedding,
} from "@/lib/flow-embedding-store";
import { normalizeSessionBranchModel } from "@/lib/session-branch-model";

const ROOT = join(__dirname, "../..");

function read(path: string): string {
  return readFileSync(join(ROOT, path), "utf8");
}

function fixtureModel(
  regionTitle = "Region",
  prices: readonly number[] = [10, 80],
) {
  const model = normalizeSessionBranchModel(
    {
      premise: "A priced field.",
      question: "What is still open?",
      territory: "A priced field.",
      observation: "The field is open.",
      regions: prices.map((edgePrice, index) => ({
        title: index === 0 ? regionTitle : `${regionTitle} ${index}`,
        question: `What is ${regionTitle} ${index}?`,
        territory: `${regionTitle} of the field.`,
        observation: `${regionTitle} is open.`,
        edgePrice,
      })),
    },
    "Priced",
  );
  if (!model) throw new Error("fixture tree was refused");
  return model;
}

describe("flowcfg-v1-d96 embeddings", () => {
  const model = fixtureModel("Region");
  const eight = fixtureModel("Other region", [4, 40, 90]);

  it("embeds verification walks with a projected policy", async () => {
    const verify = await encodeFlowEmbedding({
      flowKind: "verify",
      model,
      sequence: ["r1"],
      pow: [{ type: "speech", tool_name: "runner", timestamp_ms: 1, payload: "proof" }],
    });
    expect(verify.embedding_model_id).toBe(FLOW_EMBEDDING_MODEL_ID);
    expect(verify.embedding_model_id).not.toBe("knowledgecfg-v1-d64");
    expect(verify.vector).toHaveLength(FLOW_EMBEDDING_DIM);
    expect(verify.raw.projectedPolicy).not.toBeNull();
    expect(verify.raw.projectedPolicy?.sequence).toEqual(["r1"]);
    expect(verify.raw.pow[0]?.payload).toBe("proof");
    expect(
      verify.raw.genModel.branches.find((branch) => branch.id === "root")?.edges.length,
    ).toBeGreaterThan(0);

    for (const flowKind of ["calibrate", "learn", "solve"] as const) {
      const coerced = await encodeFlowEmbedding({
        flowKind,
        model,
        sequence: ["r1"],
      });
      expect(coerced.raw.flowKind).toBe("verify");
      expect(coerced.raw.projectedPolicy).not.toBeNull();
    }
  });

  it("changes the path vector when the tree or walk changes; speech does not move Path", async () => {
    const base = await encodeFlowEmbedding({
      flowKind: "verify",
      model,
      sequence: ["r1"],
      pow: [{ type: "speech", tool_name: "runner", timestamp_ms: 1, payload: "alpha spoken proof" }],
    });
    const otherModel = await encodeFlowEmbedding({
      flowKind: "verify",
      model: eight,
      sequence: ["r1"],
      pow: [{ type: "speech", tool_name: "runner", timestamp_ms: 1, payload: "alpha spoken proof" }],
    });
    const otherPolicy = await encodeFlowEmbedding({
      flowKind: "verify",
      model,
      sequence: ["r2"],
      pow: [{ type: "speech", tool_name: "runner", timestamp_ms: 1, payload: "alpha spoken proof" }],
    });
    const otherPow = await encodeFlowEmbedding({
      flowKind: "verify",
      model,
      sequence: ["r1"],
      pow: [{ type: "speech", tool_name: "runner", timestamp_ms: 1, payload: "beta spoken proof" }],
    });
    const silent = await encodeFlowEmbedding({
      flowKind: "verify",
      model,
      sequence: ["r1"],
      pow: [{ type: "tool", tool_name: "session_policy", tool_action: "r1", timestamp_ms: 1 }],
    });
    expect(base.vector).not.toEqual(otherModel.vector);
    expect(base.vector).not.toEqual(otherPolicy.vector);
    expect(base.vector).toEqual(otherPow.vector);
    expect(base.vector).toEqual(silent.vector);
    expect(base.vector_path_text).toEqual(base.vector);
    expect(otherPow.vector_path_text).toEqual(otherPow.vector);
    expect(silent.vector_path_text).toEqual(silent.vector);
    expect(cosineSimilarity(base.vector, otherPolicy.vector)).toBeLessThan(0.999);
    expect(cosineSimilarity(base.vector, otherPow.vector)).toBeGreaterThan(0.999);
    expect(flowEmbeddingModelIdForChannel("path")).toBe(FLOW_EMBEDDING_MODEL_ID);
    expect(flowEmbeddingModelIdForChannel("path_text")).toBe(FLOW_EMBEDDING_MODEL_ID);
    expect(flowEmbeddingChannelLabel("path")).toBe("Path");
    expect(flowEmbeddingChannelLabel("path_text")).toBe("Path");
    const recovered = recoverFlowEmbeddingRaw(base);
    expect(recovered).toEqual(base.raw);
    expect(vectorsMatch((await encodeFlowRaw(recovered!)).vector, base.vector)).toBe(true);
    expect(vectorsMatch((await encodeFlowRaw(recovered!)).vector_path_text, base.vector)).toBe(true);
    expect(
      otherModel.raw.genModel.branches.find((branch) => branch.id === "root")?.edges.length,
    ).toBeGreaterThan(0);
    expect(otherModel.raw.genModel.chapterTitle).toBe("Priced");
  });

  it("reads Path even when extras are present; persist body has no mix selector", async () => {
    const spoken = await encodeFlowEmbedding({
      flowKind: "verify",
      model,
      sequence: ["r1"],
      pow: [{ type: "speech", tool_name: "runner", timestamp_ms: 1, payload: "alpha spoken proof" }],
    });
    expect(spoken.channel_vectors.path).toEqual(spoken.vector);
    expect(vectorForFlowSpace(spoken, "path+audio")).toEqual(spoken.vector);
    expect(vectorForFlowSpace(spoken, "path_text")).toEqual(spoken.vector);
    const silent = await encodeFlowEmbedding({
      flowKind: "verify",
      model,
      sequence: ["r1"],
      pow: [{ type: "tool", tool_name: "session_policy", tool_action: "r1", timestamp_ms: 1 }],
    });
    expect(vectorForFlowSpace(silent, "path+audio")).toEqual(silent.vector);
    expect(vectorsMatch(spoken.vector, silent.vector)).toBe(true);
    const withEeg = await encodeFlowEmbedding({
      flowKind: "verify",
      model,
      sequence: ["r1"],
      pow: [
        { type: "speech", tool_name: "runner", timestamp_ms: 1, payload: "alpha spoken proof" },
        { type: "eeg", tool_name: "muse", timestamp_ms: 2, payload: "band-alpha" },
      ],
    });
    expect(withEeg.vector).toEqual(spoken.vector);
    expect(vectorForFlowSpace(withEeg, "path+audio+eeg")).toEqual(withEeg.vector);
    expect(
      existsSync(join(ROOT, "supabase/migrations/20261118120000_session_embedding_channel_vectors.sql")),
    ).toBe(true);
  });
});

describe("flow embedding store", () => {
  beforeEach(() => {
    resetFlowEmbeddingStore("memory");
  });

  it("persists recoverable verification raw with a projected policy", async () => {
    const model = fixtureModel();
    const stored = await persistCompletedFlowEmbedding({
      workspaceId: "ws-flow",
      flowKind: "verify",
      flowId: "flow-1",
      runId: "run-1",
      identity: "ada",
      source: "runner",
      model,
      sequence: ["r1"],
      pow: [{ type: "tool", tool_name: "probe", tool_action: "sounding", timestamp_ms: 1, payload: "band" }],
    });
    expect(stored.embedding_model_id).toBe(FLOW_EMBEDDING_MODEL_ID);
    expect(stored.raw.projectedPolicy).not.toBeNull();
    const listed = await listFlowEmbeddings({ workspaceId: "ws-flow", flowKind: "verify" });
    expect(listed).toHaveLength(1);
    const byFlow = await listFlowEmbeddings({ workspaceId: "ws-flow", flowId: "flow-1" });
    expect(byFlow).toHaveLength(1);
    expect(byFlow[0]?.identity).toBe("ada");
    const got = await getFlowEmbedding({ workspaceId: "ws-flow", embeddingId: stored.id });
    expect(got?.raw).toEqual(stored.raw);
    expect(vectorsMatch(stored.vector, got!.vector)).toBe(true);
    expect(stored.channel_vectors.path).toEqual(stored.vector);
  });

  it("allows a workspace-only persist in memory", async () => {
    const stored = await persistCompletedFlowEmbedding({
      workspaceId: "ws-learn",
      flowKind: "learn",
      sequence: ["try"],
    });
    expect(stored.workspace_id).toBe("ws-learn");
    expect(stored.owner_user_id).toBe("");
  });
});

describe("completion paths persist flow embeddings instead of snapshots", () => {
  it("Verification writes embed+raw and never snapshot", async () => {
    const results = read("app/api/verification-flow/public/[token]/results/route.ts");
    expect(results).toContain("buildFlowEmbeddingRaw");
    expect(results).toContain("persistCompletedFlowEmbedding");
    expect(results).toContain('flowKind: "verify"');
    expect(results).not.toContain("lwm_snapshot");
    expect(results).not.toContain("insertKnowledgeConfigSnapshot");

    const listRoute = read("app/api/session/embed/route.ts");
    expect(listRoute).toContain("export async function POST");
    expect(listRoute).toContain("persistCompletedFlowEmbedding");
    expect(listRoute).not.toContain("persistSolveCompletedEmbedding");
    const client = read("lib/flow-embedding-client.ts");
    expect(client).not.toContain("listWorkspaceFlowEmbeddings");
    expect(client).toContain("/api/session/embed");
    expect(existsSync(join(ROOT, "app/api/calibration-flow/public/[token]/proof/route.ts"))).toBe(
      false,
    );
    expect(existsSync(join(ROOT, "components/CalibrationFlowRunner.tsx"))).toBe(false);
  });
});

describe("retired calibrate surfaces", () => {
  it("live Calibrate sounding UI is gone", async () => {
    expect(existsSync(join(ROOT, "components/calibrate/calibrate-live-surface.tsx"))).toBe(false);
    expect(existsSync(join(ROOT, "components/calibrate/calibrate-sounding-surface.tsx"))).toBe(
      false,
    );
  });
});

describe("malformed embedding vector handling", () => {
  it("throws rather than fabricating 96-d zero vectors for malformed inputs", async () => {
    const { flowEmbeddingRecordFromHost } = await import("@/lib/flow-embedding");
    const { presentFlowEmbedding } = await import("@/lib/flow-embedding-store");

    expect(() => vectorForFlowSpace({ vector: [1, 2, 3] }, "path")).toThrow(/96-d finite Path vector/);
    expect(() =>
      flowEmbeddingRecordFromHost({
        raw: {
          flowKind: "verify",
          genModel: { chapterTitle: "t", rootId: "r", branches: [] },
          projectedPolicy: null,
          pow: [],
        },
        embedding: [1, 2],
        channel_vectors: { path: [] },
      }),
    ).toThrow(/96-d finite Path vector/);

    const badRow = presentFlowEmbedding({
      id: "bad-1",
      workspace_id: "",
      flow_kind: "verify",
      flow_id: "f1",
      run_id: "r1",
      identity: "u1",
      source: "verify",
      embedding_model_id: "flowcfg-v1-d96",
      dim: 96,
      vector: [1, 2, 3],
      channel_vectors: { path: [1, 2, 3] },
      raw: {
        flowKind: "verify",
        genModel: { chapterTitle: "t", rootId: "r", branches: [] },
        projectedPolicy: null,
        pow: [],
      },
      created_at: new Date().toISOString(),
    });
    expect(badRow).toBeNull();
  });
});
