import { describe, expect, it } from "vitest";
import {
  KNOWLEDGE_CONFIG_DIM,
  KNOWLEDGE_CONFIG_EMBEDDING_MODEL_ID,
  createSyntheticKnowledgeRegionFromProfile,
  encodeSyntheticRegionProfile,
  isKnowledgeConfigVector,
  projectKnowledgeConfigTo2D,
  projectKnowledgeRegionToOverlay,
  projectKnowledgeRegionsToOverlays,
  scoreAgainstCustomVerificationModel,
} from "@/lib/knowledge-config";

describe("synthetic knowledge region (shipped knowledgecfg path)", () => {
  it("encodes profile into knowledgecfg-v1-d64 unit vector via real encoder", () => {
    const vector = encodeSyntheticRegionProfile({
      name: "Incident commander",
      verification_score: 88,
      augmentation_score: 80,
      optimization_score: 75,
      ghc_score: 70,
      strengths: ["runbook-discipline", "calm-comms"],
      friction_patterns: ["alert-fatigue"],
      preferred_modalities: ["tool", "speech"],
      pow_types: ["tool", "screen", "speech"],
      tool_names: ["pager", "console"],
    });

    expect(isKnowledgeConfigVector(vector, KNOWLEDGE_CONFIG_DIM)).toBe(true);
    expect(vector).toHaveLength(KNOWLEDGE_CONFIG_DIM);
    const norm = Math.sqrt(vector.reduce((s, x) => s + x * x, 0));
    expect(norm).toBeGreaterThan(0.99);
    expect(norm).toBeLessThan(1.01);
  });

  it("createSyntheticKnowledgeRegionFromProfile yields cohort-compatible region spec", () => {
    const region = createSyntheticKnowledgeRegionFromProfile({
      name: "SRE high bar",
      profile: {
        verification_score: 90,
        strengths: ["incident-response"],
        pow_types: ["tool", "speech"],
      },
    });

    expect(region.name).toBe("SRE high bar");
    expect(region.embedding_model_id).toBe(KNOWLEDGE_CONFIG_EMBEDDING_MODEL_ID);
    expect(region.dim).toBe(KNOWLEDGE_CONFIG_DIM);
    expect(region.centroid).toHaveLength(64);
    expect(region.subject_count).toBe(1);
    expect(region.cosine_threshold).toBeGreaterThan(0.3);
    expect(region.cosine_threshold).toBeLessThanOrEqual(0.99);

    // Self-score should land in-region against the synthetic centroid.
    const score = scoreAgainstCustomVerificationModel(region.centroid, region);
    expect(score.in_region).toBe(true);
    expect(score.validation_score).toBeGreaterThan(50);
  });

  it("projectKnowledgeRegionToOverlay uses real 2D frame (same as trajectory projection)", () => {
    const regionA = createSyntheticKnowledgeRegionFromProfile({
      name: "Overlay A",
      profile: { verification_score: 70, strengths: ["transfer"] },
    });
    const regionB = createSyntheticKnowledgeRegionFromProfile({
      name: "Overlay B",
      profile: {
        verification_score: 40,
        strengths: ["novice"],
        pow_types: ["screen"],
        tool_names: ["notes"],
      },
    });

    const expected = projectKnowledgeConfigTo2D(regionA.centroid);
    const overlay = projectKnowledgeRegionToOverlay({
      id: "r1",
      name: regionA.name,
      centroid: regionA.centroid,
      mean_radius: regionA.mean_radius,
      cosine_threshold: regionA.cosine_threshold,
    });

    expect(overlay.id).toBe("r1");
    expect(overlay.name).toBe("Overlay A");
    expect(overlay.x).toBeCloseTo(expected.x, 8);
    expect(overlay.y).toBeCloseTo(expected.y, 8);
    expect(overlay.radius).toBeGreaterThan(0);
    expect(overlay.radius).toBeLessThanOrEqual(0.55);

    const multi = projectKnowledgeRegionsToOverlays([
      {
        id: "a",
        name: regionA.name,
        centroid: regionA.centroid,
        mean_radius: regionA.mean_radius,
        cosine_threshold: regionA.cosine_threshold,
      },
      {
        id: "b",
        name: regionB.name,
        centroid: regionB.centroid,
        mean_radius: regionB.mean_radius,
        cosine_threshold: regionB.cosine_threshold,
      },
    ]);
    expect(multi).toHaveLength(2);
    expect(multi.map((o) => o.id)).toEqual(["a", "b"]);
    // Distinct profiles should not collapse to identical projection points always,
    // but if they do, multi-select still carries both overlays.
    expect(multi[0].name).toBe("Overlay A");
    expect(multi[1].name).toBe("Overlay B");
  });

  it("distinct synthetic profiles produce different centroids (multi-region)", () => {
    const strong = createSyntheticKnowledgeRegionFromProfile({
      name: "Strong",
      profile: {
        verification_score: 95,
        strengths: ["expert-depth", "transfer"],
        pow_types: ["tool", "speech", "screen"],
      },
    });
    const weak = createSyntheticKnowledgeRegionFromProfile({
      name: "Weak",
      profile: {
        verification_score: 15,
        strengths: [],
        pow_types: ["tool"],
        tool_names: ["notes"],
      },
    });
    const cos =
      strong.centroid.reduce((s, v, i) => s + v * weak.centroid[i], 0);
    // Not identical vectors.
    expect(cos).toBeLessThan(0.999);
  });
});
