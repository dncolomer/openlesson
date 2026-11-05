import { describe, expect, it } from "vitest";
import { MCP_PROOF_OF_WORK_TOOL_CATALOG } from "@/lib/pow-api/mcp-proof-of-work-catalog";
import { PUBLIC_AGENT_API_FAMILIES } from "@/lib/api/agent-api-paths";
import { AGENT_TOOL_SURFACE } from "@/lib/pow-api/agent-tool-surface";

describe("MCP_PROOF_OF_WORK_TOOL_CATALOG", () => {
  it("exposes only the workspace family: Learning Map and flow management", () => {
    expect([...PUBLIC_AGENT_API_FAMILIES]).toEqual(["workspace"]);
    const families = new Set(AGENT_TOOL_SURFACE.map((t) => t.family));
    expect([...families]).toEqual(["workspace"]);
    const names = MCP_PROOF_OF_WORK_TOOL_CATALOG.map((tool) => tool.name);
    expect(names).toContain("create_workspace");
    expect(names).toContain("update_workspace");
    expect(names).toContain("list_map_tools");
    expect(names).toContain("apply_map_tool");
    expect(names).toContain("list_flows");
    expect(names).toContain("create_flow");
    expect(names).toContain("get_flow");
    expect(names).toContain("update_flow");
    expect(names).toContain("link_flow");
    expect(names).toContain("delete_flow");
    expect(names).not.toContain("start_session");
    expect(names).not.toContain("upload_proof_of_work");
    expect(names).not.toContain("end_session");
    expect(names).not.toContain("list_flow_embeddings");
    expect(names).not.toContain("get_flow_embedding");
    expect(names).not.toContain("lwm_snapshot");
    expect(names).not.toContain("buffer_proof_of_work");
    expect(names).not.toContain("stash_proof_of_work");
    expect(names).not.toContain("submit_stashed_proof_of_work");
    expect(names).not.toContain("create_tapbench_link");
    expect(names).not.toContain("verification_score");
    expect(names).not.toContain("augmentation_score");
    expect(names).not.toContain("optimization_score");
  });

  it("documents REST twins for map and flow management, not Snapshot/Stash or sessions", () => {
    const createFlow = MCP_PROOF_OF_WORK_TOOL_CATALOG.find((t) => t.name === "create_flow");
    const linkFlow = MCP_PROOF_OF_WORK_TOOL_CATALOG.find((t) => t.name === "link_flow");
    const applyMap = MCP_PROOF_OF_WORK_TOOL_CATALOG.find((t) => t.name === "apply_map_tool");
    expect(createFlow?.rest.path).toBe("/api/v3/flows");
    expect(linkFlow?.rest.path).toBe("/api/v3/flows/{flow_id}/link");
    expect(applyMap?.rest.path).toContain("/map-tools");
    const blob = JSON.stringify(MCP_PROOF_OF_WORK_TOOL_CATALOG);
    expect(blob).not.toContain("/sessions");
    expect(blob).not.toContain("/api/v3/snapshot");
    expect(blob).not.toContain("/api/v3/stash");
    expect(blob).not.toContain("/api/v3/tapbench");
  });

  it("does not expose analyze_performance chat tooling", () => {
    const names = MCP_PROOF_OF_WORK_TOOL_CATALOG.map((tool) => tool.name);
    expect(names).not.toContain("analyze_performance");
  });

  it("does not advertise conversion scorecard branding", () => {
    const blob = JSON.stringify(MCP_PROOF_OF_WORK_TOOL_CATALOG);
    expect(blob).not.toContain("conversion_score");
    expect(blob).not.toContain("conversion_goal");
    expect(blob).not.toContain("overall_score");
  });
});
