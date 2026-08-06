/**
 * Pure helpers for AYCL marketplace listing: catalog DTOs, filters, price resolve.
 * Client-safe (no server imports).
 */

import {
  AYCL_FULL_PRICE_CENTS,
  AYCL_LEARNER_PRICE_CENTS,
  ayclOfferDescription,
  ayclOfferLabel,
  type AyclAccessTier,
} from "@/lib/aycl-shared";

/** Suggested categories for admin UI + empty-state filters (free-text still allowed). */
export const AYCL_SUGGESTED_CATEGORIES = [
  "Engineering",
  "AI & ML",
  "Science",
  "Math",
  "Business",
  "Design",
  "Health",
  "Other",
] as const;

export type AyclListingPriceFields = {
  aycl_learner_price_cents?: number | null;
  aycl_full_price_cents?: number | null;
};

export type AyclListingMetaFields = {
  aycl_category?: string | null;
  aycl_summary?: string | null;
  aycl_author_name?: string | null;
  aycl_author_avatar_url?: string | null;
};

export type AyclListingFields = AyclListingMetaFields & AyclListingPriceFields;

export type AyclCatalogWorkspaceRow = AyclListingFields & {
  id: string;
  title?: string | null;
  root_topic?: string | null;
  description?: string | null;
  cover_image_url?: string | null;
  created_at?: string | null;
};

export type AyclCatalogOfferDto = {
  tier: AyclAccessTier;
  label: string;
  description: string;
  priceCents: number;
  priceLabel: string;
};

export type AyclCatalogCardDto = {
  id: string;
  title: string;
  /** Prefer marketplace summary, then workspace description. */
  summary: string | null;
  description: string | null;
  category: string | null;
  authorName: string | null;
  authorAvatarUrl: string | null;
  cover_image_url: string | null;
  /** @deprecated prefer offers.full.priceLabel */
  priceLabel: string;
  offers: {
    learner: AyclCatalogOfferDto;
    full: AyclCatalogOfferDto;
  };
  createdAt: string | null;
};

function clean(s: unknown): string {
  return typeof s === "string" ? s.replace(/\s+/g, " ").trim() : "";
}

/** Format USD cents as a shopper-facing label, e.g. 999 → "$9.99". */
export function formatAyclPriceCents(cents: number): string {
  const n = Number.isFinite(cents) ? Math.round(cents) : 0;
  const dollars = n / 100;
  return dollars % 1 === 0
    ? `$${dollars.toFixed(0)}`
    : `$${dollars.toFixed(2)}`;
}

/**
 * Normalize a free-text category. Empty → null. Collapses whitespace; keeps original casing for display.
 */
export function normalizeAyclCategory(value: unknown): string | null {
  const s = clean(value);
  if (!s) return null;
  if (s.length > 64) return s.slice(0, 64).trim();
  return s;
}

export function normalizeAyclAuthorName(value: unknown): string | null {
  const s = clean(value);
  if (!s) return null;
  if (s.length > 120) return s.slice(0, 120).trim();
  return s;
}

export function normalizeAyclAuthorAvatarUrl(value: unknown): string | null {
  const s = clean(value);
  if (!s) return null;
  if (s.length > 2000) return null;
  // Allow absolute http(s) or site-relative paths.
  if (/^https?:\/\//i.test(s) || s.startsWith("/")) return s;
  return null;
}

export function normalizeAyclMarketplaceSummary(value: unknown): string | null {
  const s = clean(value);
  if (!s) return null;
  if (s.length > 2000) return s.slice(0, 2000).trim();
  return s;
}

/**
 * Normalize optional price cents. Null/empty/invalid → null (use global default).
 * Rejects negative and absurdly large values.
 */
export function normalizeAyclPriceCents(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value.trim())
        : NaN;
  if (!Number.isFinite(n)) return null;
  const cents = Math.round(n);
  if (cents < 0 || cents > 10_000_000) return null;
  return cents;
}

export type NormalizedAyclListing = {
  category: string | null;
  summary: string | null;
  authorName: string | null;
  authorAvatarUrl: string | null;
  learnerPriceCents: number | null;
  fullPriceCents: number | null;
};

export function normalizeAyclListingFields(
  input: AyclListingFields | null | undefined,
): NormalizedAyclListing {
  const row = input || {};
  return {
    category: normalizeAyclCategory(row.aycl_category),
    summary: normalizeAyclMarketplaceSummary(row.aycl_summary),
    authorName: normalizeAyclAuthorName(row.aycl_author_name),
    authorAvatarUrl: normalizeAyclAuthorAvatarUrl(row.aycl_author_avatar_url),
    learnerPriceCents: normalizeAyclPriceCents(row.aycl_learner_price_cents),
    fullPriceCents: normalizeAyclPriceCents(row.aycl_full_price_cents),
  };
}

/**
 * Resolve checkout unit amount for a tier.
 * Configured listing price wins; null falls back to global defaults.
 */
export function resolveAyclCheckoutCents(
  tier: AyclAccessTier,
  listing?: AyclListingPriceFields | null,
): number {
  const normalized = normalizeAyclListingFields(listing || {});
  if (tier === "learner") {
    return normalized.learnerPriceCents ?? AYCL_LEARNER_PRICE_CENTS;
  }
  return normalized.fullPriceCents ?? AYCL_FULL_PRICE_CENTS;
}

/**
 * Upgrade delta: full − learner using the same resolve rules.
 * Floored at 0 if misconfigured (full cheaper than learner).
 */
export function resolveAyclUpgradeCents(
  listing?: AyclListingPriceFields | null,
): number {
  const full = resolveAyclCheckoutCents("full", listing);
  const learner = resolveAyclCheckoutCents("learner", listing);
  return Math.max(0, full - learner);
}

export function ayclPriceLabelFromCents(cents: number): string {
  return formatAyclPriceCents(cents);
}

function buildOfferDto(
  tier: AyclAccessTier,
  listing?: AyclListingPriceFields | null,
): AyclCatalogOfferDto {
  const priceCents = resolveAyclCheckoutCents(tier, listing);
  return {
    tier,
    label: ayclOfferLabel(tier),
    description: ayclOfferDescription(tier),
    priceCents,
    priceLabel: formatAyclPriceCents(priceCents),
  };
}

/**
 * Assemble a marketplace catalog card from a workspace row.
 * Listing summary/author/category/prices take precedence over bare description/global prices.
 */
export function assembleAyclCatalogCard(
  workspace: AyclCatalogWorkspaceRow,
): AyclCatalogCardDto {
  const listing = normalizeAyclListingFields(workspace);
  const title =
    clean(workspace.title) || clean(workspace.root_topic) || "Learning workspace";
  const description = clean(workspace.description) || null;
  const summary = listing.summary || description;
  const fullOffer = buildOfferDto("full", workspace);
  const learnerOffer = buildOfferDto("learner", workspace);

  return {
    id: String(workspace.id || "").trim(),
    title,
    summary,
    description,
    category: listing.category,
    authorName: listing.authorName,
    authorAvatarUrl: listing.authorAvatarUrl,
    cover_image_url: clean(workspace.cover_image_url) || null,
    priceLabel: fullOffer.priceLabel,
    offers: {
      learner: learnerOffer,
      full: fullOffer,
    },
    createdAt:
      typeof workspace.created_at === "string" ? workspace.created_at : null,
  };
}

export type AyclCatalogFilter = {
  /** Exact category match (case-insensitive). Empty / "all" → no category filter. */
  category?: string | null;
  /** Case-insensitive substring match on title, summary, author, category. */
  query?: string | null;
};

/**
 * Client-side filter over an already-loaded catalog (no backend search).
 */
export function filterAyclCatalogCards(
  cards: readonly AyclCatalogCardDto[],
  filter: AyclCatalogFilter = {},
): AyclCatalogCardDto[] {
  const categoryNeedle = clean(filter.category).toLowerCase();
  const q = clean(filter.query).toLowerCase();
  const wantCategory =
    categoryNeedle && categoryNeedle !== "all" && categoryNeedle !== "all categories";

  return cards.filter((card) => {
    if (wantCategory) {
      const cat = (card.category || "").toLowerCase();
      if (cat !== categoryNeedle) return false;
    }
    if (!q) return true;
    const hay = [
      card.title,
      card.summary,
      card.description,
      card.authorName,
      card.category,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return hay.includes(q);
  });
}

/** Unique sorted categories present on cards (for marketplace chips). */
export function collectAyclCatalogCategories(
  cards: readonly AyclCatalogCardDto[],
): string[] {
  const set = new Set<string>();
  for (const card of cards) {
    if (card.category) set.add(card.category);
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}

/**
 * Sanitize admin PATCH body into DB-ready listing columns.
 * Only includes keys that were present on the body (partial update friendly).
 */
export function parseAyclListingUpdateBody(
  body: Record<string, unknown>,
): {
  fields: Partial<{
    is_all_you_can_learn: boolean;
    aycl_category: string | null;
    aycl_summary: string | null;
    aycl_author_name: string | null;
    aycl_author_avatar_url: string | null;
    aycl_learner_price_cents: number | null;
    aycl_full_price_cents: number | null;
  }>;
  error?: string;
} {
  const fields: Partial<{
    is_all_you_can_learn: boolean;
    aycl_category: string | null;
    aycl_summary: string | null;
    aycl_author_name: string | null;
    aycl_author_avatar_url: string | null;
    aycl_learner_price_cents: number | null;
    aycl_full_price_cents: number | null;
  }> = {};

  if ("is_all_you_can_learn" in body) {
    fields.is_all_you_can_learn = Boolean(body.is_all_you_can_learn);
  }
  if ("aycl_category" in body) {
    fields.aycl_category = normalizeAyclCategory(body.aycl_category);
  }
  if ("aycl_summary" in body) {
    fields.aycl_summary = normalizeAyclMarketplaceSummary(body.aycl_summary);
  }
  if ("aycl_author_name" in body) {
    fields.aycl_author_name = normalizeAyclAuthorName(body.aycl_author_name);
  }
  if ("aycl_author_avatar_url" in body) {
    const raw = body.aycl_author_avatar_url;
    if (raw === null || raw === "") {
      fields.aycl_author_avatar_url = null;
    } else {
      const url = normalizeAyclAuthorAvatarUrl(raw);
      if (clean(raw) && !url) {
        return {
          fields: {},
          error: "Author avatar must be an http(s) URL or site-relative path",
        };
      }
      fields.aycl_author_avatar_url = url;
    }
  }
  if ("aycl_learner_price_cents" in body) {
    const raw = body.aycl_learner_price_cents;
    if (raw === null || raw === "") {
      fields.aycl_learner_price_cents = null;
    } else {
      const cents = normalizeAyclPriceCents(raw);
      if (cents === null && raw !== null && raw !== "") {
        return { fields: {}, error: "Invalid learner price (cents)" };
      }
      fields.aycl_learner_price_cents = cents;
    }
  }
  if ("aycl_full_price_cents" in body) {
    const raw = body.aycl_full_price_cents;
    if (raw === null || raw === "") {
      fields.aycl_full_price_cents = null;
    } else {
      const cents = normalizeAyclPriceCents(raw);
      if (cents === null && raw !== null && raw !== "") {
        return { fields: {}, error: "Invalid full price (cents)" };
      }
      fields.aycl_full_price_cents = cents;
    }
  }

  return { fields };
}

/** Convert dollars input string to cents for admin form save. */
export function dollarsInputToCents(value: string): number | null {
  const s = clean(value);
  if (!s) return null;
  const n = Number(s.replace(/\$/g, ""));
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}

/** Cents → dollars string for admin form (e.g. 999 → "9.99"). */
export function centsToDollarsInput(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return "";
  const n = Number(cents);
  if (!Number.isFinite(n)) return "";
  return (n / 100).toFixed(2);
}
