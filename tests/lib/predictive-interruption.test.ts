import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildInterruptionContract,
  normalizePredictedInterruption,
  predictInterruption,
  withProofOfWorkApiResponse,
} from "@/lib/agent-v2/predictive-interruption";
import { setTimLlmPredictorForTests } from "@/lib/agent-v2/tim-llm-predictor";
import { enrichProofOfWorkSpecResult } from "@/lib/agent-v2/proof-of-work-integration";

describe("predictive-interruption", () => {
  beforeEach(() => {
    setTimLlmPredictorForTests(async (context) => {
      if (context.endpoint === "create_workspace") {
        return {
          should_interrupt: true,
          delay_ms: 60_000,
          confidence: "high",
          intervention_type: "proof_of_work_reminder",
          message: "Generate a proof-of-work schema and upload your first tool trace for this workspace.",
          rationale: "New workspaces need initial proof of work.",
          consumer_action: "call_generate_proof_of_work_schema",
        };
      }
      if (context.endpoint === "generate_proof_of_work_schema" && context.proof_of_work_artifacts === 0) {
        return {
          should_interrupt: true,
          delay_ms: 30_000,
          confidence: "high",
          intervention_type: "proof_of_work_reminder",
          message: "Upload your first proof-of-work artifact using the tool_submissions contract.",
          consumer_action: "call_upload_proof_of_work",
        };
      }
      if (context.endpoint === "upload_proof_of_work" && context.proof_of_work_artifacts === 5) {
        return {
          should_interrupt: true,
          delay_ms: 60_000,
          confidence: "high",
          intervention_type: "performance_review",
          message: "Run a performance report to see updated marker scores and gaps.",
          consumer_action: "call_analyze_performance",
        };
      }
      if (context.endpoint === "analyze_performance" && context.report) {
        return {
          should_interrupt: true,
          delay_ms: 45_000,
          confidence: "high",
          intervention_type: "coaching_nudge",
          message: "Document ICP hypothesis before next simulation",
          rationale: "High-severity gap detected",
          consumer_action: "surface_coaching_nudge",
        };
      }
      return { should_interrupt: false };
    });
  });

  afterEach(() => {
    setTimLlmPredictorForTests(null);
  });

  it("builds interruption contract with TIM semantics", () => {
    const contract = buildInterruptionContract();
    expect(contract.empty_value).toBeNull();
    expect(contract.intervention_types).toContain("reflection_prompt");
    expect(contract.consumer_obligations.length).toBeGreaterThan(2);
    expect(contract.supersession_rule).toContain("replaces");
  });

  it("returns null for list-style endpoints without calling LLM", async () => {
    const llm = vi.fn(async () => ({ should_interrupt: true, message: "nope" }));
    setTimLlmPredictorForTests(llm);

    expect(await predictInterruption({ endpoint: "list_blocks", workspace_id: "ws-1" })).toBeNull();
    expect(await predictInterruption({ endpoint: "list_tap_links", workspace_id: "ws-1" })).toBeNull();
    expect(llm).not.toHaveBeenCalled();
  });

  it("predicts evidence reminder after workspace creation via LLM", async () => {
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
      endpoint: "analyze_performance",
      workspace_id: "ws-1",
      mode: "report",
      report: {
        overall_score: 55,
        conversion_score: 40,
        conversion_goal: "Activation",
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

  it("returns null when LLM declines interruption", async () => {
    setTimLlmPredictorForTests(async () => ({ should_interrupt: false }));
    const interruption = await predictInterruption({
      endpoint: "upload_tap_trace",
      workspace_id: "ws-1",
      tap_action: "system2:select",
    });
    expect(interruption).toBeNull();
  });

  it("passes through llm_interruption without calling TIM LLM", async () => {
    const llm = vi.fn(async () => ({ should_interrupt: true, message: "should not run" }));
    setTimLlmPredictorForTests(llm);

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
    expect(llm).not.toHaveBeenCalled();
  });

  it("normalizes LLM interruption payloads", () => {
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
      { mode: "report", report: { overall_score: 80 } },
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
      "https://openlesson.academy",
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