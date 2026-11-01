import type { SupabaseClient } from "@supabase/supabase-js";
import { applyDebit, applyGrant } from "@/lib/credits/ledger";
import type { CreditLedgerEntry, CreditStore, DebitCommitResult, GrantCommitResult } from "@/lib/credits/store";
import type { FlowSessionKind } from "@/lib/credits/constants";

const LEDGER_TABLE = "credit_ledger";

type LedgerRow = {
  id: string;
  user_id: string;
  entry_kind: CreditLedgerEntry["entryKind"];
  amount: number;
  balance_after: number;
  reason: string;
  flow_kind: string | null;
  stripe_checkout_session_id: string | null;
  created_at: string;
};

function mapRow(row: LedgerRow): CreditLedgerEntry {
  return {
    id: row.id,
    userId: row.user_id,
    entryKind: row.entry_kind,
    amount: row.amount,
    balanceAfter: row.balance_after,
    reason: row.reason,
    flowKind: (row.flow_kind as FlowSessionKind | null) ?? null,
    stripeCheckoutSessionId: row.stripe_checkout_session_id,
    createdAt: row.created_at,
  };
}

async function readBalance(client: SupabaseClient, userId: string): Promise<number> {
  const { data, error } = await client
    .from("profiles")
    .select("credit_balance")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  const raw = (data as { credit_balance?: number } | null)?.credit_balance;
  return typeof raw === "number" && Number.isFinite(raw) ? Math.max(0, Math.floor(raw)) : 0;
}

async function writeBalance(
  client: SupabaseClient,
  userId: string,
  expected: number,
  next: number,
): Promise<boolean> {
  const { data, error } = await client
    .from("profiles")
    .update({ credit_balance: next })
    .eq("id", userId)
    .eq("credit_balance", expected)
    .select("id")
    .maybeSingle();
  if (error) throw new Error(error.message);
  return Boolean(data);
}

async function insertLedger(
  client: SupabaseClient,
  row: {
    user_id: string;
    entry_kind: CreditLedgerEntry["entryKind"];
    amount: number;
    balance_after: number;
    reason: string;
    flow_kind?: string | null;
    stripe_checkout_session_id?: string | null;
  },
): Promise<CreditLedgerEntry> {
  const { data, error } = await client
    .from(LEDGER_TABLE)
    .insert(row)
    .select(
      "id, user_id, entry_kind, amount, balance_after, reason, flow_kind, stripe_checkout_session_id, created_at",
    )
    .single();
  if (error || !data) throw new Error(error?.message || "Failed to write credit ledger");
  return mapRow(data as LedgerRow);
}

export function createSupabaseCreditStore(client: SupabaseClient): CreditStore {
  return {
    async load(userId: string) {
      const balance = await readBalance(client, userId);
      const { data, error } = await client
        .from(LEDGER_TABLE)
        .select(
          "id, user_id, entry_kind, amount, balance_after, reason, flow_kind, stripe_checkout_session_id, created_at",
        )
        .eq("user_id", userId)
        .order("created_at", { ascending: true });
      if (error) throw new Error(error.message);
      return {
        userId,
        balance,
        entries: ((data || []) as LedgerRow[]).map(mapRow),
      };
    },
    async commitGrant(input): Promise<GrantCommitResult> {
      if (input.idempotencyKey) {
        const { data: existing } = await client
          .from(LEDGER_TABLE)
          .select(
            "id, user_id, entry_kind, amount, balance_after, reason, flow_kind, stripe_checkout_session_id, created_at",
          )
          .eq("user_id", input.userId)
          .eq("reason", input.idempotencyKey)
          .maybeSingle();
        if (existing) {
          const balance = await readBalance(client, input.userId);
          return {
            ok: true,
            balanceAfter: balance,
            entry: mapRow(existing as LedgerRow),
            applied: false,
          };
        }
      }
      for (let attempt = 0; attempt < 5; attempt += 1) {
        const current = await readBalance(client, input.userId);
        const granted = applyGrant(current, input.amount);
        const moved = await writeBalance(client, input.userId, current, granted.balanceAfter);
        if (!moved) continue;
        const entry = await insertLedger(client, {
          user_id: input.userId,
          entry_kind: input.entryKind ?? "grant",
          amount: granted.amount,
          balance_after: granted.balanceAfter,
          reason: input.reason,
          stripe_checkout_session_id: input.stripeCheckoutSessionId ?? null,
        });
        return { ok: true, balanceAfter: granted.balanceAfter, entry, applied: true };
      }
      throw new Error("Failed to grant credits");
    },
    async commitDebit(input): Promise<DebitCommitResult> {
      for (let attempt = 0; attempt < 5; attempt += 1) {
        const current = await readBalance(client, input.userId);
        const debited = applyDebit(current, input.amount);
        if (!debited.ok) return debited;
        const moved = await writeBalance(client, input.userId, current, debited.balanceAfter);
        if (!moved) continue;
        const entry = await insertLedger(client, {
          user_id: input.userId,
          entry_kind: "debit",
          amount: -debited.amount,
          balance_after: debited.balanceAfter,
          reason: input.reason,
          flow_kind: input.flowKind ?? null,
        });
        return { ok: true, balanceAfter: debited.balanceAfter, entry };
      }
      const current = await readBalance(client, input.userId);
      return applyDebit(current, input.amount) as DebitCommitResult;
    },
  };
}
