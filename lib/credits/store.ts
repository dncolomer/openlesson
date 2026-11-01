/**
 * Credit account store. Memory implementation is the test double; Supabase is live.
 */

import { applyDebit, applyGrant, type CreditEntryKind } from "@/lib/credits/ledger";
import type { FlowSessionKind } from "@/lib/credits/constants";

export type CreditLedgerEntry = {
  id: string;
  userId: string;
  entryKind: CreditEntryKind;
  amount: number;
  balanceAfter: number;
  reason: string;
  flowKind: FlowSessionKind | null;
  stripeCheckoutSessionId: string | null;
  createdAt: string;
};

export type CreditAccountSnapshot = {
  userId: string;
  balance: number;
  entries: CreditLedgerEntry[];
};

export type DebitCommitResult =
  | { ok: true; balanceAfter: number; entry: CreditLedgerEntry }
  | {
      ok: false;
      code: "insufficient_credits";
      balance: number;
      amount: number;
      reason: string;
    };

export type GrantCommitResult = {
  ok: true;
  balanceAfter: number;
  entry: CreditLedgerEntry;
  applied: boolean;
};

export type CreditStore = {
  load(userId: string): Promise<CreditAccountSnapshot>;
  commitGrant(input: {
    userId: string;
    amount: number;
    reason: string;
    entryKind?: Exclude<CreditEntryKind, "debit">;
    stripeCheckoutSessionId?: string | null;
    idempotencyKey?: string | null;
  }): Promise<GrantCommitResult>;
  commitDebit(input: {
    userId: string;
    amount: number;
    reason: string;
    flowKind?: FlowSessionKind | null;
  }): Promise<DebitCommitResult>;
};

function newId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `cred_${Math.random().toString(36).slice(2)}_${Date.now()}`;
}

export function createMemoryCreditStore(
  seed: Record<string, number> = {},
): CreditStore & { balances: Map<string, number> } {
  const balances = new Map<string, number>(
    Object.entries(seed).map(([id, value]) => [id, Math.max(0, Math.floor(value))]),
  );
  const ledgers = new Map<string, CreditLedgerEntry[]>();

  function entriesFor(userId: string): CreditLedgerEntry[] {
    return ledgers.get(userId) ?? [];
  }

  return {
    balances,
    async load(userId: string) {
      return {
        userId,
        balance: balances.get(userId) ?? 0,
        entries: [...entriesFor(userId)],
      };
    },
    async commitGrant(input) {
      const current = balances.get(input.userId) ?? 0;
      if (input.idempotencyKey) {
        const existing = entriesFor(input.userId).find(
          (entry) => entry.reason === input.idempotencyKey,
        );
        if (existing) {
          return { ok: true as const, balanceAfter: current, entry: existing, applied: false };
        }
      }
      const granted = applyGrant(current, input.amount);
      const entry: CreditLedgerEntry = {
        id: newId(),
        userId: input.userId,
        entryKind: input.entryKind ?? "grant",
        amount: granted.amount,
        balanceAfter: granted.balanceAfter,
        reason: input.reason,
        flowKind: null,
        stripeCheckoutSessionId: input.stripeCheckoutSessionId ?? null,
        createdAt: new Date().toISOString(),
      };
      balances.set(input.userId, granted.balanceAfter);
      ledgers.set(input.userId, [...entriesFor(input.userId), entry]);
      return { ok: true as const, balanceAfter: granted.balanceAfter, entry, applied: true };
    },
    async commitDebit(input) {
      const current = balances.get(input.userId) ?? 0;
      const debited = applyDebit(current, input.amount);
      if (!debited.ok) return debited;
      const entry: CreditLedgerEntry = {
        id: newId(),
        userId: input.userId,
        entryKind: "debit",
        amount: -debited.amount,
        balanceAfter: debited.balanceAfter,
        reason: input.reason,
        flowKind: input.flowKind ?? null,
        stripeCheckoutSessionId: null,
        createdAt: new Date().toISOString(),
      };
      balances.set(input.userId, debited.balanceAfter);
      ledgers.set(input.userId, [...entriesFor(input.userId), entry]);
      return { ok: true as const, balanceAfter: debited.balanceAfter, entry };
    },
  };
}
