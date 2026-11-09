import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { readKnowledgePanelSurface } from "../helpers/surface-source";

const ROOT = join(__dirname, "../..");

function read(rel: string) {
  return readFileSync(join(ROOT, rel), "utf8");
}

const SURFACES = [
  "lib/knowledge-config/custom-verification-model.ts",
  "lib/pow-api/custom-verification-model-store.ts",
  "lib/pow-api/custom-verification-model-crud.ts",
  "lib/pow-api/custom-verification-model-synthetic.ts",
  "lib/pow-api/custom-verification-model-eval.ts",
  "app/api/workspace/custom-knowledge-regions/route.ts",
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

  it("workspace Settings does not create knowledge regions", () => {
    const ui = read("components/CustomVerificationModelsPanel.tsx");
    expect(ui).not.toContain("data-region-create-from-flow");
    expect(ui).not.toContain('action: "create"');
    expect(ui).not.toContain("data-create-cohort-region");
    expect(ui).not.toContain("Create from verification flow");

    const brain = readKnowledgePanelSurface();
    expect(brain).not.toContain("<CustomVerificationModelsPanel");
    expect(brain).toContain("data-region-overlay-picker");
    expect(brain).toContain("data-region-overlay");
    expect(brain).toContain("projectTrajectoryAndRegions");
    expect(brain).toContain("regionOverlays");
    expect(brain).toContain("data-projection-algorithm-select");
    expect(brain).toContain("flowEmbeddingDistanceToRegion");
    expect(brain).toContain("data-knowledge-distance");
    expect(brain).toContain("data-region-overlay-distances");
    expect(brain).toContain("showModels");
    expect(brain).not.toContain("showLwm");
    expect(brain).toContain('data-knowledge-judge-report="removed"');
    expect(brain).toContain('data-section="embeddings-projections"');

    const settings = read("components/WorkspaceIntegrationPanel.tsx");
    expect(settings).not.toContain("<CustomVerificationModelsPanel");
    expect(settings).not.toContain('data-settings-section="custom-knowledge-regions"');
    expect(settings).not.toContain('data-settings-tab-panel="regions"');
    expect(settings).not.toContain("WorkspaceDataStudioPanel");
    expect(settings).toContain("settingsSubTabsForKind");
  });

  it("API routes expose listing, delete, eval, and knowledge distance; create is simulation-only", () => {
    const cookie = read("app/api/workspace/custom-knowledge-regions/route.ts");
    expect(cookie).toContain("Regions are created by running a simulation");
    expect(cookie).not.toContain("createCustomVerificationModelFromSubjects");
    expect(cookie).not.toContain("createSyntheticCustomVerificationModel");
    expect(cookie).toContain("deleteCustomVerificationModel");
    expect(cookie).toContain('action === "delete"');
    expect(cookie).toContain("evalSubjectAgainstCustomVerificationModel");
    expect(cookie).toContain("computeKnowledgeDistanceForSubject");
    expect(cookie).toContain("knowledge_distance");
    expect(cookie).toContain("listSubjectsWithKnowledgeConfig");

    const barrel = read("lib/pow-api/custom-verification-model-store.ts");
    expect(barrel).toContain("generateSyntheticRegionProfileWithGrok");
    expect(barrel).toContain("deleteCustomVerificationModel");
    expect(barrel).toContain("buildSyntheticRegionGenerationPrompt");
    expect(barrel).toContain("decodeSyntheticRegionFileText");
    expect(barrel).toContain("computeKnowledgeDistanceForSubject");
    expect(barrel).not.toMatch(/^export (async )?function /m);
    expect(barrel).toContain('from "@/lib/pow-api/custom-verification-model-crud"');
    expect(barrel).toContain('from "@/lib/pow-api/custom-verification-model-synthetic"');
    expect(barrel).toContain('from "@/lib/pow-api/custom-verification-model-eval"');

    const store = [
      read("lib/pow-api/custom-verification-model-crud.ts"),
      read("lib/pow-api/custom-verification-model-synthetic.ts"),
      read("lib/pow-api/custom-verification-model-eval.ts"),
    ].join("\n");
    expect(store).toContain("generateSyntheticRegionProfileWithGrok");
    expect(store).toContain("DEFAULT_MODEL");
    expect(store).toContain("createSyntheticKnowledgeRegionFromProfile");
    expect(store).toContain("computeKnowledgeDistance");
    expect(store).toContain("deleteCustomVerificationModel");
    expect(store).toContain("voiceRegionName");
    expect(store).toContain("pathTextRegionCompanionNames");
    expect(store).toContain("FLOW_EMBEDDING_PATH_TEXT_MODEL_ID");
    expect(store).toContain("vector_path_text");
    expect(store).toContain("buildSyntheticRegionGenerationPrompt");
    expect(store).toContain("decodeSyntheticRegionFileText");
    expect(store).toContain("files");
    expect(store).toContain("fileIds");
    expect(store).toContain("callXaiResponsesWithFiles");
    expect(store).toContain('.eq("identity", identity)');

    expect(existsSync(join(ROOT, "app/api/v3/snapshot/workspaces/[id]/custom-knowledge-regions/route.ts"))).toBe(
      false,
    );
    expect(existsSync(join(ROOT, "app/api/v3/snapshot/workspaces/[id]/knowledge-distance/route.ts"))).toBe(
      false,
    );
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
