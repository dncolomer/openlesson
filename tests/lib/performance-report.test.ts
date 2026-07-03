import { describe, expect, it } from "vitest";
import {
  buildPerformanceReportContract,
  buildPerformanceReportInstructions,
  emptyPerformanceReport,
  EXAMPLE_PERFORMANCE_REPORT,
  PERFORMANCE_REPORT_SCHEMA,
} from "@/lib/agent-v2/performance-report";

describe("PERFORMANCE_REPORT_SCHEMA", () => {
  it("requires learning, conversion, marker_scores, and gap_analysis", () => {
    expect(PERFORMANCE_REPORT_SCHEMA.schema.required).toContain("overall_score");
    expect(PERFORMANCE_REPORT_SCHEMA.schema.required).toContain("conversion_score");
    expect(PERFORMANCE_REPORT_SCHEMA.schema.required).toContain("conversion_goal");
    expect(PERFORMANCE_REPORT_SCHEMA.schema.required).toContain("marker_scores");
    expect(PERFORMANCE_REPORT_SCHEMA.schema.required).toContain("gap_analysis");
  });
});

describe("buildPerformanceReportInstructions", () => {
  it("mentions spider scores and gaps", () => {
    const instructions = buildPerformanceReportInstructions(null);
    expect(instructions).toContain("overall_score");
    expect(instructions).toContain("conversion_score");
    expect(instructions).toContain("conversion_goal");
    expect(instructions).toContain("marker_scores");
    expect(instructions).toContain("gap_analysis.gaps");
    expect(instructions).toContain("spider/radar");
  });

  it("embeds authoritative workspace conversion goal when provided", () => {
    const instructions = buildPerformanceReportInstructions(null, "Trial-to-paid activation");
    expect(instructions).toContain("Authoritative workspace conversion goal");
    expect(instructions).toContain("Trial-to-paid activation");
  });
});

describe("buildPerformanceReportContract", () => {
  it("describes spider visualization and gap list", () => {
    const contract = buildPerformanceReportContract("https://openlesson.academy");
    expect(contract.endpoint_pattern).toContain("/performance");
    expect(contract.marker_scores.visualization).toBe("spider_radar");
    expect(contract.gap_analysis.gaps_required).toBe(true);
    expect(contract.example_report.overall_score).toBeGreaterThan(0);
    expect(contract.example_report.conversion_score).toBeGreaterThan(0);
    expect(contract.example_report.conversion_goal.length).toBeGreaterThan(0);
    expect(contract.example_report.marker_scores.length).toBeGreaterThanOrEqual(4);
    expect(contract.example_report.gap_analysis.gaps.length).toBeGreaterThan(0);
  });
});

describe("emptyPerformanceReport", () => {
  it("returns zero score and empty markers with gap scaffold", () => {
    const report = emptyPerformanceReport();
    expect(report.overall_score).toBe(0);
    expect(report.conversion_score).toBe(0);
    expect(report.conversion_goal.length).toBeGreaterThan(0);
    expect(report.marker_scores).toEqual([]);
    expect(report.gap_analysis.gaps).toEqual([]);
    expect(report.gap_analysis.next_practice.length).toBeGreaterThan(0);
  });
});

describe("EXAMPLE_PERFORMANCE_REPORT", () => {
  it("matches required report shape", () => {
    expect(EXAMPLE_PERFORMANCE_REPORT).toMatchObject({
      overall_score: expect.any(Number),
      conversion_score: expect.any(Number),
      conversion_goal: expect.any(String),
      marker_scores: expect.any(Array),
      gap_analysis: {
        gaps: expect.any(Array),
      },
    });
  });
});