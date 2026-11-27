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
    expect(surfaces[0]?.entrypoint).toContain("/api/v3/protocols");
    expect(surfaces[0]?.entrypoint).not.toContain("/api/v3/flows");
    expect(surfaces[1]?.entrypoint).toContain("/api/mcp");
    expect(surfaces[1]?.auth).toContain("Bearer");
  });

  it("maps MCP tools to REST equivalents in continuous_evaluation_mcp", () => {
    const policy = buildContinuousEvaluationMcpPolicy("ws-1", "https://uncertain.systems", {
      proof_of_work_artifacts: 0,
      blocks: 3,
    });
    expect(policy.proof_of_work_spec.mcp_tool).toBe("create_protocol");
    expect(policy.proof_of_work_spec.rest_equivalent).toContain("/protocols");
    expect(policy.upload_proof_of_work.rest_equivalent).toContain("/protocols/{protocol_id}");
    expect(policy.upload_proof_of_work?.mcp_tool).toBe("update_protocol");
    expect(policy.performance.mcp_tool).toBe("list_protocols");
    expect(policy.progress_snapshot.mcp_tool).toBe("get_protocol");
  });

  it("recommends schema before first upload and performance after proof of work exists", () => {
    const cold = recommendIntegrationActions({
      proof_of_work_artifacts: 0,
      blocks: 2,
      has_workspace_goal: true,
      workspace_kind: "knowledge_region",
    });
    expect(cold.some((a) => a.mcp_tool === "create_protocol")).toBe(true);
    expect(cold.some((a) => a.mcp_tool === "create_knowledge_region")).toBe(true);

    const warm = recommendIntegrationActions({
      proof_of_work_artifacts: 6,
      blocks: 2,
      has_workspace_goal: true,
      workspace_kind: "knowledge_region",
    });
    expect(warm.some((a) => a.mcp_tool === "update_protocol")).toBe(true);
    expect(warm.some((a) => a.mcp_tool === "get_protocol")).toBe(true);
  });

  it("serves MCP resource markdown for scope and proof-of-work loop", () => {
    const scope = buildMcpResourceContent("uncertain-systems://integration-scope", "https://uncertain.systems");
    expect(scope).toContain("Uncertain Systems");
    expect(scope).toContain("REST");

    const loop = buildMcpResourceContent("uncertain-systems://proof-of-work-loop", "https://uncertain.systems");
    expect(loop).toContain("create_protocol");
    expect(loop).toContain("list_protocols");
    expect(loop).toContain("get_protocol");
    expect(loop).toContain("update_protocol");
    expect(loop).toContain("create_knowledge_region");
    expect(loop).toContain("get_knowledge_region_options");
    expect(loop).not.toContain("create_flow");
    expect(loop).not.toContain("link_flow");
    expect(loop).not.toContain("apply_map_tool");
    expect(loop).not.toContain("get_learning_progress");
    expect(loop).not.toContain("lwm_snapshot");
    expect(loop).toContain("continuous_evaluation_mcp");
  });
});