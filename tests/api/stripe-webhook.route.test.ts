import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { mockConstructEvent, mockCancelOrgBilling } = vi.hoisted(() => ({
  mockConstructEvent: vi.fn(),
  mockCancelOrgBilling: vi.fn(),
}));

vi.mock("@/lib/stripe/client", () => ({
  getStripe: () => ({
    webhooks: { constructEvent: mockConstructEvent },
    subscriptions: { retrieve: vi.fn(), cancel: vi.fn() },
    invoiceItems: { create: vi.fn() },
  }),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ from: vi.fn() }),
}));

vi.mock("@/lib/organization/apply-org-billing", () => ({
  applyBillingToUserOrganization: vi.fn(),
  cancelOrgBillingForUser: mockCancelOrgBilling,
}));

import { POST } from "@/app/api/stripe/webhook/route";

describe("POST /api/stripe/webhook", () => {
  const prevSecret = process.env.STRIPE_WEBHOOK_SECRET;

  beforeEach(() => {
    mockConstructEvent.mockReset();
    mockCancelOrgBilling.mockReset();
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_test_123";
  });

  afterEach(() => {
    if (prevSecret === undefined) delete process.env.STRIPE_WEBHOOK_SECRET;
    else process.env.STRIPE_WEBHOOK_SECRET = prevSecret;
  });

  it("returns 400 when stripe-signature header is missing", async () => {
    const req = new NextRequest("http://localhost/api/stripe/webhook", {
      method: "POST",
      body: "{}",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 500 when STRIPE_WEBHOOK_SECRET is not configured", async () => {
    delete process.env.STRIPE_WEBHOOK_SECRET;
    const req = new NextRequest("http://localhost/api/stripe/webhook", {
      method: "POST",
      body: "{}",
      headers: { "stripe-signature": "t=1,v1=abc" },
    });
    const res = await POST(req);
    expect(res.status).toBe(500);
  });

  it("returns 400 when signature verification fails", async () => {
    mockConstructEvent.mockImplementation(() => {
      throw new Error("Invalid signature");
    });
    const req = new NextRequest("http://localhost/api/stripe/webhook", {
      method: "POST",
      body: "{}",
      headers: { "stripe-signature": "t=1,v1=bad" },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("cancels org billing on customer.subscription.deleted", async () => {
    mockConstructEvent.mockReturnValue({
      type: "customer.subscription.deleted",
      data: {
        object: {
          id: "sub_123",
          metadata: { supabase_user_id: "user-42" },
        },
      },
    });
    const req = new NextRequest("http://localhost/api/stripe/webhook", {
      method: "POST",
      body: "{}",
      headers: { "stripe-signature": "t=1,v1=good" },
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ received: true });
    expect(mockCancelOrgBilling).toHaveBeenCalledWith(expect.anything(), "user-42", "sub_123");
  });
});
