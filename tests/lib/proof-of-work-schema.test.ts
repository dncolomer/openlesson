import { describe, expect, it } from "vitest";
import {
  buildProofOfWorkSchemaInstructions,
  parseProofOfWorkSchemaRequest,
  EVIDENCE_EVAL_SCHEMA_OUTPUT,
} from "@/lib/pow-api/proof-of-work-schema";
import {
  buildContinuousEvaluationPolicy,
  buildProofOfWorkSchemaApiPath,
  buildProofOfWorkSchemaRequestFromIntegration,
  buildIntegrationSkillApiPath,
  enrichProofOfWorkSpecResult,
  formatProofOfWorkSpecForSkillPrompt,
} from "@/lib/pow-api/proof-of-work-integration";
import { ENDPOINT_SCOPES } from "@/lib/pow-api/types";

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