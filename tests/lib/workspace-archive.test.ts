import { describe, expect, it } from "vitest";
import {
  canUserManageWorkspace,
  isWorkspaceArchived,
  setWorkspaceArchived,
} from "@/lib/workspace-archive";
import { readFileSync } from "fs";
import path from "path";

describe("workspace archive helpers", () => {
  it("detects archived status", () => {
    expect(isWorkspaceArchived({ status: "archived" })).toBe(true);
    expect(isWorkspaceArchived({ status: "active" })).toBe(false);
  });

  it("allows only workspace owners to manage archive state", () => {
    expect(canUserManageWorkspace({ user_id: "user-1" }, "user-1")).toBe(true);
    expect(canUserManageWorkspace({ user_id: "user-1" }, "user-2")).toBe(false);
  });

  it("always updates status and archived_at together (no dual-write fallback)", async () => {
    const src = readFileSync(path.join(process.cwd(), "lib/workspace-archive.ts"), "utf8");
    expect(src).not.toMatch(/isMissingArchivedAtColumn|statusOnly/);
    expect(src).toContain("archived_at");

    const updates: Array<Record<string, unknown>> = [];
    const supabase = {
      from() {
        return {
          select() {
            return this;
          },
          eq() {
            return this;
          },
          update(payload: Record<string, unknown>) {
            updates.push(payload);
            return this;
          },
          single: async () => {
            if (updates.length === 0) {
              return {
                data: {
                  id: "ws-1",
                  user_id: "user-1",
                  status: "active",
                  archived_at: null,
                  title: "T",
                  root_topic: "R",
                },
                error: null,
              };
            }
            const last = updates[updates.length - 1];
            return {
              data: {
                id: "ws-1",
                user_id: "user-1",
                status: last.status,
                archived_at: last.archived_at,
                title: "T",
                root_topic: "R",
              },
              error: null,
            };
          },
        };
      },
    };

    const row = await setWorkspaceArchived(supabase as never, "ws-1", "user-1", true);
    expect(row.status).toBe("archived");
    expect(row.archived_at).toBeTruthy();
    expect(updates[0]).toHaveProperty("status", "archived");
    expect(updates[0]).toHaveProperty("archived_at");
    expect(Object.keys(updates[0]).sort()).toEqual(["archived_at", "status"]);
  });
});
