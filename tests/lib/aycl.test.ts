import { describe, expect, it } from "vitest";
import { AYCL_PRICE_CENTS, AYCL_PRICE_LABEL, buildAyclAccessUrl } from "@/lib/aycl-shared";
import { checkoutModeForPriceType } from "@/lib/stripe-checkout";

describe("All-You-Can-Learn helpers", () => {
  it("uses the $19.99 one-time price", () => {
    expect(AYCL_PRICE_CENTS).toBe(1999);
    expect(AYCL_PRICE_LABEL).toBe("$19.99");
  });

  it("builds lifetime access URLs", () => {
    expect(buildAyclAccessUrl("https://openlesson.academy", "abc123")).toBe(
      "https://openlesson.academy/learn/abc123"
    );
  });

  it("uses payment mode for AYCL checkout", () => {
    expect(checkoutModeForPriceType("all_you_can_learn")).toBe("payment");
  });
});