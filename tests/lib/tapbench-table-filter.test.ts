/**
 * TAPBench results table column filters and pagination.
 */
import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  TAPBENCH_RESULTS_PAGE_SIZE,
  matchTapbenchColFilter,
  paginateTapbenchRows,
} from "@/lib/tapbench/table-filter";

const ROOT = join(__dirname, "../..");

describe("TAPBench results table filter + pagination", () => {
  it("matches text contains and numeric comparators", () => {
    expect(matchTapbenchColFilter("", { text: "Tao" })).toBe(true);
    expect(matchTapbenchColFilter("tao", { text: "Tao Lean five-lemma cohort" })).toBe(true);
    expect(matchTapbenchColFilter("algebra", { text: "Tao Lean five-lemma cohort" })).toBe(
      false,
    );
    expect(matchTapbenchColFilter("out", { text: "out" })).toBe(true);
    expect(matchTapbenchColFilter(">0.5", { text: "0.9142", value: 0.914193 })).toBe(true);
    expect(matchTapbenchColFilter("<0.5", { text: "0.9142", value: 0.914193 })).toBe(false);
    expect(matchTapbenchColFilter(">=5", { text: "5", value: 5 })).toBe(true);
    expect(matchTapbenchColFilter(">5", { text: "5", value: 5 })).toBe(false);
    expect(matchTapbenchColFilter(">0.5", { text: "n/a", value: null })).toBe(false);
  });

  it("paginates 10 rows per page", () => {
    const rows = Array.from({ length: 23 }, (_, i) => i);
    const first = paginateTapbenchRows(rows, 1);
    expect(TAPBENCH_RESULTS_PAGE_SIZE).toBe(10);
    expect(first.slice).toEqual(rows.slice(0, 10));
    expect(first.from).toBe(1);
    expect(first.to).toBe(10);
    expect(first.pages).toBe(3);
    const last = paginateTapbenchRows(rows, 3);
    expect(last.slice).toEqual(rows.slice(20));
    expect(last.from).toBe(21);
    expect(last.to).toBe(23);
    expect(paginateTapbenchRows(rows, 99).page).toBe(3);
  });

  it("landing results table has no column filters; /tapbench/results is gone", () => {
    expect(existsSync(join(ROOT, "app/tapbench/results/page.tsx"))).toBe(false);
    expect(existsSync(join(ROOT, "components/TapbenchResultsBrowse.tsx"))).toBe(false);
    const landing = readFileSync(join(ROOT, "components/TapbenchLanding.tsx"), "utf8");
    const table = readFileSync(join(ROOT, "components/TapbenchResultsTable.tsx"), "utf8");
    expect(landing).not.toContain("/tapbench/results");
    expect(landing).not.toContain("data-tapbench-results-all");
    expect(table).not.toContain("data-tapbench-col-filter");
    expect(table).not.toContain("data-tapbench-pagination");
  });
});
