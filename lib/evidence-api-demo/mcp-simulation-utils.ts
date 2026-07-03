import type { McpToolDescriptor } from "./mcp-simulation-types";

export function pickDefaultMcpTool(
  tools: McpToolDescriptor[],
  planId: string | null
): string {
  if (planId) {
    const preferred = ["list_blocks", "list_ghl_links", "list_workspaces"];
    for (const name of preferred) {
      if (tools.some((tool) => tool.name === name)) return name;
    }
    const workspaceTool = tools.find(
      (tool) => tool.name.includes("workspace") || tool.name.includes("block")
    );
    if (workspaceTool) return workspaceTool.name;
  }
  return tools[0]?.name ?? "";
}

export function suggestMcpToolArgs(toolName: string, planId: string | null): Record<string, unknown> {
  if (!planId) return {};

  if (
    toolName === "list_blocks" ||
    toolName === "list_ghl_links" ||
    toolName === "list_workspaces" ||
    toolName.includes("workspace")
  ) {
    return { workspace_id: planId };
  }

  return {};
}

export function usesWorkspaceArgs(toolName: string): boolean {
  return (
    toolName === "list_blocks" ||
    toolName === "list_ghl_links" ||
    toolName.includes("workspace")
  );
}