import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import {
  applyNamedScoreField,
  buildAllVerticalScoreContracts,
  buildVerticalScoreReportSchema,
  emptyVerticalScoreReport,
  normalizeVerticalScoreReport,
  LWM_SNAPSHOT_LABEL,
  SCORE_VERTICALS,
  SNAPSHOT_VERTICAL,
  TAP_AUTO_SCORE_VERTICAL,
  VERTICAL_MCP_TOOL,
  VERTICAL_REST_PATH,
  VERTICAL_SCORE_FIELD,
} from "@/lib/pow-api/performance-report";
import { finalizeVerticalScoreReport } from "@/lib/pow-api/workspace-goal";
import { MCP_PROOF_OF_WORK_TOOL_CATALOG } from "@/lib/pow-api/mcp-proof-of-work-catalog";

const ROOT = join(__dirname, "../..");

/**
 * Exhaustive inventory of shipped score surfaces. Add new score UI/docs/API
 * surfaces here so skeptics cannot invent unlisted leftovers.
 */
const SCORE_SURFACE_FILES = [
  // REST + demo
  "app/api/v3/snapshot/workspaces/[id]/lwm-snapshot/route.ts",
  "app/api/workspace/performance-report/route.ts",
  "app/api/workspace-tap-score/performance/route.ts",
  "app/api/workspace-ile/performance/route.ts",
  "app/api/demo/performance/route.ts",
  // Core score libs
  "lib/pow-api/performance-report.ts",
  "lib/pow-api/workspace-goal.ts",
  "lib/pow-api/generate-performance-report.ts",
  "lib/pow-api/run-vertical-score.ts",
  "lib/pow-api/mcp-proof-of-work-catalog.ts",
  "lib/pow-api/mcp-proof-of-work-server.ts",
  "lib/pow-api/integration-skill.ts",
  "lib/pow-api/integration-discovery.ts",
  "lib/pow-api/proof-of-work-schema.ts",
  "lib/pow-api/proof-of-work-integration.ts",
  // UI
  "components/WorkspacePerformancePanel.tsx",
  "components/PerformanceReportCard.tsx",
  "components/TapScoreClient.tsx",
  "components/KnowledgeConfigTrajectoryPanel.tsx",
  "components/proof-of-work-demo/DemoPerformanceHud.tsx",
  "components/ProofOfWorkApiDemo.tsx",
  "components/orbit/SmartCoachOverlay.tsx",
  // Docs + public contracts
  "docs/PROOF_OF_WORK_API.md",
  "public/skill.md",
  "public/docs/proof-of-work-api-guide.md",
  "public/customer-agent-uncertain-systems-policy.md",
  "public/pumaclaw-mentor-uncertain-systems-policy.md",
  "app/docs/proof-of-work-api/page.tsx",
  // i18n (en is source of truth for score labels)
  "messages/en.json",
] as const;

/** Surfaces that document the single LWM Snapshot score endpoint/tool. */
const SCORE_DOCS_FILES = [
  "docs/PROOF_OF_WORK_API.md",
  "public/skill.md",
  "public/docs/proof-of-work-api-guide.md",
  "public/customer-agent-uncertain-systems-policy.md",
  "public/pumaclaw-mentor-uncertain-systems-policy.md",
  "app/docs/proof-of-work-api/page.tsx",
  "lib/pow-api/mcp-proof-of-work-catalog.ts",
  "lib/pow-api/mcp-proof-of-work-server.ts",
  "lib/pow-api/integration-skill.ts",
  "lib/pow-api/integration-discovery.ts",
] as const;

const BANNED_CONTRACT_PATTERNS: Array<{ re: RegExp; label: string }> = [
  { re: /\bconversion_score\b/, label: "conversion_score" },
  { re: /\bconversion_goal\b/, label: "conversion_goal" },
  // User-facing dual scorecard labels (not product names like "Learning Verification")
  { re: />\s*Conv\s*</, label: "Conv label" },
  { re: /\bConv\s*<span/, label: "Conv span" },
  { re: /Conversion\s*<span/, label: "Conversion span" },
  { re: />\s*Conversion\s*</, label: "Conversion label" },
  { re: /Learning\s*<span[^>]*>\{[^}]*\}\/100/, label: "Learning /100 dual card" },
  { re: /Learn\s*<span[^>]*>\{?primaryScore/, label: "Learn dual card" },
  { re: /conversionScore\s*\}%/, label: "conversionScore %" },
  { re: /\{conversionScore\}%/, label: "{conversionScore}%" },
  { re: /report or chat/, label: "report or chat dual mode" },
  { re: /without prompt = scorecard/, label: "analyze_performance scorecard" },
  { re: /Structured gap report or free-form/, label: "unified performance description" },
  { re: /\*\*Structured report\*\* \(no `prompt`\)/, label: "structured report no prompt" },
];

function readSurface(rel: string): string {
  const path = join(ROOT, rel);
  expect(existsSync(path), `missing inventory file ${rel}`).toBe(true);
  return readFileSync(path, "utf8");
}

describe("LWM Snapshot entry points (shipped wiring)", () => {
  it("exposes a single runnable score vertical (verification / LWM Snapshot)", () => {
    expect(SCORE_VERTICALS).toEqual(["verification"]);
    expect(SNAPSHOT_VERTICAL).toBe("verification");
    expect(LWM_SNAPSHOT_LABEL).toMatch(/LWM Snapshot/i);
  });

  it("REST lwm-snapshot route exists and runs the shared generator", () => {
    const path = join(ROOT, "app/api/v3/snapshot/workspaces/[id]/lwm-snapshot/route.ts");
    expect(existsSync(path)).toBe(true);
    const src = readFileSync(path, "utf8");
    expect(src).toContain("SNAPSHOT_VERTICAL");
    expect(src).toContain("runVerticalScore");
    expect(src).toContain("lwm_snapshot");
    expect(src).not.toContain("conversion_score");
    // Scores must not also live under pow
    expect(
      existsSync(join(ROOT, "app/api/v3/pow/workspaces/[id]/lwm-snapshot/route.ts")),
    ).toBe(false);
  });

  it("legacy verification/aug/opt score routes are fully removed", () => {
    for (const name of ["verification-score", "augmentation-score", "optimization-score"] as const) {
      const path = join(ROOT, "app/api/v3/snapshot/workspaces/[id]", name, "route.ts");
      expect(existsSync(path), `legacy route still ships: ${name}`).toBe(false);
    }
  });

  it("MCP catalog exposes only lwm_snapshot score tool", () => {
    const tool = MCP_PROOF_OF_WORK_TOOL_CATALOG.find((t) => t.name === "lwm_snapshot");
    expect(tool, "missing MCP tool lwm_snapshot").toBeTruthy();
    expect(tool!.summary).toMatch(/LWM Snapshot|lwm-snapshot/i);
    expect(tool!.summary).toContain("lwm-snapshot");
    const scoreTools = MCP_PROOF_OF_WORK_TOOL_CATALOG.filter((t) =>
      /_score$|lwm_snapshot/.test(t.name),
    );
    expect(scoreTools.map((t) => t.name)).toEqual(["lwm_snapshot"]);
  });

  it("finalize path returns one primary 0–100 score + spider/analysis/next-actions + GHC", () => {
    const empty = emptyVerticalScoreReport(SNAPSHOT_VERTICAL);
    const finalized = finalizeVerticalScoreReport(
      {
        ...empty,
        score: 66,
        ghc_score: 40,
        workspace_goal: "",
        marker_scores: [
          { id: "m1", label: "M1", score: 70, rationale: "ok" },
          { id: "m2", label: "M2", score: 60, rationale: "ok" },
          { id: "m3", label: "M3", score: 55, rationale: "ok" },
          { id: "m4", label: "M4", score: 50, rationale: "ok" },
        ],
        summary: "Analysis text",
        gap_analysis: {
          summary: "Gaps found",
          gaps: [
            {
              title: "Gap",
              proof_of_work: "Evidence",
              severity: "medium",
              suggested_repair: "Fix in product terms",
            },
          ],
          next_steps: {
            directions: ["Improve coverage"],
            events: ["Upload next workflow step"],
          },
        },
      },
      "Stored workspace goal",
      { title: "Demo" },
      SNAPSHOT_VERTICAL,
    );

    expect(finalized.report.vertical).toBe(SNAPSHOT_VERTICAL);
    expect(finalized.report.score).toBe(66);
    expect(finalized.report[VERTICAL_SCORE_FIELD.verification]).toBe(66);
    expect(finalized.report.ghc_score).toBe(40);
    expect(finalized.report.workspace_goal).toBe("Stored workspace goal");
    expect(finalized.workspace_goal_source).toBe("workspace");
    expect(finalized.report.marker_scores.length).toBe(4);
    expect(finalized.report.summary.length).toBeGreaterThan(0);
    expect(finalized.report.gap_analysis.next_steps.events.length).toBeGreaterThan(0);
    expect(finalized.report).not.toHaveProperty("conversion_score");
  });

  it("normalize + named field helpers produce contract-shaped LWM Snapshot reports", () => {
    const contracts = buildAllVerticalScoreContracts("https://example.com");
    expect(contracts.map((c) => c.vertical)).toEqual(["verification"]);
    for (const contract of contracts) {
      const schema = buildVerticalScoreReportSchema(contract.vertical);
      expect(schema.primary_field).toBe(contract.primary_score_field);
      const report = applyNamedScoreField(
        normalizeVerticalScoreReport(
          {
            ...emptyVerticalScoreReport(contract.vertical),
            score: 91,
            ghc_score: 33,
          },
          contract.vertical,
        ),
      );
      expect(report.score).toBeGreaterThanOrEqual(0);
      expect(report.score).toBeLessThanOrEqual(100);
      expect(report.lwm_snapshot_score).toBe(91);
      expect(report.verification_score).toBe(91); // history-compatible mirror
      expect(report.ghc_score).toBe(33);
    }
  });

  it("LWM Snapshot is manual UI or Snapshot API — not auto on TAP/ILE end", () => {
    expect(TAP_AUTO_SCORE_VERTICAL).toBe("verification");
    const tapRoute = readFileSync(
      join(ROOT, "app/api/workspace-tap-score/performance/route.ts"),
      "utf8",
    );
    expect(tapRoute).toContain("TAP_AUTO_SCORE_VERTICAL");
    expect(tapRoute).toContain("runVerticalScore");
    expect(tapRoute).toContain('historySource: "tap"');
    expect(tapRoute).toMatch(/not invoked automatically|not auto/i);

    const ileRoute = readFileSync(
      join(ROOT, "app/api/workspace-ile/performance/route.ts"),
      "utf8",
    );
    expect(ileRoute).toContain("runVerticalScore");
    expect(ileRoute).toContain('historySource: "ile"');
    expect(ileRoute).toContain("SESSION_AUTO_SNAPSHOT_VERTICAL");
    expect(ileRoute).toMatch(/not invoked automatically|not auto/i);

    const tapClient = readFileSync(join(ROOT, "components/TapScoreClient.tsx"), "utf8");
    expect(tapClient).not.toContain("/api/workspace-tap-score/performance");
    expect(tapClient).toMatch(/not auto-run on TAP end|manual/);

    const sessionView = readFileSync(join(ROOT, "components/SessionView.tsx"), "utf8");
    expect(sessionView).not.toContain("ILE_POW_API_PATHS.performance");
    expect(sessionView).toMatch(/not auto-run on ILE end|manual/);

    const lwmRoute = readFileSync(
      join(ROOT, "app/api/v3/snapshot/workspaces/[id]/lwm-snapshot/route.ts"),
      "utf8",
    );
    expect(lwmRoute).toContain("runVerticalScore");
    expect(lwmRoute).toContain("SNAPSHOT_VERTICAL");

    const panel = readFileSync(join(ROOT, "components/WorkspacePerformancePanel.tsx"), "utf8");
    // Eval tab removed
    expect(panel).not.toContain('id: "score"');
    expect(panel).not.toContain("data-knowledge-eval");
    expect(panel).not.toContain("generateAllScores");
    expect(panel).toContain("lwm");
  });

  it("LWM box hosts Generate new snapshot control with PoW gate", () => {
    const lwm = readFileSync(join(ROOT, "components/KnowledgeConfigTrajectoryPanel.tsx"), "utf8");
    expect(lwm).toContain("data-lwm-generate-snapshot");
    expect(lwm).toContain("Generate new snapshot");
    expect(lwm).toContain("/api/workspace/performance-report");
    expect(lwm).toContain("loadSnapshotEligibility");
    expect(lwm).toContain("snapshotEligibility");
  });

  it("does not ship a performance chat REST endpoint", () => {
    expect(
      existsSync(join(ROOT, "app/api/v3/pow/workspaces/[id]/performance/route.ts")),
    ).toBe(false);
    const server = readFileSync(join(ROOT, "lib/pow-api/mcp-proof-of-work-server.ts"), "utf8");
    expect(server).not.toContain('name: "analyze_performance"');
    const catalog = readFileSync(join(ROOT, "lib/pow-api/mcp-proof-of-work-catalog.ts"), "utf8");
    expect(catalog).not.toContain("analyze_performance");
  });

  it("inventory-gated: every shipped score surface bans conversion dual-scorecard contracts", () => {
    for (const rel of SCORE_SURFACE_FILES) {
      const text = readSurface(rel);
      for (const { re, label } of BANNED_CONTRACT_PATTERNS) {
        if (
          rel === "lib/pow-api/performance-report.ts" &&
          (label === "conversion_score" || label === "conversion_goal")
        ) {
          const withoutRecovery = text.replace(
            /export function recoverVerticalScoreReportFromModelText[\s\S]*?^}/m,
            "",
          );
          expect(withoutRecovery, `${rel} still has ${label}`).not.toMatch(re);
          continue;
        }
        if (rel === "lib/pow-api/workspace-goal.ts" && label.startsWith("conversion_")) {
          continue;
        }
        expect(text, `${rel} still has banned pattern: ${label}`).not.toMatch(re);
      }
    }
  });

  it("inventory-gated: score docs surfaces only LWM Snapshot public entry (no legacy score APIs)", () => {
    for (const rel of SCORE_DOCS_FILES) {
      const text = readSurface(rel);
      expect(text, `${rel} missing lwm-snapshot / lwm_snapshot`).toMatch(/lwm[-_]snapshot/);
      expect(text, `${rel} missing workspace_goal`).toContain("workspace_goal");
      expect(text, `${rel} still documents verification-score API`).not.toMatch(
        /verification-score/,
      );
      expect(text, `${rel} still documents augmentation-score API`).not.toMatch(
        /augmentation-score/,
      );
      expect(text, `${rel} still documents optimization-score API`).not.toMatch(
        /optimization-score/,
      );
    }
  });

  it("demo HUDs and PoW demo status bar show a single primary score /100", () => {
    const hud = readSurface("components/proof-of-work-demo/DemoPerformanceHud.tsx");
    expect(hud).toContain("primaryScore");
    expect(hud).toContain("/100");
    expect(hud).not.toContain("conversionScore");
    expect(hud).not.toContain("overallScore");

    const demo = readSurface("components/ProofOfWorkApiDemo.tsx");
    expect(demo).toContain("primaryScore");
    expect(demo).toContain("verticalLabel");
    expect(demo).not.toContain("conversionScore");

    const coach = readSurface("components/orbit/SmartCoachOverlay.tsx");
    expect(coach).toContain("primaryScore");
  });

  it("web performance-report and runVerticalScore force single snapshot strategy", () => {
    const web = readSurface("app/api/workspace/performance-report/route.ts");
    expect(web).toContain("runVerticalScore");
    expect(web).toContain("SNAPSHOT_VERTICAL");
    expect(web).toContain("NO_NEW_POW");

    const run = readSurface("lib/pow-api/run-vertical-score.ts");
    expect(run).toContain("SNAPSHOT_VERTICAL");
    expect(run).toContain("runLwmSnapshot");
    expect(run).toContain("assertEvalAllowedWithNewPow");
  });
});
