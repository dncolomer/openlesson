import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { completeFlowEmbedding, FLOW_EMBEDDING_DIM } from "@/lib/flow-embedding";
import {
  buildSessionCorpusRecord,
  reembedSessionCorpus,
} from "@/lib/session-corpus";
import { normalizeSessionBranchModel } from "@/lib/session-branch-model";

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

describe("session corpus re-embed", () => {
  it("rebuilds the Path vector from proof of work and the field model, not from a stored vector", () => {
    const model = fixtureModel();
    const original = completeFlowEmbedding({
      flowKind: "verify",
      model,
      sequence: ["r1"],
      pow: [
        {
          type: "tool",
          tool_name: "speech-segment",
          tool_action: "speech_stop",
          timestamp_ms: 1,
          payload: "delta at each step",
          metadata: { transcript_snapshot: "delta at each step" },
          xai_file_id: "file_11111111-1111-1111-1111-111111111111",
        },
      ],
    });
    const corpus = buildSessionCorpusRecord({
      sessionId: "sess-1",
      kind: "verify",
      fieldModel: model,
      result: {
        kind: "verify",
        projectedPolicy: { sequence: ["r1"], steps: 1, excess: 0, distance: 0 },
        knowledgeRegionId: null,
      },
      proofOfWork: [
        {
          id: "pow-1",
          type: "tool",
          toolName: "speech-segment",
          toolAction: "speech_stop",
          mimeType: "application/json",
          fileName: "speech.json",
          xaiFileId: "file_11111111-1111-1111-1111-111111111111",
          timestampMs: 1,
          metadata: { transcript_snapshot: "delta at each step" },
          payload: "delta at each step",
        },
      ],
    });
    expect(corpus.xaiFileIds).toEqual(["file_11111111-1111-1111-1111-111111111111"]);
    const rebuilt = reembedSessionCorpus(corpus, "verify");
    expect(rebuilt.vector).toHaveLength(FLOW_EMBEDDING_DIM);
    expect(rebuilt.vector).toEqual(original.vector);
    expect(rebuilt.vector_path_text).toEqual(original.vector_path_text);
  });

  it("changes the rebuilt vector when the walk changes", () => {
    const model = fixtureModel();
    const r1 = reembedSessionCorpus(
      buildSessionCorpusRecord({
        sessionId: "a",
        kind: "learn",
        fieldModel: model,
        result: {
          kind: "learn",
          projectedPolicy: { sequence: ["r1"], steps: 1, excess: 0, distance: 0 },
        },
        proofOfWork: [],
      }),
    );
    const r2 = reembedSessionCorpus(
      buildSessionCorpusRecord({
        sessionId: "b",
        kind: "learn",
        fieldModel: model,
        result: {
          kind: "learn",
          projectedPolicy: { sequence: ["r2"], steps: 1, excess: 0, distance: 0 },
        },
        proofOfWork: [],
      }),
    );
    expect(r1.vector).not.toEqual(r2.vector);
  });

  it("backup script reads proof of work and xAI file ids, not stored vectors as the corpus", () => {
    const src = readFileSync(join(__dirname, "../../scripts/backup-session-corpus.ts"), "utf8");
    expect(src).toContain("workspace_proof_of_work");
    expect(src).toContain("xai_file_id");
    expect(src).toContain("--download-files");
    expect(src).toContain("getFileContentResponse");
    const pkg = readFileSync(join(__dirname, "../../package.json"), "utf8");
    expect(pkg).toContain("corpus:backup");
    expect(pkg).toContain("corpus:reembed");
  });
});
