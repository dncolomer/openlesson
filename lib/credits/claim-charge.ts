import { createAdminClient } from "@/lib/supabase/admin";
import {
  chargeFlowSessionOrThrow,
  creditStoreFromClient,
  refundFlowSessionCredits,
} from "@/lib/credits/account";
import { billedUserIdForSession } from "@/lib/credits/ledger";
import type { FlowSessionKind } from "@/lib/credits/constants";

export async function debitClaimedFlowSession(input: {
  ownerUserId: string | null | undefined;
  runnerUserId: string | null | undefined;
  flowKind: FlowSessionKind;
}): Promise<{ billedUserId: string } | null> {
  const owner = String(input.ownerUserId || "").trim();
  const runner = String(input.runnerUserId || "").trim();
  const ownerUserId = owner || runner;
  if (!ownerUserId) return null;
  const billedUserId = billedUserIdForSession({
    runnerUserId: runner || null,
    ownerUserId,
  });
  await chargeFlowSessionOrThrow(createAdminClient(), {
    runnerUserId: runner || null,
    ownerUserId,
    flowKind: input.flowKind,
  });
  return { billedUserId };
}

export async function refundClaimedFlowSession(billedUserId: string | null | undefined) {
  const id = String(billedUserId || "").trim();
  if (!id) return;
  await refundFlowSessionCredits(creditStoreFromClient(createAdminClient()), id).catch(() => {});
}
