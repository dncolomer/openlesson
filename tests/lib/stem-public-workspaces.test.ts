import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "fs";
import { join } from "path";
import {
  STEM_PUBLIC_CATALOG_MARKER,
  STEM_PUBLIC_FIELDS,
  STEM_REQUIRED_FIELD_KEYS,
  assertStemCatalogComplete,
  blocksForStemField,
  buildAllStemRegionsForField,
  buildStemSubdisciplineRegion,
  getStemField,
  stemFieldNotesMarker,
  stemWorkspaceNotes,
} from "@/lib/demo/stem-public-workspaces";
import {
  KNOWLEDGE_CONFIG_DIM,
  KNOWLEDGE_CONFIG_EMBEDDING_MODEL_ID,
  isKnowledgeConfigVector,
} from "@/lib/knowledge-config";

const root = join(__dirname, "../..");

describe("STEM public workspace catalog", () => {
  it("covers required major STEM fields with multi-region subdisciplines", () => {
    const summary = assertStemCatalogComplete();
    expect(summary.fieldCount).toBeGreaterThanOrEqual(8);
    expect(summary.minRegionsPerField).toBeGreaterThanOrEqual(3);
    expect(STEM_REQUIRED_FIELD_KEYS).toEqual(
      expect.arrayContaining([
        "mathematics",
        "physics",
        "chemistry",
        "biology",
        "computer_science",
        "engineering",
        "earth_environmental",
        "astronomy_space",
      ]),
    );
    for (const key of STEM_REQUIRED_FIELD_KEYS) {
      const field = getStemField(key);
      expect(field).toBeTruthy();
      expect(field!.title.length).toBeGreaterThan(2);
      expect(field!.subdisciplines.length).toBeGreaterThanOrEqual(3);
      expect(stemWorkspaceNotes(field!).includes(STEM_PUBLIC_CATALOG_MARKER)).toBe(true);
      expect(stemFieldNotesMarker(key)).toContain(`STEM_FIELD:${key}`);
    }
  });

  it("maps each subdiscipline region to a 1:1 workspace block", () => {
    for (const field of STEM_PUBLIC_FIELDS) {
      const blocks = blocksForStemField(field);
      const regions = buildAllStemRegionsForField(field, `ws-${field.key}`);
      expect(blocks.length).toBe(field.subdisciplines.length);
      expect(blocks.length).toBe(regions.length);
      expect(blocks.length).toBeGreaterThan(1);
      for (let i = 0; i < blocks.length; i++) {
        expect(blocks[i].title).toBe(field.subdisciplines[i].regionName);
        expect(blocks[i].title).toBe(regions[i].name);
        expect(blocks[i].key).toBe(field.subdisciplines[i].key);
        expect(blocks[i].description).toBe(field.subdisciplines[i].description);
      }
      expect(blocks.filter((b) => b.is_start)).toHaveLength(1);
      expect(blocks[0].is_start).toBe(true);
    }
    const summary = assertStemCatalogComplete();
    for (const f of summary.fields) {
      expect(f.blockCount).toBe(f.regionCount);
      expect(f.blockTitles).toEqual(f.regionNames);
    }
  });

  it("builds real knowledgecfg region vectors via synthetic encoder path", () => {
    const math = getStemField("mathematics");
    expect(math).toBeTruthy();
    const regions = buildAllStemRegionsForField(math!, "ws-stem-math-test");
    expect(regions.length).toBe(math!.subdisciplines.length);
    expect(regions.length).toBeGreaterThanOrEqual(3);

    const names = new Set(regions.map((r) => r.name));
    expect(names.size).toBe(regions.length);

    for (const region of regions) {
      expect(region.embedding_model_id).toBe(KNOWLEDGE_CONFIG_EMBEDDING_MODEL_ID);
      expect(region.dim).toBe(KNOWLEDGE_CONFIG_DIM);
      expect(isKnowledgeConfigVector(region.centroid, KNOWLEDGE_CONFIG_DIM)).toBe(true);
      expect(region.subject_count).toBeGreaterThanOrEqual(1);
      expect(region.mean_radius).toBeGreaterThan(0);
      // Unit vector-ish: L2 norm ~1
      const norm = Math.sqrt(region.centroid.reduce((s, v) => s + v * v, 0));
      expect(norm).toBeGreaterThan(0.99);
      expect(norm).toBeLessThan(1.01);
    }

    // Distinct fields should not collapse to identical centroids for first regions
    const physics = getStemField("physics")!;
    const mathFirst = buildStemSubdisciplineRegion(math!, math!.subdisciplines[0], "ws-a");
    const physFirst = buildStemSubdisciplineRegion(physics, physics.subdisciplines[0], "ws-b");
    const same = mathFirst.centroid.every(
      (v, i) => Math.abs(v - physFirst.centroid[i]) < 1e-12,
    );
    expect(same).toBe(false);
  });

  it("ships seed and verify scripts with staging-default / explicit prod safety", () => {
    const seed = join(root, "scripts/seed-stem-public-workspaces.ts");
    const verify = join(root, "scripts/verify-stem-public-workspaces.ts");
    expect(existsSync(seed)).toBe(true);
    expect(existsSync(verify)).toBe(true);
    const seedSrc = readFileSync(seed, "utf8");
    const verifySrc = readFileSync(verify, "utf8");
    expect(seedSrc).toContain("parseSaasTechDemoSeedTarget");
    expect(seedSrc).toContain("is_public");
    expect(seedSrc).toContain("true");
    expect(seedSrc).toContain("custom_verification_models");
    expect(seedSrc).toContain("STEM_PUBLIC_FIELDS");
    expect(seedSrc).toContain("is_admin");
    expect(verifySrc).toContain("is_public");
    expect(verifySrc).toContain("is_admin");
    expect(verifySrc).toContain("custom_verification_models");
    expect(verifySrc).toContain("isKnowledgeConfigVector");

    const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
    expect(pkg.scripts["db:seed-stem-public:staging"]).toBeTruthy();
    expect(pkg.scripts["db:verify-stem-public:staging"]).toBeTruthy();
    expect(pkg.scripts["db:seed-stem-public:prod"]).toContain("--target=prod");
    expect(pkg.scripts["db:verify-stem-public:prod"]).toContain("--target=prod");
  });
});
