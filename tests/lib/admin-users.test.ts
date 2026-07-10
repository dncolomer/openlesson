import { describe, expect, it } from "vitest";
import { listAdminProfiles } from "@/lib/admin/users";

describe("listAdminProfiles", () => {
  it("falls back when extra_workspaces column is missing", async () => {
    const baseRow = {
      id: "user-1",
      username: "jane",
      created_at: "2026-01-01T00:00:00Z",
      plan: "free",
      is_admin: false,
      extra_lessons: 2,
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
        let pass = 0;
        return {
          select: (fields: string) => ({
            order: async () => {
              pass += 1;
              if (fields.includes("extra_workspaces") && pass === 1) {
                return {
                  data: null,
                  error: { code: "42703", message: "column profiles.extra_workspaces does not exist" },
                };
              }
              return { data: [baseRow], error: null };
            },
          }),
        };
      },
    };

    const result = await listAdminProfiles(adminClient as never);
    expect(result.error).toBeNull();
    expect(result.profiles).toHaveLength(1);
    expect(result.profiles[0].extra_workspaces).toBe(0);
    expect(result.profiles[0].username).toBe("jane");
  });
});