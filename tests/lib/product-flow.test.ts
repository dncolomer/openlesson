import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  acceptProductFlowPublish,
  emptyProductFlowDraft,
  flowOwnedByUser,
  parseProductFlowKind,
  productFlowNewPath,
  productFlowOwnerTitle,
  productFlowPagePath,
  productFlowWizardCanAdvance,
} from "@/lib/product-flow";
import { parseWorkspaceKind } from "@/lib/workspace-kind";

const root = join(__dirname, "../..");

function read(rel: string): string {
  return readFileSync(join(root, rel), "utf8");
}

describe("product flow owner_user_id", () => {
  it("maps historical workspace kind aliases for reads", () => {
    expect(parseWorkspaceKind("knowledge_region")).toBe("standard");
    expect(parseWorkspaceKind("calibration")).toBe("standard");
    expect(productFlowOwnerTitle("verification")).toBe("Verification flows");
    expect(productFlowOwnerTitle("solve")).toBe("Solve flows");
    expect(parseProductFlowKind("solve")).toBe("solve");
    expect(parseProductFlowKind("practice")).toBeNull();
    expect(productFlowNewPath("solve")).toBe("/solve/flows/new");
    expect(productFlowPagePath("solve", "sf1")).toBe("/solve/flows/sf1");
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

  it("accepts a Solve publish with name and topic only", () => {
    const missingTopic = {
      ...emptyProductFlowDraft("solve"),
      name: "Limits practice",
    };
    expect(acceptProductFlowPublish(missingTopic)).toEqual({
      ok: false,
      reason: "topic_required",
    });
    expect(productFlowWizardCanAdvance("author", missingTopic)).toBe(false);
    const draft = {
      ...emptyProductFlowDraft("solve"),
      name: "Limits practice",
      topic: "epsilon-delta limits",
      questions: ["this question is ignored"],
    };
    expect(productFlowWizardCanAdvance("name", draft)).toBe(true);
    expect(productFlowWizardCanAdvance("author", draft)).toBe(true);
    const accepted = acceptProductFlowPublish(draft);
    expect(accepted.ok).toBe(true);
    if (!accepted.ok) return;
    expect(accepted.kind).toBe("solve");
    expect(accepted.name).toBe("Limits practice");
    expect(accepted.topic).toBe("epsilon-delta limits");
    expect(accepted.questions).toEqual([]);
    expect(accepted.goal).toBe("");
    expect(accepted.artifacts).toEqual([]);
  });

  it("accepts verification and calibration from name + problem without questions", () => {
    const verification = acceptProductFlowPublish({
      ...emptyProductFlowDraft("verification"),
      name: "Limits",
      topic: "What is a limit in epsilon-delta form?",
      questions: ["ignored extra question"],
    });
    expect(verification.ok).toBe(true);
    if (!verification.ok) return;
    expect(verification.topic).toBe("What is a limit in epsilon-delta form?");
    expect(verification.questions).toEqual(["What is a limit in epsilon-delta form?"]);

    const calibration = acceptProductFlowPublish({
      ...emptyProductFlowDraft("calibration"),
      name: "Priors",
      goal: "",
      topic: "State the noise model before decoding",
      questions: [],
    });
    expect(calibration.ok).toBe(true);
    if (!calibration.ok) return;
    expect(calibration.goal).toBe("State the noise model before decoding");
    expect(calibration.topic).toBe("State the noise model before decoding");
    expect(calibration.questions).toEqual(["State the noise model before decoding"]);

    expect(
      acceptProductFlowPublish({
        ...emptyProductFlowDraft("calibration"),
        name: "Priors",
      }),
    ).toEqual({ ok: false, reason: "topic_required" });
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
    expect(route).toContain("listSolveFlowsForOwnerUserId");
    expect(route).not.toContain("ensureProductFlowOwnerWorkspace");
    expect(route).not.toContain("listProductFlowWorkspaceIds");
    expect(route).not.toMatch(/from\("workspaces"\)[\s\S]{0,200}\.insert\(/);

    const productFlow = read("lib/product-flow.ts");
    expect(productFlow).toContain("flowOwnedByUser");
    expect(productFlow).not.toContain("productFlowOwnerWorkspaceKind");
    expect(productFlow).not.toContain("ensureProductFlowOwnerWorkspace");
    expect(existsSync(join(root, "lib/product-flow-owner.ts"))).toBe(false);

    const one = read("app/api/dashboard/flows/[id]/route.ts");
    expect(one).toContain("flowOwnedByUser");
    expect(one).toContain("ownerUserId: loaded.ownerUserId");
    expect(one).not.toContain("listProductFlowWorkspaceIds");
  });
});
