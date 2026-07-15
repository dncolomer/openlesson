import { describe, expect, it } from "vitest";
import {
  buildMcpClientConfig,
  buildMcpEndpointUrl,
  MCP_PROOF_OF_WORK_TOOL_CATALOG,
} from "@/lib/agent-v2/mcp-proof-of-work-catalog";

describe("mcp-proof-of-work-catalog", () => {
  it("builds MCP endpoint URL without embedding the API key", () => {
    expect(buildMcpEndpointUrl("https://uncertain.systems")).toBe(
      "https://uncertain.systems/api/mcp"
    );
  });

  it("includes full Proof-of-Work API tool catalog", () => {
    const names = MCP_PROOF_OF_WORK_TOOL_CATALOG.map((tool) => tool.name);
    expect(names).toContain("upload_proof_of_work");
    expect(names).toContain("analyze_performance");
    expect(names).toContain("generate_proof_of_work_schema");
    expect(names).toContain("get_learning_progress");
    expect(names).not.toContain("pumadoc_customer_agent_toolkit");
    expect(names.length).toBe(11);
  });

  it("emits MCP client config JSON with Bearer auth header", () => {
    const config = JSON.parse(buildMcpClientConfig("http://localhost:3000", "sk_test"));
    expect(config.mcpServers.openlesson.type).toBe("streamable-http");
    expect(config.mcpServers.openlesson.url).toBe("http://localhost:3000/api/mcp");
    expect(config.mcpServers.openlesson.headers.Authorization).toBe("Bearer sk_test");
  });
});