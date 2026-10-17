/**
 * Programmatic workspace create is part of the public workspace-management API.
 * Drives the shipped catalog, MCP tools/list, REST twins, and skill copy.
 */
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  MCP_EVIDENCE_TOOLS,
} from "@/lib/pow-api/mcp-proof-of-work-server";
import { MCP_PROOF_OF_WORK_TOOL_CATALOG } from "@/lib/pow-api/mcp-proof-of-work-catalog";
import { AGENT_TOOL_SURFACE, agentToolNames } from "@/lib/pow-api/agent-tool-surface";
import { WORKSPACE_API_BASE } from "@/lib/api/agent-api-paths";

const ROOT = path.resolve(__dirname, "../..");

describe("programmatic workspace create enabled", () => {
  it("catalog, MCP tools/list, and REST twins include create_workspace", () => {
    const names = agentToolNames();
    expect(names).toContain("create_workspace");
    expect(MCP_PROOF_OF_WORK_TOOL_CATALOG.map((t) => t.name)).toContain("create_workspace");
    expect(MCP_EVIDENCE_TOOLS.map((t) => t.name)).toContain("create_workspace");
    const tool = AGENT_TOOL_SURFACE.find((t) => t.name === "create_workspace");
    expect(tool?.rest.method).toBe("POST");
    expect(tool?.rest.path).toBe(WORKSPACE_API_BASE);
  });

  it("canonical create route is POST /api/v3/workspaces, not a UI-only reject", () => {
    const canonical = fs.readFileSync(
      path.join(ROOT, "app/api/v3/workspaces/route.ts"),
      "utf8",
    );
    expect(canonical).toContain("export async function POST");
    expect(canonical).toContain("createManagedWorkspace");
    expect(canonical).not.toContain("WORKSPACE_CREATE_UI_ONLY_MESSAGE");
    expect(canonical).not.toContain("rejectProgrammaticWorkspaceCreate");

    const powAlias = fs.readFileSync(
      path.join(ROOT, "app/api/v3/pow/workspaces/route.ts"),
      "utf8",
    );
    expect(powAlias).toContain("export async function GET");
    expect(powAlias).not.toContain("WORKSPACE_CREATE_UI_ONLY_MESSAGE");
    expect(powAlias).not.toContain("createAgentWorkspace");
  });

  it("MCP dispatch creates workspaces instead of hard-failing", () => {
    const mcp = fs.readFileSync(
      path.join(ROOT, "lib/pow-api/mcp-tools/dispatch.ts"),
      "utf8",
    );
    expect(mcp).toContain('name === "create_workspace"');
    expect(mcp).toContain("createManagedWorkspace");
    expect(mcp).not.toContain("rejectProgrammaticWorkspaceCreate");
  });

  it("docs and skill advertise programmatic create", () => {
    const docs = fs.readFileSync(path.join(ROOT, "docs/PROOF_OF_WORK_API.md"), "utf8");
    expect(docs).toContain("create_workspace");
    expect(docs).toContain(WORKSPACE_API_BASE);
    expect(docs).not.toMatch(/not available via REST or MCP|not available via API/i);

    const skill = fs.readFileSync(path.join(ROOT, "public/skill.md"), "utf8");
    expect(skill).toContain("`create_workspace`");
    expect(skill).toContain(WORKSPACE_API_BASE);
    expect(skill).not.toMatch(/Create workspace \| ❌ UI only/i);
  });
});
