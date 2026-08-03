/**
 * Unit tests for pure Highschool Algebra demo workspace helpers.
 * Exercises shipped knowledge-config / synthetic region APIs — no hardcoded vectors.
 */
import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  KNOWLEDGE_CONFIG_DIM,
  KNOWLEDGE_CONFIG_EMBEDDING_MODEL_ID,
  isKnowledgeConfigVector,
  scoreAgainstCustomVerificationModel,
} from "@/lib/knowledge-config";
import {
  HS_ALGEBRA_BLOCKS,
  HS_ALGEBRA_DEMO_MARKER,
  HS_ALGEBRA_DEMO_WORKSPACE,
  HS_ALGEBRA_GUESTS,
  HS_ALGEBRA_REGIONS,
  assertHsAlgebraCatalogShape,
  buildAlgebraRegion,
  buildAllAlgebraRegions,
  encodeAlgebraGuest,
  encodeAllAlgebraGuests,
  hsAlgebraGuestEmail,
  algebraRegionByKey,
} from "@/lib/demo/hs-algebra-demo-workspace";
import { parseSaasTechDemoSeedTarget } from "../../scripts/saas-tech-demo-target";

describe("hs-algebra demo workspace (pure helpers)", () => {
  it("workspace copy is high-school algebra scoped with stable demo marker", () => {
    expect(HS_ALGEBRA_DEMO_WORKSPACE.title).toMatch(/algebra/i);
    expect(HS_ALGEBRA_DEMO_WORKSPACE.title).toMatch(/high\s*school/i);
    expect(HS_ALGEBRA_DEMO_WORKSPACE.root_topic).toMatch(/algebra/i);
    expect(HS_ALGEBRA_DEMO_WORKSPACE.description.length).toBeGreaterThan(80);
    expect(HS_ALGEBRA_DEMO_WORKSPACE.description).toMatch(/equation|linear|quadratic|polynomial/i);
    expect(HS_ALGEBRA_DEMO_WORKSPACE.notes).toContain(HS_ALGEBRA_DEMO_MARKER);
    expect(HS_ALGEBRA_BLOCKS.length).toBeGreaterThanOrEqual(3);
    expect(HS_ALGEBRA_BLOCKS.some((b) => b.is_start)).toBe(true);
  });

  it("assertHsAlgebraCatalogShape enforces exactly 2 regions and ≥3 multi-event guests", () => {
    const shape = assertHsAlgebraCatalogShape();
    expect(shape.regionCount).toBe(2);
    expect(shape.guestCount).toBeGreaterThanOrEqual(3);
    expect(shape.minPowPerGuest).toBeGreaterThanOrEqual(2);
    expect(shape.regionNames.join(" ")).toMatch(/Foundation/i);
    expect(shape.regionNames.join(" ")).toMatch(/Advanced|Procedure/i);
    expect(shape.guestNames.length).toBe(shape.guestCount);
  });

  it("exactly two region builders produce valid knowledgecfg-v1-d64 centroids with synthetic label", () => {
    const regions = buildAllAlgebraRegions("unit-hs-algebra");
    expect(regions).toHaveLength(2);

    for (const region of regions) {
      expect(region.embedding_model_id).toBe(KNOWLEDGE_CONFIG_EMBEDDING_MODEL_ID);
      expect(region.dim).toBe(KNOWLEDGE_CONFIG_DIM);
      expect(isKnowledgeConfigVector(region.centroid, KNOWLEDGE_CONFIG_DIM)).toBe(true);
      expect(region.subjects.some((s) => s.label === "synthetic:grok-4.5")).toBe(true);
      const self = scoreAgainstCustomVerificationModel(region.centroid, region);
      expect(self.in_region).toBe(true);
      const norm = Math.sqrt(region.centroid.reduce((s, x) => s + x * x, 0));
      expect(norm).toBeGreaterThan(0.99);
      expect(norm).toBeLessThan(1.01);
    }

    const names = new Set(regions.map((r) => r.name));
    expect(names.size).toBe(2);
  });

  it("buildAlgebraRegion uses createSyntheticKnowledgeRegionFromProfile path (no hardcoded vectors)", () => {
    const foundations = algebraRegionByKey("foundations");
    const advanced = algebraRegionByKey("advanced");
    const a = buildAlgebraRegion(foundations, "unit-ws-a");
    const b = buildAlgebraRegion(advanced, "unit-ws-b");
    const cos = a.centroid.reduce((s, v, i) => s + v * b.centroid[i], 0);
    // Distinct algebra competency profiles must not collapse to identical vectors.
    expect(cos).toBeLessThan(0.999);
    expect(cos).toBeGreaterThan(-1);
    expect(a.name).toMatch(/Foundation/i);
    expect(b.name).toMatch(/Advanced|Procedure/i);
  });

  it("at least three guest subjects each expose ≥2 PoW events with distinct tool_name / file metadata", () => {
    expect(HS_ALGEBRA_GUESTS.length).toBeGreaterThanOrEqual(3);

    for (const guest of HS_ALGEBRA_GUESTS) {
      expect(guest.displayName.length).toBeGreaterThan(2);
      expect(guest.displayName).not.toMatch(/^demo\d+$/i);
      expect(guest.powEvents.length).toBeGreaterThanOrEqual(2);

      const toolNames = new Set(guest.powEvents.map((e) => e.tool_name));
      expect(toolNames.size).toBeGreaterThanOrEqual(2);

      const files = new Set(guest.powEvents.map((e) => e.file_name));
      expect(files.size).toBe(guest.powEvents.length);

      // Mixed tool/screen style across the catalog (per-guest or overall).
      const types = new Set(guest.powEvents.map((e) => e.proof_of_work_type));
      expect(types.has("tool") || types.has("screen")).toBe(true);
    }

    // Across guests, tool + screen both appear.
    const allTypes = new Set(
      HS_ALGEBRA_GUESTS.flatMap((g) => g.powEvents.map((e) => e.proof_of_work_type)),
    );
    expect(allTypes.has("tool")).toBe(true);
    expect(allTypes.has("screen")).toBe(true);

    // Algebra-authentic tools
    const allTools = HS_ALGEBRA_GUESTS.flatMap((g) => g.powEvents.map((e) => e.tool_name)).join(
      " ",
    );
    expect(allTools).toMatch(
      /desmos|equation|factor|quadratic|algebra-tiles|system-solver|expression/i,
    );
  });

  it("encodeAlgebraGuest uses real encodeKnowledgeConfig path (knowledgecfg-v1-d64)", () => {
    const guest = HS_ALGEBRA_GUESTS[0];
    const encoded = encodeAlgebraGuest(guest, { workspaceId: "unit-ws" });
    expect(encoded.embedding.embedding_model_id).toBe(KNOWLEDGE_CONFIG_EMBEDDING_MODEL_ID);
    expect(encoded.embedding.dim).toBe(KNOWLEDGE_CONFIG_DIM);
    expect(isKnowledgeConfigVector(encoded.vector, KNOWLEDGE_CONFIG_DIM)).toBe(true);
    expect(encoded.embedding.pow_event_count).toBe(guest.powEvents.length);
    expect(encoded.powRows.length).toBe(guest.powEvents.length);
    expect(encoded.powRows[0].metadata).toMatchObject({
      demo_marker: HS_ALGEBRA_DEMO_MARKER,
      subject_key: guest.key,
    });
    const norm = Math.sqrt(encoded.vector.reduce((s, x) => s + x * x, 0));
    expect(norm).toBeGreaterThan(0.99);
    expect(norm).toBeLessThan(1.01);
  });

  it("distinct guests produce non-identical embeddings (no hardcoded vectors)", () => {
    const encoded = encodeAllAlgebraGuests("unit-ws");
    expect(encoded.length).toBe(HS_ALGEBRA_GUESTS.length);
    const a = encoded[0];
    const b = encoded[encoded.length - 1];
    const cos = a.vector.reduce((s, v, i) => s + v * b.vector[i], 0);
    expect(cos).toBeLessThan(0.999);
    expect(cos).toBeGreaterThan(-1);
  });

  it("guest emails use demo domain and distinct local parts", () => {
    const emails = HS_ALGEBRA_GUESTS.map((g) => hsAlgebraGuestEmail(g.emailLocalPart));
    expect(new Set(emails).size).toBe(emails.length);
    for (const email of emails) {
      expect(email).toMatch(/@demo\.uncertain\.systems$/);
      expect(email).toMatch(/hs-algebra-demo/);
    }
  });

  it("seed and verify scripts exist and target parser defaults to staging", () => {
    const root = process.cwd();
    expect(existsSync(join(root, "lib/demo/hs-algebra-demo-workspace.ts"))).toBe(true);
    expect(existsSync(join(root, "scripts/seed-hs-algebra-demo-workspace.ts"))).toBe(true);
    expect(existsSync(join(root, "scripts/verify-hs-algebra-demo-workspace.ts"))).toBe(true);

    expect(parseSaasTechDemoSeedTarget(["node", "script"])).toBe("staging");
    expect(parseSaasTechDemoSeedTarget(["node", "script", "--target=staging"])).toBe("staging");
    expect(parseSaasTechDemoSeedTarget(["node", "script", "--target=prod"])).toBe("prod");
    expect(() => parseSaasTechDemoSeedTarget(["node", "script", "--target=dev"])).toThrow(
      /Refusing target/,
    );

    const seedSrc = readFileSync(join(root, "scripts/seed-hs-algebra-demo-workspace.ts"), "utf8");
    expect(seedSrc).toContain("HS_ALGEBRA_DEMO_MARKER");
    expect(seedSrc).toContain("buildAlgebraRegion");
    expect(seedSrc).toContain("parseSaasTechDemoSeedTarget");
    expect(seedSrc).toMatch(/buildAlgebraRegion|createSyntheticKnowledgeRegionFromProfile/);
  });
});
