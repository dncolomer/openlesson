import { describe, expect, it } from "vitest";
import {
  handleJsonRpc,
  mcpEndpointDiscoveryResponse,
} from "@/lib/pow-api/mcp-jsonrpc-handler";
import type { AuthContext } from "@/lib/pow-api/types";

const auth: AuthContext = {
  key_id: "key-1",
  user_id: "user-1",
  guest_user_id: null,
  organization_id: null,
  is_org_admin: false,
  scopes: ["workspaces:read", "workspaces:write", "tap:read", "tap:write"],
};

describe("mcp-jsonrpc-handler", () => {
  it("returns initialize result with protocol version", async () => {
    const response = await handleJsonRpc(
      { jsonrpc: "2.0", id: 1, method: "initialize", params: {} },
      auth,
      {},
      "https://uncertain.systems"
    );

    expect(response?.result).toMatchObject({
      protocolVersion: "2025-03-26",
      serverInfo: { name: "uncertain-systems-proof-of-work-api" },
    });
  });

  it("lists MCP tools without create_workspace", async () => {
    const response = await handleJsonRpc(
      { jsonrpc: "2.0", id: 2, method: "tools/list", params: {} },
      auth,
      {},
      "https://uncertain.systems"
    );

    const tools = (response?.result as { tools?: { name: string }[] })?.tools ?? [];
    const names = tools.map((tool) => tool.name);
    expect(names).toContain("list_workspaces");
    expect(names).toContain("upload_proof_of_work");
    expect(names).not.toContain("create_workspace");
  });

  it("emits absolute endpoint URLs for streamable HTTP discovery", async () => {
    const response = mcpEndpointDiscoveryResponse("https://uncertain.systems/api/mcp");
    expect(response.headers.get("Content-Type")).toContain("text/event-stream");
    const body = await response.text();
    expect(body).toContain("event: endpoint");
    expect(body).toContain("data: https://uncertain.systems/api/mcp");
  });
});