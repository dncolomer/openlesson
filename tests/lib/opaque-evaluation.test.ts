import { describe, expect, it } from "vitest";
import {
  buildOpaqueWorkspaceGoal,
  buildOpaqueGeneratedBlocks,
  buildOpaqueProofOfWorkSpec,
  buildOpaqueWorkspaceNotes,
  buildPrivacyMetadata,
  finalizeOpaquePerformanceReport,
  lintOpaquePayload,
  parseOpaqueSchemaRequest,
  parseOpaqueWorkspaceCreateRequest,
  redactOpaqueFileName,
  sanitizeOpaqueMetadata,
  scrubOpaquePerformanceContext,
} from "@/lib/agent-v2/opaque-evaluation";
import { parseProofOfWorkSchemaRequest } from "@/lib/agent-v2/proof-of-work-schema";
import { emptyVerticalScoreReport } from "@/lib/agent-v2/performance-report";

describe("parseOpaqueWorkspaceCreateRequest", () => {
  it("requires protocol_id and goal_ref", () => {
    expect(parseOpaqueWorkspaceCreateRequest({ evaluation_mode: "opaque" })).toBeNull();
    expect(
      parseOpaqueWorkspaceCreateRequest({
        evaluation_mode: "opaque",
        protocol: { protocol_id: "agent-trace-v3" },
      })
    ).toBeNull();
  });

  it("parses opaque workspace request", () => {
    const parsed = parseOpaqueWorkspaceCreateRequest({
      evaluation_mode: "opaque",
      protocol: {
        protocol_id: "agent-trace-v3",
        goal_ref: "abc123",
        goal_tokens: ["g_complete"],
      },
      external_refs: { partner_run_id: "run-1" },
    });

    expect(parsed?.protocol.protocol_id).toBe("agent-trace-v3");
    expect(parsed?.protocol.goal_ref).toBe("abc123");
    expect(parsed?.external_refs).toEqual({ partner_run_id: "run-1" });
    expect(parsed?.protocol.phases?.length).toBe(5);
  });
});

describe("parseOpaqueSchemaRequest", () => {
  it("requires definition_ref and contract.event_verbs", () => {
    expect(parseOpaqueSchemaRequest({ evaluation_mode: "opaque" })).toBeNull();
    expect(
      parseOpaqueSchemaRequest({
        evaluation_mode: "opaque",
        definition_ref: "eval-1",
        contract: {},
      })
    ).toBeNull();
  });

  it("parses opaque schema request", () => {
    const parsed = parseOpaqueSchemaRequest({
      evaluation_mode: "opaque",
      definition_ref: "eval-1",
      contract: {
        event_verbs: ["enumerate", "validate"],
        goal_tokens: ["g_done"],
      },
    });

    expect(parsed?.definition_ref).toBe("eval-1");
    expect(parsed?.contract.event_verbs).toEqual(["enumerate", "validate"]);
  });

  it("does not parse semantic schema when opaque mode flag is set", () => {
    expect(
      parseProofOfWorkSchemaRequest({
        evaluation_mode: "opaque",
        definition: "Evaluate something",
      })
    ).toBeNull();
  });
});

describe("opaque helpers", () => {
  it("builds deterministic protocol blocks", () => {
    const blocks = buildOpaqueGeneratedBlocks({
      protocol_id: "agent-trace-v3",
      goal_ref: "hash1",
    });
    expect(blocks).toHaveLength(5);
    expect(blocks[0].verb).toBe("enumerate");
    expect(blocks[4].verb).toBe("validate");
  });

  it("builds opaque conversion goal and notes without semantic prompt", () => {
    const protocol = { protocol_id: "agent-trace-v3", goal_ref: "secret-hash" };
    expect(buildOpaqueWorkspaceGoal(protocol)).toBe("goal_ref:secret-hash");
    expect(buildOpaqueWorkspaceNotes(protocol)).toContain("evaluation_mode=opaque");
    expect(buildOpaqueWorkspaceNotes(protocol)).not.toContain("fingerprint");
  });

  it("redacts filenames and sanitizes metadata", () => {
    expect(redactOpaqueFileName("uuid-1")).toBe("pow-uuid-1.json");
    expect(
      sanitizeOpaqueMetadata({
        trace_token: "abc",
        skill_name: "secret-skill",
        anon: true,
      })
    ).toEqual({ trace_token: "abc", anon: true });
  });

  it("lints plaintext paths in opaque payloads", () => {
    const bad = lintOpaquePayload('{"path":"/Users/me/file.txt"}');
    expect(bad.passed).toBe(false);
    expect(bad.violations.length).toBeGreaterThan(0);

    const good = lintOpaquePayload('{"path":"a1b2c3d4","fingerprint":"deadbeef"}');
    expect(good.passed).toBe(true);
  });

  it("builds contract-driven proof-of-work spec without NL definition", () => {
    const spec = buildOpaqueProofOfWorkSpec(
      {
        evaluation_mode: "opaque",
        definition_ref: "eval-1",
        contract: { event_verbs: ["enumerate", "emit"] },
      },
      { protocol_id: "agent-trace-v3", goal_ref: "hash1" },
      "ws-1"
    );

    expect(spec.schema_name).toContain("opaque_agent-trace-v3");
    expect(spec.rationale).toContain("eval-1");
    expect(spec.rationale).not.toContain("fingerprint audit");
  });

  it("scrubs performance context for opaque workspaces", () => {
    const scrubbed = scrubOpaquePerformanceContext(
      {
        workspace: {
          id: "ws",
          title: "Secret Skill Workspace",
          root_topic: "full prompt here",
          description: "desc",
          notes: "notes",
          workspace_goal: "Demonstrate X",
        },
        focus_block_id: null,
        generated_at: "now",
        blocks: [],
        proof_of_work: [],
        workspace_files: [],
        linked_sessions: [],
        counts: { blocks: 0, proof_of_work_artifacts: 0, linked_sessions: 0, workspace_files: 0 },
      },
      { protocol_id: "agent-trace-v3", goal_ref: "hash1" }
    );

    expect(scrubbed.workspace.title).toBe("Opaque Protocol agent-trace-v3");
    expect(scrubbed.workspace.workspace_goal).toBe("goal_ref:hash1");
    expect(scrubbed.workspace.notes).not.toContain("full prompt");
  });

  it("finalizes opaque performance report with opaque_ref source", () => {
    const finalized = finalizeOpaquePerformanceReport(
      { ...emptyVerticalScoreReport('verification'), score: 88 },
      "hash1",
      { protocol_id: "agent-trace-v3", goal_ref: "hash1" }
    );

    expect(finalized.workspace_goal_source).toBe("opaque_ref");
    expect(finalized.workspace_goal).toBe("goal_ref:hash1");
    expect(finalized.protocol_report.protocol_compliance_score).toBe(88);
  });

  it("builds privacy metadata", () => {
    expect(
      buildPrivacyMetadata({ evaluation_mode: "semantic", protocol_config: null, external_refs: null })
    ).toMatchObject({ semantic_inference: "enabled", plaintext_lint: "off" });

    expect(
      buildPrivacyMetadata({
        evaluation_mode: "opaque",
        protocol_config: { protocol_id: "p", goal_ref: "g" },
        external_refs: null,
      })
    ).toMatchObject({ semantic_inference: "disabled", plaintext_lint: "enforced", stored_prompt: false });
  });
});