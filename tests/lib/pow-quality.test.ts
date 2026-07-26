import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import {
  classifyPowQuality,
  filterSnapshotEligibleProofOfWorkRows,
  isExcludedFromSnapshotPoW,
  isImpurePoWMetadata,
  isPracticePoW,
  isScoredPoW,
  matchesPowQualityFilter,
} from "@/lib/pow-api/pow-quality";
import { aggregateProofOfWorkStats, type ProofOfWorkStatsRow } from "@/lib/pow-api/proof-of-work-stats";

const ROOT = process.cwd();

describe("pow-quality snapshot exclusion", () => {
  it("detects impure and practice metadata", () => {
    expect(isImpurePoWMetadata({ impure: true })).toBe(true);
    expect(isImpurePoWMetadata({ quality: "impure" })).toBe(true);
    expect(isPracticePoW({ practice: true, pow_label: "Practice PoW" })).toBe(true);
    expect(isPracticePoW({ pow_kind: "practice" })).toBe(true);
    expect(isScoredPoW({ tap_session_id: "t1" })).toBe(true);
    expect(isExcludedFromSnapshotPoW({ practice: true })).toBe(true);
    expect(isExcludedFromSnapshotPoW({ impure: true })).toBe(true);
    expect(isExcludedFromSnapshotPoW({})).toBe(false);
  });

  it("filters snapshot rows to scored-only", () => {
    const rows = [
      { id: "1", metadata: { tap_session_id: "a" } },
      { id: "2", metadata: { practice: true, pow_kind: "practice" } },
      { id: "3", metadata: { impure: true, quality: "impure" } },
      { id: "4", metadata: { practice_pow: true } },
    ];
    const eligible = filterSnapshotEligibleProofOfWorkRows(rows);
    expect(eligible.map((r) => r.id)).toEqual(["1"]);
  });

  it("matches quality filters", () => {
    expect(matchesPowQualityFilter({ practice: true }, "practice")).toBe(true);
    expect(matchesPowQualityFilter({ impure: true }, "impure")).toBe(true);
    expect(matchesPowQualityFilter({}, "scored")).toBe(true);
    expect(matchesPowQualityFilter({ practice: true }, "scored")).toBe(false);
    expect(classifyPowQuality({ practice: true, impure: true })).toBe("impure");
  });
});

describe("aggregateProofOfWorkStats quality + subject", () => {
  function row(
    partial: Partial<ProofOfWorkStatsRow> & { created_at: string },
  ): ProofOfWorkStatsRow {
    return {
      proof_of_work_type: "tool",
      tool_name: null,
      tool_action: null,
      block_id: null,
      session_id: null,
      file_size: 10,
      mime_type: "application/json",
      device_name: null,
      timestamp_ms: Date.parse(partial.created_at),
      metadata: {},
      user_id: null,
      guest_user_id: null,
      ...partial,
    };
  }

  it("counts practice and impure separately and filters detail aggregates", () => {
    const now = Date.now();
    const rows: ProofOfWorkStatsRow[] = [
      row({
        created_at: new Date(now).toISOString(),
        metadata: {},
        user_id: "u1",
        tool_name: "tap-trace",
      }),
      row({
        created_at: new Date(now - 1000).toISOString(),
        metadata: { practice: true, pow_kind: "practice" },
        user_id: "u1",
        tool_name: "tap-trace",
      }),
      row({
        created_at: new Date(now - 2000).toISOString(),
        metadata: { impure: true },
        guest_user_id: "g1",
        tool_name: "tap-speech",
      }),
    ];

    const all = aggregateProofOfWorkStats("ws", 3, rows);
    expect(all.scored_artifacts).toBe(1);
    expect(all.practice_artifacts).toBe(1);
    expect(all.impure_artifacts).toBe(1);
    expect(all.subjects.length).toBe(2);

    const practiceOnly = aggregateProofOfWorkStats("ws", 3, rows, { quality: "practice" });
    expect(practiceOnly.unique_tools).toBe(1);
    expect(practiceOnly.recent.every((r) => r.quality === "practice")).toBe(true);

    const me = aggregateProofOfWorkStats("ws", 3, rows, {
      subjectKey: "me",
      currentUserId: "u1",
    });
    // me = scored + practice for u1 (no guest)
    expect(me.scored_artifacts).toBe(1);
    expect(me.practice_artifacts).toBe(1);
    expect(me.impure_artifacts).toBe(1); // quality counts stay sample-wide
    expect(me.unique_tools).toBe(1);
  });
});

describe("wiring: snapshots exclude + UI surfaces", () => {
  it("performance-context filters snapshot-eligible PoW", () => {
    const src = fs.readFileSync(path.join(ROOT, "lib/pow-api/performance-context.ts"), "utf8");
    expect(src).toContain("filterSnapshotEligibleProofOfWorkRows");
  });

  it("PoW panel is user-filter only (no quality control); stats in table; insights tab hidden", () => {
    const panel = fs.readFileSync(path.join(ROOT, "components/ProofOfWorkStatsPanel.tsx"), "utf8");
    // Users-only filter — quality dropdown removed from this surface.
    expect(panel).not.toContain("data-pow-quality-filter");
    expect(panel).not.toContain("qualityFilter");
    expect(panel).not.toContain("PowQualityFilter");
    expect(panel).not.toMatch(/quality:\s*qualityFilter/);
    expect(panel).toContain("data-pow-subject-filter");
    expect(panel).toContain("subjectKey");
    // Condensed summary table instead of StatCard grids.
    expect(panel).toContain("data-pow-stats-table");
    expect(panel).toContain("<table");
    expect(panel).not.toContain("function StatCard");
    expect(panel).not.toMatch(/grid gap-2 sm:grid-cols-2 lg:grid-cols-4/);
    // Quality counts still shown as table rows (display, not filter).
    expect(panel).toContain("practice_artifacts");
    expect(panel).toContain("impure_artifacts");
    expect(panel).toContain("scored_artifacts");

    const perf = fs.readFileSync(
      path.join(ROOT, "components/WorkspacePerformancePanel.tsx"),
      "utf8",
    );
    expect(perf).not.toContain("InsightsDashboardTab");
    // Visible Knowledge subtabs (Insights remains hidden / not in PERFORMANCE_SUBVIEWS).
    expect(perf).toMatch(
      /const PERFORMANCE_SUBVIEWS: readonly PerformanceSubview\[] = \[\s*"ranking",\s*"strengths_gaps",\s*"lwm",\s*"knowledge",\s*"pow",\s*\]/,
    );
    expect(perf).not.toContain('id: "insights"');
  });
});
