import { describe, expect, it, vi } from "vitest";
import {
  assertReusableWorkspaceGuest,
  isUuid,
  ResolveWorkspaceGuestError,
} from "@/lib/pow-api/resolve-workspace-guest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

function chainableGuest(row: Record<string, unknown> | null) {
  const api = {
    select: vi.fn(() => api),
    eq: vi.fn(() => api),
    maybeSingle: vi.fn(async () => ({ data: row, error: row ? null : { message: "missing" } })),
    limit: vi.fn(() => api),
    single: vi.fn(async () => ({ data: row, error: row ? null : { message: "missing" } })),
  };
  return api;
}

describe("isUuid", () => {
  it("accepts uuid v4-ish strings", () => {
    expect(isUuid("11111111-1111-4111-8111-111111111111")).toBe(true);
    expect(isUuid("not-a-uuid")).toBe(false);
  });
});

describe("assertReusableWorkspaceGuest", () => {
  const guestId = "22222222-2222-4222-8222-222222222222";
  const workspaceId = "33333333-3333-4333-8333-333333333333";

  it("allows org admin guests in the same organization", async () => {
    const guestApi = chainableGuest({
      id: guestId,
      organization_id: "org-1",
      workspace_id: null,
      status: "active",
    });
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "organization_guest_users") return guestApi;
        return chainableGuest(null);
      }),
    };

    await expect(
      assertReusableWorkspaceGuest(supabase as never, {
        workspaceId,
        organizationId: "org-1",
        guestUserId: guestId,
        isOrgAdmin: true,
        allowWorkspaceScopedReuse: false,
      }),
    ).resolves.toBe(guestId);
  });

  it("allows workspace-scoped guest by workspace_id", async () => {
    const guestApi = chainableGuest({
      id: guestId,
      organization_id: null,
      workspace_id: workspaceId,
      status: "active",
    });
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "organization_guest_users") return guestApi;
        return chainableGuest(null);
      }),
    };

    await expect(
      assertReusableWorkspaceGuest(supabase as never, {
        workspaceId,
        organizationId: null,
        guestUserId: guestId,
        isOrgAdmin: false,
        allowWorkspaceScopedReuse: true,
      }),
    ).resolves.toBe(guestId);
  });

  it("allows guests already attached to a TAP link on the workspace", async () => {
    const guestApi = chainableGuest({
      id: guestId,
      organization_id: null,
      workspace_id: "other-workspace",
      status: "active",
    });
    const tapApi = chainableGuest({ id: "tap-1" });
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "organization_guest_users") return guestApi;
        if (table === "workspace_tap_sessions") return tapApi;
        return chainableGuest(null);
      }),
    };

    await expect(
      assertReusableWorkspaceGuest(supabase as never, {
        workspaceId,
        organizationId: null,
        guestUserId: guestId,
        isOrgAdmin: false,
        allowWorkspaceScopedReuse: true,
      }),
    ).resolves.toBe(guestId);
  });

  it("rejects guests that are not reusable for the workspace", async () => {
    const guestApi = chainableGuest({
      id: guestId,
      organization_id: "other-org",
      workspace_id: "other-workspace",
      status: "active",
    });
    const empty = chainableGuest(null);
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "organization_guest_users") return guestApi;
        return empty;
      }),
    };

    await expect(
      assertReusableWorkspaceGuest(supabase as never, {
        workspaceId,
        organizationId: "org-1",
        guestUserId: guestId,
        isOrgAdmin: false,
        allowWorkspaceScopedReuse: true,
      }),
    ).rejects.toBeInstanceOf(ResolveWorkspaceGuestError);
  });
});

describe("TAP/ILE link reuse wiring", () => {
  const root = join(__dirname, "../..");

  it("ILE ensureIleLinkSession no longer hard-blocks completed links", () => {
    const src = readFileSync(join(root, "lib/ile-link-auth.ts"), "utf8");
    expect(src).not.toContain("This ILE practice session is complete");
    expect(src).toContain("completed_at: null");
    expect(src).toContain("multi-use");
  });

  it("TAP start preserves multi-use private links", () => {
    const src = readFileSync(join(root, "app/api/workspace-tap-score/start/route.ts"), "utf8");
    expect(src).toContain("multi-use");
    expect(src).toContain("guest_user_id");
  });

  it("create TAP/ILE link paths accept guest_user_id reuse helper", () => {
    const tap = readFileSync(join(root, "lib/pow-api/create-tap-link.ts"), "utf8");
    const ile = readFileSync(join(root, "lib/pow-api/create-ile-link.ts"), "utf8");
    expect(tap).toContain("assertReusableWorkspaceGuest");
    expect(ile).toContain("assertReusableWorkspaceGuest");
  });
});
