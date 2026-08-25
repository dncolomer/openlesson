import { describe, expect, it } from "vitest";
import {
  checkoutModeForPriceType,
  extraLessonsForCheckout,
  isGuestCheckoutPriceType,
  planIdFromPriceType,
  profileUpdateFromCheckout,
} from "@/lib/stripe-checkout";
import { HARNESS_MONTHLY_PRICE_CENTS, TRIAL_ACCESS_DAYS, TRIAL_PRICE_CENTS } from "@/lib/plans";
import {
  harnessMonthlyCheckoutPriceData,
  harnessTrialCheckoutPriceData,
} from "@/lib/pricing/harness-checkout";

describe("stripe checkout helpers", () => {
  it("maps price types to plan ids (only trial + api_metered grant paid plans)", () => {
    expect(planIdFromPriceType("trial_3day")).toBe("trial");
    expect(planIdFromPriceType("api_metered")).toBe("api_metered");
    expect(planIdFromPriceType("regular_2026")).toBe("inactive");
    expect(planIdFromPriceType("pro_teams")).toBe("inactive");
    expect(planIdFromPriceType("regular")).toBe("inactive");
    expect(planIdFromPriceType("pro")).toBe("inactive");
  });

  it("uses payment mode for trial and subscription for api_metered", () => {
    expect(checkoutModeForPriceType("trial_3day")).toBe("payment");
    expect(checkoutModeForPriceType("all_you_can_learn")).toBe("payment");
    expect(checkoutModeForPriceType("api_metered")).toBe("subscription");
  });

  it("allows guest checkout for trial and api_metered only", () => {
    expect(isGuestCheckoutPriceType("trial_3day")).toBe(true);
    expect(isGuestCheckoutPriceType("api_metered")).toBe(true);
    expect(isGuestCheckoutPriceType("regular_2026")).toBe(false);
    expect(isGuestCheckoutPriceType("pro_teams")).toBe(false);
  });

  it("public harness checkout price_data is $24.99/mo and $14.99 trial", () => {
    expect(HARNESS_MONTHLY_PRICE_CENTS).toBe(2499);
    expect(TRIAL_PRICE_CENTS).toBe(1499);
    expect(harnessMonthlyCheckoutPriceData().unit_amount).toBe(2499);
    expect(harnessMonthlyCheckoutPriceData().recurring).toEqual({ interval: "month" });
    expect(harnessTrialCheckoutPriceData().unit_amount).toBe(1499);
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

  it("builds api_metered patch with zero volume overage", () => {
    const patch = profileUpdateFromCheckout({
      priceType: "api_metered",
      monthlyVolume: 999,
      stripeCustomerId: "cus_m",
      stripeSubscriptionId: "sub_m",
      currentPeriodEnd: "2099-01-01T00:00:00.000Z",
    });
    expect(patch.plan).toBe("api_metered");
    expect(patch.extra_lessons).toBe(0);
    expect(patch.subscription_status).toBe("active");
  });

  it("never computes volume-tier extra lessons for current checkouts", () => {
    expect(extraLessonsForCheckout("api_metered", 250, "api_metered")).toBe(0);
    expect(extraLessonsForCheckout("trial_3day", 0, "trial")).toBe(0);
  });
});
