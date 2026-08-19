import { readMcpSurface } from "@/tests/helpers/surface-source";
import { describe, expect, it } from "vitest";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  EVAL_API_BASE,
  POW_API_BASE,
  SNAPSHOT_API_BASE,
  STASH_API_BASE,
} from "@/lib/api/agent-api-paths";
import {
  buildIntegrationSkillApiPath,
  buildPerformanceApiPath,
  buildProofOfWorkSchemaApiPath,
  buildProofOfWorkUploadApiPath as buildUpload,
} from "@/lib/pow-api/proof-of-work-integration";
import { buildVerticalScoreReportContract } from "@/lib/pow-api/performance-report";
import { buildIntegrationSurfaces } from "@/lib/pow-api/integration-discovery";

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

describe("Proof-of-Work API v3 path contract", () => {
  it("exports fixed bases", () => {
    expect(POW_API_BASE).toBe("/api/v3/pow");
    expect(SNAPSHOT_API_BASE).toBe("/api/v3/snapshot");
    expect(EVAL_API_BASE).toBe(SNAPSHOT_API_BASE);
    expect(STASH_API_BASE).toBe("/api/v3/stash");
    expect(SNAPSHOT_API_BASE).not.toBe("/api/v3/eval");
  });

  it("e2e and agent surface docs use Snapshot API base (not /api/v3/eval)", () => {
    const e2e = readFileSync(join(ROOT, "scripts/run-pow-api-e2e.mjs"), "utf8");
    expect(e2e).toContain("/api/v3/snapshot/workspaces/");
    expect(e2e).toContain("lwm-snapshot");
    expect(e2e).not.toMatch(/\/api\/v3\/eval\//);

    const skill = readFileSync(join(ROOT, "public/skill.md"), "utf8");
    expect(skill).toContain("/api/v3/{pow,snapshot,stash}");
    expect(skill).not.toContain("/api/v3/{pow,eval,stash}");

    const mcp = readMcpSurface();
    expect(mcp).toContain("/api/v3/{pow,snapshot,stash}");
    expect(mcp).not.toContain("/api/v3/{pow,eval,stash}");

    const en = readFileSync(join(ROOT, "messages/en.json"), "utf8");
    expect(en).toContain("/api/v3/{pow,snapshot,stash}");
    expect(en).not.toContain("/api/v3/{pow,eval,stash}");

    const readme = readFileSync(join(ROOT, "README.md"), "utf8");
    expect(readme).toContain("/api/v3/{pow,snapshot,stash}");
    expect(readme).not.toContain("/api/v3/{pow,eval,stash}");
  });

  it("shipped path builders use pow for capture and snapshot for scores", () => {
    const base = "https://example.com";
    expect(buildUpload("ws-1", base)).toBe(
      "https://example.com/api/v3/pow/workspaces/ws-1/proof-of-work",
    );
    expect(buildProofOfWorkSchemaApiPath("ws-1", base)).toContain("/api/v3/pow/");
    expect(buildIntegrationSkillApiPath("ws-1", base)).toContain("/api/v3/pow/");
    expect(buildPerformanceApiPath("ws-1", base)).toBe(
      "https://example.com/api/v3/snapshot/workspaces/ws-1/lwm-snapshot",
    );

    for (const vertical of ["verification", "augmentation", "optimization"] as const) {
      const contract = buildVerticalScoreReportContract(vertical, base);
      expect(contract.endpoint_pattern).toContain("/api/v3/snapshot/");
      expect(contract.endpoint_pattern).not.toContain("/api/v3/pow/");
      expect(contract.endpoint_pattern).not.toContain("/api/v2/");
      expect(contract.endpoint_pattern).toContain("lwm-snapshot");
    }

    const surfaces = buildIntegrationSurfaces(base);
    const rest = surfaces.find((s) => s.transport === "rest");
    expect(rest?.entrypoint).toContain("/api/v3/pow/workspaces/");
    expect(rest?.entrypoint).not.toContain("/api/v2/");
  });

  it("v3 route trees exist and v2 agent/evaluation handlers are gone", () => {
    const powRoutes = collectRouteTs(join(ROOT, "app/api/v3/pow"));
    const evalRoutes = collectRouteTs(join(ROOT, "app/api/v3/snapshot"));
    const stashRoutes = collectRouteTs(join(ROOT, "app/api/v3/stash"));
    expect(powRoutes.length).toBeGreaterThan(5);
    expect(evalRoutes.length).toBeGreaterThanOrEqual(6);
    expect(stashRoutes.length).toBeGreaterThanOrEqual(3);
    expect(
      existsSync(join(ROOT, "app/api/v3/stash/workspaces/[id]/proof-of-work/route.ts")),
    ).toBe(true);
    expect(existsSync(join(ROOT, "app/api/v3/stash/workspaces/[id]/stash/route.ts"))).toBe(true);
    expect(existsSync(join(ROOT, "app/api/v3/stash/workspaces/[id]/submit/route.ts"))).toBe(true);

    expect(existsSync(join(ROOT, "app/api/v3/pow/workspaces/route.ts"))).toBe(true);
    expect(
      existsSync(join(ROOT, "app/api/v3/pow/workspaces/[id]/proof-of-work/route.ts")),
    ).toBe(true);
    expect(
      existsSync(join(ROOT, "app/api/v3/snapshot/workspaces/[id]/lwm-snapshot/route.ts")),
    ).toBe(true);
    expect(
      existsSync(join(ROOT, "app/api/v3/snapshot/workspaces/[id]/world-model/route.ts")),
    ).toBe(true);
    expect(
      existsSync(join(ROOT, "app/api/v3/snapshot/workspaces/[id]/knowledge-config/route.ts")),
    ).toBe(true);

    // Legacy score routes removed
    for (const name of ["verification-score", "augmentation-score", "optimization-score"] as const) {
      expect(existsSync(join(ROOT, "app/api/v3/snapshot/workspaces/[id]", name, "route.ts"))).toBe(
        false,
      );
    }
    // Scores only under eval
    expect(
      existsSync(join(ROOT, "app/api/v3/pow/workspaces/[id]/lwm-snapshot/route.ts")),
    ).toBe(false);

    // No v2 handlers
    expect(collectRouteTs(join(ROOT, "app/api/v2/agent"))).toEqual([]);
    expect(collectRouteTs(join(ROOT, "app/api/v2/evaluation"))).toEqual([]);
    expect(existsSync(join(ROOT, "app/api/v2/agent"))).toBe(false);
    expect(existsSync(join(ROOT, "app/api/v2/evaluation"))).toBe(false);
  });
});
