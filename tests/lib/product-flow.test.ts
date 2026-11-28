import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  acceptProductFlowPublish,
  acceptProtocolPublish,
  emptyProductFlowDraft,
  flowAuthoringSource,
  flowAuthorShowsCountdown,
  flowOwnedByUser,
  nextProductFlowWizardStep,
  parseExactProblemOnCanvas,
  parseProductFlowKind,
  previousProductFlowWizardStep,
  PRODUCT_FLOW_WIZARD_STEPS,
  PROTOCOL_CHALLENGE_LABEL,
  productFlowNewPath,
  productFlowEmbeddingKind,
  productFlowKindLabel,
  productFlowOwnerTitle,
  productFlowPagePath,
  productRegionEditPath,
  productFlowWizardCanAdvance,
} from "@/lib/product-flow";
import { exampleAuthorUnsysModel, authorUnsysSeedForPersist } from "@/lib/author-unsys-model";
import { applyVerificationCommand, emptyVerificationState } from "@/lib/verification-flow";
import {
  FLOW_UNSYS_EXPLAINER,
  FLOW_UNSYS_SCIENCE_HREF,
  FLOW_UNSYS_SEED_PATH,
  nextFlowUnsysSeed,
  parseFlowUnsysSeed,
  studentModelFromFlowSeed,
} from "@/lib/flow-unsys-seed";
import { parseWorkspaceKind } from "@/lib/workspace-kind";
import { serializeFlowOpeningCanvasScene } from "@/lib/flow-opening-canvas";
import { FlowPublishReview } from "@/components/product-flow/flow-publish-review";
import {
  FLOW_COMPACT_GHOST_BTN,
  FLOW_COMPACT_PRIMARY_BTN,
  FLOW_DANGER_BTN,
  FLOW_PRIMARY_BTN,
} from "@/components/product-flow/product-flow-form";
import { FlowProblemFields } from "@/components/product-flow/flow-problem-fields";

const root = join(__dirname, "../..");

function read(rel: string): string {
  return readFileSync(join(root, rel), "utf8");
}

describe("product flow owner_user_id", () => {
  it("maps historical workspace kind aliases for reads", () => {
    expect(parseWorkspaceKind("knowledge_region")).toBe("standard");
    expect(parseWorkspaceKind("calibration")).toBe("standard");
    expect(productFlowKindLabel()).toBe("Protocol");
    expect(productFlowOwnerTitle()).toBe("Protocols");
    expect(productFlowEmbeddingKind()).toBe("verify");
    expect(parseProductFlowKind("solve")).toBeNull();
    expect(parseProductFlowKind("calibration")).toBeNull();
    expect(parseProductFlowKind("verification")).toBeNull();
    expect(PROTOCOL_CHALLENGE_LABEL).toBe("The Protocol Challenge");
    expect(parseExactProblemOnCanvas(true)).toBe(true);
    expect(parseExactProblemOnCanvas("true")).toBe(true);
    expect(parseExactProblemOnCanvas("1")).toBe(true);
    expect(parseExactProblemOnCanvas(false)).toBe(false);
    expect(parseExactProblemOnCanvas(undefined)).toBe(false);
    expect(parseProductFlowKind("practice")).toBeNull();
    expect(flowAuthorShowsCountdown()).toBe(true);
    expect(productFlowNewPath()).toBe("/protocols/new");
    expect(productFlowPagePath("sf1")).toBe("/protocols/sf1");
    expect(productRegionEditPath("r1")).toBe("/regions/r1/edit");
  });

  it("accepts a publish draft without a workspace", () => {
    const draft = {
      ...emptyProductFlowDraft(),
      name: "Limits",
      challenge: "Limits",
      topic: "Limits",
    };
    const accepted = acceptProductFlowPublish(draft);
    expect(accepted.ok).toBe(true);
    if (!accepted.ok) return;
    expect(accepted.name).toBe("Limits");
  });

  it("accepts a Protocol publish with name and The Protocol Challenge", () => {
    const missingTopic = {
      ...emptyProductFlowDraft(),
      name: "Limits practice",
    };
    expect(acceptProductFlowPublish(missingTopic)).toEqual({
      ok: false,
      reason: "topic_required",
    });
    expect(productFlowWizardCanAdvance("author", missingTopic)).toBe(false);
    const draft = {
      ...emptyProductFlowDraft(),
      name: "Limits practice",
      challenge: "epsilon-delta limits",
      topic: "epsilon-delta limits",
      questions: ["this question is ignored"],
    };
    expect(productFlowWizardCanAdvance("name", draft)).toBe(true);
    expect(productFlowWizardCanAdvance("author", draft)).toBe(true);
    const accepted = acceptProductFlowPublish(draft);
    expect(accepted.ok).toBe(true);
    if (!accepted.ok) return;
    expect(accepted).not.toHaveProperty("kind");
    expect(accepted.name).toBe("Limits practice");
    expect(accepted.topic).toBe("epsilon-delta limits");
    expect(accepted.challenge).toBe("epsilon-delta limits");
    const protocol = acceptProtocolPublish(draft);
    expect(protocol.ok).toBe(true);
    if (!protocol.ok) return;
    expect(protocol).not.toHaveProperty("kind");
    expect(protocol.challenge).toBe("epsilon-delta limits");
    expect(accepted.questions).toEqual(["epsilon-delta limits"]);
    expect(accepted.goal).toBe("epsilon-delta limits");
    expect(accepted.artifacts).toEqual([]);
    expect(accepted.exactProblemOnCanvas).toBe(false);
    expect(accepted.openingCanvasScene).toBeNull();
    expect(accepted.answersModelSeed).toBeNull();
  });

  it("advances authoring when artifacts generate the problem on open", () => {
    const draft = {
      ...emptyProductFlowDraft(),
      name: "Decoder",
      artifacts: [
        {
          name: "brief.pdf",
          mimeType: "application/pdf",
          xaiFileId: "file_aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
        },
      ],
      generateProblemOnOpen: true,
    };
    expect(productFlowWizardCanAdvance("author", draft)).toBe(true);
    const accepted = acceptProductFlowPublish(draft);
    expect(accepted.ok).toBe(true);
    if (!accepted.ok) return;
    expect(accepted.generateProblemOnOpen).toBe(true);
    expect(accepted.topic).toBe("Decoder");
    expect(accepted.exactProblemOnCanvas).toBe(false);

    const implied = acceptProductFlowPublish({
      ...emptyProductFlowDraft(),
      name: "Decoder",
      artifacts: [
        {
          name: "brief.pdf",
          mimeType: "application/pdf",
          xaiFileId: "file_aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
        },
      ],
    });
    expect(implied.ok).toBe(true);
    if (!implied.ok) return;
    expect(implied.generateProblemOnOpen).toBe(true);
  });

  it("keeps Exact problem on canvas on written problem text only", () => {
    const written = acceptProductFlowPublish({
      ...emptyProductFlowDraft(),
      name: "Limits practice",
      topic: "epsilon-delta limits",
      exactProblemOnCanvas: true,
    });
    expect(written.ok).toBe(true);
    if (!written.ok) return;
    expect(flowAuthoringSource(written)).toBe("problem");
    expect(written.exactProblemOnCanvas).toBe(true);

    const fromFiles = acceptProductFlowPublish({
      ...emptyProductFlowDraft(),
      name: "Decoder",
      artifacts: [
        {
          name: "brief.pdf",
          mimeType: "application/pdf",
          xaiFileId: "file_aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
        },
      ],
      generateProblemOnOpen: true,
      exactProblemOnCanvas: true,
    });
    expect(fromFiles.ok).toBe(true);
    if (!fromFiles.ok) return;
    expect(flowAuthoringSource(fromFiles)).toBe("artifacts");
    expect(fromFiles.exactProblemOnCanvas).toBe(false);
  });

  it("advances authoring when a prepared canvas is the problem", () => {
    const scene = serializeFlowOpeningCanvasScene({
      elements: [
        {
          id: "n1",
          type: "text",
          x: 0,
          y: 0,
          width: 120,
          height: 32,
          text: "Board-only problem",
          originalText: "Board-only problem",
          isDeleted: false,
        },
      ],
      appState: {},
      files: {},
    });
    const draft = {
      ...emptyProductFlowDraft(),
      name: "Board flow",
      openingCanvasScene: scene,
      exactProblemOnCanvas: true,
    };
    expect(productFlowWizardCanAdvance("author", draft)).toBe(true);
    expect(productFlowWizardCanAdvance("model", draft)).toBe(true);
    const accepted = acceptProductFlowPublish(draft);
    expect(accepted.ok).toBe(true);
    if (!accepted.ok) return;
    expect(accepted.topic).toContain("Board-only problem");
    expect(flowAuthoringSource(accepted)).toBe("canvas");
    expect(accepted.exactProblemOnCanvas).toBe(false);
  });

  it("inserts an unsys model step between author and publish", () => {
    expect(PRODUCT_FLOW_WIZARD_STEPS).toEqual(["name", "author", "model", "channels", "publish"]);
    expect(nextProductFlowWizardStep("author")).toBe("model");
    expect(nextProductFlowWizardStep("model")).toBe("channels");
    expect(previousProductFlowWizardStep("publish")).toBe("channels");
    expect(previousProductFlowWizardStep("model")).toBe("author");
    const empty = emptyProductFlowDraft();
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
      ...emptyProductFlowDraft(),
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

    const wizard = read("components/product-flow/product-flow-wizard.tsx");
    const step = read("components/product-flow/flow-unsys-model-step.tsx");
    const page = read("components/product-flow/product-flow-page.tsx");
    const create = read("app/api/dashboard/protocols/route.ts");
    const update = read("app/api/dashboard/protocols/[id]/route.ts");
    const generate = read("app/api/dashboard/protocols/unsys-seed/route.ts");
    const sql = read("supabase/archive/migrations-pre-20261128/20261116140000_flow_answers_model_seed.sql");
    expect(wizard).toContain("FlowUnsysModelStep");
    expect(wizard).toContain('step === "model"');
    expect(wizard).toContain("answersModelSeed: accepted.answersModelSeed");
    expect(wizard).toContain("data-flow-unsys-step");
    expect(wizard).toContain("FlowPublishReview");
    const review = read("components/product-flow/flow-publish-review.tsx");
    expect(review).toContain("data-flow-publish-unsys");
    expect(review).toContain("data-flow-publish-review");
    expect(review).toContain("WorkspaceUnsysSeedGraph");
    expect(review).toContain("FlowOpeningCanvasPreview");
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
    expect(generate).toContain("runProductFlowUnsysGenerate");
    expect(generate).toContain("requireAuthenticatedUser");
    expect(read("lib/flow-unsys-generate.ts")).toContain("generateAuthorUnsysSessionField");
    expect(FLOW_UNSYS_SEED_PATH).toBe("/api/dashboard/protocols/unsys-seed");
    expect(sql).toContain("verify_flows");
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

  it("accepts a protocol from name + The Protocol Challenge without extra questions", () => {
    const verification = acceptProductFlowPublish({
      ...emptyProductFlowDraft(),
      name: "Limits",
      topic: "What is a limit in epsilon-delta form?",
      questions: ["ignored extra question"],
    });
    expect(verification.ok).toBe(true);
    if (!verification.ok) return;
    expect(verification.topic).toBe("What is a limit in epsilon-delta form?");
    expect(verification.questions).toEqual(["What is a limit in epsilon-delta form?"]);

    const calibration = acceptProductFlowPublish({
      ...emptyProductFlowDraft(),
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
        ...emptyProductFlowDraft(),
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
    const route = read("app/api/dashboard/protocols/route.ts");
    expect(route).toContain("ownerUserId: auth.user.id");
    expect(route).toContain("listVerificationFlowsForDashboard");
    expect(route).toContain("organizationId");
    expect(route).not.toContain("listCalibrationFlowsForOwnerUserId");
    expect(route).not.toContain("listSolveFlowsForOwnerUserId");
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

    const one = read("app/api/dashboard/protocols/[id]/route.ts");
    expect(one).toContain("flowOwnedByUser");
    expect(one).toContain("ownerUserId: loaded.ownerUserId");
    expect(one).not.toContain("listProductFlowWorkspaceIds");
  });

  it("splits the Author step: one source, details beside countdown", () => {
    const html = renderToStaticMarkup(
      createElement(FlowProblemFields, {
        layout: "split",
        problem: "Define a limit",
        onProblemChange: () => {},
        artifacts: [],
        onArtifactsChange: () => {},
        onExactProblemOnCanvasChange: () => {},
        onPrepareOpeningCanvas: () => {},
        aside: createElement("p", { "data-flow-countdown": "" }, "15 min"),
      }),
    );
    expect(html).toContain('data-flow-problem-layout="split"');
    expect(html).toContain("lg:grid-cols-2");
    expect(html).toContain('data-flow-author-source="problem"');
    expect(html).toContain('data-flow-author-panel="problem"');
    expect(html).toContain("The Protocol Challenge");
    expect(html).toContain("From files");
    expect(html).toContain("Prepared board");
    expect(html).toContain("Exact problem on canvas");
    expect(html).toContain("data-flow-countdown");
    expect(html).toContain("Define a limit");
    expect(html).not.toContain("data-flow-author-panel=\"artifacts\"");
    expect(html).not.toContain("data-flow-author-panel=\"canvas\"");

    const fromFiles = renderToStaticMarkup(
      createElement(FlowProblemFields, {
        layout: "split",
        problem: "",
        onProblemChange: () => {},
        artifacts: [
          {
            name: "brief.pdf",
            mimeType: "application/pdf",
            xaiFileId: "file_aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
          },
        ],
        onArtifactsChange: () => {},
        generateProblemOnOpen: true,
        onGenerateProblemOnOpenChange: () => {},
        onExactProblemOnCanvasChange: () => {},
        onPrepareOpeningCanvas: () => {},
      }),
    );
    expect(fromFiles).toContain('data-flow-author-source="artifacts"');
    expect(fromFiles).toContain('data-flow-author-panel="artifacts"');
    expect(fromFiles).toContain("A new problem is written from these files when a learner opens.");
    expect(fromFiles).not.toContain("Generate problem from artifacts");
    expect(fromFiles).not.toContain("Generate problem when a learner opens");
    expect(fromFiles).not.toContain("Exact problem on canvas");

    const scene = serializeFlowOpeningCanvasScene({
      elements: [
        {
          id: "n1",
          type: "text",
          x: 0,
          y: 0,
          width: 120,
          height: 32,
          text: "Board-only problem",
          originalText: "Board-only problem",
          isDeleted: false,
        },
      ],
      appState: {},
      files: {},
    });
    const prepared = renderToStaticMarkup(
      createElement(FlowProblemFields, {
        layout: "split",
        problem: "",
        onProblemChange: () => {},
        artifacts: [],
        onArtifactsChange: () => {},
        openingCanvasScene: scene,
        openingCanvasPrepared: true,
        onPrepareOpeningCanvas: () => {},
        onClearOpeningCanvas: () => {},
      }),
    );
    expect(prepared).toContain("data-flow-opening-canvas-preview");
    expect(prepared).toContain("data-flow-opening-canvas-preview-open");
    expect(prepared).toContain("Edit canvas");
    expect(prepared).toContain("Board-only problem");
    expect(prepared).toContain("data-flow-opening-canvas-open");
    expect(prepared).toContain("data-flow-opening-canvas-clear");
    expect(prepared).toContain('data-flow-author-source="canvas"');
    expect(prepared).toContain('data-flow-author-panel="canvas"');
    expect(prepared).not.toContain("Exact problem on canvas");

    const stacked = renderToStaticMarkup(
      createElement(FlowProblemFields, {
        problem: "Define a limit",
        onProblemChange: () => {},
        artifacts: [],
        onArtifactsChange: () => {},
        onExactProblemOnCanvasChange: () => {},
        onPrepareOpeningCanvas: () => {},
      }),
    );
    expect(stacked).toContain('data-flow-problem-layout="stack"');
    expect(stacked).toContain("The Protocol Challenge");
    expect(stacked).toContain("Exact problem on canvas");
    expect(stacked).not.toContain("data-flow-author-panel");

    const wizard = read("components/product-flow/product-flow-wizard.tsx");
    const host = read("components/product-flow/flow-opening-canvas-host.tsx");
    expect(wizard).toContain('layout="split"');
    expect(wizard).toContain("PRODUCT_CREATE_SHELL");
    expect(wizard).not.toContain("max-w-3xl");
    expect(wizard).not.toContain("max-w-6xl");
    expect(host).not.toContain("SessionWorkSurface");
    expect(host).toContain("ExcalidrawCanvas");
  });

  it("reviews configured name, author source, channels, model, and visuals", () => {
    const seed = authorUnsysSeedForPersist(exampleAuthorUnsysModel("Review"));
    const html = renderToStaticMarkup(
      createElement(FlowPublishReview, {
        draft: {
          ...emptyProductFlowDraft(),
          name: "Limits protocol",
          challenge: "Define a limit",
          answersModelSeed: seed,
          durationMinutes: 25,
          canvasCapture: { enabled: true, everyActions: 8 },
        },
        problem: "Define a limit",
        actions: null,
      }),
    );
    expect(html).toContain("data-flow-publish-review");
    expect(html).toContain("data-flow-publish-summary");
    expect(html).toContain("Limits protocol");
    expect(html).toContain("Write the protocol challenge");
    expect(html).toContain("25 min");
    expect(html).toContain("Audio");
    expect(html).toContain("Capture Canvas every 8 actions");
    expect(html).toContain("Define a limit");
    expect(html).toContain("data-flow-publish-visuals");
    expect(html).toContain("data-flow-publish-unsys-graph");
    expect(html).toContain("hidden state");
  });
});
