import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import {
  completeFlowEmbedding,
  FLOW_EMBEDDING_DIM,
  FLOW_EMBEDDING_MODEL_ID,
  recoverFlowEmbeddingRaw,
  reembedFlowRaw,
  vectorsMatch,
} from "@/lib/flow-embedding";
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

function fixtureModel(catalogSize: 4 | 8 | 16 = 4) {
  const model = normalizeSessionBranchModel(
    {
      premise: "A priced field.",
      closePrice: 10,
      keepPrice: 40,
      discardPrice: 80,
      insightPrice: 90,
      closeObservation: "Closing writes the next observation.",
      keepObservation: "Keeping writes the next observation.",
      discardObservation: "Discarding writes the next observation.",
      insightObservation: "Insight writes the next observation.",
      regions: [
        {
          title: "Region",
          observation: "The region is open.",
          closePrice: 20,
          keepPrice: 30,
          discardPrice: 70,
          insightPrice: 95,
        },
      ],
    },
    "Priced",
    catalogSize,
  );
  if (!model) throw new Error("fixture tree was refused");
  return model;
}

describe("flowcfg-v1-d96 embeddings", () => {
  const model = fixtureModel(4);
  const eight = fixtureModel(8);

  it("embeds Calibrate without a projected policy and Learn/Verify with one", () => {
    const calibrate = completeFlowEmbedding({
      flowKind: "calibrate",
      model,
      catalogSize: 4,
      sequence: ["try", "hold"],
      pow: [{ type: "tool", tool_name: "probe", tool_action: "sounding", timestamp_ms: 1, payload: "band" }],
    });
    const learn = completeFlowEmbedding({
      flowKind: "learn",
      model,
      sequence: ["try"],
      pow: [{ type: "tool", tool_name: "session_policy", tool_action: "try", timestamp_ms: 1 }],
    });
    const verify = completeFlowEmbedding({
      flowKind: "verify",
      model,
      sequence: ["try"],
      pow: [{ type: "speech", tool_name: "runner", timestamp_ms: 1, payload: "proof" }],
    });
    expect(calibrate.embedding_model_id).toBe(FLOW_EMBEDDING_MODEL_ID);
    expect(calibrate.embedding_model_id).not.toBe("knowledgecfg-v1-d64");
    expect(calibrate.vector).toHaveLength(FLOW_EMBEDDING_DIM);
    expect(calibrate.raw.projectedPolicy).toBeNull();
    expect(calibrate.raw.genModel.catalogSize).toBe(4);
    expect(learn.raw.projectedPolicy).not.toBeNull();
    expect(learn.raw.projectedPolicy?.sequence).toEqual(["try"]);
    expect(verify.raw.projectedPolicy).not.toBeNull();
    expect(verify.raw.pow[0]?.payload).toBe("proof");
  });

  it("changes the vector when gen model, policy, or PoW changes, and re-embeds recovered raw", () => {
    const base = completeFlowEmbedding({
      flowKind: "verify",
      model,
      sequence: ["try"],
      pow: [{ type: "speech", tool_name: "runner", timestamp_ms: 1, payload: "a" }],
    });
    const otherModel = completeFlowEmbedding({
      flowKind: "verify",
      model: eight,
      sequence: ["try"],
      pow: [{ type: "speech", tool_name: "runner", timestamp_ms: 1, payload: "a" }],
    });
    const otherPolicy = completeFlowEmbedding({
      flowKind: "verify",
      model,
      sequence: ["hold"],
      pow: [{ type: "speech", tool_name: "runner", timestamp_ms: 1, payload: "a" }],
    });
    const otherPow = completeFlowEmbedding({
      flowKind: "verify",
      model,
      sequence: ["try"],
      pow: [{ type: "speech", tool_name: "runner", timestamp_ms: 1, payload: "b" }],
    });
    expect(base.vector).not.toEqual(otherModel.vector);
    expect(base.vector).not.toEqual(otherPolicy.vector);
    expect(base.vector).not.toEqual(otherPow.vector);
    const recovered = recoverFlowEmbeddingRaw(base);
    expect(recovered).toEqual(base.raw);
    expect(vectorsMatch(reembedFlowRaw(recovered!), base.vector)).toBe(true);
    expect(otherModel.raw.genModel.catalogSize).toBe(8);
    expect(otherModel.raw.genModel.branches.some((branch) => branch.actions.length > 4)).toBe(true);
  });
});

describe("flow embedding store", () => {
  beforeEach(() => {
    resetFlowEmbeddingStore("memory");
  });

  it("persists recoverable raw and does not invent a Calibrate policy", async () => {
    const model = fixtureModel();
    const stored = await persistCompletedFlowEmbedding({
      workspaceId: "ws-flow",
      flowKind: "calibrate",
      flowId: "flow-1",
      runId: "run-1",
      identity: "ada",
      source: "sounding",
      model,
      sequence: ["try", "insight"],
      pow: [{ type: "tool", tool_name: "probe", tool_action: "sounding", timestamp_ms: 1, payload: "band" }],
    });
    expect(stored.embedding_model_id).toBe(FLOW_EMBEDDING_MODEL_ID);
    expect(stored.raw.projectedPolicy).toBeNull();
    const listed = await listFlowEmbeddings({ workspaceId: "ws-flow", flowKind: "calibrate" });
    expect(listed).toHaveLength(1);
    const got = await getFlowEmbedding({ workspaceId: "ws-flow", embeddingId: stored.id });
    expect(got?.raw).toEqual(stored.raw);
    expect(vectorsMatch(reembedFlowRaw(got!.raw), stored.vector)).toBe(true);
  });
});

describe("completion paths persist flow embeddings instead of snapshots", () => {
  it("Learn, Verify, and Calibrate write embed+raw and never snapshot", () => {
    const learn = read("components/session-view/use-session-phase.ts");
    const confirmEnd = learn.slice(learn.indexOf("const handleConfirmEnd"));
    expect(confirmEnd).toContain("postWorkspaceFlowEmbedding");
    expect(confirmEnd).toContain('flowKind: "learn"');
    expect(confirmEnd).not.toContain("lwm_snapshot");
    expect(confirmEnd).not.toContain("insertKnowledgeConfigSnapshot");
    expect(confirmEnd).not.toContain("embedPolicyScore");

    const verifyEnd = read("components/tap-score/use-tap-score-flow.ts");
    const finish = verifyEnd.slice(verifyEnd.indexOf("async function endSession"));
    expect(finish).toContain("postWorkspaceFlowEmbedding");
    expect(finish).toContain('flowKind: "verify"');
    expect(finish).not.toContain("embedPolicyScore");
    expect(finish).not.toContain("lwm_snapshot");

    const results = read("app/api/verification-flow/public/[token]/results/route.ts");
    expect(results).toContain("completeFlowEmbedding");
    expect(results).toContain("persistCompletedFlowEmbedding");
    expect(results).toContain('flowKind: "verify"');
    expect(results).not.toContain("lwm_snapshot");
    expect(results).not.toContain("insertKnowledgeConfigSnapshot");

    const proof = read("app/api/calibration-flow/public/[token]/proof/route.ts");
    expect(proof).toContain("persistCompletedFlowEmbedding");
    expect(proof).toContain('flowKind: "calibrate"');
    expect(proof).toContain("sequence: null");
    expect(proof).not.toContain("lwm_snapshot");

    const scout = read("components/scout-tap/ScoutTapClient.tsx");
    expect(scout).toContain("postWorkspaceFlowEmbedding");
    expect(scout).toContain('flowKind: "calibrate"');
    expect(scout).toContain("soundingProofUploadItem");

    const publicCalibrate = read("components/CalibrationFlowRunner.tsx");
    expect(publicCalibrate).toContain("model: closed.model");
    expect(publicCalibrate).toContain("soundingProofEvent");
  });

  it("live Calibrate is sounding and leftover canvas classify UI is gone", () => {
    expect(existsSync(join(ROOT, "components/calibrate/calibrate-live-surface.tsx"))).toBe(false);
    const sounding = read("components/calibrate/calibrate-sounding-surface.tsx");
    expect(sounding).toContain("data-calibrate-sounding");
    expect(sounding).not.toContain("Comfortable");
    const learnKept = read("components/session-view/ile-insight-kept-screen.tsx");
    expect(learnKept).not.toContain("SessionPolicyScoreResult");
    const verify = read("components/tap-score/tap-score-phases.tsx");
    expect(verify).toContain("SessionPolicyScoreResult");
  });
});
