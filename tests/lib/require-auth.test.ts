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

vi.mock("@/lib/solve-session-auth", () => ({
  resolveSolveFlowAccess: vi.fn(),
  resolveSolveSessionAccess: vi.fn(),
}));

import {
  classifyApiErrorEnvelope,
  errorMessageFromBody,
} from "@/lib/api-error-envelope";
import {
  ayclTokenFromBody,
  guardSessionRoute,
  guardWorkspaceRoute,
  requireAuthenticatedUser,
  requireSessionOwnership,
  sessionGuestTokensFromBody,
  solveTokenFromBody,
} from "@/lib/api/require-auth";
import { resolveSolveSessionAccess } from "@/lib/solve-session-auth";

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

  it("solveTokenFromBody and sessionGuestTokensFromBody read public Solve tokens", () => {
    expect(solveTokenFromBody({ solveToken: " stok " })).toBe("stok");
    expect(solveTokenFromBody({ solve_token: "snake" })).toBe("snake");
    expect(sessionGuestTokensFromBody({ solveToken: "stok" })).toEqual({
      ayclToken: null,
      ileToken: null,
      solveToken: "stok",
    });
  });

  it("requireAuthenticatedUser returns 401 when no user", async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: null });
    const result = await requireAuthenticatedUser();
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.response.status).toBe(401);
    const body = await result.response.json();
    expect(classifyApiErrorEnvelope(body)).toBe("nested_code");
    expect(errorMessageFromBody(body, "")).toBe("Not authenticated");
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
    const body = await res?.json();
    expect(classifyApiErrorEnvelope(body)).toBe("nested_code");
    expect(errorMessageFromBody(body, "")).toBe("Session not found");
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
    const body = await result.response.json();
    expect(classifyApiErrorEnvelope(body)).toBe("nested_code");
    expect(errorMessageFromBody(body, "")).toBe("workspaceId is required");
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
    const body = await result.response.json();
    expect(classifyApiErrorEnvelope(body)).toBe("nested_code");
    expect(errorMessageFromBody(body, "")).toBe("Forbidden");
  });

  it("guardSessionRoute requires auth when no session id", async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: null });
    const result = await guardSessionRoute(undefined, { requireProductAccess: false });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.response.status).toBe(401);
  });

  it("guardSessionRoute accepts solveToken guests without cookie auth", async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: null });
    vi.mocked(resolveSolveSessionAccess).mockResolvedValue({
      supabase: { from } as never,
      flow: { id: "sf1", ownerUserId: "owner-1" } as never,
      session: {
        id: "sess-1",
        kind: "solve",
        solve_flow_id: "sf1",
        identity: "ada",
      },
      ownerUserId: "owner-1",
      runOwnerUserId: "owner-1",
      workspaceId: "ws-1",
      identity: "ada",
    });
    const result = await guardSessionRoute("sess-1", { solveToken: "stok" });
    expect(resolveSolveSessionAccess).toHaveBeenCalledWith("stok", "sess-1");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.principal.kind).toBe("solve_guest");
    expect(result.subjectId).toBe("ada");
    expect(result.persistUserId).toBe("owner-1");
    expect(getUser).not.toHaveBeenCalled();
  });

  it("guardSessionRoute requires sessionId when solveToken is set", async () => {
    const result = await guardSessionRoute(undefined, { solveToken: "stok" });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.response.status).toBe(400);
    expect(getUser).not.toHaveBeenCalled();
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
