import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  acceptProductFlowPublish,
  emptyProductFlowDraft,
  flowAuthorShowsCountdown,
  flowOwnedByUser,
  nextProductFlowWizardStep,
  parseExactProblemOnCanvas,
  parseProductFlowKind,
  previousProductFlowWizardStep,
  PRODUCT_FLOW_WIZARD_STEPS,
  productFlowNewPath,
  productFlowEmbeddingKind,
  productFlowKindLabel,
  productFlowOwnerTitle,
  productFlowPagePath,
  productFlowWizardCanAdvance,
} from "@/lib/product-flow";
import { exampleAuthorUnsysModel, authorUnsysSeedForPersist } from "@/lib/author-unsys-model";
import { applySolveCommand, emptySolveState } from "@/lib/solve-flow";
import { applyVerificationCommand, emptyVerificationState } from "@/lib/verification-flow";
import { applyCalibrationCommand, emptyCalibrationState } from "@/lib/calibration-flow";
import {
  FLOW_UNSYS_EXPLAINER,
  FLOW_UNSYS_SCIENCE_HREF,
  FLOW_UNSYS_SEED_PATH,
  nextFlowUnsysSeed,
  parseFlowUnsysSeed,
  studentModelFromFlowSeed,
} from "@/lib/flow-unsys-seed";
import { definitionUnsysSeedFromBlocks } from "@/lib/definition-unsys-seed";
import { parseWorkspaceKind } from "@/lib/workspace-kind";
import {
  FLOW_COMPACT_GHOST_BTN,
  FLOW_COMPACT_PRIMARY_BTN,
  FLOW_DANGER_BTN,
  FLOW_PRIMARY_BTN,
} from "@/components/product-flow/product-flow-form";

const root = join(__dirname, "../..");

function read(rel: string): string {
  return readFileSync(join(root, rel), "utf8");
}

describe("product flow owner_user_id", () => {
  it("maps historical workspace kind aliases for reads", () => {
    expect(parseWorkspaceKind("knowledge_region")).toBe("standard");
    expect(parseWorkspaceKind("calibration")).toBe("standard");
    expect(productFlowKindLabel("verification")).toBe("Verification");
    expect(productFlowKindLabel("calibration")).toBe("Calibration");
    expect(productFlowKindLabel("solve")).toBe("Solve");
    expect(productFlowOwnerTitle("verification")).toBe("Verification flows");
    expect(productFlowOwnerTitle("solve")).toBe("Solve flows");
    expect(productFlowEmbeddingKind("verification")).toBe("verify");
    expect(productFlowEmbeddingKind("calibration")).toBe("calibrate");
    expect(productFlowEmbeddingKind("solve")).toBe("solve");
    expect(parseProductFlowKind("solve")).toBe("solve");
    expect(parseExactProblemOnCanvas(true)).toBe(true);
    expect(parseExactProblemOnCanvas("true")).toBe(true);
    expect(parseExactProblemOnCanvas("1")).toBe(true);
    expect(parseExactProblemOnCanvas(false)).toBe(false);
    expect(parseExactProblemOnCanvas(undefined)).toBe(false);
    expect(parseProductFlowKind("practice")).toBeNull();
    expect(flowAuthorShowsCountdown("verification")).toBe(true);
    expect(flowAuthorShowsCountdown("calibration")).toBe(true);
    expect(flowAuthorShowsCountdown("solve")).toBe(false);
    expect(productFlowNewPath("solve")).toBe("/solve/flows/new");
    expect(productFlowNewPath()).toBe("/flows/new");
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
    expect(accepted.exactProblemOnCanvas).toBe(false);
    expect(accepted.answersModelSeed).toBeNull();
  });

  it("inserts an unsys model step between author and publish", () => {
    expect(PRODUCT_FLOW_WIZARD_STEPS).toEqual(["name", "author", "model", "channels", "publish"]);
    expect(nextProductFlowWizardStep("author")).toBe("model");
    expect(nextProductFlowWizardStep("model")).toBe("channels");
    expect(previousProductFlowWizardStep("publish")).toBe("channels");
    expect(previousProductFlowWizardStep("model")).toBe("author");
    const empty = emptyProductFlowDraft("solve");
    expect(productFlowWizardCanAdvance("model", empty)).toBe(false);
    expect(
      productFlowWizardCanAdvance("model", {
        ...empty,
        name: "Limits",
        topic: "epsilon-delta limits",
      }),
    ).toBe(true);

    const seed = authorUnsysSeedForPersist(exampleAuthorUnsysModel("Limits"));
    const accepted = acceptProductFlowPublish({
      ...emptyProductFlowDraft("solve"),
      name: "Limits practice",
      topic: "epsilon-delta limits",
      answersModelSeed: seed,
    });
    expect(accepted.ok).toBe(true);
    if (!accepted.ok) return;
    expect(accepted.answersModelSeed?.model.rootId).toBe(seed.model.rootId);
    expect(studentModelFromFlowSeed(accepted.answersModelSeed)?.rootId).toBe(seed.model.rootId);
    expect(nextFlowUnsysSeed(seed, undefined)?.model.rootId).toBe(seed.model.rootId);
    expect(nextFlowUnsysSeed(seed, null)).toBeNull();
    expect(parseFlowUnsysSeed(seed)?.model.rootId).toBe(seed.model.rootId);

    const fromFlow = definitionUnsysSeedFromBlocks({
      flowId: "sf-live",
      flowSeed: seed,
      copyBlockId: "copy-block",
      blocks: [
        {
          id: "copy-block",
          workspace_id: "ws-copy",
          map_block: { kind: "solve", flow_id: "sf-live" },
          answers_model_seed: authorUnsysSeedForPersist(exampleAuthorUnsysModel("Copy")),
        },
      ],
    });
    expect(studentModelFromFlowSeed(fromFlow)?.rootId).toBe(seed.model.rootId);

    const solve = applySolveCommand(emptySolveState(), {
      type: "create",
      ownerUserId: "owner-1",
      name: "Limits practice",
      topic: "epsilon-delta limits",
      answersModelSeed: seed,
    });
    expect(solve.ok).toBe(true);
    if (!solve.ok) return;
    expect(solve.flow?.answersModelSeed?.model.rootId).toBe(seed.model.rootId);
    const verify = applyVerificationCommand(emptyVerificationState(), {
      type: "create",
      ownerUserId: "owner-1",
      name: "Limits",
      topic: "What is a limit?",
      publicToken: "vtok-unsys",
      answersModelSeed: seed,
    });
    expect(verify.ok).toBe(true);
    if (!verify.ok) return;
    expect(verify.flow?.answersModelSeed?.model.rootId).toBe(seed.model.rootId);
    const calibrate = applyCalibrationCommand(emptyCalibrationState(), {
      type: "create",
      ownerUserId: "owner-1",
      name: "Priors",
      topic: "State the noise model",
      publicToken: "ctok-unsys",
      answersModelSeed: seed,
    });
    expect(calibrate.ok).toBe(true);
    if (!calibrate.ok) return;
    expect(calibrate.flow?.answersModelSeed?.model.rootId).toBe(seed.model.rootId);

    const wizard = read("components/product-flow/product-flow-wizard.tsx");
    const step = read("components/product-flow/flow-unsys-model-step.tsx");
    const page = read("components/product-flow/product-flow-page.tsx");
    const create = read("app/api/dashboard/flows/route.ts");
    const update = read("app/api/dashboard/flows/[id]/route.ts");
    const generate = read("app/api/dashboard/flows/unsys-seed/route.ts");
    const session = read("app/api/learn/session-branch-model/route.ts");
    const sql = read("supabase/migrations/20261116140000_flow_answers_model_seed.sql");
    expect(wizard).toContain("FlowUnsysModelStep");
    expect(wizard).toContain('step === "model"');
    expect(wizard).toContain("answersModelSeed: accepted.answersModelSeed");
    expect(wizard).toContain("data-flow-unsys-step");
    expect(wizard).toContain("data-flow-publish-unsys");
    expect(step).toContain('data-flow-unsys-reset=""');
    expect(step).toContain('data-flow-unsys-prompt=""');
    expect(step).toContain('data-flow-unsys-prompt-files=""');
    expect(step).toContain('data-flow-unsys-explainer=""');
    expect(step).toContain("FLOW_UNSYS_SCIENCE_HREF");
    expect(step).toContain("FLOW_ARTIFACT_ACCEPT");
    expect(step).not.toContain("Regenerate");
    expect(step).not.toContain('data-flow-unsys-import=""');
    expect(step).not.toContain('data-flow-unsys-generate=""');
    expect(step).toContain("FLOW_UNSYS_SEED_PATH");
    expect(step).toContain("WorkspaceUnsysSeedGraph");
    expect(step).toContain("WorkspaceUnsysSeedInspector");
    expect(step).toContain("showFieldHints");
    expect(step).toContain("fillViewport");
    expect(wizard).toContain("fillViewport");
    expect(step).toContain('data-flow-unsys-controls=""');
    expect(step).toContain("FLOW_COMPACT_PRIMARY_BTN");
    expect(step).toContain("FLOW_COMPACT_GHOST_BTN");
    expect(step).not.toContain("FLOW_PRIMARY_BTN");
    expect(wizard).toContain("FLOW_COMPACT_PRIMARY_BTN");
    expect(FLOW_COMPACT_PRIMARY_BTN).toContain("h-7");
    expect(FLOW_COMPACT_GHOST_BTN).toContain("h-7");
    expect(FLOW_UNSYS_SCIENCE_HREF).toBe("/science#science-unsys-model");
    expect(FLOW_UNSYS_EXPLAINER.reset.toLowerCase()).toContain("reset");
    expect(FLOW_UNSYS_EXPLAINER.question.toLowerCase()).toContain("question");
    expect(FLOW_UNSYS_EXPLAINER.observation.toLowerCase()).toContain("observation");
    const graph = read("components/WorkspaceUnsysSeedGraph.tsx");
    expect(graph).toContain("{branch.title}");
    expect(graph).not.toContain("branch.question");
    expect(graph).not.toContain("branch.observation");
    const inspector = read("components/WorkspaceUnsysSeedInspector.tsx");
    expect(inspector).toContain("data-author-unsys-branch-question");
    expect(inspector).toContain("data-author-unsys-branch-observation");
    expect(page).toContain("FlowUnsysModelStep");
    expect(page).toContain("answersModelSeed");
    expect(create).toContain("answersModelSeed: accepted.answersModelSeed");
    expect(update).toContain("parseFlowUnsysSeed");
    expect(generate).toContain("generateAuthorUnsysSessionField");
    expect(generate).toContain("requireAuthenticatedUser");
    expect(FLOW_UNSYS_SEED_PATH).toBe("/api/dashboard/flows/unsys-seed");
    expect(session).toContain("flow.answersModelSeed");
    expect(session).toContain("getCalibrationFlowById");
    expect(sql).toContain("solve_flows");
    expect(sql).toContain("verify_flows");
    expect(sql).toContain("calibrate_flows");
    expect(sql).toContain("answers_model_seed");
  });

  it("sizes Save flow and Remove the same on flow details", () => {
    for (const token of [
      "inline-flex",
      "h-12",
      "items-center",
      "justify-center",
      "px-6",
      "text-sm",
      "font-medium",
    ]) {
      expect(FLOW_PRIMARY_BTN).toContain(token);
      expect(FLOW_DANGER_BTN).toContain(token);
    }
    expect(FLOW_DANGER_BTN).not.toContain("h-10");
    expect(FLOW_DANGER_BTN).not.toContain("text-xs");
    expect(FLOW_DANGER_BTN).not.toContain("px-4");
    const page = read("components/product-flow/product-flow-page.tsx");
    expect(page).toContain("FLOW_PRIMARY_BTN");
    expect(page).toContain("FLOW_DANGER_BTN");
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
    expect(route).toContain("sortDashboardFlowsByCreatedAt");
    expect(route).not.toContain("sortDashboardRecentFlows");
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
