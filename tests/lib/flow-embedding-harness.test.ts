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

  it("embeds the same raw payload to an identical Path vector twice", () => {
    const a = embedHarnessCase(cases[0]);
    const b = embedHarnessCase(cases[0]);
    expect(a.path).toHaveLength(FLOW_EMBEDDING_DIM);
    expect(vectorsMatch(a.path, b.path)).toBe(true);
    expect(vectorsMatch(a.path_text, b.path_text)).toBe(true);
  });

  it("separates cheap expert walks from costly novice walks on the same tree", () => {
    const expert = embedHarnessCase(cases.find((row) => row.id === "q-expert-a")!);
    const novice = embedHarnessCase(cases.find((row) => row.id === "q-novice-a")!);
    expect(vectorsMatch(expert.path, novice.path)).toBe(false);
    expect(cosineSimilarity(expert.path, novice.path)).toBeLessThan(0.999);
  });

  it("keeps Path fixed when only the transcript changes; Path + Text moves", () => {
    const long = embedHarnessCase(cases.find((row) => row.id === "q-expert-c")!);
    const short = embedHarnessCase(cases.find((row) => row.id === "q-expert-b")!);
    const silent = embedHarnessCase(cases.find((row) => row.id === "q-expert-silent")!);
    expect(vectorsMatch(long.path, short.path)).toBe(true);
    expect(vectorsMatch(long.path, silent.path)).toBe(true);
    expect(vectorsMatch(silent.path, silent.path_text)).toBe(true);
    expect(vectorsMatch(long.path_text, short.path_text)).toBe(false);
    expect(vectorsMatch(long.path_text, long.path)).toBe(false);
  });

  it("changes Path when the walk sketch is zeroed", () => {
    const expert = embedHarnessCase(cases.find((row) => row.id === "q-expert-a")!);
    expect(vectorsMatch(expert.path, expert.path_no_walk)).toBe(false);
    expect(cosineSimilarity(expert.path, expert.path_no_walk)).toBeLessThan(0.999);
  });

  it("builds a provisional expert region that holds experts and scores novices farther", () => {
    const report = runFlowEmbeddingHarness({ cases, projection: "pca" });
    expect(report.algorithm_id).toBe(FLOW_EMBEDDING_MODEL_ID);
    expect(report.ablations.determinism).toBe(true);
    expect(report.ablations.path_equals_path_text_when_silent).toContain("q-expert-silent");
    expect(report.region).not.toBeNull();
    const scores = report.region!.scores;
    const experts = scores.filter((row) => row.role === "expert" && row.problem === "quadratic");
    const novices = scores.filter((row) => row.role === "novice" && row.problem === "quadratic");
    expect(experts.every((row) => row.in_region)).toBe(true);
    const expertCos = Math.min(...experts.map((row) => row.cosine_similarity));
    const noviceCos = Math.max(...novices.map((row) => row.cosine_similarity));
    expect(expertCos).toBeGreaterThan(noviceCos);
    expect(report.cases.every((row) => Number.isFinite(row.xy.x) && Number.isFinite(row.xy.y))).toBe(true);
  });

  it("wires harness and re-embed scripts without changing the capture format", () => {
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
