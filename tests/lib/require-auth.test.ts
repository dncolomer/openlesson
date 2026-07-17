import { beforeEach, describe, expect, it, vi } from "vitest";

const getUser = vi.fn();
const from = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser },
    from,
  })),
}));

vi.mock("@/lib/aycl-session-auth", () => ({
  resolveAyclAccess: vi.fn(),
  resolveAyclSessionAccess: vi.fn(),
}));

import {
  ayclTokenFromBody,
  guardSessionRoute,
  guardWorkspaceRoute,
  requireAuthenticatedUser,
  requireSessionOwnership,
} from "@/lib/api/require-auth";

describe("require-auth helpers", () => {
  beforeEach(() => {
    getUser.mockReset();
    from.mockReset();
  });

  it("ayclTokenFromBody accepts camel or snake case tokens", () => {
    expect(ayclTokenFromBody({ ayclToken: " abc " })).toBe("abc");
    expect(ayclTokenFromBody({ aycl_token: "xyz" })).toBe("xyz");
    expect(ayclTokenFromBody({})).toBeNull();
  });

  it("requireAuthenticatedUser returns 401 when no user", async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: null });
    const result = await requireAuthenticatedUser();
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.response.status).toBe(401);
    const body = await result.response.json();
    expect(body.error).toBe("Not authenticated");
  });

  it("requireAuthenticatedUser returns user + supabase when authenticated", async () => {
    const user = { id: "user-1", email: "a@b.com" };
    getUser.mockResolvedValue({ data: { user }, error: null });
    const result = await requireAuthenticatedUser();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.user).toEqual(user);
    expect(result.supabase).toBeTruthy();
  });

  it("requireSessionOwnership returns 404 when session missing", async () => {
    const single = vi.fn().mockResolvedValue({ data: null, error: { message: "missing" } });
    from.mockReturnValue({
      select: () => ({
        eq: () => ({ single }),
      }),
    });
    const supabase = { from } as never;
    const res = await requireSessionOwnership(supabase, "user-1", "sess-1");
    expect(res?.status).toBe(404);
    expect(await res?.json()).toEqual({ error: "Session not found" });
  });

  it("requireSessionOwnership returns 403 when owned by another user", async () => {
    const single = vi
      .fn()
      .mockResolvedValue({ data: { id: "sess-1", user_id: "other" }, error: null });
    from.mockReturnValue({
      select: () => ({
        eq: () => ({ single }),
      }),
    });
    const supabase = { from } as never;
    const res = await requireSessionOwnership(supabase, "user-1", "sess-1");
    expect(res?.status).toBe(403);
  });

  it("requireSessionOwnership returns null when user owns session", async () => {
    const single = vi
      .fn()
      .mockResolvedValue({ data: { id: "sess-1", user_id: "user-1" }, error: null });
    from.mockReturnValue({
      select: () => ({
        eq: () => ({ single }),
      }),
    });
    const supabase = { from } as never;
    const res = await requireSessionOwnership(supabase, "user-1", "sess-1");
    expect(res).toBeNull();
  });

  it("guardWorkspaceRoute requires workspaceId", async () => {
    const result = await guardWorkspaceRoute("   ");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.response.status).toBe(400);
  });

  it("guardWorkspaceRoute forbids non-owners", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
    const single = vi
      .fn()
      .mockResolvedValue({ data: { id: "ws-1", user_id: "other" }, error: null });
    from.mockReturnValue({
      select: () => ({
        eq: () => ({ single }),
      }),
    });
    const result = await guardWorkspaceRoute("ws-1");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.response.status).toBe(403);
  });

  it("guardSessionRoute requires auth when no session id", async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: null });
    const result = await guardSessionRoute(undefined, { requireProductAccess: false });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.response.status).toBe(401);
  });

  it("guardWorkspaceRoute skips product access when disabled", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
    const single = vi
      .fn()
      .mockResolvedValue({ data: { id: "ws-1", user_id: "user-1" }, error: null });
    from.mockReturnValue({
      select: () => ({
        eq: () => ({ single }),
      }),
    });
    const result = await guardWorkspaceRoute("ws-1", { requireProductAccess: false });
    expect(result.ok).toBe(true);
  });
});
