import { describe, expect, it } from "vitest";
import { listAdminProfiles } from "@/lib/admin/users";

describe("listAdminProfiles", () => {
  it("selects extra_workspaces in a single modern query", async () => {
    const selects: string[] = [];
    const baseRow = {
      id: "user-1",
      username: "jane",
      created_at: "2026-01-01T00:00:00Z",
      plan: "free",
      is_admin: false,
      extra_lessons: 2,
      extra_workspaces: 3,
      subscription_status: "active",
      current_period_end: null,
      token_tier: null,
      token_validity_expires_at: null,
      metadata: {},
      organization_id: null,
      is_org_admin: false,
    };

    const adminClient = {
      from: (table: string) => {
        if (table !== "profiles") throw new Error("unexpected table");
        return {
          select: (fields: string) => {
            selects.push(fields);
            return {
              order: async () => ({ data: [baseRow], error: null }),
            };
          },
        };
      },
    };

    const result = await listAdminProfiles(adminClient as never);
    expect(result.error).toBeNull();
    expect(result.profiles).toHaveLength(1);
    expect(result.profiles[0].extra_workspaces).toBe(3);
    expect(result.profiles[0].username).toBe("jane");
    expect(selects).toHaveLength(1);
    expect(selects[0]).toContain("extra_workspaces");
  });

  it("surfaces error when the profiles query fails (no dual-path fallback)", async () => {
    const selects: string[] = [];
    const adminClient = {
      from: (table: string) => {
        if (table !== "profiles") throw new Error("unexpected table");
        return {
          select: (fields: string) => {
            selects.push(fields);
            return {
              order: async () => ({
                data: null,
                error: { code: "42703", message: "column profiles.extra_workspaces does not exist" },
              }),
            };
          },
        };
      },
    };

    const result = await listAdminProfiles(adminClient as never);
    expect(result.profiles).toEqual([]);
    expect(result.error?.message).toMatch(/extra_workspaces/i);
    expect(selects).toHaveLength(1);
    expect(selects[0]).toContain("extra_workspaces");
  });
});
