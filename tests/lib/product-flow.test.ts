import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  acceptProductFlowPublish,
  emptyProductFlowDraft,
  productFlowOwnerTitle,
  productFlowOwnerWorkspaceKind,
} from "@/lib/product-flow";
import { flowOwnedByUser } from "@/lib/product-flow-owner";

const root = join(__dirname, "../..");

function read(rel: string): string {
  return readFileSync(join(root, rel), "utf8");
}

describe("product flow owner_user_id", () => {
  it("maps historical workspace kind aliases for reads", () => {
    expect(productFlowOwnerWorkspaceKind("verification")).toBe("knowledge_region");
    expect(productFlowOwnerWorkspaceKind("calibration")).toBe("calibration");
    expect(productFlowOwnerTitle("verification")).toBe("Verification flows");
  });

  it("accepts a publish draft without a workspace", () => {
    const draft = {
      ...emptyProductFlowDraft("verification"),
      name: "Limits",
      topic: "Limits",
    };
    const accepted = acceptProductFlowPublish(draft);
    expect(accepted.ok).toBe(true);
    if (!accepted.ok) return;
    expect(accepted.name).toBe("Limits");
  });

  it("treats owner_user_id as the ownership check", () => {
    expect(flowOwnedByUser({ ownerUserId: "user-1" }, "user-1")).toBe(true);
    expect(flowOwnedByUser({ ownerUserId: "user-1" }, "user-2")).toBe(false);
    expect(flowOwnedByUser({}, "user-1")).toBe(false);
  });

  it("writes owner_user_id on create and does not insert an owner workspace", () => {
    const route = read("app/api/dashboard/flows/route.ts");
    expect(route).toContain("ownerUserId: auth.user.id");
    expect(route).toContain("listVerificationFlowsForOwnerUserId");
    expect(route).toContain("listCalibrationFlowsForOwnerUserId");
    expect(route).not.toContain("ensureProductFlowOwnerWorkspace");
    expect(route).not.toContain("listProductFlowWorkspaceIds");
    expect(route).not.toMatch(/from\("workspaces"\)[\s\S]{0,200}\.insert\(/);

    const owner = read("lib/product-flow-owner.ts");
    expect(owner).toContain("flowOwnedByUser");
    expect(owner).not.toContain("ensureProductFlowOwnerWorkspace");
    expect(owner).not.toContain("workspace_kind");
    expect(owner).not.toMatch(/from\("workspaces"\)/);

    const one = read("app/api/dashboard/flows/[id]/route.ts");
    expect(one).toContain("flowOwnedByUser");
    expect(one).toContain("ownerUserId: loaded.ownerUserId");
    expect(one).not.toContain("listProductFlowWorkspaceIds");
  });
});
