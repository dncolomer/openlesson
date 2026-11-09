/**
 * Credit account operations over a CreditStore.
 * Session-start paths call debitFlowSessionCredits / startBillableFlowSession
 * before persisting a session.
 */

import type { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { jsonError } from "@/lib/api-error-envelope";
import {
  GUEST_CREDIT_GRANT,
  GUEST_GRANT_REASON,
  PACK_GRANT_REASON,
  SESSION_DEBIT_REASON,
  SESSION_REFUND_REASON,
  STARTER_CREDIT_GRANT,
  STARTER_GRANT_REASON,
  creditPackById,
  type CreditPackSkuId,
  type FlowSessionKind,
} from "@/lib/credits/constants";
import {
  billedUserIdForSession,
  creditCostForAction,
  flowSessionCreditCost,
  insufficientCreditsMessage,
  type CreditAction,
} from "@/lib/credits/ledger";
import {
  createMemoryCreditStore,
  type CreditStore,
  type DebitCommitResult,
  type GrantCommitResult,
} from "@/lib/credits/store";
import { createSupabaseCreditStore } from "@/lib/credits/supabase-store";

export class InsufficientCreditsError extends Error {
  readonly code = "insufficient_credits" as const;
  readonly balance: number;
  readonly amount: number;

  constructor(balance: number, amount: number) {
    super(insufficientCreditsMessage(balance, amount));
    this.name = "InsufficientCreditsError";
    this.balance = balance;
    this.amount = amount;
  }
}

export function isInsufficientCreditsError(
  error: unknown,
): error is InsufficientCreditsError {
  return error instanceof InsufficientCreditsError;
}

export async function applyStarterGrantIfNeeded(
  store: CreditStore,
  userId: string,
): Promise<GrantCommitResult> {
  return store.commitGrant({
    userId,
    amount: STARTER_CREDIT_GRANT,
    reason: STARTER_GRANT_REASON,
    entryKind: "grant",
    idempotencyKey: STARTER_GRANT_REASON,
  });
}

export async function applyGuestGrantIfNeeded(
  store: CreditStore,
  userId: string,
): Promise<GrantCommitResult> {
  return store.commitGrant({
    userId,
    amount: GUEST_CREDIT_GRANT,
    reason: GUEST_GRANT_REASON,
    entryKind: "grant",
    idempotencyKey: GUEST_GRANT_REASON,
  });
}

export async function grantCreditPack(
  store: CreditStore,
  userId: string,
  sku: CreditPackSkuId,
  stripeCheckoutSessionId?: string | null,
): Promise<GrantCommitResult> {
  const pack = creditPackById(sku);
  if (!pack) {
    throw new Error(`Unknown credit pack ${sku}`);
  }
  const idempotencyKey = stripeCheckoutSessionId
    ? `${PACK_GRANT_REASON}:${stripeCheckoutSessionId}`
    : null;
  return store.commitGrant({
    userId,
    amount: pack.credits,
    reason: idempotencyKey || PACK_GRANT_REASON,
    entryKind: "pack",
    stripeCheckoutSessionId: stripeCheckoutSessionId ?? null,
    idempotencyKey,
  });
}

export type FlowSessionChargeInput = {
  runnerUserId: string | null | undefined;
  ownerUserId: string;
  flowKind: FlowSessionKind;
};

export async function debitFlowSessionCredits(
  store: CreditStore,
  input: FlowSessionChargeInput,
): Promise<DebitCommitResult & { billedUserId: string }> {
  const billedUserId = billedUserIdForSession(input);
  const amount = flowSessionCreditCost(input.flowKind);
  const result = await store.commitDebit({
    userId: billedUserId,
    amount,
    reason: SESSION_DEBIT_REASON,
    flowKind: input.flowKind,
  });
  return { ...result, billedUserId };
}

export async function refundFlowSessionCredits(
  store: CreditStore,
  billedUserId: string,
  amount: number = flowSessionCreditCost(),
): Promise<GrantCommitResult> {
  return store.commitGrant({
    userId: billedUserId,
    amount,
    reason: SESSION_REFUND_REASON,
    entryKind: "refund",
  });
}

/**
 * Representative session-start path: debit first; persist only after a successful debit.
 * If persist throws, credits are refunded and the error rethrown.
 */
export async function startBillableFlowSession<T>(
  store: CreditStore,
  input: FlowSessionChargeInput,
  persist: () => Promise<T>,
): Promise<
  | { ok: true; value: T; billedUserId: string; balanceAfter: number }
  | {
      ok: false;
      code: "insufficient_credits";
      billedUserId: string;
      balance: number;
      amount: number;
      reason: string;
    }
> {
  const charge = await debitFlowSessionCredits(store, input);
  if (!charge.ok) {
    return {
      ok: false,
      code: "insufficient_credits",
      billedUserId: charge.billedUserId,
      balance: charge.balance,
      amount: charge.amount,
      reason: charge.reason,
    };
  }
  try {
    const value = await persist();
    return {
      ok: true,
      value,
      billedUserId: charge.billedUserId,
      balanceAfter: charge.balanceAfter,
    };
  } catch (error) {
    if (!charge.skipped && charge.entry) {
      await refundFlowSessionCredits(
        store,
        charge.billedUserId,
        charge.entry.amount < 0 ? -charge.entry.amount : flowSessionCreditCost(input.flowKind),
      );
    }
    throw error;
  }
}

export async function loadCreditSummary(store: CreditStore, userId: string) {
  const snapshot = await store.load(userId);
  const grants = snapshot.entries.filter(
    (entry) => entry.entryKind === "grant" || entry.entryKind === "pack" || entry.entryKind === "refund",
  );
  const debits = snapshot.entries.filter((entry) => entry.entryKind === "debit");
  return {
    balance: snapshot.balance,
    starterGrant: STARTER_CREDIT_GRANT,
    sessionCost: flowSessionCreditCost(),
    grants,
    debits,
    entries: snapshot.entries,
  };
}

export function unmeteredCreateLeavesBalance(
  action: CreditAction,
  balance: number,
): { action: CreditAction; cost: number; balanceAfter: number } {
  const cost = creditCostForAction(action);
  return { action, cost, balanceAfter: balance - cost };
}

export function creditStoreFromClient(client: SupabaseClient): CreditStore {
  return createSupabaseCreditStore(client);
}

export function memoryCreditStore(
  seed?: Record<string, number>,
  options?: { unmeteredUserIds?: Iterable<string> },
) {
  return createMemoryCreditStore(seed, options);
}

export async function rejectIfInsufficientSessionCredits(
  client: SupabaseClient,
  input: FlowSessionChargeInput,
): Promise<NextResponse | null> {
  const store = creditStoreFromClient(client);
  const charge = await debitFlowSessionCredits(store, input);
  if (charge.ok) return null;
  return jsonError(402, charge.reason, "insufficient_credits", {
    balance: charge.balance,
    cost: charge.amount,
    billedUserId: charge.billedUserId,
    renew_url: "/pricing",
  });
}

export async function chargeFlowSessionOrThrow(
  client: SupabaseClient,
  input: FlowSessionChargeInput,
): Promise<void> {
  const store = creditStoreFromClient(client);
  const charge = await debitFlowSessionCredits(store, input);
  if (!charge.ok) {
    throw new InsufficientCreditsError(charge.balance, charge.amount);
  }
}
