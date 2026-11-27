/**
 * Fresh consumer of the shipped embed API. Does not import encoder internals.
 */
import { describe, expect, it } from "vitest";
import {
  FLOW_EMBEDDING_MODEL_ID,
  recoverFlowEmbeddingRaw,
  vectorsMatch,
} from "@/lib/flow-embedding";
import { encodeFlowEmbedding, encodeFlowRaw } from "@/lib/flow-embedding-encode";
import { normalizeSessionBranchModel } from "@/lib/session-branch-model";

function tree() {
  const model = normalizeSessionBranchModel(
    {
      premise: "Consumer field.",
      closePrice: 12,
      keepPrice: 44,
      discardPrice: 70,
      insightPrice: 88,
      regions: [{ title: "Region", observation: "Open.", closePrice: 18, keepPrice: 22, discardPrice: 60, insightPrice: 90 }],
    },
    "Consumer",
    4,
  );
  if (!model) throw new Error("consumer tree was refused");
  return model;
}

describe("shipped flow embedding consumer", () => {
  it("embeds Calibrate-shaped and Verify-shaped raw to distinct recoverable vectors", async () => {
    const model = tree();
    const calibrate = await encodeFlowEmbedding({
      flowKind: "calibrate",
      model,
      pow: [{ type: "tool", tool_name: "probe", tool_action: "sounding", timestamp_ms: 1, payload: "coverage" }],
    });
    const verify = await encodeFlowEmbedding({
      flowKind: "verify",
      model,
      sequence: ["r1"],
      pow: [{ type: "speech", tool_name: "runner", timestamp_ms: 1, payload: "spoken proof" }],
    });
    expect(calibrate.vector.length).toBeGreaterThan(0);
    expect(verify.vector.length).toBeGreaterThan(0);
    expect(calibrate.vector).not.toEqual(verify.vector);
    expect(calibrate.vector).toEqual(calibrate.vector_path_text);
    expect(verify.vector).not.toEqual(verify.vector_path_text);
    expect(calibrate.embedding_model_id).toBe(FLOW_EMBEDDING_MODEL_ID);
    expect(calibrate.raw.projectedPolicy).toBeNull();
    expect(verify.raw.projectedPolicy).not.toBeNull();
    const recoveredCalibrate = recoverFlowEmbeddingRaw(calibrate);
    const recoveredVerify = recoverFlowEmbeddingRaw(verify);
    expect(recoveredCalibrate).toEqual(calibrate.raw);
    expect(recoveredVerify).toEqual(verify.raw);
    expect(vectorsMatch((await encodeFlowRaw(recoveredCalibrate!)).vector, calibrate.vector)).toBe(true);
    expect(vectorsMatch((await encodeFlowRaw(recoveredVerify!)).vector, verify.vector)).toBe(true);
  });
});
