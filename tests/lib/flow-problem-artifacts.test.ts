import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  acceptProductFlowPublish,
  emptyProductFlowDraft,
} from "@/lib/product-flow";
import {
  applyVerificationCommand,
  emptyVerificationState,
} from "@/lib/verification-flow";
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
  it("accepts name+The Protocol Challenge and ignores a questions array", () => {
    expect(isFlowArtifactFileId(ARTIFACT.xaiFileId)).toBe(true);

    const empty = acceptProductFlowPublish({
      ...emptyProductFlowDraft(),
      name: "Named",
    });
    expect(empty).toEqual({ ok: false, reason: "topic_required" });

    const accepted = acceptProductFlowPublish({
      ...emptyProductFlowDraft(),
      name: "Named",
      challenge: "Break down the surface-code decoder",
      topic: "Break down the surface-code decoder",
      questions: ["ignored extra", "also ignored"],
      artifacts: [ARTIFACT],
    });
    expect(accepted.ok).toBe(true);
    if (!accepted.ok) return;
    expect(accepted).not.toHaveProperty("kind");
    expect(accepted.name).toBe("Named");
    expect(accepted.topic).toBe("Break down the surface-code decoder");
    expect(accepted.challenge).toBe("Break down the surface-code decoder");
    expect(accepted.artifacts).toEqual([ARTIFACT]);
    expect(accepted.questions).toEqual(["Break down the surface-code decoder"]);

    const viaGoal = acceptProductFlowPublish({
      ...emptyProductFlowDraft(),
      name: "Priors",
      goal: "State the noise model",
    });
    expect(viaGoal.ok).toBe(true);
    if (!viaGoal.ok) return;
    expect(viaGoal.topic).toBe("State the noise model");
    expect(viaGoal.goal).toBe("State the noise model");
  });

  it("persists artifact pointers on verification create and update", () => {
    const extra = {
      name: "notes.txt",
      mimeType: "text/plain",
      xaiFileId: "file_11111111-2222-4333-8444-555555555555",
    };

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
    const updated = applyVerificationCommand(verify.state, {
      type: "update",
      ownerUserId: "owner-1",
      flowId: "vf1",
      artifacts: [ARTIFACT, extra],
    });
    expect(updated.ok).toBe(true);
    if (!updated.ok) return;
    expect(updated.flow?.artifacts).toEqual([ARTIFACT, extra]);
  });

  it("uploads flow artifacts through org-scoped xAI Files", () => {
    const route = read("app/api/dashboard/protocols/files/route.ts");
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
      kind: "learn",
      problem: "Decode a distance-5 rotated surface-code chain",
      artifacts: [ARTIFACT],
    });
    expect(solve.user).toContain("Decode a distance-5 rotated surface-code chain");
    expect(solve.user).toContain(ARTIFACT.xaiFileId);
    expect(solve.user).toContain("brief.pdf");
    expect(solve.fileIds).toEqual([ARTIFACT.xaiFileId]);
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

    const guided = buildSessionBranchGenerateMaterial({
      kind: "learn",
      problem: "Decode a distance-5 rotated surface-code chain",
      guidance: "Keep the first ring on decoder failure modes.",
    });
    expect(guided.user).toContain("Author guidance:");
    expect(guided.user).toContain("Keep the first ring on decoder failure modes.");
  });

});

describe("flow exact problem on canvas", () => {
  it("stores the author option on a Protocol", () => {
    const on = acceptProductFlowPublish({
      ...emptyProductFlowDraft(),
      name: "Decoder",
      topic: "Decode a distance-5 chain",
      exactProblemOnCanvas: true,
    });
    expect(on.ok).toBe(true);
    if (!on.ok) return;
    expect(on.exactProblemOnCanvas).toBe(true);

    const off = acceptProductFlowPublish({
      ...emptyProductFlowDraft(),
      name: "Decoder",
      topic: "Decode a distance-5 chain",
    });
    expect(off.ok).toBe(true);
    if (!off.ok) return;
    expect(off.exactProblemOnCanvas).toBe(false);

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
    expect(sql).toContain("verify_flows");

    const wizard = read("components/product-flow/product-flow-wizard.tsx");
    const page = read("components/product-flow/product-flow-page.tsx");
    expect(wizard).toContain("onExactProblemOnCanvasChange");
    expect(page).toContain("onExactProblemOnCanvasChange");
    expect(page).toContain("problemReadOnly");
    expect(read("app/api/dashboard/protocols/route.ts")).toContain("exactProblemOnCanvas");
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
    expect(parseFlowOpeningCanvasSceneForKind("calibration", stored)?.elements.length).toBeGreaterThan(
      0,
    );
    expect(parseFlowOpeningCanvasSceneForKind("verify", stored)?.elements.length).toBeGreaterThan(0);

    const emptyDraft = {
      ...emptyProductFlowDraft(),
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
    const preview = read("components/product-flow/flow-opening-canvas-preview.tsx");
    const surface = read("components/session-view/session-work-surface.tsx");
    expect(fields).toContain("FLOW_OPENING_CANVAS_LABEL");
    expect(fields).toContain("data-flow-opening-canvas-open");
    expect(fields).toContain("FlowOpeningCanvasPreview");
    expect(fields).toContain("openingCanvasScene");
    expect(wizard).toContain("FlowOpeningCanvasHost");
    expect(read("components/product-flow/flow-publish-review.tsx")).toContain(
      "FLOW_OPENING_CANVAS_LABEL",
    );
    expect(wizard).toContain("openingCanvasScene={draft.openingCanvasScene}");
    expect(page).toContain("openingCanvasScene={openingCanvasScene}");
    expect(wizard).not.toContain("window.open");
    expect(page).toContain("FlowOpeningCanvasHost");
    expect(host).toContain("data-flow-opening-canvas-authoring");
    expect(host).toContain("data-flow-opening-canvas-save");
    expect(preview).toContain("data-flow-opening-canvas-preview");
    expect(preview).toContain("data-flow-opening-canvas-preview-img");
    expect(preview).toContain("exportWorkCanvasPngDataUrl");
    expect(preview).toContain("Edit canvas");
    expect(preview).toContain("data-flow-opening-canvas-open");
    expect(host).toContain("authoringOpeningCanvasScene");
    expect(host).toContain("ExcalidrawCanvas");
    expect(host).not.toContain("SessionWorkSurface");
    expect(host).not.toContain("SessionSidebar");
    expect(host).not.toContain("SessionGuidePanel");
    expect(surface).not.toContain("data-flow-opening-canvas-sidebar");
    expect(surface).not.toContain("data-flow-opening-canvas-authoring-surface");
    expect(read("app/api/dashboard/protocols/route.ts")).toContain("openingCanvasScene");
    expect(read("lib/verification-flow-repository.ts")).toContain("opening_canvas_scene");

    writeFileSync(
      join(scratch, "author-canvas-tests.log"),
      [
        `label=${FLOW_OPENING_CANVAS_LABEL}`,
        `verifyStored=${flowOpeningCanvasHasContent(verify.flow?.openingCanvasScene)}`,
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
