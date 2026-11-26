import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { MCP_EVIDENCE_TOOLS } from "@/lib/pow-api/mcp-tools/evidence-tools";
import { AGENT_TOOL_SURFACE } from "@/lib/pow-api/agent-tool-surface";
import { FLOW_FILES_API_PATH, FLOW_UNSYS_SEED_API_PATH } from "@/lib/api/agent-api-paths";
import { generateFlowUnsysSeedFromBody } from "@/lib/flow-unsys-generate";
import { resolveFlowArtifactsFromBody } from "@/lib/flow-artifact-upload";
import { exampleAuthorUnsysModel } from "@/lib/author-unsys-model";
import { FLOW_AUTHORING_CREATE_SPEC } from "@/lib/flow-authoring-spec";
import {
  acceptProductFlowPublish,
  emptyProductFlowDraft,
} from "@/lib/product-flow";
import { serializeFlowOpeningCanvasScene } from "@/lib/flow-opening-canvas";
import { OPTIONAL_FLOW_ENFORCED_CHANNELS } from "@/lib/flow-channels";

const ROOT = join(__dirname, "../..");

function read(rel: string): string {
  return readFileSync(join(ROOT, rel), "utf8");
}

const ARTIFACT = {
  name: "brief.pdf",
  mimeType: "application/pdf",
  xaiFileId: "file_aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
};

describe("public flow create/update matches the dashboard wizard", () => {
  it("MCP create_protocol and update_protocol accept wizard fields", () => {
    const create = MCP_EVIDENCE_TOOLS.find((tool) => tool.name === "create_protocol");
    const update = MCP_EVIDENCE_TOOLS.find((tool) => tool.name === "update_protocol");
    expect(create).toBeTruthy();
    expect(update).toBeTruthy();
    for (const tool of [create, update]) {
      const properties = tool?.inputSchema.properties ?? {};
      expect(properties).toHaveProperty("challenge");
      expect(properties).toHaveProperty("artifacts");
      expect(properties).toHaveProperty("files");
      expect(properties).toHaveProperty("exact_problem_on_canvas");
      expect(properties).toHaveProperty("generate_problem_on_open");
      expect(properties).toHaveProperty("opening_canvas_scene");
      expect(properties).toHaveProperty("answers_model_seed");
      expect(properties).toHaveProperty("uncertainty_model");
      expect(properties).toHaveProperty("generate_unsys");
      expect(properties).toHaveProperty("enforced_channels");
      expect(properties).toHaveProperty("canvas_capture");
      expect(properties).toHaveProperty("duration_minutes");
      expect(properties).not.toHaveProperty("kind");
    }
    expect(create?.inputSchema.required).toBeUndefined();
    expect(update?.inputSchema.required).toEqual(["protocol_id"]);
    expect(create?.description).toContain(FLOW_AUTHORING_CREATE_SPEC);
    expect(update?.description).toContain(FLOW_AUTHORING_CREATE_SPEC);
    const exactDoc = JSON.stringify(create?.inputSchema.properties.exact_problem_on_canvas || {});
    expect(exactDoc).toContain("written problem source only");
    expect(read("lib/pow-api/mcp-tools/helpers.ts")).toContain("generate_problem_on_open");
    expect(read("lib/pow-api/mcp-tools/helpers.ts")).toContain("opening_canvas_scene");
    expect(read("public/skill.md")).toContain("generate_problem_on_open");
    expect(read("docs/PROOF_OF_WORK_API.md")).toContain("opening_canvas_scene");
  });

  it("MCP and REST expose file upload and Unsys generate twins", () => {
    const names = AGENT_TOOL_SURFACE.map((tool) => tool.name);
    expect(names).toContain("upload_protocol_file");
    expect(names).toContain("generate_protocol_unsys_seed");
    expect(FLOW_FILES_API_PATH).toBe("/api/v3/protocols/files");
    expect(FLOW_UNSYS_SEED_API_PATH).toBe("/api/v3/protocols/unsys-seed");
    expect(existsSync(join(ROOT, "app/api/v3/protocols/files/route.ts"))).toBe(true);
    expect(existsSync(join(ROOT, "app/api/v3/protocols/unsys-seed/route.ts"))).toBe(true);
    const dispatch = read("lib/pow-api/mcp-tools/dispatch.ts");
    expect(dispatch).toContain('name === "upload_protocol_file"');
    expect(dispatch).toContain('name === "generate_protocol_unsys_seed"');
  });

  it("createAgentFlow passes wizard fields into command apply", () => {
    const src = read("lib/pow-api/agent-flow-management.ts");
    expect(src).toContain("acceptProtocolPublish");
    expect(src).toContain("exactProblemOnCanvas: accepted.exactProblemOnCanvas");
    expect(src).toContain("generateProblemOnOpen: accepted.generateProblemOnOpen");
    expect(src).toContain("answersModelSeed: accepted.answersModelSeed");
    expect(src).toContain("enforcedChannels: accepted.enforcedChannels");
    expect(src).toContain("canvasCapture: accepted.canvasCapture");
    expect(src).toContain("resolveFlowArtifactsFromBody");
    expect(src).toContain("generateFlowUnsysSeedFromBody");
    expect(src).toContain("exact_problem_on_canvas");
    expect(src).toContain("enforced_channels");
    expect(src).toContain("canvas_capture");
    expect(src).toContain("answers_model_seed");
  });

  it("publish still zeros Calibration channels and exact-problem", () => {
    const accepted = acceptProductFlowPublish({
      ...emptyProductFlowDraft("calibration"),
      name: "Priors",
      topic: "State the noise model",
      exactProblemOnCanvas: true,
      enforcedChannels: { audio: true, muse: true, video: true, screenshots: true },
    });
    expect(accepted.ok).toBe(true);
    if (!accepted.ok) return;
    expect(accepted.exactProblemOnCanvas).toBe(true);
    expect(accepted.enforcedChannels).toEqual({
      audio: true,
      muse: true,
      screenshots: true,
      video: true,
    });
  });

  it("create_flow keeps Exact only on written topic and drops it on files or canvas", () => {
    const written = acceptProductFlowPublish({
      ...emptyProductFlowDraft("solve"),
      name: "Limits",
      topic: "epsilon-delta limits",
      exactProblemOnCanvas: true,
      artifacts: [ARTIFACT],
    });
    expect(written.ok).toBe(true);
    if (!written.ok) return;
    expect(written.exactProblemOnCanvas).toBe(true);
    expect(written.generateProblemOnOpen).toBe(false);

    const fromFiles = acceptProductFlowPublish({
      ...emptyProductFlowDraft("solve"),
      name: "Decoder",
      artifacts: [ARTIFACT],
      generateProblemOnOpen: true,
      exactProblemOnCanvas: true,
    });
    expect(fromFiles.ok).toBe(true);
    if (!fromFiles.ok) return;
    expect(fromFiles.generateProblemOnOpen).toBe(true);
    expect(fromFiles.exactProblemOnCanvas).toBe(false);
    expect(fromFiles.openingCanvasScene).toBeNull();

    const scene = serializeFlowOpeningCanvasScene({
      elements: [
        {
          id: "n1",
          type: "text",
          x: 0,
          y: 0,
          width: 80,
          height: 24,
          text: "Board",
          originalText: "Board",
          isDeleted: false,
        },
      ],
      appState: {},
      files: {},
    });
    const canvas = acceptProductFlowPublish({
      ...emptyProductFlowDraft("solve"),
      name: "Board flow",
      openingCanvasScene: scene,
      generateProblemOnOpen: true,
      artifacts: [ARTIFACT],
      exactProblemOnCanvas: true,
    });
    expect(canvas.ok).toBe(true);
    if (!canvas.ok) return;
    expect(canvas.openingCanvasScene).toEqual(scene);
    expect(canvas.generateProblemOnOpen).toBe(false);
    expect(canvas.exactProblemOnCanvas).toBe(false);
  });

  it("keeps existing artifact pointers without uploading", async () => {
    const artifacts = await resolveFlowArtifactsFromBody({
      artifacts: [ARTIFACT],
      userId: "owner-1",
    });
    expect(artifacts).toEqual([ARTIFACT]);
  });

  it("does not generate an Unsys seed unless generate_unsys is set", async () => {
    const omitted = await generateFlowUnsysSeedFromBody({
      kind: "solve",
      topic: "Decode a distance-5 chain",
    });
    expect(omitted).toBeNull();
    const seed = { model: exampleAuthorUnsysModel("Decode") };
    const passed = await generateFlowUnsysSeedFromBody({
      kind: "solve",
      topic: "Decode a distance-5 chain",
      answers_model_seed: seed,
    });
    expect(passed?.model.rootId).toBe(seed.model.rootId);
  });
});
