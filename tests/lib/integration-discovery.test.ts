import { describe, expect, it } from "vitest";
import {
  buildContinuousEvaluationMcpPolicy,
  buildIntegrationSurfaces,
  buildMcpResourceContent,
  recommendIntegrationActions,
} from "@/lib/pow-api/integration-discovery";

describe("integration-discovery", () => {
  it("builds dual REST and MCP surfaces", () => {
    const surfaces = buildIntegrationSurfaces("https://uncertain.systems");
    expect(surfaces).toHaveLength(2);
    expect(surfaces.map((s) => s.transport)).toEqual(["rest", "mcp"]);
    expect(surfaces[0]?.entrypoint).toContain("/api/v3/workspaces");
    expect(surfaces[1]?.entrypoint).toContain("/api/mcp");
    expect(surfaces[1]?.auth).toContain("Bearer");
  });

  it("maps MCP tools to REST equivalents in continuous_evaluation_mcp", () => {
    const policy = buildContinuousEvaluationMcpPolicy("ws-1", "https://uncertain.systems", {
      proof_of_work_artifacts: 0,
      blocks: 3,
    });
    expect(policy.proof_of_work_spec.mcp_tool).toBe("create_flow");
    expect(policy.proof_of_work_spec.rest_equivalent).toContain("/flows");
    expect(policy.upload_proof_of_work.rest_equivalent).toContain("/flows/{flow_id}/link");
    expect(policy.upload_proof_of_work?.mcp_tool).toBe("link_flow");
    expect(policy.performance.mcp_tool).toBe("apply_map_tool");
    expect(policy.progress_snapshot.mcp_tool).toBe("get_workspace");
  });

  it("recommends schema before first upload and performance after proof of work exists", () => {
    const cold = recommendIntegrationActions({
      proof_of_work_artifacts: 0,
      blocks: 2,
      has_workspace_goal: true,
      workspace_kind: "knowledge_region",
    });
    expect(cold.some((a) => a.mcp_tool === "create_flow")).toBe(true);

    const warm = recommendIntegrationActions({
      proof_of_work_artifacts: 6,
      blocks: 2,
      has_workspace_goal: true,
      workspace_kind: "knowledge_region",
    });
    expect(warm.some((a) => a.mcp_tool === "apply_map_tool")).toBe(true);
    expect(warm.some((a) => a.mcp_tool === "link_flow")).toBe(true);
  });

  it("serves MCP resource markdown for scope and proof-of-work loop", () => {
    const scope = buildMcpResourceContent("uncertain-systems://integration-scope", "https://uncertain.systems");
    expect(scope).toContain("Uncertain Systems");
    expect(scope).toContain("REST");

    const loop = buildMcpResourceContent("uncertain-systems://proof-of-work-loop", "https://uncertain.systems");
    expect(loop).toContain("get_workspace");
    expect(loop).toContain("create_flow");
    expect(loop).toContain("link_flow");
    expect(loop).toContain("apply_map_tool");
    expect(loop).not.toContain("get_learning_progress");
    expect(loop).not.toContain("lwm_snapshot");
    expect(loop).toContain("continuous_evaluation_mcp");
  });
});