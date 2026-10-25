import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  CALIBRATE_EMBEDDING_MODEL_ID,
  calibrateResultFromLegacyEvents,
  EMBEDDING_MODELS_V1,
  embeddingModelIdForFamily,
  FLOW_EMBEDDING_ALGORITHM_V1,
  LEARN_EMBEDDING_MODEL_ID,
  parseSessionResult,
  parseSoundingClassification,
  VERIFY_EMBEDDING_MODEL_ID,
} from "@/lib/core-data-model";

const ROOT = join(__dirname, "../..");

describe("core data model contract", () => {
  it("registers three v1 embedding families on the shared algorithm", () => {
    expect(EMBEDDING_MODELS_V1.map((row) => row.family)).toEqual(["learn", "calibrate", "verify"]);
    expect(EMBEDDING_MODELS_V1.every((row) => row.algorithmId === FLOW_EMBEDDING_ALGORITHM_V1)).toBe(
      true,
    );
    expect(embeddingModelIdForFamily("learn")).toBe(LEARN_EMBEDDING_MODEL_ID);
    expect(embeddingModelIdForFamily("calibrate")).toBe(CALIBRATE_EMBEDDING_MODEL_ID);
    expect(embeddingModelIdForFamily("verify")).toBe(VERIFY_EMBEDDING_MODEL_ID);
  });

  it("parses Learn, Verify, and Calibrate session results", () => {
    expect(
      parseSessionResult({
        kind: "learn",
        projectedPolicy: { sequence: ["r1", "root"], steps: 2, excess: 0, distance: 0 },
      }),
    ).toEqual({
      kind: "learn",
      projectedPolicy: { sequence: ["r1", "root"], steps: 2, excess: 0, distance: 0 },
    });
    expect(
      parseSessionResult({
        kind: "verify",
        projectedPolicy: { sequence: ["r1"], steps: 1, excess: 1, distance: 2 },
        knowledgeRegionId: "region-1",
      })?.kind,
    ).toBe("verify");
    const calibrate = parseSessionResult({
      kind: "calibrate",
      uncertainQuestionIds: ["q1"],
      trustedQuestionIds: ["q2"],
      classification: {
        band: "localized",
        coverageDepth: 2,
        reliability: "high",
        persistentTerritories: ["algebra"],
        falseCoverage: false,
      },
      expertProof: {
        questionId: "q2",
        source: "trusted",
        choice: "hit",
        transcript: "I would expand the definition.",
      },
    });
    expect(calibrate?.kind).toBe("calibrate");
    if (calibrate?.kind === "calibrate") {
      expect(calibrate.classification.band).toBe("localized");
      expect(calibrate.expertProof?.choice).toBe("hit");
    }
  });

  it("promotes staging sounding JSON strings into a Calibrate result", () => {
    const events = [
      {
        type: "sounding",
        source: "typed",
        questionId: "unranked",
        text: JSON.stringify({
          sounding: true,
          sounding_band: "unranked",
          sounding_coverage_depth: 0,
          sounding_reliability: "low",
          sounding_false_coverage: false,
          sounding_persistent_territories: [],
          sounding_taps: [
            { stillIds: ["a", "b"], tappedIds: ["a"] },
          ],
          sounding_proof_still: "a",
          sounding_proof_choice: "cant-tell",
          sounding_proof_transcript: null,
        }),
      },
    ];
    const result = calibrateResultFromLegacyEvents(events);
    expect(result?.kind).toBe("calibrate");
    expect(result?.uncertainQuestionIds).toEqual(["a"]);
    expect(result?.trustedQuestionIds).toEqual(["b"]);
    expect(result?.classification.band).toBe("unranked");
    expect(result?.expertProof?.choice).toBe("cant-tell");
  });

  it("rejects an unknown sounding band", () => {
    expect(parseSoundingClassification({ band: "expert" })).toBeNull();
  });

  it("keeps the contract document next to the types", () => {
    const path = join(ROOT, "docs/core-data-model.md");
    expect(existsSync(path)).toBe(true);
    const doc = readFileSync(path, "utf8");
    expect(doc).toContain("## PR Plan");
    expect(doc).toContain("### PR 1:");
    expect(doc).toContain("raw corpus");
  });

  it("foundation migration registers models, session result columns, and drops empty leftover tables", () => {
    const sql = readFileSync(
      join(ROOT, "supabase/migrations/20261025200000_core_data_model_foundation.sql"),
      "utf8",
    );
    expect(sql).toContain("create table if not exists public.embedding_models");
    expect(sql).toContain("learn-flowcfg-v1-d96");
    expect(sql).toContain("add column if not exists field_model jsonb");
    expect(sql).toContain("add column if not exists result jsonb");
    expect(sql).toContain("drop table if exists public.partners cascade");
    expect(sql).toContain("drop table if exists public.user_solana_wallets cascade");
    expect(sql).not.toContain("drop table if exists public.workspace_proof_of_work");
    expect(sql).not.toContain("drop table if exists public.sessions");
  });
});
