import { readMcpSurface } from "@/tests/helpers/surface-source";
import { publicDocInstructsHeadlessPowLoop } from "@/tests/helpers/public-agent-docs";
import { describe, expect, it } from "vitest";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  ACCOUNT_API_BASE,
  EVAL_API_BASE,
  POW_API_BASE,
  PUBLIC_AGENT_API_FAMILIES,
  SNAPSHOT_API_BASE,
  STASH_API_BASE,
  WORKSPACE_API_BASE,
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
  it("exports one public agent family; Snapshot/Stash/PoW session bases are retired", () => {
    expect(WORKSPACE_API_BASE).toBe("/api/v3/workspaces");
    expect(ACCOUNT_API_BASE).toBe("/api/v3/account");
    expect(POW_API_BASE).toBe("/api/v3/pow");
    expect([...PUBLIC_AGENT_API_FAMILIES]).toEqual(["workspace"]);
    expect(SNAPSHOT_API_BASE).toBe("/api/v3/snapshot");
    expect(EVAL_API_BASE).toBe(SNAPSHOT_API_BASE);
    expect(STASH_API_BASE).toBe("/api/v3/stash");
    expect(SNAPSHOT_API_BASE).not.toBe("/api/v3/eval");
  });

  it("e2e and agent surface docs advertise Learning Map and flow management (not /api/v3/eval)", () => {
    const e2e = readFileSync(join(ROOT, "scripts/run-pow-api-e2e.mjs"), "utf8");
    expect(e2e).not.toMatch(/\/api\/v3\/eval\//);

    const skill = readFileSync(join(ROOT, "public/skill.md"), "utf8");
    expect(skill).toContain("/api/v3/workspaces");
    expect(skill).toContain("create_flow");
    expect(skill).toContain("/api/v3/flows");
    expect(skill).not.toContain("/api/v3/{pow,eval,stash}");
    expect(skill).not.toContain("/api/v3/{pow,snapshot,stash}");

    const mcp = readMcpSurface();
    expect(mcp).toContain("/api/v3/workspaces");
    expect(mcp).toContain("create_flow");
    expect(mcp).not.toContain("/api/v3/{pow,eval,stash}");

    const en = readFileSync(join(ROOT, "messages/en.json"), "utf8");
    expect(en).toContain("/api/v3/workspaces");
    expect(en).toContain("create_flow");
    expect(en).not.toContain("/api/v3/{pow,eval,stash}");
    const enMessages = JSON.parse(en) as {
      dashboard: Record<string, string>;
      integrationAccess: Record<string, string>;
      workspaceIntegration: Record<string, string>;
    };
    expect(enMessages.dashboard.proofOfWorkApi).toBe("Learning Map and flow API");
    expect(enMessages.dashboard.mcpDocsLink).toBe("Map and flow API docs");
    expect(enMessages.dashboard.proofOfWorkApi).not.toMatch(/Proof-of-Work API/i);
    expect(enMessages.dashboard.mcpDocsLink).not.toMatch(/Proof-of-Work API/i);
    expect(enMessages.dashboard.proofOfWorkApiDesc).not.toMatch(/Proof-of-Work API/i);
    expect(enMessages.dashboard.apiExperimentalDesc).not.toMatch(/Proof-of-Work API/i);
    expect(enMessages.integrationAccess.skillDescription).not.toMatch(/Proof-of-Work API/i);
    expect(enMessages.workspaceIntegration.mcpWorkflowSteps).toContain("create_flow");
    expect(publicDocInstructsHeadlessPowLoop(enMessages.workspaceIntegration.mcpWorkflowSteps)).toBe(
      false,
    );
    expect(publicDocInstructsHeadlessPowLoop(enMessages.dashboard.mcpWorkflowSteps)).toBe(false);

    const integrationsTab = readFileSync(
      join(ROOT, "components/dashboard/dashboard-integrations-tab.tsx"),
      "utf8",
    );
    expect(integrationsTab).not.toContain("Proof-of-Work API");
    expect(integrationsTab).toContain('t("dashboard.proofOfWorkApi")');
    expect(integrationsTab).toContain('t("dashboard.apiKeys")');

    const readme = readFileSync(join(ROOT, "README.md"), "utf8");
    expect(readme).toContain("/api/v3/workspaces");
    expect(readme).toContain("create_flow");
    expect(readme).not.toContain("/api/v3/{pow,eval,stash}");

    expect(
      publicDocInstructsHeadlessPowLoop(
        "Then run Calibrate through the headless proof-of-work API (`start_session` → `upload_proof_of_work` → `end_session`).",
      ),
    ).toBe(true);

    const liveGuide = readFileSync(join(ROOT, "public/docs/proof-of-work-api-guide.md"), "utf8");
    expect(liveGuide).toContain("create_flow");
    expect(liveGuide).toContain("/api/v3/workspaces");
    expect(publicDocInstructsHeadlessPowLoop(liveGuide)).toBe(false);

    const docsPage = readFileSync(join(ROOT, "app/docs/proof-of-work-api/page.tsx"), "utf8");
    expect(docsPage).toContain("create_flow");
    expect(docsPage).toContain("link_flow");
    expect(publicDocInstructsHeadlessPowLoop(docsPage)).toBe(false);
  });

  it("shipped path builders use pow sessions for capture and end_session for performance", () => {
    const base = "https://example.com";
    expect(buildUpload("ws-1", base)).toBe(
      "https://example.com/api/v3/pow/workspaces/ws-1/sessions/{session_id}/proof-of-work",
    );
    expect(buildProofOfWorkSchemaApiPath("ws-1", base)).toContain("/api/v3/pow/");
    expect(buildIntegrationSkillApiPath("ws-1", base)).toContain("/api/v3/workspaces/");
    expect(buildPerformanceApiPath("ws-1", base)).toBe(
      "https://example.com/api/v3/pow/workspaces/ws-1/sessions/{session_id}/end",
    );

    for (const vertical of ["verification", "augmentation", "optimization"] as const) {
      const contract = buildVerticalScoreReportContract(vertical, base);
      expect(contract.endpoint_pattern).not.toContain("/api/v2/");
    }

    const surfaces = buildIntegrationSurfaces(base);
    const rest = surfaces.find((s) => s.transport === "rest");
    expect(rest?.entrypoint).toContain("/api/v3/workspaces");
    expect(rest?.entrypoint).not.toContain("/api/v2/");
  });

  it("v3 route trees exist and v2 agent/evaluation handlers are gone", () => {
    const powRoutes = collectRouteTs(join(ROOT, "app/api/v3/pow"));
    const evalRoutes = collectRouteTs(join(ROOT, "app/api/v3/snapshot"));
    const stashRoutes = collectRouteTs(join(ROOT, "app/api/v3/stash"));
    expect(powRoutes.length).toBeGreaterThan(0);
    expect(evalRoutes.length).toBe(0);
    expect(stashRoutes.length).toBe(0);
    expect(
      existsSync(join(ROOT, "app/api/v3/stash/workspaces/[id]/proof-of-work/route.ts")),
    ).toBe(false);
    expect(existsSync(join(ROOT, "app/api/v3/stash/workspaces/[id]/stash/route.ts"))).toBe(false);
    expect(existsSync(join(ROOT, "app/api/v3/stash/workspaces/[id]/submit/route.ts"))).toBe(false);

    expect(existsSync(join(ROOT, "app/api/v3/pow/workspaces/route.ts"))).toBe(false);
    expect(
      existsSync(join(ROOT, "app/api/v3/pow/workspaces/[id]/proof-of-work/route.ts")),
    ).toBe(false);
    expect(
      existsSync(
        join(ROOT, "app/api/v3/pow/workspaces/[id]/sessions/[sessionId]/proof-of-work/route.ts"),
      ),
    ).toBe(false);
    expect(existsSync(join(ROOT, "app/api/v3/workspaces/route.ts"))).toBe(true);
    expect(
      existsSync(join(ROOT, "app/api/v3/snapshot/workspaces/[id]/lwm-snapshot/route.ts")),
    ).toBe(false);
    expect(
      existsSync(join(ROOT, "app/api/v3/snapshot/workspaces/[id]/world-model/route.ts")),
    ).toBe(false);
    expect(
      existsSync(join(ROOT, "app/api/v3/snapshot/workspaces/[id]/knowledge-config/route.ts")),
    ).toBe(false);

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
