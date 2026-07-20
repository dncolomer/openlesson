import { describe, expect, it } from "vitest";
import {
  applyNamedScoreField,
  buildAllVerticalScoreContracts,
  buildVerticalScoreInstructions,
  buildVerticalScoreReportContract,
  buildVerticalScoreReportSchema,
  emptyVerticalScoreReport,
  EXAMPLE_AUGMENTATION_SCORE_REPORT,
  EXAMPLE_OPTIMIZATION_SCORE_REPORT,
  EXAMPLE_VERIFICATION_SCORE_REPORT,
  isPlatformRemediationSuggestion,
  normalizeVerticalScoreReport,
  PERFORMANCE_REMEDIATION_GUARDRAILS,
  recoverVerticalScoreReportFromModelText,
  TAP_AUTO_SCORE_VERTICAL,
  VERTICAL_MCP_TOOL,
  VERTICAL_REST_PATH,
  VERTICAL_SCORE_FIELD,
} from "@/lib/pow-api/performance-report";

describe("vertical score naming", () => {
  it("exposes verification-score, augmentation-score, optimization-score paths and tools", () => {
    expect(VERTICAL_REST_PATH.verification).toBe("verification-score");
    expect(VERTICAL_REST_PATH.augmentation).toBe("augmentation-score");
    expect(VERTICAL_REST_PATH.optimization).toBe("optimization-score");
    expect(VERTICAL_MCP_TOOL.verification).toBe("verification_score");
    expect(VERTICAL_MCP_TOOL.augmentation).toBe("augmentation_score");
    expect(VERTICAL_MCP_TOOL.optimization).toBe("optimization_score");
    expect(VERTICAL_SCORE_FIELD.verification).toBe("verification_score");
    expect(VERTICAL_SCORE_FIELD.augmentation).toBe("augmentation_score");
    expect(VERTICAL_SCORE_FIELD.optimization).toBe("optimization_score");
  });

  it("TAP auto-results always select verification only", () => {
    expect(TAP_AUTO_SCORE_VERTICAL).toBe("verification");
  });
});

describe("buildVerticalScoreReportSchema", () => {
  it.each(["verification", "augmentation", "optimization"] as const)(
    "%s schema requires one primary score plus spider, analysis, next actions",
    (vertical) => {
      const schema = buildVerticalScoreReportSchema(vertical);
      expect(schema.vertical).toBe(vertical);
      expect(schema.primary_field).toBe(VERTICAL_SCORE_FIELD[vertical]);
      expect(schema.schema.required).toContain("score");
      expect(schema.schema.required).toContain("workspace_goal");
      expect(schema.schema.required).toContain("marker_scores");
      expect(schema.schema.required).toContain("gap_analysis");
      expect(schema.schema.required).toContain("summary");
      const required = [...schema.schema.required];
      expect(required).not.toContain("conversion_score");
      expect(required).not.toContain("conversion_goal");
      expect(required).not.toContain("overall_score");
      expect(JSON.stringify(schema.schema)).not.toContain("conversion_score");
      expect(JSON.stringify(schema.schema)).not.toContain("conversion_goal");
    }
  );
});

describe("buildVerticalScoreInstructions", () => {
  it("mentions only the requested vertical primary score and PoW-only context layer", () => {
    const instructions = buildVerticalScoreInstructions("verification", null);
    expect(instructions).toContain("WORKSPACE ONTOLOGY");
    expect(instructions).toContain("SCORE GENERATION CONTEXT");
    expect(instructions).toContain("verification");
    expect(instructions).toContain("workspace_goal");
    expect(instructions).toContain("marker_scores");
    expect(instructions).toContain("gap_analysis.gaps");
    expect(instructions).toContain("gap_analysis.next_steps");
    expect(instructions).toContain("spider/radar");
    expect(instructions).toContain(PERFORMANCE_REMEDIATION_GUARDRAILS);
    expect(instructions).toMatch(/System\s*1/i);
    expect(instructions).toMatch(/System\s*2/i);
    expect(instructions).not.toContain("conversion_score");
    expect(instructions).not.toContain("conversion_goal");
  });

  it("embeds authoritative workspace goal when provided", () => {
    const instructions = buildVerticalScoreInstructions(
      "optimization",
      null,
      "Trial-to-paid activation"
    );
    expect(instructions).toContain("Authoritative workspace goal");
    expect(instructions).toContain("Trial-to-paid activation");
    expect(instructions).toContain("optimization");
  });
});

describe("buildVerticalScoreReportContract", () => {
  it("describes each vertical endpoint without conversion fields", () => {
    const contracts = buildAllVerticalScoreContracts("https://uncertain.systems");
    expect(contracts).toHaveLength(3);
    for (const contract of contracts) {
      expect(contract.endpoint_pattern).toContain(`/${VERTICAL_REST_PATH[contract.vertical]}`);
      expect(contract.mcp_tool).toBe(VERTICAL_MCP_TOOL[contract.vertical]);
      expect(contract.primary_score_field).toBe(VERTICAL_SCORE_FIELD[contract.vertical]);
      expect(contract.response_mode).toBe("score");
      expect(contract.marker_scores.visualization).toBe("spider_radar");
      expect(contract.gap_analysis.next_steps_required).toBe(true);
      expect(contract.required_fields).toContain("score");
      expect(contract.required_fields).toContain("workspace_goal");
      expect(contract.required_fields).not.toContain("conversion_score");
      expect(contract.required_fields).not.toContain("conversion_goal");
      expect(contract.required_fields).not.toContain("overall_score");
      expect(contract.example_report.score).toBeGreaterThan(0);
      expect(contract.example_report.workspace_goal.length).toBeGreaterThan(0);
      expect(contract.example_report.marker_scores.length).toBeGreaterThanOrEqual(4);
      expect(contract.example_report.gap_analysis.gaps.length).toBeGreaterThan(0);
      expect(contract.example_report.gap_analysis.next_steps.events.length).toBeGreaterThan(0);
    }
  });

  it("verification contract is the TAP default path", () => {
    const contract = buildVerticalScoreReportContract("verification", "https://uncertain.systems");
    expect(contract.endpoint_pattern).toContain("verification-score");
    expect(contract.example_report.vertical).toBe("verification");
    expect(EXAMPLE_VERIFICATION_SCORE_REPORT.vertical).toBe("verification");
    expect(EXAMPLE_AUGMENTATION_SCORE_REPORT.vertical).toBe("augmentation");
    expect(EXAMPLE_OPTIMIZATION_SCORE_REPORT.vertical).toBe("optimization");
  });
});

describe("emptyVerticalScoreReport", () => {
  it("returns zero score and empty markers with gap scaffold per vertical", () => {
    for (const vertical of ["verification", "augmentation", "optimization"] as const) {
      const report = emptyVerticalScoreReport(vertical);
      expect(report.vertical).toBe(vertical);
      expect(report.score).toBe(0);
      expect(report[VERTICAL_SCORE_FIELD[vertical]]).toBe(0);
      expect(report.workspace_goal.length).toBeGreaterThan(0);
      expect(report.marker_scores).toEqual([]);
      expect(report.gap_analysis.gaps).toEqual([]);
      expect(report.gap_analysis.next_steps.directions.length).toBeGreaterThan(0);
      expect(report.gap_analysis.next_steps.events.length).toBeGreaterThan(0);
      expect(report).not.toHaveProperty("conversion_score");
      expect(report).not.toHaveProperty("conversion_goal");
      expect(report).not.toHaveProperty("overall_score");
      for (const event of report.gap_analysis.next_steps.events) {
        expect(isPlatformRemediationSuggestion(event)).toBe(false);
      }
    }
  });
});

describe("normalizeVerticalScoreReport", () => {
  it("clamps score and attaches named primary field", () => {
    const normalized = normalizeVerticalScoreReport(
      {
        vertical: "verification",
        score: 80.4,
        workspace_goal: "Ship activation",
        ghc_score: 10,
        ghc_confidence: "low",
        marker_scores: [],
        summary: "ok",
        strengths: [],
        growth_areas: [],
        gap_analysis: {
          summary: "none",
          gaps: [],
          next_steps: { directions: [], events: [] },
        },
        suggestions: [],
        confidence: "developing",
      },
      "verification"
    );
    expect(normalized.score).toBe(80);
    expect(normalized.verification_score).toBe(80);
    expect(normalized.workspace_goal).toBe("Ship activation");
  });

  it("accepts named primary field when score is missing", () => {
    const normalized = normalizeVerticalScoreReport(
      {
        vertical: "optimization",
        optimization_score: 55,
        workspace_goal: "Paid plan",
        ghc_score: 0,
        ghc_confidence: "none",
        marker_scores: [],
        summary: "partial",
        strengths: [],
        growth_areas: [],
        gap_analysis: {
          summary: "gaps",
          gaps: [],
          next_steps: { directions: ["Grow activation"], events: ["Complete onboarding"] },
        },
        suggestions: [],
        confidence: "emerging",
      } as never,
      "optimization"
    );
    expect(normalized.score).toBe(55);
    expect(normalized.optimization_score).toBe(55);
  });
});

describe("recoverVerticalScoreReportFromModelText", () => {
  it("recovers a verification score report from model JSON", () => {
    const text = JSON.stringify({
      score: 71,
      workspace_goal: "Activate trial",
      ghc_score: 40,
      ghc_confidence: "medium",
      marker_scores: [
        { id: "a", label: "A", score: 70, rationale: "ok" },
        { id: "b", label: "B", score: 60, rationale: "ok" },
        { id: "c", label: "C", score: 65, rationale: "ok" },
        { id: "d", label: "D", score: 55, rationale: "ok" },
      ],
      summary: "Solid coverage",
      strengths: ["execution"],
      growth_areas: ["reflection"],
      gap_analysis: {
        summary: "shallow reflection",
        gaps: [
          {
            title: "Missing rationale",
            proof_of_work: "No decision log",
            severity: "medium",
            suggested_repair: "Write a short decision log",
          },
        ],
        next_steps: {
          directions: ["Improve decision logging"],
          events: ["Document next change"],
        },
      },
      suggestions: ["Capture screenshots"],
      confidence: "developing",
    });
    const recovered = recoverVerticalScoreReportFromModelText(text, "verification");
    expect(recovered).not.toBeNull();
    expect(recovered!.vertical).toBe("verification");
    expect(recovered!.score).toBe(71);
    expect(recovered!.verification_score).toBe(71);
    expect(recovered!.workspace_goal).toBe("Activate trial");
    expect(recovered!.marker_scores.length).toBe(4);
    expect(recovered!.gap_analysis.next_steps.events.length).toBeGreaterThan(0);
  });
});

describe("applyNamedScoreField", () => {
  it("sets only the active vertical named field", () => {
    const report = applyNamedScoreField({
      ...emptyVerticalScoreReport("augmentation"),
      score: 42,
    });
    expect(report.augmentation_score).toBe(42);
    expect(report.verification_score).toBeUndefined();
    expect(report.optimization_score).toBeUndefined();
  });
});
