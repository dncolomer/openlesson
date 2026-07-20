import { describe, expect, it } from "vitest";
import { MCP_PROOF_OF_WORK_TOOL_CATALOG } from "@/lib/agent-v2/mcp-proof-of-work-catalog";

describe("MCP_PROOF_OF_WORK_TOOL_CATALOG", () => {
  it("includes the three vertical score tools by name", () => {
    const names = MCP_PROOF_OF_WORK_TOOL_CATALOG.map((tool) => tool.name);
    expect(names).toContain("verification_score");
    expect(names).toContain("augmentation_score");
    expect(names).toContain("optimization_score");
  });

  it("documents REST path equivalence in summaries", () => {
    const verification = MCP_PROOF_OF_WORK_TOOL_CATALOG.find((t) => t.name === "verification_score");
    const augmentation = MCP_PROOF_OF_WORK_TOOL_CATALOG.find((t) => t.name === "augmentation_score");
    const optimization = MCP_PROOF_OF_WORK_TOOL_CATALOG.find((t) => t.name === "optimization_score");
    expect(verification?.summary).toContain("verification-score");
    expect(augmentation?.summary).toContain("augmentation-score");
    expect(optimization?.summary).toContain("optimization-score");
    expect(verification?.summary.toLowerCase()).toContain("tap");
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
