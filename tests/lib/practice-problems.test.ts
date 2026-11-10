import { describe, expect, it } from "vitest";
import { readRepo } from "../helpers/surface-source";
import {
  DASHBOARD_NAV_GROUPS,
  dashboardFrameLabel,
  dashboardNavGroupIdForTab,
  isDashboardBrowseMapsTab,
  isDashboardPracticeTab,
  isDashboardStudioTab,
  parseDashboardTab,
} from "@/lib/dashboard-nav";
import {
  PRACTICE_QUANTUM_PROBLEMS,
} from "@/lib/practice-quantum-catalog";
import {
  countPracticeProblems,
  filterPracticeCatalog,
  formatPracticeDuration,
  groupPracticeProblems,
  isPracticeSessionMetadata,
  isPracticeSolveFlow,
  listedAuthorSolveFlows,
  parsePracticeStartKind,
  practiceBrowseLevel,
  practiceFlowMatchesProblem,
  practiceIdentityForUser,
  practiceSessionHref,
  practiceSessionMetadata,
  practiceInsightsForSession,
  presentPracticeHistoryRow,
  presentPracticeInsight,
  presentPracticeProblem,
  summarizePracticeHistory,
} from "@/lib/practice-problems";
import {
  dashboardHomeCtas,
} from "@/lib/dashboard-home-overview";
import { presentDashboardDataStudio } from "@/lib/data-studio-view";
import { isFlowArchived } from "@/lib/flow-archive";

describe("practice catalog", () => {
  it("groups quantum problems into two category layers", () => {
    const presented = PRACTICE_QUANTUM_PROBLEMS.map((row, index) =>
      presentPracticeProblem({
        id: `p${index}`,
        slug: row.slug,
        category: row.category,
        subcategory: row.subcategory,
        title: row.title,
        prompt: row.prompt,
        sortOrder: row.sortOrder,
        durationMinutes: row.durationMinutes,
      }),
    ).filter((row): row is NonNullable<typeof row> => Boolean(row));
    const groups = groupPracticeProblems(presented);
    expect(groups.map((group) => group.category)).toEqual([
      "Quantum mechanics",
      "Quantum computing",
    ]);
    expect(groups[0]?.subcategories.length).toBeGreaterThan(1);
    expect(groups[1]?.subcategories.length).toBeGreaterThan(1);
    expect(countPracticeProblems(groups[0]!)).toBeGreaterThan(groups[0]!.subcategories.length);
    expect(practiceBrowseLevel({})).toBe("categories");
    expect(practiceBrowseLevel({ category: "Quantum mechanics" })).toBe("subcategories");
    expect(
      practiceBrowseLevel({
        category: "Quantum mechanics",
        subcategory: "Wave functions",
      }),
    ).toBe("problems");
    expect(filterPracticeCatalog(groups, { category: "Quantum computing" })).toHaveLength(1);
    expect(
      filterPracticeCatalog(groups, { query: "grover" })[0]?.subcategories[0]?.problems[0]?.slug,
    ).toBe("qc-grover-one-item");
    expect(filterPracticeCatalog(groups, { query: "zzzz-missing" })).toEqual([]);
    expect(presented.length).toBe(PRACTICE_QUANTUM_PROBLEMS.length);
    expect(PRACTICE_QUANTUM_PROBLEMS.every((row) => row.prompt.includes("?"))).toBe(false);
    expect(PRACTICE_QUANTUM_PROBLEMS.every((row) => row.prompt.length > 80)).toBe(true);
  });

  it("tags practice Solve flows and lists them with authored flows", () => {
    expect(isPracticeSolveFlow({ practiceProblemId: "p1" })).toBe(true);
    expect(isPracticeSolveFlow({ practice_problem_id: "p1" })).toBe(true);
    expect(isPracticeSolveFlow({ practiceProblemId: null })).toBe(false);
    const listed = listedAuthorSolveFlows(
      [
        { archivedAt: null, practiceProblemId: null },
        { archivedAt: null, practiceProblemId: "p1" },
        { archivedAt: "2026-11-09T00:00:00.000Z", practiceProblemId: null },
      ],
      isFlowArchived,
    );
    expect(listed).toHaveLength(2);
    expect(listed.map((flow) => flow.practiceProblemId ?? null)).toEqual([null, "p1"]);
    expect(practiceSessionHref("abc")).toBe("/session?id=abc");
    expect(practiceIdentityForUser("user-1")).toBe("practice:user-1");
    const meta = practiceSessionMetadata({
      problemId: "p1",
      flowId: "f1",
      title: "Bell",
      userId: "user-1",
    });
    expect(isPracticeSessionMetadata(meta)).toBe(true);
    const row = presentPracticeHistoryRow({
      sessionId: "s1",
      flowId: "f1",
      problemId: "p1",
      title: "Bell states",
      category: "Quantum computing",
      subcategory: "Entanglement",
      startedAt: "2026-11-09T00:00:00.000Z",
      durationMs: 125000,
      insightCount: 2,
      status: "completed",
    });
    expect(row?.insightCount).toBe(2);
    expect(summarizePracticeHistory(row ? [row] : [])).toEqual({
      sessionCount: 1,
      insightCount: 2,
      durationMs: 125000,
      problemCount: 1,
    });
    expect(formatPracticeDuration(125000)).toBe("2m 5s");
    const insight = presentPracticeInsight({
      id: "i1",
      sessionId: "s1",
      problemId: "p1",
      problemTitle: "Bell states",
      title: "Phase kickback",
      summary: "The control picks up the eigenphase.",
      createdAt: "2026-11-09T00:01:00.000Z",
      sessionElapsedMs: 45000,
    });
    expect(insight?.title).toBe("Phase kickback");
    expect(practiceInsightsForSession(insight ? [insight] : [], "s1")).toHaveLength(1);
    expect(practiceInsightsForSession(insight ? [insight] : [], "other")).toHaveLength(0);
  });
});

describe("practice dashboard surfaces", () => {
  it("puts browse maps on Learning and exercises plus Performance on Solve / Practice", () => {
    expect(parseDashboardTab("practice")).toBe("practice");
    expect(isDashboardBrowseMapsTab("browse_maps")).toBe(false);
    expect(isDashboardPracticeTab("practice")).toBe(true);
    expect(isDashboardStudioTab("practice_studio")).toBe(false);
    expect(parseDashboardTab("practice_studio")).toBe("solve_studio");
    expect(parseDashboardTab("practice_performance")).toBe("practice_performance");
    expect(dashboardFrameLabel("practice")).toBe("Practice library");
    expect(dashboardFrameLabel("solve_studio")).toBe("Data Studio");
    expect(dashboardFrameLabel("practice_performance")).toBe("Performance");
    expect(dashboardNavGroupIdForTab("practice")).toBeNull();
    expect(dashboardNavGroupIdForTab("practice_performance")).toBeNull();
    expect(dashboardNavGroupIdForTab("calibration")).toBe("calibration");
    const learning = DASHBOARD_NAV_GROUPS.find((group) => (group.id as string) === "learning");
    const solve = DASHBOARD_NAV_GROUPS.find((group) => group.id === "solve");
    expect(learning).toBeUndefined();
    expect(solve?.label).toBe("Solve");
    expect(solve?.items.map((item) => item.id)).not.toContain("practice");
    expect(solve?.items.map((item) => item.id)).not.toContain("practice_performance");
    expect(readRepo("app/dashboard/page.tsx")).toContain("DashboardPracticePerformanceTab");
    expect(readRepo("app/dashboard/page.tsx")).toContain("DashboardDataStudioTab");
    expect(readRepo("components/dashboard/dashboard-practice-performance-tab.tsx")).toContain(
      "data-dashboard-practice-insights",
    );
    expect(dashboardHomeCtas().map((cta) => cta.id)).toEqual([
      "practice",
      "verification",
      "calibration",
    ]);
    expect(readRepo("components/dashboard/dashboard-home-tab.tsx")).toContain(
      "data-dashboard-home-cta",
    );
    expect(readRepo("components/dashboard/dashboard-home-tab.tsx")).not.toContain(
      "data-dashboard-home-announcements",
    );
    expect(readRepo("components/dashboard/dashboard-sidebar.tsx")).not.toContain(
      "data-dashboard-nav-group-toggle",
    );
    expect(readRepo("lib/solve-flow-repository.ts")).not.toContain("isPracticeSolveFlow");
    expect(readRepo("app/api/dashboard/practice/start/route.ts")).toContain(
      "ensurePracticeSolveFlow",
    );
    expect(readRepo("app/api/dashboard/practice/start/route.ts")).toContain(
      "ensurePracticeVerificationFlow",
    );
    expect(readRepo("app/api/dashboard/practice/start/route.ts")).toContain(
      "ensurePracticeCalibrationFlow",
    );
    expect(readRepo("app/api/dashboard/practice/start/route.ts")).toContain(
      "rejectIfInsufficientSessionCredits",
    );
    expect(parsePracticeStartKind("verify")).toBe("verification");
    expect(parsePracticeStartKind("calibrate")).toBe("calibration");
    expect(parsePracticeStartKind(undefined)).toBe("solve");
    expect(
      practiceFlowMatchesProblem(
        { name: "Bell", topic: "Explain a Bell pair." },
        { title: "Bell", prompt: "Explain a Bell pair." },
      ),
    ).toBe(true);
    const practiceTab = readRepo("components/dashboard/dashboard-practice-tab.tsx");
    expect(practiceTab).toContain("data-dashboard-practice-crumbs");
    expect(practiceTab).toContain("data-dashboard-practice-open-category");
    expect(practiceTab).toContain("data-dashboard-practice-open-subcategory");
    expect(practiceTab).toContain('data-dashboard-practice-browse="categories"');
    expect(practiceTab).toContain("data-dashboard-practice-kind={kind}");
    expect(practiceTab).toContain("Solve / Practice");
    expect(practiceTab).toContain("Verify");
    expect(practiceTab).toContain("Calibrate");
    expect(practiceTab).not.toContain("<select");
    expect(practiceTab).not.toContain("All categories");
  });

  it("includes practice Solve flows in Solve Data Studio", () => {
    const embedding = {
      id: "e1",
      owner_user_id: "u1",
      flow_kind: "solve",
      flow_id: "flow-practice",
      run_id: "r1",
      vector: [1, 0],
    };
    const solve = presentDashboardDataStudio({
      product: "solve",
      viewerUserId: "u1",
      embeddings: [embedding],
    });
    expect(solve.flowKind).toBe("solve");
    expect(solve.embeddings).toHaveLength(1);
  });
});
