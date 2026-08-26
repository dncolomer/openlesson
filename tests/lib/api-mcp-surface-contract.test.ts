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
  POW_API_BASE,
  SNAPSHOT_API_BASE,
  STASH_API_BASE,
  snapshotWorkspaceResource,
  powWorkspaceResource,
  stashWorkspaceResource,
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
      "app/api/v3/pow/workspaces/route.ts",
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
    .replace(/\{block_id\}/g, "[blockId]")
    .replace(/\{id\}/g, "[id]");
  // Collection GET /workspaces has no trailing resource
  if (fsPath.endsWith("/workspaces") || fsPath.endsWith("/workspaces/")) {
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

  it("every agent tool has a corresponding existing v3 REST route (except create)", () => {
    expect(agentToolNames()).not.toContain("create_workspace");
    for (const tool of AGENT_TOOL_SURFACE) {
      const routeFile = restPathToRouteFile(tool.rest.path);
      expect(existsSync(routeFile), `${tool.name} → ${tool.rest.path} missing ${routeFile}`).toBe(
        true,
      );
    }
  });

  it("path builders resolve to existing v3 route handlers", () => {
    const workspaceId = "ws-test";
    const cases: { built: string; routeRel: string }[] = [
      {
        built: powWorkspaceResource(workspaceId, "proof-of-work"),
        routeRel: "app/api/v3/pow/workspaces/[id]/proof-of-work/route.ts",
      },
      {
        built: powWorkspaceResource(workspaceId, "blocks"),
        routeRel: "app/api/v3/pow/workspaces/[id]/blocks/route.ts",
      },
      {
        built: powWorkspaceResource(workspaceId, "tap-links"),
        routeRel: "app/api/v3/pow/workspaces/[id]/tap-links/route.ts",
      },
      {
        built: snapshotWorkspaceResource(workspaceId, "lwm-snapshot"),
        routeRel: "app/api/v3/snapshot/workspaces/[id]/lwm-snapshot/route.ts",
      },
      {
        built: snapshotWorkspaceResource(workspaceId, "world-model"),
        routeRel: "app/api/v3/snapshot/workspaces/[id]/world-model/route.ts",
      },
      {
        built: snapshotWorkspaceResource(workspaceId, "knowledge-config"),
        routeRel: "app/api/v3/snapshot/workspaces/[id]/knowledge-config/route.ts",
      },
      {
        built: snapshotWorkspaceResource(workspaceId, "snapshot-history"),
        routeRel: "app/api/v3/snapshot/workspaces/[id]/snapshot-history/route.ts",
      },
      {
        built: stashWorkspaceResource(workspaceId, "stash"),
        routeRel: "app/api/v3/stash/workspaces/[id]/stash/route.ts",
      },
      {
        built: stashWorkspaceResource(workspaceId, "submit"),
        routeRel: "app/api/v3/stash/workspaces/[id]/submit/route.ts",
      },
      {
        built: stashWorkspaceResource(workspaceId, "proof-of-work"),
        routeRel: "app/api/v3/stash/workspaces/[id]/proof-of-work/route.ts",
      },
    ];

    for (const { built, routeRel } of cases) {
      expect(
        built.startsWith(POW_API_BASE) ||
          built.startsWith(SNAPSHOT_API_BASE) ||
          built.startsWith(STASH_API_BASE),
      ).toBe(true);
      expect(existsSync(join(ROOT, routeRel))).toBe(true);
    }
  });

  it("REST list workspaces GET exists; POST create remains forbidden", () => {
    const collectionRoute = join(ROOT, "app/api/v3/pow/workspaces/route.ts");
    expect(existsSync(collectionRoute)).toBe(true);
    const src = readFileSync(collectionRoute, "utf8");
    expect(src).toMatch(/export async function GET/);
    expect(src).toMatch(/export async function POST/);
    expect(src).toMatch(/WORKSPACE_CREATE_UI_ONLY|UI-only|not available/i);
    expect(MCP_EVIDENCE_TOOLS.map((t) => t.name)).toContain("list_workspaces");
    expect(MCP_EVIDENCE_TOOLS.map((t) => t.name)).not.toContain("create_workspace");
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

  it("MCP includes eval read + stash tools matching REST", () => {
    const mcpNames = new Set(MCP_EVIDENCE_TOOLS.map((t) => t.name));
    for (const name of [
      "get_world_model",
      "get_knowledge_config",
      "get_knowledge_config_trajectory",
      "knowledge_distance",
      "list_snapshot_history",
      "list_custom_knowledge_regions",
      "create_custom_knowledge_region",
      "eval_custom_knowledge_region",
      "buffer_proof_of_work",
      "stash_proof_of_work",
      "submit_stashed_proof_of_work",
    ] as const) {
      expect(mcpNames.has(name)).toBe(true);
    }
  });

  it("custom knowledge regions path replaces custom-verification-models on public surface", () => {
    const regionTools = AGENT_TOOL_SURFACE.filter((t) =>
      t.name.includes("custom_knowledge_region"),
    );
    expect(regionTools.length).toBe(3);
    for (const tool of regionTools) {
      expect(tool.rest.path).toContain("/custom-knowledge-regions");
      expect(tool.rest.path).not.toContain("custom-verification-models");
      expect(tool.rest.path).toContain(SNAPSHOT_API_BASE);
      expect(existsSync(restPathToRouteFile(tool.rest.path))).toBe(true);
    }
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

  it("v3 PoW upload route uses shared uploadWorkspaceProofOfWork helper", () => {
    const src = readFileSync(
      join(ROOT, "app/api/v3/pow/workspaces/[id]/proof-of-work/route.ts"),
      "utf8",
    );
    expect(src).toMatch(/uploadWorkspaceProofOfWork/);
    expect(src).not.toMatch(/uploadFileToXAI/);
    expect(src).not.toMatch(/insertWorkspaceProofOfWorkRow/);
  });

  it("MCP upload_proof_of_work uses the same shared helper", () => {
    const src = readMcpSurface();
    expect(src).toMatch(/uploadWorkspaceProofOfWork/);
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
