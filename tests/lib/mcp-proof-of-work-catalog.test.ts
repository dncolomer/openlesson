import { describe, expect, it } from "vitest";
import { MCP_PROOF_OF_WORK_TOOL_CATALOG } from "@/lib/pow-api/mcp-proof-of-work-catalog";
import { PUBLIC_AGENT_API_FAMILIES } from "@/lib/api/agent-api-paths";
import { AGENT_TOOL_SURFACE } from "@/lib/pow-api/agent-tool-surface";

describe("MCP_PROOF_OF_WORK_TOOL_CATALOG", () => {
  it("exposes exactly the two public families: workspace management and headless PoW", () => {
    expect([...PUBLIC_AGENT_API_FAMILIES]).toEqual(["workspace", "pow"]);
    const families = new Set(AGENT_TOOL_SURFACE.map((t) => t.family));
    expect([...families].sort()).toEqual(["pow", "workspace"]);
    const names = MCP_PROOF_OF_WORK_TOOL_CATALOG.map((tool) => tool.name);
    expect(names).toContain("create_workspace");
    expect(names).toContain("update_workspace");
    expect(names).toContain("start_session");
    expect(names).toContain("upload_proof_of_work");
    expect(names).toContain("end_session");
    expect(names).toContain("list_flow_embeddings");
    expect(names).toContain("get_flow_embedding");
    expect(names).not.toContain("lwm_snapshot");
    expect(names).not.toContain("buffer_proof_of_work");
    expect(names).not.toContain("stash_proof_of_work");
    expect(names).not.toContain("submit_stashed_proof_of_work");
    expect(names).not.toContain("create_tapbench_link");
    expect(names).not.toContain("verification_score");
    expect(names).not.toContain("augmentation_score");
    expect(names).not.toContain("optimization_score");
  });

  it("documents REST twins for headless sessions, not Snapshot/Stash bases", () => {
    const start = MCP_PROOF_OF_WORK_TOOL_CATALOG.find((t) => t.name === "start_session");
    const upload = MCP_PROOF_OF_WORK_TOOL_CATALOG.find((t) => t.name === "upload_proof_of_work");
    const end = MCP_PROOF_OF_WORK_TOOL_CATALOG.find((t) => t.name === "end_session");
    expect(start?.rest.path).toContain("/sessions");
    expect(upload?.rest.path).toContain("/sessions/{session_id}/proof-of-work");
    expect(end?.rest.path).toContain("/sessions/{session_id}/end");
    const blob = JSON.stringify(MCP_PROOF_OF_WORK_TOOL_CATALOG);
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
