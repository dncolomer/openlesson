import { describe, expect, it } from "vitest";
import {
  buildEvidenceSchemaInstructions,
  parseEvidenceSchemaRequest,
  EVIDENCE_EVAL_SCHEMA_OUTPUT,
} from "@/lib/agent-v2/evidence-schema";
import {
  buildContinuousEvaluationPolicy,
  buildEvidenceSchemaApiPath,
  buildEvidenceSchemaRequestFromIntegration,
  buildIntegrationSkillApiPath,
  enrichEvidenceSpecResult,
  formatEvidenceSpecForSkillPrompt,
} from "@/lib/agent-v2/evidence-integration";
import {
  deriveSkillName,
  deriveSuggestedSharePath,
  parseIntegrationSkillRequest,
  parseSkillFrontmatter,
  slugifyIntegrationName,
  buildIntegrationSkillInstructions,
} from "@/lib/agent-v2/integration-skill";
import { ENDPOINT_SCOPES } from "@/lib/agent-v2/types";

describe("parseEvidenceSchemaRequest", () => {
  it("requires definition", () => {
    expect(parseEvidenceSchemaRequest({})).toBeNull();
    expect(parseEvidenceSchemaRequest({ definition: "   " })).toBeNull();
  });

  it("parses definition and integration hints", () => {
    const parsed = parseEvidenceSchemaRequest({
      definition: "Evaluate ICP clarity",
      block_id: "block-1",
      integration_hints: {
        tool_name: "pumadoc",
        event_verbs: ["run_simulation", "edit_field"],
        goals: ["simulation_completed"],
      },
    });

    expect(parsed).toEqual({
      definition: "Evaluate ICP clarity",
      block_id: "block-1",
      integration_hints: {
        tool_name: "pumadoc",
        partner_agent: undefined,
        event_verbs: ["run_simulation", "edit_field"],
        goals: ["simulation_completed"],
      },
    });
  });
});

describe("parseIntegrationSkillRequest", () => {
  it("requires integration_name", () => {
    expect(parseIntegrationSkillRequest({})).toBeNull();
  });

  it("parses integration options including eval_definition", () => {
    const parsed = parseIntegrationSkillRequest({
      integration_name: "Acme Sales Copilot",
      partner_description: "Guides reps through discovery",
      eval_definition: "Verify discovery judgment under pushback",
      base_url: "https://example.com/",
      include_sections: ["auth", "performance"],
    });

    expect(parsed?.integration_name).toBe("Acme Sales Copilot");
    expect(parsed?.eval_definition).toBe("Verify discovery judgment under pushback");
    expect(parsed?.base_url).toBe("https://example.com");
    expect(parsed?.include_sections).toEqual(["auth", "performance"]);
    expect(parsed?.prefetch_evidence_spec).toBe(false);
  });

  it("parses prefetch_evidence_spec when true", () => {
    const parsed = parseIntegrationSkillRequest({
      integration_name: "Acme",
      prefetch_evidence_spec: true,
    });
    expect(parsed?.prefetch_evidence_spec).toBe(true);
  });
});

describe("integration skill helpers", () => {
  it("slugifies integration names", () => {
    expect(slugifyIntegrationName("Acme Sales Copilot")).toBe("acme-sales-copilot");
    expect(deriveSkillName("Acme Sales Copilot")).toBe("acme-sales-copilot-openlesson-evidence-performance");
    expect(deriveSuggestedSharePath("Acme Sales Copilot")).toBe("/acme-sales-copilot-skill.md");
  });

  it("parses skill frontmatter", () => {
    const md = `---
name: acme-openlesson
description: Custom skill
---

# Title`;
    expect(parseSkillFrontmatter(md)).toEqual({
      name: "acme-openlesson",
      description: "Custom skill",
    });
  });
});

describe("evidence integration helpers", () => {
  it("builds evidence spec API paths", () => {
    expect(buildEvidenceSchemaApiPath("ws-1", "https://openlesson.academy")).toBe(
      "https://openlesson.academy/api/v2/agent/workspaces/ws-1/evidence-schema"
    );
  });

  it("enriches evidence spec with API paths and continuous evaluation", () => {
    const enriched = enrichEvidenceSpecResult(
      {
        schema: { type: "object" },
        schema_name: "eval_input_demo",
        rationale: "test",
        example_payload: { event: "start" },
        recommended_mime_type: "application/json",
        recommended_evidence_type: "tool",
        continuous_evaluation_summary: "Regenerate as evidence grows.",
      },
      "ws-1",
      "https://openlesson.academy",
      null,
      { evidence_artifacts: 12, blocks: 3 }
    );

    expect(enriched.evidence_spec_api_path).toContain("/evidence-schema");
    expect(enriched.evidence_upload_api_path).toContain("/evidence");
    expect(enriched.spec_version).toBe("1.2");
    expect(enriched.performance_report_contract?.marker_scores.visualization).toBe("spider_radar");
    expect(enriched.performance_report_contract?.gap_analysis.gaps_required).toBe(true);
    expect(enriched.continuous_evaluation?.regeneration_required).toBe(true);
    expect(enriched.continuous_evaluation?.integration_skill.api_path).toContain("/integration-skill");
    expect(enriched.continuous_evaluation_mcp?.evidence_spec.mcp_tool).toBe("generate_evidence_schema");
    expect(enriched.continuous_evaluation_mcp?.performance.rest_equivalent).toContain("/performance");
    expect(enriched.integration_surfaces?.length).toBe(2);
    expect(enriched.openlesson_scope).toBeTruthy();
    expect(enriched.recommended_next_actions?.length).toBeGreaterThan(0);
    expect(enriched.collection_guidance).toContain("Self-update");
    expect(enriched.collection_guidance).toContain("MCP");
  });

  it("builds continuous evaluation policy with evidence-aware triggers", () => {
    const policy = buildContinuousEvaluationPolicy("ws-1", "https://openlesson.academy", {
      evidence_artifacts: 0,
    });

    expect(policy.more_evidence_improves).toContain("more");
    expect(policy.evidence_spec.api_path).toBe(
      buildEvidenceSchemaApiPath("ws-1", "https://openlesson.academy")
    );
    expect(policy.integration_skill.api_path).toBe(
      buildIntegrationSkillApiPath("ws-1", "https://openlesson.academy")
    );
    expect(policy.evidence_spec.when_to_call[0]).toContain("little or no evidence");
  });

  it("formats evidence spec for skill prompt", () => {
    const text = formatEvidenceSpecForSkillPrompt({
      schema: {},
      schema_name: "eval_input_demo",
      rationale: "Capture tool events",
      example_payload: { tool: "demo" },
      recommended_mime_type: "application/json",
      recommended_evidence_type: "tool",
      evidence_spec_api_path: "https://openlesson.academy/api/v2/agent/workspaces/ws-1/evidence-schema",
      tool_submissions: [
        {
          tool_name: "demo",
          purpose: "Track workflow steps",
          when_to_submit: "After each major action",
          schema: { type: "object" },
          example_payload: { step: "configure" },
        },
      ],
    });

    expect(text).toContain("evidence-schema");
    expect(text).toContain("demo");
    expect(text).toContain("Performance report contract");
    expect(text).toContain("overall_score");
    expect(text).toContain("spider_radar");
  });

  it("builds evidence schema request from integration fields", () => {
    const request = buildEvidenceSchemaRequestFromIntegration(
      "Verify onboarding learning",
      "acme-copilot",
      "Guides users through setup",
      "block-1"
    );

    expect(request?.definition).toBe("Verify onboarding learning");
    expect(request?.block_id).toBe("block-1");
    expect(request?.integration_hints?.tool_name).toBe("acme-copilot");
  });
});

describe("buildIntegrationSkillInstructions", () => {
  it("references dynamic evidence spec API path", () => {
    const instructions = buildIntegrationSkillInstructions(
      {
        integration_name: "Acme Copilot",
        base_url: "https://openlesson.academy",
        eval_definition: "Verify tool adoption",
      },
      { id: "ws-1", title: "Onboarding", root_topic: "SaaS onboarding" },
      [{ id: "block-1", title: "Setup", description: "First project" }],
      null,
      null
    );

    expect(instructions).toContain("/api/v2/agent/workspaces/ws-1/evidence-schema");
    expect(instructions).toContain("/api/v2/agent/workspaces/ws-1/integration-skill");
    expect(instructions).toContain("Evidence specification");
    expect(instructions).toContain("Continuous evaluation and regeneration");
    expect(instructions).toContain("do not tell them to invent ad-hoc JSON");
    expect(instructions).toContain("regenerate");
    expect(instructions).toContain("overall_score");
    expect(instructions).toContain("marker_scores");
    expect(instructions).toContain("performance_report_contract");
  });
});

describe("buildEvidenceSchemaInstructions", () => {
  it("mentions formal tool submission specs", () => {
    const instructions = buildEvidenceSchemaInstructions(
      { definition: "Evaluate discovery calls" },
      null,
      {
        workspace: {
          id: "ws-1",
          title: "Sales",
          root_topic: "Discovery",
          description: null,
          notes: null,
          conversion_goal: null,
        },
        focus_block_id: null,
        generated_at: new Date().toISOString(),
        blocks: [{ id: "b1", title: "Discovery", description: "Qualify pain", status: null, is_start: true, session_id: null }],
        tap_sessions: [],
        evidence: [],
        plan_files: [],
        linked_sessions: [],
        counts: { blocks: 1, tap_sessions: 0, evidence_artifacts: 0, linked_sessions: 0, plan_files: 0 },
      }
    );

    expect(instructions).toContain("tool_submissions");
    expect(instructions).toContain("evidence_upload_contract");
    expect(instructions).toContain("continuous_evaluation_summary");
    expect(instructions).toContain("performance_report_contract");
    expect(instructions).toContain("marker_scores");
    expect(instructions).toContain("Discovery");
    expect(instructions).toContain("product-independent");
    expect(instructions).toContain("never recommend TAP sessions");
  });
});

describe("ENDPOINT_SCOPES", () => {
  it("registers new evidence planning endpoints", () => {
    expect(ENDPOINT_SCOPES["POST /workspaces/:id/evidence-schema"]).toBe("workspaces:read");
    expect(ENDPOINT_SCOPES["POST /workspaces/:id/integration-skill"]).toBe("workspaces:read");
  });
});

describe("EVIDENCE_EVAL_SCHEMA_OUTPUT", () => {
  it("requires formal evidence spec fields", () => {
    expect(EVIDENCE_EVAL_SCHEMA_OUTPUT.schema.required).toContain("schema");
    expect(EVIDENCE_EVAL_SCHEMA_OUTPUT.schema.required).toContain("tool_submissions");
    expect(EVIDENCE_EVAL_SCHEMA_OUTPUT.schema.required).toContain("evidence_upload_contract");
    expect(EVIDENCE_EVAL_SCHEMA_OUTPUT.schema.required).toContain("continuous_evaluation_summary");
    expect(EVIDENCE_EVAL_SCHEMA_OUTPUT.schema.required).toContain("performance_report_contract");
  });
});