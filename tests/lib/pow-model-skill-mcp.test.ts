/**
 * Skill instructions and MCP upload/buffer text tell agents to simulate
 * pow-model-v1 for synthetic-region proof of work (the former TAPBench PoW).
 */
import { describe, expect, it } from "vitest";
import {
  AGENT_TOOL_SURFACE,
  textExposesKnowledgeLinkMint,
} from "@/lib/pow-api/agent-tool-surface";
import {
  buildIntegrationSkillInstructions,
  knowledgeRegionIntegrationCopy,
} from "@/lib/pow-api/integration-skill";
import { MCP_EVIDENCE_TOOLS } from "@/lib/pow-api/mcp-tools/helpers";
import {
  CANVAS_TAP_SIMULATION_HEADING,
  canvasTapSimulationSkillSection,
  powModelAgentSimulationContract,
  withCanvasTapSimulationSkill,
} from "@/lib/pow-api/pow-model-agent-contract";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { POW_MODEL_VERSION } from "@/lib/pow-api/workspace-proof-of-work";
import { ILE_SPEECH_TOOL_NAME, ILE_TRACE_TOOL_NAME } from "@/lib/ile-thought-traces";
import {
  ILE_WORK_CANVAS_COMMAND_POW_IDS,
  ILE_WORK_CANVAS_POW_TOOL_NAME,
} from "@/lib/ile-work-canvas-pow";
import { TAP_SPEECH_TOOL_NAME } from "@/lib/tap-speech-proof-of-work";
import { TAP_TRACE_TOOL_NAME } from "@/lib/tap-score-traces";

const SKILL_REQUEST = {
  integration_name: "Partner Agent",
  base_url: "https://uncertain.systems",
  eval_definition: "Verify partner workflow",
};

type VersionedMcpTool = {
  name: string;
  description: string;
  inputSchema: {
    required: readonly string[];
    properties: {
      pow_model_version?: {
        description?: string;
        enum?: readonly string[];
      };
    };
  };
};

function mcpTool(name: string): VersionedMcpTool {
  const tool = MCP_EVIDENCE_TOOLS.find((entry) => entry.name === name);
  expect(tool, name).toBeTruthy();
  return tool as unknown as VersionedMcpTool;
}

describe("pow-model-v1 agent contract on skill and MCP", () => {
  const contract = powModelAgentSimulationContract();

  it("states the shipped model, distinct encodings, and synthetic-region use", () => {
    expect(POW_MODEL_VERSION).toBe("pow-model-v1");
    expect(contract).toContain(POW_MODEL_VERSION);
    expect(contract).toContain("stored type tool");
    expect(contract).toContain(`pow_model_version ${POW_MODEL_VERSION}`);
    expect(contract).toContain("canvas use");
    expect(contract).toContain("canvas prompts");
    expect(contract).toContain("canvas commands");
    expect(contract).toContain("voice thoughts");
    expect(contract).toContain("speech");
    expect(contract).toContain("Do not invent a new stored type");
    expect(contract).toContain("Do not collapse");
    expect(contract).toContain("one generic event");
    expect(contract).toContain("formerly called TAPBench PoW");
    expect(contract).toContain("synthetic knowledge regions");
    expect(contract).toContain(ILE_WORK_CANVAS_POW_TOOL_NAME);
    expect(contract).toContain("board_prompt");
    expect(contract).toContain("expand_more");
    expect(contract).toContain("metadata.command_id");
    expect(contract).toContain("tool_action dictate");
    for (const id of ILE_WORK_CANVAS_COMMAND_POW_IDS) {
      expect(contract).toContain(id);
    }
    expect(contract).toContain(ILE_TRACE_TOOL_NAME);
    expect(contract).toContain(TAP_TRACE_TOOL_NAME);
    expect(contract).toContain(ILE_SPEECH_TOOL_NAME);
    expect(contract).toContain(TAP_SPEECH_TOOL_NAME);
    expect(contract).not.toContain("pow-model-v2");
    expect(contract).not.toContain("create_tap_link");
  });

  it("puts that contract in standard and Knowledge Region skill instructions", () => {
    const standard = buildIntegrationSkillInstructions(
      SKILL_REQUEST,
      {
        id: "std-ws-1",
        title: "Map workspace",
        root_topic: "Onboarding",
        workspace_kind: "standard",
      },
      [{ id: "block-1", title: "Setup", description: "First project" }],
      null,
      null,
    );
    const knowledgeRegion = buildIntegrationSkillInstructions(
      SKILL_REQUEST,
      {
        id: "kr-ws-1",
        title: "Knowledge Region",
        root_topic: "External PoW",
        workspace_kind: "knowledge_region",
      },
      [],
      null,
      null,
    );
    const copy = knowledgeRegionIntegrationCopy();

    expect(standard).not.toContain(CANVAS_TAP_SIMULATION_HEADING);
    expect(standard).toContain("Learning workspace");
    expect(knowledgeRegion).toContain(CANVAS_TAP_SIMULATION_HEADING);
    expect(standard).not.toContain(POW_MODEL_VERSION);
    expect(knowledgeRegion).toContain(POW_MODEL_VERSION);
    expect(copy.skillDescription).not.toContain(contract);
    expect(copy.skillDescription).not.toContain("draw_text");
    expect(copy.skillDescription).not.toContain(CANVAS_TAP_SIMULATION_HEADING);
    expect(textExposesKnowledgeLinkMint(knowledgeRegion)).toBe(false);
    expect(textExposesKnowledgeLinkMint(copy.skillDescription)).toBe(false);
    expect(knowledgeRegion).toContain("buffer_proof_of_work");
    expect(knowledgeRegion).not.toContain("create_tap_link");
    expect(standard).not.toContain("create_tap_link");
    expect(standard).toContain("list_blocks");
  });

  it("appends the canvas and TAP tool catalog to the skill an agent downloads", () => {
    const section = canvasTapSimulationSkillSection();
    const skill = withCanvasTapSimulationSkill("# Partner skill\n\nUse the API.");
    expect(section).toContain(CANVAS_TAP_SIMULATION_HEADING);
    expect(section).toContain("Stored type is tool");
    expect(section).toContain(POW_MODEL_VERSION);
    expect(section).toContain(ILE_WORK_CANVAS_POW_TOOL_NAME);
    expect(section).toContain("board_prompt");
    expect(section).toContain("expand_more");
    expect(section).toContain("metadata.command_id");
    expect(section).toContain(TAP_TRACE_TOOL_NAME);
    expect(section).toContain("system2:send");
    expect(section).toContain(TAP_SPEECH_TOOL_NAME);
    expect(section).toContain("speech_start");
    expect(section).toContain("dictate. metadata.prompt is the transcript");
    for (const id of ILE_WORK_CANVAS_COMMAND_POW_IDS) {
      expect(section).toContain(id);
    }
    expect(skill).toContain(section);
    expect(withCanvasTapSimulationSkill(skill)).toBe(skill.endsWith("\n") ? skill : `${skill}\n`);
    const root = join(__dirname, "../..");
    for (const rel of [
      "app/api/workspace/integration-skill/route.ts",
      "app/api/v3/pow/workspaces/[id]/integration-skill/route.ts",
      "lib/pow-api/mcp-tools/dispatch.ts",
    ]) {
      const src = readFileSync(join(root, rel), "utf8");
      expect(existsSync(join(root, rel))).toBe(true);
      expect(src).toContain("withCanvasTapSimulationSkill(skillResult.text)");
    }
  });

  it("states the same contract on MCP upload and stash buffer, including the version field", () => {
    for (const name of ["upload_proof_of_work", "buffer_proof_of_work"] as const) {
      const tool = mcpTool(name);
      const version = tool.inputSchema.properties.pow_model_version;
      expect(tool.description).toContain(contract);
      expect(tool.inputSchema.required).toContain("pow_model_version");
      expect(version?.enum).toEqual([POW_MODEL_VERSION]);
      expect(version?.description).toContain(contract);
      expect(version?.description).toContain(`Must be ${POW_MODEL_VERSION}`);
      expect(version?.description?.toLowerCase()).not.toContain("optional");
      const summary = AGENT_TOOL_SURFACE.find((entry) => entry.name === name)?.summary;
      expect(summary).toContain(contract);
    }
  });
});
