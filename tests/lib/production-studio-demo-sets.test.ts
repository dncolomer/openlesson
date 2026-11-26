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
  PRODUCTION_STUDIO_DEMO_MARKER,
  PRODUCTION_STUDIO_DEMO_SETS,
  buildStudioDemoRegion,
  encodeStudioDemoRuns,
} from "@/lib/demo/production-studio-demo-sets";

const ROOT = join(__dirname, "../..");

describe("production Data Studio demo sets", () => {
  it("ships four verification protocol sets with mixed membership", () => {
    expect(PRODUCTION_STUDIO_DEMO_SETS).toHaveLength(4);
    expect(PRODUCTION_STUDIO_DEMO_SETS.filter((set) => set.product === "verification")).toHaveLength(
      4,
    );
    for (const set of PRODUCTION_STUDIO_DEMO_SETS) {
      expect(set.marker.startsWith(PRODUCTION_STUDIO_DEMO_MARKER)).toBe(true);
      expect(set.questions.every((question) => question.text.endsWith("?"))).toBe(true);
      const encoded = encodeStudioDemoRuns(set);
      expect(encoded).toHaveLength(6);
      const ada = encoded.find((run) => run.key === "ada")!;
      const bea = encoded.find((run) => run.key === "bea")!;
      const eve = encoded.find((run) => run.key === "eve")!;
      expect(vectorsMatch(ada.embedding.vector, bea.embedding.vector)).toBe(true);
      expect(ada.embedding.vector_path_text).not.toEqual(bea.embedding.vector_path_text);
      expect(ada.embedding.vector).not.toEqual(eve.embedding.vector);
      expect(ada.embedding.raw.flowKind).toBe(set.flowKind);
      expect(ada.embedding.raw.projectedPolicy?.sequence).toEqual(["r1", "r1-c1"]);
      const region = buildStudioDemoRegion(set, encoded);
      expect(region.embedding_model_id).toBe(FLOW_EMBEDDING_MODEL_ID);
      expect(region.subject_count).toBe(3);
      expect(computeKnowledgeDistance(ada.embedding.vector, region).in_region).toBe(true);
      expect(computeKnowledgeDistance(eve.embedding.vector, region).in_region).toBe(false);
      const voice = buildStudioDemoRegion(set, encoded, "path_text");
      expect(voice.embedding_model_id).toBe(FLOW_EMBEDDING_PATH_TEXT_MODEL_ID);
      expect(voice.name).toContain("Path + Text");
      expect(voice.name).not.toBe(region.name);
      expect(computeKnowledgeDistance(ada.embedding.vector_path_text, voice).in_region).toBe(true);
      expect(computeKnowledgeDistance(eve.embedding.vector_path_text, voice).in_region).toBe(false);
    }
    const [a, b] = PRODUCTION_STUDIO_DEMO_SETS;
    expect(encodeStudioDemoRuns(a)[0]?.embedding.vector).not.toEqual(
      encodeStudioDemoRuns(b)[0]?.embedding.vector,
    );
  });

});
