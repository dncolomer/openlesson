import { describe, expect, it } from "vitest";
import {
  buildPerformanceReportContract,
  buildPerformanceReportInstructions,
  emptyPerformanceReport,
  EXAMPLE_PERFORMANCE_REPORT,
  isPlatformRemediationSuggestion,
  normalizePerformanceReport,
  PERFORMANCE_REMEDIATION_GUARDRAILS,
  PERFORMANCE_REPORT_SCHEMA,
  sanitizeRemediationStrings,
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
    expect(instructions).toContain("gap_analysis.next_steps");
    expect(instructions).toContain("spider/radar");
    expect(instructions).toContain(PERFORMANCE_REMEDIATION_GUARDRAILS);
    expect(instructions).toContain("NEVER mention OpenLesson platform mechanics");
  });

  it("embeds authoritative workspace conversion goal when provided", () => {
    const instructions = buildPerformanceReportInstructions(null, "Trial-to-paid activation");
    expect(instructions).toContain("Authoritative workspace conversion goal");
    expect(instructions).toContain("Trial-to-paid activation");
  });

  it("appends optional style_prompt voice instructions", () => {
    const instructions = buildPerformanceReportInstructions(
      null,
      null,
      'Address the user as "you" in second person.'
    );
    expect(instructions).toContain("Output style");
    expect(instructions).toContain('Address the user as "you" in second person.');
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
    expect(report.gap_analysis.next_steps.directions.length).toBeGreaterThan(0);
    expect(report.gap_analysis.next_steps.events.length).toBeGreaterThan(0);
    expect(report.summary).not.toMatch(/TAP/i);
    for (const event of report.gap_analysis.next_steps.events) {
      expect(isPlatformRemediationSuggestion(event)).toBe(false);
    }
  });
});

describe("remediation guardrails", () => {
  it("flags platform-specific remediation language", () => {
    expect(isPlatformRemediationSuggestion("Schedule a TAP review on block 3")).toBe(true);
    expect(isPlatformRemediationSuggestion("Complete the workspace block")).toBe(true);
    expect(isPlatformRemediationSuggestion("Route energy grid across sectors")).toBe(false);
  });

  it("strips platform suggestions during normalization", () => {
    const normalized = normalizePerformanceReport({
      ...EXAMPLE_PERFORMANCE_REPORT,
      suggestions: ["Run a TAP session", "Upload tool traces for onboarding"],
      gap_analysis: {
        ...EXAMPLE_PERFORMANCE_REPORT.gap_analysis,
        next_steps: {
          directions: ["Finish block onboarding"],
          events: ["deploy_scout_drone", "Issue a Think Aloud Protocol session"],
        },
        gaps: [
          {
            title: "Missing scout coverage",
            evidence: "No scout events in trace.",
            severity: "medium",
            suggested_repair: "Complete the scouting block in OpenLesson",
          },
        ],
      },
    });

    expect(normalized.suggestions).toEqual(["Upload tool traces for onboarding"]);
    expect(normalized.gap_analysis.next_steps.directions).toEqual([]);
    expect(normalized.gap_analysis.next_steps.events).toEqual(["deploy_scout_drone"]);
    expect(normalized.gap_analysis.gaps[0]?.suggested_repair).not.toContain("block");
    expect(sanitizeRemediationStrings(["connect_slack", "run TAP"])).toEqual(["connect_slack"]);
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
        next_steps: {
          directions: expect.any(Array),
          events: expect.any(Array),
        },
      },
    });
  });
});