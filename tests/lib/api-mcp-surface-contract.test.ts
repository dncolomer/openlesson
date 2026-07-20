/**
 * Structural contract: API / MCP / path builders stay aligned with shipped routes.
 * Drives real exports and filesystem route tree — not hard-coded expected strings
 * reimplemented outside the product surface.
 */
import { describe, expect, it } from "vitest";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  EVAL_API_BASE,
  POW_API_BASE,
  STASH_API_BASE,
  evalWorkspaceResource,
  powWorkspaceResource,
  stashWorkspaceResource,
} from "@/lib/api/agent-api-paths";
import { MCP_EVIDENCE_TOOLS } from "@/lib/agent-v2/mcp-proof-of-work-server";
import { MCP_PROOF_OF_WORK_TOOL_CATALOG } from "@/lib/agent-v2/mcp-proof-of-work-catalog";
import {
  TAP_LINK_DEFAULT_MINUTES,
  TAP_LINK_MAX_MINUTES,
  TAP_LINK_MIN_MINUTES,
  normalizeTapLinkMinutes,
} from "@/lib/agent-v2/tap-link-config";
import { toErrorCode } from "@/lib/agent-v2/types";

const ROOT = join(__dirname, "../..");

function collectRouteTs(dir: string, acc: string[] = []): string[] {
  if (!existsSync(dir)) return acc;
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) collectRouteTs(p, acc);
    else if (name === "route.ts") acc.push(p);
  }
  return acc;
}

/** Map App Router filesystem path under app/api to URL path prefix. */
function routeFileToUrlPath(absRouteTs: string): string {
  const rel = absRouteTs.replace(join(ROOT, "app"), "").replace(/\/route\.ts$/, "");
  return rel.replace(/\[([^\]]+)\]/g, "{$1}");
}

describe("API ↔ MCP surface contract (shipped code)", () => {
  it("UI catalog tool names match MCP server tools/list catalog exactly", () => {
    const uiNames = MCP_PROOF_OF_WORK_TOOL_CATALOG.map((t) => t.name).sort();
    const serverNames = MCP_EVIDENCE_TOOLS.map((t) => t.name).sort();
    expect(uiNames).toEqual(serverNames);
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
        built: evalWorkspaceResource(workspaceId, "verification-score"),
        routeRel: "app/api/v3/eval/workspaces/[id]/verification-score/route.ts",
      },
      {
        built: evalWorkspaceResource(workspaceId, "world-model"),
        routeRel: "app/api/v3/eval/workspaces/[id]/world-model/route.ts",
      },
      {
        built: evalWorkspaceResource(workspaceId, "knowledge-config"),
        routeRel: "app/api/v3/eval/workspaces/[id]/knowledge-config/route.ts",
      },
      {
        built: evalWorkspaceResource(workspaceId, "eval-history"),
        routeRel: "app/api/v3/eval/workspaces/[id]/eval-history/route.ts",
      },
      {
        built: stashWorkspaceResource(workspaceId, "stash"),
        routeRel: "app/api/v3/stash/workspaces/[id]/stash/route.ts",
      },
      {
        built: stashWorkspaceResource(workspaceId, "submit"),
        routeRel: "app/api/v3/stash/workspaces/[id]/submit/route.ts",
      },
    ];

    for (const { built, routeRel } of cases) {
      expect(built.startsWith(POW_API_BASE) || built.startsWith(EVAL_API_BASE) || built.startsWith(STASH_API_BASE)).toBe(
        true,
      );
      expect(existsSync(join(ROOT, routeRel))).toBe(true);
    }
  });

  it("list_workspaces is MCP-only: no REST GET collection on /api/v3/pow/workspaces", () => {
    const collectionRoute = join(ROOT, "app/api/v3/pow/workspaces/route.ts");
    expect(existsSync(collectionRoute)).toBe(true);
    const src = readFileSync(collectionRoute, "utf8");
    // Collection route exists only to reject create (POST); no GET list.
    expect(src).toMatch(/export async function POST/);
    expect(src).not.toMatch(/export async function GET/);
    expect(MCP_EVIDENCE_TOOLS.map((t) => t.name)).toContain("list_workspaces");
  });

  it("get_learning_progress is MCP-only: no REST route segment for learning-progress", () => {
    expect(MCP_EVIDENCE_TOOLS.map((t) => t.name)).toContain("get_learning_progress");
    const powRoutes = collectRouteTs(join(ROOT, "app/api/v3/pow"));
    const evalRoutes = collectRouteTs(join(ROOT, "app/api/v3/eval"));
    const urls = [...powRoutes, ...evalRoutes].map(routeFileToUrlPath);
    expect(urls.some((u) => u.includes("learning-progress") || u.includes("learning_progress"))).toBe(
      false,
    );
  });

  it("eval REST surface is broader than MCP score tools (world-model / knowledge / history)", () => {
    const mcpNames = new Set(MCP_EVIDENCE_TOOLS.map((t) => t.name));
    // Score tools exist on MCP
    expect(mcpNames.has("verification_score")).toBe(true);
    // Eval-only REST routes ship without MCP tools
    expect(existsSync(join(ROOT, "app/api/v3/eval/workspaces/[id]/world-model/route.ts"))).toBe(true);
    expect(existsSync(join(ROOT, "app/api/v3/eval/workspaces/[id]/knowledge-distance/route.ts"))).toBe(
      true,
    );
    expect(existsSync(join(ROOT, "app/api/v3/eval/workspaces/[id]/eval-history/route.ts"))).toBe(true);
    expect(mcpNames.has("get_world_model")).toBe(false);
    expect(mcpNames.has("knowledge_distance")).toBe(false);
    expect(mcpNames.has("eval_history")).toBe(false);
  });

  it("stash API routes ship as a third v3 surface", () => {
    const stashRoutes = collectRouteTs(join(ROOT, "app/api/v3/stash"));
    expect(stashRoutes.length).toBeGreaterThanOrEqual(3);
    expect(STASH_API_BASE).toBe("/api/v3/stash");
    // No stash tools on MCP catalog
    const mcpBlob = MCP_EVIDENCE_TOOLS.map((t) => t.name).join(",");
    expect(mcpBlob).not.toMatch(/stash|submit_buffer|alaTAP/i);
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

  it("auth plan gate error code is api_plan_required (not teams_required alone)", () => {
    // Shipped authenticate path uses api_plan_required; both codes exist on the type.
    expect(toErrorCode("api_plan_required")).toBe("api_plan_required");
    expect(toErrorCode("teams_required")).toBe("teams_required");
    const authSrc = readFileSync(join(ROOT, "lib/agent-v2/auth.ts"), "utf8");
    expect(authSrc).toContain('"api_plan_required"');
    // Docs/skill still often say teams_required for the same gate — keep code source of truth asserted here.
    expect(authSrc).not.toMatch(/errorResponse\(\s*403,\s*"teams_required"/);
  });

  it("GET single workspace REST route exists (MCP get_workspace mirror)", () => {
    expect(existsSync(join(ROOT, "app/api/v3/pow/workspaces/[id]/route.ts"))).toBe(true);
    const src = readFileSync(join(ROOT, "app/api/v3/pow/workspaces/[id]/route.ts"), "utf8");
    expect(src).toMatch(/export async function GET/);
    expect(MCP_EVIDENCE_TOOLS.map((t) => t.name)).toContain("get_workspace");
  });
});
