/**
 * Drives the real shipped rejection path for programmatic workspace create
 * (REST POST + MCP create_workspace). Create must remain UI-only.
 */
import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "@/app/api/v3/pow/workspaces/route";
import {
  MCP_EVIDENCE_TOOLS,
  callMcpProofOfWorkTool,
} from "@/lib/agent-v2/mcp-proof-of-work-server";
import { MCP_PROOF_OF_WORK_TOOL_CATALOG } from "@/lib/agent-v2/mcp-proof-of-work-catalog";
import {
  WORKSPACE_CREATE_UI_ONLY_ERROR_CODE,
  WORKSPACE_CREATE_UI_ONLY_HTTP_STATUS,
  WORKSPACE_CREATE_UI_ONLY_MESSAGE,
  isProgrammaticWorkspaceCreateRejectedMessage,
  rejectProgrammaticWorkspaceCreate,
} from "@/lib/agent-v2/workspace-create-ui-only";
import type { AuthContext } from "@/lib/agent-v2/types";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(__dirname, "../..");

const auth: AuthContext = {
  key_id: "key-test",
  user_id: "user-test",
  guest_user_id: null,
  organization_id: null,
  is_org_admin: false,
  scopes: ["workspaces:read", "workspaces:write", "tap:read", "tap:write"],
};

describe("programmatic workspace create disabled", () => {
  it("exports a single shared rejection message", () => {
    expect(WORKSPACE_CREATE_UI_ONLY_MESSAGE).toMatch(/UI/i);
    expect(WORKSPACE_CREATE_UI_ONLY_MESSAGE).toMatch(/\/workspace\/new/);
    expect(WORKSPACE_CREATE_UI_ONLY_HTTP_STATUS).toBe(403);
    expect(WORKSPACE_CREATE_UI_ONLY_ERROR_CODE).toBe("forbidden");
    expect(() => rejectProgrammaticWorkspaceCreate()).toThrow(
      WORKSPACE_CREATE_UI_ONLY_MESSAGE
    );
    expect(isProgrammaticWorkspaceCreateRejectedMessage(WORKSPACE_CREATE_UI_ONLY_MESSAGE)).toBe(
      true
    );
  });

  it("POST /api/v3/pow/workspaces rejects without creating a workspace", async () => {
    const req = new NextRequest("http://localhost/api/v3/pow/workspaces", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        initial_prompt: "This must not create a workspace",
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(WORKSPACE_CREATE_UI_ONLY_HTTP_STATUS);

    const json = (await res.json()) as {
      error?: { code?: string; message?: string };
    };
    expect(json.error?.code).toBe(WORKSPACE_CREATE_UI_ONLY_ERROR_CODE);
    expect(json.error?.message).toBe(WORKSPACE_CREATE_UI_ONLY_MESSAGE);
    expect(isProgrammaticWorkspaceCreateRejectedMessage(json.error?.message ?? "")).toBe(
      true
    );
  });

  it("POST route source does not call createAgentWorkspace", () => {
    const route = fs.readFileSync(
      path.join(ROOT, "app/api/v3/pow/workspaces/route.ts"),
      "utf8"
    );
    expect(route).not.toContain("createAgentWorkspace");
    expect(route).toContain("WORKSPACE_CREATE_UI_ONLY_MESSAGE");
    expect(route).toContain("errorResponse");
  });

  it("MCP catalog does not offer create_workspace", () => {
    const names = MCP_PROOF_OF_WORK_TOOL_CATALOG.map((t) => t.name);
    expect(names).not.toContain("create_workspace");
  });

  it("MCP tools/list catalog (MCP_EVIDENCE_TOOLS) does not offer create_workspace", () => {
    const names = MCP_EVIDENCE_TOOLS.map((t) => t.name);
    expect(names).not.toContain("create_workspace");
  });

  it("MCP create_workspace handler hard-fails without createAgentWorkspace", async () => {
    const supabase = {
      from: vi.fn(() => {
        throw new Error("supabase must not be used when create is rejected");
      }),
    };

    await expect(
      callMcpProofOfWorkTool(
        "create_workspace",
        { initial_prompt: "should not create" },
        {
          auth,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          supabase: supabase as any,
          origin: "https://uncertain.systems",
        }
      )
    ).rejects.toThrow(WORKSPACE_CREATE_UI_ONLY_MESSAGE);

    expect(supabase.from).not.toHaveBeenCalled();
  });

  it("docs and skill surfaces do not advertise programmatic create as supported", () => {
    const docs = fs.readFileSync(path.join(ROOT, "docs/PROOF_OF_WORK_API.md"), "utf8");
    expect(docs).toMatch(/UI only|UI-only/i);
    expect(docs).toMatch(/not available via REST or MCP|not available via API/i);
    // Endpoint table must not list POST /workspaces as a working create path
    expect(docs).not.toMatch(
      /\|\s*`POST`\s*\|\s*`\/workspaces`\s*\|\s*`workspaces:write`\s*\|\s*Create a/
    );

    const skill = fs.readFileSync(path.join(ROOT, "public/skill.md"), "utf8");
    expect(skill).toMatch(/UI-only|UI only/i);
    expect(skill).not.toMatch(
      /\*\*Tools \(full REST parity\):\*\*.*`create_workspace`/
    );
    expect(skill).toContain("`create_workspace`"); // mentioned as disabled/rejected

    const catalog = fs.readFileSync(
      path.join(ROOT, "lib/agent-v2/mcp-proof-of-work-catalog.ts"),
      "utf8"
    );
    expect(catalog).not.toMatch(/name:\s*"create_workspace"/);
  });
});
