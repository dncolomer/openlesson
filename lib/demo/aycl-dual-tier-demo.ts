/**
 * Staging dual-tier AYCL demo fixtures: learner-only + full/creator access.
 * Pure markers, tokens, and expectations for seed/verify scripts + unit tests.
 */

import {
  ayclPurchaseEligibleForUpgrade,
  type AyclPurchase,
} from "@/lib/aycl";
import {
  normalizeAyclAccessTier,
  resolveAyclCapabilities,
  type AyclAccessTier,
} from "@/lib/aycl-shared";
import { hashPrivateToken } from "@/lib/private-token";

/** Present in catalog workspace notes for idempotent find/replace. */
export const AYCL_DUAL_TIER_DEMO_MARKER = "AYCL_DUAL_TIER_DEMO_V1";

export const AYCL_DUAL_TIER_CATALOG_LEARNER = `${AYCL_DUAL_TIER_DEMO_MARKER}:catalog:learner-source`;
export const AYCL_DUAL_TIER_CATALOG_FULL = `${AYCL_DUAL_TIER_DEMO_MARKER}:catalog:full-source`;
export const AYCL_DUAL_TIER_FORK_LEARNER = `${AYCL_DUAL_TIER_DEMO_MARKER}:fork:learner`;
export const AYCL_DUAL_TIER_FORK_FULL = `${AYCL_DUAL_TIER_DEMO_MARKER}:fork:full`;
export const AYCL_DUAL_TIER_PURCHASE_LEARNER = `${AYCL_DUAL_TIER_DEMO_MARKER}:purchase:learner`;
export const AYCL_DUAL_TIER_PURCHASE_FULL = `${AYCL_DUAL_TIER_DEMO_MARKER}:purchase:full`;

/**
 * Fixed access tokens so re-seeds stay openable (hash is deterministic).
 * Staging-only demo secrets — not used in production.
 */
export const AYCL_DEMO_LEARNER_ACCESS_TOKEN =
  "aycl_demo_learner_tier_staging_v1_fixed_token";
export const AYCL_DEMO_FULL_ACCESS_TOKEN =
  "aycl_demo_full_tier_staging_v1_fixed_token";

export type AyclDualTierDemoKind = "learner" | "full";

export type AyclDualTierDemoFixture = {
  kind: AyclDualTierDemoKind;
  accessTier: AyclAccessTier;
  catalogMarker: string;
  forkMarker: string;
  purchaseMarker: string;
  accessToken: string;
  accessTokenHash: string;
  catalogTitle: string;
  catalogDescription: string;
  catalogGoal: string;
  purchaserEmail: string;
  /** Synthetic Stripe session id (unique, no real payment). */
  stripeCheckoutSessionId: string;
};

export function ayclDemoAccessTokenHash(token: string): string {
  return hashPrivateToken(token);
}

export function buildAyclDualTierDemoFixtures(): {
  learner: AyclDualTierDemoFixture;
  full: AyclDualTierDemoFixture;
} {
  return {
    learner: {
      kind: "learner",
      accessTier: "learner",
      catalogMarker: AYCL_DUAL_TIER_CATALOG_LEARNER,
      forkMarker: AYCL_DUAL_TIER_FORK_LEARNER,
      purchaseMarker: AYCL_DUAL_TIER_PURCHASE_LEARNER,
      accessToken: AYCL_DEMO_LEARNER_ACCESS_TOKEN,
      accessTokenHash: ayclDemoAccessTokenHash(AYCL_DEMO_LEARNER_ACCESS_TOKEN),
      catalogTitle: "[Demo] AYCL Learner tier — PPV clinic",
      catalogDescription:
        "Staging demo catalog for practice-only (learner) access. Compute PPV from sensitivity, specificity, and prevalence.",
      catalogGoal: "Update clinical beliefs from test evidence correctly",
      purchaserEmail: "aycl-demo-learner@uncertain.systems.invalid",
      stripeCheckoutSessionId: "cs_test_aycl_demo_learner_v1",
    },
    full: {
      kind: "full",
      accessTier: "full",
      catalogMarker: AYCL_DUAL_TIER_CATALOG_FULL,
      forkMarker: AYCL_DUAL_TIER_FORK_FULL,
      purchaseMarker: AYCL_DUAL_TIER_PURCHASE_FULL,
      accessToken: AYCL_DEMO_FULL_ACCESS_TOKEN,
      accessTokenHash: ayclDemoAccessTokenHash(AYCL_DEMO_FULL_ACCESS_TOKEN),
      catalogTitle: "[Demo] AYCL Full tier — PPV clinic creator",
      catalogDescription:
        "Staging demo catalog for full (creator) access with growth tools. Same domain as learner demo for side-by-side mode testing.",
      catalogGoal: "Update clinical beliefs from test evidence correctly",
      purchaserEmail: "aycl-demo-full@uncertain.systems.invalid",
      stripeCheckoutSessionId: "cs_test_aycl_demo_full_v1",
    },
  };
}

export function ayclDemoLearnPath(accessToken: string): string {
  return `/learn/${encodeURIComponent(accessToken)}`;
}

export function ayclDemoLearnUrl(baseUrl: string, accessToken: string): string {
  const base = String(baseUrl || "").replace(/\/$/, "") || "http://localhost:3000";
  return `${base}${ayclDemoLearnPath(accessToken)}`;
}

/** Blocks inserted into each demo catalog (and copied into forks). */
export const AYCL_DEMO_BLOCKS = [
  {
    title: "Positive predictive value",
    description:
      "Compute PPV from sensitivity, specificity, and prevalence for a diagnostic test.",
    is_start: true,
    position_x: 0,
    position_y: 0,
  },
  {
    title: "Base rates dominate",
    description:
      "How low prevalence swamps even a sensitive test — work one numerical example.",
    is_start: false,
    position_x: 1,
    position_y: 0,
  },
  {
    title: "Misapplied Bayes",
    description:
      "Catch a common false-positive fallacy with concrete rates.",
    is_start: false,
    position_x: 2,
    position_y: 0,
  },
] as const;

/**
 * Expected product capabilities for each demo kind (ships from resolveAyclCapabilities).
 */
export function expectedAyclDemoCapabilities(kind: AyclDualTierDemoKind) {
  const caps = resolveAyclCapabilities(kind === "learner" ? "learner" : "full");
  return {
    tier: caps.tier,
    canAuthor: caps.canAuthor,
    canGrow: caps.canGrow,
    canUpgrade: caps.canUpgrade,
    allowCreatorModeToggle: caps.allowCreatorModeToggle,
  };
}

/**
 * Purchase shape after seed — drives upgrade eligibility checks.
 */
export function ayclDemoPurchaseEligibilityShape(input: {
  status: AyclPurchase["status"];
  access_tier: string;
  forked_workspace_id: string | null;
}): {
  eligibleForUpgrade: boolean;
  tier: ReturnType<typeof normalizeAyclAccessTier>;
  capabilities: ReturnType<typeof resolveAyclCapabilities>;
} {
  const tier = normalizeAyclAccessTier(input.access_tier);
  return {
    eligibleForUpgrade: ayclPurchaseEligibleForUpgrade({
      status: input.status,
      access_tier: input.access_tier,
      forked_workspace_id: input.forked_workspace_id,
    }),
    tier,
    capabilities: resolveAyclCapabilities(tier),
  };
}

export function assertAyclDualTierDemoExpectations(input: {
  learner: {
    status: string;
    access_tier: string;
    forked_workspace_id: string | null;
    source_is_aycl: boolean;
  };
  full: {
    status: string;
    access_tier: string;
    forked_workspace_id: string | null;
    source_is_aycl: boolean;
  };
}): { ok: true } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  if (input.learner.status !== "completed") {
    errors.push("learner purchase status must be completed");
  }
  if (input.full.status !== "completed") {
    errors.push("full purchase status must be completed");
  }
  if (!input.learner.forked_workspace_id) {
    errors.push("learner fork missing");
  }
  if (!input.full.forked_workspace_id) {
    errors.push("full fork missing");
  }
  if (!input.learner.source_is_aycl || !input.full.source_is_aycl) {
    errors.push("catalog sources must be is_all_you_can_learn");
  }
  const learnerElig = ayclDemoPurchaseEligibilityShape({
    status: input.learner.status as AyclPurchase["status"],
    access_tier: input.learner.access_tier,
    forked_workspace_id: input.learner.forked_workspace_id,
  });
  const fullElig = ayclDemoPurchaseEligibilityShape({
    status: input.full.status as AyclPurchase["status"],
    access_tier: input.full.access_tier,
    forked_workspace_id: input.full.forked_workspace_id,
  });
  if (!learnerElig.eligibleForUpgrade) {
    errors.push("learner must be upgrade-eligible");
  }
  if (fullElig.eligibleForUpgrade) {
    errors.push("full must NOT be upgrade-eligible");
  }
  if (learnerElig.capabilities.canAuthor) {
    errors.push("learner must not canAuthor");
  }
  if (!fullElig.capabilities.canAuthor) {
    errors.push("full must canAuthor");
  }
  if (errors.length) return { ok: false, errors };
  return { ok: true };
}
