import { describe, expect, it } from "vitest";
import {
  buildContinuousEvaluationMcpPolicy,
  buildIntegrationSurfaces,
  buildMcpResourceContent,
  recommendIntegrationActions,
} from "@/lib/agent-v2/integration-discovery";

describe("integration-discovery", () => {
  it("builds dual REST and MCP surfaces", () => {
    const surfaces = buildIntegrationSurfaces("https://uncertain.systems");
    expect(surfaces).toHaveLength(2);
    expect(surfaces.map((s) => s.transport)).toEqual(["rest", "mcp"]);
    expect(surfaces[0]?.entrypoint).toContain("/api/v2/agent");
    expect(surfaces[1]?.entrypoint).toContain("/api/mcp");
    expect(surfaces[1]?.auth).toContain("Bearer");
  });

  it("maps MCP tools to REST equivalents in continuous_evaluation_mcp", () => {
    const policy = buildContinuousEvaluationMcpPolicy("ws-1", "https://uncertain.systems", {
      proof_of_work_artifacts: 0,
      blocks: 3,
    });
    expect(policy.proof_of_work_spec.mcp_tool).toBe("generate_proof_of_work_schema");
    expect(policy.proof_of_work_spec.rest_equivalent).toContain("/proof-of-work-schema");
    expect(policy.upload_proof_of_work?.mcp_tool).toBe("upload_proof_of_work");
    expect(policy.performance.mcp_tool).toBe("analyze_performance");
    expect(policy.progress_snapshot.mcp_tool).toBe("get_learning_progress");
  });

  it("recommends schema before first upload and performance after proof of work exists", () => {
    const cold = recommendIntegrationActions({
      proof_of_work_artifacts: 0,
      blocks: 2,

      has_conversion_goal: true,
    });
    expect(cold.some((a) => a.mcp_tool === "generate_proof_of_work_schema")).toBe(true);

    const warm = recommendIntegrationActions({
      proof_of_work_artifacts: 6,
      blocks: 2,

      has_conversion_goal: true,
    });
    expect(warm.some((a) => a.mcp_tool === "analyze_performance")).toBe(true);
    expect(warm.some((a) => a.rest_equivalent.includes("performance"))).toBe(true);
  });

  it("serves MCP resource markdown for scope and proof-of-work loop", () => {
    const scope = buildMcpResourceContent("openlesson://integration-scope", "https://uncertain.systems");
    expect(scope).toContain("Uncertain Systems");
    expect(scope).toContain("REST");

    const loop = buildMcpResourceContent("openlesson://proof-of-work-loop", "https://uncertain.systems");
    expect(loop).toContain("get_learning_progress");
    expect(loop).toContain("continuous_evaluation_mcp");
  });
});