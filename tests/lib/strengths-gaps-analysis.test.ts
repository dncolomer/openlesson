/**
 * Strengths & Gaps: pure browse/link/analysis helpers + Knowledge tab wiring.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  buildCohortCoverageChart,
  buildStrengthsGapsBrowseModel,
  computeStrengthsGapsAnalysis,
  computeThemeOverlaps,
  linkGapToPowActions,
  normalizeThemeKey,
  severityStackFractions,
} from "@/lib/pow-api/strengths-gaps-analysis";

const ROOT = join(__dirname, "../..");

const sampleReport = {
  vertical: "verification" as const,
  score: 72,
  workspace_goal: "Ship reliable auth",
  ghc_score: 60,
  ghc_confidence: "medium" as const,
  marker_scores: [{ id: "m1", label: "Auth depth", score: 65, rationale: "ok" }],
  summary: "Solid base with auth gaps",
  strengths: ["Clear threat model framing", "Good API contract instincts"],
  growth_areas: ["Token lifecycle"],
  gap_analysis: {
    summary: "Auth edge cases under-proven",
    gaps: [
      {
        title: "Refresh token rotation",
        proof_of_work:
          "Tool log showed single-use refresh never exercised after revoke_session",
        severity: "high" as const,
        suggested_repair:
          "Run revoke then refresh flow and document expected 401 vs rotate",
      },
      {
        title: "Rate limit on login",
        proof_of_work: "",
        severity: "medium" as const,
        suggested_repair: "Add burst login scenario and assert lockout",
      },
    ],
    next_steps: {
      directions: ["Harden session lifecycle under concurrent clients"],
      events: [
        "revoke_session",
        "rotate_refresh_token",
        "assert_login_rate_limit",
        "document_auth_failure_modes",
      ],
    },
  },
  suggestions: [],
  confidence: "developing" as const,
};

describe("linkGapToPowActions", () => {
  it("links PoW evidence, repair, and overlapping next-step events", () => {
    const actions = linkGapToPowActions(
      sampleReport.gap_analysis.gaps[0],
      sampleReport.gap_analysis.next_steps,
      { gapIndex: 0, subjectKey: "u:alice" },
    );

    expect(actions.length).toBeGreaterThanOrEqual(2);
    const kinds = new Set(actions.map((a) => a.kind));
    expect(kinds.has("proof_of_work_evidence")).toBe(true);
    expect(kinds.has("suggested_repair")).toBe(true);
    expect(kinds.has("next_step_event")).toBe(true);

    const events = actions.filter((a) => a.kind === "next_step_event");
    expect(events.some((e) => /refresh|revoke|rotate/i.test(e.detail))).toBe(true);
    expect(actions.every((a) => a.id.includes("u:alice"))).toBe(true);
  });

  it("still attaches short event lists when token overlap is weak", () => {
    const actions = linkGapToPowActions(
      {
        title: "Unrelated gap",
        proof_of_work: "",
        severity: "low",
        suggested_repair: "Try again",
      },
      { directions: [], events: ["do_x", "do_y"] },
      { gapIndex: 1, subjectKey: "u:bob" },
    );
    expect(actions.some((a) => a.kind === "suggested_repair")).toBe(true);
    expect(actions.filter((a) => a.kind === "next_step_event").length).toBe(2);
  });
});

describe("buildStrengthsGapsBrowseModel + analysis", () => {
  it("builds browsable strengths/gaps with linkage and severity aggregates", () => {
    const model = buildStrengthsGapsBrowseModel([
      {
        subjectKey: "u:alice",
        subjectLabel: "Alice",
        report: sampleReport,
      },
      {
        subjectKey: "u:bob",
        subjectLabel: "Bob",
        report: {
          ...sampleReport,
          score: 50,
          strengths: ["Fast iteration"],
          gap_analysis: {
            summary: "Shared rotation gap",
            gaps: [
              {
                title: "Refresh token rotation",
                proof_of_work: "Missed rotate path in screen capture",
                severity: "high",
                suggested_repair: "Rehearse rotate under load",
              },
            ],
            next_steps: {
              directions: [],
              events: ["rotate_refresh_token"],
            },
          },
        },
      },
      {
        subjectKey: "u:empty",
        subjectLabel: "Empty",
        report: null,
      },
    ]);

    expect(model.strengths.length).toBe(3); // 2 alice + 1 bob
    expect(model.gaps.length).toBe(3); // 2 alice + 1 bob
    expect(model.analysis.subjectCount).toBe(3);
    expect(model.analysis.subjectsWithReports).toBe(2);
    expect(model.analysis.strengthCount).toBe(3);
    expect(model.analysis.gapCount).toBe(3);
    expect(model.analysis.severity.high).toBe(2);
    expect(model.analysis.severity.medium).toBe(1);
    expect(model.analysis.gapsWithPowEvidence).toBe(2); // empty PoW on rate limit
    expect(model.analysis.gapsWithLinkedActions).toBe(model.analysis.gapCount);
    expect(model.analysis.powLinkageRate).toBe(1);
    expect(model.analysis.topSharedGapTitles[0]?.title).toMatch(/Refresh token rotation/i);
    expect(model.analysis.topSharedGapTitles[0]?.count).toBe(2);
    expect(model.analysis.topSharedGapTitles[0]?.subjectCount).toBe(2);

    const rotation = model.gaps.find(
      (g) => g.subjectKey === "u:alice" && /rotation/i.test(g.title),
    );
    expect(rotation).toBeDefined();
    expect(rotation!.linkedActions.length).toBeGreaterThan(0);
    expect(rotation!.linkedActions.some((a) => a.kind === "proof_of_work_evidence")).toBe(
      true,
    );
  });

  it("computeStrengthsGapsAnalysis handles empty inputs", () => {
    const empty = computeStrengthsGapsAnalysis([], []);
    expect(empty.gapCount).toBe(0);
    expect(empty.powLinkageRate).toBe(0);
    expect(empty.topSharedGapTitles).toEqual([]);
    expect(empty.sharedGapThemes).toEqual([]);
    expect(empty.sharedStrengthThemes).toEqual([]);
  });

  it("spots multi-subject gap and strength overlap without inflating unique themes", () => {
    const model = buildStrengthsGapsBrowseModel([
      {
        subjectKey: "u:alice",
        subjectLabel: "Alice",
        report: {
          ...sampleReport,
          strengths: ["Clear threat model framing", "Unique alice strength"],
          gap_analysis: {
            summary: "s",
            gaps: [
              {
                title: "Refresh token rotation",
                proof_of_work: "a",
                severity: "high",
                suggested_repair: "r",
              },
              {
                title: "Alice-only gap",
                proof_of_work: "x",
                severity: "low",
                suggested_repair: "r",
              },
            ],
            next_steps: { directions: [], events: [] },
          },
        },
      },
      {
        subjectKey: "u:bob",
        subjectLabel: "Bob",
        report: {
          ...sampleReport,
          strengths: [
            "  Clear Threat Model Framing  ", // normalized match with Alice
            "Bob solo strength",
          ],
          gap_analysis: {
            summary: "s",
            gaps: [
              {
                title: "refresh token rotation", // case/space normalize with Alice
                proof_of_work: "b",
                severity: "medium",
                suggested_repair: "r",
              },
              {
                title: "Bob-only gap",
                proof_of_work: "y",
                severity: "high",
                suggested_repair: "r",
              },
            ],
            next_steps: { directions: [], events: [] },
          },
        },
      },
      {
        subjectKey: "u:cara",
        subjectLabel: "Cara",
        report: {
          ...sampleReport,
          strengths: ["Clear threat model framing"],
          gap_analysis: {
            summary: "s",
            gaps: [
              {
                title: "Refresh token rotation",
                proof_of_work: "c",
                severity: "high",
                suggested_repair: "r",
              },
            ],
            next_steps: { directions: [], events: [] },
          },
        },
      },
    ]);

    // Shared gap: 3 distinct subjects
    const sharedGap = model.analysis.sharedGapThemes.find((t) =>
      /refresh token rotation/i.test(t.label),
    );
    expect(sharedGap).toBeDefined();
    expect(sharedGap!.subjectCount).toBe(3);
    expect(sharedGap!.subjectKeys.sort()).toEqual(["u:alice", "u:bob", "u:cara"]);
    expect(sharedGap!.subjectLabels).toEqual(
      expect.arrayContaining(["Alice", "Bob", "Cara"]),
    );

    // Unique gaps must not appear as shared
    expect(
      model.analysis.sharedGapThemes.some((t) => /alice-only|bob-only/i.test(t.label)),
    ).toBe(false);
    const aliceOnly = model.analysis.gapThemeOverlaps.find((t) =>
      /alice-only/i.test(t.label),
    );
    expect(aliceOnly?.subjectCount).toBe(1);

    // Shared strength across 3 subjects
    const sharedStrength = model.analysis.sharedStrengthThemes.find((t) =>
      /clear threat model framing/i.test(t.label),
    );
    expect(sharedStrength).toBeDefined();
    expect(sharedStrength!.subjectCount).toBe(3);
    expect(
      model.analysis.sharedStrengthThemes.some((t) =>
        /unique alice|bob solo/i.test(t.label),
      ),
    ).toBe(false);

    // Same subject repeating a theme does not inflate subjectCount
    const dup = computeThemeOverlaps([
      { text: "Same theme", subjectKey: "u:x", subjectLabel: "X" },
      { text: "same theme", subjectKey: "u:x", subjectLabel: "X" },
      { text: "Same theme", subjectKey: "u:y", subjectLabel: "Y" },
    ]);
    expect(dup[0]?.subjectCount).toBe(2);
    expect(dup[0]?.occurrenceCount).toBe(3);
    expect(normalizeThemeKey("  Foo   Bar ")).toBe("foo bar");

    // Coverage chart: shared themes as bars with coverage vs subjectsWithReports
    const chart = buildCohortCoverageChart(model.analysis, { maxRows: 8 });
    expect(chart.length).toBeGreaterThan(0);
    const rotationBar = chart.find((r) => /refresh token rotation/i.test(r.label));
    expect(rotationBar).toBeDefined();
    expect(rotationBar!.kind).toBe("gap");
    expect(rotationBar!.subjectCount).toBe(3);
    expect(rotationBar!.coveragePct).toBe(100); // 3/3 subjects with reports
    const threatBar = chart.find((r) => /clear threat model framing/i.test(r.label));
    expect(threatBar?.kind).toBe("strength");
    expect(threatBar?.subjectCount).toBe(3);
    // Unique themes never appear on the shared chart
    expect(chart.some((r) => /alice-only|bob solo/i.test(r.label))).toBe(false);

    const stack = severityStackFractions(sharedGap!.severity);
    expect(stack.total).toBeGreaterThan(0);
    expect(stack.high + stack.medium + stack.low).toBeCloseTo(1, 5);
  });
});

describe("Knowledge Strengths & Gaps tab wiring", () => {
  it("places Strengths & Gaps immediately after Ranking in subtab order", () => {
    const panel = readFileSync(
      join(ROOT, "components/WorkspacePerformancePanel.tsx"),
      "utf8",
    );

    // PERFORMANCE_SUBVIEWS array order (visible nav ids)
    const subviewsMatch = panel.match(
      /const PERFORMANCE_SUBVIEWS[^=]*=\s*\[([\s\S]*?)\];/,
    );
    expect(subviewsMatch).toBeTruthy();
    const subviewOrder = [...(subviewsMatch?.[1].matchAll(/"([^"]+)"/g) ?? [])].map(
      (m) => m[1],
    );
    const rSv = subviewOrder.indexOf("ranking");
    const sSv = subviewOrder.indexOf("strengths_gaps");
    expect(rSv).toBeGreaterThanOrEqual(0);
    expect(sSv).toBe(rSv + 1);

    // Subtab list order in useMemo
    const tabsBlock = panel.slice(
      panel.indexOf("const subTabs"),
      panel.indexOf("return (", panel.indexOf("const subTabs")),
    );
    const order = [...tabsBlock.matchAll(/id:\s*"([^"]+)"/g)].map((m) => m[1]);
    const r = order.indexOf("ranking");
    const s = order.indexOf("strengths_gaps");
    expect(r).toBeGreaterThanOrEqual(0);
    expect(s).toBe(r + 1);
    expect(tabsBlock).toContain("performanceSubTabStrengthsGaps");
  });

  it("Knowledge panel mounts strengths_gaps view with structural markers", () => {
    const kctp = readFileSync(
      join(ROOT, "components/KnowledgeConfigTrajectoryPanel.tsx"),
      "utf8",
    );
    const sgp = readFileSync(join(ROOT, "components/StrengthsGapsPanel.tsx"), "utf8");

    expect(kctp).toMatch(/KnowledgePanelView[\s\S]*strengths_gaps/);
    expect(kctp).toMatch(/panelView === "strengths_gaps"|showStrengthsGaps/);
    expect(kctp).toContain("StrengthsGapsPanel");
    expect(sgp).toContain('data-section="strengths-gaps"');
    expect(sgp).toContain("data-strengths-gaps-analysis");
    expect(sgp).toContain("data-strengths-gaps-list");
    expect(sgp).toContain("data-gaps-list");
    expect(sgp).toContain("data-gap-pow-links");
    expect(sgp).toContain("buildStrengthsGapsBrowseModel");
    // Cohort overlap UI (shared gaps + shared strengths)
    expect(sgp).toContain("data-shared-gaps-section");
    expect(sgp).toContain("data-shared-strengths-section");
    expect(sgp).toContain("data-shared-gap-themes");
    expect(sgp).toContain("data-shared-strength-themes");
    expect(sgp).toContain("data-cohort-overlap-analysis");
    expect(sgp).toContain("sharedGapThemes");
    expect(sgp).toContain("sharedStrengthThemes");
    expect(sgp).toContain("data-cohort-coverage-chart");
    expect(sgp).toContain("data-cohort-venn-grid");
    expect(sgp).toContain("data-theme-venn");
    expect(sgp).toContain("CohortVennGrid");
    expect(sgp).toContain("data-severity-stack");
  });
});
