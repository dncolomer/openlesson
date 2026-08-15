import { beforeEach, describe, expect, it, vi } from "vitest";

const getUser = vi.fn();
const from = vi.fn();
const adminFrom = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser },
    from,
  })),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => ({
    from: adminFrom,
  })),
}));

vi.mock("@/lib/aycl-session-auth", () => ({
  resolveAyclAccess: vi.fn(),
  resolveAyclSessionAccess: vi.fn(),
}));

import {
  classifyApiErrorEnvelope,
  errorMessageFromBody,
} from "@/lib/api-error-envelope";
import { hasProductAccess } from "@/lib/plans";
import { requireProductAccess } from "@/lib/api/product-access";
import {
  guardSessionRoute,
  requireSessionOwnership,
} from "@/lib/api/require-auth";

describe("product access + ownership helpers", () => {
  beforeEach(() => {
    getUser.mockReset();
    from.mockReset();
    adminFrom.mockReset();
  });

  it("hasProductAccess allows admin and rejects inactive without org", () => {
    expect(
      hasProductAccess({
        is_admin: true,
        plan: "inactive",
        subscription_status: "inactive",
        organization_id: null,
        token_tier: null,
        token_validity_expires_at: null,
        current_period_end: null,
      })
    ).toBe(true);

    expect(
      hasProductAccess({
        is_admin: false,
        plan: "inactive",
        subscription_status: "inactive",
        organization_id: null,
        token_tier: null,
        token_validity_expires_at: null,
        current_period_end: null,
      })
    ).toBe(false);
  });

  it("requireProductAccess rejects users without entitlement", async () => {
    const single = vi.fn().mockResolvedValue({
      data: {
        plan: "inactive",
        subscription_status: "inactive",
        is_admin: false,
        organization_id: null,
        token_tier: null,
        token_validity_expires_at: null,
        current_period_end: null,
      },
      error: null,
    });
    from.mockReturnValue({
      select: () => ({
        eq: () => ({ single }),
      }),
    });

    const result = await requireProductAccess(
      { from } as never,
      { id: "user-1" } as never
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.response.status).toBe(403);
    const body = await result.response.json();
    expect(classifyApiErrorEnvelope(body)).toBe("nested_code");
    expect(errorMessageFromBody(body, "")).toBe("Active subscription required");
    expect((body as { error?: { code?: string } }).error?.code).toBe(
      "product_access_required",
    );
  });

  it("requireProductAccess allows admins", async () => {
    const single = vi.fn().mockResolvedValue({
      data: {
        plan: "inactive",
        subscription_status: "inactive",
        is_admin: true,
        organization_id: null,
        token_tier: null,
        token_validity_expires_at: null,
        current_period_end: null,
      },
      error: null,
    });
    from.mockReturnValue({
      select: () => ({
        eq: () => ({ single }),
      }),
    });
    adminFrom.mockReturnValue({
      update: () => ({
        eq: () => ({
          eq: () => Promise.resolve({ error: null }),
        }),
      }),
    });

    const result = await requireProductAccess(
      { from } as never,
      { id: "admin-1" } as never
    );
    expect(result.ok).toBe(true);
  });

  it("requireSessionOwnership returns Session not found (not Block)", async () => {
    const single = vi.fn().mockResolvedValue({ data: null, error: { message: "missing" } });
    from.mockReturnValue({
      select: () => ({
        eq: () => ({ single }),
      }),
    });
    const res = await requireSessionOwnership({ from } as never, "user-1", "sess-1");
    expect(res?.status).toBe(404);
    const body = await res?.json();
    expect(classifyApiErrorEnvelope(body)).toBe("nested_code");
    expect(errorMessageFromBody(body, "")).toBe("Session not found");
  });

  it("guardSessionRoute requires sessionId when configured", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
    const result = await guardSessionRoute(null, { requireSessionId: true, requireProductAccess: false });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.response.status).toBe(400);
  });
});
