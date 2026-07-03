import { describe, expect, it } from "vitest";
import { canUserManageWorkspace, isWorkspaceArchived } from "@/lib/workspace-archive";

describe("workspace archive helpers", () => {
  it("detects archived status", () => {
    expect(isWorkspaceArchived({ status: "archived" })).toBe(true);
    expect(isWorkspaceArchived({ status: "active" })).toBe(false);
  });

  it("allows only workspace owners to manage archive state", () => {
    expect(canUserManageWorkspace({ user_id: "user-1" }, "user-1")).toBe(true);
    expect(canUserManageWorkspace({ user_id: "user-1" }, "user-2")).toBe(false);
  });
});