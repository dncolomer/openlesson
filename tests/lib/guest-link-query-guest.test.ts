/**
 * Query-param guest identity for TAP/ILE private links.
 * Same params (any order) → same guest; different values → different guests.
 */
import { describe, expect, it } from "vitest";
import {
  canonicalizeEntryQueryParams,
  collectEntryQueryParams,
  fingerprintEntryQueryParams,
  normalizeGuestLinkAccessMode,
} from "@/lib/guest-link-access";
import {
  linkQueryGuestEmail,
  resolveGuestForLinkQueryParams,
} from "@/lib/guest-link-query-guest";

describe("normalizeGuestLinkAccessMode", () => {
  it("defaults to private; accepts public when requested (URLs still listable via public_token)", () => {
    expect(normalizeGuestLinkAccessMode({})).toBe("private");
    expect(normalizeGuestLinkAccessMode({ public: true })).toBe("public");
    expect(normalizeGuestLinkAccessMode({ access_mode: "public" })).toBe("public");
  });
});

describe("fingerprintEntryQueryParams", () => {
  it("is order-independent for keys and multi-values", () => {
    const a = collectEntryQueryParams(
      new URLSearchParams("b=2&a=1&tag=z&tag=y"),
    );
    const b = collectEntryQueryParams(
      new URLSearchParams("tag=y&a=1&tag=z&b=2"),
    );
    const c = collectEntryQueryParams({ a: "1", b: "2", tag: ["z", "y"] });
    expect(fingerprintEntryQueryParams(a)).toBe(fingerprintEntryQueryParams(b));
    expect(fingerprintEntryQueryParams(a)).toBe(fingerprintEntryQueryParams(c));
    expect(canonicalizeEntryQueryParams(a)).toEqual([
      ["a", ["1"]],
      ["b", ["2"]],
      ["tag", ["y", "z"]],
    ]);
  });

  it("differs when any param value differs", () => {
    const left = fingerprintEntryQueryParams({ candidate_id: "42" });
    const right = fingerprintEntryQueryParams({ candidate_id: "43" });
    expect(left).not.toBe(right);
    expect(left).toHaveLength(64);
    expect(fingerprintEntryQueryParams({})).toBe("");
  });
});

describe("linkQueryGuestEmail / resolveGuestForLinkQueryParams", () => {
  it("builds stable emails per link+fingerprint", () => {
    const fp = fingerprintEntryQueryParams({ x: "1" });
    const email = linkQueryGuestEmail("tap", "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee", fp);
    expect(email).toContain("linkq+tap.");
    expect(email).toContain(fp);
    expect(email).toContain("@tap-link.uncertain-systems");
  });

  it("returns base guest when params empty", async () => {
    const result = await resolveGuestForLinkQueryParams(
      { from: () => ({}) } as never,
      {
        linkKind: "tap",
        linkId: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
        workspaceId: "aaaaaaaa-bbbb-4ccc-8ddd-ffffffffffff",
        organizationId: null,
        ownerUserId: "aaaaaaaa-bbbb-4ccc-8ddd-111111111111",
        baseGuestUserId: "base-guest",
        params: {},
      },
    );
    expect(result).toEqual({
      guestUserId: "base-guest",
      paramsFingerprint: "",
      isParamScoped: false,
    });
  });

  it("finds existing param-scoped guest by workspace+email", async () => {
    const params = { candidate_id: "99" };
    const fp = fingerprintEntryQueryParams(params);
    const linkId = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
    const workspaceId = "aaaaaaaa-bbbb-4ccc-8ddd-ffffffffffff";
    const expectedEmail = linkQueryGuestEmail("ile", linkId, fp);

    const supabase = {
      from(table: string) {
        expect(table).toBe("organization_guest_users");
        return {
          select() {
            return {
              eq(col: string, val: string) {
                return {
                  eq(col2: string, val2: string) {
                    expect(col).toBe("workspace_id");
                    expect(val).toBe(workspaceId);
                    expect(col2).toBe("email");
                    expect(val2).toBe(expectedEmail);
                    return {
                      maybeSingle: async () => ({
                        data: { id: "guest-from-params", status: "active" },
                      }),
                    };
                  },
                };
              },
            };
          },
        };
      },
    };

    const result = await resolveGuestForLinkQueryParams(supabase as never, {
      linkKind: "ile",
      linkId,
      workspaceId,
      organizationId: null,
      ownerUserId: "aaaaaaaa-bbbb-4ccc-8ddd-111111111111",
      baseGuestUserId: "base-guest",
      params,
    });
    expect(result.guestUserId).toBe("guest-from-params");
    expect(result.isParamScoped).toBe(true);
    expect(result.paramsFingerprint).toBe(fp);
  });
});
