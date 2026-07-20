import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import {
  applyNamedScoreField,
  buildAllVerticalScoreContracts,
  buildVerticalScoreReportSchema,
  emptyVerticalScoreReport,
  normalizeVerticalScoreReport,
  TAP_AUTO_SCORE_VERTICAL,
  VERTICAL_MCP_TOOL,
  VERTICAL_REST_PATH,
  VERTICAL_SCORE_FIELD,
  type ScoreVertical,
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
  "app/api/v3/eval/workspaces/[id]/verification-score/route.ts",
  "app/api/v3/eval/workspaces/[id]/augmentation-score/route.ts",
  "app/api/v3/eval/workspaces/[id]/optimization-score/route.ts",
  "app/api/workspace/performance-report/route.ts",
  "app/api/workspace-tap-score/performance/route.ts",
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

/** Surfaces that document the three vertical score endpoint/tool names. */
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

function routeExists(vertical: ScoreVertical): boolean {
  const path = join(
    ROOT,
    "app/api/v3/eval/workspaces/[id]",
    VERTICAL_REST_PATH[vertical],
    "route.ts"
  );
  return existsSync(path);
}

function readSurface(rel: string): string {
  const path = join(ROOT, rel);
  expect(existsSync(path), `missing inventory file ${rel}`).toBe(true);
  return readFileSync(path, "utf8");
}

describe("vertical score entry points (shipped wiring)", () => {
  it("REST route files exist for all three *-score endpoints under /api/v3/eval only", () => {
    for (const vertical of ["verification", "augmentation", "optimization"] as const) {
      expect(routeExists(vertical), `missing route for ${vertical}`).toBe(true);
      const src = readFileSync(
        join(ROOT, "app/api/v3/eval/workspaces/[id]", VERTICAL_REST_PATH[vertical], "route.ts"),
        "utf8"
      );
      expect(src).toContain(`vertical: "${vertical}"`);
      expect(src).toContain("runVerticalScore");
      expect(src).not.toContain("conversion_score");
      expect(src).not.toContain("conversion_goal");
      expect(src).not.toContain("overall_score");
      // Scores must not also live under pow
      expect(
        existsSync(
          join(ROOT, "app/api/v3/pow/workspaces/[id]", VERTICAL_REST_PATH[vertical], "route.ts"),
        ),
      ).toBe(false);
    }
  });

  it("MCP catalog and REST path names match", () => {
    for (const vertical of ["verification", "augmentation", "optimization"] as const) {
      const tool = MCP_PROOF_OF_WORK_TOOL_CATALOG.find(
        (t) => t.name === VERTICAL_MCP_TOOL[vertical]
      );
      expect(tool, `missing MCP tool ${VERTICAL_MCP_TOOL[vertical]}`).toBeTruthy();
      expect(tool!.summary).toContain(VERTICAL_REST_PATH[vertical]);
    }
  });

  it("each vertical finalize path returns one primary 0–100 score + spider/analysis/next-actions fields", () => {
    for (const vertical of ["verification", "augmentation", "optimization"] as const) {
      const empty = emptyVerticalScoreReport(vertical);
      const finalized = finalizeVerticalScoreReport(
        {
          ...empty,
          score: 66,
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
        vertical
      );

      expect(finalized.report.vertical).toBe(vertical);
      expect(finalized.report.score).toBe(66);
      expect(finalized.report[VERTICAL_SCORE_FIELD[vertical]]).toBe(66);
      expect(finalized.report.workspace_goal).toBe("Stored workspace goal");
      expect(finalized.workspace_goal_source).toBe("workspace");
      expect(finalized.report.marker_scores.length).toBe(4);
      expect(finalized.report.summary.length).toBeGreaterThan(0);
      expect(finalized.report.gap_analysis.next_steps.events.length).toBeGreaterThan(0);
      expect(finalized.report).not.toHaveProperty("conversion_score");
      expect(finalized.report).not.toHaveProperty("conversion_goal");
      expect(finalized.report).not.toHaveProperty("overall_score");
    }
  });

  it("normalize + named field helpers produce contract-shaped reports", () => {
    const contracts = buildAllVerticalScoreContracts("https://example.com");
    expect(contracts.map((c) => c.vertical)).toEqual([
      "verification",
      "augmentation",
      "optimization",
    ]);
    for (const contract of contracts) {
      const schema = buildVerticalScoreReportSchema(contract.vertical);
      expect(schema.primary_field).toBe(contract.primary_score_field);
      const report = applyNamedScoreField(
        normalizeVerticalScoreReport(
          {
            ...emptyVerticalScoreReport(contract.vertical),
            score: 91,
          },
          contract.vertical
        )
      );
      expect(report.score).toBeGreaterThanOrEqual(0);
      expect(report.score).toBeLessThanOrEqual(100);
      expect(report[contract.primary_score_field as "verification_score"]).toBe(91);
    }
  });

  it("TAP auto-results path is verification-only in source", () => {
    expect(TAP_AUTO_SCORE_VERTICAL).toBe("verification");
    const tapRoute = readFileSync(
      join(ROOT, "app/api/workspace-tap-score/performance/route.ts"),
      "utf8"
    );
    expect(tapRoute).toContain("TAP_AUTO_SCORE_VERTICAL");
    expect(tapRoute).toContain("verification");
    expect(tapRoute).not.toContain("augmentation");
    expect(tapRoute).not.toContain("optimization");
    expect(tapRoute).not.toContain("conversion_score");

    const panel = readFileSync(join(ROOT, "components/WorkspacePerformancePanel.tsx"), "utf8");
    expect(panel).toContain("verification");
    expect(panel).toContain("augmentation");
    expect(panel).toContain("optimization");
    expect(panel).toContain("vertical");
  });

  it("does not ship a performance chat REST endpoint", () => {
    expect(
      existsSync(join(ROOT, "app/api/v3/pow/workspaces/[id]/performance/route.ts"))
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
        // recovery helpers in performance-report may still parse legacy model text
        if (
          rel === "lib/pow-api/performance-report.ts" &&
          (label === "conversion_score" || label === "conversion_goal")
        ) {
          // only allow inside recoverVerticalScoreReportFromModelText legacy fallbacks
          const withoutRecovery = text.replace(
            /export function recoverVerticalScoreReportFromModelText[\s\S]*?^}/m,
            ""
          );
          expect(withoutRecovery, `${rel} still has ${label}`).not.toMatch(re);
          continue;
        }
        // workspace-goal re-export shim may mention old names in comments
        if (rel === "lib/pow-api/workspace-goal.ts" && label.startsWith("conversion_")) {
          continue;
        }
        expect(text, `${rel} still has banned pattern: ${label}`).not.toMatch(re);
      }
    }
  });

  it("inventory-gated: score docs surfaces name all three *-score endpoints/tools", () => {
    for (const rel of SCORE_DOCS_FILES) {
      const text = readSurface(rel);
      expect(text, `${rel} missing verification-score`).toMatch(/verification[-_]score/);
      expect(text, `${rel} missing augmentation-score`).toMatch(/augmentation[-_]score/);
      expect(text, `${rel} missing optimization-score`).toMatch(/optimization[-_]score/);
      expect(text, `${rel} missing workspace_goal`).toContain("workspace_goal");
    }
  });

  it("demo HUDs and PoW demo status bar show a single vertical primary score /100", () => {
    const hud = readSurface("components/proof-of-work-demo/DemoPerformanceHud.tsx");
    expect(hud).toContain("primaryScore");
    expect(hud).toContain("/100");
    expect(hud).not.toContain("conversionScore");
    expect(hud).not.toContain("overallScore");
    expect(hud).not.toMatch(/>\s*Conv\s*</);
    expect(hud).not.toMatch(/>\s*Learn\s*</);
    expect(hud).not.toContain("%");

    const demo = readSurface("components/ProofOfWorkApiDemo.tsx");
    expect(demo).toContain("primaryScore");
    expect(demo).toContain("verticalLabel");
    expect(demo).not.toContain("conversionScore");
    expect(demo).not.toContain("overallScore");
    expect(demo).not.toMatch(/Conversion\s*<span/);
    expect(demo).not.toMatch(/Learning\s*<span/);

    const coach = readSurface("components/orbit/SmartCoachOverlay.tsx");
    expect(coach).toContain("primaryScore");
    expect(coach).not.toMatch(/\bConv\b/);
    expect(coach).not.toMatch(/Learn\s*<span/);

    const scopes = readSurface("app/docs/proof-of-work-api/page.tsx");
    expect(scopes).toContain("verification-score / augmentation-score / optimization-score");
    expect(scopes).not.toContain("report or chat");
  });
});
