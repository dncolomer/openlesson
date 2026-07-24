import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getUser = vi.fn();
const single = vi.fn();
const maybeSingle = vi.fn();
const eqChain: {
  single: typeof single;
  maybeSingle: typeof maybeSingle;
  eq: (...args: unknown[]) => typeof eqChain;
} = {
  single,
  maybeSingle,
  eq: (..._args: unknown[]) => eqChain,
};
const eq = vi.fn(() => eqChain);
const select = vi.fn(() => ({ eq }));
const from = vi.fn(() => ({ select }));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser },
  })),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => ({
    from,
  })),
}));

const getTapScoreBrief = vi.fn();
const getTapScoreBriefForUser = vi.fn();

vi.mock("@/lib/tap-score", () => ({
  hashPrivateToken: (t: string) => `hash:${t}`,
  getTapScoreBrief: (...args: unknown[]) => getTapScoreBrief(...args),
  getTapScoreBriefForUser: (...args: unknown[]) => getTapScoreBriefForUser(...args),
}));

import {
  loadTapScoreBriefForAccess,
  participantAuthFromSession,
  resolveTapSessionAccess,
  selectTapBriefUserId,
  TAP_SESSION_SELECT,
  workspaceOwnerFromSession,
} from "@/lib/tap-score-session-auth";
import { hashPrivateToken } from "@/lib/tap-score";

describe("TAP session auth brief vs participant", () => {
  beforeEach(() => {
    getUser.mockReset();
    single.mockReset();
    maybeSingle.mockReset();
    from.mockClear();
    select.mockClear();
    eq.mockClear();
    getTapScoreBrief.mockReset();
    getTapScoreBriefForUser.mockReset();
  });

  it("TAP_SESSION_SELECT loads focus_block_ids and started_at for private-token restore", () => {
    expect(TAP_SESSION_SELECT).toContain("focus_block_ids");
    expect(TAP_SESSION_SELECT).toContain("started_at");
  });

  it("workspaceOwnerFromSession prefers session.user_id then nested workspace owner", () => {
    expect(
      workspaceOwnerFromSession({
        user_id: "owner-1",
        workspaces: { user_id: "ws-owner" },
      })
    ).toBe("owner-1");

    expect(
      workspaceOwnerFromSession({
        user_id: null,
        workspaces: { user_id: "ws-owner" },
      })
    ).toBe("ws-owner");

    expect(
      workspaceOwnerFromSession({
        user_id: null,
        workspaces: [{ user_id: "ws-owner-arr" }],
      })
    ).toBe("ws-owner-arr");
  });

  it("participantAuthFromSession keeps guest/assigned for PoW without replacing owner", () => {
    expect(
      participantAuthFromSession({
        user_id: "owner-1",
        guest_user_id: "guest-9",
        assigned_user_id: null,
        workspaces: { user_id: "owner-1" },
      })
    ).toEqual({
      userId: null,
      guestUserId: "guest-9",
      assignedUserId: null,
    });

    expect(
      participantAuthFromSession({
        user_id: "owner-1",
        guest_user_id: null,
        assigned_user_id: "assignee-2",
        workspaces: { user_id: "owner-1" },
      })
    ).toEqual({
      userId: "assignee-2",
      guestUserId: null,
      assignedUserId: "assignee-2",
    });
  });

  it("selectTapBriefUserId always prefers workspace owner over participant", () => {
    expect(
      selectTapBriefUserId({
        workspaceOwnerUserId: "owner-1",
        userId: null,
      })
    ).toBe("owner-1");

    expect(
      selectTapBriefUserId({
        workspaceOwnerUserId: "owner-1",
        userId: "assignee-2",
      })
    ).toBe("owner-1");

    // Cookie-auth path may only have userId
    expect(
      selectTapBriefUserId({
        workspaceOwnerUserId: null,
        userId: "cookie-user",
      })
    ).toBe("cookie-user");
  });

  it("resolveTapSessionAccess privateToken guest: owner for brief, guest for PoW, no cookie required", async () => {
    // No signed-in user (anonymous private link)
    getUser.mockResolvedValue({ data: { user: null }, error: null });

    const guestSession = {
      id: "tap-sess-1",
      workspace_id: "ws-1",
      user_id: "owner-1",
      guest_user_id: "guest-abc",
      assigned_user_id: null,
      organization_id: "org-1",
      block_id: "block-1",
      session_id: "focus-sess",
      status: "pending",
      started_at: null,
      requested_duration_seconds: 900,
      focus_block_ids: ["block-a", "block-b"],
      post_session: "show_results",
      redirect_url: null,
      completion_webhook_url: null,
      workspaces: { user_id: "owner-1" },
    };

    maybeSingle.mockResolvedValue({ data: guestSession, error: null });
    single.mockResolvedValue({ data: guestSession, error: null });

    const access = await resolveTapSessionAccess({
      privateToken: "secret-guest-token",
    });

    expect("error" in access).toBe(false);
    if ("error" in access) return;

    // Guest PoW attribution
    expect(access.userId).toBeNull();
    expect(access.guestUserId).toBe("guest-abc");
    // Brief must use workspace owner without requiring cookie auth
    expect(access.workspaceOwnerUserId).toBe("owner-1");
    expect(selectTapBriefUserId(access)).toBe("owner-1");

    // Focus restore fields present on existingSession
    expect(access.existingSession).toMatchObject({
      focus_block_ids: ["block-a", "block-b"],
      started_at: null,
      status: "pending",
    });

    // Lookup used hashed token path
    expect(from).toHaveBeenCalledWith("workspace_tap_sessions");
    expect(hashPrivateToken("secret-guest-token")).toBe("hash:secret-guest-token");
  });

  it("resolveTapSessionAccess privateToken assigned: owner for brief, assignee for PoW after sign-in", async () => {
    getUser.mockResolvedValue({
      data: { user: { id: "assignee-2" } },
      error: null,
    });

    const assignedSession = {
      id: "tap-sess-2",
      workspace_id: "ws-2",
      user_id: "owner-1",
      guest_user_id: null,
      assigned_user_id: "assignee-2",
      organization_id: null,
      block_id: null,
      session_id: null,
      status: "in_progress",
      started_at: "2026-01-01T00:00:00.000Z",
      requested_duration_seconds: 600,
      focus_block_ids: ["n1"],
      post_session: "redirect_workspace",
      redirect_url: null,
      completion_webhook_url: null,
      workspaces: { user_id: "owner-1" },
    };

    maybeSingle.mockResolvedValue({ data: assignedSession, error: null });
    single.mockResolvedValue({ data: assignedSession, error: null });

    const access = await resolveTapSessionAccess({
      privateToken: "secret-assigned-token",
    });

    expect("error" in access).toBe(false);
    if ("error" in access) return;

    expect(access.userId).toBe("assignee-2");
    expect(access.assignedUserId).toBe("assignee-2");
    expect(access.workspaceOwnerUserId).toBe("owner-1");
    expect(selectTapBriefUserId(access)).toBe("owner-1");
    expect(access.existingSession).toMatchObject({
      focus_block_ids: ["n1"],
      started_at: "2026-01-01T00:00:00.000Z",
    });
  });

  it("loadTapScoreBriefForAccess passes workspace owner (not guest/assignee) to getTapScoreBriefForUser", async () => {
    getTapScoreBriefForUser.mockResolvedValue({ brief: { plan: { id: "ws-1" } } });

    // Guest private-link access shape (as returned by resolveTapSessionAccess)
    const guestAccess = {
      workspaceId: "ws-1",
      workspaceOwnerUserId: "owner-1",
      userId: null as string | null,
    };
    await loadTapScoreBriefForAccess(guestAccess, ["block-a"], "focus-1");
    expect(getTapScoreBriefForUser).toHaveBeenCalledWith(
      "ws-1",
      "owner-1",
      ["block-a"],
      true,
      "focus-1"
    );
    expect(getTapScoreBrief).not.toHaveBeenCalled();

    getTapScoreBriefForUser.mockClear();
    const assignedAccess = {
      workspaceId: "ws-2",
      workspaceOwnerUserId: "owner-1",
      userId: "assignee-2",
    };
    await loadTapScoreBriefForAccess(assignedAccess, [], null);
    expect(getTapScoreBriefForUser).toHaveBeenCalledWith(
      "ws-2",
      "owner-1", // not assignee-2
      [],
      true,
      null
    );
  });

  it("chat/start/topics routes load brief via loadTapScoreBriefForAccess (not access.userId)", () => {
    const root = process.cwd();
    const routes = [
      "app/api/workspace-tap-score/chat/route.ts",
      "app/api/workspace-tap-score/start/route.ts",
      "app/api/workspace-tap-score/topics/route.ts",
    ];

    for (const rel of routes) {
      const src = readFileSync(join(root, rel), "utf8");
      expect(src, rel).toContain("loadTapScoreBriefForAccess");
      // Must not pass participant userId into ownership-gated brief loader.
      expect(src, rel).not.toMatch(
        /getTapScoreBriefForUser\(\s*access\.workspaceId,\s*access\.userId/
      );
      expect(src, rel).not.toMatch(
        /access\.userId\s*\?\s*await getTapScoreBriefForUser/
      );
    }
  });
});
