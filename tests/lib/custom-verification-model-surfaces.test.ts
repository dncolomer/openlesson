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

  it("pure geometry exports create + score", () => {
    const src = read("lib/knowledge-config/custom-verification-model.ts");
    expect(src).toContain("createCustomVerificationModelFromVectors");
    expect(src).toContain("scoreAgainstCustomVerificationModel");
    expect(src).toContain("validation_score");
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
