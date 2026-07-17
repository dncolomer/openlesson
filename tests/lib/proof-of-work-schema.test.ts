import { describe, expect, it } from "vitest";
import {
  buildProofOfWorkSchemaInstructions,
  parseProofOfWorkSchemaRequest,
  EVIDENCE_EVAL_SCHEMA_OUTPUT,
} from "@/lib/agent-v2/proof-of-work-schema";
import {
  buildContinuousEvaluationPolicy,
  buildProofOfWorkSchemaApiPath,
  buildProofOfWorkSchemaRequestFromIntegration,
  buildIntegrationSkillApiPath,
  enrichProofOfWorkSpecResult,
  formatProofOfWorkSpecForSkillPrompt,
} from "@/lib/agent-v2/proof-of-work-integration";
import {
  deriveSkillName,
  deriveSuggestedSharePath,
  parseIntegrationSkillRequest,
  parseSkillFrontmatter,
  slugifyIntegrationName,
  buildIntegrationSkillInstructions,
} from "@/lib/agent-v2/integration-skill";
import { ENDPOINT_SCOPES } from "@/lib/agent-v2/types";

describe("parseProofOfWorkSchemaRequest", () => {
  it("requires definition", () => {
    expect(parseProofOfWorkSchemaRequest({})).toBeNull();
    expect(parseProofOfWorkSchemaRequest({ definition: "   " })).toBeNull();
  });

  it("parses definition and integration hints", () => {
    const parsed = parseProofOfWorkSchemaRequest({
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
    expect(parsed?.prefetch_proof_of_work_spec).toBe(false);
  });

  it("parses prefetch_proof_of_work_spec when true", () => {
    const parsed = parseIntegrationSkillRequest({
      integration_name: "Acme",
      prefetch_proof_of_work_spec: true,
    });
    expect(parsed?.prefetch_proof_of_work_spec).toBe(true);
  });
});

describe("integration skill helpers", () => {
  it("slugifies integration names", () => {
    expect(slugifyIntegrationName("Acme Sales Copilot")).toBe("acme-sales-copilot");
    expect(deriveSkillName("Acme Sales Copilot")).toBe("acme-sales-copilot-uncertain-systems-proof-of-work-performance");
    expect(deriveSuggestedSharePath("Acme Sales Copilot")).toBe("/acme-sales-copilot-skill.md");
  });

  it("parses skill frontmatter", () => {
    const md = `---
name: acme-uncertain-systems
description: Custom skill
---

# Title`;
    expect(parseSkillFrontmatter(md)).toEqual({
      name: "acme-uncertain-systems",
      description: "Custom skill",
    });
  });
});

describe("evidence integration helpers", () => {
  it("builds proof-of-work spec API paths", () => {
    expect(buildProofOfWorkSchemaApiPath("ws-1", "https://uncertain.systems")).toBe(
      "https://uncertain.systems/api/v2/agent/workspaces/ws-1/proof-of-work-schema"
    );
  });

  it("enriches proof-of-work spec with API paths and continuous evaluation", () => {
    const enriched = enrichProofOfWorkSpecResult(
      {
        schema: { type: "object" },
        schema_name: "eval_input_demo",
        rationale: "test",
        example_payload: { event: "start" },
        recommended_mime_type: "application/json",
        recommended_proof_of_work_type: "tool",
        continuous_evaluation_summary: "Regenerate as proof of work grows.",
      },
      "ws-1",
      "https://uncertain.systems",
      null,
      { proof_of_work_artifacts: 12, blocks: 3 }
    );

    expect(enriched.proof_of_work_spec_api_path).toContain("/proof-of-work-schema");
    expect(enriched.proof_of_work_upload_api_path).toContain("/proof-of-work");
    expect(enriched.spec_version).toBe("1.3");
    expect(enriched.interruption_contract).toBeTruthy();
    expect(enriched.performance_report_contract?.marker_scores.visualization).toBe("spider_radar");
    expect(enriched.performance_report_contract?.gap_analysis.gaps_required).toBe(true);
    expect(enriched.continuous_evaluation?.regeneration_required).toBe(true);
    expect(enriched.continuous_evaluation?.integration_skill.api_path).toContain("/integration-skill");
    expect(enriched.continuous_evaluation_mcp?.proof_of_work_spec.mcp_tool).toBe("generate_proof_of_work_schema");
    expect(enriched.continuous_evaluation_mcp?.performance.rest_equivalent).toContain("/performance");
    expect(enriched.integration_surfaces?.length).toBe(2);
    expect(enriched.uncertain_systems_scope).toBeTruthy();
    expect(enriched.recommended_next_actions?.length).toBeGreaterThan(0);
    expect(enriched.collection_guidance).toContain("Self-update");
    expect(enriched.collection_guidance).toContain("MCP");
  });

  it("builds continuous evaluation policy with proof of work-aware triggers", () => {
    const policy = buildContinuousEvaluationPolicy("ws-1", "https://uncertain.systems", {
      proof_of_work_artifacts: 0,
    });

    expect(policy.more_evidence_improves).toContain("more");
    expect(policy.proof_of_work_spec.api_path).toBe(
      buildProofOfWorkSchemaApiPath("ws-1", "https://uncertain.systems")
    );
    expect(policy.integration_skill.api_path).toBe(
      buildIntegrationSkillApiPath("ws-1", "https://uncertain.systems")
    );
    expect(policy.proof_of_work_spec.when_to_call[0]).toContain("little or no proof of work");
  });

  it("formats proof-of-work spec for skill prompt", () => {
    const text = formatProofOfWorkSpecForSkillPrompt({
      schema: {},
      schema_name: "eval_input_demo",
      rationale: "Capture tool events",
      example_payload: { tool: "demo" },
      recommended_mime_type: "application/json",
      recommended_proof_of_work_type: "tool",
      proof_of_work_spec_api_path: "https://uncertain.systems/api/v2/agent/workspaces/ws-1/proof-of-work-schema",
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

    expect(text).toContain("proof-of-work-schema");
    expect(text).toContain("demo");
    expect(text).toContain("Performance report contract");
    expect(text).toContain("overall_score");
    expect(text).toContain("spider_radar");
  });

  it("builds evidence schema request from integration fields", () => {
    const request = buildProofOfWorkSchemaRequestFromIntegration(
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
  it("references dynamic proof-of-work spec API path", () => {
    const instructions = buildIntegrationSkillInstructions(
      {
        integration_name: "Acme Copilot",
        base_url: "https://uncertain.systems",
        eval_definition: "Verify tool adoption",
      },
      { id: "ws-1", title: "Onboarding", root_topic: "SaaS onboarding" },
      [{ id: "block-1", title: "Setup", description: "First project" }],
      null,
      null
    );

    expect(instructions).toContain("/api/v2/agent/workspaces/ws-1/proof-of-work-schema");
    expect(instructions).toContain("/api/v2/agent/workspaces/ws-1/integration-skill");
    expect(instructions).toContain("Proof-of-work specification");
    expect(instructions).toContain("Continuous evaluation and regeneration");
    expect(instructions).toContain("Predictive interruptions");
    expect(instructions).toContain("do not tell them to invent ad-hoc JSON");
    expect(instructions).toContain("regenerate");
    expect(instructions).toContain("overall_score");
    expect(instructions).toContain("marker_scores");
    expect(instructions).toContain("performance_report_contract");
    expect(instructions).toContain("Predictive interruptions");
    expect(instructions).toContain("interruption_contract");
  });
});

describe("buildProofOfWorkSchemaInstructions", () => {
  it("mentions formal tool submission specs", () => {
    const instructions = buildProofOfWorkSchemaInstructions(
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
        proof_of_work: [],
        workspace_files: [],
        linked_sessions: [],
        counts: { blocks: 1, proof_of_work_artifacts: 0, linked_sessions: 0, workspace_files: 0 },
      }
    );

    expect(instructions).toContain("tool_submissions");
    expect(instructions).toContain("proof_of_work_upload_contract");
    expect(instructions).toContain("continuous_evaluation_summary");
    expect(instructions).toContain("performance_report_contract");
    expect(instructions).toContain("predicted_interruption");
    expect(instructions).toContain("marker_scores");
    expect(instructions).toContain("Discovery");
    expect(instructions).toContain("product-independent");
    expect(instructions).toContain("never recommend TAP sessions");
  });
});

describe("ENDPOINT_SCOPES", () => {
  it("registers new evidence planning endpoints", () => {
    expect(ENDPOINT_SCOPES["POST /workspaces/:id/proof-of-work-schema"]).toBe("workspaces:read");
    expect(ENDPOINT_SCOPES["POST /workspaces/:id/integration-skill"]).toBe("workspaces:read");
  });
});

describe("EVIDENCE_EVAL_SCHEMA_OUTPUT", () => {
  it("requires formal proof-of-work spec fields", () => {
    expect(EVIDENCE_EVAL_SCHEMA_OUTPUT.schema.required).toContain("schema");
    expect(EVIDENCE_EVAL_SCHEMA_OUTPUT.schema.required).toContain("tool_submissions");
    expect(EVIDENCE_EVAL_SCHEMA_OUTPUT.schema.required).toContain("proof_of_work_upload_contract");
    expect(EVIDENCE_EVAL_SCHEMA_OUTPUT.schema.required).toContain("continuous_evaluation_summary");
    expect(EVIDENCE_EVAL_SCHEMA_OUTPUT.schema.required).toContain("performance_report_contract");
  });
});