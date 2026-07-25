import { describe, expect, it } from "vitest";
import {
  defaultLwmTimelineDateWindow,
  dualScoreSeriesFromRuns,
  filterLwmHistoryByDateWindow,
  formatDateInputLocal,
  scoreSeriesPolyline,
  selectLwmHistoryRun,
  timelineMarkersFromRuns,
  type LwmHistoryRunLike,
} from "@/lib/pow-api/lwm-snapshot-history-ui";

function run(
  partial: Partial<LwmHistoryRunLike> & { id: string; ran_at: string },
): LwmHistoryRunLike {
  return {
    score: 50,
    ghc_score: 40,
    ...partial,
  };
}

describe("defaultLwmTimelineDateWindow", () => {
  it("defaults to last 7 calendar days inclusive of today", () => {
    // Local noon avoids DST edge quirks when constructing from y/m/d parts.
    const now = new Date(2026, 6, 25, 12, 0, 0); // 25 Jul 2026 local
    const w = defaultLwmTimelineDateWindow({ days: 7, now });
    expect(w.to).toBe("2026-07-25");
    expect(w.from).toBe("2026-07-19"); // today and previous 6 days
  });

  it("respects custom day count and month boundaries", () => {
    const now = new Date(2026, 2, 3, 9, 0, 0); // 3 Mar 2026
    const w = defaultLwmTimelineDateWindow({ days: 7, now });
    expect(w.to).toBe("2026-03-03");
    expect(w.from).toBe("2026-02-25");
  });

  it("formatDateInputLocal zero-pads month and day", () => {
    expect(formatDateInputLocal(new Date(2026, 0, 5))).toBe("2026-01-05");
  });
});

describe("filterLwmHistoryByDateWindow", () => {
  const rows = [
    run({ id: "a", ran_at: "2026-07-01T12:00:00.000Z", score: 70 }),
    run({ id: "b", ran_at: "2026-07-10T12:00:00.000Z", score: 80 }),
    run({ id: "c", ran_at: "2026-07-20T12:00:00.000Z", score: 90 }),
  ];

  it("returns all when window empty", () => {
    expect(filterLwmHistoryByDateWindow(rows, {}).map((r) => r.id)).toEqual(["a", "b", "c"]);
  });

  it("filters by from/to date-only bounds inclusively", () => {
    const mid = filterLwmHistoryByDateWindow(rows, {
      from: "2026-07-10",
      to: "2026-07-15",
    });
    expect(mid.map((r) => r.id)).toEqual(["b"]);
  });

  it("from alone drops older points", () => {
    const later = filterLwmHistoryByDateWindow(rows, { from: "2026-07-15" });
    expect(later.map((r) => r.id)).toEqual(["c"]);
  });
});

describe("selectLwmHistoryRun", () => {
  const rows = [
    run({ id: "old", ran_at: "2026-07-01T00:00:00.000Z", score: 10 }),
    run({ id: "new", ran_at: "2026-07-20T00:00:00.000Z", score: 99 }),
  ];

  it("selects by id when present", () => {
    expect(selectLwmHistoryRun(rows, "old")?.id).toBe("old");
  });

  it("falls back to newest when id missing", () => {
    expect(selectLwmHistoryRun(rows, "nope")?.id).toBe("new");
    expect(selectLwmHistoryRun(rows, null)?.id).toBe("new");
  });

  it("returns null for empty", () => {
    expect(selectLwmHistoryRun([], "x")).toBeNull();
  });
});

describe("dualScoreSeriesFromRuns + timeline + polyline", () => {
  it("orders oldest→newest and extracts both scores", () => {
    const series = dualScoreSeriesFromRuns([
      run({ id: "b", ran_at: "2026-07-10T00:00:00.000Z", score: 80, ghc_score: 60 }),
      run({ id: "a", ran_at: "2026-07-01T00:00:00.000Z", score: 50, ghc_score: 40 }),
    ]);
    expect(series.map((p) => p.id)).toEqual(["a", "b"]);
    expect(series[0].snapshotScore).toBe(50);
    expect(series[1].ghcScore).toBe(60);
  });

  it("places timeline markers at normalized t", () => {
    const marks = timelineMarkersFromRuns([
      run({ id: "a", ran_at: "2026-07-01T00:00:00.000Z" }),
      run({ id: "b", ran_at: "2026-07-11T00:00:00.000Z" }),
    ]);
    expect(marks).toHaveLength(2);
    expect(marks[0].t).toBeCloseTo(0);
    expect(marks[1].t).toBeCloseTo(1);
  });

  it("builds SVG polyline for snapshot series", () => {
    const series = dualScoreSeriesFromRuns([
      run({ id: "a", ran_at: "2026-07-01T00:00:00.000Z", score: 0 }),
      run({ id: "b", ran_at: "2026-07-11T00:00:00.000Z", score: 100 }),
    ]);
    const poly = scoreSeriesPolyline(series, "snapshotScore", 200, 100, 0);
    expect(poly).toContain("0.0");
    expect(poly.split(" ")).toHaveLength(2);
    // second point near right + top (score 100 → y≈0)
    const [x2, y2] = poly.split(" ")[1].split(",").map(Number);
    expect(x2).toBeCloseTo(200, 0);
    expect(y2).toBeCloseTo(0, 0);
  });
});
