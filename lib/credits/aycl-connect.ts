/**
 * Stripe Connect attachment for AYCL Shop payouts.
 * Pure helpers: tests drive these without a live Stripe network call.
 */

export const AYCL_PLATFORM_FEE_BPS = 1500;

export type AyclAuthorConnectStatus = {
  accountId: string | null;
  chargesEnabled: boolean;
};

export type AyclPayoutCheckoutInput = {
  author: AyclAuthorConnectStatus;
  amountCents: number;
  /** When true, the sale must pay the author (connected account required). */
  payoutRequired: boolean;
};

export type AyclCheckoutPaymentIntentData = {
  application_fee_amount: number;
  transfer_data: { destination: string };
};

export type AyclPayoutCheckoutOk = {
  ok: true;
  connectedAccountId: string | null;
  paymentIntentData: AyclCheckoutPaymentIntentData | null;
  platformFeeCents: number;
};

export type AyclPayoutCheckoutBlocked = {
  ok: false;
  code: "connect_required";
  reason: string;
};

export function ayclPlatformFeeCents(amountCents: number, bps: number = AYCL_PLATFORM_FEE_BPS): number {
  const amount = Math.max(0, Math.floor(amountCents));
  return Math.floor((amount * bps) / 10_000);
}

export function authorCanReceiveAyclPayouts(author: AyclAuthorConnectStatus): boolean {
  return Boolean(author.accountId && author.chargesEnabled);
}

export function canCompletePayoutBearingAyclSale(author: AyclAuthorConnectStatus): boolean {
  return authorCanReceiveAyclPayouts(author);
}

export function resolveAyclPayoutCheckout(
  input: AyclPayoutCheckoutInput,
): AyclPayoutCheckoutOk | AyclPayoutCheckoutBlocked {
  const amountCents = Math.max(0, Math.floor(input.amountCents));
  const fee = ayclPlatformFeeCents(amountCents);

  if (input.payoutRequired && !authorCanReceiveAyclPayouts(input.author)) {
    return {
      ok: false,
      code: "connect_required",
      reason: "Connect a Stripe account to receive payouts from All You Can Learn sales.",
    };
  }

  if (!authorCanReceiveAyclPayouts(input.author) || !input.author.accountId) {
    return {
      ok: true,
      connectedAccountId: null,
      paymentIntentData: null,
      platformFeeCents: 0,
    };
  }

  return {
    ok: true,
    connectedAccountId: input.author.accountId,
    paymentIntentData: {
      application_fee_amount: fee,
      transfer_data: { destination: input.author.accountId },
    },
    platformFeeCents: fee,
  };
}

/** Merge Connect destination onto existing Checkout payment_intent_data. */
export function attachAyclConnectPaymentIntent(params: {
  existing?: Record<string, unknown>;
  attachment: AyclCheckoutPaymentIntentData | null;
}): Record<string, unknown> {
  const base = { ...(params.existing || {}) };
  if (!params.attachment) return base;
  return {
    ...base,
    application_fee_amount: params.attachment.application_fee_amount,
    transfer_data: params.attachment.transfer_data,
  };
}

export function presentConnectStatus(author: AyclAuthorConnectStatus): {
  connected: boolean;
  chargesEnabled: boolean;
  accountId: string | null;
} {
  return {
    connected: Boolean(author.accountId),
    chargesEnabled: author.chargesEnabled,
    accountId: author.accountId,
  };
}
