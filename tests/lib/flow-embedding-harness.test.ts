import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  FLOW_EMBEDDING_DIM,
  FLOW_EMBEDDING_MODEL_ID,
  vectorsMatch,
} from "@/lib/flow-embedding";
import { syntheticFlowHarnessCases } from "@/lib/flow-embedding-fixtures";
import {
  embedHarnessCase,
  runFlowEmbeddingHarness,
} from "@/lib/flow-embedding-harness";
import { cosineSimilarity } from "@/lib/knowledge-config/math";

const ROOT = join(__dirname, "../..");

describe("flowcfg-v1-d96 harness", () => {
  const cases = syntheticFlowHarnessCases();

  it("embeds the same raw payload to an identical Path vector twice", async () => {
    const a = await embedHarnessCase(cases[0]);
    const b = await embedHarnessCase(cases[0]);
    expect(a.path).toHaveLength(FLOW_EMBEDDING_DIM);
    expect(vectorsMatch(a.path, b.path)).toBe(true);
    expect(vectorsMatch(a.path_text, b.path_text)).toBe(true);
  });

  it("separates cheap expert walks from costly novice walks on the same tree", async () => {
    const expert = await embedHarnessCase(cases.find((row) => row.id === "q-expert-a")!);
    const novice = await embedHarnessCase(cases.find((row) => row.id === "q-novice-a")!);
    expect(vectorsMatch(expert.path, novice.path)).toBe(false);
    expect(cosineSimilarity(expert.path, novice.path)).toBeLessThan(0.999);
  });

  it("encodes harness cases through the embeddings host", async () => {
    const expert = await embedHarnessCase(cases.find((row) => row.id === "q-expert-a")!);
    expect(expert.path).toHaveLength(FLOW_EMBEDDING_DIM);
    expect(expert.path_text).toHaveLength(FLOW_EMBEDDING_DIM);
  });

  it("builds a provisional expert region from hosted Path numbers", async () => {
    const report = await runFlowEmbeddingHarness({ cases, projection: "pca" });
    expect(report.algorithm_id).toBe(FLOW_EMBEDDING_MODEL_ID);
    expect(report.ablations.determinism).toBe(true);
    expect(report.ablations.path_equals_path_text_when_silent).toContain("q-expert-silent");
    expect(report.region).not.toBeNull();
    const scores = report.region!.scores;
    const experts = scores.filter((row) => row.role === "expert" && row.problem === "quadratic");
    expect(experts.every((row) => row.in_region)).toBe(true);
    expect(report.cases.every((row) => Number.isFinite(row.xy.x) && Number.isFinite(row.xy.y))).toBe(true);
  });

  it("wires harness and re-embed scripts without changing the capture format", async () => {
    const pkg = readFileSync(join(ROOT, "package.json"), "utf8");
    expect(pkg).toContain("corpus:harness");
    expect(pkg).not.toContain("corpus:train-flow");
    const reembed = readFileSync(join(ROOT, "scripts/reembed-session-corpus.ts"), "utf8");
    expect(reembed).not.toContain("flowcfg-trained-v1-d128");
    const store = readFileSync(join(ROOT, "lib/flow-embedding-store.ts"), "utf8");
    expect(store).toContain("FLOW_EMBEDDING_MODEL_ID");
    expect(store).not.toContain("flowcfg-trained-v1-d128");
  });
});
