import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetUser, mockMaybeSingle } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockMaybeSingle: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: mockGetUser },
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: mockMaybeSingle,
        }),
      }),
    }),
  })),
}));

import { GET } from "@/app/api/ai-provider/route";

describe("GET /api/ai-provider", () => {
  beforeEach(() => {
    mockGetUser.mockReset();
    mockMaybeSingle.mockReset();
  });

  it("returns 401 when unauthenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const res = await GET();
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error.message).toBe("Unauthorized");
  });

  it("returns 403 when authenticated user is not a platform admin", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    mockMaybeSingle.mockResolvedValue({ data: { is_admin: false } });
    const res = await GET();
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error.message).toBe("Forbidden");
  });

  it("returns 200 with provider info and availableModels for platform admins", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "admin-1" } } });
    mockMaybeSingle.mockResolvedValue({ data: { is_admin: true } });
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.provider).toBeTruthy();
    expect(Array.isArray(body.availableModels)).toBe(true);
  });
});
