/**
 * Drives shipped workspace-management REST handlers and MCP dispatch.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createMemoryAgentSupabase } from "@/tests/helpers/memory-agent-supabase";
import type { AuthContext } from "@/lib/pow-api/types";

vi.mock("@/lib/pow-api/auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/pow-api/auth")>();
  return {
    ...actual,
    authenticateRequest: vi.fn(),
  };
});

import { authenticateRequest } from "@/lib/pow-api/auth";
import { POST as POST_COLLECTION, GET as GET_COLLECTION } from "@/app/api/v3/workspaces/route";
import { GET as GET_ONE, PATCH as PATCH_ONE } from "@/app/api/v3/workspaces/[id]/route";
import { PATCH as PATCH_SETTINGS } from "@/app/api/v3/workspaces/[id]/settings/route";
import { GET as GET_ACCOUNT, PATCH as PATCH_ACCOUNT } from "@/app/api/v3/account/route";
import { callMcpProofOfWorkTool } from "@/lib/pow-api/mcp-proof-of-work-server";

const SCRATCH =
  process.env.GROK_GOAL_SCRATCH ||
  "/var/folders/kd/98qlvkyd4mb3_9t32p9bmt_r0000gn/T/grok-goal-7ec135c42124/implementer";

const auth: AuthContext = {
  key_id: "key-test",
  user_id: "user-test",
  guest_user_id: null,
  organization_id: "org-1",
  is_org_admin: true,
  scopes: ["workspaces:read", "workspaces:write", "tap:read", "tap:write"],
};

function jsonRequest(url: string, method: string, body?: unknown) {
  return new NextRequest(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer sk_test",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

function parseTool(result: { content: Array<{ text: string }> }) {
  return JSON.parse(result.content[0].text) as Record<string, unknown>;
}

describe("workspace management REST + MCP", () => {
  let supabase: ReturnType<typeof createMemoryAgentSupabase>;

  beforeEach(() => {
    supabase = createMemoryAgentSupabase();
    vi.mocked(authenticateRequest).mockImplementation(async () => ({
      auth,
      supabase: supabase as never,
    }));
  });

  afterEach(() => {
    vi.mocked(authenticateRequest).mockReset();
  });

  it("creates Learning and Verification workspaces, patches settings, edits the map, and patches account settings", async () => {
    const learningRes = await POST_COLLECTION(
      jsonRequest("http://localhost/api/v3/workspaces", "POST", {
        kind: "learning",
        title: "Algebra map",
        description: "Learning workspace",
        workspace_goal: "Solve linear equations",
        learning_model_size: 8,
        blocks: [
          { id: "a", title: "Start", description: "Open the map", is_start: true, next: ["b"] },
          { id: "b", title: "Next", description: "Continue" },
        ],
      }),
    );
    expect(learningRes.status).toBe(201);
    const learningJson = (await learningRes.json()) as {
      workspace: { id: string; product: string; workspace_kind: string; settings: { title: string } };
      blocks: Array<{ title: string }>;
    };
    expect(learningJson.workspace.product).toBe("learning");
    expect(learningJson.workspace.workspace_kind).toBe("standard");
    expect(learningJson.blocks.length).toBeGreaterThanOrEqual(1);

    const verifyRes = await POST_COLLECTION(
      jsonRequest("http://localhost/api/v3/workspaces", "POST", {
        kind: "verification",
        title: "Verify algebra",
        workspace_goal: "Distance 0 on the prepared tree",
      }),
    );
    expect(verifyRes.status).toBe(201);
    const verifyJson = (await verifyRes.json()) as {
      workspace: { id: string; product: string; workspace_kind: string };
    };
    expect(verifyJson.workspace.product).toBe("verification");
    expect(verifyJson.workspace.workspace_kind).toBe("knowledge_region");

    const patched = await PATCH_ONE(
      jsonRequest(`http://localhost/api/v3/workspaces/${learningJson.workspace.id}`, "PATCH", {
        title: "Algebra map v2",
        workspace_goal: "Factor polynomials",
        blocks: [
          { title: "Foundations", description: "Linear", is_start: true },
          { title: "Quadratics", description: "Factor" },
        ],
      }),
      { params: Promise.resolve({ id: learningJson.workspace.id }) },
    );
    expect(patched.status).toBe(200);
    const patchedJson = (await patched.json()) as {
      workspace: { settings: { title: string; workspace_goal: string } };
      blocks: Array<{ title: string }>;
    };
    expect(patchedJson.workspace.settings.title).toBe("Algebra map v2");
    expect(patchedJson.workspace.settings.workspace_goal).toContain("Factor");
    expect(patchedJson.blocks.map((b) => b.title)).toEqual(
      expect.arrayContaining(["Foundations", "Quadratics"]),
    );

    const settingsRes = await PATCH_SETTINGS(
      jsonRequest(
        `http://localhost/api/v3/workspaces/${learningJson.workspace.id}/settings`,
        "PATCH",
        { learning_model_size: 16, description: "Catalog 16" },
      ),
      { params: Promise.resolve({ id: learningJson.workspace.id }) },
    );
    expect(settingsRes.status).toBe(200);
    const settingsJson = (await settingsRes.json()) as {
      settings: { learning_model_size: number; description: string };
    };
    expect(settingsJson.settings.learning_model_size).toBe(16);

    const listed = await GET_COLLECTION(
      jsonRequest("http://localhost/api/v3/workspaces", "GET"),
    );
    expect(listed.status).toBe(200);
    const listedJson = (await listed.json()) as { workspaces: Array<{ product: string }> };
    const products = listedJson.workspaces.map((w) => w.product).sort();
    expect(products).toEqual(["learning", "verification"]);

    const accountGet = await GET_ACCOUNT(jsonRequest("http://localhost/api/v3/account", "GET"));
    expect(accountGet.status).toBe(200);
    const accountPatch = await PATCH_ACCOUNT(
      jsonRequest("http://localhost/api/v3/account", "PATCH", { username: "agent-owner" }),
    );
    expect(accountPatch.status).toBe(200);
    const accountJson = (await accountPatch.json()) as { username: string };
    expect(accountJson.username).toBe("agent-owner");

    const got = await GET_ONE(jsonRequest(`http://localhost/api/v3/workspaces/${verifyJson.workspace.id}`, "GET"), {
      params: Promise.resolve({ id: verifyJson.workspace.id }),
    });
    expect(got.status).toBe(200);
    const gotJson = (await got.json()) as { workspace: { product: string } };
    expect(gotJson.workspace.product).toBe("verification");

    mkdirSync(SCRATCH, { recursive: true });
    writeFileSync(
      join(SCRATCH, "workspace-mgmt.log"),
      JSON.stringify(
        {
          learning: learningJson.workspace,
          verification: verifyJson.workspace,
          patched: patchedJson.workspace.settings,
          account: accountJson,
        },
        null,
        2,
      ),
    );
  });

  it("MCP create_workspace and update_workspace persist both kinds", async () => {
    const created = parseTool(
      (await callMcpProofOfWorkTool(
        "create_workspace",
        {
          kind: "learning",
          title: "MCP learning",
          blocks: [{ title: "Chapter 1", is_start: true }],
        },
        { auth, supabase: supabase as never, origin: "https://uncertain.systems" },
      )) as { content: Array<{ text: string }> },
    );
    const workspace = created.workspace as { id: string; product: string };
    expect(workspace.product).toBe("learning");

    const verification = parseTool(
      (await callMcpProofOfWorkTool(
        "create_workspace",
        { kind: "verification", title: "MCP verification" },
        { auth, supabase: supabase as never, origin: "https://uncertain.systems" },
      )) as { content: Array<{ text: string }> },
    );
    expect((verification.workspace as { product: string }).product).toBe("verification");

    const updated = parseTool(
      (await callMcpProofOfWorkTool(
        "update_workspace",
        { workspace_id: workspace.id, title: "MCP learning edited" },
        { auth, supabase: supabase as never, origin: "https://uncertain.systems" },
      )) as { content: Array<{ text: string }> },
    );
    expect((updated.workspace as { settings: { title: string } }).settings.title).toBe(
      "MCP learning edited",
    );
  });
});
