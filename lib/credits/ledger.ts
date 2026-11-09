/**
 * Pure credit ledger: grant, debit, billed account, billable vs free actions.
 * No Stripe I/O and no session insert.
 */

import {
  FLOW_SESSION_CREDIT_COST,
  GUEST_CREDIT_GRANT,
  STARTER_CREDIT_GRANT,
  type FlowSessionKind,
} from "@/lib/credits/constants";

export type CreditAction = "flow_session" | "map_create" | "knowledge_region_create";

export type CreditEntryKind = "grant" | "pack" | "debit" | "refund";

export type LedgerApplyOk = {
  ok: true;
  balanceAfter: number;
  amount: number;
};

export type LedgerInsufficient = {
  ok: false;
  code: "insufficient_credits";
  balance: number;
  amount: number;
  reason: string;
};

export function creditCostForAction(action: CreditAction): number {
  if (action === "flow_session") return FLOW_SESSION_CREDIT_COST;
  return 0;
}

export function isBillableAction(action: CreditAction): boolean {
  return creditCostForAction(action) > 0;
}

export function flowSessionCreditCost(_kind?: FlowSessionKind): number {
  return FLOW_SESSION_CREDIT_COST;
}

export function starterGrantAmount(): number {
  return STARTER_CREDIT_GRANT;
}

export function guestGrantAmount(): number {
  return GUEST_CREDIT_GRANT;
}

export function billedUserIdForSession(input: {
  runnerUserId: string | null | undefined;
  ownerUserId: string;
}): string {
  const runner = typeof input.runnerUserId === "string" ? input.runnerUserId.trim() : "";
  if (runner) return runner;
  return input.ownerUserId;
}

/** Platform admins (`profiles.is_admin`) never consume session credits. */
export function isUnmeteredCreditsProfile(
  profile: { is_admin?: boolean | null } | null | undefined,
): boolean {
  return Boolean(profile?.is_admin);
}

export function applyGrant(balance: number, amount: number): LedgerApplyOk {
  const safeBalance = Math.max(0, Math.floor(balance));
  const safeAmount = Math.max(0, Math.floor(amount));
  return { ok: true, balanceAfter: safeBalance + safeAmount, amount: safeAmount };
}

export function applyDebit(balance: number, amount: number): LedgerApplyOk | LedgerInsufficient {
  const safeBalance = Math.max(0, Math.floor(balance));
  const safeAmount = Math.max(0, Math.floor(amount));
  if (safeAmount <= 0) {
    return { ok: true, balanceAfter: safeBalance, amount: 0 };
  }
  if (safeBalance < safeAmount) {
    return {
      ok: false,
      code: "insufficient_credits",
      balance: safeBalance,
      amount: safeAmount,
      reason: insufficientCreditsMessage(safeBalance, safeAmount),
    };
  }
  return { ok: true, balanceAfter: safeBalance - safeAmount, amount: safeAmount };
}

export function insufficientCreditsMessage(balance: number, amount: number): string {
  return `This session costs ${amount} credits. Your balance is ${balance}. Buy credits to continue.`;
}
