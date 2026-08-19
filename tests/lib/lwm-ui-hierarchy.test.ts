/**
 * LWM panel: control + snapshot list + integrated detail (scores+spider, tabbed rest).
 */
import { describe, expect, it } from "vitest";
import { readKnowledgePanelSurface } from "../helpers/surface-source";

function readLwm(): string {
  return readKnowledgePanelSurface();
}

function lwmSection(src: string): string {
  const i = src.indexOf('data-lwm-layout=');
  if (i < 0) return src;
  // LWM panel is large (modals + list-detail + tabs); keep enough of the section.
  return src.slice(i, i + 120000);
}

describe("LWM architecture (integrated detail)", () => {
  it("orders control → snapshot list → integrated detail", () => {
    const src = readLwm();
    expect(src).toContain('data-lwm-layout="profile-zones"');
    const section = lwmSection(src);
    const control = section.indexOf('data-lwm-zone="control"');
    const results = section.indexOf('data-lwm-zone="results"');
    const history = section.indexOf('data-lwm-zone="history"');
    const overview = section.indexOf('data-lwm-zone="overview"');
    const report = section.indexOf('data-lwm-zone="report"');
    expect(control).toBeGreaterThanOrEqual(0);
    expect(results).toBeGreaterThan(control);
    expect(history).toBeGreaterThan(results);
    expect(overview).toBeGreaterThan(history);
    // Report markers live on the detail panel (tab body), same surface as scores
    expect(report).toBeGreaterThan(overview);
    expect(section).toContain("data-lwm-snapshot-sidebar");
    expect(section).toContain("data-lwm-snapshot-list");
    expect(section).toContain("data-lwm-detail");
    expect(section).toContain("data-lwm-detail-tabs");
  });

  it("control zone has subject + generate; goals live in generate modal", () => {
    const src = readLwm();
    const section = lwmSection(src);
    const controlStart = section.indexOf('data-lwm-zone="control"');
    const resultsStart = section.indexOf('data-lwm-zone="results"');
    const control = section.slice(controlStart, resultsStart);
    expect(control).toContain("UserPicker");
    expect(control).toContain("data-lwm-generate-snapshot");
    expect(control).toContain("data-lwm-generate-snapshot-all");
    // Goal picker is no longer inline in the compact control bar
    expect(control).not.toContain("data-lwm-goal-selection");
    // Modal hosts goal selection + progress
    expect(src).toContain("data-lwm-snapshot-modal");
    expect(src).toContain("data-lwm-goal-selection");
    expect(src).toContain("data-lwm-snapshot-progress");
    expect(src).toMatch(/openSnapshotModal\("single"\)/);
    expect(src).toMatch(/goal_mode:\s*goalMode/);
    expect(src).toMatch(/adhoc_goal/);
    expect(src).toMatch(/goal_ids/);
  });

  it("profile tab integrates scores + spider; other data is tabbed", () => {
    const src = readLwm();
    const section = lwmSection(src);
    expect(section).toContain("data-lwm-skill-score");
    expect(section).toContain("data-lwm-ghc-score");
    expect(section).toContain("data-lwm-detail-spider");
    expect(section).toContain("MarkerRadarChart");
    expect(section).toContain("data-lwm-detail-tab");
    expect(section).toContain('id: "profile"');
    expect(section).toContain('id: "goals"');
    expect(section).toContain('id: "summary"');
    expect(section).toContain('id: "markers"');
    expect(section).toContain('id: "strengths"');
    expect(section).toContain('id: "gaps"');
    expect(section).toContain('id: "next_steps"');
    expect(section).toContain('id: "details"');
    expect(src).toMatch(/useState<LwmDetailTab>\("profile"\)/);
    expect(section).toContain('lwmDetailTab === "profile"');
    // Goals used for the snapshot live on their own tab (not under Summary)
    expect(section).toContain('lwmDetailTab === "goals"');
    expect(section).toContain("data-lwm-detail-goals");
    expect(section).toContain("Goals used for this snapshot");
    const goalsTab = section.indexOf('lwmDetailTab === "goals"');
    const summaryTab = section.indexOf('lwmDetailTab === "summary"');
    expect(goalsTab).toBeGreaterThan(0);
    expect(summaryTab).toBeGreaterThan(goalsTab);
    const summaryPanel = section.slice(
      summaryTab,
      section.indexOf('lwmDetailTab === "markers"'),
    );
    expect(summaryPanel).not.toContain("Goals used for this snapshot");
    expect(summaryPanel).not.toContain("data-lwm-evaluated-goals");
    // Score explanations only via Explain Scores modal (not inline on profile)
    expect(section).toContain("data-lwm-explain-scores");
    expect(section).toMatch(/Explain[\s\S]*Scores/);
    expect(section).toContain("data-lwm-score-explain-modal");
    expect(section).toContain("data-lwm-primary-explanation");
    expect(section).toContain("data-lwm-ghc-explanation");
    expect(section).toContain("data-lwm-primary-meaning");
    expect(section).toContain("data-lwm-ghc-meaning");
    // Integrated detail — not separate report card / PerformanceReportCard
    expect(section).not.toContain("PerformanceReportCard");
    expect(section).not.toContain("data-lwm-results-grid");
    expect(section).not.toContain("data-lwm-date-from");
    expect(section).not.toContain("data-lwm-score-trend");
  });

  it("keeps world-model notes secondary under Details tab", () => {
    const section = lwmSection(readLwm());
    expect(section).toContain("data-lwm-profile-disclosure");
    expect(section).toContain("Could use more evidence on");
    expect(section).toContain('lwmDetailTab === "details"');
  });
});
