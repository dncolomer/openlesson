import { describe, expect, it } from "vitest";
import {
  buildMcpClientConfig,
  buildMcpEndpointUrl,
  MCP_EVIDENCE_TOOL_CATALOG,
} from "@/lib/agent-v2/mcp-evidence-catalog";

describe("mcp-evidence-catalog", () => {
  it("builds MCP endpoint URL with encoded key placeholder", () => {
    expect(buildMcpEndpointUrl("https://openlesson.academy", "sk_test/key")).toBe(
      "https://openlesson.academy/api/mcp/sk_test%2Fkey"
    );
  });

  it("includes full Evidence API tool catalog", () => {
    const names = MCP_EVIDENCE_TOOL_CATALOG.map((tool) => tool.name);
    expect(names).toContain("upload_evidence");
    expect(names).toContain("analyze_performance");
    expect(names).toContain("generate_evidence_schema");
    expect(names).toContain("get_learning_progress");
    expect(names.length).toBeGreaterThanOrEqual(11);
  });

  it("emits MCP client config JSON", () => {
    const config = JSON.parse(buildMcpClientConfig("http://localhost:3000"));
    expect(config.mcpServers.openlesson.url).toContain("/api/mcp/");
  });
});