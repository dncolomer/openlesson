import { describe, expect, it } from "vitest";
import {
  checkoutModeForPriceType,
  extraLessonsForCheckout,
  planIdFromPriceType,
  profileUpdateFromCheckout,
} from "@/lib/stripe-checkout";
import { TRIAL_ACCESS_DAYS } from "@/lib/plans";

describe("stripe checkout helpers", () => {
  it("maps price types to plan ids", () => {
    expect(planIdFromPriceType("trial_3day")).toBe("trial");
    expect(planIdFromPriceType("regular_2026")).toBe("regular_2026");
    expect(planIdFromPriceType("api_metered")).toBe("api_metered");
  });

  it("uses payment mode for trial checkout", () => {
    expect(checkoutModeForPriceType("trial_3day")).toBe("payment");
    expect(checkoutModeForPriceType("all_you_can_learn")).toBe("payment");
    expect(checkoutModeForPriceType("regular_2026")).toBe("subscription");
  });

  it("builds a trial profile patch with a 3-day window", () => {
    const patch = profileUpdateFromCheckout({
      priceType: "trial_3day",
      monthlyVolume: 0,
      stripeCustomerId: "cus_123",
      stripeSubscriptionId: null,
      currentPeriodEnd: new Date(Date.now() + TRIAL_ACCESS_DAYS * 86400000).toISOString(),
    });
    expect(patch.plan).toBe("trial");
    expect(patch.subscription_status).toBe("active");
    expect(patch.extra_lessons).toBe(0);
    expect(patch.stripe_customer_id).toBe("cus_123");
  });

  it("computes extra proof-of-work for volume tiers", () => {
    expect(extraLessonsForCheckout("regular_2026", 250, "regular_2026")).toBe(150);
    expect(extraLessonsForCheckout("trial_3day", 0, "trial")).toBe(0);
  });
});