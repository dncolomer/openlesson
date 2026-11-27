import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  AGENT_API_PUBLIC_ERRORS,
  AGENT_API_SCHEMAS,
  AGENT_API_STRATEGY_IDS,
  protocolApiSkillMarkdown,
} from "@/lib/pow-api/agent-api-docs";
import { AGENT_TOOL_SURFACE } from "@/lib/pow-api/agent-tool-surface";
import { EXPLORATION_STRATEGY_IDS } from "@/lib/region-simulation";
import { MCP_EVIDENCE_TOOLS } from "@/lib/pow-api/mcp-tools/evidence-tools";

const ROOT = join(__dirname, "../..");

describe("agent API docs catalog", () => {
  it("lists built-in strategy ids and prompt-shaped custom strategies", () => {
    expect(AGENT_API_STRATEGY_IDS).toEqual([...EXPLORATION_STRATEGY_IDS]);
    const create = MCP_EVIDENCE_TOOLS.find((tool) => tool.name === "create_knowledge_region");
    const custom = JSON.stringify(create?.inputSchema.properties.custom_strategies || {});
    expect(custom).toContain("prompt");
    expect(custom).toContain("Prompt-only");
  });

  it("covers public errors and complex schemas used by the docs UI", () => {
    expect(AGENT_API_PUBLIC_ERRORS.map((error) => error.code)).toEqual(
      expect.arrayContaining([
        "unauthorized",
        "api_plan_required",
        "organization_id_required",
        "rate_limit_exceeded",
        "not_found",
        "validation_error",
      ]),
    );
    expect(AGENT_API_SCHEMAS.map((schema) => schema.id)).toEqual(
      expect.arrayContaining([
        "enforced_channels",
        "answers_model_seed",
        "custom_strategies",
        "simulation_job",
        "knowledge_region",
        "candidate",
        "uncertainty_model",
      ]),
    );
  });

  it("keeps public/skill.md equal to the generated catalog", () => {
    const skill = protocolApiSkillMarkdown();
    expect(readFileSync(join(ROOT, "public/skill.md"), "utf8")).toBe(skill);
    expect(skill).toContain("generate_problem_on_open");
    expect(skill).toContain("get_protocol_url");
    expect(skill).toContain("full-access");
    for (const id of EXPLORATION_STRATEGY_IDS) {
      expect(skill).toContain(id);
    }
    expect(skill).toContain("{ prompt }");
    expect(skill).toContain("error.code");
    expect(skill).toContain("answers_model_seed");
    for (const tool of AGENT_TOOL_SURFACE) {
      expect(skill).toContain(tool.name);
    }
  });
});
