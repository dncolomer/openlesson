/**
 * Unit tests for pure SaaS tech-team demo workspace helpers.
 * Exercises shipped knowledge-config / custom-verification APIs — no hardcoded vectors.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  KNOWLEDGE_CONFIG_DIM,
  KNOWLEDGE_CONFIG_EMBEDDING_MODEL_ID,
  isKnowledgeConfigVector,
  scoreAgainstCustomVerificationModel,
} from "@/lib/knowledge-config";
import {
  DEMO_BLOCKS,
  DEMO_COHORT_REGION,
  DEMO_OWNER_SUBJECT,
  DEMO_ROLE_REGION_COSINE_THRESHOLD,
  DEMO_ROLE_REGIONS,
  DEMO_SUBJECTS,
  SAAS_TECH_DEMO_MARKER,
  SAAS_TECH_DEMO_WORKSPACE,
  assertMixedRoleMembership,
  buildAllRoleRegions,
  buildCohortRegionFromSubjects,
  buildDemoCohortRegion,
  buildRoleRegion,
  demoGuestEmail,
  encodeAllDemoSubjects,
  encodeAllDemoSubjectsIncludingOwner,
  encodeDemoOwnerSubject,
  encodeDemoSubject,
  evaluateDemoMembershipGeometry,
  roleRegionByKey,
  scoreSubjectsAgainstRoleRegions,
} from "@/lib/demo/saas-tech-team-demo-workspace";
import { parseSaasTechDemoSeedTarget } from "../../scripts/saas-tech-demo-target";

describe("saas tech-team demo workspace (pure helpers)", () => {
  it("workspace copy is authentic multi-role SaaS use case with stable demo marker", () => {
    expect(SAAS_TECH_DEMO_WORKSPACE.title).toMatch(/Helios/i);
    expect(SAAS_TECH_DEMO_WORKSPACE.description.length).toBeGreaterThan(80);
    expect(SAAS_TECH_DEMO_WORKSPACE.description).toMatch(/Backend|Frontend|SRE/i);
    expect(SAAS_TECH_DEMO_WORKSPACE.notes).toContain(SAAS_TECH_DEMO_MARKER);
    expect(DEMO_BLOCKS.length).toBeGreaterThanOrEqual(4);
    expect(DEMO_BLOCKS.some((b) => b.is_start)).toBe(true);
    expect(DEMO_ROLE_REGIONS.length).toBeGreaterThanOrEqual(3);
    expect(DEMO_SUBJECTS.length).toBeGreaterThanOrEqual(6);
    // At least one subject deliberately off-role / null expected region
    expect(DEMO_SUBJECTS.some((s) => s.expectedInRegion === null)).toBe(true);
    expect(DEMO_SUBJECTS.some((s) => s.expectedInRegion === "backend")).toBe(true);
  });

  it("encodeDemoSubject uses real encodeKnowledgeConfig path (knowledgecfg-v1-d64)", () => {
    const encoded = encodeDemoSubject(DEMO_SUBJECTS[0], { workspaceId: "unit-ws" });
    expect(encoded.embedding.embedding_model_id).toBe(KNOWLEDGE_CONFIG_EMBEDDING_MODEL_ID);
    expect(encoded.embedding.dim).toBe(KNOWLEDGE_CONFIG_DIM);
    expect(isKnowledgeConfigVector(encoded.vector, KNOWLEDGE_CONFIG_DIM)).toBe(true);
    expect(encoded.embedding.pow_event_count).toBe(DEMO_SUBJECTS[0].powEvents.length);
    expect(encoded.powRows.length).toBe(DEMO_SUBJECTS[0].powEvents.length);
    // PoW metadata carries demo marker for auditability
    expect(encoded.powRows[0].metadata).toMatchObject({
      demo_marker: SAAS_TECH_DEMO_MARKER,
      subject_key: DEMO_SUBJECTS[0].key,
    });
    const norm = Math.sqrt(encoded.vector.reduce((s, x) => s + x * x, 0));
    expect(norm).toBeGreaterThan(0.99);
    expect(norm).toBeLessThan(1.01);
  });

  it("distinct subjects produce non-identical embeddings (no hardcoded vectors)", () => {
    const a = encodeDemoSubject(DEMO_SUBJECTS.find((s) => s.key === "maya_backend")!);
    const b = encodeDemoSubject(DEMO_SUBJECTS.find((s) => s.key === "casey_offrole")!);
    const cos = a.vector.reduce((s, v, i) => s + v * b.vector[i], 0);
    expect(cos).toBeLessThan(0.999);
    expect(cos).toBeGreaterThan(-1);
  });

  it("buildRoleRegion yields synthetic-tagged role region in knowledgecfg space", () => {
    const backend = roleRegionByKey("backend");
    const region = buildRoleRegion(backend, "unit-ws");
    expect(region.name).toBe("Backend Engineering");
    expect(region.embedding_model_id).toBe(KNOWLEDGE_CONFIG_EMBEDDING_MODEL_ID);
    expect(region.dim).toBe(KNOWLEDGE_CONFIG_DIM);
    expect(isKnowledgeConfigVector(region.centroid, KNOWLEDGE_CONFIG_DIM)).toBe(true);
    expect(region.cosine_threshold).toBe(DEMO_ROLE_REGION_COSINE_THRESHOLD);
    expect(region.subjects.some((s) => s.label === "synthetic:grok-4.5")).toBe(true);
    // Centroid self-scores in-region
    const self = scoreAgainstCustomVerificationModel(region.centroid, region);
    expect(self.in_region).toBe(true);
  });

  it("buildAllRoleRegions covers ≥3 SaaS role regions with distinct names", () => {
    const regions = buildAllRoleRegions("unit-ws");
    expect(regions.length).toBeGreaterThanOrEqual(3);
    const names = new Set(regions.map((r) => r.name));
    expect(names.size).toBe(regions.length);
    expect([...names].join(" ")).toMatch(/Backend/i);
    expect([...names].join(" ")).toMatch(/Frontend/i);
  });

  it("buildDemoCohortRegion is user-PoW style (subject refs, no synthetic tag)", () => {
    const encoded = encodeAllDemoSubjects("unit-ws");
    const cohort = buildDemoCohortRegion(encoded, (key) => {
      const s = encoded.find((e) => e.subject.key === key)!.subject;
      return {
        label: s.displayName,
        guest_user_id: `guest-${key}`,
        user_id: null,
      };
    });

    expect(cohort.name).toBe(DEMO_COHORT_REGION.name);
    expect(cohort.embedding_model_id).toBe(KNOWLEDGE_CONFIG_EMBEDDING_MODEL_ID);
    expect(cohort.subject_count).toBe(DEMO_COHORT_REGION.subjectKeys.length);
    expect(cohort.subjects.length).toBe(DEMO_COHORT_REGION.subjectKeys.length);
    // Subject refs point at demo subjects (not synthetic)
    for (const ref of cohort.subjects) {
      expect(ref.label).toBeTruthy();
      expect(String(ref.label)).not.toMatch(/synthetic:grok-4\.5/i);
      expect(ref.guest_user_id || ref.user_id).toBeTruthy();
    }
    expect(DEMO_COHORT_REGION.description).not.toMatch(/\[synthetic:grok-4\.5\]/i);
    expect(DEMO_COHORT_REGION.description).toMatch(/proof-of-work|PoW|engineers/i);

    // Cohort centroid in-region for members
    for (const key of DEMO_COHORT_REGION.subjectKeys) {
      const member = encoded.find((e) => e.subject.key === key)!;
      const score = scoreAgainstCustomVerificationModel(member.vector, cohort);
      expect(score.in_region).toBe(true);
    }
  });

  it("buildCohortRegionFromSubjects rejects empty cohort", () => {
    expect(() =>
      buildCohortRegionFromSubjects({
        name: "empty",
        description: "x",
        encodedSubjects: [],
        subjectRefs: [],
      }),
    ).toThrow(/at least one subject/i);
  });

  it("membership scoring finds ≥1 in-region and ≥1 out-of-region subject for role regions", () => {
    const encoded = encodeAllDemoSubjects("unit-ws");
    const roleRegions = DEMO_ROLE_REGIONS.map((role) => ({
      roleKey: role.key,
      model: buildRoleRegion(role, "unit-ws"),
    }));
    const rows = scoreSubjectsAgainstRoleRegions(encoded, roleRegions);
    expect(rows.length).toBe(encoded.length * roleRegions.length);

    const { inRegion, outOfRegion } = assertMixedRoleMembership(rows);
    expect(inRegion.length).toBeGreaterThanOrEqual(1);
    expect(outOfRegion.length).toBeGreaterThanOrEqual(1);

    // Casey (off-role) should be out of at least one role region
    const caseyOut = outOfRegion.filter((r) => r.subjectKey === "casey_offrole");
    expect(caseyOut.length).toBeGreaterThanOrEqual(1);

    // Maya (backend) should be in Backend region
    const mayaBackend = rows.find(
      (r) => r.subjectKey === "maya_backend" && r.roleKey === "backend",
    );
    expect(mayaBackend).toBeDefined();
    expect(mayaBackend!.score.in_region).toBe(true);
  });

  it("evaluateDemoMembershipGeometry packages a coherent demo snapshot", () => {
    const geo = evaluateDemoMembershipGeometry("unit-ws");
    expect(geo.encoded.length).toBe(DEMO_SUBJECTS.length);
    expect(geo.roleRegions.length).toBe(DEMO_ROLE_REGIONS.length);
    expect(geo.cohort.name).toBe(DEMO_COHORT_REGION.name);
    expect(geo.mixed.inRegion.length).toBeGreaterThanOrEqual(1);
    expect(geo.mixed.outOfRegion.length).toBeGreaterThanOrEqual(1);
    expect(demoGuestEmail("maya.chen+helios-demo")).toBe(
      "maya.chen+helios-demo@demo.uncertain.systems",
    );
  });

  it("encodeDemoOwnerSubject stamps owner_user kind and uses real encoder", () => {
    expect(DEMO_OWNER_SUBJECT.isOwnerUser).toBe(true);
    expect(DEMO_OWNER_SUBJECT.key).toBe("owner_user");
    expect(DEMO_OWNER_SUBJECT.powEvents.length).toBeGreaterThanOrEqual(4);
    expect(DEMO_OWNER_SUBJECT.roleHint).toMatch(/backend|frontend|sre|fullstack/);

    const owner = encodeDemoOwnerSubject("unit-ws");
    expect(owner.subject.isOwnerUser).toBe(true);
    expect(owner.embedding.embedding_model_id).toBe(KNOWLEDGE_CONFIG_EMBEDDING_MODEL_ID);
    expect(isKnowledgeConfigVector(owner.vector, KNOWLEDGE_CONFIG_DIM)).toBe(true);
    expect(owner.embedding.pow_event_count).toBe(DEMO_OWNER_SUBJECT.powEvents.length);
    expect(owner.powRows[0].metadata).toMatchObject({
      demo_marker: SAAS_TECH_DEMO_MARKER,
      subject_key: "owner_user",
      subject_kind: "owner_user",
      is_owner_user: true,
    });

    // Distinct from a guest encoding (not hardcoded equality)
    const guest = encodeDemoSubject(DEMO_SUBJECTS[0], { workspaceId: "unit-ws" });
    const cos = owner.vector.reduce((s, v, i) => s + v * guest.vector[i], 0);
    expect(cos).toBeLessThan(0.999);

    const all = encodeAllDemoSubjectsIncludingOwner("unit-ws");
    expect(all.length).toBe(DEMO_SUBJECTS.length + 1);
    expect(all.some((e) => e.subject.isOwnerUser)).toBe(true);
    expect(all.filter((e) => !e.subject.isOwnerUser)).toHaveLength(DEMO_SUBJECTS.length);
  });
});

describe("saas tech-team demo seed target selection", () => {
  it("defaults to staging; requires explicit --target=prod for production", () => {
    expect(parseSaasTechDemoSeedTarget(["node", "script.ts"])).toBe("staging");
    expect(parseSaasTechDemoSeedTarget(["node", "script.ts", "--target=staging"])).toBe(
      "staging",
    );
    expect(parseSaasTechDemoSeedTarget(["node", "script.ts", "--target=prod"])).toBe("prod");
    expect(parseSaasTechDemoSeedTarget(["node", "script.ts", "--target=production"])).toBe(
      "prod",
    );
    expect(() =>
      parseSaasTechDemoSeedTarget(["node", "script.ts", "--target=preview"]),
    ).toThrow(/Refusing target/);
  });

  it("seed and verify scripts wire parse + connectTarget for staging and prod", () => {
    const root = join(__dirname, "../..");
    const seed = readFileSync(
      join(root, "scripts/seed-saas-tech-team-demo-workspace.ts"),
      "utf8",
    );
    const verify = readFileSync(
      join(root, "scripts/verify-saas-tech-team-demo-workspace.ts"),
      "utf8",
    );
    const targetHelper = readFileSync(
      join(root, "scripts/saas-tech-demo-target.ts"),
      "utf8",
    );
    expect(targetHelper).toContain("parseSaasTechDemoSeedTarget");
    expect(seed).toContain("parseSaasTechDemoSeedTarget");
    expect(seed).toContain('connectTarget(target)');
    expect(seed).toContain("--target=prod");
    expect(seed).toMatch(/default target is staging/i);
    expect(verify).toContain("parseSaasTechDemoSeedTarget");
    expect(verify).toContain("connectTarget(target)");
    expect(verify).toContain("--target=prod");
    // No longer hard-locked to staging-only
    expect(seed).not.toContain('const ALLOWED_TARGET = "staging"');
    expect(verify).not.toContain('connectTarget("staging")');
  });
});
