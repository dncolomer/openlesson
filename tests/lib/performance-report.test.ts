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
  recoverPerformanceReportFromModelText,
  sanitizeRemediationStrings,
} from "@/lib/agent-v2/performance-report";

describe("PERFORMANCE_REPORT_SCHEMA", () => {
  it("requires learning, conversion, GHC, marker_scores, and gap_analysis", () => {
    expect(PERFORMANCE_REPORT_SCHEMA.schema.required).toContain("overall_score");
    expect(PERFORMANCE_REPORT_SCHEMA.schema.required).not.toContain("exploration_score");
    expect(PERFORMANCE_REPORT_SCHEMA.schema.required).toContain("conversion_score");
    expect(PERFORMANCE_REPORT_SCHEMA.schema.required).toContain("conversion_goal");
    expect(PERFORMANCE_REPORT_SCHEMA.schema.required).toContain("ghc_score");
    expect(PERFORMANCE_REPORT_SCHEMA.schema.required).toContain("ghc_confidence");
    expect(PERFORMANCE_REPORT_SCHEMA.schema.required).toContain("marker_scores");
    expect(PERFORMANCE_REPORT_SCHEMA.schema.required).toContain("gap_analysis");
    expect(JSON.stringify(PERFORMANCE_REPORT_SCHEMA.schema)).not.toContain("next_practice");
  });
});

describe("buildPerformanceReportInstructions", () => {
  it("mentions triple scores, ontology, temporal PoW, spider scores and gaps", () => {
    const instructions = buildPerformanceReportInstructions(null);
    expect(instructions).toContain("WORKSPACE ONTOLOGY");
    expect(instructions).toContain("overall_score");
    expect(instructions).not.toMatch(/compatibility alias|also emitted as overall_score/i);
    expect(instructions).toContain("conversion_score");
    expect(instructions).toContain("conversion_goal");
    expect(instructions).toContain("ghc_score");
    expect(instructions).toContain("Genuine Human Cognition");
    expect(instructions).toContain("temporal");
    expect(instructions).toContain("marker_scores");
    expect(instructions).toContain("gap_analysis.gaps");
    expect(instructions).toContain("gap_analysis.next_steps");
    expect(instructions).toContain("spider/radar");
    expect(instructions).toContain(PERFORMANCE_REMEDIATION_GUARDRAILS);
    expect(instructions).toContain("NEVER mention Uncertain Systems platform mechanics");
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
  it("describes spider visualization and gap list without dual score fields", () => {
    const contract = buildPerformanceReportContract("https://uncertain.systems");
    expect(contract.endpoint_pattern).toContain("/performance");
    expect(contract.marker_scores.visualization).toBe("spider_radar");
    expect(contract.gap_analysis.gaps_required).toBe(true);
    expect(contract.required_fields).toContain("overall_score");
    expect(contract.required_fields).not.toContain("exploration_score");
    expect(contract.example_report.overall_score).toBeGreaterThan(0);
    expect(contract.example_report.conversion_score).toBeGreaterThan(0);
    expect(contract.example_report.conversion_goal.length).toBeGreaterThan(0);
    expect(contract.example_report.marker_scores.length).toBeGreaterThanOrEqual(4);
    expect(contract.example_report.gap_analysis.gaps.length).toBeGreaterThan(0);
    expect(contract.example_report).not.toHaveProperty("exploration_score");
  });
});

describe("emptyPerformanceReport", () => {
  it("returns zero score and empty markers with gap scaffold", () => {
    const report = emptyPerformanceReport();
    expect(report.overall_score).toBe(0);
    expect(report).not.toHaveProperty("exploration_score");
    expect(report.conversion_score).toBe(0);
    expect(report.ghc_score).toBe(0);
    expect(report.ghc_confidence).toBe("none");
    expect(report.conversion_goal.length).toBeGreaterThan(0);
    expect(report.marker_scores).toEqual([]);
    expect(report.gap_analysis.gaps).toEqual([]);
    expect(report.gap_analysis).not.toHaveProperty("next_practice");
    expect(report.gap_analysis.next_steps.directions.length).toBeGreaterThan(0);
    expect(report.gap_analysis.next_steps.events.length).toBeGreaterThan(0);
    expect(report.summary).not.toMatch(/TAP/i);
    for (const event of report.gap_analysis.next_steps.events) {
      expect(isPlatformRemediationSuggestion(event)).toBe(false);
    }
  });
});

describe("normalizePerformanceReport", () => {
  it("clamps scores and defaults GHC confidence", () => {
    const normalized = normalizePerformanceReport({
      ...EXAMPLE_PERFORMANCE_REPORT,
      overall_score: 80,
      ghc_score: undefined as unknown as number,
      ghc_confidence: "not-a-level" as unknown as "none",
    });
    expect(normalized.overall_score).toBe(80);
    expect(normalized).not.toHaveProperty("exploration_score");
    expect(normalized.ghc_confidence).toBe("none");
    expect(normalized.gap_analysis).not.toHaveProperty("next_practice");
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
            proof_of_work: "No scout events in trace.",
            severity: "medium",
            suggested_repair: "Complete the scouting block in Uncertain Systems",
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
      ghc_score: expect.any(Number),
      ghc_confidence: expect.any(String),
      marker_scores: expect.any(Array),
      gap_analysis: {
        gaps: expect.any(Array),
        next_steps: {
          directions: expect.any(Array),
          events: expect.any(Array),
        },
      },
    });
    expect(EXAMPLE_PERFORMANCE_REPORT).not.toHaveProperty("exploration_score");
  });
});

describe("recoverPerformanceReportFromModelText", () => {
  it("recovers a report from markdown-wrapped JSON with trailing commas", () => {
    const malformed = `Here is the report:
\`\`\`json
{
  "overall_score": 61,
  "conversion_score": 54,
  "conversion_goal": "Ship onboarding flow",
  "marker_scores": [
    { "id": "execution", "label": "Execution", "score": 66, "rationale": "Completed setup steps.", },
    { "id": "reflection", "label": "Reflection", "score": 48, "rationale": "Sparse decision notes.", },
  ],
  "summary": "Partial readiness with execution ahead of reflection.",
  "strengths": ["Completed primary workflow"],
  "growth_areas": ["Document tradeoffs"],
  "gap_analysis": {
    "summary": "Reflection lags execution.",
    "gaps": [],
    "next_steps": { "directions": ["Build decision log habit"], "events": ["capture_checkpoint_metrics"], },
  },
  "suggestions": ["Upload checkpoint screenshots"],
  "confidence": "developing",
}
\`\`\``;

    const recovered = recoverPerformanceReportFromModelText(malformed);
    expect(recovered).not.toBeNull();
    expect(typeof recovered?.overall_score).toBe("number");
    expect(recovered?.overall_score).toBe(61);
    expect(recovered?.ghc_confidence).toBe("none");
    expect(Array.isArray(recovered?.marker_scores)).toBe(true);
    expect(recovered?.marker_scores.length).toBeGreaterThan(0);
    expect(recovered?.marker_scores[0]?.score).toBe(66);
  });

  it("recovers from truncated JSON when core marker fields are present", () => {
    const truncated = `{
  "overall_score": 73,
  "conversion_score": 60,
  "marker_scores": [
    { "label": "Workflow Execution", "score": 78, "rationale": "Consistent traces." },
    { "label": "Decision Quality", "score": 65, "rationale": "Reasonable choices." }
  ],
  "summary": "Solid execution with room to improve reflection.",
  "gap_analysis": { "summary": "Gaps found.", "gaps": [], "next_steps": { "directions": [], "events": [] } }`;

    const recovered = recoverPerformanceReportFromModelText(truncated);
    expect(recovered).not.toBeNull();
    expect(recovered?.overall_score).toBe(73);
    expect(recovered?.ghc_score).toBe(0);
    expect(recovered?.marker_scores.length).toBe(2);
    expect(recovered?.marker_scores[0]?.id).toBe("marker_1");
    expect(recovered?.confidence).toBe("developing");
  });

  it("returns null when marker_scores are missing", () => {
    expect(recoverPerformanceReportFromModelText('{"overall_score": 10}')).toBeNull();
  });
});
