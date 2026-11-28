import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { mockGetUser, mockCheckoutCreate } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockCheckoutCreate: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: mockGetUser },
    from: () => ({
      select: () => ({
        eq: () => ({
          single: async () => ({ data: { stripe_customer_id: "cus_existing" } }),
        }),
      }),
      update: () => ({ eq: async () => ({ error: null }) }),
    }),
  })),
}));

vi.mock("@/lib/stripe/client", () => ({
  getStripe: () => ({
    customers: { retrieve: vi.fn(async () => ({ id: "cus_existing" })) },
    checkout: { sessions: { create: mockCheckoutCreate } },
  }),
}));

import { POST } from "@/app/api/stripe/create-checkout/route";

describe("POST /api/stripe/create-checkout", () => {
  beforeEach(() => {
    mockGetUser.mockReset();
    mockCheckoutCreate.mockReset();
  });

  it("returns 400 on invalid JSON body", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const req = new NextRequest("http://localhost/api/stripe/create-checkout", {
      method: "POST",
      body: "{bad",
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 on unsupported priceType", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const req = new NextRequest("http://localhost/api/stripe/create-checkout", {
      method: "POST",
      body: JSON.stringify({ priceType: "invalid_sku" }),
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.message).toBe("Invalid price type");
  });

  it("creates a Stripe Checkout session for api_metered", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-1", email: "user@example.com" } },
    });
    mockCheckoutCreate.mockResolvedValue({ url: "https://checkout.stripe.com/c/pay/cs_test" });

    const req = new NextRequest("http://localhost/api/stripe/create-checkout", {
      method: "POST",
      body: JSON.stringify({ priceType: "api_metered" }),
      headers: {
        "content-type": "application/json",
        origin: "https://uncertain.systems",
      },
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ url: "https://checkout.stripe.com/c/pay/cs_test" });
    expect(mockCheckoutCreate).toHaveBeenCalledTimes(1);
  });
});
