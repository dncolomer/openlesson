import { describe, expect, it } from "vitest";
import {
  AYCL_FULL_PRICE_CENTS,
  AYCL_PRICE_CENTS,
  AYCL_PRICE_LABEL,
  buildAyclAccessUrl,
} from "@/lib/aycl-shared";
import { checkoutModeForPriceType } from "@/lib/stripe-checkout";

describe("All-You-Can-Learn helpers", () => {
  it("legacy price aliases match full pack ($19.99)", () => {
    expect(AYCL_PRICE_CENTS).toBe(1999);
    expect(AYCL_PRICE_CENTS).toBe(AYCL_FULL_PRICE_CENTS);
    expect(AYCL_PRICE_LABEL).toBe("$19.99");
  });

  it("builds lifetime access URLs", () => {
    expect(buildAyclAccessUrl("https://uncertain.systems", "abc123")).toBe(
      "https://uncertain.systems/learn/abc123"
    );
  });

  it("uses payment mode for AYCL checkout", () => {
    expect(checkoutModeForPriceType("all_you_can_learn")).toBe("payment");
  });
});