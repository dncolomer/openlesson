import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(__dirname, "../..");

function read(rel: string) {
  return readFileSync(join(ROOT, rel), "utf8");
}

const SURFACES = [
  "lib/knowledge-config/custom-verification-model.ts",
  "lib/pow-api/custom-verification-model-store.ts",
  "app/api/workspace/custom-verification-models/route.ts",
  "app/api/v3/eval/workspaces/[id]/custom-verification-models/route.ts",
  "components/CustomVerificationModelsPanel.tsx",
  "components/KnowledgeConfigTrajectoryPanel.tsx",
  "lib/sales/privacy-data-slide.ts",
  "supabase/migrations/20260719160000_custom_verification_models.sql",
] as const;

describe("custom verification model surfaces", () => {
  it("ships all inventory files", () => {
    for (const rel of SURFACES) {
      expect(existsSync(join(ROOT, rel)), `missing ${rel}`).toBe(true);
    }
  });

  it("pure geometry exports create + score", () => {
    const src = read("lib/knowledge-config/custom-verification-model.ts");
    expect(src).toContain("createCustomVerificationModelFromVectors");
    expect(src).toContain("scoreAgainstCustomVerificationModel");
    expect(src).toContain("validation_score");
  });

  it("workspace UI wires Custom Knowledge Regions cohort + synthetic create", () => {
    const ui = read("components/CustomVerificationModelsPanel.tsx");
    expect(ui).toContain("data-custom-knowledge-regions");
    expect(ui).toContain("Create from selected users");
    expect(ui).toContain("Generate synthetic knowledge region");
    expect(ui).toContain('action: "create"');
    expect(ui).toContain('action: "create_synthetic"');
    // Settings region cards are create/list only — distance lives on Embeddings overlays.
    expect(ui).not.toContain('action: "eval"');
    expect(ui).not.toContain('action: "knowledge_distance"');
    expect(ui).not.toContain("data-knowledge-distance-btn");
    expect(ui).not.toContain("Eval against region");
    expect(ui).toContain("data-create-synthetic-region");
    expect(ui).toContain("data-create-cohort-region");
    expect(ui).toContain("data-synthetic-region-prompt");
    expect(ui).toContain("data-synthetic-region-name");
    // Synthetic generate only requires a prompt (name is optional / auto-derived).
    expect(ui).toContain("disabled={synthesizing || !syntheticPrompt.trim()}");
    expect(ui).toContain("subjects");
    expect(ui).toContain("data-custom-verification-models");

    // Custom Knowledge Regions live in Settings; Embeddings overlays regions + distance.
    const brain = read("components/KnowledgeConfigTrajectoryPanel.tsx");
    expect(brain).not.toContain("<CustomVerificationModelsPanel");
    expect(brain).toContain("data-region-overlay-picker");
    expect(brain).toContain("data-region-overlay");
    expect(brain).toContain("projectTrajectoryAndRegions");
    expect(brain).toContain("regionOverlays");
    expect(brain).toContain("data-projection-algorithm-select");
    expect(brain).toContain('action: "knowledge_distance"');
    expect(brain).toContain("data-knowledge-distance");
    expect(brain).toContain("data-region-overlay-distances");
    expect(brain).toContain("showModels");
    expect(brain).toContain("showLwm");
    expect(brain).toContain('data-section="embeddings-projections"');

    const settings = read("components/WorkspaceIntegrationPanel.tsx");
    expect(settings).toContain("<CustomVerificationModelsPanel");
    expect(settings).toContain("Custom Knowledge Regions");
    expect(settings).toContain('data-settings-section="custom-knowledge-regions"');
    expect(settings).toContain('id: "regions"');
    expect(settings).toContain('data-settings-tab-panel="regions"');
    expect(settings).toContain('activeSubview === "regions"');
  });

  it("API routes expose cohort create, synthetic create, eval, knowledge distance, and listing", () => {
    const cookie = read("app/api/workspace/custom-verification-models/route.ts");
    expect(cookie).toContain("createCustomVerificationModelFromSubjects");
    expect(cookie).toContain("createSyntheticCustomVerificationModel");
    expect(cookie).toContain("create_synthetic");
    expect(cookie).toContain("evalSubjectAgainstCustomVerificationModel");
    expect(cookie).toContain("computeKnowledgeDistanceForSubject");
    expect(cookie).toContain("knowledge_distance");
    expect(cookie).toContain("listSubjectsWithKnowledgeConfig");

    const store = read("lib/pow-api/custom-verification-model-store.ts");
    expect(store).toContain("generateSyntheticRegionProfileWithGrok");
    expect(store).toContain("DEFAULT_MODEL");
    expect(store).toContain("createSyntheticKnowledgeRegionFromProfile");
    expect(store).toContain("computeKnowledgeDistance");

    const evalApi = read("app/api/v3/eval/workspaces/[id]/custom-verification-models/route.ts");
    expect(evalApi).toContain("createCustomVerificationModelFromSubjects");
    expect(evalApi).toContain("evalSubjectAgainstCustomVerificationModel");

    const kdApi = read("app/api/v3/eval/workspaces/[id]/knowledge-distance/route.ts");
    expect(kdApi).toContain("computeKnowledgeDistanceForSubject");
    expect(kdApi).not.toMatch(/from ["']@\/lib\/pow-api\/run-vertical-score["']/);
  });

  it("privacy slide uses custom verification model language", () => {
    const slide = read("lib/sales/privacy-data-slide.ts");
    expect(slide.toLowerCase()).toMatch(/custom verification model/);
    expect(slide.toLowerCase()).toMatch(/knowledge config/);
    expect(slide.toLowerCase()).toMatch(/hash|anonymiz/);
    expect(slide.toLowerCase()).toMatch(/sre|production/);
    expect(slide.toLowerCase()).toMatch(/proprietary|confidential/);
  });

  it("migration creates custom_verification_models table", () => {
    const sql = read("supabase/migrations/20260719160000_custom_verification_models.sql");
    expect(sql).toContain("custom_verification_models");
    expect(sql).toContain("centroid");
    expect(sql).toContain("cosine_threshold");
    expect(sql).toContain("ENABLE ROW LEVEL SECURITY");
  });
});
