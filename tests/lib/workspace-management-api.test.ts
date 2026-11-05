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
import { GET as GET_FLOWS, POST as POST_FLOWS } from "@/app/api/v3/workspaces/[id]/flows/route";
import {
  GET as GET_FLOW,
  PATCH as PATCH_FLOW,
} from "@/app/api/v3/workspaces/[id]/flows/[flowId]/route";
import { POST as POST_LINK } from "@/app/api/v3/workspaces/[id]/flows/[flowId]/link/route";
import {
  GET as GET_OWNER_FLOWS,
  POST as POST_OWNER_FLOWS,
} from "@/app/api/v3/flows/route";
import {
  DELETE as DELETE_OWNER_FLOW,
  GET as GET_OWNER_FLOW,
} from "@/app/api/v3/flows/[flowId]/route";
import { POST as POST_OWNER_LINK } from "@/app/api/v3/flows/[flowId]/link/route";
import { callMcpProofOfWorkTool } from "@/lib/pow-api/mcp-proof-of-work-server";
import { parseAgentWorkspaceKind } from "@/lib/pow-api/workspace-management";
import {
  AGENT_WORKSPACE_CREATE_REFUSED_MESSAGE,
  WORKSPACE_KIND_STANDARD,
} from "@/lib/workspace-kind";
import { resetSolveFlowRepository } from "@/lib/solve-flow-repository";
import { resetCalibrationFlowRepository } from "@/lib/calibration-flow-repository";
import { resetVerificationFlowRepository } from "@/lib/verification-flow-repository";

const SCRATCH =
  process.env.GROK_GOAL_SCRATCH ||
  "/var/folders/kd/98qlvkyd4mb3_9t32p9bmt_r0000gn/T/grok-goal-1a2102ec4028/implementer";

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
    resetSolveFlowRepository();
    resetCalibrationFlowRepository();
    resetVerificationFlowRepository();
    vi.mocked(authenticateRequest).mockImplementation(async () => ({
      auth,
      supabase: supabase as never,
    }));
  });

  afterEach(() => {
    vi.mocked(authenticateRequest).mockReset();
  });

  it("parseAgentWorkspaceKind accepts Learning only and refuses flow kinds", () => {
    expect(parseAgentWorkspaceKind("learning")).toBe(WORKSPACE_KIND_STANDARD);
    expect(parseAgentWorkspaceKind("standard")).toBe(WORKSPACE_KIND_STANDARD);
    expect(parseAgentWorkspaceKind(undefined)).toBe(WORKSPACE_KIND_STANDARD);
    expect(parseAgentWorkspaceKind("")).toBe(WORKSPACE_KIND_STANDARD);
    for (const kind of [
      "verification",
      "knowledge_region",
      "knowledge-region",
      "calibration",
      "calibrate",
    ]) {
      expect(() => parseAgentWorkspaceKind(kind)).toThrow(AGENT_WORKSPACE_CREATE_REFUSED_MESSAGE);
    }
  });

  it("creates Learning workspaces, patches settings, and edits the map", async () => {
    const learningRes = await POST_COLLECTION(
      jsonRequest("http://localhost/api/v3/workspaces", "POST", {
        kind: "learning",
        title: "Algebra map",
        description: "Learning workspace",
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
    expect(verifyRes.status).toBe(400);
    const verifyJson = (await verifyRes.json()) as { error: { message: string } };
    expect(verifyJson.error.message).toContain("/api/dashboard/flows");

    const calRes = await POST_COLLECTION(
      jsonRequest("http://localhost/api/v3/workspaces", "POST", {
        kind: "calibration",
        title: "Calibrate algebra",
      }),
    );
    expect(calRes.status).toBe(400);
    const krRes = await POST_COLLECTION(
      jsonRequest("http://localhost/api/v3/workspaces", "POST", {
        kind: "knowledge_region",
        title: "KR container",
      }),
    );
    expect(krRes.status).toBe(400);

    const patched = await PATCH_ONE(
      jsonRequest(`http://localhost/api/v3/workspaces/${learningJson.workspace.id}`, "PATCH", {
        title: "Algebra map v2",
        description: "Factor polynomials",
        blocks: [
          { title: "Foundations", description: "Linear", is_start: true },
          { title: "Quadratics", description: "Factor" },
        ],
      }),
      { params: Promise.resolve({ id: learningJson.workspace.id }) },
    );
    expect(patched.status).toBe(200);
    const patchedJson = (await patched.json()) as {
      workspace: { settings: { title: string; description: string } };
      blocks: Array<{ title: string }>;
    };
    expect(patchedJson.workspace.settings.title).toBe("Algebra map v2");
    expect(patchedJson.workspace.settings.description).toContain("Factor");
    expect(patchedJson.blocks.map((b) => b.title)).toEqual(
      expect.arrayContaining(["Foundations", "Quadratics"]),
    );

    const settingsRes = await PATCH_SETTINGS(
      jsonRequest(
        `http://localhost/api/v3/workspaces/${learningJson.workspace.id}/settings`,
        "PATCH",
        { description: "Catalog 16" },
      ),
      { params: Promise.resolve({ id: learningJson.workspace.id }) },
    );
    expect(settingsRes.status).toBe(200);
    const settingsJson = (await settingsRes.json()) as {
      settings: { description: string };
    };
    expect(settingsJson.settings.description).toBe("Catalog 16");

    const listed = await GET_COLLECTION(
      jsonRequest("http://localhost/api/v3/workspaces", "GET"),
    );
    expect(listed.status).toBe(200);
    const listedJson = (await listed.json()) as { workspaces: Array<{ product: string }> };
    const products = listedJson.workspaces.map((w) => w.product).sort();
    expect(products).toEqual(["learning"]);

    const got = await GET_ONE(
      jsonRequest(`http://localhost/api/v3/workspaces/${learningJson.workspace.id}`, "GET"),
      { params: Promise.resolve({ id: learningJson.workspace.id }) },
    );
    expect(got.status).toBe(200);
    const gotJson = (await got.json()) as { workspace: { product: string } };
    expect(gotJson.workspace.product).toBe("learning");

    mkdirSync(SCRATCH, { recursive: true });
    writeFileSync(
      join(SCRATCH, "workspace-mgmt.log"),
      JSON.stringify(
        {
          learning: learningJson.workspace,
          verificationRefused: verifyJson.error.message,
          patched: patchedJson.workspace.settings,
        },
        null,
        2,
      ),
    );
  });

  it("MCP create_workspace is Learning only and refuses flow kinds", async () => {
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

    await expect(
      callMcpProofOfWorkTool(
        "create_workspace",
        { kind: "verification", title: "MCP verification" },
        { auth, supabase: supabase as never, origin: "https://uncertain.systems" },
      ),
    ).rejects.toThrow(AGENT_WORKSPACE_CREATE_REFUSED_MESSAGE);
    await expect(
      callMcpProofOfWorkTool(
        "create_workspace",
        { kind: "calibration", title: "MCP calibration" },
        { auth, supabase: supabase as never, origin: "https://uncertain.systems" },
      ),
    ).rejects.toThrow("/api/dashboard/flows");

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

  it("creates, lists, updates, and links Solve, Calibration, and Verification flows", async () => {
    const created = await POST_COLLECTION(
      jsonRequest("http://localhost/api/v3/workspaces", "POST", {
        kind: "learning",
        title: "Flow map",
        blocks: [
          { title: "Solve tile", description: "Solve", is_start: true },
          { title: "Calibrate tile", description: "Calibrate" },
          { title: "Verify tile", description: "Verify" },
        ],
      }),
    );
    expect(created.status).toBe(201);
    const createdJson = (await created.json()) as {
      workspace: { id: string };
      blocks: Array<{ id: string; title: string }>;
    };
    const workspaceId = createdJson.workspace.id;
    const solveBlock = createdJson.blocks.find((b) => b.title === "Solve tile");
    expect(solveBlock?.id).toBeTruthy();

    const solveRes = await POST_FLOWS(
      jsonRequest(`http://localhost/api/v3/workspaces/${workspaceId}/flows`, "POST", {
        kind: "solve",
        name: "Linear solve",
        topic: "Linear equations",
      }),
      { params: Promise.resolve({ id: workspaceId }) },
    );
    expect(solveRes.status).toBe(201);
    const solveJson = (await solveRes.json()) as { flow: { id: string; kind: string; name: string } };
    expect(solveJson.flow.kind).toBe("solve");

    const calRes = await POST_FLOWS(
      jsonRequest(`http://localhost/api/v3/workspaces/${workspaceId}/flows`, "POST", {
        kind: "calibration",
        name: "Calibrate algebra",
        goal: "Ready for linear systems",
        questions: ["What is a slope?"],
      }),
      { params: Promise.resolve({ id: workspaceId }) },
    );
    expect(calRes.status).toBe(201);
    const calJson = (await calRes.json()) as { flow: { id: string; kind: string } };
    expect(calJson.flow.kind).toBe("calibration");

    const verRes = await POST_FLOWS(
      jsonRequest(`http://localhost/api/v3/workspaces/${workspaceId}/flows`, "POST", {
        kind: "verification",
        name: "Verify algebra",
        topic: "Factoring",
        questions: ["Factor x^2 - 1"],
      }),
      { params: Promise.resolve({ id: workspaceId }) },
    );
    expect(verRes.status).toBe(201);
    const verJson = (await verRes.json()) as { flow: { id: string; kind: string } };
    expect(verJson.flow.kind).toBe("verification");

    const listed = await GET_FLOWS(
      jsonRequest(`http://localhost/api/v3/workspaces/${workspaceId}/flows`, "GET"),
      { params: Promise.resolve({ id: workspaceId }) },
    );
    expect(listed.status).toBe(200);
    const listedJson = (await listed.json()) as { flows: Array<{ kind: string }> };
    expect(listedJson.flows.map((f) => f.kind).sort()).toEqual([
      "calibration",
      "solve",
      "verification",
    ]);

    const patched = await PATCH_FLOW(
      jsonRequest(
        `http://localhost/api/v3/workspaces/${workspaceId}/flows/${solveJson.flow.id}`,
        "PATCH",
        { name: "Linear solve v2" },
      ),
      { params: Promise.resolve({ id: workspaceId, flowId: solveJson.flow.id }) },
    );
    expect(patched.status).toBe(200);
    const patchedJson = (await patched.json()) as { flow: { name: string } };
    expect(patchedJson.flow.name).toBe("Linear solve v2");

    const got = await GET_FLOW(
      jsonRequest(
        `http://localhost/api/v3/workspaces/${workspaceId}/flows/${solveJson.flow.id}`,
        "GET",
      ),
      { params: Promise.resolve({ id: workspaceId, flowId: solveJson.flow.id }) },
    );
    expect(got.status).toBe(200);

    const linked = await POST_LINK(
      jsonRequest(
        `http://localhost/api/v3/workspaces/${workspaceId}/flows/${solveJson.flow.id}/link`,
        "POST",
        { block_id: solveBlock!.id },
      ),
      { params: Promise.resolve({ id: workspaceId, flowId: solveJson.flow.id }) },
    );
    expect(linked.status).toBe(200);
    const linkedJson = (await linked.json()) as {
      block_id: string;
      map_block: { kind?: string; flow_id?: string };
    };
    expect(linkedJson.block_id).toBe(solveBlock!.id);
    expect(linkedJson.map_block.kind).toBe("solve");
    expect(linkedJson.map_block.flow_id).toBe(solveJson.flow.id);

    const mcpSolve = parseTool(
      (await callMcpProofOfWorkTool(
        "create_flow",
        {
          workspace_id: workspaceId,
          kind: "solve",
          name: "MCP solve",
          topic: "Quadratics",
        },
        { auth, supabase: supabase as never, origin: "https://uncertain.systems" },
      )) as { content: Array<{ text: string }> },
    );
    expect((mcpSolve.flow as { kind: string }).kind).toBe("solve");

    const independent = await POST_OWNER_FLOWS(
      jsonRequest("http://localhost/api/v3/flows", "POST", {
        kind: "solve",
        name: "Independent solve",
        topic: "Eigenvalues",
      }),
    );
    expect(independent.status).toBe(201);
    const independentJson = (await independent.json()) as {
      flow: { id: string; workspace_id: string | null; kind: string };
    };
    expect(independentJson.flow.kind).toBe("solve");
    expect(independentJson.flow.workspace_id).toBeNull();

    const ownerListed = await GET_OWNER_FLOWS(
      jsonRequest("http://localhost/api/v3/flows", "GET"),
    );
    expect(ownerListed.status).toBe(200);
    const ownerListedJson = (await ownerListed.json()) as {
      flows: Array<{ id: string }>;
    };
    expect(ownerListedJson.flows.some((f) => f.id === independentJson.flow.id)).toBe(true);

    const ownerGot = await GET_OWNER_FLOW(
      jsonRequest(`http://localhost/api/v3/flows/${independentJson.flow.id}`, "GET"),
      { params: Promise.resolve({ flowId: independentJson.flow.id }) },
    );
    expect(ownerGot.status).toBe(200);

    const ownerLinked = await POST_OWNER_LINK(
      jsonRequest(
        `http://localhost/api/v3/flows/${independentJson.flow.id}/link`,
        "POST",
        { workspace_id: workspaceId, block_id: solveBlock!.id },
      ),
      { params: Promise.resolve({ flowId: independentJson.flow.id }) },
    );
    expect(ownerLinked.status).toBe(200);

    const mcpIndependent = parseTool(
      (await callMcpProofOfWorkTool(
        "create_flow",
        { kind: "calibration", name: "Independent calibrate", goal: "Ready" },
        { auth, supabase: supabase as never, origin: "https://uncertain.systems" },
      )) as { content: Array<{ text: string }> },
    );
    expect((mcpIndependent.flow as { workspace_id: string | null }).workspace_id).toBeNull();

    const deleted = await DELETE_OWNER_FLOW(
      jsonRequest(`http://localhost/api/v3/flows/${independentJson.flow.id}`, "DELETE"),
      { params: Promise.resolve({ flowId: independentJson.flow.id }) },
    );
    expect(deleted.status).toBe(200);

    mkdirSync(SCRATCH, { recursive: true });
    writeFileSync(
      join(SCRATCH, "map-flow-api.log"),
      JSON.stringify(
        {
          workspaceId,
          kinds: listedJson.flows.map((f) => f.kind).sort(),
          linked: linkedJson.map_block,
          mcpSolve: mcpSolve.flow,
        },
        null,
        2,
      ),
    );
  });
});
