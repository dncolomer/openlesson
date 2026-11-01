/**
 * Credit ledger amounts. Tests import these constants; do not duplicate a second price list.
 */

export const FLOW_SESSION_KINDS = ["learn", "calibrate", "verify", "solve"] as const;
export type FlowSessionKind = (typeof FLOW_SESSION_KINDS)[number];

/** Free-signup starter grant (credits). */
export const STARTER_CREDIT_GRANT = 50;

/** Credits deducted for each Calibrate / Learn / Verify / Solve session start. */
export const FLOW_SESSION_CREDIT_COST = 10;

export const STARTER_GRANT_REASON = "signup_starter" as const;
export const PACK_GRANT_REASON = "credit_pack" as const;
export const SESSION_DEBIT_REASON = "flow_session" as const;
export const SESSION_REFUND_REASON = "session_start_failed" as const;

export const CREDIT_PACK_SKU_IDS = [
  "credits_100",
  "credits_500",
  "credits_2000",
] as const;

export type CreditPackSkuId = (typeof CREDIT_PACK_SKU_IDS)[number];

export type CreditPack = {
  id: CreditPackSkuId;
  credits: number;
  priceCents: number;
  name: string;
  eyebrow: string;
  body: string;
  cta: string;
  highlighted?: boolean;
};

export const CREDIT_PACKS: readonly CreditPack[] = [
  {
    id: "credits_100",
    credits: 100,
    priceCents: 499,
    name: "100 credits",
    eyebrow: "STARTER PACK",
    body: "One-time credits for Calibrate, Learn, Verify, and Solve sessions.",
    cta: "Buy 100 credits",
  },
  {
    id: "credits_500",
    credits: 500,
    priceCents: 1999,
    name: "500 credits",
    eyebrow: "WORKING PACK",
    body: "A larger one-time pack for running flows, including Learn inside a map.",
    cta: "Buy 500 credits",
    highlighted: true,
  },
  {
    id: "credits_2000",
    credits: 2000,
    priceCents: 5999,
    name: "2,000 credits",
    eyebrow: "STUDIO PACK",
    body: "Credits for heavy Solve, Verify, and Calibrate work.",
    cta: "Buy 2,000 credits",
  },
] as const;

const PACK_BY_ID = new Map(CREDIT_PACKS.map((pack) => [pack.id, pack]));

export function isCreditPackSkuId(value: string | null | undefined): value is CreditPackSkuId {
  return typeof value === "string" && PACK_BY_ID.has(value as CreditPackSkuId);
}

export function creditPackById(sku: string | null | undefined): CreditPack | null {
  if (!sku) return null;
  return PACK_BY_ID.get(sku as CreditPackSkuId) ?? null;
}

export function isFlowSessionKind(value: string | null | undefined): value is FlowSessionKind {
  return (
    value === "learn" ||
    value === "calibrate" ||
    value === "verify" ||
    value === "solve"
  );
}
