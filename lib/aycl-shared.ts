/** Client-safe All-You-Can-Learn helpers (no server imports). */

/** @deprecated Prefer tier-specific prices; kept as alias of full pack. */
export const AYCL_PRICE_CENTS = 1999;

/** @deprecated Prefer AYCL_FULL_PRICE_LABEL. */
export const AYCL_PRICE_LABEL = "$19.99";

/** Retired shopper SKU. Kept so listing rows and old checkouts still resolve. */
export const AYCL_LEARNER_PRICE_CENTS = 999;
export const AYCL_LEARNER_PRICE_LABEL = "$9.99";

/** One AYCL workspace offer: private copy with practice and authoring together. */
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
  /** Authoring tools on the forked workspace. Always on — one AYCL mode. */
  canAuthor: boolean;
  /** Grow map via multi-create / bridge / generate. Always on. */
  canGrow: boolean;
  /** Retired dual-SKU upgrade. Always false. */
  canUpgrade: boolean;
  defaultInteractionMode: "learner" | "creator";
  allowCreatorModeToggle: boolean;
  /** Map explore (empty-cell search). Always on for purchased clones. */
  allowExplore: boolean;
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

/**
 * Format USD cents for shopper-facing labels. Prefer listing-aware
 * `resolveAyclCheckoutCents` + format from aycl-marketplace for catalog/checkout.
 */
export function formatAyclPriceCentsLabel(cents: number): string {
  const n = Number.isFinite(cents) ? Math.round(cents) : 0;
  const dollars = n / 100;
  return dollars % 1 === 0
    ? `$${dollars.toFixed(0)}`
    : `$${dollars.toFixed(2)}`;
}

/** One shopper name — never Play vs Build, never rent/buy movie metaphors. */
export function ayclOfferLabel(_tier?: AyclAccessTier): string {
  return "All You Can Learn";
}

/** @deprecated Same as ayclOfferTooltip. Play is not a separate mode. */
export function ayclPlayTooltip(): string {
  return ayclOfferTooltip();
}

/** @deprecated Same as ayclOfferTooltip. Build is not a separate mode. */
export function ayclBuildTooltip(): string {
  return ayclOfferTooltip();
}

/** Tooltip attached to the offer title / checkout CTA. */
export function ayclOfferTooltip(_tier?: AyclAccessTier): string {
  return "Your private copy of this workspace. Practice on the map and grow it from here.";
}

/** Checkout button label. */
export function ayclOfferCheckoutCta(_tier?: AyclAccessTier): string {
  return "Get this workspace";
}

export function ayclOfferDescription(_tier?: AyclAccessTier): string {
  return "Your private copy of this workspace. Practice on the map and grow it from here.";
}

export function ayclUpgradeOfferLabel(): string {
  return "All You Can Learn";
}

export function ayclUpgradeOfferDescription(): string {
  return "Your private copy of this workspace. Practice on the map and grow it from here.";
}

/**
 * Core purchase-value claim: one-time AYCL includes lifetime system updates
 * and platform improvements (not only private-fork access).
 * Shared by catalog listing + per-workspace landing for consistency.
 */
export function ayclLifetimeSystemUpdatesClaim(): string {
  return "Includes lifetime system updates and platform improvements — your private copy keeps benefiting as the product evolves.";
}

/** Short line for CTA footnotes / card footers. */
export function ayclLifetimeSystemUpdatesFootnote(): string {
  return "One-time · Private fork · Lifetime system updates & platform improvements";
}

/** Hero / summary supporting line (listing + landing). */
export function ayclLifetimeSystemUpdatesHeroLine(): string {
  return "Pay once: keep lifetime access, and keep getting system updates and platform improvements as we ship them.";
}

/**
 * Compact catalog header key points (listing only).
 * Short bullets for a boxed treatment — not multi-paragraph prose.
 */
export function ayclCatalogKeyPoints(): readonly string[] {
  return [
    "Learn for curiosity — not a credential, cohort, or deadline",
    "Dive deep anytime; come back months later",
    "One workspace: map, practice, and the tools to grow it",
    "One-time pay · private fork · lifetime system updates & platform improvements",
  ] as const;
}

/**
 * One AYCL workspace mode. Stored tier is kept for old rows; authoring,
 * grow, and explore are always on. Dual-SKU upgrade is retired.
 */
export function resolveAyclCapabilities(
  tierInput: unknown,
): AyclCapabilities {
  const tier = normalizeAyclAccessTier(tierInput);
  return {
    tier,
    canAuthor: true,
    canGrow: true,
    canUpgrade: false,
    defaultInteractionMode: "learner",
    allowCreatorModeToggle: true,
    allowExplore: true,
  };
}

export function ayclCanUpgradeFromTier(_tierInput?: unknown): boolean {
  return false;
}

/** After successful upgrade payment, target tier is always full. */
export function ayclTierAfterUpgrade(): AyclAccessTier {
  return "full";
}

export function buildAyclAccessUrl(baseUrl: string, accessToken: string): string {
  return `${baseUrl.replace(/\/$/, "")}/learn/${accessToken}`;
}
