import { describe, expect, it } from "vitest";
import { MCP_PROOF_OF_WORK_TOOL_CATALOG } from "@/lib/pow-api/mcp-proof-of-work-catalog";

describe("MCP_PROOF_OF_WORK_TOOL_CATALOG", () => {
  it("includes the single LWM Snapshot score tool (lwm_snapshot)", () => {
    const names = MCP_PROOF_OF_WORK_TOOL_CATALOG.map((tool) => tool.name);
    expect(names).toContain("lwm_snapshot");
    expect(names).toContain("list_flow_embeddings");
    expect(names).toContain("get_flow_embedding");
    expect(names).not.toContain("verification_score");
    expect(names).not.toContain("augmentation_score");
    expect(names).not.toContain("optimization_score");
  });

  it("documents REST path equivalence and LWM Snapshot in summary", () => {
    const snapshot = MCP_PROOF_OF_WORK_TOOL_CATALOG.find((t) => t.name === "lwm_snapshot");
    expect(snapshot?.summary).toContain("lwm-snapshot");
    expect(snapshot?.summary).toMatch(/LWM Snapshot/i);
    expect(snapshot?.summary.toLowerCase()).toMatch(/tap|ile/);
    expect(snapshot?.summary).toContain("list_flow_embeddings");
    const list = MCP_PROOF_OF_WORK_TOOL_CATALOG.find((t) => t.name === "list_flow_embeddings");
    const get = MCP_PROOF_OF_WORK_TOOL_CATALOG.find((t) => t.name === "get_flow_embedding");
    expect(list?.rest.path).toContain("/flow-embeddings");
    expect(get?.rest.path).toContain("/flow-embeddings");
    expect(list?.summary).toMatch(/gen model/i);
    expect(get?.summary).toMatch(/raw/i);
    expect(list?.summary.toLowerCase()).toContain("lwm_snapshot");
  });

  it("does not expose analyze_performance chat tooling", () => {
    const names = MCP_PROOF_OF_WORK_TOOL_CATALOG.map((tool) => tool.name);
    expect(names).not.toContain("analyze_performance");
  });

  it("does not offer create_workspace (UI-only create)", () => {
    const names = MCP_PROOF_OF_WORK_TOOL_CATALOG.map((tool) => tool.name);
    expect(names).not.toContain("create_workspace");
  });

  it("does not advertise conversion scorecard branding", () => {
    const blob = JSON.stringify(MCP_PROOF_OF_WORK_TOOL_CATALOG);
    expect(blob).not.toContain("conversion_score");
    expect(blob).not.toContain("conversion_goal");
    expect(blob).not.toContain("overall_score");
  });
});
