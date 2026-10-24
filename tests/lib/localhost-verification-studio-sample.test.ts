import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { computeKnowledgeDistance } from "@/lib/knowledge-config";
import {
  FLOW_EMBEDDING_MODEL_ID,
  FLOW_EMBEDDING_PATH_TEXT_MODEL_ID,
  vectorsMatch,
} from "@/lib/flow-embedding";
import {
  LOCALHOST_VERIFICATION_STUDIO_FLOW,
  LOCALHOST_VERIFICATION_STUDIO_MARKER,
  LOCALHOST_VERIFICATION_STUDIO_RUNS,
  LOCALHOST_VERIFICATION_STUDIO_WORKSPACE,
  buildLocalhostVerificationStudioRegion,
  encodeLocalhostVerificationStudioRuns,
  localhostVerificationStudioTree,
} from "@/lib/demo/localhost-verification-studio-sample";

const ROOT = join(__dirname, "../..");

describe("localhost verification Data Studio sample", () => {
  it("builds a priced hidden-state tree, distinct walks, and a Path region", () => {
    const model = localhostVerificationStudioTree();
    expect(model.branches.find((branch) => branch.id === "root")?.edges.length).toBeGreaterThan(0);
    expect(model.branches.some((branch) => branch.id === "r1-c1")).toBe(true);
    const encoded = encodeLocalhostVerificationStudioRuns(model);
    expect(encoded).toHaveLength(LOCALHOST_VERIFICATION_STUDIO_RUNS.length);
    const ada = encoded.find((run) => run.key === "ada")!;
    const bea = encoded.find((run) => run.key === "bea")!;
    const eve = encoded.find((run) => run.key === "eve")!;
    expect(vectorsMatch(ada.embedding.vector, bea.embedding.vector)).toBe(true);
    expect(ada.embedding.vector_path_text).not.toEqual(bea.embedding.vector_path_text);
    expect(ada.embedding.vector).not.toEqual(eve.embedding.vector);
    expect(ada.embedding.raw.projectedPolicy?.sequence).toEqual(["r1", "r1-c1"]);
    const region = buildLocalhostVerificationStudioRegion(encoded);
    expect(region.embedding_model_id).toBe(FLOW_EMBEDDING_MODEL_ID);
    expect(region.subject_count).toBe(3);
    expect(computeKnowledgeDistance(ada.embedding.vector, region).in_region).toBe(true);
    expect(computeKnowledgeDistance(eve.embedding.vector, region).in_region).toBe(false);
    const voice = buildLocalhostVerificationStudioRegion(encoded, "path_text");
    expect(voice.embedding_model_id).toBe(FLOW_EMBEDDING_PATH_TEXT_MODEL_ID);
    expect(voice.name).toBe("ε-δ walkers · Path + Text");
    expect(computeKnowledgeDistance(ada.embedding.vector_path_text, voice).in_region).toBe(true);
    expect(computeKnowledgeDistance(eve.embedding.vector_path_text, voice).in_region).toBe(false);
    expect(LOCALHOST_VERIFICATION_STUDIO_WORKSPACE.workspace_kind).toBe("knowledge_region");
    expect(LOCALHOST_VERIFICATION_STUDIO_WORKSPACE.notes).toContain(
      LOCALHOST_VERIFICATION_STUDIO_MARKER,
    );
    expect(LOCALHOST_VERIFICATION_STUDIO_FLOW.questions[0]?.text.endsWith("?")).toBe(true);
  });

  it("seeds only localhost/staging and writes recoverable flow embeddings", () => {
    const seed = readFileSync(
      join(ROOT, "scripts/seed-localhost-verification-studio.ts"),
      "utf8",
    );
    expect(seed).toContain('connectTarget("staging")');
    expect(seed).toContain("This seed is localhost/staging only");
    expect(seed).toContain("xzwjlkngxuxttvqbboea");
    expect(seed).toContain("tap_session_id");
    expect(seed).toContain("workspace_kind");
    expect(seed).toContain("workspace_flow_embeddings");
    expect(seed).toContain("transcript_snapshot");
    expect(seed).toContain("custom_verification_models");
    expect(seed).toContain("regions.voice");
    expect(existsSync(join(ROOT, "scripts/seed-localhost-verification-studio.ts"))).toBe(true);
  });
});
