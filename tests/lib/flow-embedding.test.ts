import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import {
  completeFlowEmbedding,
  FLOW_EMBEDDING_DIM,
  FLOW_EMBEDDING_MODEL_ID,
  FLOW_EMBEDDING_PATH_TEXT_MODEL_ID,
  flowEmbeddingChannelLabel,
  flowEmbeddingModelIdForChannel,
  recoverFlowEmbeddingRaw,
  reembedFlowRaw,
  vectorForFlowSpace,
  vectorsMatch,
} from "@/lib/flow-embedding";
import {
  mixFlowEmbeddingSpace,
  parseFlowEmbeddingSpace,
} from "@/lib/flow-embedding-space";
import { cosineSimilarity } from "@/lib/knowledge-config/math";
import {
  persistCompletedFlowEmbedding,
  resetFlowEmbeddingStore,
  listFlowEmbeddings,
  getFlowEmbedding,
} from "@/lib/flow-embedding-store";
import {
  playCopyFlowSessionInsert,
  playCopyVerifyEmbeddingFromProof,
} from "@/lib/map-play-data-access";
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

  it("embeds verification walks with a projected policy", () => {
    const verify = completeFlowEmbedding({
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
      const coerced = completeFlowEmbedding({
        flowKind,
        model,
        sequence: ["r1"],
      });
      expect(coerced.raw.flowKind).toBe("verify");
      expect(coerced.raw.projectedPolicy).not.toBeNull();
    }
  });

  it("changes the path vector when the tree or walk changes; speech only moves path+text", () => {
    const base = completeFlowEmbedding({
      flowKind: "verify",
      model,
      sequence: ["r1"],
      pow: [{ type: "speech", tool_name: "runner", timestamp_ms: 1, payload: "alpha spoken proof" }],
    });
    const otherModel = completeFlowEmbedding({
      flowKind: "verify",
      model: eight,
      sequence: ["r1"],
      pow: [{ type: "speech", tool_name: "runner", timestamp_ms: 1, payload: "alpha spoken proof" }],
    });
    const otherPolicy = completeFlowEmbedding({
      flowKind: "verify",
      model,
      sequence: ["r2"],
      pow: [{ type: "speech", tool_name: "runner", timestamp_ms: 1, payload: "alpha spoken proof" }],
    });
    const otherPow = completeFlowEmbedding({
      flowKind: "verify",
      model,
      sequence: ["r1"],
      pow: [{ type: "speech", tool_name: "runner", timestamp_ms: 1, payload: "beta spoken proof" }],
    });
    const silent = completeFlowEmbedding({
      flowKind: "verify",
      model,
      sequence: ["r1"],
      pow: [{ type: "tool", tool_name: "session_policy", tool_action: "r1", timestamp_ms: 1 }],
    });
    expect(base.vector).not.toEqual(otherModel.vector);
    expect(base.vector).not.toEqual(otherPolicy.vector);
    expect(base.vector).toEqual(otherPow.vector);
    expect(base.vector).toEqual(silent.vector);
    expect(base.vector_path_text).not.toEqual(otherPow.vector_path_text);
    expect(base.vector_path_text).not.toEqual(base.vector);
    expect(silent.vector_path_text).toEqual(silent.vector);
    expect(cosineSimilarity(base.vector, otherPolicy.vector)).toBeLessThan(0.999);
    expect(cosineSimilarity(base.vector, otherPow.vector)).toBeGreaterThan(0.999);
    expect(flowEmbeddingModelIdForChannel("path")).toBe(FLOW_EMBEDDING_MODEL_ID);
    expect(flowEmbeddingModelIdForChannel("path_text")).toBe(FLOW_EMBEDDING_PATH_TEXT_MODEL_ID);
    expect(flowEmbeddingChannelLabel("path")).toBe("Path");
    expect(flowEmbeddingChannelLabel("path_text")).toBe("Path + Text");
    const recovered = recoverFlowEmbeddingRaw(base);
    expect(recovered).toEqual(base.raw);
    expect(vectorsMatch(reembedFlowRaw(recovered!), base.vector)).toBe(true);
    expect(vectorsMatch(reembedFlowRaw(recovered!, "path_text"), base.vector_path_text)).toBe(true);
    expect(
      otherModel.raw.genModel.branches.find((branch) => branch.id === "root")?.edges.length,
    ).toBeGreaterThan(0);
    expect(otherModel.raw.genModel.chapterTitle).toBe("Priced");
  });

  it("names spaces from basis channels and mixes path+audio as Path+Text", () => {
    expect(parseFlowEmbeddingSpace(null)).toEqual({
      ok: true,
      space: "path",
      channels: ["path"],
    });
    expect(parseFlowEmbeddingSpace("path_text")).toEqual({
      ok: true,
      space: "path+audio",
      channels: ["path", "audio"],
    });
    const sorted = parseFlowEmbeddingSpace("path+eeg+audio");
    expect(sorted.ok && sorted.space).toBe("path+audio+eeg");
    const voice = parseFlowEmbeddingSpace("voice");
    expect(voice.ok && voice.space).toBe("path+audio");
    expect(parseFlowEmbeddingSpace("path+foo").ok).toBe(false);
    const spoken = completeFlowEmbedding({
      flowKind: "verify",
      model,
      sequence: ["r1"],
      pow: [{ type: "speech", tool_name: "runner", timestamp_ms: 1, payload: "alpha spoken proof" }],
    });
    expect(spoken.channel_vectors.path).toEqual(spoken.vector);
    expect(spoken.channel_vectors.audio).toBeTruthy();
    expect(
      vectorsMatch(vectorForFlowSpace(spoken, "path+audio"), spoken.vector_path_text),
    ).toBe(true);
    expect(vectorsMatch(reembedFlowRaw(spoken.raw, "path+audio"), spoken.vector_path_text)).toBe(
      true,
    );
    const silent = completeFlowEmbedding({
      flowKind: "verify",
      model,
      sequence: ["r1"],
      pow: [{ type: "tool", tool_name: "session_policy", tool_action: "r1", timestamp_ms: 1 }],
    });
    expect(silent.channel_vectors.audio).toBeUndefined();
    expect(vectorForFlowSpace(silent, "path+audio")).toEqual(silent.vector);
    const withEeg = completeFlowEmbedding({
      flowKind: "verify",
      model,
      sequence: ["r1"],
      pow: [
        { type: "speech", tool_name: "runner", timestamp_ms: 1, payload: "alpha spoken proof" },
        { type: "eeg", tool_name: "muse", timestamp_ms: 2, payload: "band-alpha" },
      ],
    });
    expect(withEeg.channel_vectors.eeg).toBeTruthy();
    const twoExtra = mixFlowEmbeddingSpace(withEeg.channel_vectors, "path+audio+eeg");
    expect(twoExtra).not.toEqual(withEeg.vector);
    expect(twoExtra).not.toEqual(withEeg.vector_path_text);
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
    expect(vectorsMatch(reembedFlowRaw(got!.raw), stored.vector)).toBe(true);
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

  it("persists a completed play-copy verify run as a player-owned copy embedding", async () => {
    const started = playCopyFlowSessionInsert({
      flowKind: "verify",
      flowId: "vf-live",
      runnerUserId: "player-1",
      copyWorkspaceId: "copy-ws",
      topic: "Series",
      publicToken: "vtok",
    });
    const payload = playCopyVerifyEmbeddingFromProof({
      session: { id: "sess-ver", metadata: started.metadata },
      prompt: "the series converges",
      policy: { model: fixtureModel(), sequence: ["r1"] },
    });
    expect(payload).not.toBeNull();
    const stored = await persistCompletedFlowEmbedding({
      workspaceId: payload!.workspaceId,
      ownerUserId: payload!.ownerUserId,
      flowKind: payload!.flowKind,
      flowId: payload!.flowId,
      runId: payload!.runId,
      identity: payload!.identity,
      source: payload!.source,
      model: fixtureModel(),
      sequence: payload!.sequence,
      pow: payload!.pow,
    });
    expect(stored.owner_user_id).toBe("player-1");
    expect(stored.workspace_id).toBe("copy-ws");
    expect(stored.flow_kind).toBe("verify");
    expect(stored.flow_id).toBe("vf-live");
    expect(stored.run_id).toBe("sess-ver");
    expect(stored.identity).toBe("play:player-1");
    expect(stored.source).toBe("runner");
    expect(stored.raw.pow[0]?.payload).toBe("the series converges");
    const listed = await listFlowEmbeddings({ workspaceId: "copy-ws", flowKind: "verify" });
    expect(listed).toHaveLength(1);
    expect(listed[0]?.owner_user_id).toBe("player-1");
  });

});

describe("completion paths persist flow embeddings instead of snapshots", () => {
  it("Verification writes embed+raw and never snapshot", () => {
    const results = read("app/api/verification-flow/public/[token]/results/route.ts");
    expect(results).toContain("completeFlowEmbedding");
    expect(results).toContain("persistCompletedFlowEmbedding");
    expect(results).toContain('flowKind: "verify"');
    expect(results).not.toContain("lwm_snapshot");
    expect(results).not.toContain("insertKnowledgeConfigSnapshot");

    const listRoute = read("app/api/session/embed/route.ts");
    expect(listRoute).toContain("export async function POST");
    expect(listRoute).toContain("persistCompletedFlowEmbedding");
    expect(listRoute).not.toContain("persistSolveCompletedEmbedding");
    const client = read("lib/flow-embedding-client.ts");
    expect(client).toContain("listWorkspaceFlowEmbeddings");
    expect(client).toContain("/api/session/embed");
    expect(existsSync(join(ROOT, "app/api/calibration-flow/public/[token]/proof/route.ts"))).toBe(
      false,
    );
    expect(existsSync(join(ROOT, "components/CalibrationFlowRunner.tsx"))).toBe(false);
  });
});

describe("retired calibrate surfaces", () => {
  it("live Calibrate sounding UI is gone", () => {
    expect(existsSync(join(ROOT, "components/calibrate/calibrate-live-surface.tsx"))).toBe(false);
    expect(existsSync(join(ROOT, "components/calibrate/calibrate-sounding-surface.tsx"))).toBe(
      false,
    );
  });
});
