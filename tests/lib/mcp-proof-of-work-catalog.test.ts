import { describe, expect, it } from "vitest";
import {
  MCP_PROOF_OF_WORK_TOOL_CATALOG,
  PROTOCOL_API_SKILL_PATH,
  buildSkillFileUrl,
} from "@/lib/pow-api/mcp-proof-of-work-catalog";
import { PUBLIC_AGENT_API_FAMILIES } from "@/lib/api/agent-api-paths";
import { AGENT_TOOL_SURFACE } from "@/lib/pow-api/agent-tool-surface";

describe("MCP_PROOF_OF_WORK_TOOL_CATALOG", () => {
  it("exposes protocol and knowledge-region management", () => {
    expect([...PUBLIC_AGENT_API_FAMILIES]).toEqual(["protocol", "knowledge_region"]);
    const families = new Set(AGENT_TOOL_SURFACE.map((t) => t.family));
    expect([...families]).toEqual(["protocol", "knowledge_region"]);
    const names = MCP_PROOF_OF_WORK_TOOL_CATALOG.map((tool) => tool.name);
    expect(names).toEqual([
      "list_protocols",
      "create_protocol",
      "upload_protocol_file",
      "generate_protocol_unsys_seed",
      "get_protocol",
      "get_protocol_url",
      "update_protocol",
      "delete_protocol",
      "list_knowledge_regions",
      "get_knowledge_region_options",
      "create_knowledge_region",
      "get_knowledge_region",
      "update_knowledge_region",
      "delete_knowledge_region",
      "simulate_knowledge_region",
      "get_knowledge_region_job",
      "get_knowledge_region_run",
      "get_knowledge_region_candidate",
      "get_knowledge_region_uncertainty_model",
    ]);
    expect(names).not.toContain("create_flow");
    expect(names).not.toContain("create_workspace");
    expect(names).not.toContain("list_map_tools");
    expect(names).not.toContain("apply_map_tool");
    expect(names).not.toContain("link_flow");
    expect(names).not.toContain("start_session");
    expect(names).not.toContain("upload_proof_of_work");
    expect(names).not.toContain("end_session");
  });

  it("documents REST twins for flow management, not Snapshot/Stash or sessions", () => {
    const createProtocol = MCP_PROOF_OF_WORK_TOOL_CATALOG.find((t) => t.name === "create_protocol");
    expect(createProtocol?.rest.path).toBe("/api/v3/protocols");
    const upload = MCP_PROOF_OF_WORK_TOOL_CATALOG.find((t) => t.name === "upload_protocol_file");
    expect(upload?.rest.path).toBe("/api/v3/protocols/files");
    const unsys = MCP_PROOF_OF_WORK_TOOL_CATALOG.find((t) => t.name === "generate_protocol_unsys_seed");
    expect(unsys?.rest.path).toBe("/api/v3/protocols/unsys-seed");
    const names = MCP_PROOF_OF_WORK_TOOL_CATALOG.map((t) => t.name);
    expect(names).not.toContain("link_flow");
    expect(names).not.toContain("apply_map_tool");
    const createRegion = MCP_PROOF_OF_WORK_TOOL_CATALOG.find(
      (t) => t.name === "create_knowledge_region",
    );
    expect(createRegion?.rest.path).toBe("/api/v3/knowledge-regions");
    const options = MCP_PROOF_OF_WORK_TOOL_CATALOG.find(
      (t) => t.name === "get_knowledge_region_options",
    );
    expect(options?.rest.path).toBe("/api/v3/knowledge-regions/options");
    const blob = JSON.stringify(MCP_PROOF_OF_WORK_TOOL_CATALOG);
    expect(blob).toContain("/api/v3/knowledge-regions");
    expect(blob).not.toContain("/sessions");
    expect(blob).not.toContain("/api/v3/snapshot");
    expect(blob).not.toContain("/api/v3/stash");
    expect(blob).not.toContain("/map-tools");
  });

  it("exposes the public Protocol API skill path", () => {
    expect(PROTOCOL_API_SKILL_PATH).toBe("/skill.md");
    expect(buildSkillFileUrl("https://uncertain.systems")).toBe(
      "https://uncertain.systems/skill.md",
    );
  });
});
