import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  predictInterruption,
  withProofOfWorkApiResponse,
} from "@/lib/agent-v2/predictive-interruption";
import { setTimProviderForTests, type TimProvider } from "@/lib/agent-v2/tim-provider";
import type { TimFeatureEnvelopeV1 } from "@/lib/agent-v2/tim-feature-envelope";
import type { ProofOfWorkApiInterruption } from "@/lib/agent-v2/predictive-interruption";

function rulesProvider(
  decide: (features: TimFeatureEnvelopeV1) => ProofOfWorkApiInterruption | null,
): TimProvider {
  return {
    id: "tap-rules",
    async predict(features) {
      return decide(features);
    },
  };
}

function active(
  type: NonNullable<ProofOfWorkApiInterruption>["intervention"]["type"],
  message: string,
  delay_ms: number,
  extra?: Partial<NonNullable<ProofOfWorkApiInterruption>["intervention"]> & {
    confidence?: "low" | "medium" | "high";
  },
): ProofOfWorkApiInterruption {
  const { confidence = "medium", ...interventionExtra } = extra || {};
  return {
    interruption_id: `int_${type}`,
    delay_ms,
    confidence,
    predicted_at: new Date().toISOString(),
    intervention: {
      type,
      message,
      ...interventionExtra,
    },
  };
}

describe("tap predictive interruptions (TIM provider)", () => {
  beforeEach(() => {
    setTimProviderForTests(
      rulesProvider((features) => {
        const endpoint = features.event.endpoint;
        const action = features.proof_of_work.tool_action || "";
        const artifacts = features.proof_of_work.artifacts_count ?? 0;

        if (endpoint === "upload_tap_trace" && action === "system1:pause_finalize") {
          return active(
            "reflection_prompt",
            "You stashed a thought without sending it to Helios — what made you hold back, or what were you still forming?",
            45_000,
            { consumer_action: "present_tap_reflection" },
          );
        }
        if (endpoint === "upload_tap_trace" && action.startsWith("system2:send")) {
          return active(
            "checkpoint_probe",
            "Before your next thought, state one claim from your last answer you are least sure about.",
            90_000,
            { confidence: "low", consumer_action: "present_tap_checkpoint" },
          );
        }
        if (endpoint === "upload_tap_trace" && artifacts === 5) {
          return active(
            "coaching_nudge",
            "Pause and summarize the main idea you have demonstrated so far in one sentence.",
            60_000,
            { consumer_action: "present_tap_synthesis" },
          );
        }
        if (endpoint === "upload_tap_chat") {
          return active(
            "checkpoint_probe",
            "Helios asked a question — can you answer it out loud before you type your next thought?",
            75_000,
            { consumer_action: "present_verbal_probe" },
          );
        }
        if (endpoint === "upload_ile_trace" && action === "system1:pause_finalize") {
          return active(
            "reflection_prompt",
            "You paused without sending — what were you still forming?",
            45_000,
          );
        }
        if (endpoint === "upload_tap_speech" && action === "speech_start") {
          return active(
            "checkpoint_probe",
            "Keep going — can you connect this thought to something specific you learned?",
            120_000,
            { confidence: "low" },
          );
        }
        if (endpoint === "upload_tap_speech" && action === "speech_stop") {
          return active(
            "reflection_prompt",
            "You paused — what were you about to say next, or what made you stop there?",
            30_000,
            { confidence: "low" },
          );
        }
        if (endpoint === "upload_tap_idle") {
          return active(
            "coaching_nudge",
            "You have been quiet for a minute — say your current thought out loud, even if it is unfinished.",
            15_000,
            { consumer_action: "present_idle_nudge" },
          );
        }
        return null;
      }),
    );
  });

  afterEach(() => {
    setTimProviderForTests(null);
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

  it("returns null for low-signal trace actions when provider declines", async () => {
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
