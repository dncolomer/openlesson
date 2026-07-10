import { describe, expect, it } from "vitest";
import {
  buildMcpClientConfig,
  buildMcpEndpointUrl,
  MCP_EVIDENCE_TOOL_CATALOG,
} from "@/lib/agent-v2/mcp-evidence-catalog";

describe("mcp-evidence-catalog", () => {
  it("builds MCP endpoint URL without embedding the API key", () => {
    expect(buildMcpEndpointUrl("https://openlesson.academy")).toBe(
      "https://openlesson.academy/api/mcp"
    );
  });

  it("includes full Evidence API tool catalog", () => {
    const names = MCP_EVIDENCE_TOOL_CATALOG.map((tool) => tool.name);
    expect(names).toContain("upload_evidence");
    expect(names).toContain("analyze_performance");
    expect(names).toContain("generate_evidence_schema");
    expect(names).toContain("get_learning_progress");
    expect(names).not.toContain("pumadoc_customer_agent_toolkit");
    expect(names.length).toBe(12);
  });

  it("emits MCP client config JSON with Bearer auth header", () => {
    const config = JSON.parse(buildMcpClientConfig("http://localhost:3000", "sk_test"));
    expect(config.mcpServers.openlesson.type).toBe("streamable-http");
    expect(config.mcpServers.openlesson.url).toBe("http://localhost:3000/api/mcp");
    expect(config.mcpServers.openlesson.headers.Authorization).toBe("Bearer sk_test");
  });
});