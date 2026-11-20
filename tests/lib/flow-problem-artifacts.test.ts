import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  acceptProductFlowPublish,
  emptyProductFlowDraft,
} from "@/lib/product-flow";
import {
  applySolveCommand,
  emptySolveState,
} from "@/lib/solve-flow";
import {
  applyVerificationCommand,
  emptyVerificationState,
} from "@/lib/verification-flow";
import {
  applyCalibrationCommand,
  emptyCalibrationState,
} from "@/lib/calibration-flow";
import {
  parseFlowArtifacts,
  isFlowArtifactFileId,
} from "@/lib/flow-artifacts";
import {
  buildSessionBranchGenerateMaterial,
  sessionBranchContextFromFlow,
} from "@/lib/session-branch-model-generate";
import { heliosFlowCreateInput } from "@/lib/workspace-helios-flow";
import {
  FLOW_OPENING_CANVAS_LABEL,
  flowOpeningCanvasExtractText,
  flowOpeningCanvasHasContent,
  parseFlowOpeningCanvasScene,
  parseFlowOpeningCanvasSceneForKind,
  seedPreparedOpeningCanvas,
  serializeFlowOpeningCanvasScene,
} from "@/lib/flow-opening-canvas";

import { heliosMapToolAwarenessText } from "@/lib/workspace-helios-tools";
import { buildHeliosMapBuilderSystemPrompt } from "@/lib/prompt-kernel";

const ROOT = join(__dirname, "../..");

function read(rel: string): string {
  return readFileSync(join(ROOT, rel), "utf8");
}

const ARTIFACT = {
  name: "brief.pdf",
  mimeType: "application/pdf",
  xaiFileId: "file_aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
};

describe("flow authoring: name + Problem + artifacts", () => {
  it("accepts name+problem for all three kinds and ignores a questions array", () => {
    expect(isFlowArtifactFileId(ARTIFACT.xaiFileId)).toBe(true);

    for (const kind of ["solve", "verification", "calibration"] as const) {
      const empty = acceptProductFlowPublish({
        ...emptyProductFlowDraft(kind),
        name: "Named",
      });
      expect(empty).toEqual({ ok: false, reason: "topic_required" });

      const accepted = acceptProductFlowPublish({
        ...emptyProductFlowDraft(kind),
        name: "Named",
        topic: "Break down the surface-code decoder",
        questions: ["ignored extra", "also ignored"],
        artifacts: [ARTIFACT],
      });
      expect(accepted.ok).toBe(true);
      if (!accepted.ok) return;
      expect(accepted.name).toBe("Named");
      expect(accepted.topic).toBe("Break down the surface-code decoder");
      expect(accepted.artifacts).toEqual([ARTIFACT]);
      if (kind === "solve") {
        expect(accepted.questions).toEqual([]);
      } else {
        expect(accepted.questions).toEqual(["Break down the surface-code decoder"]);
      }
      if (kind === "calibration") {
        expect(accepted.goal).toBe("Break down the surface-code decoder");
      }
    }

    const viaGoal = acceptProductFlowPublish({
      ...emptyProductFlowDraft("calibration"),
      name: "Priors",
      goal: "State the noise model",
    });
    expect(viaGoal.ok).toBe(true);
    if (!viaGoal.ok) return;
    expect(viaGoal.topic).toBe("State the noise model");
    expect(viaGoal.goal).toBe("State the noise model");
  });

  it("persists artifact pointers on create and update for all three kinds", () => {
    const extra = {
      name: "notes.txt",
      mimeType: "text/plain",
      xaiFileId: "file_11111111-2222-4333-8444-555555555555",
    };

    const solve = applySolveCommand(emptySolveState(), {
      type: "create",
      ownerUserId: "owner-1",
      name: "Decoder",
      topic: "Decode a distance-5 chain",
      artifacts: [ARTIFACT],
      id: "sf1",
      publicToken: "stok",
    });
    expect(solve.ok).toBe(true);
    if (!solve.ok) return;
    expect(solve.flow?.topic).toBe("Decode a distance-5 chain");
    expect(solve.flow?.artifacts).toEqual([ARTIFACT]);
    const solveUpdated = applySolveCommand(solve.state, {
      type: "update",
      ownerUserId: "owner-1",
      flowId: "sf1",
      artifacts: [ARTIFACT, extra],
    });
    expect(solveUpdated.ok).toBe(true);
    if (!solveUpdated.ok) return;
    expect(solveUpdated.flow?.artifacts).toEqual([ARTIFACT, extra]);

    const verify = applyVerificationCommand(emptyVerificationState(), {
      type: "create",
      ownerUserId: "owner-1",
      name: "Investigate",
      topic: "When does a learned decoder beat MWPM?",
      questions: ["this extra question is ignored"],
      artifacts: [ARTIFACT],
      id: "vf1",
      publicToken: "vtok",
    });
    expect(verify.ok).toBe(true);
    if (!verify.ok) return;
    expect(verify.flow?.topic).toBe("When does a learned decoder beat MWPM?");
    expect(verify.flow?.questions).toEqual([
      { id: "q-1", text: "When does a learned decoder beat MWPM?" },
    ]);
    expect(verify.flow?.artifacts).toEqual([ARTIFACT]);

    const calibrate = applyCalibrationCommand(emptyCalibrationState(), {
      type: "create",
      ownerUserId: "owner-1",
      name: "Priors",
      goal: "",
      topic: "State the noise model before decoding",
      questions: ["ignored"],
      artifacts: [ARTIFACT],
      id: "cf1",
      publicToken: "ctok",
    });
    expect(calibrate.ok).toBe(true);
    if (!calibrate.ok) return;
    expect(calibrate.flow?.topic).toBe("State the noise model before decoding");
    expect(calibrate.flow?.goal).toBe("State the noise model before decoding");
    expect(calibrate.flow?.questions).toEqual([
      { id: "q-1", text: "State the noise model before decoding" },
    ]);
    expect(calibrate.flow?.artifacts).toEqual([ARTIFACT]);
  });

  it("uploads flow artifacts through org-scoped xAI Files", () => {
    const route = read("app/api/dashboard/flows/files/route.ts");
    const helper = read("lib/flow-artifact-upload.ts");
    expect(route).toContain("uploadFlowArtifactBytes");
    expect(route).not.toMatch(/uploadFileToXAI\(/);
    expect(helper).toContain("uploadOrgScopedXaiFile");
    expect(helper).toContain("organizationIdFromUser");
    expect(parseFlowArtifacts([ARTIFACT, { name: "bad" }])).toEqual([ARTIFACT]);
  });
});

describe("unsys generate material from Problem + files", () => {
  it("includes the problem and file ids; Solve frames breakdown not knowledge/insights", () => {
    const solve = buildSessionBranchGenerateMaterial({
      kind: "solve",
      problem: "Decode a distance-5 rotated surface-code chain",
      artifacts: [ARTIFACT],
    });
    expect(solve.system).toContain("breaking down and solving the problem");
    expect(solve.system.toLowerCase()).not.toContain("acquiring knowledge");
    expect(solve.system.toLowerCase()).not.toContain("crafting insights");
    expect(solve.user).toContain("Decode a distance-5 rotated surface-code chain");
    expect(solve.user).toContain(ARTIFACT.xaiFileId);
    expect(solve.user).toContain("brief.pdf");
    expect(solve.fileIds).toEqual([ARTIFACT.xaiFileId]);
    expect(solve.user.toLowerCase()).not.toContain("acquiring knowledge");
    expect(solve.user.toLowerCase()).not.toContain("crafting insights");

    const verify = buildSessionBranchGenerateMaterial(
      sessionBranchContextFromFlow({
        kind: "verification",
        name: "Investigate",
        topic: "When does a learned decoder beat MWPM?",
        artifacts: [ARTIFACT],
      }),
    );
    expect(verify.user).toContain("When does a learned decoder beat MWPM?");
    expect(verify.fileIds).toEqual([ARTIFACT.xaiFileId]);

    const calibrate = buildSessionBranchGenerateMaterial(
      sessionBranchContextFromFlow({
        kind: "calibration",
        name: "Priors",
        goal: "State the noise model",
        artifacts: [ARTIFACT],
      }),
    );
    expect(calibrate.user).toContain("State the noise model");
    expect(calibrate.fileIds).toEqual([ARTIFACT.xaiFileId]);

    const guided = buildSessionBranchGenerateMaterial({
      kind: "solve",
      problem: "Decode a distance-5 rotated surface-code chain",
      guidance: "Keep the first ring on decoder failure modes.",
    });
    expect(guided.user).toContain("Author guidance:");
    expect(guided.user).toContain("Keep the first ring on decoder failure modes.");
  });

  it("uses the prepared Work canvas as Unsys generate source", () => {
    const scene = serializeFlowOpeningCanvasScene({
      elements: [
        {
          id: "board-text",
          type: "text",
          x: 8,
          y: 8,
          width: 280,
          height: 40,
          text: "Prepared board kernel",
          originalText: "Prepared board kernel",
          isDeleted: false,
        },
      ],
      appState: {},
      files: {},
    });
    const fromBoard = buildSessionBranchGenerateMaterial({
      kind: "solve",
      problem: "Leftover problem textarea",
      artifacts: [ARTIFACT],
      openingCanvasScene: scene,
    });
    expect(fromBoard.user).toContain("Prepared Work canvas:");
    expect(fromBoard.user).toContain("Prepared board kernel");
    expect(fromBoard.user).toContain("prepared Work canvas as the field");
    expect(fromBoard.user).not.toContain("Leftover problem textarea");
    expect(fromBoard.user).not.toContain(ARTIFACT.xaiFileId);
    expect(fromBoard.fileIds).toEqual([]);
    expect(fromBoard.user).not.toContain("Problem:\nLeftover");
  });
});

describe("Helios and Manual map authoring", () => {
  it("uses name + topic/problem for all three kinds and does not require questions", () => {
    const catalog = heliosMapToolAwarenessText();
    expect(catalog).toContain("flowName plus topic (the Problem)");
    expect(catalog).toContain("Do not pass questions");
    expect(catalog.toLowerCase()).not.toContain("goal+questions");

    const prompt = buildHeliosMapBuilderSystemPrompt();
    expect(prompt).toContain("name plus topic (the Problem)");
    expect(prompt).toContain("Do not pass a question pool");
    expect(prompt).toContain('"kind": "solve", "topic":');
    expect(prompt).toContain('"kind": "verification", "topic":');
    expect(prompt).toContain('"kind": "calibration", "topic":');

    const created = heliosFlowCreateInput({
      kind: "solve",
      flowName: "Decoder",
      problem: "Decode a distance-5 chain",
      artifacts: [ARTIFACT],
    });
    expect(created).toMatchObject({
      kind: "solve",
      name: "Decoder",
      topic: "Decode a distance-5 chain",
      questions: ["Decode a distance-5 chain"],
      artifacts: [ARTIFACT],
      exactProblemOnCanvas: false,
    });
    expect(
      heliosFlowCreateInput({
        kind: "solve",
        flowName: "Decoder",
        problem: "Decode a distance-5 chain",
        exactProblemOnCanvas: true,
      }).exactProblemOnCanvas,
    ).toBe(true);

    const addPane = read("components/WorkspaceAddBlockPane.tsx");
    expect(addPane).toContain("FlowProblemFields");
    expect(addPane).toContain("onExactProblemOnCanvasChange");
    expect(addPane).toContain("data-map-block-flow-problem");
    expect(addPane).toContain("problem:");
    expect(addPane).toContain("artifacts");
    expect(addPane).not.toContain("data-verification-flow-add-question");
    expect(read("components/workspace-view/workspace-right-drawers.tsx")).toContain(
      "artifacts: input.artifacts",
    );
    expect(read("lib/map-block-authoring.ts")).toContain("artifacts: input.artifacts");
  });
});

describe("flow exact problem on canvas", () => {
  it("stores the author option on Solve and Verification, not Calibration", () => {
    const on = acceptProductFlowPublish({
      ...emptyProductFlowDraft("solve"),
      name: "Decoder",
      topic: "Decode a distance-5 chain",
      exactProblemOnCanvas: true,
    });
    expect(on.ok).toBe(true);
    if (!on.ok) return;
    expect(on.exactProblemOnCanvas).toBe(true);

    const off = acceptProductFlowPublish({
      ...emptyProductFlowDraft("verification"),
      name: "Decoder",
      topic: "Decode a distance-5 chain",
    });
    expect(off.ok).toBe(true);
    if (!off.ok) return;
    expect(off.exactProblemOnCanvas).toBe(false);

    const calibrate = acceptProductFlowPublish({
      ...emptyProductFlowDraft("calibration"),
      name: "Priors",
      topic: "State the noise model",
      exactProblemOnCanvas: true,
    });
    expect(calibrate.ok).toBe(true);
    if (!calibrate.ok) return;
    expect(calibrate.exactProblemOnCanvas).toBe(false);

    const solve = applySolveCommand(emptySolveState(), {
      type: "create",
      ownerUserId: "owner-1",
      name: "Decoder",
      topic: "Decode a distance-5 chain",
      exactProblemOnCanvas: true,
      id: "sf-exact",
      publicToken: "stok-exact",
    });
    expect(solve.ok).toBe(true);
    if (!solve.ok) return;
    expect(solve.flow?.exactProblemOnCanvas).toBe(true);

    const verify = applyVerificationCommand(emptyVerificationState(), {
      type: "create",
      ownerUserId: "owner-1",
      name: "Investigate",
      topic: "When does a learned decoder beat MWPM?",
      exactProblemOnCanvas: true,
      id: "vf-exact",
      publicToken: "vtok-exact",
    });
    expect(verify.ok).toBe(true);
    if (!verify.ok) return;
    expect(verify.flow?.exactProblemOnCanvas).toBe(true);

    const sql = read("supabase/migrations/20261115120000_flow_exact_problem_on_canvas.sql");
    expect(sql).toContain("exact_problem_on_canvas");
    expect(sql).toContain("solve_flows");
    expect(sql).toContain("verify_flows");
    expect(sql).not.toMatch(/calibrate_flows[\s\S]*exact_problem_on_canvas/);

    const wizard = read("components/product-flow/product-flow-wizard.tsx");
    const page = read("components/product-flow/product-flow-page.tsx");
    expect(wizard).toContain("onExactProblemOnCanvasChange");
    expect(page).toContain("onExactProblemOnCanvasChange");
    expect(page).toContain("problemReadOnly");
    expect(read("app/api/dashboard/flows/route.ts")).toContain("exactProblemOnCanvas");
    expect(read("lib/learn-opening-work-generate.ts")).toContain("exactProblem");
  });
});

describe("flow opening canvas", () => {
  it("lets Solve and Verification store a prepared scene and hides Calibration", () => {
    const scratch =
      process.env.GROK_GOAL_SCRATCH ||
      "/var/folders/kd/98qlvkyd4mb3_9t32p9bmt_r0000gn/T/grok-goal-8913821ad36e/implementer";
    mkdirSync(scratch, { recursive: true });

    const scene = {
      elements: [
        {
          id: "el-text",
          type: "text",
          x: 12,
          y: 24,
          width: 240,
          height: 48,
          text: "Find the kernel of T",
          originalText: "Find the kernel of T",
          isDeleted: false,
        },
        {
          id: "el-img",
          type: "image",
          x: 40,
          y: 90,
          width: 160,
          height: 90,
          fileId: "file-1",
          isDeleted: false,
        },
      ],
      appState: { zenModeEnabled: false, gridModeEnabled: true },
      files: {
        "file-1": {
          id: "file-1",
          mimeType: "image/png",
          dataURL: "data:image/png;base64,aaaa",
        },
      },
    };
    const stored = serializeFlowOpeningCanvasScene(scene);
    expect(flowOpeningCanvasHasContent(stored)).toBe(true);
    expect(flowOpeningCanvasExtractText(stored)).toContain("kernel of T");
    expect(JSON.stringify(stored?.files["file-1"] ?? {})).toContain("image/png");
    const restored = parseFlowOpeningCanvasScene(JSON.parse(JSON.stringify(stored)));
    expect(restored?.elements.some((el) => el.id === "el-img" && el.fileId === "file-1")).toBe(true);
    expect(parseFlowOpeningCanvasSceneForKind("calibration", stored)).toBeNull();
    expect(parseFlowOpeningCanvasSceneForKind("solve", stored)?.elements.length).toBeGreaterThan(0);

    const emptyDraft = {
      ...emptyProductFlowDraft("solve"),
      name: "Kernel",
    };
    expect(acceptProductFlowPublish(emptyDraft).ok).toBe(false);
    const withBoard = acceptProductFlowPublish({
      ...emptyDraft,
      openingCanvasScene: stored,
    });
    expect(withBoard.ok).toBe(true);
    if (!withBoard.ok) return;
    expect(withBoard.openingCanvasScene).toBeTruthy();
    expect(withBoard.topic).toContain("kernel of T");

    const calibrate = acceptProductFlowPublish({
      ...emptyProductFlowDraft("calibration"),
      name: "Priors",
      topic: "State the noise model",
      openingCanvasScene: stored,
    });
    expect(calibrate.ok).toBe(true);
    if (!calibrate.ok) return;
    expect(calibrate.openingCanvasScene).toBeNull();

    const solve = applySolveCommand(emptySolveState(), {
      type: "create",
      ownerUserId: "owner-1",
      name: "Kernel",
      topic: "Find the kernel of T",
      openingCanvasScene: stored,
      id: "sf-canvas",
      publicToken: "stok-canvas",
    });
    expect(solve.ok).toBe(true);
    if (!solve.ok) return;
    expect(flowOpeningCanvasHasContent(solve.flow?.openingCanvasScene)).toBe(true);

    const verify = applyVerificationCommand(emptyVerificationState(), {
      type: "create",
      ownerUserId: "owner-1",
      name: "Investigate",
      topic: "When does a learned decoder beat MWPM?",
      openingCanvasScene: stored,
      id: "vf-canvas",
      publicToken: "vtok-canvas",
    });
    expect(verify.ok).toBe(true);
    if (!verify.ok) return;
    expect(flowOpeningCanvasHasContent(verify.flow?.openingCanvasScene)).toBe(true);

    const seeded = seedPreparedOpeningCanvas(null, stored);
    expect(seeded.seeded).toBe(true);
    expect(seeded.scene.elements.some((el) => el.fileId === "file-1")).toBe(true);
    const alreadyLive = seedPreparedOpeningCanvas(seeded.scene, stored);
    expect(alreadyLive.seeded).toBe(false);

    const sql = read("supabase/migrations/20261121140000_flow_opening_canvas_scene.sql");
    expect(sql).toContain("opening_canvas_scene");
    expect(sql).toContain("solve_flows");
    expect(sql).toContain("verify_flows");
    expect(sql).not.toMatch(/calibrate_flows[\s\S]*opening_canvas_scene/);

    const fields = read("components/product-flow/flow-problem-fields.tsx");
    const wizard = read("components/product-flow/product-flow-wizard.tsx");
    const page = read("components/product-flow/product-flow-page.tsx");
    const host = read("components/product-flow/flow-opening-canvas-host.tsx");
    const surface = read("components/session-view/session-work-surface.tsx");
    expect(fields).toContain("FLOW_OPENING_CANVAS_LABEL");
    expect(fields).toContain("data-flow-opening-canvas-open");
    expect(wizard).toContain("FLOW_OPENING_CANVAS_LABEL");
    expect(wizard).toContain("FlowOpeningCanvasHost");
    expect(wizard).not.toContain("window.open");
    expect(page).toContain("FlowOpeningCanvasHost");
    expect(host).toContain("data-flow-opening-canvas-authoring");
    expect(host).toContain("data-flow-opening-canvas-save");
    expect(host).toContain("authoringOpeningCanvasScene");
    expect(surface).toContain("pointer-events-none");
    expect(surface).toContain("opacity-40");
    expect(read("app/api/dashboard/flows/route.ts")).toContain("openingCanvasScene");
    expect(read("lib/solve-flow-repository.ts")).toContain("opening_canvas_scene");
    expect(read("lib/verification-flow-repository.ts")).toContain("opening_canvas_scene");

    writeFileSync(
      join(scratch, "author-canvas-tests.log"),
      [
        `label=${FLOW_OPENING_CANVAS_LABEL}`,
        `solveStored=${flowOpeningCanvasHasContent(solve.flow?.openingCanvasScene)}`,
        `verifyStored=${flowOpeningCanvasHasContent(verify.flow?.openingCanvasScene)}`,
        `calibrateNull=${calibrate.openingCanvasScene === null}`,
        `roundTripFiles=${Boolean(restored?.files["file-1"])}`,
        `wizardHost=${wizard.includes("FlowOpeningCanvasHost")}`,
      ].join("\n"),
      "utf8",
    );
  });
});

describe("flow topic migration", () => {
  it("adds artifacts on all three tables and copies first question into topic", () => {
    const sql = read("supabase/migrations/20261108120000_flow_problem_artifacts.sql");
    expect(sql).toContain("solve_flows");
    expect(sql).toContain("verify_flows");
    expect(sql).toContain("calibrate_flows");
    expect(sql).toMatch(/solve_flows[\s\S]*artifacts jsonb/);
    expect(sql).toMatch(/verify_flows[\s\S]*artifacts jsonb/);
    expect(sql).toMatch(/calibrate_flows[\s\S]*artifacts jsonb/);
    expect(sql).toContain("add column if not exists topic");
    expect(sql).toContain("questions -> 0 ->> 'text'");
    expect(sql).toContain("nullif(btrim(goal), '')");
  });
});

describe("flow create/edit UI", () => {
  it("shows a Problem textarea and multi-file control, without question-pool chrome", () => {
    const wizard = read("components/product-flow/product-flow-wizard.tsx");
    const page = read("components/product-flow/product-flow-page.tsx");
    const fields = read("components/product-flow/flow-problem-fields.tsx");
    expect(fields).toContain("data-flow-problem");
    expect(fields).toContain("data-flow-exact-problem-on-canvas");
    expect(fields).toContain("Exact problem on canvas");
    expect(fields).toContain("data-flow-artifact-file");
    expect(fields).toContain("Define the problem");
    expect(fields).toContain('type="file"');
    expect(fields).toContain("multiple");
    expect(wizard).toContain("FlowProblemFields");
    expect(page).toContain("FlowProblemFields");
    expect(page).toContain("problemReadOnly");
    expect(fields).toContain("data-flow-problem-locked");
    expect(page).toContain("FlowPublicActions");
    const verificationPanel = read("components/VerificationFlowsPanel.tsx");
    const calibrationPanel = read("components/CalibrationFlowsPanel.tsx");
    expect(verificationPanel).toContain("FlowProblemFields");
    expect(verificationPanel).toContain("artifacts,");
    expect(verificationPanel).toContain("/api/workspace/verification-flows");
    expect(calibrationPanel).toContain("FlowProblemFields");
    expect(calibrationPanel).toContain("artifacts,");
    expect(calibrationPanel).toContain("/api/workspace/calibration-flows");
    expect(read("app/api/workspace/verification-flows/route.ts")).toContain("artifacts: body.artifacts");
    expect(read("app/api/workspace/calibration-flows/route.ts")).toContain("artifacts: body.artifacts");
    for (const src of [wizard, page, fields, verificationPanel, calibrationPanel]) {
      expect(src).not.toContain("data-verification-flow-add-question");
      expect(src).not.toContain("data-calibration-flow-add-question");
      expect(src).not.toContain("data-verification-generate-from-topic");
      expect(src).not.toContain("data-calibration-generate-from-goal");
    }
  });
});
