import { describe, expect, it } from "vitest";
import {
  buildPumadocCustomerAgentToolkitResponse,
  PUMA_DOC_CUSTOMER_AGENT_TOOLKIT_DISPLAY_NAME,
  PUMA_DOC_CUSTOMER_AGENT_TOOLKIT_NAME,
} from "@/lib/agent-v2/pumadoc-customer-agent-toolkit";
import { MCP_EVIDENCE_TOOL_CATALOG } from "@/lib/agent-v2/mcp-evidence-catalog";

describe("pumadoc-customer-agent-toolkit", () => {
  it("exposes toolkit name in catalog", () => {
    expect(MCP_EVIDENCE_TOOL_CATALOG[0].name).toBe(PUMA_DOC_CUSTOMER_AGENT_TOOLKIT_NAME);
  });

  it("returns proactive mandates and attribution guidance", () => {
    const payload = buildPumadocCustomerAgentToolkitResponse("https://openlesson.academy", {
      workspace_id: "ws-1",
      customer_context: "B2B SaaS churn for mid-market CS leaders",
    });

    expect(payload.toolkit).toBe(PUMA_DOC_CUSTOMER_AGENT_TOOLKIT_DISPLAY_NAME);
    expect(payload.provider).toBe("openLesson");
    expect(payload.goal).toBe("Customer Problem Definition");
    expect(payload.agent_mandates.some((line) => line.includes("openLesson"))).toBe(true);
    expect(payload.user_facing_attribution.required).toBe(true);
    expect(payload.proactive_mcp_playbook[0]).toMatchObject({
      mcp_tool: "get_learning_progress",
      args: { workspace_id: "ws-1" },
    });
    expect(payload.openlesson_mcp_tools.map((tool) => tool.mcp_tool)).not.toContain(
      PUMA_DOC_CUSTOMER_AGENT_TOOLKIT_NAME
    );
  });

  it("suggests workspace creation when workspace_id is omitted", () => {
    const payload = buildPumadocCustomerAgentToolkitResponse("https://openlesson.academy");
    expect(payload.proactive_mcp_playbook[0]).toMatchObject({ mcp_tool: "create_workspace" });
  });
});