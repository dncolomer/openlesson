import { describe, expect, it } from "vitest";
import {
  buildContinuousEvaluationMcpPolicy,
  buildIntegrationSurfaces,
  buildMcpResourceContent,
  recommendIntegrationActions,
} from "@/lib/agent-v2/integration-discovery";

describe("integration-discovery", () => {
  it("builds dual REST and MCP surfaces", () => {
    const surfaces = buildIntegrationSurfaces("https://openlesson.academy");
    expect(surfaces).toHaveLength(2);
    expect(surfaces.map((s) => s.transport)).toEqual(["rest", "mcp"]);
    expect(surfaces[0]?.entrypoint).toContain("/api/v2/agent");
    expect(surfaces[1]?.entrypoint).toContain("/api/mcp/");
  });

  it("maps MCP tools to REST equivalents in continuous_evaluation_mcp", () => {
    const policy = buildContinuousEvaluationMcpPolicy("ws-1", "https://openlesson.academy", {
      evidence_artifacts: 0,
      blocks: 3,
    });
    expect(policy.evidence_spec.mcp_tool).toBe("generate_evidence_schema");
    expect(policy.evidence_spec.rest_equivalent).toContain("/evidence-schema");
    expect(policy.upload_evidence?.mcp_tool).toBe("upload_evidence");
    expect(policy.performance.mcp_tool).toBe("analyze_performance");
    expect(policy.progress_snapshot.mcp_tool).toBe("get_learning_progress");
  });

  it("recommends schema before first upload and performance after evidence exists", () => {
    const cold = recommendIntegrationActions({
      evidence_artifacts: 0,
      blocks: 2,
      tap_sessions: 0,
      has_conversion_goal: true,
    });
    expect(cold.some((a) => a.mcp_tool === "generate_evidence_schema")).toBe(true);

    const warm = recommendIntegrationActions({
      evidence_artifacts: 6,
      blocks: 2,
      tap_sessions: 0,
      has_conversion_goal: true,
    });
    expect(warm.some((a) => a.mcp_tool === "analyze_performance")).toBe(true);
    expect(warm.some((a) => a.rest_equivalent.includes("performance"))).toBe(true);
  });

  it("serves MCP resource markdown for scope and evidence loop", () => {
    const scope = buildMcpResourceContent("openlesson://integration-scope", "https://openlesson.academy");
    expect(scope).toContain("OpenLesson");
    expect(scope).toContain("REST");

    const loop = buildMcpResourceContent("openlesson://evidence-loop", "https://openlesson.academy");
    expect(loop).toContain("get_learning_progress");
    expect(loop).toContain("continuous_evaluation_mcp");
  });
});