import { readMcpSurface } from "@/tests/helpers/surface-source";
/**
 * Structural contract: API / MCP / path builders stay aligned with shipped routes.
 * Drives real exports and filesystem route tree — not hard-coded expected strings
 * reimplemented outside the product surface.
 */
import { describe, expect, it } from "vitest";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  ACCOUNT_API_BASE,
  POW_API_BASE,
  PUBLIC_AGENT_API_FAMILIES,
  WORKSPACE_API_BASE,
  powWorkspaceResource,
} from "@/lib/api/agent-api-paths";
import { MCP_EVIDENCE_TOOLS } from "@/lib/pow-api/mcp-proof-of-work-server";
import { MCP_PROOF_OF_WORK_TOOL_CATALOG } from "@/lib/pow-api/mcp-proof-of-work-catalog";
import {
  AGENT_TOOL_SURFACE,
  PLAN_GATE_ERROR_CODE,
  agentToolNames,
} from "@/lib/pow-api/agent-tool-surface";
import {
  TAP_LINK_DEFAULT_MINUTES,
  TAP_LINK_MAX_MINUTES,
  TAP_LINK_MIN_MINUTES,
  normalizeTapLinkMinutes,
} from "@/lib/pow-api/tap-link-config";
import { toErrorCode } from "@/lib/pow-api/types";

const ROOT = join(__dirname, "../..");

describe("lib/pow-api package path (renamed from agent-v2)", () => {
  it("ships under lib/pow-api and not lib/agent-v2", () => {
    expect(existsSync(join(ROOT, "lib/pow-api/auth.ts"))).toBe(true);
    expect(existsSync(join(ROOT, "lib/pow-api/mcp-proof-of-work-server.ts"))).toBe(true);
    expect(existsSync(join(ROOT, "lib/agent-v2"))).toBe(false);
  });

  it("v3/MCP routes import from @/lib/pow-api not agent-v2", () => {
    const samples = [
      "app/api/mcp/route.ts",
      "app/api/v3/snapshot/workspaces/[id]/lwm-snapshot/route.ts",
      "app/api/v3/stash/workspaces/[id]/stash/route.ts",
    ];
    for (const rel of samples) {
      const src = readFileSync(join(ROOT, rel), "utf8");
      expect(src, rel).toMatch(/@\/lib\/pow-api\//);
      expect(src, rel).not.toMatch(/agent-v2/);
    }
  });
});

function collectRouteTs(dir: string, acc: string[] = []): string[] {
  if (!existsSync(dir)) return acc;
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) collectRouteTs(p, acc);
    else if (name === "route.ts") acc.push(p);
  }
  return acc;
}

/** Map REST path pattern to App Router file under app/. */
function restPathToRouteFile(path: string): string {
  // /api/v3/pow/workspaces/{workspace_id}/blocks → app/api/v3/pow/workspaces/[id]/blocks/route.ts
  const withoutApi = path.replace(/^\/api\//, "");
  const fsPath = withoutApi
    .replace(/\{workspace_id\}/g, "[id]")
    .replace(/\{session_id\}/g, "[sessionId]")
    .replace(/\{block_id\}/g, "[blockId]")
    .replace(/\{id\}/g, "[id]");
  // Collection GET /workspaces has no trailing resource
  if (
    fsPath.endsWith("/workspaces") ||
    fsPath.endsWith("/workspaces/") ||
    fsPath.endsWith("/account")
  ) {
    return join(ROOT, "app/api", fsPath.replace(/\/$/, ""), "route.ts");
  }
  return join(ROOT, "app/api", fsPath, "route.ts");
}

describe("API ↔ MCP surface contract (shipped code)", () => {
  it("AGENT_TOOL_SURFACE names match UI catalog and MCP tools/list exactly", () => {
    const surface = agentToolNames().sort();
    const uiNames = MCP_PROOF_OF_WORK_TOOL_CATALOG.map((t) => t.name).sort();
    const serverNames = MCP_EVIDENCE_TOOLS.map((t) => t.name).sort();
    expect(uiNames).toEqual(surface);
    expect(serverNames).toEqual(surface);
  });

  it("every agent tool has a corresponding existing v3 REST route, including create", () => {
    expect(agentToolNames()).toContain("create_workspace");
    expect([...PUBLIC_AGENT_API_FAMILIES]).toEqual(["workspace", "pow"]);
    for (const tool of AGENT_TOOL_SURFACE) {
      expect(tool.family === "workspace" || tool.family === "pow").toBe(true);
      const routeFile = restPathToRouteFile(tool.rest.path);
      expect(existsSync(routeFile), `${tool.name} → ${tool.rest.path} missing ${routeFile}`).toBe(
        true,
      );
    }
  });

  it("path builders resolve to existing public agent route handlers", () => {
    const workspaceId = "ws-test";
    const cases: { built: string; routeRel: string }[] = [
      {
        built: WORKSPACE_API_BASE,
        routeRel: "app/api/v3/workspaces/route.ts",
      },
      {
        built: ACCOUNT_API_BASE,
        routeRel: "app/api/v3/account/route.ts",
      },
      {
        built: powWorkspaceResource(workspaceId, "sessions"),
        routeRel: "app/api/v3/pow/workspaces/[id]/sessions/route.ts",
      },
      {
        built: powWorkspaceResource(workspaceId, "flow-embeddings"),
        routeRel: "app/api/v3/pow/workspaces/[id]/flow-embeddings/route.ts",
      },
    ];

    for (const { built, routeRel } of cases) {
      expect(
        built.startsWith(WORKSPACE_API_BASE) ||
          built.startsWith(ACCOUNT_API_BASE) ||
          built.startsWith(POW_API_BASE),
      ).toBe(true);
      expect(existsSync(join(ROOT, routeRel))).toBe(true);
    }
  });

  it("REST workspace collection create exists on /api/v3/workspaces", () => {
    const collectionRoute = join(ROOT, "app/api/v3/workspaces/route.ts");
    expect(existsSync(collectionRoute)).toBe(true);
    const src = readFileSync(collectionRoute, "utf8");
    expect(src).toMatch(/export async function GET/);
    expect(src).toMatch(/export async function POST/);
    expect(src).toContain("createManagedWorkspace");
    expect(MCP_EVIDENCE_TOOLS.map((t) => t.name)).toContain("list_workspaces");
    expect(MCP_EVIDENCE_TOOLS.map((t) => t.name)).toContain("create_workspace");
  });

  it("learning-progress and TAPBench mint are not on the agent surface", () => {
    const mcpNames = MCP_EVIDENCE_TOOLS.map((t) => t.name);
    expect(mcpNames).not.toContain("get_learning_progress");
    expect(mcpNames).not.toContain("create_tapbench_link");
    expect(mcpNames).not.toContain("list_tapbench_links");
    expect(
      existsSync(join(ROOT, "app/api/v3/pow/workspaces/[id]/learning-progress/route.ts")),
    ).toBe(false);
    expect(
      existsSync(join(ROOT, "app/api/v3/pow/workspaces/[id]/tapbench-links/route.ts")),
    ).toBe(false);
    expect(
      existsSync(
        join(ROOT, "app/api/v3/pow/workspaces/[id]/blocks/[blockId]/tapbench-links/route.ts"),
      ),
    ).toBe(false);
  });

  it("MCP public tools are workspace management + headless PoW only", () => {
    const mcpNames = new Set(MCP_EVIDENCE_TOOLS.map((t) => t.name));
    for (const name of [
      "create_workspace",
      "update_workspace",
      "list_blocks",
      "update_blocks",
      "get_workspace_settings",
      "update_workspace_settings",
      "get_account_settings",
      "update_account_settings",
      "start_session",
      "get_session",
      "upload_proof_of_work",
      "end_session",
      "list_flow_embeddings",
      "get_flow_embedding",
    ] as const) {
      expect(mcpNames.has(name)).toBe(true);
    }
    const mcpNameList = MCP_EVIDENCE_TOOLS.map((t) => t.name);
    for (const name of [
      "lwm_snapshot",
      "get_world_model",
      "buffer_proof_of_work",
      "stash_proof_of_work",
      "submit_stashed_proof_of_work",
      "create_tapbench_link",
    ]) {
      expect(mcpNameList).not.toContain(name);
    }
  });

  it("custom-verification-models remain absent from the public surface", () => {
    expect(agentToolNames()).not.toContain("list_custom_verification_models");
    expect(agentToolNames()).not.toContain("create_custom_verification_model");
    expect(agentToolNames()).not.toContain("eval_custom_verification_model");
    expect(
      existsSync(join(ROOT, "app/api/v3/snapshot/workspaces/[id]/custom-verification-models/route.ts")),
    ).toBe(false);
    expect(
      existsSync(join(ROOT, "app/api/workspace/custom-verification-models/route.ts")),
    ).toBe(false);
  });

  it("headless PoW upload uses the session ingest helper", () => {
    const src = readFileSync(
      join(ROOT, "app/api/v3/pow/workspaces/[id]/sessions/[sessionId]/proof-of-work/route.ts"),
      "utf8",
    );
    expect(src).toMatch(/ingestHeadlessProofForWorkspace/);
    expect(src).not.toMatch(/uploadFileToXAI/);
  });

  it("MCP upload_proof_of_work uses the same headless ingest helper", () => {
    const src = readMcpSurface();
    expect(src).toMatch(/ingestHeadlessProofForWorkspace/);
    expect(src).not.toMatch(/uploadFileToXAI/);
  });

  it("MCP dispatch does not implement Snapshot, Stash, or TAP-link tools", () => {
    const src = readFileSync(join(ROOT, "lib/pow-api/mcp-tools/dispatch.ts"), "utf8");
    expect(src).not.toMatch(/name === "lwm_snapshot"/);
    expect(src).not.toMatch(/name === "buffer_proof_of_work"/);
    expect(src).not.toMatch(/name === "create_tap_link"/);
    expect(src).not.toMatch(/name === "generate_proof_of_work_schema"/);
    expect(src).toContain("Unknown tool");
  });

  it("TAP minutes clamp uses 1–120 (not 15/30-only), default 15", () => {
    expect(TAP_LINK_MIN_MINUTES).toBe(1);
    expect(TAP_LINK_MAX_MINUTES).toBe(120);
    expect(TAP_LINK_DEFAULT_MINUTES).toBe(15);
    expect(normalizeTapLinkMinutes(15)).toBe(15);
    expect(normalizeTapLinkMinutes(30)).toBe(30);
    expect(normalizeTapLinkMinutes(45)).toBe(45);
    expect(normalizeTapLinkMinutes(0)).toBe(1);
    expect(normalizeTapLinkMinutes(999)).toBe(120);
    expect(normalizeTapLinkMinutes("nope")).toBe(15);
  });

  it("auth plan gate uses canonical api_plan_required", () => {
    expect(PLAN_GATE_ERROR_CODE).toBe("api_plan_required");
    expect(toErrorCode("api_plan_required")).toBe("api_plan_required");
    const authSrc = readFileSync(join(ROOT, "lib/pow-api/auth.ts"), "utf8");
    expect(authSrc).toContain('"api_plan_required"');
    expect(authSrc).not.toMatch(/errorResponse\(\s*403,\s*"teams_required"/);
    const oauthSrc = readFileSync(
      join(ROOT, "lib/pow-api/mcp-oauth/authenticate-oauth-token.ts"),
      "utf8",
    );
    expect(oauthSrc).toContain('"api_plan_required"');
    expect(oauthSrc).not.toMatch(/errorResponse\(\s*403,\s*"teams_required"/);
  });

  it("dead blockchain/proof types are removed from agent types", () => {
    const typesSrc = readFileSync(join(ROOT, "lib/pow-api/types.ts"), "utf8");
    expect(typesSrc).not.toMatch(/export type ProofType/);
    expect(typesSrc).not.toMatch(/export interface Proof\b/);
    expect(typesSrc).not.toMatch(/export interface ProofBatch/);
    expect(typesSrc).not.toMatch(/anchor_tx_signature/);
  });

  it("docs no longer claim TAP is 15/30-only", () => {
    const powDocs = readFileSync(join(ROOT, "docs/PROOF_OF_WORK_API.md"), "utf8");
    expect(powDocs).not.toMatch(/Only `15` and `30` minute sessions are supported/);
  });
});
