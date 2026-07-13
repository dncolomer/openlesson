import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  predictInterruption,
  withProofOfWorkApiResponse,
} from "@/lib/agent-v2/predictive-interruption";
import { setTimLlmPredictorForTests } from "@/lib/agent-v2/tim-llm-predictor";

describe("tap predictive interruptions (LLM-backed TIM)", () => {
  beforeEach(() => {
    setTimLlmPredictorForTests(async (context) => {
      const action = context.tap_action || "";

      if (context.endpoint === "upload_tap_trace" && action === "system1:pause_finalize") {
        return {
          should_interrupt: true,
          delay_ms: 45_000,
          confidence: "medium",
          intervention_type: "reflection_prompt",
          message:
            "You stashed a thought without sending it to Helios — what made you hold back, or what were you still forming?",
          consumer_action: "present_tap_reflection",
        };
      }
      if (context.endpoint === "upload_tap_trace" && action.startsWith("system2:send")) {
        return {
          should_interrupt: true,
          delay_ms: 90_000,
          confidence: "low",
          intervention_type: "checkpoint_probe",
          message: "Before your next thought, state one claim from your last answer you are least sure about.",
          consumer_action: "present_tap_checkpoint",
        };
      }
      if (context.endpoint === "upload_tap_trace" && context.proof_of_work_artifacts === 5) {
        return {
          should_interrupt: true,
          delay_ms: 60_000,
          confidence: "medium",
          intervention_type: "coaching_nudge",
          message: "Pause and summarize the main idea you have demonstrated so far in one sentence.",
          consumer_action: "present_tap_synthesis",
        };
      }
      if (context.endpoint === "upload_tap_chat") {
        return {
          should_interrupt: true,
          delay_ms: 75_000,
          confidence: "medium",
          intervention_type: "checkpoint_probe",
          message: "Helios asked a question — can you answer it out loud before you type your next thought?",
          consumer_action: "present_verbal_probe",
        };
      }
      if (context.endpoint === "upload_ile_trace" && action === "system1:pause_finalize") {
        return {
          should_interrupt: true,
          delay_ms: 45_000,
          confidence: "medium",
          intervention_type: "reflection_prompt",
          message: "You paused without sending — what were you still forming?",
        };
      }
      if (context.endpoint === "upload_tap_speech" && action === "speech_start") {
        return {
          should_interrupt: true,
          delay_ms: 120_000,
          confidence: "low",
          intervention_type: "checkpoint_probe",
          message: "Keep going — can you connect this thought to something specific you learned?",
        };
      }
      if (context.endpoint === "upload_tap_speech" && action === "speech_stop") {
        return {
          should_interrupt: true,
          delay_ms: 30_000,
          confidence: "low",
          intervention_type: "reflection_prompt",
          message: "You paused — what were you about to say next, or what made you stop there?",
        };
      }
      if (context.endpoint === "upload_tap_idle") {
        return {
          should_interrupt: true,
          delay_ms: 15_000,
          confidence: "medium",
          intervention_type: "coaching_nudge",
          message: "You have been quiet for a minute — say your current thought out loud, even if it is unfinished.",
          consumer_action: "present_idle_nudge",
        };
      }
      return { should_interrupt: false };
    });
  });

  afterEach(() => {
    setTimLlmPredictorForTests(null);
  });

  it("predicts reflection after stash (system1 pause_finalize)", async () => {
    const interruption = await predictInterruption({
      endpoint: "upload_tap_trace",
      workspace_id: "ws-tap-1",
      tap_action: "system1:pause_finalize",
      proof_of_work_artifacts: 2,
    });
    expect(interruption?.intervention.type).toBe("reflection_prompt");
    expect(interruption?.intervention.message).toContain("stashed");
    expect(interruption?.delay_ms).toBeGreaterThanOrEqual(15_000);
  });

  it("predicts checkpoint after deliberate send", async () => {
    const interruption = await predictInterruption({
      endpoint: "upload_tap_trace",
      workspace_id: "ws-tap-1",
      tap_action: "system2:send",
      proof_of_work_artifacts: 3,
    });
    expect(interruption?.intervention.type).toBe("checkpoint_probe");
  });

  it("predicts synthesis nudge on trace milestones", async () => {
    const interruption = await predictInterruption({
      endpoint: "upload_tap_trace",
      workspace_id: "ws-tap-1",
      tap_action: "system2:edit",
      proof_of_work_artifacts: 5,
    });
    expect(interruption?.intervention.type).toBe("coaching_nudge");
  });

  it("returns null for low-signal trace actions when LLM declines", async () => {
    expect(
      await predictInterruption({
        endpoint: "upload_tap_trace",
        workspace_id: "ws-tap-1",
        tap_action: "system2:select",
        proof_of_work_artifacts: 2,
      }),
    ).toBeNull();
  });

  it("predicts verbal probe after Helios chat exchange", async () => {
    const interruption = await predictInterruption({
      endpoint: "upload_tap_chat",
      workspace_id: "ws-tap-1",
      proof_of_work_artifacts: 4,
    });
    expect(interruption?.intervention.type).toBe("checkpoint_probe");
    expect(interruption?.intervention.message).toContain("out loud");
  });

  it("predicts ILE trace interruptions like TAP traces", async () => {
    const interruption = await predictInterruption({
      endpoint: "upload_ile_trace",
      workspace_id: "ws-ile-1",
      tap_action: "system1:pause_finalize",
      proof_of_work_artifacts: 2,
    });
    expect(interruption?.intervention.type).toBe("reflection_prompt");
  });

  it("predicts speech segment interruptions for start and stop", async () => {
    const start = await predictInterruption({
      endpoint: "upload_tap_speech",
      workspace_id: "ws-tap-1",
      tap_action: "speech_start",
    });
    const stop = await predictInterruption({
      endpoint: "upload_tap_speech",
      workspace_id: "ws-tap-1",
      tap_action: "speech_stop",
    });
    expect(start?.intervention.type).toBe("checkpoint_probe");
    expect(stop?.intervention.type).toBe("reflection_prompt");
  });

  it("predicts coaching nudge after idle heartbeat", async () => {
    const interruption = await predictInterruption({
      endpoint: "upload_tap_idle",
      workspace_id: "ws-tap-1",
      proof_of_work_artifacts: 6,
      idle_duration_ms: 60_000,
    });
    expect(interruption?.intervention.type).toBe("coaching_nudge");
    expect(interruption?.intervention.message).toContain("quiet");
    expect(interruption?.delay_ms).toBe(15_000);
  });

  it("attaches interruption to TAP trace API shape", async () => {
    const payload = await withProofOfWorkApiResponse(
      { trace: { id: "trace-1" } },
      {
        endpoint: "upload_tap_trace",
        workspace_id: "ws-tap-1",
        tap_action: "system1:pause_finalize",
        proof_of_work_artifacts: 1,
      },
    );
    expect(payload.interruption).not.toBeNull();
    expect(payload.trace).toEqual({ id: "trace-1" });
  });
});