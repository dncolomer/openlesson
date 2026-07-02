import { describe, expect, it } from "vitest";
import {
  parseEvidenceSchemaRequest,
  EVIDENCE_EVAL_SCHEMA_OUTPUT,
} from "@/lib/agent-v2/evidence-schema";
import {
  deriveSkillName,
  deriveSuggestedSharePath,
  parseIntegrationSkillRequest,
  parseSkillFrontmatter,
  slugifyIntegrationName,
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

  it("parses integration options", () => {
    const parsed = parseIntegrationSkillRequest({
      integration_name: "Acme Sales Copilot",
      partner_description: "Guides reps through discovery",
      base_url: "https://example.com/",
      include_sections: ["auth", "performance"],
    });

    expect(parsed?.integration_name).toBe("Acme Sales Copilot");
    expect(parsed?.base_url).toBe("https://example.com");
    expect(parsed?.include_sections).toEqual(["auth", "performance"]);
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

describe("ENDPOINT_SCOPES", () => {
  it("registers new evidence planning endpoints", () => {
    expect(ENDPOINT_SCOPES["POST /workspaces/:id/evidence-schema"]).toBe("workspaces:read");
    expect(ENDPOINT_SCOPES["POST /workspaces/:id/integration-skill"]).toBe("workspaces:read");
  });
});

describe("EVIDENCE_EVAL_SCHEMA_OUTPUT", () => {
  it("requires core schema fields", () => {
    expect(EVIDENCE_EVAL_SCHEMA_OUTPUT.schema.required).toContain("schema");
    expect(EVIDENCE_EVAL_SCHEMA_OUTPUT.schema.required).toContain("example_payload");
  });
});