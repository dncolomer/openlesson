import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildInterruptionContract,
  normalizePredictedInterruption,
  predictInterruption,
  withProofOfWorkApiResponse,
} from "@/lib/agent-v2/predictive-interruption";
import { setTimProviderForTests, type TimProvider } from "@/lib/agent-v2/tim-provider";
import { buildTimFeatureEnvelope } from "@/lib/agent-v2/tim-feature-envelope";
import { emptyLearningWorldModel } from "@/lib/prompt-kernel/world-model";
import { enrichProofOfWorkSpecResult } from "@/lib/agent-v2/proof-of-work-integration";
import type { TimFeatureEnvelopeV1 } from "@/lib/agent-v2/tim-feature-envelope";
import type { ProofOfWorkApiInterruption } from "@/lib/agent-v2/predictive-interruption";

function providerFromRules(
  decide: (features: TimFeatureEnvelopeV1) => ProofOfWorkApiInterruption | null,
): TimProvider {
  return {
    id: "test-rules",
    async predict(features) {
      return decide(features);
    },
  };
}

describe("predictive-interruption", () => {
  beforeEach(() => {
    setTimProviderForTests(
      providerFromRules((features) => {
        const endpoint = features.event.endpoint;
        const artifacts = features.proof_of_work.artifacts_count ?? 0;
        if (endpoint === "create_workspace") {
          return {
            interruption_id: "int_create",
            delay_ms: 60_000,
            confidence: "high",
            predicted_at: new Date().toISOString(),
            intervention: {
              type: "proof_of_work_reminder",
              message:
                "Generate a proof-of-work schema and upload your first tool trace for this workspace.",
              rationale: "New workspaces need initial proof of work.",
              consumer_action: "call_generate_proof_of_work_schema",
            },
          };
        }
        if (endpoint === "generate_proof_of_work_schema" && artifacts === 0) {
          return {
            interruption_id: "int_schema",
            delay_ms: 30_000,
            confidence: "high",
            predicted_at: new Date().toISOString(),
            intervention: {
              type: "proof_of_work_reminder",
              message: "Upload your first proof-of-work artifact using the tool_submissions contract.",
              consumer_action: "call_upload_proof_of_work",
            },
          };
        }
        if (endpoint === "upload_proof_of_work" && artifacts === 5) {
          return {
            interruption_id: "int_upload",
            delay_ms: 60_000,
            confidence: "high",
            predicted_at: new Date().toISOString(),
            intervention: {
              type: "performance_review",
              message: "Run a performance report to see updated marker scores and gaps.",
              consumer_action: "call_verification_score",
            },
          };
        }
        if (endpoint === "verification_score" && features.performance_summary) {
          return {
            interruption_id: "int_perf",
            delay_ms: 45_000,
            confidence: "high",
            predicted_at: new Date().toISOString(),
            intervention: {
              type: "coaching_nudge",
              message: "Document ICP hypothesis before next simulation",
              rationale: "High-severity gap detected",
              consumer_action: "surface_coaching_nudge",
            },
          };
        }
        return null;
      }),
    );
  });

  afterEach(() => {
    setTimProviderForTests(null);
  });

  it("builds interruption contract with TIM semantics", () => {
    const contract = buildInterruptionContract();
    expect(contract.empty_value).toBeNull();
    expect(contract.intervention_types).toContain("reflection_prompt");
    expect(contract.consumer_obligations.length).toBeGreaterThan(2);
    expect(contract.supersession_rule).toContain("replaces");
    expect(contract.description).toMatch(/Trace Interruption Model \(TIM\)/);
    expect(contract.description).toMatch(/independent external service|swappable/i);
  });

  it("returns null for list-style endpoints without calling provider", async () => {
    const predict = vi.fn(async () => ({
      interruption_id: "x",
      delay_ms: 15_000,
      confidence: "low" as const,
      predicted_at: new Date().toISOString(),
      intervention: { type: "reflection_prompt" as const, message: "nope" },
    }));
    setTimProviderForTests({ id: "spy", predict });

    expect(await predictInterruption({ endpoint: "list_blocks", workspace_id: "ws-1" })).toBeNull();
    expect(await predictInterruption({ endpoint: "list_tap_links", workspace_id: "ws-1" })).toBeNull();
    expect(predict).not.toHaveBeenCalled();
  });

  it("predicts evidence reminder after workspace creation", async () => {
    const interruption = await predictInterruption({
      endpoint: "create_workspace",
      workspace_id: "ws-1",
    });
    expect(interruption?.intervention.type).toBe("proof_of_work_reminder");
    expect(interruption?.delay_ms).toBeGreaterThan(0);
  });

  it("predicts upload reminder when evidence schema has no artifacts", async () => {
    const interruption = await predictInterruption({
      endpoint: "generate_proof_of_work_schema",
      workspace_id: "ws-1",
      proof_of_work_artifacts: 0,
    });
    expect(interruption?.intervention.type).toBe("proof_of_work_reminder");
    expect(interruption?.intervention.consumer_action).toBe("call_upload_proof_of_work");
  });

  it("predicts performance review on evidence milestone uploads", async () => {
    const interruption = await predictInterruption({
      endpoint: "upload_proof_of_work",
      workspace_id: "ws-1",
      proof_of_work_artifacts: 5,
      tool_name: "canvas",
    });
    expect(interruption?.intervention.type).toBe("performance_review");
  });

  it("predicts coaching nudge from performance report context", async () => {
    const interruption = await predictInterruption({
      endpoint: "verification_score",
      workspace_id: "ws-1",
      mode: "score",
      report: {
        vertical: "verification",
        score: 55,
        verification_score: 55,
        workspace_goal: "Activation",
        ghc_score: 20,
        ghc_confidence: "low",
        marker_scores: [],
        summary: "Gaps remain",
        strengths: [],
        growth_areas: [],
        suggestions: [],
        confidence: "developing",
        gap_analysis: {
          summary: "One high gap",
          gaps: [
            {
              title: "Weak ICP",
              proof_of_work: "No segment rationale in traces",
              severity: "high",
              suggested_repair: "Document ICP hypothesis before next simulation",
            },
          ],
          next_steps: { directions: [], events: [] },
        },
      },
    });
    expect(interruption?.intervention.type).toBe("coaching_nudge");
    expect(interruption?.confidence).toBe("high");
  });

  it("uses injected TimProvider for fixed interruptions", async () => {
    const fixed: TimProvider = {
      id: "test-fixed",
      async predict() {
        return {
          interruption_id: "int_test_fixed",
          delay_ms: 42_000,
          confidence: "high",
          predicted_at: new Date().toISOString(),
          intervention: {
            type: "coaching_nudge",
            message: "Fixed provider message",
            consumer_action: "surface_test",
          },
        };
      },
    };
    setTimProviderForTests(fixed);

    const interruption = await predictInterruption({
      endpoint: "upload_proof_of_work",
      workspace_id: "ws-1",
      proof_of_work_artifacts: 2,
    });
    expect(interruption?.interruption_id).toBe("int_test_fixed");
    expect(interruption?.intervention.message).toBe("Fixed provider message");
    expect(interruption?.delay_ms).toBe(42_000);
  });

  it("includes evidence appetite in TIM feature envelope when world model supplied", () => {
    const model = emptyLearningWorldModel("ws-1");
    model.evidence_appetite = {
      want_more: ["decision_rationale", "tap_system1"],
      saturated: ["tool_crud_events"],
    };
    const features = buildTimFeatureEnvelope(
      {
        endpoint: "upload_proof_of_work",
        workspace_id: "ws-1",
        proof_of_work_artifacts: 3,
        learning_world_model: model,
      },
      model,
    );
    expect(features.schema_version).toBe(1);
    expect(features.learning_world_model?.evidence_appetite?.want_more).toContain("decision_rationale");
    expect(features.learning_world_model?.evidence_appetite?.saturated).toContain("tool_crud_events");
  });

  it("returns null when provider declines interruption", async () => {
    setTimProviderForTests({
      id: "quiet",
      async predict() {
        return null;
      },
    });
    const interruption = await predictInterruption({
      endpoint: "upload_tap_trace",
      workspace_id: "ws-1",
      tap_action: "system2:select",
    });
    expect(interruption).toBeNull();
  });

  it("passes through llm_interruption without calling TIM provider", async () => {
    const predict = vi.fn(async () => null);
    setTimProviderForTests({ id: "spy", predict });

    const passthrough = normalizePredictedInterruption(
      {
        delay_ms: 20_000,
        confidence: "medium",
        intervention: {
          type: "checkpoint_probe",
          message: "From schema spec",
        },
      },
      "generate_proof_of_work_schema",
      "ws-1",
    );

    const interruption = await predictInterruption({
      endpoint: "generate_proof_of_work_schema",
      workspace_id: "ws-1",
      llm_interruption: passthrough,
    });

    expect(interruption?.intervention.message).toContain("From schema spec");
    expect(predict).not.toHaveBeenCalled();
  });

  it("normalizes interruption payloads", () => {
    const normalized = normalizePredictedInterruption(
      {
        delay_ms: 45_000,
        confidence: "high",
        intervention: {
          type: "checkpoint_probe",
          message: "State your hypothesis before continuing.",
          consumer_action: "present_modal",
        },
      },
      "generate_proof_of_work_schema",
      "ws-1",
    );
    expect(normalized?.intervention.message).toContain("hypothesis");
    expect(normalized?.interruption_id).toContain("int_");
  });

  it("attaches interruption to API responses", async () => {
    const payload = await withProofOfWorkApiResponse(
      { mode: "score", report: { vertical: "verification", score: 80 } },
      { endpoint: "list_blocks", workspace_id: "ws-1" },
    );
    expect(payload).toHaveProperty("interruption");
    expect(payload.interruption).toBeNull();
  });

  it("enriches proof-of-work spec with interruption contract in v1.3", () => {
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
      { proof_of_work_artifacts: 0, blocks: 3 },
    );

    expect(enriched.spec_version).toBe("1.3");
    expect(enriched.interruption_contract).toBeTruthy();
    expect((enriched.interruption_contract as { intervention_types: string[] }).intervention_types).toContain(
      "proof_of_work_reminder",
    );
  });
});
