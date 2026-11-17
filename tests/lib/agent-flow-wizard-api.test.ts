import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { MCP_EVIDENCE_TOOLS } from "@/lib/pow-api/mcp-tools/evidence-tools";
import { AGENT_TOOL_SURFACE } from "@/lib/pow-api/agent-tool-surface";
import { FLOW_FILES_API_PATH, FLOW_UNSYS_SEED_API_PATH } from "@/lib/api/agent-api-paths";
import { generateFlowUnsysSeedFromBody } from "@/lib/flow-unsys-generate";
import { resolveFlowArtifactsFromBody } from "@/lib/flow-artifact-upload";
import { exampleAuthorUnsysModel } from "@/lib/author-unsys-model";
import {
  acceptProductFlowPublish,
  emptyProductFlowDraft,
} from "@/lib/product-flow";
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
  it("MCP create_flow and update_flow accept wizard fields", () => {
    const create = MCP_EVIDENCE_TOOLS.find((tool) => tool.name === "create_flow");
    const update = MCP_EVIDENCE_TOOLS.find((tool) => tool.name === "update_flow");
    expect(create).toBeTruthy();
    expect(update).toBeTruthy();
    for (const tool of [create, update]) {
      const properties = tool?.inputSchema.properties ?? {};
      expect(properties).toHaveProperty("topic");
      expect(properties).toHaveProperty("artifacts");
      expect(properties).toHaveProperty("files");
      expect(properties).toHaveProperty("exact_problem_on_canvas");
      expect(properties).toHaveProperty("answers_model_seed");
      expect(properties).toHaveProperty("generate_unsys");
      expect(properties).toHaveProperty("enforced_channels");
      expect(properties).toHaveProperty("duration_minutes");
    }
    expect(create?.inputSchema.required).toEqual(["kind"]);
    expect(update?.inputSchema.required).toEqual(["flow_id"]);
  });

  it("MCP and REST expose file upload and Unsys generate twins", () => {
    const names = AGENT_TOOL_SURFACE.map((tool) => tool.name);
    expect(names).toContain("upload_flow_file");
    expect(names).toContain("generate_flow_unsys_seed");
    expect(FLOW_FILES_API_PATH).toBe("/api/v3/flows/files");
    expect(FLOW_UNSYS_SEED_API_PATH).toBe("/api/v3/flows/unsys-seed");
    expect(existsSync(join(ROOT, "app/api/v3/flows/files/route.ts"))).toBe(true);
    expect(existsSync(join(ROOT, "app/api/v3/flows/unsys-seed/route.ts"))).toBe(true);
    const dispatch = read("lib/pow-api/mcp-tools/dispatch.ts");
    expect(dispatch).toContain('name === "upload_flow_file"');
    expect(dispatch).toContain('name === "generate_flow_unsys_seed"');
  });

  it("createAgentFlow passes wizard fields into command apply", () => {
    const src = read("lib/pow-api/agent-flow-management.ts");
    expect(src).toContain("acceptProductFlowPublish");
    expect(src).toContain("exactProblemOnCanvas: accepted.exactProblemOnCanvas");
    expect(src).toContain("answersModelSeed: accepted.answersModelSeed");
    expect(src).toContain("enforcedChannels: accepted.enforcedChannels");
    expect(src).toContain("resolveFlowArtifactsFromBody");
    expect(src).toContain("generateFlowUnsysSeedFromBody");
    expect(src).toContain("exact_problem_on_canvas");
    expect(src).toContain("enforced_channels");
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
    expect(accepted.exactProblemOnCanvas).toBe(false);
    expect(accepted.enforcedChannels).toEqual(OPTIONAL_FLOW_ENFORCED_CHANNELS);
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
