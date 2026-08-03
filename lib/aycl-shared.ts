/** Client-safe All-You-Can-Learn helpers (no server imports). */

/** @deprecated Prefer tier-specific prices; kept as alias of full pack. */
export const AYCL_PRICE_CENTS = 1999;

/** @deprecated Prefer AYCL_FULL_PRICE_LABEL. */
export const AYCL_PRICE_LABEL = "$19.99";

/** Practice-only access (fixed forked scope, no creation tools). */
export const AYCL_LEARNER_PRICE_CENTS = 999;
export const AYCL_LEARNER_PRICE_LABEL = "$9.99";

/** Full pack: practice + create / grow the forked workspace. */
export const AYCL_FULL_PRICE_CENTS = 1999;
export const AYCL_FULL_PRICE_LABEL = "$19.99";

/** One-time upgrade from practice-only → full pack (price difference). */
export const AYCL_UPGRADE_PRICE_CENTS =
  AYCL_FULL_PRICE_CENTS - AYCL_LEARNER_PRICE_CENTS;
export const AYCL_UPGRADE_PRICE_LABEL = `$${(AYCL_UPGRADE_PRICE_CENTS / 100).toFixed(2)}`;

export const AYCL_TOKEN_STORAGE_KEY = "aycl_pending_access_token";

/** Purchase access level. Legacy null/empty → full. */
export type AyclAccessTier = "learner" | "full";

export type AyclCapabilities = {
  tier: AyclAccessTier;
  /** Creator/authoring tools (map tools, DAGs tab, expand, etc.). */
  canAuthor: boolean;
  /** Grow map via multi-create / bridge / generate (same as canAuthor for v1). */
  canGrow: boolean;
  /** May open paid upgrade checkout to full pack. */
  canUpgrade: boolean;
  /** Interaction mode: learner-tier forces practice; full may toggle. */
  defaultInteractionMode: "learner" | "creator";
  allowCreatorModeToggle: boolean;
};

export function isAyclAccessTier(value: unknown): value is AyclAccessTier {
  return value === "learner" || value === "full";
}

/**
 * Normalize stored / metadata tier. Missing → full (do not downgrade legacy buys).
 */
export function normalizeAyclAccessTier(value: unknown): AyclAccessTier {
  if (value === "learner" || value === "practice") return "learner";
  if (value === "full" || value === "creator" || value === "complete") return "full";
  return "full";
}

export function ayclPriceCentsForTier(tier: AyclAccessTier): number {
  return tier === "learner" ? AYCL_LEARNER_PRICE_CENTS : AYCL_FULL_PRICE_CENTS;
}

export function ayclPriceLabelForTier(tier: AyclAccessTier): string {
  return tier === "learner" ? AYCL_LEARNER_PRICE_LABEL : AYCL_FULL_PRICE_LABEL;
}

/** Short offer labels — never "rent" / "buy" movie metaphors. */
export function ayclOfferLabel(tier: AyclAccessTier): string {
  return tier === "learner" ? "Practice access" : "Full access";
}

export function ayclOfferDescription(tier: AyclAccessTier): string {
  return tier === "learner"
    ? "Your private copy for practice. Fixed content — explore and train at your pace."
    : "Practice plus creation tools so you can grow and reshape your private copy.";
}

export function ayclUpgradeOfferLabel(): string {
  return "Unlock creation tools";
}

export function ayclUpgradeOfferDescription(): string {
  return "Add creation tools on this same private copy so you can expand the map.";
}

/**
 * Capability bag for shell + API. Learner = fixed practice scope.
 * Full = author/grow. Legacy purchases without tier resolve as full.
 */
export function resolveAyclCapabilities(
  tierInput: unknown,
): AyclCapabilities {
  const tier = normalizeAyclAccessTier(tierInput);
  if (tier === "learner") {
    return {
      tier: "learner",
      canAuthor: false,
      canGrow: false,
      canUpgrade: true,
      defaultInteractionMode: "learner",
      allowCreatorModeToggle: false,
    };
  }
  return {
    tier: "full",
    canAuthor: true,
    canGrow: true,
    canUpgrade: false,
    defaultInteractionMode: "creator",
    allowCreatorModeToggle: true,
  };
}

export function ayclCanUpgradeFromTier(tierInput: unknown): boolean {
  return normalizeAyclAccessTier(tierInput) === "learner";
}

/** After successful upgrade payment, target tier is always full. */
export function ayclTierAfterUpgrade(): AyclAccessTier {
  return "full";
}

export function buildAyclAccessUrl(baseUrl: string, accessToken: string): string {
  return `${baseUrl.replace(/\/$/, "")}/learn/${accessToken}`;
}
