/**
 * Guest link invalidation: drives shipped invalidate helpers + access gates.
 * No re-implementation of update rules — exercises real lib functions.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  GUEST_LINK_REVOKED_STATUS,
  ILE_LINK_REVOKED_MESSAGE,
  invalidateIleLinkOne,
  invalidateIleLinksAll,
  invalidateTapLinkOne,
  invalidateTapLinksAll,
  isGuestLinkRevoked,
  TAP_LINK_REVOKED_MESSAGE,
} from "@/lib/pow-api/invalidate-guest-links";
import type { AuthContext } from "@/lib/pow-api/types";

const ROOT = join(__dirname, "../..");
const WORKSPACE_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const LINK_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const OWNER_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

const ownerAuth: AuthContext = {
  user_id: OWNER_ID,
  guest_user_id: null,
  organization_id: null,
  is_org_admin: false,
  key_id: "web",
  scopes: ["tap:write", "workspaces:write"],
};

function read(rel: string) {
  const path = join(ROOT, rel);
  expect(existsSync(path), `missing ${rel}`).toBe(true);
  return readFileSync(path, "utf8");
}

type Call = {
  table: string;
  op: "select" | "update";
  filters: Array<{ method: string; args: unknown[] }>;
  payload?: Record<string, unknown>;
};

/**
 * Chainable supabase mock that records filters and returns configured rows.
 */
function createSupabaseMock(handlers: {
  workspaces?: Record<string, unknown> | null;
  tapLoad?: Record<string, unknown> | null;
  ileLoad?: Record<string, unknown> | null;
  tapUpdateOne?: Record<string, unknown> | null;
  ileUpdateOne?: Record<string, unknown> | null;
  tapUpdateAllPrivate?: { id: string }[];
  tapUpdateAllPublic?: { id: string }[];
  ileUpdateAll?: { id: string }[];
}) {
  const calls: Call[] = [];

  function chain(table: string, op: "select" | "update", payload?: Record<string, unknown>) {
    const call: Call = { table, op, filters: [], payload };
    calls.push(call);
    const api: Record<string, unknown> = {};
    const addFilter = (method: string) => (...args: unknown[]) => {
      call.filters.push({ method, args });
      return api;
    };
    api.eq = addFilter("eq");
    api.neq = addFilter("neq");
    api.not = addFilter("not");
    api.is = addFilter("is");
    api.select = (..._args: unknown[]) => api;
    api.maybeSingle = async () => {
      if (table === "workspaces") {
        return { data: handlers.workspaces ?? null, error: null };
      }
      if (table === "workspace_tap_sessions") {
        return { data: handlers.tapLoad ?? null, error: null };
      }
      if (table === "workspace_ile_links") {
        return { data: handlers.ileLoad ?? null, error: null };
      }
      return { data: null, error: null };
    };
    api.single = async () => {
      if (table === "workspace_tap_sessions" && op === "update") {
        return {
          data: handlers.tapUpdateOne ?? {
            id: LINK_ID,
            workspace_id: WORKSPACE_ID,
            status: GUEST_LINK_REVOKED_STATUS,
          },
          error: null,
        };
      }
      if (table === "workspace_ile_links" && op === "update") {
        return {
          data: handlers.ileUpdateOne ?? {
            id: LINK_ID,
            workspace_id: WORKSPACE_ID,
            status: GUEST_LINK_REVOKED_STATUS,
          },
          error: null,
        };
      }
      return { data: null, error: { message: "missing" } };
    };
    // Terminal for bulk update().select() without single/maybeSingle
    // Make the chain thenable so `await supabase.from().update()...select()` works.
    api.then = (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) => {
      let data: unknown[] = [];
      if (table === "workspace_tap_sessions" && op === "update") {
        const hasPrivateNot = call.filters.some(
          (f) => f.method === "not" && f.args[0] === "private_token_hash",
        );
        const hasPrivateIsNull = call.filters.some(
          (f) => f.method === "is" && f.args[0] === "private_token_hash",
        );
        if (hasPrivateIsNull) {
          data = handlers.tapUpdateAllPublic ?? [];
        } else if (hasPrivateNot) {
          data = handlers.tapUpdateAllPrivate ?? [];
        } else {
          data = [
            ...(handlers.tapUpdateAllPrivate ?? []),
            ...(handlers.tapUpdateAllPublic ?? []),
          ];
        }
      }
      if (table === "workspace_ile_links" && op === "update") {
        data = handlers.ileUpdateAll ?? [];
      }
      return Promise.resolve({ data, error: null }).then(resolve, reject);
    };
    return api;
  }

  return {
    calls,
    client: {
      from: (table: string) => ({
        select: (..._args: unknown[]) => chain(table, "select"),
        update: (payload: Record<string, unknown>) => chain(table, "update", payload),
      }),
    },
  };
}

describe("isGuestLinkRevoked", () => {
  it("only treats revoked as revoked", () => {
    expect(isGuestLinkRevoked("revoked")).toBe(true);
    expect(isGuestLinkRevoked("pending")).toBe(false);
    expect(isGuestLinkRevoked("in_progress")).toBe(false);
    expect(isGuestLinkRevoked("completed")).toBe(false);
    expect(isGuestLinkRevoked("active")).toBe(false);
    expect(isGuestLinkRevoked(null)).toBe(false);
    expect(isGuestLinkRevoked(undefined)).toBe(false);
  });
});

describe("invalidateTapLinkOne", () => {
  it("sets status to revoked and returns the row", async () => {
    const mock = createSupabaseMock({
      workspaces: {
        id: WORKSPACE_ID,
        user_id: OWNER_ID,
        organization_id: null,
        guest_user_id: null,
      },
      tapLoad: {
        id: LINK_ID,
        workspace_id: WORKSPACE_ID,
        status: "pending",
        private_token_hash: "abc",
        public_token: null,
      },
      tapUpdateOne: {
        id: LINK_ID,
        workspace_id: WORKSPACE_ID,
        status: GUEST_LINK_REVOKED_STATUS,
      },
    });

    const result = await invalidateTapLinkOne({
      supabase: mock.client as never,
      auth: ownerAuth,
      workspaceId: WORKSPACE_ID,
      linkId: LINK_ID,
    });

    expect(result).toEqual({
      id: LINK_ID,
      workspace_id: WORKSPACE_ID,
      status: "revoked",
    });

    const updateCall = mock.calls.find(
      (c) => c.table === "workspace_tap_sessions" && c.op === "update",
    );
    expect(updateCall?.payload).toEqual({ status: "revoked" });
  });

  it("is idempotent when already revoked (no update)", async () => {
    const mock = createSupabaseMock({
      workspaces: {
        id: WORKSPACE_ID,
        user_id: OWNER_ID,
        organization_id: null,
        guest_user_id: null,
      },
      tapLoad: {
        id: LINK_ID,
        workspace_id: WORKSPACE_ID,
        status: "revoked",
        private_token_hash: "abc",
        public_token: null,
      },
    });

    const result = await invalidateTapLinkOne({
      supabase: mock.client as never,
      auth: ownerAuth,
      workspaceId: WORKSPACE_ID,
      linkId: LINK_ID,
    });

    expect(result.status).toBe("revoked");
    expect(
      mock.calls.filter((c) => c.table === "workspace_tap_sessions" && c.op === "update"),
    ).toHaveLength(0);
  });
});

describe("invalidateTapLinksAll", () => {
  it("revokes private and public token rows and counts them", async () => {
    const id1 = "11111111-1111-4111-8111-111111111111";
    const id2 = "22222222-2222-4222-8222-222222222222";
    const mock = createSupabaseMock({
      workspaces: {
        id: WORKSPACE_ID,
        user_id: OWNER_ID,
        organization_id: null,
        guest_user_id: null,
      },
      tapUpdateAllPrivate: [{ id: id1 }],
      tapUpdateAllPublic: [{ id: id2 }],
    });

    const result = await invalidateTapLinksAll({
      supabase: mock.client as never,
      auth: ownerAuth,
      workspaceId: WORKSPACE_ID,
    });

    expect(result.workspace_id).toBe(WORKSPACE_ID);
    expect(result.invalidated_count).toBe(2);
    expect(result.ids).toEqual([id1, id2]);

    const updates = mock.calls.filter(
      (c) => c.table === "workspace_tap_sessions" && c.op === "update",
    );
    expect(updates).toHaveLength(2);
    for (const u of updates) {
      expect(u.payload).toEqual({ status: "revoked" });
      expect(u.filters.some((f) => f.method === "neq" && f.args[0] === "status")).toBe(true);
    }
  });
});

describe("invalidateIleLinkOne", () => {
  it("sets status to revoked", async () => {
    const mock = createSupabaseMock({
      workspaces: {
        id: WORKSPACE_ID,
        user_id: OWNER_ID,
        organization_id: null,
        guest_user_id: null,
      },
      ileLoad: {
        id: LINK_ID,
        workspace_id: WORKSPACE_ID,
        status: "active",
        private_token_hash: "hash",
        public_token: null,
      },
      ileUpdateOne: {
        id: LINK_ID,
        workspace_id: WORKSPACE_ID,
        status: GUEST_LINK_REVOKED_STATUS,
      },
    });

    const result = await invalidateIleLinkOne({
      supabase: mock.client as never,
      auth: ownerAuth,
      workspaceId: WORKSPACE_ID,
      linkId: LINK_ID,
    });

    expect(result.status).toBe("revoked");
    const updateCall = mock.calls.find(
      (c) => c.table === "workspace_ile_links" && c.op === "update",
    );
    expect(updateCall?.payload).toEqual({ status: "revoked" });
  });
});

describe("invalidateIleLinksAll", () => {
  it("revokes all non-revoked ILE links in the workspace", async () => {
    const id1 = "33333333-3333-4333-8333-333333333333";
    const id2 = "44444444-4444-4444-8444-444444444444";
    const mock = createSupabaseMock({
      workspaces: {
        id: WORKSPACE_ID,
        user_id: OWNER_ID,
        organization_id: null,
        guest_user_id: null,
      },
      ileUpdateAll: [{ id: id1 }, { id: id2 }],
    });

    const result = await invalidateIleLinksAll({
      supabase: mock.client as never,
      auth: ownerAuth,
      workspaceId: WORKSPACE_ID,
    });

    expect(result.invalidated_count).toBe(2);
    expect(result.ids).toEqual([id1, id2]);
    const updateCall = mock.calls.find(
      (c) => c.table === "workspace_ile_links" && c.op === "update",
    );
    expect(updateCall?.payload).toEqual({ status: "revoked" });
    expect(
      updateCall?.filters.some(
        (f) => f.method === "neq" && f.args[0] === "status" && f.args[1] === "revoked",
      ),
    ).toBe(true);
  });
});

describe("access resolution rejects revoked links", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("resolveTapSessionAccess denies revoked private token", async () => {
    const maybeSingle = vi.fn();
    const eq = vi.fn(() => ({ eq, maybeSingle, single: maybeSingle }));
    const select = vi.fn(() => ({ eq }));
    const from = vi.fn(() => ({ select }));

    vi.doMock("@/lib/supabase/server", () => ({
      createClient: vi.fn(async () => ({ auth: { getUser: vi.fn() } })),
    }));
    vi.doMock("@/lib/supabase/admin", () => ({
      createAdminClient: vi.fn(() => ({ from })),
    }));
    vi.doMock("@/lib/tap-score", () => ({
      hashPrivateToken: (t: string) => `hash:${t}`,
      getTapScoreBrief: vi.fn(),
      getTapScoreBriefForUser: vi.fn(),
    }));
    vi.doMock("@/lib/guest-link-query-guest", () => ({
      resolveGuestForLinkQueryParams: vi.fn(async () => ({ guestUserId: null })),
    }));

    maybeSingle.mockResolvedValueOnce({
      data: {
        id: LINK_ID,
        workspace_id: WORKSPACE_ID,
        user_id: OWNER_ID,
        guest_user_id: null,
        assigned_user_id: null,
        organization_id: null,
        block_id: null,
        session_id: null,
        status: "revoked",
        post_session: "show_results",
        redirect_url: null,
        completion_webhook_url: null,
        workspaces: { user_id: OWNER_ID },
      },
      error: null,
    });

    const { resolveTapSessionAccess } = await import("@/lib/tap-score-session-auth");
    const result = await resolveTapSessionAccess({ privateToken: "secret-token" });
    expect(result).toEqual({ error: TAP_LINK_REVOKED_MESSAGE, status: 403 });
  });

  it("resolveTapSessionAccess allows non-revoked private token", async () => {
    const maybeSingle = vi.fn();
    const eq = vi.fn(() => ({ eq, maybeSingle, single: maybeSingle }));
    const select = vi.fn(() => ({ eq }));
    const from = vi.fn(() => ({ select }));

    vi.doMock("@/lib/supabase/server", () => ({
      createClient: vi.fn(async () => ({ auth: { getUser: vi.fn() } })),
    }));
    vi.doMock("@/lib/supabase/admin", () => ({
      createAdminClient: vi.fn(() => ({ from })),
    }));
    vi.doMock("@/lib/tap-score", () => ({
      hashPrivateToken: (t: string) => `hash:${t}`,
      getTapScoreBrief: vi.fn(),
      getTapScoreBriefForUser: vi.fn(),
    }));
    vi.doMock("@/lib/guest-link-query-guest", () => ({
      resolveGuestForLinkQueryParams: vi.fn(async () => ({ guestUserId: "guest-1" })),
    }));

    maybeSingle.mockResolvedValueOnce({
      data: {
        id: LINK_ID,
        workspace_id: WORKSPACE_ID,
        user_id: OWNER_ID,
        guest_user_id: "guest-1",
        assigned_user_id: null,
        organization_id: null,
        block_id: null,
        session_id: null,
        status: "pending",
        post_session: "show_results",
        redirect_url: null,
        completion_webhook_url: null,
        workspaces: { user_id: OWNER_ID },
      },
      error: null,
    });

    const { resolveTapSessionAccess } = await import("@/lib/tap-score-session-auth");
    const result = await resolveTapSessionAccess({ privateToken: "good-token" });
    expect("error" in result).toBe(false);
    if (!("error" in result)) {
      expect(result.tapSessionId).toBe(LINK_ID);
      expect(result.workspaceId).toBe(WORKSPACE_ID);
    }
  });

  it("resolveIleLinkAccess denies revoked and allows pending", async () => {
    const maybeSingle = vi.fn();
    const eq = vi.fn(() => ({ eq, maybeSingle, single: maybeSingle }));
    const select = vi.fn(() => ({ eq }));
    const from = vi.fn(() => ({ select }));

    vi.doMock("@/lib/supabase/admin", () => ({
      createAdminClient: vi.fn(() => ({ from })),
    }));
    vi.doMock("@/lib/ile-link", () => ({
      hashPrivateToken: (t: string) => `hash:${t}`,
    }));
    vi.doMock("@/lib/guest-link-query-guest", () => ({
      resolveGuestForLinkQueryParams: vi.fn(async () => ({ guestUserId: "g1" })),
    }));

    // First call: revoked
    maybeSingle.mockResolvedValueOnce({
      data: {
        id: LINK_ID,
        workspace_id: WORKSPACE_ID,
        block_id: "block-1",
        user_id: OWNER_ID,
        guest_user_id: "g1",
        assigned_user_id: null,
        organization_id: null,
        session_id: null,
        status: "revoked",
        participant_type: "anonymous",
        private_token_hash: "h",
        access_mode: "private",
        public_token: null,
        entry_query_params: null,
        show_end_session: true,
      },
      error: null,
    });

    const { resolveIleLinkAccess } = await import("@/lib/ile-link-auth");
    const denied = await resolveIleLinkAccess("dead-token");
    expect(denied).toEqual({ error: ILE_LINK_REVOKED_MESSAGE, status: 403 });

    // Second call: pending (control)
    maybeSingle.mockResolvedValueOnce({
      data: {
        id: LINK_ID,
        workspace_id: WORKSPACE_ID,
        block_id: "block-1",
        user_id: OWNER_ID,
        guest_user_id: "g1",
        assigned_user_id: null,
        organization_id: null,
        session_id: null,
        status: "pending",
        participant_type: "anonymous",
        private_token_hash: "h",
        access_mode: "private",
        public_token: null,
        entry_query_params: null,
        show_end_session: true,
      },
      error: null,
    });

    const allowed = await resolveIleLinkAccess("live-token");
    expect("error" in allowed).toBe(false);
    if (!("error" in allowed)) {
      expect(allowed.linkId).toBe(LINK_ID);
      expect(allowed.status).toBe("pending");
    }
  });
});

describe("static wiring: migration, APIs, UI", () => {
  it("migration allows TAP status revoked", () => {
    const mig = read("supabase/migrations/20260724140000_tap_session_status_revoked.sql");
    expect(mig).toContain("revoked");
    expect(mig).toContain("workspace_tap_sessions");
    expect(mig).toContain("workspace_tap_sessions_status_check");
  });

  it("API routes wire invalidate_link_id and invalidate_all", () => {
    for (const rel of [
      "app/api/workspace/tap-links/route.ts",
      "app/api/workspace/ile-links/route.ts",
    ]) {
      const src = read(rel);
      expect(src).toContain("invalidate_link_id");
      expect(src).toContain("invalidate_all");
      expect(src).toMatch(/invalidateTap|invalidateIle/);
    }
    expect(read("app/api/workspace/tap-links/route.ts")).toContain("invalidateTapLinksAll");
    expect(read("app/api/workspace/ile-links/route.ts")).toContain("invalidateIleLinksAll");
  });

  it("TAP access resolution and session page reject revoked", () => {
    const auth = read("lib/tap-score-session-auth.ts");
    expect(auth).toContain("isGuestLinkRevoked");
    expect(auth).toContain("TAP_LINK_REVOKED_MESSAGE");
    const page = read("app/tap/session/[token]/page.tsx");
    expect(page).toContain('status === "revoked"');
    expect(page).toContain("This TAP link has been revoked");
  });

  it("ILE access keeps revoked gate via isGuestLinkRevoked", () => {
    const auth = read("lib/ile-link-auth.ts");
    expect(auth).toContain("isGuestLinkRevoked");
    expect(auth).toContain("ILE_LINK_REVOKED_MESSAGE");
  });

  it("WorkspaceGuestLinksPanel exposes invalidate-one and invalidate-all controls", () => {
    const panel = read("components/WorkspaceGuestLinksPanel.tsx");
    expect(panel).toContain("invalidate_link_id");
    expect(panel).toContain("invalidate_all");
    expect(panel).toContain('data-guest-link-invalidate="tap"');
    expect(panel).toContain('data-guest-link-invalidate="ile"');
    expect(panel).toContain('data-guest-link-invalidate-all="tap"');
    expect(panel).toContain('data-guest-link-invalidate-all="ile"');
    // Revoked links are not copyable
    expect(panel).toContain("isRevoked ? undefined : createdLinks[link.id]");
    expect(panel).toContain('link.status !== "revoked"');
  });

  it("i18n keys exist for invalidate actions", () => {
    const en = JSON.parse(read("messages/en.json")) as {
      planView: Record<string, string>;
    };
    for (const key of [
      "tapLinksInvalidate",
      "tapLinksInvalidateAll",
      "tapLinksRevokedHint",
      "ileLinksInvalidate",
      "ileLinksInvalidateAll",
      "ileLinksRevokedHint",
    ]) {
      expect(en.planView[key], key).toBeTruthy();
    }
  });
});
