import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { readRepo } from "../helpers/surface-source";
import {
  formatSolvePerformanceDuration,
  presentSolvePerformanceInsight,
  presentSolvePerformanceRow,
  solvePerformanceDurationMs,
  solvePerformanceInsightsForSession,
  solveSessionHref,
  summarizeSolvePerformance,
} from "@/lib/solve-performance";

describe("solve performance helpers", () => {
  it("presents session rows, insights, and duration copy", () => {
    expect(solveSessionHref("s1")).toBe("/session?id=s1");
    expect(formatSolvePerformanceDuration(0)).toBe("0s");
    expect(formatSolvePerformanceDuration(45000)).toBe("45s");
    expect(formatSolvePerformanceDuration(125000)).toBe("2m 5s");
    expect(formatSolvePerformanceDuration(3_700_000)).toBe("1h 1m");
    expect(
      solvePerformanceDurationMs({
        duration_ms: 0,
        created_at: "2026-11-11T00:00:00.000Z",
        ended_at: "2026-11-11T00:01:00.000Z",
      }),
    ).toBe(60000);
    const row = presentSolvePerformanceRow({
      sessionId: "s1",
      flowId: "f1",
      title: "Bell pair",
      startedAt: "2026-11-11T00:00:00.000Z",
      durationMs: 60000,
      status: "completed",
    });
    expect(row?.title).toBe("Bell pair");
    const insight = presentSolvePerformanceInsight({
      id: "i1",
      sessionId: "s1",
      flowId: "f1",
      flowTitle: "Bell pair",
      title: "Phase kickback",
      summary: "The control picks up the eigenphase.",
      createdAt: "2026-11-11T00:01:00.000Z",
      sessionElapsedMs: 45000,
    });
    expect(insight?.title).toBe("Phase kickback");
    expect(solvePerformanceInsightsForSession(insight ? [insight] : [], "s1")).toHaveLength(1);
    expect(solvePerformanceInsightsForSession(insight ? [insight] : [], "other")).toHaveLength(0);
    expect(summarizeSolvePerformance(row ? [{ ...row, insightCount: 2 }] : [])).toEqual({
      sessionCount: 1,
      insightCount: 2,
      durationMs: 60000,
      flowCount: 1,
    });
  });

  it("mounts Performance under Solve / Practice without the catalog", () => {
    const tab = readRepo("components/dashboard/dashboard-practice-performance-tab.tsx");
    expect(tab).toContain("data-dashboard-practice-performance");
    expect(tab).toContain("data-dashboard-practice-insights");
    expect(tab).toContain("/api/dashboard/solve/performance");
    expect(tab).toContain("No Solve runs yet.");
    expect(existsSync(join(__dirname, "../../app/api/dashboard/solve/performance/route.ts"))).toBe(
      true,
    );
    expect(readRepo("app/api/dashboard/solve/performance/route.ts")).toContain(
      "loadSolvePerformance",
    );
    expect(readRepo("lib/solve-performance.ts")).not.toContain("practice_problems");
    expect(readRepo("lib/solve-performance.ts")).not.toContain("practice_problem_id");
  });
});
