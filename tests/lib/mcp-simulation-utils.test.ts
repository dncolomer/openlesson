import { describe, expect, it } from "vitest";
import {
  pickDefaultMcpTool,
  suggestMcpToolArgs,
  usesWorkspaceArgs,
} from "@/lib/evidence-api-demo/mcp-simulation-utils";

describe("mcp-simulation-utils", () => {
  it("prefers list_blocks when a workspace id is available", () => {
    const tool = pickDefaultMcpTool(
      [
        { name: "list_workspaces" },
        { name: "list_blocks" },
        { name: "get_tap_results" },
      ],
      "plan-123"
    );
    expect(tool).toBe("list_blocks");
  });

  it("suggests workspace_id args for workspace tools", () => {
    expect(suggestMcpToolArgs("list_blocks", "plan-123")).toEqual({
      workspace_id: "plan-123",
    });
    expect(usesWorkspaceArgs("list_blocks")).toBe(true);
  });
});