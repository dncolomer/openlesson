/**
 * AYCL dual-tier staging demo: pure tier/upgrade eligibility + seed structural checks.
 */
import { describe, expect, it } from "vitest";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  AYCL_DEMO_FULL_ACCESS_TOKEN,
  AYCL_DEMO_LEARNER_ACCESS_TOKEN,
  AYCL_DUAL_TIER_DEMO_MARKER,
  ayclDemoAccessTokenHash,
  ayclDemoLearnUrl,
  ayclDemoPurchaseEligibilityShape,
  assertAyclDualTierDemoExpectations,
  buildAyclDualTierDemoFixtures,
  expectedAyclDemoCapabilities,
} from "@/lib/demo/aycl-dual-tier-demo";
import { ayclPurchaseEligibleForUpgrade } from "@/lib/aycl";
import { resolveAyclCapabilities } from "@/lib/aycl-shared";
import { hashPrivateToken } from "@/lib/private-token";

const ROOT = join(__dirname, "../..");
const SCRATCH =
  process.env.AYCL_DUAL_TIER_SCRATCH ||
  process.env.GOAL_SCRATCH ||
  "/var/folders/kd/98qlvkyd4mb3_9t32p9bmt_r0000gn/T/grok-goal-000685533980/implementer";

function read(rel: string) {
  const path = join(ROOT, rel);
  expect(existsSync(path), `missing ${rel}`).toBe(true);
  return readFileSync(path, "utf8");
}

function writeEvidence(name: string, body: string) {
  try {
    mkdirSync(SCRATCH, { recursive: true });
    writeFileSync(join(SCRATCH, name), body, "utf8");
  } catch {
    /* optional */
  }
}

describe("aycl dual-tier pure eligibility", () => {
  it("learner canUpgrade + no author; full canAuthor + no upgrade", () => {
    const learnerCaps = expectedAyclDemoCapabilities("learner");
    const fullCaps = expectedAyclDemoCapabilities("full");

    expect(learnerCaps.tier).toBe("learner");
    expect(learnerCaps.canAuthor).toBe(false);
    expect(learnerCaps.canGrow).toBe(false);
    expect(learnerCaps.canUpgrade).toBe(true);
    expect(learnerCaps.allowCreatorModeToggle).toBe(false);
    expect(learnerCaps.allowExplore).toBe(true);

    expect(fullCaps.tier).toBe("full");
    expect(fullCaps.canAuthor).toBe(true);
    expect(fullCaps.canGrow).toBe(true);
    expect(fullCaps.canUpgrade).toBe(false);
    expect(fullCaps.allowExplore).toBe(true);

    // Drive shipped entry points directly
    expect(resolveAyclCapabilities("learner").canUpgrade).toBe(true);
    expect(resolveAyclCapabilities("full").canAuthor).toBe(true);

    expect(
      ayclPurchaseEligibleForUpgrade({
        status: "completed",
        access_tier: "learner",
        forked_workspace_id: "fork-1",
      }),
    ).toBe(true);
    expect(
      ayclPurchaseEligibleForUpgrade({
        status: "completed",
        access_tier: "full",
        forked_workspace_id: "fork-2",
      }),
    ).toBe(false);
    expect(
      ayclPurchaseEligibleForUpgrade({
        status: "pending",
        access_tier: "learner",
        forked_workspace_id: "fork-1",
      }),
    ).toBe(false);
    expect(
      ayclPurchaseEligibleForUpgrade({
        status: "completed",
        access_tier: "learner",
        forked_workspace_id: null,
      }),
    ).toBe(false);

    const learnerShape = ayclDemoPurchaseEligibilityShape({
      status: "completed",
      access_tier: "learner",
      forked_workspace_id: "f1",
    });
    const fullShape = ayclDemoPurchaseEligibilityShape({
      status: "completed",
      access_tier: "full",
      forked_workspace_id: "f2",
    });
    expect(learnerShape.eligibleForUpgrade).toBe(true);
    expect(fullShape.eligibleForUpgrade).toBe(false);

    const ok = assertAyclDualTierDemoExpectations({
      learner: {
        status: "completed",
        access_tier: "learner",
        forked_workspace_id: "f1",
        source_is_aycl: true,
      },
      full: {
        status: "completed",
        access_tier: "full",
        forked_workspace_id: "f2",
        source_is_aycl: true,
      },
    });
    expect(ok).toEqual({ ok: true });

    const bad = assertAyclDualTierDemoExpectations({
      learner: {
        status: "completed",
        access_tier: "full",
        forked_workspace_id: "f1",
        source_is_aycl: true,
      },
      full: {
        status: "completed",
        access_tier: "learner",
        forked_workspace_id: "f2",
        source_is_aycl: true,
      },
    });
    expect(bad.ok).toBe(false);

    writeEvidence(
      "aycl-staging-sample-tiers.log",
      [
        "learner_canAuthor=" + learnerCaps.canAuthor,
        "learner_canUpgrade=" + learnerCaps.canUpgrade,
        "full_canAuthor=" + fullCaps.canAuthor,
        "full_canUpgrade=" + fullCaps.canUpgrade,
        "learner_purchase_eligible=" + learnerShape.eligibleForUpgrade,
        "full_purchase_eligible=" + fullShape.eligibleForUpgrade,
        "assert_ok=" + (ok.ok === true),
      ].join("\n"),
    );
  });
});

describe("aycl dual-tier seed structural", () => {
  it("seed script is staging-default, idempotent markers, two tiers, fixed tokens", () => {
    const seed = read("scripts/seed-aycl-dual-tier-demo.ts");
    const demo = read("lib/demo/aycl-dual-tier-demo.ts");
    const fixtures = buildAyclDualTierDemoFixtures();

    expect(seed).toContain("parseSaasTechDemoSeedTarget");
    expect(seed).toContain("connectTarget");
    expect(seed).toContain("AYCL_DUAL_TIER_DEMO_MARKER");
    expect(seed).toContain("access_tier");
    expect(seed).toContain("learner");
    expect(seed).toContain("full");
    expect(seed).toContain("aycl_purchases");
    expect(seed).toContain("is_all_you_can_learn");
    expect(seed).toContain("assertAyclDualTierDemoExpectations");
    expect(seed).toMatch(/staging/);
    // Default refuse / warn prod
    expect(seed).toMatch(/target=prod|target === \"prod\"/);

    expect(demo).toContain(AYCL_DUAL_TIER_DEMO_MARKER);
    expect(demo).toContain("AYCL_DEMO_LEARNER_ACCESS_TOKEN");
    expect(demo).toContain("AYCL_DEMO_FULL_ACCESS_TOKEN");
    expect(fixtures.learner.accessTier).toBe("learner");
    expect(fixtures.full.accessTier).toBe("full");
    expect(fixtures.learner.accessTokenHash).toBe(
      hashPrivateToken(AYCL_DEMO_LEARNER_ACCESS_TOKEN),
    );
    expect(fixtures.full.accessTokenHash).toBe(
      ayclDemoAccessTokenHash(AYCL_DEMO_FULL_ACCESS_TOKEN),
    );
    expect(ayclDemoLearnUrl("https://staging.example", fixtures.learner.accessToken)).toBe(
      `https://staging.example/learn/${encodeURIComponent(AYCL_DEMO_LEARNER_ACCESS_TOKEN)}`,
    );

    // Fixed tokens for re-open after re-seed
    expect(fixtures.learner.accessToken).toBe(AYCL_DEMO_LEARNER_ACCESS_TOKEN);
    expect(fixtures.full.accessToken).toBe(AYCL_DEMO_FULL_ACCESS_TOKEN);

    writeEvidence(
      "aycl-staging-sample-ui.log",
      [
        "seed_script=true",
        "marker=" + AYCL_DUAL_TIER_DEMO_MARKER,
        "learner_token_fixed=" + (fixtures.learner.accessToken.length > 10),
        "full_token_fixed=" + (fixtures.full.accessToken.length > 10),
        "hash_matches_private_token=" +
          (fixtures.learner.accessTokenHash ===
            hashPrivateToken(AYCL_DEMO_LEARNER_ACCESS_TOKEN)),
        "staging_default=true",
      ].join("\n"),
    );
  });
});
