/**
 * Complimentary (free) AYCL special URLs: play vs full, usage and/or time expiration.
 * Pure helpers — no Stripe. Server redeem lives in lib/aycl.ts.
 */

import {
  normalizeAyclAccessTier,
  resolveAyclCapabilities,
  type AyclAccessTier,
  type AyclCapabilities,
} from "@/lib/aycl-shared";

export type ComplimentaryAyclLinkStatus = "active" | "revoked";

export type ComplimentaryAyclLinkEligibilityReason =
  | "revoked"
  | "expired"
  | "exhausted";

export type ComplimentaryAyclLinkEligibility =
  | { ok: true }
  | { ok: false; reason: ComplimentaryAyclLinkEligibilityReason };

export type ComplimentaryAyclLinkLimits = {
  status: string;
  expires_at: string | null;
  max_uses: number | null;
  use_count: number;
};

export type ComplimentaryAyclLinkCreateFields = {
  access_tier: AyclAccessTier;
  max_uses: number | null;
  expires_at: string | null;
};

/** Play special URL → learner capabilities; full → full capabilities. */
export function complimentaryAyclAccessTierFromInput(
  value: unknown,
): AyclAccessTier | null {
  if (value === "play" || value === "learner" || value === "practice") {
    return "learner";
  }
  if (
    value === "full" ||
    value === "build" ||
    value === "creator" ||
    value === "complete"
  ) {
    return "full";
  }
  return null;
}

export function resolveComplimentaryAyclCapabilities(
  tierInput: unknown,
): AyclCapabilities {
  const mapped = complimentaryAyclAccessTierFromInput(tierInput);
  return resolveAyclCapabilities(mapped ?? normalizeAyclAccessTier(tierInput));
}

/**
 * A still-valid URL grants access. Exhausted usage or expired time does not.
 * `now` is injected so tests drive the shipped function with representative clocks.
 */
export function complimentaryAyclLinkEligible(
  link: ComplimentaryAyclLinkLimits,
  now: Date = new Date(),
): ComplimentaryAyclLinkEligibility {
  if (link.status !== "active") {
    return { ok: false, reason: "revoked" };
  }
  if (link.expires_at) {
    const expiresAt = Date.parse(link.expires_at);
    if (Number.isFinite(expiresAt) && expiresAt <= now.getTime()) {
      return { ok: false, reason: "expired" };
    }
  }
  if (
    link.max_uses != null &&
    Number.isFinite(link.max_uses) &&
    link.use_count >= link.max_uses
  ) {
    return { ok: false, reason: "exhausted" };
  }
  return { ok: true };
}

export function parseComplimentaryLinkCreateBody(
  body: Record<string, unknown>,
  now: Date = new Date(),
): { fields: ComplimentaryAyclLinkCreateFields } | { error: string } {
  const rawTier = body.access_tier ?? body.accessTier ?? body.tier;
  const access_tier = complimentaryAyclAccessTierFromInput(rawTier);
  if (!access_tier) {
    return { error: "access_tier must be play (learner) or full" };
  }

  const rawUses = body.max_uses ?? body.maxUses ?? body.usage;
  let max_uses: number | null = null;
  if (rawUses !== undefined && rawUses !== null && rawUses !== "") {
    const n = typeof rawUses === "number" ? rawUses : Number(rawUses);
    if (!Number.isInteger(n) || n < 1) {
      return { error: "max_uses must be a positive integer, or empty for unlimited" };
    }
    max_uses = n;
  }

  const rawExpires = body.expires_at ?? body.expiresAt ?? body.expiration;
  let expires_at: string | null = null;
  if (rawExpires !== undefined && rawExpires !== null && rawExpires !== "") {
    if (typeof rawExpires !== "string") {
      return { error: "expires_at must be an ISO timestamp, or empty for no expiration" };
    }
    const parsed = Date.parse(rawExpires);
    if (!Number.isFinite(parsed)) {
      return { error: "expires_at must be an ISO timestamp, or empty for no expiration" };
    }
    if (parsed <= now.getTime()) {
      return { error: "expires_at must be in the future" };
    }
    expires_at = new Date(parsed).toISOString();
  }

  return { fields: { access_tier, max_uses, expires_at } };
}

/**
 * Purchase row for a complimentary redemption — never a Stripe checkout session.
 */
export function ayclComplimentaryPurchaseRow(input: {
  sourceWorkspaceId: string;
  forkedWorkspaceId: string;
  accessTokenHash: string;
  accessTier: AyclAccessTier;
  complimentaryLinkId: string;
  now?: Date;
}): {
  source_workspace_id: string;
  forked_workspace_id: string;
  access_token_hash: string;
  stripe_checkout_session_id: null;
  purchaser_email: null;
  status: "completed";
  access_tier: AyclAccessTier;
  complimentary_link_id: string;
  completed_at: string;
} {
  const now = input.now ?? new Date();
  return {
    source_workspace_id: input.sourceWorkspaceId,
    forked_workspace_id: input.forkedWorkspaceId,
    access_token_hash: input.accessTokenHash,
    stripe_checkout_session_id: null,
    purchaser_email: null,
    status: "completed",
    access_tier: input.accessTier,
    complimentary_link_id: input.complimentaryLinkId,
    completed_at: now.toISOString(),
  };
}

/** Query param on `/all-you-can-learn/{workspaceId}` for complimentary access. */
export const AYCL_COMPLIMENTARY_QUERY_PARAM = "comp";

/** Current-price label when the complimentary link matches this offer. */
export const AYCL_COMPLIMENTARY_CURRENT_PRICE_LABEL = "Free";

export function complimentaryTokenFromQuery(query: unknown): string | null {
  if (!query || typeof query !== "object") return null;
  const raw = (query as Record<string, unknown>)[AYCL_COMPLIMENTARY_QUERY_PARAM];
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (typeof value !== "string") return null;
  const token = value.trim();
  return token || null;
}

/** Path-only share URL: workspace landing + complimentary token (not /learn shell). */
export function complimentaryLinkLandingPath(
  workspaceId: string,
  publicToken: string,
): string {
  const id = String(workspaceId || "").trim();
  const token = String(publicToken || "").trim();
  if (!id) return "/all-you-can-learn";
  const q = token
    ? `?${AYCL_COMPLIMENTARY_QUERY_PARAM}=${encodeURIComponent(token)}`
    : "";
  return `/all-you-can-learn/${encodeURIComponent(id)}${q}`;
}

export function complimentaryLinkPublicUrl(
  baseUrl: string,
  workspaceId: string,
  publicToken: string,
): string {
  const origin = String(baseUrl || "").replace(/\/$/, "");
  return `${origin}${complimentaryLinkLandingPath(workspaceId, publicToken)}`;
}
