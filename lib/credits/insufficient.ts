/**
 * Out-of-credits ice screen: parse 402 envelopes, pricing + register hrefs.
 */

import { FLOW_SESSION_CREDIT_COST } from "@/lib/credits/constants";
import { HARNESS_PRICING_PATH } from "@/lib/marketing/paths";

export const INSUFFICIENT_CREDITS_EVENT = "openlesson:insufficient-credits";

export const INSUFFICIENT_CREDITS_COPY = {
  kicker: "Credits",
  title: "You're out of credits",
  body: `This session costs ${FLOW_SESSION_CREDIT_COST} credits. Buy a pack to keep going.`,
  getCredits: "Get credits",
  createAccount: "Create an account",
} as const;

export type InsufficientCreditsDetail = {
  balance: number | null;
  cost: number | null;
};

export function safeInternalReturnPath(raw: string | null | undefined): string | null {
  if (!raw || typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//") || trimmed.includes("://")) {
    return null;
  }
  return trimmed;
}

export function insufficientCreditsPricingHref(): string {
  return HARNESS_PRICING_PATH;
}

export function insufficientCreditsRegisterHref(
  returnPath: string = HARNESS_PRICING_PATH,
): string {
  const safe = safeInternalReturnPath(returnPath) || HARNESS_PRICING_PATH;
  return `/register?returnUrl=${encodeURIComponent(safe)}`;
}

export function isInsufficientCreditsBody(body: unknown): boolean {
  if (!body || typeof body !== "object") return false;
  const err = (body as { error?: unknown }).error;
  if (typeof err === "string") {
    return /insufficient credits|buy credits/i.test(err);
  }
  if (err && typeof err === "object") {
    const code = (err as { code?: unknown }).code;
    if (code === "insufficient_credits") return true;
  }
  return false;
}

export function parseInsufficientCreditsBody(
  body: unknown,
): InsufficientCreditsDetail | null {
  if (!isInsufficientCreditsBody(body)) return null;
  const err =
    body && typeof body === "object"
      ? (body as { error?: { details?: Record<string, unknown> } }).error
      : null;
  const details =
    err && typeof err === "object" && err.details && typeof err.details === "object"
      ? err.details
      : {};
  const balanceRaw = details.balance;
  const costRaw = details.cost;
  return {
    balance: typeof balanceRaw === "number" && Number.isFinite(balanceRaw) ? balanceRaw : null,
    cost: typeof costRaw === "number" && Number.isFinite(costRaw) ? costRaw : FLOW_SESSION_CREDIT_COST,
  };
}

export function publishInsufficientCreditsIce(detail: InsufficientCreditsDetail | null) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(INSUFFICIENT_CREDITS_EVENT, { detail: detail ?? { balance: 0, cost: FLOW_SESSION_CREDIT_COST } }),
  );
}

let fetchGuardInstalled = false;

export function installInsufficientCreditsFetchGuard() {
  if (fetchGuardInstalled || typeof window === "undefined") return;
  fetchGuardInstalled = true;
  const orig = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const res = await orig(input, init);
    if (res.status === 402) {
      void res
        .clone()
        .json()
        .then((body) => {
          const parsed = parseInsufficientCreditsBody(body);
          if (parsed) publishInsufficientCreditsIce(parsed);
        })
        .catch(() => {});
    }
    return res;
  };
}
