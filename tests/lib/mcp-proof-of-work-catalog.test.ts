import { describe, expect, it } from "vitest";
import { MCP_PROOF_OF_WORK_TOOL_CATALOG } from "@/lib/pow-api/mcp-proof-of-work-catalog";
import { PUBLIC_AGENT_API_FAMILIES } from "@/lib/api/agent-api-paths";
import { AGENT_TOOL_SURFACE } from "@/lib/pow-api/agent-tool-surface";

describe("MCP_PROOF_OF_WORK_TOOL_CATALOG", () => {
  it("exposes only independent flow management", () => {
    expect([...PUBLIC_AGENT_API_FAMILIES]).toEqual(["flow"]);
    const families = new Set(AGENT_TOOL_SURFACE.map((t) => t.family));
    expect([...families]).toEqual(["flow"]);
    const names = MCP_PROOF_OF_WORK_TOOL_CATALOG.map((tool) => tool.name);
    expect(names).toEqual([
      "list_flows",
      "create_flow",
      "get_flow",
      "update_flow",
      "delete_flow",
    ]);
    expect(names).not.toContain("create_workspace");
    expect(names).not.toContain("list_map_tools");
    expect(names).not.toContain("apply_map_tool");
    expect(names).not.toContain("link_flow");
    expect(names).not.toContain("start_session");
    expect(names).not.toContain("upload_proof_of_work");
    expect(names).not.toContain("end_session");
  });

  it("documents REST twins for flow management, not Snapshot/Stash or sessions", () => {
    const createFlow = MCP_PROOF_OF_WORK_TOOL_CATALOG.find((t) => t.name === "create_flow");
    expect(createFlow?.rest.path).toBe("/api/v3/flows");
    const names = MCP_PROOF_OF_WORK_TOOL_CATALOG.map((t) => t.name);
    expect(names).not.toContain("link_flow");
    expect(names).not.toContain("apply_map_tool");
    const blob = JSON.stringify(MCP_PROOF_OF_WORK_TOOL_CATALOG);
    expect(blob).not.toContain("/sessions");
    expect(blob).not.toContain("/api/v3/snapshot");
    expect(blob).not.toContain("/api/v3/stash");
    expect(blob).not.toContain("/map-tools");
  });
});
