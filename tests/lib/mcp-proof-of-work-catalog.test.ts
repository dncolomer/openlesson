import { describe, expect, it } from "vitest";
import { MCP_PROOF_OF_WORK_TOOL_CATALOG } from "@/lib/pow-api/mcp-proof-of-work-catalog";

describe("MCP_PROOF_OF_WORK_TOOL_CATALOG", () => {
  it("includes the single LWM Snapshot score tool (lwm_snapshot)", () => {
    const names = MCP_PROOF_OF_WORK_TOOL_CATALOG.map((tool) => tool.name);
    expect(names).toContain("lwm_snapshot");
    expect(names).not.toContain("verification_score");
    expect(names).not.toContain("augmentation_score");
    expect(names).not.toContain("optimization_score");
  });

  it("documents REST path equivalence and LWM Snapshot in summary", () => {
    const snapshot = MCP_PROOF_OF_WORK_TOOL_CATALOG.find((t) => t.name === "lwm_snapshot");
    expect(snapshot?.summary).toContain("lwm-snapshot");
    expect(snapshot?.summary).toMatch(/LWM Snapshot/i);
    expect(snapshot?.summary.toLowerCase()).toMatch(/tap|ile/);
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
