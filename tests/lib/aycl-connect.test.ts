/**
 * AYCL Stripe Connect: disconnected authors cannot complete a payout-bearing
 * sale; a connected account is attached to checkout so funds can go to the author.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  attachAyclConnectPaymentIntent,
  authorCanReceiveAyclPayouts,
  canCompletePayoutBearingAyclSale,
  resolveAyclPayoutCheckout,
} from "@/lib/credits/aycl-connect";

const ROOT = join(__dirname, "../..");

describe("AYCL Stripe Connect helpers", () => {
  it("refuses a payout-bearing sale when the author is disconnected", () => {
    const author = { accountId: null, chargesEnabled: false };
    expect(canCompletePayoutBearingAyclSale(author)).toBe(false);
    expect(authorCanReceiveAyclPayouts(author)).toBe(false);
    const blocked = resolveAyclPayoutCheckout({
      author,
      amountCents: 1999,
      payoutRequired: true,
    });
    expect(blocked.ok).toBe(false);
    if (blocked.ok) return;
    expect(blocked.code).toBe("connect_required");
  });

  it("attaches the connected account on AYCL checkout so funds can go to the author", () => {
    const author = { accountId: "acct_author_1", chargesEnabled: true };
    expect(canCompletePayoutBearingAyclSale(author)).toBe(true);
    const attached = resolveAyclPayoutCheckout({
      author,
      amountCents: 1999,
      payoutRequired: true,
    });
    expect(attached.ok).toBe(true);
    if (!attached.ok) return;
    expect(attached.connectedAccountId).toBe("acct_author_1");
    expect(attached.paymentIntentData?.transfer_data.destination).toBe("acct_author_1");
    expect(attached.paymentIntentData?.application_fee_amount).toBeGreaterThan(0);
    const merged = attachAyclConnectPaymentIntent({
      existing: { metadata: { price_type: "all_you_can_learn" } },
      attachment: attached.paymentIntentData,
    });
    expect(merged.transfer_data).toEqual({ destination: "acct_author_1" });
    expect(merged.application_fee_amount).toBe(attached.platformFeeCents);
  });

  it("wires Connect helpers into AYCL checkout", () => {
    const src = readFileSync(join(ROOT, "app/api/stripe/create-checkout/route.ts"), "utf8");
    expect(src).toContain("resolveAyclPayoutCheckout");
    expect(src).toContain("attachAyclConnectPaymentIntent");
    expect(src).toContain("stripe_connect_account_id");
  });

  it("exposes Connect onboarding for map authors", () => {
    const onboard = readFileSync(join(ROOT, "app/api/stripe/connect/onboard/route.ts"), "utf8");
    const panel = readFileSync(join(ROOT, "components/dashboard/stripe-connect-panel.tsx"), "utf8");
    expect(onboard).toContain("accountLinks.create");
    expect(onboard).toContain("tab=shop");
    expect(panel).toContain("data-aycl-stripe-connect");
  });
});
